import { memo } from "react";
import type { ClassStanding } from "../../telemetry/types";
import { initialAndSurname, kilo, lapTime } from "../../lib/format";
import { TOWER, towerInk } from "../../lib/towerPalette";
import { CLASS_BAND_H } from "./constants";

/**
 * The header that opens a class card on the timing tower:
 * `[GT3]  6 cars  SOF 4.1k  ……  BEST LAP [2:15.239] P. Costa`.
 *
 * A class's **own** numbers — how many cars, its strength of field, its fastest
 * lap and who set it — are per-class and per-group, so the race-control bar
 * cannot hold them and no row can either; this is the only place they exist.
 *
 * The header is quiet paper with the class's colour in exactly one place, the
 * chip that names it, which is the same block of colour every position in the
 * card sits in. The best lap sits on the class-best violet, the same fill the
 * lap carries in its row, so the eye can go from one to the other.
 *
 * Nothing on it can be aimed at (`design.md` § Dense tabular overlays, rule 7):
 * what the gap column measures to is a Manager setting, and a class cannot be
 * collapsed from here.
 */
function ClassBandInner({
  standing,
  color,
  bestBy,
  width,
}: {
  standing: ClassStanding;
  /** This class's identity colour — the ramp's, or the driver's own pick. */
  color: string;
  /** Who holds the class's fastest lap, as "P. Costa", or null. */
  bestBy: string | null;
  /**
   * Width the header has to draw in, in canvas px. Fields drop right-to-left
   * as the tower narrows; the chip is the last thing standing, because a
   * header that has clipped its own name has stopped doing its job.
   */
  width: number;
}) {
  const { shortName, carCount, sof, fastestLap } = standing;
  return (
    <div
      className="flex items-center gap-5 overflow-hidden whitespace-nowrap"
      style={{
        height: CLASS_BAND_H,
        boxSizing: "border-box",
        padding: "0 16px",
        borderBottom: `1px solid ${TOWER.border}`,
      }}
    >
      <span
        className="tower-cond shrink-0 rounded-[4px] px-2.5 py-[3px] text-[18px] font-bold leading-[1.1] tracking-[0.06em]"
        style={{ background: color, color: towerInk(color) }}
      >
        {shortName || "—"}
      </span>
      {fits(width, 200) && (
        <span className="shrink-0 text-[15px]" style={{ color: TOWER.text2 }}>
          {carCount > 0 ? `${carCount} ${carCount === 1 ? "car" : "cars"}` : "—"}
        </span>
      )}
      {fits(width, 320) && <Field label="SoF" value={kilo(sof)} />}
      {fits(width, 520) && fastestLap != null && (
        <div className="ml-auto flex shrink-0 items-center gap-2.5">
          <span
            className="text-[12px] uppercase tracking-[0.1em]"
            style={{ color: TOWER.text3 }}
          >
            Best lap
          </span>
          <span
            className="rounded-[4px] px-2.5 py-[3px] text-[16px] font-semibold"
            style={{ background: TOWER.classBest, color: TOWER.onClassBest }}
            title="Fastest lap in class"
          >
            {lapTime(fastestLap)}
          </span>
          {bestBy && fits(width, 680) && (
            <span className="text-[14px]" style={{ color: TOWER.text2 }}>
              {initialAndSurname(bestBy)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** A zero width means "not measured yet" — show everything and let it clip. */
function fits(width: number, minWidth: number): boolean {
  return width <= 0 || width >= minWidth;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex shrink-0 items-baseline gap-1.5">
      <span className="text-[12px] uppercase tracking-[0.1em]" style={{ color: TOWER.text3 }}>
        {label}
      </span>
      <span className="text-[16px] font-semibold" style={{ color: TOWER.text }}>
        {value}
      </span>
    </span>
  );
}

export const ClassBand = memo(ClassBandInner);
