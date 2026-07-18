import { memo } from "react";
import { Wrench, AlertTriangle } from "lucide-react";
import { useStandingsRow } from "../../stores/useStandingsStore";
import { useDriver } from "../../stores/useSessionStore";
import {
  gridTemplate,
  LAP_COLOR,
  ROW_H,
  type ColumnVisibility,
} from "./constants";
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
  /** Which columns to render (must match the header). */
  isVisible: ColumnVisibility;
}

/**
 * One field row. Subscribes to *only* its own timing entry (fast, 10 Hz) and its
 * own roster entry (slow, rare), so a tick that moves three cars re-renders
 * three rows — not the field. Absolutely positioned by `translateY(top)` with a
 * CSS transition, so a change of `top` (a position swap) animates the glide.
 */
function StandingsRowInner({
  carIdx,
  top,
  sectorCount,
  classColor,
  zebra,
  classRelative,
  isVisible,
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

  return (
    <div
      className="absolute inset-x-0 will-change-transform"
      style={{
        height: ROW_H,
        transform: `translateY(${top}px)`,
        transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <div
        className={[
          "grid h-full items-center gap-x-1 rounded-sm px-1 text-xs",
          row?.isPlayer
            ? "bg-primary/10 ring-1 ring-inset ring-primary/35"
            : zebra
              ? "bg-surface-2/40"
              : "",
          dimmed ? "opacity-40" : "",
        ].join(" ")}
        style={{
          gridTemplateColumns: gridTemplate(sectorCount, isVisible),
          borderLeft: `2px solid ${row?.isClassLeader ? classColor : `${classColor}55`}`,
        }}
      >
        {/* position change */}
        {isVisible("change") && (
          <div className="flex justify-center">
            <PosChange value={row?.positionsGainedTotal ?? 0} />
          </div>
        )}

        {/* position */}
        <div className="text-center text-[13px] font-semibold tabular-nums tnum">
          {row?.classPosition ?? row?.position ?? "—"}
        </div>

        {/* car number */}
        {isVisible("num") && (
          <div
            className="truncate rounded-[4px] bg-surface-2 text-center text-[11px] font-semibold tabular-nums tnum text-muted"
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
          <span className="truncate text-[12px] text-text">
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
            flash={row?.lastLapStatus === "overall_best"}
          />
        )}
        {isVisible("best") && (
          <LapCell time={row?.bestLapTime ?? null} color="var(--color-muted)" />
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
              className="rounded bg-warning/20 px-1 text-[8px] font-bold uppercase text-warning"
              title={row?.isInPitStall ? "In pit stall" : "On pit road"}
            >
              <Wrench className="size-3" />
            </span>
          ) : row?.isOffTrack ? (
            <AlertTriangle className="size-3 text-danger" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const StandingsRow = memo(StandingsRowInner);
