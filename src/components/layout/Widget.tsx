import { EyeOff } from "lucide-react";
import type { WidgetDef } from "../../dashboards/registry";
import type { TelemetryData } from "../../hooks/useTelemetry";

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

  return (
    <section className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong">
      <header
        className={`${WIDGET_DRAG_HANDLE} mb-3 flex shrink-0 cursor-grab items-center gap-2 active:cursor-grabbing`}
      >
        <Icon className="size-3.5 text-muted" strokeWidth={2} />
        <h3 className="select-none text-[11px] font-medium uppercase tracking-wider text-muted">
          {def.title}
        </h3>

        <button
          type="button"
          onClick={onHide}
          title="Hide widget"
          className={`${WIDGET_NO_DRAG} ml-auto grid size-6 place-items-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface-2 hover:text-danger group-hover:opacity-100`}
        >
          <EyeOff className="size-3.5" />
        </button>
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
