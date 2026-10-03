/**
 * Fuel & Strategy Calculator (backlog Feature 1).
 *
 * A full-bleed overlay screen that turns the player's raw fuel telemetry into
 * live strategy: how much you're burning, whether it lasts to the flag, when to
 * pit, how much to save, and one or two candidate stint plans. All of the math
 * lives in `lib/fuelStrategy.ts`; the sampling/state lives in
 * `hooks/useFuelStrategy.ts`. This file is purely presentation.
 *
 * **Nothing here can be aimed at** — design.md § Dense tabular overlays rule 7.
 * This screen used to carry three controls: a reserve stepper, a pit-fuel
 * override, and a collapsed "Pit strategies" section you had to click to open.
 * All three are gone. It is read while the driver's hands are busy, so it holds
 * no button, no checkbox and no disclosure; the plans are simply always
 * visible. The two settings those controls fed now sit at their defaults —
 * a 1.0-lap margin, and pit fuel calculated as needed — and if either ever
 * needs to move, rule 7 says its home is the Overlay Manager, not this screen.
 */

import { Gauge, Wrench, TriangleAlert, Check, Radio, Leaf } from "lucide-react";
import { useTelemetry } from "../../hooks/useTelemetry";
import { useSessionStore } from "../../stores/useSessionStore";
import { useFuelStrategy } from "../../hooks/useFuelStrategy";
import type { FuelStatus, FuelStrategy, StintPlan } from "../../lib/fuelStrategy";
import { num } from "../../lib/format";
import { STRIP_H, StripField } from "../timing/SessionStrip";

// ── status metadata ──────────────────────────────────────────────────────────

interface StatusMeta {
  label: string;
  color: string;
  Icon: typeof Check;
}

function statusMeta(status: FuelStatus): StatusMeta {
  switch (status) {
    case "finish":
      return { label: "Finish on fuel", color: "var(--color-accent)", Icon: Check };
    case "save":
      return { label: "Save to finish", color: "var(--color-warning)", Icon: Leaf };
    case "pit":
      return { label: "Pit stop needed", color: "var(--color-warning)", Icon: Wrench };
    case "empty":
      return { label: "Out of fuel", color: "var(--color-danger)", Icon: TriangleAlert };
    default:
      return { label: "Calibrating…", color: "var(--color-muted)", Icon: Gauge };
  }
}

// ── fixed inputs ─────────────────────────────────────────────────────────────

/**
 * Safety margin at the flag, in laps — fuel the strategy refuses to count
 * towards the finish. This is iRacing's own AutoFuel unit and its own default:
 * AutoFuel's "Margin (Laps)" field, which it recommends never dropping below
 * 1.0 in a timed race. Matching the sim's unit matters more than it looks —
 * a driver reading "margin 1.0" here and setting "Margin (Laps) 1.0" in the
 * black box should get the same fuel, not two answers that need reconciling.
 *
 * Was a stepper in this header, and before that a percentage of the tank.
 */
const MARGIN_LAPS = 1;

/** Litres to add per stop. `null` = whatever the plan says is needed. */
const PIT_FUEL: number | null = null;

// ── main screen ──────────────────────────────────────────────────────────────

/**
 * Fuel & Strategy is drawn in the timing surfaces' language, not a dashboard's
 * of its own. It shares their paper already (`design.md` § Dense tabular
 * overlays, rule 9); it now shares the rest — a readout strip in place of a
 * title bar, mono micro-labels over bold values, sections set apart by the
 * same faint white tone Standings uses for its class groups rather than by
 * bordered graphite cards, and square-ended bars like the dashboard widgets'.
 * A driver glancing from the standings to this panel should not have to
 * re-learn where the numbers are.
 */
export function FuelStrategyScreen() {
  const { data, iracingActive } = useTelemetry();
  const session = useSessionStore((s) => s.session);

  const { strategy, sampleCount, outOfFuel } = useFuelStrategy(data, session, {
    marginLaps: MARGIN_LAPS,
    pitFuel: PIT_FUEL,
  });

  const hasFuel = data?.fuelLevel != null;

  return (
    <div className="overlay-card timing-surface flex h-full flex-col overflow-hidden rounded-card border border-border/60">
      <Strip
        track={session?.track.name ?? null}
        config={session?.track.config ?? null}
      />

      {!hasFuel ? (
        <EmptyState iracingActive={iracingActive} />
      ) : (
        // `@container` lets the layout switch to two columns based on the
        // overlay's *own* width (not the viewport), so the core read-outs fit a
        // small always-on-top window without scrolling while you drive.
        <div className="@container flex flex-1 flex-col gap-1.5 overflow-auto p-1.5">
          {(outOfFuel || strategy.status === "empty") && <OutOfFuelAlert />}

          <PredictionRow strategy={strategy} sampleCount={sampleCount} />

          <div className="grid grid-cols-1 gap-1.5 @[460px]:grid-cols-2">
            <FuelBar strategy={strategy} />
            <StrategyCard strategy={strategy} />
            <FuelSaveCard strategy={strategy} />
          </div>

          <PlansCard strategy={strategy} />
        </div>
      )}
    </div>
  );
}

// ── strip ────────────────────────────────────────────────────────────────────

/**
 * The readout line above the panel, in the § Session strip's geometry and
 * grammar: a tag, then micro-label / value pairs, on the strip's hairline.
 * It replaces a title bar — an icon, "Fuel & Strategy" in a heading face and
 * the track in grey — which was the one piece of window chrome left on an
 * overlay screen, and which spent its height naming a panel the driver chose
 * to open.
 *
 * The tag is unfilled. The strip's single fill belongs to state that changes
 * what the driver does next, and on this panel that is the status block
 * directly beneath, not the strip.
 */
function Strip({ track, config }: { track: string | null; config: string | null }) {
  return (
    <div
      className="timing-strip flex shrink-0 items-center gap-x-3 overflow-hidden px-2"
      style={{ height: STRIP_H }}
    >
      <span className="shrink-0 px-1.5 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.1em] text-muted">
        Fuel
      </span>
      <span className="min-w-0 truncate text-[12px] font-semibold leading-none text-muted">
        {track ?? "—"}
        {config ? ` · ${config}` : ""}
      </span>

      {/* A readout, not a control — rule 7 allows the first and bans the
          second. It stays because every lap figure below is quoted *after* this
          margin is taken off the tank, and a number you cannot account for is
          a number you end up not trusting. Labelled as AutoFuel labels it, so
          it reads against the sim's own black box rather than beside it. */}
      <StripField
        className="ml-auto"
        label="Margin"
        text={`${MARGIN_LAPS.toFixed(1)} lap${MARGIN_LAPS === 1 ? "" : "s"}`}
        title="Fuel held back at the flag (iRacing AutoFuel: Margin (Laps))"
      />
    </div>
  );
}

// ── fuel bar ─────────────────────────────────────────────────────────────────

function FuelBar({ strategy }: { strategy: FuelStrategy }) {
  const pct = strategy.fuelPct ?? 0;
  const reserveFrac =
    strategy.tankCapacity && strategy.reserve
      ? strategy.reserve / strategy.tankCapacity
      : 0;

  const low = pct < 0.15;
  const fill = low ? "var(--color-danger)" : "var(--color-accent)";

  return (
    <Section title="Level & burn">
      <div className="mb-2 flex items-end justify-between">
        <Metric
          label="In tank"
          value={num(strategy.fuelLevel, 1)}
          unit="L"
          color={low ? "var(--color-danger)" : undefined}
        />
        <Metric
          label="Per lap"
          value={strategy.perLap == null ? "—" : strategy.perLap.toFixed(2)}
          unit="L"
          align="end"
        />
      </div>

      {/* Tank bar, with the margin marked where it falls on the tank. Its
          position moves with the burn now that the margin is priced in laps —
          a thirstier car sets it further up the bar. Square-ended on a visible
          track, like every bar on the dashboard: a rounded pill on a track the
          same tone as its card read as a lozenge floating in space rather than
          as a level in a tank. */}
      <div className="relative h-2 w-full overflow-hidden" style={{ background: TRACK }}>
        <div
          className="h-full transition-[width] duration-150"
          style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: fill }}
        />
        {reserveFrac > 0 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-danger"
            style={{ left: `${reserveFrac * 100}%` }}
            title={`Margin: ${MARGIN_LAPS.toFixed(1)} lap = ${num(strategy.reserve, 1)} L`}
          />
        )}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between">
        <span className="tnum font-mono text-[11px] font-bold text-muted">
          {strategy.fuelPct == null ? "—" : Math.round(strategy.fuelPct * 100)}%
        </span>
        <StripField
          label="Cap"
          text={strategy.tankCapacity == null ? "—" : `${num(strategy.tankCapacity, 0)} L`}
          color="var(--color-muted)"
          title="Tank capacity"
        />
      </div>
    </Section>
  );
}

// ── prediction row ───────────────────────────────────────────────────────────

/**
 * The verdict, on a ground of its status colour.
 *
 * The ground and the icon tile are `color-mix`ed from the status token. They
 * used to be built by appending a hex alpha to it — `${color}44` — which is
 * invalid CSS when the colour is `var(--color-warning)`, so both declarations
 * were dropped and the block fell back to a white `currentColor` outline on
 * bare paper: the loudest box on the panel, in no colour at all.
 */
function PredictionRow({
  strategy,
  sampleCount,
}: {
  strategy: FuelStrategy;
  sampleCount: number;
}) {
  const meta = statusMeta(strategy.status);

  const lapsLeftFuel =
    strategy.lapsOfFuelSafe == null ? "—" : strategy.lapsOfFuelSafe.toFixed(1);
  const lapsToFinish =
    strategy.lapsToFinish == null ? "—" : String(strategy.lapsToFinish);

  return (
    <section
      className="flex items-center gap-2.5 rounded-card px-2.5 py-2"
      style={{ background: mix(meta.color, 12) }}
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-ctl"
        style={{ background: mix(meta.color, 22), color: meta.color }}
      >
        <meta.Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[15px] font-bold leading-tight"
          style={{ color: meta.color }}
        >
          {meta.label}
        </div>
        <div className="truncate text-[11px] text-muted">
          {sampleCount === 0
            ? "Estimating — complete a lap for live data."
            : `${sampleCount} lap${sampleCount === 1 ? "" : "s"} sampled`}
        </div>
      </div>
      <div className="flex shrink-0 gap-4">
        <Metric label="Fuel laps" value={lapsLeftFuel} align="end" />
        <Metric label="To flag" value={lapsToFinish} unit="laps" align="end" />
      </div>
    </section>
  );
}

// ── strategy card (stint + pit window) ───────────────────────────────────────

function StrategyCard({ strategy }: { strategy: FuelStrategy }) {
  const { stintUsed, stintTotal, pitWindow, recommendedPitLap, surplusLaps } =
    strategy;

  const stintProgress =
    stintUsed != null && stintTotal != null && stintTotal > 0
      ? Math.min(1, stintUsed / stintTotal)
      : null;

  return (
    <Section title="Current stint">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] text-text">
          {stintUsed == null || stintTotal == null ? (
            "—"
          ) : (
            <>
              Lap <span className="tnum font-bold">{stintUsed}</span> of ~
              <span className="tnum font-bold">{Math.round(stintTotal)}</span>
            </>
          )}
        </span>
        <span className="tnum font-mono text-[11px] font-bold text-muted">
          {stintProgress == null ? "" : `${Math.round(stintProgress * 100)}%`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden" style={{ background: TRACK }}>
        <div
          className="h-full bg-accent transition-[width] duration-200"
          style={{ width: `${(stintProgress ?? 0) * 100}%` }}
        />
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-3">
        <KeyValue label="Pit window">
          {pitWindow == null
            ? "—"
            : pitWindow[0] === pitWindow[1]
              ? `Lap ${pitWindow[1]}`
              : `Lap ${pitWindow[0]}–${pitWindow[1]}`}
        </KeyValue>
        <KeyValue label="Recommended">
          {recommendedPitLap == null ? "—" : `Lap ${recommendedPitLap}`}
        </KeyValue>
      </div>

      {surplusLaps != null && (
        <div className="mt-2 text-[11px] text-muted">
          {surplusLaps >= 0 ? (
            <>
              Margin:{" "}
              <span className="tnum font-bold text-accent">+{surplusLaps}</span> lap
              {surplusLaps === 1 ? "" : "s"} of fuel over the finish.
            </>
          ) : (
            <>
              Short by{" "}
              <span className="tnum font-bold text-danger">{Math.abs(surplusLaps)}</span> lap
              {surplusLaps === -1 ? "" : "s"} at the current burn.
            </>
          )}
        </div>
      )}
    </Section>
  );
}

// ── fuel-save card ───────────────────────────────────────────────────────────

function FuelSaveCard({ strategy }: { strategy: FuelStrategy }) {
  const { saveNeededPct, targetPerLap, perLap, finishesOnFuel, status } = strategy;

  // Nothing to coach if we're finishing comfortably or have no burn data.
  if (perLap == null) return null;

  const finishing = finishesOnFuel === true || !saveNeededPct;
  /*
   * A deficit big enough to force a stop is not a saving target. The card used
   * to quote the arithmetic whatever it came to — "Save 61%", which is not a
   * number anybody can drive to, printed directly under a banner reading "Pit
   * stop needed". `status` already separates the two cases: `save` is the one
   * where lifting and coasting can still close the gap.
   */
  const mustPit = !finishing && status === "pit";

  return (
    // Full width in the two-column layout. It is the grid's third item, so in
    // two columns it used to sit alone under the tank with an empty cell of
    // paper beside it — the one hole in an otherwise packed panel.
    <Section title="Fuel save" className="@[460px]:col-span-2">
      {mustPit ? (
        <p className="text-xs text-muted">
          Too far short to save — the stop below is required. Saving buys laps
          in the window, not the finish.
        </p>
      ) : finishing ? (
        <p className="text-xs text-muted">
          No lift-and-coast needed — you're on target to finish on the current
          burn.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="tnum text-[15px] font-bold text-warning">
              Save {Math.round((saveNeededPct ?? 0) * 100)}%
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              Lift &amp; coast to reach the flag without an extra stop.
            </p>
          </div>
          <div className="flex shrink-0 gap-4">
            <Metric
              label="Target"
              value={targetPerLap == null ? "—" : targetPerLap.toFixed(2)}
              unit="L"
              align="end"
            />
            <Metric label="Now" value={perLap.toFixed(2)} unit="L" align="end" />
          </div>
        </div>
      )}
    </Section>
  );
}

// ── plans card ───────────────────────────────────────────────────────────────

/**
 * The candidate stint plans. This used to be collapsed behind a disclosure
 * button, on the grounds that the core read-outs should fit a small overlay
 * without scrolling. That traded a driver's glance for a click, which is the
 * wrong way round on a surface read at speed: the plans are always open now,
 * and a window too short for them scrolls like it always did.
 */
function PlansCard({ strategy }: { strategy: FuelStrategy }) {
  const plans = strategy.plans;
  if (plans.length === 0) return null;

  return (
    <Section title="Pit strategies">
      <div className="flex flex-col gap-1">
        {plans.map((plan, i) => (
          <PlanRow key={plan.stops} plan={plan} primary={i === 0} />
        ))}
      </div>
    </Section>
  );
}

/**
 * One plan as one row: the plan's name in a fixed-width mono slot, then each
 * stop as a lap and the litres it adds. Stops line up down the list because
 * the name slot is a column, not a pill sized to its text.
 *
 * The recommended plan wears `primary` as its ground and ring — the same
 * "selection" statement the player's row makes on Standings — rather than a
 * second border style of its own.
 */
function PlanRow({ plan, primary }: { plan: StintPlan; primary: boolean }) {
  return (
    <div
      className={[
        "flex min-h-8 items-center gap-3 rounded-ctl px-2.5 py-1.5",
        primary ? "bg-primary/15 ring-1 ring-inset ring-primary/60" : "bg-white/[0.035]",
      ].join(" ")}
    >
      <span
        className={[
          "w-[3.6rem] shrink-0 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.08em]",
          primary ? "text-primary" : "text-muted",
        ].join(" ")}
      >
        {plan.label}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        {plan.stops === 0 ? (
          <span className="text-xs text-text">Run to the flag — no stop required.</span>
        ) : (
          plan.pitLaps.map((lap, i) => (
            <span key={i} className="flex shrink-0 items-baseline gap-1.5">
              <StripField label="Lap" text={String(lap)} />
              <span className="tnum font-mono text-[11px] font-bold text-muted">
                +{plan.addFuel[i].toFixed(1)} L
              </span>
            </span>
          ))
        )}
      </span>
      {primary && (
        <span className="shrink-0 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-primary">
          Best
        </span>
      )}
    </div>
  );
}

// ── alerts / empty state ─────────────────────────────────────────────────────

function OutOfFuelAlert() {
  return (
    <div className="flex items-center gap-2 rounded-card bg-danger/15 px-2.5 py-2 text-sm text-danger">
      <TriangleAlert className="size-4 shrink-0" />
      <span>
        <span className="font-bold">Out of fuel.</span> Pit immediately — the
        calculator will re-learn your burn after refuelling.
      </span>
    </div>
  );
}

function EmptyState({ iracingActive }: { iracingActive: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-card border border-border bg-surface-2">
          <Radio className="size-6 text-faint" />
        </div>
        <h2 className="text-base font-semibold text-text">No fuel data</h2>
        <p className="text-sm leading-relaxed text-muted">
          {iracingActive
            ? "Waiting for the telemetry feed…"
            : "Start a session in iRacing (or run the mock bridge) to see fuel strategy."}
        </p>
      </div>
    </div>
  );
}

// ── little shared bits ───────────────────────────────────────────────────────

/** A bar's empty track: visible on the section tone, unlike `surface`. */
const TRACK = "rgb(255 255 255 / 0.08)";

/** A status token at `pct` strength over transparent — valid for `var()`s. */
function mix(color: string, pct: number): string {
  return `color-mix(in oklab, ${color} ${pct}%, transparent)`;
}

/**
 * A section of the panel: the Standings class-group tone (`GROUP_TONE`'s base,
 * plain white alpha) with a mono micro-label legend. No border and no graphite
 * — a bordered `surface-2` card on timing paper read as a second product
 * pasted onto the first.
 */
function Section({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-card bg-white/[0.035] p-2.5 ${className}`}>
      <h3 className="mb-2 font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-faint">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  unit,
  align = "start",
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  align?: "start" | "end";
  color?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${align === "end" ? "items-end" : "items-start"}`}>
      <div className="flex items-baseline gap-1">
        <span
          className="tnum text-[18px] font-bold leading-none"
          style={{ color: color ?? "var(--color-text)" }}
        >
          {value}
        </span>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
      <span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-faint">
        {label}
      </span>
    </div>
  );
}

function KeyValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="font-mono text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-faint">
        {label}
      </div>
      <div className="tnum text-[13px] font-bold text-text">{children}</div>
    </div>
  );
}
