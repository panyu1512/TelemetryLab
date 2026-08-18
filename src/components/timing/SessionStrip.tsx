/**
 * The session strip — one non-interactive readout line above the field on the
 * dense timing surfaces (Standings and Relative).
 *
 * `design.md` § Dense tabular overlays, rule 7 says a timing surface is rows and
 * nothing else *because nothing on it can be aimed at*. A strip that is purely a
 * readout — no buttons, no menus, nothing that rewards a click — sits inside
 * that rule rather than against it, which is why rule 7 now names the readout
 * exception explicitly. Whether the strip shows at all is still a Manager
 * setting, not a control on this surface.
 *
 * It also settles the second half of § Deliberately not adopted: the reference
 * strips this app studied are icon-only (a thermometer glyph, a crossed-swords
 * glyph). Here every field carries a mono micro-label per § Typography, because
 * a glyph the user has to *learn* is not a readout, it is a quiz.
 *
 * Fields drop right-to-left as the overlay narrows, in {@link FIELDS} order, the
 * same way the table itself scales to its window (`lib/tableScale`).
 */

import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import { degrees, duration, kilo } from "../../lib/format";
import {
  activeFlag,
  incidentColor,
  raceDistance,
  sessionTag,
} from "../../lib/sessionStrip";

/**
 * Wall-clock refresh. The strip shows HH:MM, so a minute is the finest
 * granularity it can ever display — 15 s keeps the rollover from visibly
 * lagging without waking React every second of a two-hour enduro.
 */
const CLOCK_MS = 15_000;

/** Height of the strip in px, exported so callers can budget the field's space. */
export const STRIP_H = 26;

type FieldId = "lap" | "left" | "inc" | "trk" | "sof" | "air" | "clk";

/**
 * Strip fields in render order, each with the surface width (px) below which it
 * drops. Ordered so the *last* field to survive a narrowing overlay is the one
 * the driver reads most: which lap they are on.
 *
 * The session tag is not in this list — it never drops, and it is the strip's
 * only item that isn't a label/value pair.
 */
const FIELDS: readonly { id: FieldId; label: string; minWidth: number }[] = [
  { id: "lap", label: "Lap", minWidth: 0 },
  { id: "left", label: "Left", minWidth: 210 },
  { id: "inc", label: "Inc", minWidth: 285 },
  { id: "trk", label: "Trk", minWidth: 355 },
  { id: "sof", label: "SoF", minWidth: 425 },
  { id: "air", label: "Air", minWidth: 495 },
  { id: "clk", label: "Clk", minWidth: 575 },
];

export interface SessionStripProps {
  /**
   * Measured width of the host surface, in CSS px. Both timing screens already
   * observe their own width for column fitting, so the strip reads that rather
   * than mounting a second ResizeObserver. A width of 0 (not yet measured)
   * shows every field; the strip clips rather than wraps until the first
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

  const values: Record<
    FieldId,
    { text: string; color?: string; title?: string }
  > = {
    lap: {
      text: raceDistance(session, telemetryLap ?? 0),
      title: session.isTimed
        ? "Lap · projected race distance"
        : "Lap · race distance",
    },
    left: {
      text: session.isTimed
        ? duration(session.sessionTimeRemain)
        : session.sessionLapsRemain != null
          ? `${session.sessionLapsRemain}L`
          : "—",
      title: "Session remaining",
    },
    inc: {
      text: incidents != null ? `${incidents}x` : "—",
      color: incidentColor(incidents ?? 0),
      title: "Your incident points this session",
    },
    trk: {
      text: degrees(session.weather.trackTemp),
      title: "Track temperature",
    },
    sof: { text: kilo(session.sof), title: "Strength of field" },
    air: { text: degrees(session.weather.airTemp), title: "Air temperature" },
    clk: {
      text: `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
      title: "Local time",
    },
  };

  return (
    <div
      className="timing-strip flex shrink-0 items-center gap-x-3 overflow-hidden px-2"
      style={{ height: STRIP_H }}
    >
      {/* Session tag, with the active flag as its ground. Flag state is the one
          thing on this strip that can change what the driver does *next*, so it
          is the one thing allowed a fill — and filled ink is `on-accent`
          (§ Theme, rule 1), never white on a light accent. */}
      <span
        className="shrink-0 rounded-ctl px-1.5 py-0.5 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.1em]"
        style={
          flag
            ? { background: flag.color, color: "var(--color-on-accent)" }
            : { color: "var(--color-muted)" }
        }
        title={
          flag ? `${session.sessionName} · ${flag.label}` : session.sessionName
        }
      >
        {sessionTag(session.sessionType)}
      </span>

      {FIELDS.map(({ id, label, minWidth }) =>
        width <= 0 || width >= minWidth ? (
          <Field key={id} label={label} {...values[id]} />
        ) : null
      )}
    </div>
  );
}

/**
 * One `LABEL value` pair. Mono micro-label per § Typography — quiet, tracked,
 * `faint` — against a bold value in full `text`, so the strip scans as a row of
 * numbers with their units attached rather than as a sentence.
 */
function Field({
  label,
  text,
  color,
  title,
}: {
  label: string;
  text: string;
  color?: string;
  title?: string;
}) {
  return (
    <span className="flex shrink-0 items-baseline gap-1" title={title}>
      <span className="font-mono text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-faint">
        {label}
      </span>
      <span
        className="tnum font-mono text-[12px] font-bold leading-none"
        style={{ color: color ?? "var(--color-text)" }}
      >
        {text}
      </span>
    </span>
  );
}
