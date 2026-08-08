import {
  COL_LABEL_H,
  gridTemplate,
  visibleColumns,
  type ColumnVisibility,
} from "./constants";

const ALIGN: Record<string, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * The column labels, printed in the top slice of the class leader's row rather
 * than in a band of their own (`design.md` § Dense tabular overlays, rule 3).
 *
 * It renders as an absolutely positioned overlay inside the row, sharing that
 * row's grid template and horizontal padding so every label lands over its own
 * column. Because it is out of flow it costs zero height; the host row only
 * pushes its own values down by {@link COL_LABEL_H} to clear it.
 *
 * Mono, uppercase, tracked and `faint` per § Typography — these are micro-labels,
 * the quietest voice in the system.
 */
export function ColumnLabels({
  sectorCount,
  isVisible,
  groupLabel,
}: {
  sectorCount: number;
  isVisible: ColumnVisibility;
  /**
   * The class this group is, e.g. `LMP2 · 6`. Printed *in place of* the
   * `Driver` label, which is the one label on this surface a first-time user
   * never needed — a column of names announces itself.
   *
   * This is the § Known follow-ups fix for what rule 7 cost the standings: the
   * 2 px left border says which cars share a class but nothing spelled out
   * *which* class. Sitting on the leader's row, directly above that border, the
   * label binds colour to name by adjacency — so it stays a micro-label rather
   * than becoming the class band rule 2 bans, and it takes no identity colour
   * of its own (§ Two colour systems, rule 2 allows exactly one carrier).
   */
  groupLabel?: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 grid items-start gap-x-1 px-1 font-mono text-[8px] font-semibold uppercase leading-none tracking-[0.14em] text-faint"
      style={{
        height: COL_LABEL_H,
        gridTemplateColumns: gridTemplate(sectorCount, isVisible),
      }}
    >
      {visibleColumns(sectorCount, isVisible).map(({ key, col, sectorIndex }) => {
        if (col.id === "driver" && groupLabel) {
          return (
            <span
              key={key}
              className="truncate text-left text-[9px] font-bold tracking-[0.16em] text-muted"
            >
              {groupLabel}
            </span>
          );
        }
        return (
          <span key={key} className={`truncate ${ALIGN[col.align]}`}>
            {col.id === "sectors" ? `S${(sectorIndex ?? 0) + 1}` : col.label}
          </span>
        );
      })}
    </div>
  );
}
