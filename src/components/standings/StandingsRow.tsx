import { memo } from "react";
import {
  useClassBestSectors,
  useInBattle,
  useStandingsRow,
} from "../../stores/useStandingsStore";
import { useDriver } from "../../stores/useSessionStore";
import type { GapReference } from "../../stores/useStandingsUiStore";
import type { TireCompoundInfo } from "../../telemetry/types";
import { gap as fmtGap, interval as fmtInterval } from "../../lib/format";
import { rowState } from "../../lib/rowState";
import { TOWER } from "../../lib/towerPalette";
import { compoundLook } from "../../lib/tyreCompound";
import { CountryFlag } from "../ui/CountryFlag";
import {
  BestLapCell,
  BrandIcon,
  GapValue,
  IRatingCell,
  LastLapCell,
  LicenseBadge,
  PosBlock,
  PosChange,
  SectorCell,
  StateChip,
  TrendCell,
  TyreCell,
} from "./cells";
import {
  COL_GAP,
  gridTemplate,
  ROW_H,
  ROW_PAD_X,
  type ColumnVisibility,
} from "./constants";

interface StandingsRowProps {
  carIdx: number;
  /** Offset inside its class card, below the card's top edge. */
  y: number;
  sectorCount: number;
  classColor: string;
  /** Odd rows of a group sit a step darker than even ones. */
  zebra: boolean;
  /** Draws the hairline that counts the field in threes, above this row. */
  divider: boolean;
  /** Grouped by class ⇒ gaps are class-relative, not overall. */
  classRelative: boolean;
  /**
   * Rank derived by the layout, or null to print the car's own iRacing
   * position. Non-null only in a lap-time session, where this app did the
   * ordering and so has to supply the number that goes with it.
   */
  rank: number | null;
  isVisible: ColumnVisibility;
  /** This car holds the fastest lap in its class — and whether in the field. */
  fastest: "class" | "overall" | null;
  gapReference: GapReference;
  /** The session's tyre table, for naming `tireCompound`. */
  tyres: readonly TireCompoundInfo[] | undefined;
}

/** Position block height — the canvas's 30 in a 44 row. */
const POS_H = 30;

/**
 * One field row of the timing tower. Subscribes to *only* its own timing entry
 * (fast, 10 Hz) and its own roster entry (slow, rare), so a tick that moves
 * three cars re-renders three rows — not the field. Positioned by
 * `translateY(y)` inside its class card; `.row-glide` supplies the transition,
 * so a position swap slides rather than jumps, and switches off under reduced
 * motion.
 *
 * The reading order the row is built for is **position → name → gap**: a block
 * of the class's colour, a bold condensed name, then the gap a size up from
 * every other number. Everything after that is a step quieter, and the
 * quietest columns — car number, iRating, laps on the set — are the ones read
 * only when looked for.
 */
function StandingsRowInner({
  carIdx,
  y,
  sectorCount,
  classColor,
  zebra,
  divider,
  classRelative,
  rank,
  isVisible,
  fastest,
  gapReference,
  tyres,
}: StandingsRowProps) {
  const row = useStandingsRow(carIdx);
  const driver = useDriver(carIdx);
  const classBests = useClassBestSectors(row?.carClassId ?? -1);
  const battle = useInBattle(carIdx, classRelative);
  const state = rowState(row);

  // Class-grouped view races within the class; flat view is overall.
  const leads = classRelative ? row?.isClassLeader : row?.isOverallLeader;
  const gapText = leads
    ? "Leader"
    : fmtGap(
        classRelative ? row?.gapToClassLeader : row?.gapToLeader,
        (classRelative ? row?.classGapIsLaps : row?.gapIsLaps) ?? false,
      );
  const intervalText = leads
    ? "—"
    : fmtInterval(classRelative ? row?.classInterval : row?.interval);
  // "Car ahead" swaps the two columns rather than printing the interval twice:
  // the primary, larger column measures to whatever the Manager points it at.
  const ahead = gapReference === "ahead";

  const position =
    rank ??
    (classRelative
      ? row?.classPosition ?? row?.position
      : row?.position ?? row?.classPosition) ??
    "—";

  const isMe = row?.isPlayer === true;
  const nameInk = state.dimAll ? TOWER.dim : TOWER.text;

  return (
    <div
      className="row-glide absolute inset-x-0 grid items-center will-change-transform"
      style={{
        height: ROW_H,
        transform: `translateY(${y}px)`,
        gridTemplateColumns: gridTemplate(sectorCount, isVisible),
        columnGap: COL_GAP,
        padding: `0 ${ROW_PAD_X}px`,
        boxSizing: "border-box",
        background: isMe ? TOWER.meBg : zebra ? TOWER.rowB : TOWER.rowA,
        borderTop: `1px solid ${divider ? TOWER.divider : "transparent"}`,
        boxShadow: isMe ? `inset 0 0 0 1px ${TOWER.meRing}` : undefined,
        color: TOWER.text2,
        fontSize: 15,
      }}
    >
      <PosBlock value={position} color={classColor} dsq={state.dsq} height={POS_H} />

      {isVisible("change") && (
        <PosChange value={row?.positionsGainedTotal ?? 0} dim={state.dimAll} />
      )}

      {isVisible("num") && (
        <span
          className="truncate text-right text-[14px]"
          style={{ color: state.dimAll ? TOWER.dim : TOWER.text3 }}
          title={`#${driver?.carNumber ?? ""}`}
        >
          {driver?.carNumber ?? "—"}
        </span>
      )}

      {isVisible("country") && (
        <div
          className="flex justify-center"
          style={{ opacity: state.dimAll ? 0.5 : 1 }}
        >
          <CountryFlag
            code={driver?.countryCode ?? ""}
            name={driver?.countryName}
            size={15}
          />
        </div>
      )}

      {/* The name, and beside it whatever state the car is in. The name is the
          one column allowed to truncate, and it gives way before a chip does:
          "who is in the pits" matters more than the last letters of who. */}
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="tower-cond min-w-0 truncate text-[21px] font-bold uppercase tracking-[0.02em]"
          style={{
            color: nameInk,
            textDecoration: state.dsq ? "line-through" : undefined,
          }}
          title={state.dsq ? `${driver?.userName} — disqualified` : driver?.userName}
        >
          {driver?.userName ?? `Car ${carIdx}`}
        </span>
        {state.chips.map((kind) => (
          <StateChip key={kind} kind={kind} />
        ))}
      </div>

      {isVisible("brand") && (
        <div className="flex justify-center">
          <BrandIcon
            make={driver?.carMake ?? ""}
            height={22}
            color={state.dimAll ? TOWER.dim : TOWER.text}
          />
        </div>
      )}

      {isVisible("license") && (
        <div className="flex justify-center" style={{ opacity: state.dimAll ? 0.6 : 1 }}>
          {driver && (
            <LicenseBadge
              group={driver.licenseGroup}
              safetyRating={driver.safetyRating}
              color={driver.licenseColor}
            />
          )}
        </div>
      )}

      {isVisible("irating") && (
        <IRatingCell
          iRating={driver?.iRating ?? row?.iRating ?? 0}
          change={row?.iRatingChangeEst ?? 0}
          dim={state.dimAll}
        />
      )}

      {isVisible("gap") && (
        <GapValue
          text={ahead ? intervalText : gapText}
          primary
          battle={ahead && battle}
          dim={state.dimLive}
          accent={classColor}
        />
      )}
      {isVisible("interval") && (
        <GapValue
          text={ahead ? gapText : intervalText}
          primary={false}
          battle={!ahead && battle}
          dim={state.dimLive}
          accent={classColor}
        />
      )}

      {isVisible("last") && (
        <LastLapCell
          key={`last-${row?.lastLapTime}`}
          time={row?.lastLapTime ?? null}
          status={row?.lastLapStatus ?? "none"}
          dim={state.dimLive}
        />
      )}

      {isVisible("trend") && (
        <TrendCell
          laps={row?.recentLaps}
          best={row?.bestLapTime ?? null}
          dim={state.dimLive}
        />
      )}

      {isVisible("best") && (
        <BestLapCell
          time={row?.bestLapTime ?? null}
          fastest={fastest}
          dim={state.dimAll}
        />
      )}

      {isVisible("tire") && (
        <TyreCell
          look={compoundLook(row?.tireCompound ?? null, tyres)}
          laps={row?.tireLaps ?? 0}
          dim={state.dimAll}
        />
      )}

      {isVisible("sectors") &&
        Array.from({ length: sectorCount }, (_, i) => (
          <SectorCell
            key={i}
            sector={row?.sectors[i]}
            classBest={classBests?.[i]}
            dim={state.dimLive}
          />
        ))}
    </div>
  );
}

export const StandingsRow = memo(StandingsRowInner);
