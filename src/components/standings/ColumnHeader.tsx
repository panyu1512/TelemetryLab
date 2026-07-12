import {
  COL_HEADER_H,
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
 * The sticky column-label row. Uses the exact same grid template + visible-
 * column set as every data row so the labels stay pinned above their columns as
 * the field scrolls, regardless of which columns are turned on.
 */
export function ColumnHeader({
  sectorCount,
  isVisible,
}: {
  sectorCount: number;
  isVisible: ColumnVisibility;
}) {
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-x-1 border-b border-border bg-bg/95 px-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-faint backdrop-blur"
      style={{
        height: COL_HEADER_H,
        gridTemplateColumns: gridTemplate(sectorCount, isVisible),
      }}
    >
      {visibleColumns(sectorCount, isVisible).map(({ key, col, sectorIndex }) => (
        <span key={key} className={ALIGN[col.align]}>
          {col.id === "sectors" ? `S${(sectorIndex ?? 0) + 1}` : col.label}
        </span>
      ))}
    </div>
  );
}
