import { memo } from "react";
import type { ClassStanding } from "../../telemetry/types";
import { kilo, lapTime } from "../../lib/format";
import { classRowFill } from "../../lib/classColors";
import { CLASS_EDGE_WIDTH } from "./constants";


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
  color,
  fillStop,
  fastestIsOverall,
  width,
}: {
  standing: ClassStanding;
  /**
   * This class's identity colour, from `lib/classColors` rather than from
   * `standing.color`. The sim's own hue is not used any more — see that module
   * for why red in particular had to go.
   */
  color: string;
  /**
   * Where the class-colour fill stops, as a CSS length — the same
   * `firstColumnStop` the rows are given, which is the whole point of passing
   * it in rather than recomputing it here. Band and rows share one vertical or
   * the effect is just a stripe that nearly lines up.
   */
  fillStop: string;
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
  const { shortName, carCount, sof, fastestLap } = standing;

  return (
    <div
      className="flex h-full items-center gap-3 overflow-hidden rounded-sm bg-white/[0.045] pr-2"
      style={{
        // The band's leading edge is the row's, one scale up — the same device,
        // so it takes the same width and holds the same drawn size as the table
        // scales (§ Two colour systems, rule 2). It was a flat `3px` here while
        // the rows compensated for scale, which quietly put the two on different
        // verticals at anything below full size.
        borderLeftWidth: CLASS_EDGE_WIDTH,
        borderLeftStyle: "solid",
        borderLeftColor: color,
        // The same fill the rows carry, stopping at the same x, so band and
        // group read as one unbroken bar of class colour down the leading edge.
        // `border-box` origin because unlike a row — whose fill sits on a
        // wrapper outside the border — this element carries the border itself,
        // and a padding-box origin would start the gradient after it and throw
        // the stop out by exactly the edge width.
        backgroundImage: classRowFill(color, fillStop),
        backgroundOrigin: "border-box",
      }}
    >
      {/* The class name.
          It used to be a pill filled with the class colour, which was the one
          place identity colour was allowed to fill. The fill above replaced it
          rather than joining it: an opaque pill sits exactly where the fill goes
          and would have hidden it, and of the two the fill is the one that makes
          the band part of its group instead of furniture above it. The name
          keeps identity as ink instead, and starts where the row's *second*
          column starts — past the fill, on the vertical the car numbers sit on. */}
      <span
        className="shrink-0 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.08em]"
        style={{
          marginLeft: `calc(${fillStop} - ${CLASS_EDGE_WIDTH} + 0.25rem)`,
          color,
        }}
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
