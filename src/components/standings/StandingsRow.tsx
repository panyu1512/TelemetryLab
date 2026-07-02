import { memo } from "react";
import { Wrench, AlertTriangle } from "lucide-react";
import { useStandingsRow } from "../../stores/useStandingsStore";
import { useDriver } from "../../stores/useSessionStore";
import { gridTemplate, LAP_COLOR, ROW_H } from "./constants";
import {
  BrandBadge,
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
  zebra: boolean;
  /** Grouped by class ⇒ show gap/interval relative to the class, not overall. */
  classRelative: boolean;
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
            ? "bg-accent/10 ring-1 ring-inset ring-accent/30"
            : zebra
              ? "bg-surface/40"
              : "",
          dimmed ? "opacity-40" : "",
        ].join(" ")}
        style={{
          gridTemplateColumns: gridTemplate(sectorCount),
          borderLeft: `2px solid ${row?.isClassLeader ? classColor : `${classColor}55`}`,
        }}
      >
        {/* position change */}
        <div className="flex justify-center">
          <PosChange value={row?.positionsGainedTotal ?? 0} />
        </div>

        {/* position */}
        <div className="text-center text-[13px] font-semibold tabular-nums tnum">
          {row?.classPosition ?? row?.position ?? "—"}
        </div>

        {/* car number */}
        <div
          className="truncate rounded bg-surface-2 text-center text-[11px] font-semibold tabular-nums tnum text-muted"
          title={`#${driver?.carNumber ?? ""}`}
        >
          {driver?.carNumber ?? "—"}
        </div>

        {/* driver + brand */}
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[12px] text-text">
            {driver?.userName ?? `Car ${carIdx}`}
          </span>
          <BrandBadge make={driver?.carMake ?? ""} />
        </div>

        {/* license + SR */}
        <div className="flex justify-center">
          {driver && (
            <LicenseBadge
              group={driver.licenseGroup}
              safetyRating={driver.safetyRating}
              color={driver.licenseColor}
            />
          )}
        </div>

        {/* iRating + projected change */}
        <IRatingCell
          iRating={driver?.iRating ?? row?.iRating ?? 0}
          change={row?.iRatingChangeEst ?? 0}
        />

        {/* gap to leader / interval (class-relative when grouped by class) */}
        <GapCell value={gapValue ?? null} isLaps={gapIsLaps ?? false} />
        <IntervalCell value={intervalValue ?? null} />

        {/* last / best lap */}
        <LapCell
          key={`last-${row?.lastLapTime}`}
          time={row?.lastLapTime ?? null}
          color={LAP_COLOR[row?.lastLapStatus ?? "none"]}
          flash={row?.lastLapStatus === "overall_best"}
        />
        <LapCell time={row?.bestLapTime ?? null} color="var(--color-muted)" />

        {/* sector deltas */}
        {Array.from({ length: sectorCount }, (_, i) => (
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
