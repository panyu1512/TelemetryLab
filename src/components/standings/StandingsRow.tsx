import { memo } from "react";
import { ArrowDown, ArrowUp, Wrench, AlertTriangle } from "lucide-react";
import { useStandingsRow } from "../../stores/useStandingsStore";
import { useDriver } from "../../stores/useSessionStore";
import {
  CLASS_EDGE_WIDTH,
  COL_LABEL_H,
  gridTemplate,
  LAP_COLOR,
  LAP_UNDERLINE,
  PLAYER_ROW_GROUND,
  ROW_GAP,
  rowSlotHeight,
  STANDINGS_BRAND_H,
  STANDINGS_FILL_REACH,
  type ColumnVisibility,
} from "./constants";
import { ColumnLabels } from "./ColumnLabels";
import { classFill } from "../../lib/classFill";
import { formatDriverName } from "../../lib/driverName";
import { usePositionFlash } from "../../hooks/usePositionFlash";
import { CountryFlag } from "../ui/CountryFlag";
import {
  BrandIcon,
  GapCell,
  IntervalCell,
  IRatingCell,
  LapCell,
  LicenseBadge,
  PosChange,
  SectorCell,
} from "./cells";

interface StandingsRowProps {
  carIdx: number;
  top: number;
  sectorCount: number;
  classColor: string;
  /** Grouped by class ⇒ show gap/interval relative to the class, not overall. */
  classRelative: boolean;
  /**
   * Rank derived by the layout, or null to print the car's own iRacing
   * position. Non-null only in a lap-time session, where this app did the
   * ordering and so has to supply the number that goes with it.
   */
  rank: number | null;
  /** Which columns to render (must match the labels). */
  isVisible: ColumnVisibility;
  /**
   * First row of its class group (or of the table, when flat). Its gap and
   * interval cells print the columns' names, since the leader has neither.
   */
  leader: boolean;
  /**
   * First row of its class group *and* column labels are switched on: prints
   * them in its top slice, so the table needs no header band (`design.md`
   * § Dense tabular overlays, rule 3). Off by default — see the rule.
   */
  labelled: boolean;
  /**
   * Whether this car holds the fastest lap in its class, or in the whole field.
   * The *only* filled cell on this surface (rule 5) — everything else that needs
   * colour gets coloured text.
   */
  fastest: "class" | "overall" | null;
}

/**
 * One field row. Subscribes to *only* its own timing entry (fast, 10 Hz) and its
 * own roster entry (slow, rare), so a tick that moves three cars re-renders
 * three rows — not the field. Absolutely positioned by `translateY(top)`; the
 * `.row-glide` class supplies the transition, so a change of `top` (a position
 * swap) animates the glide on the token scale and switches off entirely under
 * reduced motion.
 */
function StandingsRowInner({
  carIdx,
  top,
  sectorCount,
  classColor,
  classRelative,
  rank,
  isVisible,
  leader,
  labelled,
  fastest,
}: StandingsRowProps) {
  const row = useStandingsRow(carIdx);
  const driver = useDriver(carIdx);

  const dimmed = row ? row.isRetired || !row.isInWorld : false;
  const inPit = row?.onPitRoad || row?.isInPitStall;

  // Class-grouped view races within the class; flat view is overall.
  const gapValue = classRelative ? row?.gapToClassLeader : row?.gapToLeader;
  const gapIsLaps = classRelative
    ? row?.classGapIsLaps
    : row?.gapIsLaps;
  const intervalValue = classRelative ? row?.classInterval : row?.interval;

  // The number the position column prints — the layout's own rank in a
  // lap-time session, otherwise iRacing's: class position when grouped by
  // class, overall when flat. A flat overall table numbered by class position
  // reads as scrambled.
  const position =
    rank ??
    (classRelative
      ? row?.classPosition ?? row?.position
      : row?.position ?? row?.classPosition);
  const moved = usePositionFlash(
    position,
    rank != null ? "rank" : classRelative ? "class" : "overall"
  );

  return (
    <div
      className="row-glide absolute inset-x-0 rounded-sm will-change-transform"
      style={{
        height: rowSlotHeight(labelled),
        transform: `translateY(${top}px)`,
      }}
    >
      <div
        className={[
          "relative grid items-center gap-x-1 rounded-sm px-1 text-xs",
          // Every row is its own strip: the neutral row ground, with paper
          // showing through the `ROW_GAP` under it, exactly as on Relative.
          // "This is you" is the one strip on `primary` (§ Two colour systems,
          // rule 3). The zebra and class-group tones this replaced made
          // alternate rows different for no reason the reader could name; a
          // strip per row separates them without ranking any of them.
          row?.isPlayer ? PLAYER_ROW_GROUND : "bg-timing-row",
          dimmed ? "opacity-40" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          height: rowSlotHeight(labelled) - ROW_GAP,
          gridTemplateColumns: gridTemplate(sectorCount, isVisible),
          // The row's leading edge, in the class's colour at full strength on
          // every row. It used to drop to 40 % below the class leader, which
          // under a solid band read as a rendering fault rather than a rank —
          // the leader's row looked lit and the rest looked broken. Solid, the
          // edges join into one spine running down from the band.
          //
          // It holds its drawn size as the table scales — see CLASS_EDGE_WIDTH.
          borderLeftWidth: CLASS_EDGE_WIDTH,
          borderLeftStyle: "solid",
          borderLeftColor: classColor,
          // …and the edge runs on into the row as a fill that fades out by
          // the end of the position cell, so the number read first sits on
          // its class's colour. Layered over the row's ground, so the
          // player's strip keeps its `primary` (see `lib/classFill`).
          backgroundImage: classFill(classColor, STANDINGS_FILL_REACH),
          // Clear the in-row column labels rather than centring under them;
          // the slot is a label slice taller, so the content keeps a full
          // row's height below them.
          paddingTop: labelled ? COL_LABEL_H : undefined,
        }}
      >
        {labelled && (
          <ColumnLabels sectorCount={sectorCount} isVisible={isVisible} />
        )}

        {/* position — bold white, on the class fill. It sat in a solid
            block of the class's colour while the band above was one; the
            fill is that block faded, strong at the edge and under half
            strength where the digits start, so white reads on every class
            colour (`lib/classFill`). The shadow lifts the digits off the
            stronger part of the fill.

            For a few seconds after the car changes place, the block becomes
            an arrow on a status fill — `accent` up, `danger` down — with
            `on-accent` ink (§ Theme, rule 1). See `lib/positionFlash`. */}
        {moved ? (
          <div
            className="flex items-center justify-center rounded-ctl py-[3px]"
            style={{
              background:
                moved === "up" ? "var(--color-accent)" : "var(--color-danger)",
              color: "var(--color-on-accent)",
            }}
            title={`${moved === "up" ? "Gained" : "Lost"} a place — now P${position}`}
          >
            {moved === "up" ? (
              <ArrowUp className="size-3.5" strokeWidth={3.5} />
            ) : (
              <ArrowDown className="size-3.5" strokeWidth={3.5} />
            )}
          </div>
        ) : (
          <div className="tnum class-fill-ink text-center text-[14px] font-bold leading-none tabular-nums text-text">
            {position ?? "—"}
          </div>
        )}

        {/* position change */}
        {isVisible("change") && (
          <div className="flex justify-center">
            <PosChange value={row?.positionsGainedTotal ?? 0} />
          </div>
        )}

        {/* car number — no pill: fill is rationed (rule 5). Full `text`, at
            the position's weight: on a row strip `muted` read as disabled. */}
        {isVisible("num") && (
          <div
            className="truncate text-center text-[12px] font-bold tabular-nums tnum text-text"
            title={`#${driver?.carNumber ?? ""}`}
          >
            {driver?.carNumber ?? "—"}
          </div>
        )}

        {/* car brand */}
        {isVisible("brand") && (
          <div className="flex justify-center">
            <BrandIcon
              make={driver?.carMake ?? ""}
              height={STANDINGS_BRAND_H}
            />
          </div>
        )}

        {/* country flag */}
        {isVisible("country") && (
          <div className="flex justify-center">
            <CountryFlag
              code={driver?.countryCode ?? ""}
              name={driver?.countryName}
            />
          </div>
        )}

        {/* driver — in the class's colour, so the name carries the class the
            edge opens the row with.

            Title case, through the same `formatDriverName` the Relative uses.
            Caps used to set these, for one optical weight down the ragged
            column — and cost the ascender/descender silhouette a name is
            actually recognised by, plus ~12 % width in the one column allowed
            to truncate. Normalising the member's own casing gives the column
            its single voice without either cost. */}
        <div className="flex min-w-0 items-center">
          <span
            className="truncate text-[13px] font-bold tracking-[0.01em]"
            style={{ color: classColor }}
          >
            {formatDriverName(driver?.userName) || `Car ${carIdx}`}
          </span>
        </div>

        {/* licence + SR, then iRating + projected change — one pill in two
            segments when both columns are on, each its own pill otherwise. */}
        {isVisible("license") &&
          (driver ? (
            <LicenseBadge
              group={driver.licenseGroup}
              safetyRating={driver.safetyRating}
              color={driver.licenseColor}
              joined={isVisible("irating")}
            />
          ) : (
            <div />
          ))}
        {isVisible("irating") && (
          <IRatingCell
            iRating={driver?.iRating ?? row?.iRating ?? 0}
            change={row?.iRatingChangeEst ?? 0}
            joined={isVisible("license")}
          />
        )}

        {/* gap to leader / interval (class-relative when grouped by class) */}
        {isVisible("gap") && (
          <GapCell
            value={gapValue ?? null}
            isLaps={gapIsLaps ?? false}
            leader={leader}
          />
        )}
        {isVisible("interval") && (
          <IntervalCell value={intervalValue ?? null} leader={leader} />
        )}

        {/* last / best lap */}
        {isVisible("last") && (
          <LapCell
            key={`last-${row?.lastLapTime}`}
            time={row?.lastLapTime ?? null}
            color={LAP_COLOR[row?.lastLapStatus ?? "none"]}
            underline={LAP_UNDERLINE[row?.lastLapStatus ?? "none"]}
            flash={row?.lastLapStatus === "overall_best"}
          />
        )}
        {/* The one filled cell on this surface: the fastest lap, purple when it
            leads the field and accent when it only leads the class (rule 5). */}
        {isVisible("best") && (
          <LapCell
            time={row?.bestLapTime ?? null}
            color="var(--color-muted)"
            fill={
              fastest === "overall"
                ? "var(--color-sector-purple)"
                : fastest === "class"
                  ? "var(--color-accent)"
                  : undefined
            }
            fillTitle={
              fastest === "overall"
                ? "Fastest lap of the session"
                : fastest === "class"
                  ? "Fastest lap in class"
                  : undefined
            }
          />
        )}

        {/* sector deltas */}
        {isVisible("sectors") &&
          Array.from({ length: sectorCount }, (_, i) => (
            <SectorCell key={i} sector={row?.sectors[i]} />
          ))}

        {/* state badge */}
        <div className="flex items-center justify-center">
          {inPit ? (
            <span
              className="text-warning"
              title={row?.isInPitStall ? "In pit stall" : "On pit road"}
            >
              <Wrench className="size-3.5" />
            </span>
          ) : row?.isOffTrack ? (
            <AlertTriangle className="size-3.5 text-danger" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const StandingsRow = memo(StandingsRowInner);
