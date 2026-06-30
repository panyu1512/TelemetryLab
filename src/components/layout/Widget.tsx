import { GripVertical, EyeOff } from "lucide-react";
import type { WidgetDef } from "../../dashboards/registry";
import type { TelemetryData } from "../../hooks/useTelemetry";

/** Class react-grid-layout uses to know where a widget can be grabbed. */
export const WIDGET_DRAG_HANDLE = "widget-drag-handle";
/** Class react-grid-layout treats as "don't start a drag here". */
export const WIDGET_NO_DRAG = "widget-no-drag";

interface WidgetProps {
  def: WidgetDef;
  data: TelemetryData | null;
  editMode: boolean;
  onHide: () => void;
}

/**
 * The shell every dashboard widget lives in: a titled card. In edit mode its
 * header becomes a drag handle and it grows a "hide" button; the grid itself
 * provides the resize handle.
 */
export function Widget({ def, data, editMode, onHide }: WidgetProps) {
  const Icon = def.icon;

  return (
    <section
      className={[
        "flex h-full flex-col rounded-xl border bg-surface p-3.5 transition-colors",
        editMode
          ? "border-border-strong ring-1 ring-accent/20"
          : "border-border hover:border-border-strong",
      ].join(" ")}
    >
      <header
        className={[
          "mb-3 flex items-center gap-2",
          editMode ? `${WIDGET_DRAG_HANDLE} cursor-grab active:cursor-grabbing` : "",
        ].join(" ")}
      >
        {editMode ? (
          <GripVertical className="size-3.5 text-border-strong" />
        ) : (
          <Icon className="size-3.5 text-muted" strokeWidth={2} />
        )}
        <h3 className="select-none text-[11px] font-medium uppercase tracking-wider text-muted">
          {def.title}
        </h3>

        {editMode && (
          <button
            type="button"
            onClick={onHide}
            title="Hide widget"
            className={`${WIDGET_NO_DRAG} ml-auto grid size-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-danger`}
          >
            <EyeOff className="size-3.5" />
          </button>
        )}
      </header>

      <div className="min-h-0 flex-1">{def.body(data)}</div>
    </section>
  );
}
