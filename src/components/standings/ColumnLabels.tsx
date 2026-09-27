import type { GapReference } from "../../stores/useStandingsUiStore";
import { TOWER } from "../../lib/towerPalette";
import {
  COL_GAP,
  gridTemplate,
  LABEL_ROW_H,
  ROW_PAD_X,
  visibleColumns,
  type ColumnVisibility,
  type StandingsColumnId,
} from "./constants";

const ALIGN: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * The column labels: a row of their own under each class header, when the
 * Manager's "Column labels" is on. Off by default — a driver who knows the
 * columns reads past them every lap (`design.md` § Dense tabular overlays,
 * rule 3).
 *
 * The two gap columns are labelled by what they measure *now*: with the gap
 * reference set to the car ahead, the primary column is still "Gap" — gap to
 * the car in front — and the other one becomes "Leader".
 */
export function ColumnLabels({
  sectorCount,
  isVisible,
  gapReference,
}: {
  sectorCount: number;
  isVisible: ColumnVisibility;
  gapReference: GapReference;
}) {
  const label = (id: StandingsColumnId, text: string, sectorIndex?: number): string => {
    if (id === "sectors") return `S${(sectorIndex ?? 0) + 1}`;
    if (id === "interval" && gapReference === "ahead") return "LEADER";
    if (id === "irating") return "iRATING";
    return text.toUpperCase();
  };
  return (
    <div
      aria-hidden
      className="grid items-center text-[11px] font-semibold tracking-[0.1em]"
      style={{
        height: LABEL_ROW_H,
        gridTemplateColumns: gridTemplate(sectorCount, isVisible),
        columnGap: COL_GAP,
        padding: `0 ${ROW_PAD_X}px`,
        background: TOWER.labelRow,
        color: TOWER.text3,
      }}
    >
      {visibleColumns(sectorCount, isVisible).map(({ key, col, sectorIndex }) => (
        <span
          key={key}
          className={`truncate ${ALIGN[col.align]}`}
          style={{ paddingRight: col.labelInset }}
        >
          {label(col.id, col.label, sectorIndex)}
        </span>
      ))}
    </div>
  );
}
