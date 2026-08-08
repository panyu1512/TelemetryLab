import { memo } from "react";
import type { ClassStanding } from "../../telemetry/types";
import { kilo, lapTime } from "../../lib/format";
import { readableInk } from "../../lib/contrast";


/**
 * The band that opens a class group.
 *
 * An earlier reading of `design.md` § Dense tabular overlays, rule 2 banned
 * this outright: a gap plus a tone shift separates classes for a third of the
 * height. That is still true, and the gap and tone shift are still here — but
 * separation was never the band's only job. A class's **own** numbers (how many
 * cars are in it, its strength of field, its fastest lap) are per-class and
 * per-group, so the session strip cannot hold them and no row can either. The
 * band is the only place they exist.
 *
 * What the band is *not* is anything you can aim at (rule 7): it has no
 * controls, and the per-class collapse and solo that used to live on the old
 * class header are not coming back with it.
 *
 * It borrows the session strip's grammar — a chip, then mono micro-label /
 * bold value pairs — so a multi-class field reads as one masthead and several
 * sub-mastheads rather than as two unrelated kinds of furniture.
 */
function ClassBandInner({
  standing,
  fastestIsOverall,
  width,
}: {
  standing: ClassStanding;
  /** This class's fastest lap is also the fastest in the field. */
  fastestIsOverall: boolean;
  /**
   * Measured width of the surface, in CSS px. Fields drop right-to-left as the
   * overlay narrows, exactly as the session strip and the table's own columns
   * do — the class chip is the last thing standing, because a band that has
   * clipped its own name has stopped doing its job.
   */
  width: number;
}) {
  const { color, shortName, carCount, sof, fastestLap } = standing;

  return (
    <div
      className="flex h-full items-center gap-3 overflow-hidden rounded-sm bg-white/[0.045] pr-2"
      style={{
        // The band's leading edge carries the class colour at full strength: the
        // row's 3 px left border, one scale up (§ Two colour systems, rule 2).
        // Being the same device, it has to sit at the same x — so the band's
        // wrapper carries no horizontal padding, and the chip's own `ml-1`
        // matches the row's `px-1`, putting chip and position column on one
        // vertical.
        borderLeft: `3px solid ${color}`,
      }}
    >
      {/* The class chip. Identity colour is the subject of this band, so here it
          is allowed to fill — and because `carClassColor` is arbitrary rather
          than one of this palette's (uniformly light) status colours, the ink is
          measured off the fill instead of assuming `on-accent`. */}
      <span
        className="ml-1 shrink-0 rounded-[3px] px-1.5 py-1 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.08em]"
        style={{ background: color, color: readableInk(color) }}
      >
        {shortName || "—"}
      </span>

      <BandField label="Cars" value={carCount > 0 ? String(carCount) : "—"} />
      {fits(width, 230) && <BandField label="SoF" value={kilo(sof)} />}
      {fits(width, 300) && (
        <BandField
          label="Best"
          value={lapTime(fastestLap)}
          // The class's fastest lap is purple when it also leads the field, which
          // is the same meaning `--color-sector-purple` carries in every row.
          color={fastestIsOverall ? "var(--color-sector-purple)" : undefined}
          title={
            fastestIsOverall
              ? "Fastest lap in class — and in the session"
              : "Fastest lap in class"
          }
        />
      )}
    </div>
  );
}

/** A zero width means "not measured yet" — show everything and let it clip. */
function fits(width: number, minWidth: number): boolean {
  return width <= 0 || width >= minWidth;
}

function BandField({
  label,
  value,
  color,
  title,
}: {
  label: string;
  value: string;
  color?: string;
  title?: string;
}) {
  return (
    <span className="flex shrink-0 items-baseline gap-1" title={title}>
      <span className="font-mono text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-faint">
        {label}
      </span>
      <span
        className="tnum font-mono text-[11px] font-bold leading-none"
        style={{ color: color ?? "var(--color-text)" }}
      >
        {value}
      </span>
    </span>
  );
}

export const ClassBand = memo(ClassBandInner);
