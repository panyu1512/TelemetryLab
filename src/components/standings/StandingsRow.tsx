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
import { classRowFill } from "../../lib/classColors";
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

  // A row wears exactly one ground. Class tint is identity; the player's
  // `primary` ground is status; letting both paint would be the collision this
  // whole change is about, one layer down. Status wins — you can always find
  // your class from the leading edge, but "which of these is me" has to be
  // unambiguous.
  const wearsStatusGround = row?.isPlayer === true;

  return (
    <div
      className="row-glide absolute inset-x-0 rounded-sm will-change-transform"
      style={{
        height: ROW_H,
        transform: `translateY(${top}px)`,
        // Painted on the wrapper rather than the row itself, so the zebra tone
        // (a translucent white utility class) still layers over it instead of
        // being overwritten by an inline background.
        background: wearsStatusGround ? undefined : classRowFill(classColor),
      }}
    >
      <div
        className={[
          "relative grid h-full items-center gap-x-1 rounded-sm px-1 text-xs",
          row?.isPlayer
            ? "bg-primary/10 ring-1 ring-inset ring-primary/35"
            : zebra
              ? toneZebra
              : toneBase,
          dimmed ? "opacity-40" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          gridTemplateColumns: gridTemplate(sectorCount, isVisible),
          // 3 px, up from 2: on near-black paper a 2 px hairline of an arbitrary
          // hue was the first thing to disappear in peripheral vision, which is
          // where this surface is read. It is still the row's only carrier of
          // class colour (§ Two colour systems, rule 2), and the one measurement
          // that holds its drawn size as the table scales — see CLASS_EDGE_WIDTH.
          borderLeftWidth: CLASS_EDGE_WIDTH,
          borderLeftStyle: "solid",
          borderLeftColor: row?.isClassLeader ? classColor : `${classColor}66`,
          // Clear the in-row column labels rather than centring under them.
          paddingTop: labelled ? COL_LABEL_H : undefined,
        }}
      >
        {labelled && (
          <ColumnLabels sectorCount={sectorCount} isVisible={isVisible} />
        )}

        {/* position change */}
        {isVisible("change") && (
          <div className="flex justify-center">
            <PosChange value={row?.positionsGainedTotal ?? 0} />
          </div>
        )}

        {/* position — the layout's own rank in a lap-time session, otherwise
            iRacing's: class position when grouped by class, overall when flat.
            A flat overall table numbered by class position reads as scrambled. */}
        <div className="text-center text-[14px] font-bold tabular-nums tnum">
          {rank ??
            (classRelative
              ? row?.classPosition ?? row?.position
              : row?.position ?? row?.classPosition) ??
            "—"}
        </div>

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

        {/* country flag */}
        {isVisible("country") && (
          <div className="flex justify-center">
            <CountryFlag
              code={driver?.countryCode ?? ""}
              name={driver?.countryName}
            />
          </div>
        )}

        {/* driver */}
        <div className="flex min-w-0 items-center">
          <span className="truncate text-[13px] font-semibold text-text">
            {driver?.userName ?? `Car ${carIdx}`}
          </span>
        </div>

        {/* car brand */}
        {isVisible("brand") && (
          <div className="flex justify-center">
            <BrandIcon make={driver?.carMake ?? ""} />
          </div>
        )}

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
