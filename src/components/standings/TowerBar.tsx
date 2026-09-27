/**
 * The race-control bar: the session readout above the timing tower.
 *
 * `[RACE]  LAP 15/≈25  REMAINING 23:43  INCIDENTS 7x  TRACK 31°  AIR 22°  SOF 4.3k  ……  LOCAL TIME 12:05`
 *
 * A readout, never a control (`design.md` § Dense tabular overlays, rule 7) —
 * and the one place on the tower meant to be seen without being looked at.
 * Under a yellow the whole bar turns yellow; under a full-course caution it
 * turns amber, takes diagonal stripes and reads SAFETY CAR · NO OVERTAKING.
 * What each flag does to it is `lib/towerBar`'s business; this component only
 * paints the answer.
 *
 * The Relative still carries the older, smaller `SessionStrip`. The tower's bar
 * is its own component rather than a variant of that one because it is a
 * different shape — full words, larger values, and a ground that changes — and
 * the Relative has not been redrawn in this language yet.
 */

import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import { degrees, duration, kilo } from "../../lib/format";
import { raceDistance } from "../../lib/sessionStrip";
import { towerBarState, type RaceControl } from "../../lib/towerBar";
import { TOWER } from "../../lib/towerPalette";
import { BAR_H } from "./constants";
import { CarGlyph, FlagGlyph } from "./glyphs";

/** The clock shows HH:MM; 15 s keeps the rollover prompt without waking React every second. */
const CLOCK_MS = 15_000;

type FieldId = "lap" | "left" | "inc" | "trk" | "air" | "sof" | "clk";

/**
 * Fields in render order, each with the bar width (canvas px) below which it
 * drops. The last one standing is the lap — "am I on the last lap" is the
 * question this bar answers most.
 */
const FIELDS: readonly { id: FieldId; label: string; minWidth: number }[] = [
  { id: "lap", label: "Lap", minWidth: 0 },
  { id: "left", label: "Remaining", minWidth: 360 },
  { id: "inc", label: "Incidents", minWidth: 520 },
  { id: "trk", label: "Track", minWidth: 640 },
  { id: "air", label: "Air", minWidth: 740 },
  { id: "sof", label: "SoF", minWidth: 830 },
  { id: "clk", label: "Local time", minWidth: 1000 },
];

/**
 * Incident points coloured against the two limits nearly every series uses,
 * amber once one is in sight and red once one is close — but only on a green
 * bar. On yellow or amber the bar's own ink wins, because a coloured number on
 * a coloured ground is the one combination that is never legible.
 */
function incidentInk(count: number, control: RaceControl, fallback: string): string {
  if (control !== "green") return fallback;
  if (count >= 13) return TOWER.onDsq;
  if (count >= 8) return TOWER.caution;
  return fallback;
}

export function TowerBar({ width }: { width: number }) {
  const session = useSessionStore((s) => s.session);
  // One number off the 60 Hz channel, never the whole frame.
  const telemetryLap = useTelemetryStore((s) => s.telemetry?.lap ?? null);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => clearInterval(id);
  }, []);

  const player = useMemo(
    () => session?.drivers.find((d) => d.carIdx === session.driverCarIdx),
    [session],
  );

  if (!session) return null;

  const st = towerBarState(session.flags, session.sessionType, session.sessionName);
  const incidents = player?.incidentCount ?? null;
  const values: Record<FieldId, { text: string; color?: string; title: string }> = {
    lap: {
      text: raceDistance(session, telemetryLap ?? 0),
      title: session.isTimed ? "Lap · projected race distance" : "Lap · race distance",
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
      color: incidentInk(incidents ?? 0, st.control, st.value),
      title: "Your incident points this session",
    },
    trk: { text: degrees(session.weather.trackTemp), title: "Track temperature" },
    air: { text: degrees(session.weather.airTemp), title: "Air temperature" },
    sof: { text: kilo(session.sof), title: "Strength of field" },
    clk: {
      text: `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`,
      title: "Local time",
    },
  };

  const control = st.control !== "green";
  return (
    <div
      className="flex items-center gap-8 overflow-hidden whitespace-nowrap rounded-[8px]"
      style={{
        height: BAR_H,
        boxSizing: "border-box",
        padding: "0 16px",
        background: st.ground,
        border: `1px solid ${st.border}`,
      }}
    >
      <div className="flex shrink-0 items-center gap-3" aria-live="polite">
        <span
          className="tower-cond flex items-center gap-2 rounded-[4px] font-bold leading-none tracking-[0.08em]"
          style={{
            height: control ? 30 : undefined,
            padding: control ? "0 12px" : "4px 10px",
            fontSize: control ? 17 : 15,
            background: st.badge.background,
            color: st.badge.ink,
            boxShadow: st.badge.outline ? `inset 0 0 0 1px ${st.badge.outline}` : undefined,
          }}
          title={st.badge.title}
        >
          {st.badge.glyph === "flag" && <FlagGlyph size={16} />}
          {st.badge.glyph === "car" && <CarGlyph />}
          {st.badge.text}
        </span>
        {st.instruction && (
          <span className="text-[13px] font-bold tracking-[0.1em]" style={{ color: st.value }}>
            {st.instruction}
          </span>
        )}
      </div>

      {FIELDS.map(({ id, label, minWidth }) =>
        width <= 0 || width >= minWidth ? (
          <span
            key={id}
            className={`flex shrink-0 items-baseline gap-2 ${id === "clk" ? "ml-auto" : ""}`}
            title={values[id].title}
          >
            <span className="text-[12px] uppercase tracking-[0.1em]" style={{ color: st.label }}>
              {label}
            </span>
            <span
              className="text-[18px] font-semibold"
              style={{ color: values[id].color ?? st.value }}
            >
              {values[id].text}
            </span>
          </span>
        ) : null,
      )}
    </div>
  );
}
