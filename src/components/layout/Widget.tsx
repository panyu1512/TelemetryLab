import { EyeOff, ExternalLink, X } from "lucide-react";
import type { WidgetDef } from "../../dashboards/registry";
import type { TelemetryData } from "../../hooks/useTelemetry";
import { useActiveOverlaysStore } from "../../stores/useActiveOverlaysStore";
import { PanelHeader } from "../ui/PanelHeader";

/**
 * Class react-grid-layout treats as "don't start a drag here".
 *
 * There is no matching *handle* class: the whole card, header included, is the
 * grab target, and this is what carves the buttons back out of it. Nothing
 * else in a widget is interactive — they are readouts — so there is nothing
 * else to protect.
 */
export const WIDGET_NO_DRAG = "widget-no-drag";

interface WidgetProps {
  def: WidgetDef;
  data: TelemetryData | null;
  onHide: () => void;
}

/**
 * The shell every dashboard widget lives in: a rectangular panel with a thin
 * header naming its channel, and the readout under it.
 *
 * The header is one 22 px strip — the channel name in small grey caps, the
 * actions on the right where they appear on hover — and it yields its height
 * to the data on a card too short for both (see `.widget-card` in
 * styles.css). One 1 px edge, no shadow, no glass.
 *
 * Grab anywhere to reposition (the grid supplies the resize handle in the
 * corner). There is no separate edit mode — arrangements are live and
 * auto-persisted.
 */
export function Widget({ def, data, onHide }: WidgetProps) {
  const isOpen = useActiveOverlaysStore((s) => s.isWidgetOpen(def.id));
  const openWidget = useActiveOverlaysStore((s) => s.openWidget);
  const closeWidget = useActiveOverlaysStore((s) => s.closeWidget);

  return (
    // `timing-surface`, not `bg-surface`: a widget paints on the same graphite
    // paper as Standings and Relative, so the dashboard reads as one
    // instrument. It also keeps that paper over live footage instead of
    // dropping to glass — see the exception in styles.css.
    <section className="overlay-card widget-card timing-surface group relative flex h-full cursor-grab flex-col overflow-hidden rounded-card active:cursor-grabbing">
      <PanelHeader title={def.title}>
        <div
          className={`${WIDGET_NO_DRAG} flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100`}
        >
          {/* Once this widget has its own window, the only action is to close
              it again — not to open a second one. */}
          {isOpen ? (
            <button
              type="button"
              onClick={() => closeWidget(def.id)}
              title="Close this widget's window"
              className="grid size-[18px] place-items-center rounded-ctl text-primary transition-colors hover:bg-surface-2 hover:text-danger"
            >
              <X className="size-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openWidget(def.id, def.title)}
              title="Open this widget in its own window"
              className="grid size-[18px] place-items-center rounded-ctl text-faint transition-colors hover:bg-surface-2 hover:text-primary"
            >
              <ExternalLink className="size-3" />
            </button>
          )}
          <button
            type="button"
            onClick={onHide}
            title="Hide widget"
            className="grid size-[18px] place-items-center rounded-ctl text-faint transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <EyeOff className="size-3" />
          </button>
        </div>
      </PanelHeader>

      {/*
        `container-type: size` makes this body a query container so widgets can
        size their content fluidly (cqmin/cqh units); `overflow-hidden` keeps a
        widget that's been shrunk past its content from spilling onto its
        neighbours.
      */}
      <div
        className="widget-body min-h-0 flex-1 overflow-hidden"
        style={{ containerType: "size" }}
      >
        <def.Component data={data} />
      </div>
    </section>
  );
}
