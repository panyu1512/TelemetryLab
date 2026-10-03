import { memo } from "react";
import { Wrench, AlertTriangle } from "lucide-react";
import { useStandingsRow } from "../../stores/useStandingsStore";
import { useDriver } from "../../stores/useSessionStore";
import {
  CLASS_EDGE_WIDTH,
  COL_LABEL_H,
  GROUP_TONE,
  gridTemplate,
  LAP_COLOR,
  LAP_UNDERLINE,
  ROW_H,
  type ColumnVisibility,
} from "./constants";
import { ColumnLabels } from "./ColumnLabels";
import { readableInk } from "../../lib/contrast";
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
  TireCell,
} from "./cells";

interface StandingsRowProps {
  carIdx: number;
  top: number;
  sectorCount: number;
  classColor: string;
  zebra: boolean;
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
   * First row of its class group *and* column labels are switched on: prints
   * them in its top slice, so the table needs no header band (`design.md`
   * § Dense tabular overlays, rule 3). Off by default — see the rule.
   */
  labelled: boolean;
  /** Class-group tone index into {@link GROUP_TONE} (rule 2's tone shift). */
  tone: number;
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
  zebra,
  classRelative,
  rank,
  isVisible,
  labelled,
  tone,
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

  // Class-group tone shift, with the zebra phase riding on it (rule 2). The
  // player's row overrides both: "this is you" is `primary` as the row's ground
  // (§ Two colour systems, rule 3).
  const [toneBase, toneZebra] = GROUP_TONE[tone % GROUP_TONE.length];

  return (
    <div
      className="row-glide absolute inset-x-0 rounded-sm will-change-transform"
      style={{
        height: ROW_H,
        transform: `translateY(${top}px)`,
      }}
    >
      <div
        className={[
          "relative grid h-full items-center gap-x-1 rounded-sm px-1 text-xs",
          row?.isPlayer
            ? "bg-primary/15 ring-1 ring-inset ring-primary/60"
            : zebra
              ? toneZebra
              : toneBase,
          dimmed ? "opacity-40" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          gridTemplateColumns: gridTemplate(sectorCount, isVisible),
          // The row's leading edge, in the class's colour at full strength on
          // every row. It used to drop to 40 % below the class leader, which
          // under a solid band read as a rendering fault rather than a rank —
          // the leader's row looked lit and the rest looked broken. Solid, the
          // edges join into one spine running down from the band, and the
          // position block beside it is what carries rank.
          //
          // It holds its drawn size as the table scales — see CLASS_EDGE_WIDTH.
          borderLeftWidth: CLASS_EDGE_WIDTH,
          borderLeftStyle: "solid",
          borderLeftColor: classColor,
          // Clear the in-row column labels rather than centring under them.
          paddingTop: labelled ? COL_LABEL_H : undefined,
        }}
      >
        {labelled && (
          <ColumnLabels sectorCount={sectorCount} isVisible={isVisible} />
        )}

        {/* position — the layout's own rank in a lap-time session, otherwise
            iRacing's: class position when grouped by class, overall when flat.
            A flat overall table numbered by class position reads as scrambled.

            It sits in a block of the class's colour, which is the row's answer
            to the solid band that opens its group: the masthead is a block, and
            the first thing in every row under it is the same block one column
            wide. Rank and class are the two facts you take off a row without
            reading it, and this is the one cell where they can be the same
            glance. Ink is measured, not assumed — see `readableInk`. */}
        <div
          className="tnum rounded-ctl py-0.5 text-center text-[14px] font-bold leading-none tabular-nums"
          style={{ background: classColor, color: readableInk(classColor) }}
        >
          {rank ??
            (classRelative
              ? row?.classPosition ?? row?.position
              : row?.position ?? row?.classPosition) ??
            "—"}
        </div>

        {/* position change */}
        {isVisible("change") && (
          <div className="flex justify-center">
            <PosChange value={row?.positionsGainedTotal ?? 0} />
          </div>
        )}

        {/* car number — no pill: fill is rationed to the fastest-lap cell
            (rule 5), and `muted` is the floor for a car number (§ Deliberately
            not adopted). */}
        {isVisible("num") && (
          <div
            className="truncate text-center text-[12px] font-bold tabular-nums tnum text-muted"
            title={`#${driver?.carNumber ?? ""}`}
          >
            {driver?.carNumber ?? "—"}
          </div>
        )}

        {/* car brand */}
        {isVisible("brand") && (
          <div className="flex justify-center">
            <BrandIcon make={driver?.carMake ?? ""} />
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

        {/* driver.

            Caps, as a timing graphic sets them. It costs something real: caps
            are read by outline and lose the ascender/descender silhouette that
            makes a name recognisable at a glance, and they run ~12 % wider, so
            the only column allowed to truncate truncates sooner. What they buy
            is a single optical weight down the one ragged column on the
            surface, which is what stops the field reading as a list of strings
            of different heights. */}
        <div className="flex min-w-0 items-center">
          <span className="truncate text-[13px] font-bold uppercase tracking-[0.01em] text-text">
            {driver?.userName ?? `Car ${carIdx}`}
          </span>
        </div>

        {/* license + SR */}
        {isVisible("license") && (
          <div className="flex justify-center">
            {driver && (
              <LicenseBadge
                group={driver.licenseGroup}
                safetyRating={driver.safetyRating}
                color={driver.licenseColor}
              />
            )}
          </div>
        )}

        {/* iRating + projected change */}
        {isVisible("irating") && (
          <IRatingCell
            iRating={driver?.iRating ?? row?.iRating ?? 0}
            change={row?.iRatingChangeEst ?? 0}
          />
        )}

        {/* gap to leader / interval (class-relative when grouped by class) */}
        {isVisible("gap") && (
          <GapCell value={gapValue ?? null} isLaps={gapIsLaps ?? false} />
        )}
        {isVisible("interval") && <IntervalCell value={intervalValue ?? null} />}

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

        {/* tyre compound + laps */}
        {isVisible("tire") && (
          <TireCell compound={row?.tireCompound ?? null} laps={row?.tireLaps ?? 0} />
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
