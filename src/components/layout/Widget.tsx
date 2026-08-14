import { EyeOff, ExternalLink, X } from "lucide-react";
import type { WidgetDef } from "../../dashboards/registry";
import type { TelemetryData } from "../../hooks/useTelemetry";
import { useActiveOverlaysStore } from "../../stores/useActiveOverlaysStore";

/**
 * Class react-grid-layout treats as "don't start a drag here".
 *
 * There is no matching *handle* class any more. A widget used to be grabbed by
 * its header; the header is gone, so the whole card is the grab target and this
 * is what carves the buttons back out of it. Nothing else in a widget is
 * interactive — they are readouts — so there is nothing else to protect.
 */
export const WIDGET_NO_DRAG = "widget-no-drag";

interface WidgetProps {
  def: WidgetDef;
  data: TelemetryData | null;
  onHide: () => void;
}

/**
 * The shell every dashboard widget lives in: a card of pure content.
 *
 * It used to be a *titled* card — icon, name, a rule, and the actions on hover.
 * The title and icon are gone: a label you have already learned costs a glance
 * every time you skip it, and this is a surface read without looking. The
 * actions moved into the top-right corner, where they still appear on hover.
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
    // `timing-surface`, not `bg-surface`: a widget paints on the same near-black
    // paper as Standings and Relative, so the dashboard reads as one instrument
    // rather than as graphite cards next to a black table. It also means a
    // widget keeps that paper over live footage instead of dropping to glass —
    // see the exception in styles.css.
    <section className="overlay-card widget-card timing-surface group relative flex h-full cursor-grab flex-col overflow-hidden rounded-card border border-border/60 transition-colors active:cursor-grabbing">
      {/*
        The widget's name and icon used to head every card. They are gone, and
        the argument for cutting them is the same one that took the standings'
        column labels off by default: a label you have already learned costs a
        glance every time you skip it, and these are read in peripheral vision
        at speed. A speedometer does not need the word "speed" on it — the
        needle, the gauge and the KM/H under the number all say so, and every
        widget here is as self-evident. The card is now content edge to edge.

        Which is also why the whole card is the drag target. There is no header
        left to grab, and nothing inside a readout to grab it by mistake.
      */}
      <div
        className={`${WIDGET_NO_DRAG} absolute right-1 top-1 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100`}
      >
        {/* Once this widget has its own window, the only action is to close
            it again — not to open a second one. */}
        {isOpen ? (
          <button
            type="button"
            onClick={() => closeWidget(def.id)}
            title="Close this widget's window"
            className="grid size-6 place-items-center rounded-ctl bg-bg/70 text-primary backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => openWidget(def.id, def.title)}
            title="Open this widget in its own window"
            className="grid size-6 place-items-center rounded-ctl bg-bg/70 text-muted backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-primary"
          >
            <ExternalLink className="size-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={onHide}
          title="Hide widget"
          className="grid size-6 place-items-center rounded-ctl bg-bg/70 text-muted backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-danger"
        >
          <EyeOff className="size-3.5" />
        </button>
      </div>

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
