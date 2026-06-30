import { RotateCcw, X } from "lucide-react";
import type { DashboardLayout } from "../../hooks/useDashboardLayout";

interface OverlayManagerProps {
  layout: DashboardLayout;
  onClose: () => void;
}

/**
 * The control surface for the active dashboard: toggle each widget's
 * visibility, see its size, and reset the layout. Anchored above the dock.
 */
export function OverlayManager({ layout, onClose }: OverlayManagerProps) {
  const { dashboard, widgets, toggleWidget, resetDashboard } = layout;

  return (
    <div
      className="w-80 overflow-hidden rounded-xl border border-border bg-surface/95 shadow-2xl backdrop-blur-xl"
      style={{ animation: "overlay-in 140ms ease-out" }}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span className="text-[11px] uppercase tracking-wider text-muted">
          Widgets
        </span>
        <span className="text-sm font-medium text-text">{dashboard.label}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={resetDashboard}
            title="Reset layout"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      <div className="max-h-80 overflow-y-auto p-1.5">
        {widgets.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted">
            This screen has no configurable widgets yet.
          </p>
        ) : (
          widgets.map((w) => {
            const Icon = w.def.icon;
            return (
              <label
                key={w.def.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-surface-2"
              >
                <Icon className="size-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-text">
                    {w.def.title}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {w.def.description}
                  </span>
                </span>
                <Switch
                  checked={!w.hidden}
                  onChange={() => toggleWidget(w.def.id)}
                />
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange();
      }}
      className={[
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-surface-2 border border-border-strong",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 size-4 rounded-full bg-bg transition-[left]",
          checked ? "left-[18px]" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}
