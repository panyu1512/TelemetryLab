import { COL_HEADER_H, gridTemplate } from "./constants";

/**
 * The sticky column-label row. Uses the exact same grid template as every data
 * row so the labels stay pinned above their columns as the field scrolls.
 */
export function ColumnHeader({ sectorCount }: { sectorCount: number }) {
  return (
    <div
      className="sticky top-0 z-10 grid items-center gap-x-1 border-b border-border bg-bg/95 px-1 text-[9px] font-medium uppercase tracking-wider text-muted backdrop-blur"
      style={{ height: COL_HEADER_H, gridTemplateColumns: gridTemplate(sectorCount) }}
    >
      <span className="text-center" title="Position change since start">
        Δ
      </span>
      <span className="text-center">Pos</span>
      <span className="text-center">#</span>
      <span>Driver</span>
      <span className="text-center">Lic</span>
      <span className="text-right">iR</span>
      <span className="text-right">Gap</span>
      <span className="text-right">Int</span>
      <span className="text-right">Last</span>
      <span className="text-right">Best</span>
      {Array.from({ length: sectorCount }, (_, i) => (
        <span key={i} className="text-center">
          S{i + 1}
        </span>
      ))}
      <span className="text-center" />
    </div>
  );
}
