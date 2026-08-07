/**
 * Column configuration for the standings overlay — toggle which timing columns
 * are shown. Writes to {@link useStandingsUiStore}, which persists and broadcasts
 * over the bus, so an open standings overlay window updates its layout live.
 */

import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { CONFIGURABLE_COLUMNS } from "../../components/standings/constants";
import { Checkbox } from "../ui/controls";

export function StandingsColumnsPanel() {
  const columns = useStandingsUiStore((s) => s.columns);
  const toggleColumn = useStandingsUiStore((s) => s.toggleColumn);
  const resetColumns = useStandingsUiStore((s) => s.resetColumns);

  const hiddenCount = CONFIGURABLE_COLUMNS.filter(
    (c) => columns[c.id] === false
  ).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {CONFIGURABLE_COLUMNS.map((col) => {
          const visible = columns[col.id] !== false;
          return (
            <label
              key={col.id}
              className={[
                "flex cursor-pointer items-center gap-2.5 rounded-card border px-3 py-2 transition-colors",
                visible
                  ? "border-border bg-surface"
                  : "border-border/60 bg-transparent hover:border-border",
              ].join(" ")}
            >
              <Checkbox checked={visible} onChange={() => toggleColumn(col.id)} />
              <span className="min-w-0">
                <span
                  className={[
                    "block truncate text-xs font-medium",
                    visible ? "text-text" : "text-faint",
                  ].join(" ")}
                >
                  {col.name}
                </span>
                <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                  {col.label || "—"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-faint">
          Position, driver and status are always shown.
        </p>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={resetColumns}
            className="text-[11px] text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Show all columns
          </button>
        )}
      </div>
    </div>
  );
}
