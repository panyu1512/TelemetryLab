/**
 * The session header — one non-interactive readout row above the field on the
 * dense timing surfaces (Standings and Relative).
 *
 * `design.md` § Dense tabular overlays, rule 7 says a timing surface is rows and
 * nothing else *because nothing on it can be aimed at*. A header that is purely
 * a readout — no buttons, no menus, nothing that rewards a click — sits inside
 * that rule rather than against it, which is why rule 7 names the readout
 * exception explicitly. Whether it shows at all is still a Manager setting, not
 * a control on this surface.
 *
 * It settles the second half of § Deliberately not adopted too: the reference
 * strips this app studied are icon-only (a thermometer glyph, a crossed-swords
 * glyph). Here every field carries a word, because a glyph the user has to
 * *learn* is not a readout, it is a quiz.
 *
 * **It is a different row from the ones under it, and is drawn to look like
 * one** (§ The session header). It used to be a strip on the rows' own
 * ground, one line of label/value pairs at the rows' height, and so it read as
 * the table's first row rather than as what heads it. Now it is taller, a
 * flat header panel of its own, and each field is a stack — a small caps
 * label over a mono value — so the numbers in it read as instruments, not
 * cells. The active flag fills the session tag and nothing else.
 *
 * Fields drop right-to-left as the overlay narrows, in {@link FIELDS} order, the
 * same way the table itself scales to its window (`lib/tableScale`).
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import { degrees, duration, rating } from "../../lib/format";
import {
  activeFlag,
  incidentColor,
  raceDistanceParts,
  sessionTag,
} from "../../lib/sessionStrip";

/**
 * Wall-clock refresh. The header shows HH:MM, so a minute is the finest
 * granularity it can ever display — 15 s keeps the rollover from visibly
 * lagging without waking React every second of a two-hour enduro.
 */
const CLOCK_MS = 15_000;

/**
 * Height of the readout strip that heads Fuel & Strategy, in px. The Standings
 * and Relative header is taller — see {@link SESSION_HEADER_H}.
 */
export const STRIP_H = 26;

/**
 * Height of the session header on Standings and Relative, in px: two lines —
 * a 9 px label over a 16 px value — with room above and below them. It is
 * taller than a row on purpose; at a row's height it read as one.
 */
export const SESSION_HEADER_H = 42;

type FieldId = "track" | "lap" | "left" | "inc" | "trk" | "air" | "sof" | "clk";

/**
 * Header fields in render order, each with the surface width (px) below which
 * it drops. Ordered so the *last* field to survive a narrowing overlay is the
 * one the driver reads most: which lap they are on. The track goes first — it
 * is the one fact on the header that does not change during the session.
 *
 * The session tag is not in this list — it never drops.
 */
const FIELDS: readonly { id: FieldId; label: string; minWidth: number }[] = [
  { id: "track", label: "", minWidth: 640 },
  { id: "lap", label: "Lap", minWidth: 0 },
  { id: "left", label: "Left", minWidth: 200 },
  { id: "inc", label: "Inc", minWidth: 260 },
  { id: "trk", label: "Track", minWidth: 330 },
  { id: "air", label: "Air", minWidth: 390 },
  { id: "sof", label: "SoF", minWidth: 460 },
  { id: "clk", label: "Time", minWidth: 530 },
];

export interface SessionStripProps {
  /**
   * Measured width of the host surface, in CSS px. Both timing screens already
   * observe their own width for column fitting, so the header reads that rather
   * than mounting a second ResizeObserver. A width of 0 (not yet measured)
   * shows every field; the header clips rather than wraps until the first
   * measurement lands.
   */
  width: number;
}

export function SessionStrip({ width }: SessionStripProps) {
  const session = useSessionStore((s) => s.session);
  // Selected field-by-field: this component re-renders on the 1 Hz session
  // channel and, via `lap`, on the 60 Hz telemetry channel — so it must pull the
  // single number it needs, never the whole frame.
  const telemetryLap = useTelemetryStore((s) => s.telemetry?.lap ?? null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  const player = useMemo(
    () => session?.drivers.find((d) => d.carIdx === session.driverCarIdx),
    [session]
  );

  if (!session) return null;

  const flag = activeFlag(session.flags);
  const incidents = player?.incidentCount ?? null;
  const distance = raceDistanceParts(session, telemetryLap ?? 0);
  const shows = (id: FieldId) => {
    const f = FIELDS.find((x) => x.id === id)!;
    return width <= 0 || width >= f.minWidth;
  };
  const labelOf = (id: FieldId) => FIELDS.find((x) => x.id === id)!.label;

  return (
    <div
      className="session-header timing-block relative flex shrink-0 items-center gap-x-4 overflow-hidden pl-2 pr-3"
      style={{ height: SESSION_HEADER_H }}
    >
      {/* Session tag, with the active flag as its ground. Flag state is the one
          thing on the header that can change what the driver does *next*, so it
          is the one thing allowed a fill — and filled ink is `on-accent`
          (§ Theme, rule 1), never white on a light accent. */}
      <span
        className="session-tag shrink-0 rounded-ctl px-2 text-small font-semibold uppercase leading-[22px] tracking-caps"
        style={
          flag
            ? { background: flag.color, color: "var(--color-on-accent)" }
            : { color: "var(--color-text)" }
        }
        data-flag={flag ? "" : undefined}
        title={
          flag ? `${session.sessionName} · ${flag.label}` : session.sessionName
        }
      >
        {sessionTag(session.sessionType)}
      </span>

      {/* Where — the one field that never changes in a session, so it is the
          one that gives way: it takes the slack, truncates, and is the first
          to drop as the overlay narrows. */}
      {shows("track") && session.track.name ? (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-[5px]">
          <span className="truncate text-name font-medium leading-none text-text">
            {session.track.name}
          </span>
          {session.track.config && (
            <span className="label-caps truncate">{session.track.config}</span>
          )}
        </div>
      ) : (
        <div className="flex-1" />
      )}

      {shows("lap") && (
        <HeaderField
          label={labelOf("lap")}
          title={
            session.isTimed
              ? "Lap · projected race distance"
              : "Lap · race distance"
          }
        >
          {distance.lap}
          {distance.total != null && (
            <span className="text-small text-faint">/{distance.total}</span>
          )}
        </HeaderField>
      )}
      {shows("left") && (
        <HeaderField label={labelOf("left")} title="Session remaining">
          {session.isTimed
            ? duration(session.sessionTimeRemain)
            : session.sessionLapsRemain != null
              ? `${session.sessionLapsRemain}L`
              : "—"}
        </HeaderField>
      )}
      {shows("inc") && (
        <HeaderField
          label={labelOf("inc")}
          title="Your incident points this session"
          color={incidentColor(incidents ?? 0)}
        >
          {incidents != null ? `${incidents}x` : "—"}
        </HeaderField>
      )}
      {shows("trk") && (
        <HeaderField label={labelOf("trk")} title="Track temperature">
          {degrees(session.weather.trackTemp)}
        </HeaderField>
      )}
      {shows("air") && (
        <HeaderField label={labelOf("air")} title="Air temperature">
          {degrees(session.weather.airTemp)}
        </HeaderField>
      )}
      {shows("sof") && (
        <HeaderField label={labelOf("sof")} title="Strength of field">
          {rating(session.sof)}
        </HeaderField>
      )}
      {shows("clk") && (
        <>
          <span aria-hidden className="session-header-rule" />
          <HeaderField label={labelOf("clk")} title="Local time">
            {`${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`}
          </HeaderField>
        </>
      )}
    </div>
  );
}

/**
 * One header field: a small caps label over a mono value. The header's
 * own voice — taller than {@link StripField}, which the class band and the
 * Fuel & Strategy strip keep, because a row of label/value pairs at a row's
 * height is what made the old header read as a row.
 */
function HeaderField({
  label,
  title,
  color,
  children,
}: {
  label: string;
  title?: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex shrink-0 flex-col justify-center gap-[5px]"
      title={title}
    >
      <span className="label-caps">{label}</span>
      <span
        className="tnum text-readout font-medium leading-none"
        style={{ color: color ?? "var(--color-text)" }}
      >
        {children}
      </span>
    </div>
  );
}

/**
 * One label / bold value pair — the strip's whole grammar, exported so every
 * readout line on a timing surface (the class band, the Fuel & Strategy strip)
 * speaks it rather than approximating it.
 *
 * Every label in the system is the same voice — sans, small, uppercase,
 * tracked, grey — and every value the mono. The two `voice`s now differ only
 * in alignment: **`sans`** (the class band) centres the pair on the row,
 * **`mono`** (the default; Fuel & Strategy, Coach) sets them on a shared
 * baseline.
 */
export function StripField({
  label,
  text,
  color,
  fill,
  title,
  className = "",
  voice = "mono",
}: {
  /**
   * A word, or a glyph standing in for one — which has to carry its own
   * accessible name (see `RacingHelmet`). A glyph takes full `text` rather
   * than the label colour: it is an outline, and held back its strokes grey
   * out into a smudge.
   */
  label: ReactNode;
  text: string;
  color?: string;
  /**
   * A ground behind the value, for the one field that has to say more than its
   * ink can (the class band's session-best lap). Brings `on-accent` with it.
   */
  fill?: string;
  title?: string;
  className?: string;
  voice?: "mono" | "sans";
}) {
  const sans = voice === "sans";
  const isGlyph = typeof label !== "string";
  return (
    <span
      className={`flex shrink-0 gap-1 ${sans ? "items-center" : "items-baseline"} ${className}`}
      title={title}
    >
      <span
        className="label-caps"
        style={isGlyph ? { color: "var(--color-muted)" } : undefined}
      >
        {label}
      </span>
      <span
        className="tnum text-cell font-medium leading-none"
        style={
          fill
            ? {
                background: fill,
                color: "var(--color-on-accent)",
                padding: "3px 5px",
                borderRadius: "var(--radius-ctl)",
              }
            : { color: color ?? "var(--color-text)" }
        }
      >
        {text}
      </span>
    </span>
  );
}
