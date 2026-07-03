import { SlidersHorizontal } from "lucide-react";
import type { DashboardLayout } from "../../hooks/useDashboardLayout";

interface DockProps {
  layout: DashboardLayout;
  managerOpen: boolean;
  onToggleManager: () => void;
}

/**
 * The floating overlay dock: a glassy, minimalist control bar pinned to the
 * bottom of the window. Switches between dashboards and opens the overlay
 * manager. This is the surface the user interacts with the dashboards from.
 */
export function Dock({ layout, managerOpen, onToggleManager }: DockProps) {
  const { dashboards, active, setActive } = layout;

  return (
    <div className="flex items-center gap-1 rounded-2xl border border-border bg-surface/80 p-1.5 shadow-2xl backdrop-blur-xl">
      {/* Dashboard switcher */}
      {dashboards.map((d) => {
        const Icon = d.icon;
        const isActive = d.id === active;
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => setActive(d.id)}
            aria-pressed={isActive}
            title={d.available ? d.label : `${d.label} · ${d.milestone}`}
            className={[
              "flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
              isActive
                ? "bg-accent/15 text-accent"
                : "text-muted hover:bg-surface-2 hover:text-text",
            ].join(" ")}
          >
            <Icon className="size-4" />
            <span className={isActive ? "inline" : "hidden sm:inline"}>
              {d.label}
            </span>
            {!d.available && (
              <span className="rounded bg-surface-2 px-1 text-[9px] uppercase text-muted">
                soon
              </span>
            )}
          </button>
        );
      })}

      <span className="mx-1 h-6 w-px bg-border" />

      {/* Utility controls */}
      <DockIcon
        active={managerOpen}
        onClick={onToggleManager}
        title="Overlay Manager"
      >
        <SlidersHorizontal className="size-4" />
      </DockIcon>
    </div>
  );
}

function DockIcon({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        "grid size-9 place-items-center rounded-xl transition-colors",
        active
          ? "bg-accent/15 text-accent"
          : "text-muted hover:bg-surface-2 hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
