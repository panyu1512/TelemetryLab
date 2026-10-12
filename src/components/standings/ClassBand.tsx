import { memo } from "react";
import type { ClassStanding } from "../../telemetry/types";
import { lapTime, rating } from "../../lib/format";
import { RacingHelmet } from "../ui/RacingHelmet";
import { StripField } from "../timing/SessionStrip";
import {
  CLASS_NAME_OUTLINE,
  CLASS_NAME_OUTLINE_PX,
  classFill,
} from "../../lib/classFill";
import { CLASS_EDGE_WIDTH, STANDINGS_FILL_REACH } from "./constants";

/**
 * The band that opens a class group.
 *
 * An earlier reading of `design.md` § Dense tabular overlays, rule 2 banned
 * this outright: a gap separates classes for a third of the height. That is
 * still true, and the gap is still here — but
 * separation was never the band's only job. A class's **own** numbers (how many
 * cars are in it, its strength of field, its fastest lap) are per-class and
 * per-group, so the session header cannot hold them and no row can either. The
 * band is the only place they exist.
 *
 * What the band is *not* is anything you can aim at (rule 7): it has no
 * controls, and the per-class collapse and solo that used to live on the old
 * class header are not coming back with it.
 *
 * It is a strip like the rows under it — the same `timing-row` ground and the
 * same class edge — and speaks the strip grammar ({@link StripField}),
 * set apart as a heading by the class name in front and by
 * a clear `BAND_GAP` under it — the band is its own block of paper, with the
 * game showing between it and its rows — rather than by a solid block of the
 * class's colour. The solid block made the heading the loudest thing on the
 * surface, louder than the fastest-lap fill rule 5 reserves that for.
 */
function ClassBandInner({
  standing,
  color,
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
  /** This class's fastest lap is also the fastest in the field. */
  fastestIsOverall: boolean;
  /**
   * Measured width of the surface, in CSS px. Fields drop right-to-left as the
   * overlay narrows, exactly as the session header does — the class name is the
   * last thing standing, because a band that has clipped its own name has
   * stopped doing its job.
   */
  width: number;
}) {
  const { shortName, carCount, sof, fastestLap } = standing;

  return (
    <div
      className="bg-timing-row flex h-full items-center gap-3 overflow-hidden pr-2"
      style={{
        // The band's leading edge is the row's — the same device, so it takes
        // the same width and holds the same drawn size as the table scales
        // (§ Two colour systems, rule 2), and the band's edge and the rows'
        // make one spine of class colour down the group.
        borderLeftWidth: CLASS_EDGE_WIDTH,
        borderLeftStyle: "solid",
        borderLeftColor: color,
        // The rows' class fill, to the same reach: the class name sits on it
        // exactly where the positions under it do.
        backgroundImage: classFill(color, STANDINGS_FILL_REACH),
      }}
    >
      {/* The class name, in the rows' own bold sans at their 13 px: a heading
          set smaller than the names under it is a heading nobody reads first.
          Its `ml-1` matches the row's `px-1` and its minimum width is the
          position column's, so `GT3` sits centred over the column of
          positions it heads. */}
      <span
        className="class-name-ink ml-1 min-w-[2.1rem] shrink-0 text-center text-[13px] font-bold uppercase leading-none tracking-[0.02em]"
        // In its class colour, straight on the class fill, with a dark outline
        // under the glyphs for the edge its own colour cannot give it
        // (§ Dense tabular overlays, rule 11).
        style={{
          color,
          WebkitTextStroke: `${CLASS_NAME_OUTLINE_PX}px ${CLASS_NAME_OUTLINE}`,
        }}
      >
        {shortName || "—"}
      </span>

      {fits(width, 160) && (
        <StripField
          label="SoF"
          text={rating(sof)}
          title="Strength of field"
          voice="sans"
        />
      )}

      {/* The car count wears a helmet where the other fields wear words. Not
          decoration, and not an inconsistency either: `SoF` and `Best` are
          *measures* of a class, this is the population they are measured over,
          and a glyph is what says so at a glance. */}
      {fits(width, 230) && (
        <StripField
          voice="sans"
          label={<RacingHelmet size="13px" label="Cars" />}
          text={carCount > 0 ? String(carCount) : "—"}
          title="Cars in class"
        />
      )}
      {fits(width, 330) && (
        <StripField
          voice="sans"
          label="Best"
          text={lapTime(fastestLap)}
          // Overall-best keeps the purple fill it carries in every row — the
          // fill reads the same on the band's strip as on a row's.
          fill={fastestIsOverall ? "var(--color-sector-purple)" : undefined}
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

export const ClassBand = memo(ClassBandInner);
