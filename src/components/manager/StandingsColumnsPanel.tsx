/**
 * Column configuration for the standings overlay — toggle which timing columns
 * are shown. Writes to {@link useStandingsUiStore}, which persists and broadcasts
 * over the bus, so an open standings overlay window updates its layout live.
 */

import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { CONFIGURABLE_COLUMNS } from "../../components/standings/constants";

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
                "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 transition-colors",
                visible
                  ? "border-accent/40 bg-accent/5"
                  : "border-border bg-surface-2 hover:border-border-strong",
              ].join(" ")}
            >
              <Checkbox checked={visible} onChange={() => toggleColumn(col.id)} />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-text">
                  {col.name}
                </span>
                <span className="block text-[10px] uppercase tracking-wide text-muted">
                  {col.label || "—"}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted">
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

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange();
      }}
      className={[
        "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked
          ? "border-accent bg-accent/20 text-accent"
          : "border-border-strong bg-surface text-transparent",
      ].join(" ")}
    >
      {checked && (
        <svg
          viewBox="0 0 10 8"
          className="size-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
