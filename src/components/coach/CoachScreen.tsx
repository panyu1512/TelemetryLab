/**
 * Coach — corner-by-corner feedback on the lap you just drove.
 *
 * The bridge's coach lines every completed lap up against your quickest clean
 * lap, measures each corner and names what it cost (`bridge/telemetrylab/
 * coaching/`). This screen says the one or two things worth acting on, then
 * shows the whole lap underneath: a strip of the lap coloured by where time
 * went, and every corner's loss or gain as a row.
 *
 * It is a timing surface in everything but name, so it follows the same
 * rules: drawn in the Fuel panel's strip-and-section grammar (§ Fuel &
 * Strategy in the timing language), status colour only for status — green
 * gained, amber lost, red lost a lot — and **nothing on it can be aimed at**
 * (§ Dense tabular overlays, rule 7). Which corners become tips, and how many,
 * are Manager settings (`useCoachUiStore`), applied by `lib/coaching.ts`.
 *
 * The analysis lands once per lap, at the line. The headline replays a short
 * fade when it changes — the one moment the driver might glance across for
 * it — and holds still until the next lap.
 *
 * Under it, when the bridge has one, the **session best**: the fastest lap
 * anyone in the player's class has set, and the last lap held against it
 * corner by corner. Time only — nobody else's pedals are published, so the
 * causes stay with the coach's own reference — but it answers the other
 * question a driver has: not "what did I do wrong" but "where is the quick
 * guy finding it".
 */

import { Check, Flag, GraduationCap, Radio, Repeat2, Trophy } from "lucide-react";
import { useMemo } from "react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import { useCoachingStore } from "../../stores/useCoachingStore";
import { useCoachUiStore } from "../../stores/useCoachUiStore";
import { useDriver, useSessionStore } from "../../stores/useSessionStore";
import {
  barScale,
  bestHolder,
  causeTag,
  coachView,
  cornerGrade,
  formatLoss,
  gradeColor,
  invalidReasonText,
  lapSegments,
  vsBestRows,
  type BestRow,
  type CoachTip,
  type CoachView,
} from "../../lib/coaching";
import { lapTime } from "../../lib/format";
import { deltaColor, signedDelta } from "../../lib/scales";
import type { CoachingPayload, CoachVsBest, SessionBestRef } from "../../telemetry/types";
import { STRIP_H, StripField } from "../timing/SessionStrip";

export function CoachScreen() {
  const coaching = useCoachingStore((s) => s.coaching);
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  const track = useSessionStore((s) => s.session?.track.name ?? null);
  const minLoss = useCoachUiStore((s) => s.minLoss);
  const tipCount = useCoachUiStore((s) => s.tipCount);
  const showCorners = useCoachUiStore((s) => s.showCorners);
  const showLapStrip = useCoachUiStore((s) => s.showLapStrip);
  const showSessionBest = useCoachUiStore((s) => s.showSessionBest);

  const view = useMemo(
    () => coachView(coaching, { minLoss, tipCount }),
    [coaching, minLoss, tipCount],
  );
  const compared = coaching != null && coaching.analysis.length > 0;

  return (
    <div className="overlay-card timing-surface flex h-full flex-col overflow-hidden rounded-card">
      <Strip track={track} coaching={coaching} showSessionBest={showSessionBest} />

      {/* Not connected: the empty state, whatever was last replayed — the
          bridge forgets its reference when iRacing goes away. */}
      {view.kind === "none" || !iracingActive ? (
        <EmptyState iracingActive={iracingActive} />
      ) : (
        <div className="flex flex-1 flex-col gap-1.5 overflow-auto p-1.5">
          <Headline view={view} />
          {showLapStrip && coaching && coaching.corners.length > 0 && (
            <LapStrip coaching={coaching} minLoss={minLoss} />
          )}
          {showSessionBest && coaching?.vsBest && (
            <SessionBestList coaching={coaching} vsBest={coaching.vsBest} minLoss={minLoss} />
          )}
          {showCorners && compared && <CornerList coaching={coaching} minLoss={minLoss} />}
        </div>
      )}
    </div>
  );
}

// ── strip ────────────────────────────────────────────────────────────────────

/**
 * The readout line above the panel, in § Session strip grammar: the tag, the
 * track, then the reference lap and the lap just driven against it. Like the
 * Fuel strip, the tag is unfilled — the panel's one coloured block is the
 * headline directly beneath.
 */
function Strip({
  track,
  coaching,
  showSessionBest,
}: {
  track: string | null;
  coaching: CoachingPayload | null;
  showSessionBest: boolean;
}) {
  const ref = coaching?.reference ?? null;
  const last = coaching?.lastLap ?? null;
  const best = showSessionBest ? (coaching?.sessionBest ?? null) : null;
  return (
    <div
      className="timing-strip flex shrink-0 items-center gap-x-3 overflow-hidden px-2"
      style={{ height: STRIP_H }}
    >
      <span className="label-caps shrink-0 px-0.5 text-text">Coach</span>
      <span className="min-w-0 truncate text-cell font-medium leading-none text-muted">
        {track ?? "—"}
      </span>
      <StripField
        className="ml-auto"
        label="Ref"
        text={ref ? lapTime(ref.lapTime) : "—"}
        title={ref ? `Reference: lap ${ref.lap}, your quickest clean lap` : "No reference lap yet"}
      />
      <StripField
        label="Last"
        text={last ? lapTime(last.lapTime) : "—"}
        title={last ? `Lap ${last.lap}` : undefined}
      />
      {/* On a new best the last lap *is* the reference now, so a delta beside
          two identical times reads as a bug; the headline carries it instead. */}
      {last?.delta != null && !coaching?.newReference && (
        <StripField label="Δ" text={signedDelta(last.delta)} color={deltaColor(last.delta)} />
      )}
      {best && <SessionBestField best={best} />}
    </div>
  );
}

/**
 * The session best on the strip, in the timing screens' purple — the colour
 * every overall-best lap wears — so it reads as the field's number, not yours.
 * It moves the moment anybody sets a new one, not at the player's line.
 */
function SessionBestField({ best }: { best: SessionBestRef }) {
  const driver = useDriver(best.carIdx ?? -1);
  return (
    <StripField
      label="Best"
      text={lapTime(best.lapTime)}
      color="var(--color-sector-purple)"
      title={`Session best in your class: ${bestHolder(best, driver)}`}
    />
  );
}

// ── headline ─────────────────────────────────────────────────────────────────

/**
 * The verdict on the lap, on a ground of its status colour — the same block
 * the Fuel panel opens with. Keyed on the lap, so the fade-in plays once per
 * analysis rather than on every re-render.
 */
function Headline({ view }: { view: Exclude<CoachView, { kind: "none" }> }) {
  const key = "lap" in view && view.lap != null ? `${view.kind}-${view.lap}` : view.kind;
  return (
    <div key={key} className="coach-in flex flex-col gap-1.5">
      {view.kind === "tips" ? (
        <>
          <TipBlock tip={view.tips[0]} primary />
          {view.tips.slice(1).map((tip) => (
            <TipBlock key={tip.corner} tip={tip} />
          ))}
          {view.unclean && (
            <Note>
              Lap {view.lap} is not a reference: {invalidReasonText(view.unclean)}.
            </Note>
          )}
        </>
      ) : (
        <StatusBlock view={view} />
      )}
    </div>
  );
}

function StatusBlock({ view }: { view: Exclude<CoachView, { kind: "none" | "tips" }> }) {
  const { color, Icon, title, line } = statusCopy(view);
  return (
    <section
      className="flex items-center gap-2.5 rounded-card border border-divider bg-section px-2.5 py-2"
      style={{ boxShadow: `inset 2px 0 0 ${color}` }}
    >
      <div
        className="grid size-7 shrink-0 place-items-center rounded-ctl border border-divider"
        style={{ color }}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-title font-semibold leading-tight" style={{ color }}>
          {title}
        </div>
        <div className="text-small leading-snug text-muted">{line}</div>
      </div>
      {view.kind === "best" && view.gains.length > 0 && (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {view.gains.map((g) => (
            <span key={g.corner} className="tnum text-small font-medium text-accent">
              {g.label} {formatLoss(g.timeLost)}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function statusCopy(view: Exclude<CoachView, { kind: "none" | "tips" }>): {
  color: string;
  Icon: typeof Check;
  title: string;
  line: string;
} {
  switch (view.kind) {
    case "waiting":
      return {
        color: "var(--color-muted)",
        Icon: Flag,
        title: "Drive a clean lap",
        line:
          view.lap != null
            ? `Lap ${view.lap} did not count (${invalidReasonText(view.reason)}). Your first clean lap becomes the reference.`
            : "Your first clean lap becomes the reference every lap after it is measured against.",
      };
    case "skipped":
      return {
        color: "var(--color-muted)",
        Icon: Flag,
        title: `Lap ${view.lap} not compared`,
        line: `${capitalise(invalidReasonText(view.reason))} — the next full lap will be.`,
      };
    case "reference":
      return {
        color: "var(--color-primary)",
        Icon: GraduationCap,
        title: `Reference set · ${lapTime(view.lapTime)}`,
        line: `Lap ${view.lap}. Every lap from here is measured against it, corner by corner.`,
      };
    case "best":
      return {
        color: "var(--color-accent)",
        Icon: Trophy,
        title: `New best · ${formatLoss(view.delta, 3)}`,
        line: `Lap ${view.lap}, ${lapTime(view.lapTime)} — your new reference.`,
      };
    case "clean":
      return {
        color: "var(--color-accent)",
        Icon: Check,
        title: "Nothing to fix",
        line:
          view.unclean != null
            ? `Lap ${view.lap}: no corner lost enough to call out — but ${invalidReasonText(view.unclean)}, so it is not a reference.`
            : `Lap ${view.lap}: every corner within your threshold of the reference.`,
      };
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * One tip: the corner, what it cost, what went wrong and the numbers behind
 * it. The first tip is the headline — larger, on its grade's ground; the rest
 * sit on the plain section tone so there is exactly one loud block.
 */
function TipBlock({ tip, primary = false }: { tip: CoachTip; primary?: boolean }) {
  const color = gradeColor(tip.grade);
  return (
    <section
      className={`flex items-center gap-2.5 rounded-card border border-divider bg-section px-2.5 ${primary ? "py-2" : "py-1.5"}`}
      style={{ boxShadow: `inset 2px 0 0 ${primary ? color : "var(--color-border-strong)"}` }}
    >
      <div
        className={`tnum grid shrink-0 place-items-center rounded-ctl border border-divider font-medium ${primary ? "h-7 min-w-10 text-name" : "h-6 min-w-8 text-small"}`}
        style={{ color }}
      >
        {tip.label}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={`truncate font-semibold leading-tight ${primary ? "text-title" : "text-name"}`}
          style={{ color: primary ? color : "var(--color-text)" }}
        >
          {tip.headline}
        </div>
        {(tip.detail.length > 0 || tip.repeat) && (
          <div className="flex flex-wrap items-center gap-x-2 text-small leading-snug text-muted">
            {tip.detail.length > 0 && <span>{tip.detail.join(" · ")}</span>}
            {tip.repeat && (
              <span className="inline-flex items-center gap-1 font-medium text-warning">
                <Repeat2 className="size-3" />
                {tip.repeat}
              </span>
            )}
          </div>
        )}
      </div>
      <span
        className={`tnum shrink-0 font-medium ${primary ? "text-readout-lg" : "text-name"}`}
        style={{ color }}
      >
        {formatLoss(tip.timeLost)}
      </span>
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="px-1 text-small leading-snug text-faint">{children}</p>;
}

// ── lap strip ────────────────────────────────────────────────────────────────

/**
 * The lap as one bar, start line on the left: each corner's stretch, from its
 * braking zone to the next one's, in its grade's colour. It answers "where on
 * the lap did it go" in one glance; the corner list underneath answers how
 * much. Square-ended on a visible track, like every bar on the dashboard.
 */
function LapStrip({ coaching, minLoss }: { coaching: CoachingPayload; minLoss: number }) {
  const segments = lapSegments(coaching.corners, coaching.analysis);
  return (
    <section className="rounded-card border border-divider bg-section px-2.5 pb-1.5 pt-2">
      <h3 className="label-caps mb-2">Lap</h3>
      <div className="relative h-2 w-full overflow-hidden" style={{ background: TRACK }}>
        {segments.map((s, i) => {
          const grade = s.timeLost == null ? "even" : cornerGrade(s.timeLost, minLoss);
          return (
            <div
              key={`${s.corner}-${i}`}
              className="absolute inset-y-0"
              style={{
                left: `${s.from * 100}%`,
                width: `${(s.to - s.from) * 100}%`,
                background: grade === "even" ? "transparent" : gradeColor(grade),
                opacity: grade === "even" ? 1 : 0.85,
                borderLeft: "1px solid var(--color-timing-bg)",
              }}
            />
          );
        })}
      </div>
      <div className="relative mt-1 h-3">
        {coaching.corners.map((c) => (
          <span
            key={c.number}
            className="tnum absolute -translate-x-1/2 text-label leading-none text-faint"
            style={{ left: `${c.apexPct * 100}%` }}
          >
            {c.label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ── corner list ──────────────────────────────────────────────────────────────

/**
 * Every corner, gained or lost: a diverging bar from a centre line — gains to
 * the left in green, losses to the right in amber or red — with the time and
 * the cause. The last row is the lap, and it is the sum of the rows above it:
 * the coach's segments partition the lap, so the arithmetic always closes.
 */
function CornerList({ coaching, minLoss }: { coaching: CoachingPayload; minLoss: number }) {
  const scale = barScale(coaching.analysis);
  const label = new Map(coaching.corners.map((c) => [c.number, c.label]));
  const delta = coaching.lastLap?.delta ?? null;
  return (
    <section className="rounded-card border border-divider bg-section p-2.5">
      <h3 className="label-caps mb-2.5">Corners</h3>
      <div className="flex flex-col gap-1">
        {coaching.analysis.map((a) => {
          const grade = cornerGrade(a.timeLost, minLoss);
          const color = gradeColor(grade);
          const frac = Math.min(1, Math.abs(a.timeLost) / scale) * 50;
          return (
            <div key={a.corner} className="grid grid-cols-[2.25rem_1fr_3.75rem_5.5rem] items-center gap-2">
              <span className="tnum text-small font-medium text-muted">
                {label.get(a.corner) ?? `T${a.corner}`}
              </span>
              <div className="relative h-1" style={{ background: TRACK }}>
                <div className="absolute inset-y-[-2px] left-1/2 w-px bg-chart-axis" />
                {grade !== "even" && (
                  <div
                    className="absolute inset-y-0"
                    style={{
                      background: color,
                      width: `${frac}%`,
                      left: a.timeLost < 0 ? `${50 - frac}%` : "50%",
                    }}
                  />
                )}
              </div>
              <span
                className="tnum text-right text-small font-medium"
                style={{ color: grade === "even" ? "var(--color-faint)" : color }}
              >
                {formatLoss(a.timeLost)}
              </span>
              <span className="label-caps truncate text-faint">
                {grade === "even" ? "" : causeTag(a.cause)}
              </span>
            </div>
          );
        })}
        {delta != null && (
          <div className="mt-1 grid grid-cols-[2.25rem_1fr_3.75rem_5.5rem] items-center gap-2 border-t border-divider pt-1.5">
            <span className="label-caps text-text">Lap</span>
            <span />
            <span
              className="tnum text-right text-small font-medium"
              style={{ color: deltaColor(delta) }}
            >
              {formatLoss(delta)}
            </span>
            <span className="label-caps text-faint">vs ref</span>
          </div>
        )}
      </div>
    </section>
  );
}

// ── session best ─────────────────────────────────────────────────────────────

/**
 * The last lap against the session best, drawn exactly like the corner list —
 * a diverging bar per corner and the time — so the two read as one grammar.
 * No cause column: the bridge times other cars from where they are on the
 * lap, and has no pedals to say why. The header names the lap it was held
 * against, which is the session best as it stood when this lap began: a new
 * one set since moves the strip at once and this list at the next line.
 */
function SessionBestList({
  coaching,
  vsBest,
  minLoss,
}: {
  coaching: CoachingPayload;
  vsBest: CoachVsBest;
  minLoss: number;
}) {
  const rows = vsBestRows(coaching);
  const scale = barScale(rows);
  const driver = useDriver(vsBest.carIdx ?? -1);
  const holder = bestHolder(vsBest, driver);
  return (
    <section className="rounded-card border border-divider bg-section p-2.5">
      <div className="mb-2.5 flex items-baseline gap-2">
        <h3 className="label-caps shrink-0">Session best</h3>
        <span className="min-w-0 truncate text-small text-muted">
          {holder} ·{" "}
          <span className="tnum" style={{ color: "var(--color-sector-purple)" }}>
            {lapTime(vsBest.lapTime)}
          </span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <BestRowLine key={r.corner} row={r} scale={scale} minLoss={minLoss} />
        ))}
        <div className="mt-1 grid grid-cols-[2.25rem_1fr_3.75rem_5.5rem] items-center gap-2 border-t border-divider pt-1.5">
          <span className="label-caps text-text">Lap</span>
          <span />
          <span
            className="tnum text-right text-small font-medium"
            style={{ color: deltaColor(vsBest.delta) }}
          >
            {formatLoss(vsBest.delta)}
          </span>
          <span className="label-caps truncate text-faint">vs best</span>
        </div>
      </div>
    </section>
  );
}

function BestRowLine({ row, scale, minLoss }: { row: BestRow; scale: number; minLoss: number }) {
  const grade = cornerGrade(row.timeLost, minLoss);
  const color = gradeColor(grade);
  const frac = Math.min(1, Math.abs(row.timeLost) / scale) * 50;
  return (
    <div className="grid grid-cols-[2.25rem_1fr_3.75rem_5.5rem] items-center gap-2">
      <span className="tnum text-small font-medium text-muted">{row.label}</span>
      <div className="relative h-1" style={{ background: TRACK }}>
        <div className="absolute inset-y-[-2px] left-1/2 w-px bg-chart-axis" />
        {grade !== "even" && (
          <div
            className="absolute inset-y-0"
            style={{
              background: color,
              width: `${frac}%`,
              left: row.timeLost < 0 ? `${50 - frac}%` : "50%",
            }}
          />
        )}
      </div>
      <span
        className="tnum text-right text-small font-medium"
        style={{ color: grade === "even" ? "var(--color-faint)" : color }}
      >
        {formatLoss(row.timeLost)}
      </span>
      <span />
    </div>
  );
}

// ── empty state ──────────────────────────────────────────────────────────────

function EmptyState({ iracingActive }: { iracingActive: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-10 place-items-center rounded-card border border-border bg-surface-2">
          <Radio className="size-5 text-faint" />
        </div>
        <h2 className="text-sm font-semibold text-text">No laps yet</h2>
        <p className="text-sm leading-relaxed text-muted">
          {iracingActive
            ? "Waiting for the coach — complete a lap to get going."
            : "Start a session in iRacing (or run the mock bridge) to get corner-by-corner coaching."}
        </p>
      </div>
    </div>
  );
}

/** A bar's empty track: visible on the section tone, unlike `surface`. */
const TRACK = "var(--color-chart-track)";
