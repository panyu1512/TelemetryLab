import { EyeOff, ExternalLink, X } from "lucide-react";
import type { WidgetDef } from "../../dashboards/registry";
import type { TelemetryData } from "../../hooks/useTelemetry";
import { useActiveOverlaysStore } from "../../stores/useActiveOverlaysStore";

/** Class react-grid-layout uses to know where a widget can be grabbed. */
export const WIDGET_DRAG_HANDLE = "widget-drag-handle";
/** Class react-grid-layout treats as "don't start a drag here". */
export const WIDGET_NO_DRAG = "widget-no-drag";

interface WidgetProps {
  def: WidgetDef;
  data: TelemetryData | null;
  onHide: () => void;
}

/**
 * The shell every dashboard widget lives in: a titled card. The header is
 * always a drag handle (grab it to reposition; the grid provides the resize
 * handle in the corner) and reveals a "hide" button on hover. There is no
 * separate edit mode — arrangements are live and auto-persisted.
 */
export function Widget({ def, data, onHide }: WidgetProps) {
  const Icon = def.icon;
  const isOpen = useActiveOverlaysStore((s) => s.isWidgetOpen(def.id));
  const openWidget = useActiveOverlaysStore((s) => s.openWidget);
  const closeWidget = useActiveOverlaysStore((s) => s.closeWidget);

  return (
    <section className="overlay-card widget-card group flex h-full flex-col overflow-hidden rounded-card border border-border/60 bg-surface transition-colors">
      <header
        className={`${WIDGET_DRAG_HANDLE} flex shrink-0 cursor-grab items-center gap-2 active:cursor-grabbing`}
      >
        <Icon className="size-3.5 shrink-0 text-faint" strokeWidth={2} />
        <h3 className="widget-title select-none truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
          {def.title}
        </h3>
        <span className="header-rule" aria-hidden />

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Once this widget has its own window, the only action is to close
              it again — not to open a second one. */}
          {isOpen ? (
            <button
              type="button"
              onClick={() => closeWidget(def.id)}
              title="Close this widget's window"
              className={`${WIDGET_NO_DRAG} grid size-6 place-items-center rounded-ctl text-primary transition-colors hover:bg-surface-2 hover:text-danger`}
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openWidget(def.id, def.title)}
              title="Open this widget in its own window"
              className={`${WIDGET_NO_DRAG} grid size-6 place-items-center rounded-ctl text-muted transition-colors hover:bg-surface-2 hover:text-primary`}
            >
              <ExternalLink className="size-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onHide}
            title="Hide widget"
            className={`${WIDGET_NO_DRAG} grid size-6 place-items-center rounded-ctl text-muted transition-colors hover:bg-surface-2 hover:text-danger`}
          >
            <EyeOff className="size-3.5" />
          </button>
        </div>
      </header>

      {/*
        `container-type: size` makes this body a query container so widgets can
        size their content fluidly (cqmin/cqh units); `overflow-hidden` keeps a
        widget that's been shrunk past its content from spilling onto its
        neighbours.
      */}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        style={{ containerType: "size" }}
      >
        <def.Component data={data} />
      </div>
    </section>
  );
}
