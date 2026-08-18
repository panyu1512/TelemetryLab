import { memo, type ReactNode } from "react";
import type { ClassStanding } from "../../telemetry/types";
import { kilo, lapTime } from "../../lib/format";
import { classBandFill } from "../../lib/classColors";
import { readableInk } from "../../lib/contrast";
import { RacingHelmet } from "../ui/RacingHelmet";
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
   * overlay narrows, exactly as the session strip and the table's own columns
   * do — the class chip is the last thing standing, because a band that has
   * clipped its own name has stopped doing its job.
   */
  width: number;
}) {
  const { shortName, carCount, sof, fastestLap } = standing;

  /*
   * Everything on the band prints in ink measured against the band's own fill,
   * not in a palette token. The fill is identity colour, which arrives per class
   * and can land anywhere on the wheel — white reads on a violet class and
   * disappears on a lime one, so neither white nor `on-accent` can be assumed.
   *
   * `labelInk` is the same ink held back rather than a second colour. `faint`
   * used to carry the micro-labels and cannot any more: it is tuned against the
   * app's dark surfaces and lands somewhere near invisible on a light fill.
   */
  const ink = readableInk(color);
  const labelInk = `color-mix(in oklab, ${ink} 72%, transparent)`;

  return (
    <div
      className="flex h-full items-center gap-3 overflow-hidden rounded-sm pr-2"
      style={{
        // The band's leading edge is the row's, one scale up — the same device,
        // so it takes the same width and holds the same drawn size as the table
        // scales (§ Two colour systems, rule 2). It was a flat `3px` here while
        // the rows compensated for scale, which quietly put the two on different
        // verticals at anything below full size.
        borderLeftWidth: CLASS_EDGE_WIDTH,
        borderLeftStyle: "solid",
        borderLeftColor: color,
        // The class's colour, solid, across the whole band, where a row carries
        // it only to the end of its first column. The band is the heading and
        // the rows are what it heads, and that is the hierarchy: masthead solid,
        // rows striped. See `classBandFill` for why the tint it replaces was
        // the wrong instrument for a heading.
        backgroundColor: classBandFill(color),
      }}
    >
      {/* The class name, knocked out of the fill rather than printed in the
          class's colour on top of it — which is what it used to do, and which
          stops working the moment the fill *is* that colour. Its `ml-1` matches
          the row's `px-1`, so the name and the leading column start on one
          vertical and the band's content begins where the field's does, rather
          than indented past a block of empty colour. */}
      <span
        className="ml-1 shrink-0 font-mono text-[11px] font-bold uppercase leading-none tracking-[0.08em]"
        style={{ color: ink }}
      >
        {shortName || "—"}
      </span>

      {/* The car count wears a helmet where the other two fields wear words.
          Not decoration, and not an inconsistency either: `SoF` and `Best` are
          *measures* of a class, this is the population they are measured over,
          and a glyph is what says so at a glance. It takes the band's full-
          strength ink rather than the held-back label ink the words take: it is
          an outline, and at 72 % its strokes fall under a pixel and grey out
          into a smudge. */}
      <BandField
        label={<RacingHelmet size="12px" label="Cars" />}
        value={carCount > 0 ? String(carCount) : "—"}
        ink={ink}
        labelInk={ink}
        title="Cars in class"
      />
      {fits(width, 230) && (
        <BandField label="SoF" value={kilo(sof)} ink={ink} labelInk={labelInk} />
      )}
      {fits(width, 300) && (
        <BandField
          label="Best"
          value={lapTime(fastestLap)}
          ink={ink}
          labelInk={labelInk}
          // Overall-best used to be purple *ink* here, as it is in every row.
          // On a solid band that fails outright — purple on lime, purple on
          // violet — so the mark moves from the ink to a fill behind it. Same
          // token, same meaning, and a filled chip is legible on any class
          // colour the sim can hand us.
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

function BandField({
  label,
  value,
  ink,
  labelInk,
  fill,
  title,
}: {
  /**
   * A mono micro-label, or a glyph standing in for one. Anything passed here
   * has to carry its own accessible name — see {@link RacingHelmet}.
   */
  label: ReactNode;
  value: string;
  /** Ink for the value, measured against the band's fill by the caller. */
  ink: string;
  /** Ink for the micro-label — the same colour, held back. */
  labelInk: string;
  /**
   * A ground behind the value, for the one field that has to say something the
   * band's own colour has already spoken for. Brings `on-accent` with it.
   */
  fill?: string;
  title?: string;
}) {
  // `tracking-[0.14em]` puts a trailing letter-space after a word's last
  // character, so a text label's `gap-1` is really 4 px + 1.12 px. A glyph gets
  // no such trailing space and lands visibly tighter against its value than the
  // fields either side of it. Paying it back in the same unit that owes it keeps
  // the three gaps identical, and stays correct if the tracking is ever retuned.
  const isGlyph = typeof label !== "string";

  return (
    <span className="flex shrink-0 items-baseline gap-1" title={title}>
      <span
        className="font-mono text-[8px] font-semibold uppercase leading-none tracking-[0.14em]"
        style={{
          color: labelInk,
          ...(isGlyph ? { paddingRight: "0.14em" } : null),
        }}
      >
        {label}
      </span>
      <span
        className="tnum font-mono text-[11px] font-bold leading-none"
        style={
          fill
            ? {
                background: fill,
                color: "var(--color-on-accent)",
                padding: "2px 4px",
                borderRadius: "var(--radius-ctl)",
              }
            : { color: ink }
        }
      >
        {value}
      </span>
    </span>
  );
}

export const ClassBand = memo(ClassBandInner);
