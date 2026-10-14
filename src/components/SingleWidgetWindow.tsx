/**
 * Single-widget window.
 *
 * Rendered when the URL carries `?widget=<id>` — one telemetry widget (speed,
 * fuel, inputs, …) popped out into its own transparent, always-on-top window so
 * the driver can position individual metrics independently instead of the whole
 * dashboard as one block. Owns its own bridge connection and renders with the
 * overlay (transparent) treatment, like `OverlayWindow`.
 *
 * A widget is configured under its dashboard in the Manager, so it takes that
 * dashboard's settings exactly as an overlay window takes its own: the Enabled
 * switch, the theme and the saturation / brightness / opacity sliders, and the
 * "Hide when" rules — plus the widget's own toggle in the Widgets list. All of
 * them apply live, over the window bus, with the window left open.
 */

import { useEffect } from "react";
import { useBridge } from "../hooks/useBridge";
import { useTelemetry } from "../hooks/useTelemetry";
import { OverlayChrome } from "./OverlayChrome";
import { PanelHeader } from "./ui/PanelHeader";
import { dashboardOfWidget, getWidget } from "../dashboards/registry";
import { useOverlayConfigStore } from "../stores/useOverlayConfigStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useWidgetSelectionStore } from "../stores/useWidgetSelectionStore";
import {
  appearanceStyle,
  effectiveThemeId,
  isOverlayHidden,
  visibilityConditions,
} from "../lib/overlayVisibility";
import { getTheme, applyTheme } from "../themes";
import { initWindow } from "../stores/useWindowStore";

export function SingleWidgetWindow({ id }: { id: string }) {
  useBridge();
  const { data } = useTelemetry();
  const config = useOverlayConfigStore();
  const def = getWidget(id);
  const dashboardId = dashboardOfWidget(id)?.id ?? "dashboard";
  const settings = config.getOverlaySettings(dashboardId);
  const widgetEnabled = useWidgetSelectionStore((s) => s.isEnabled(id));
  const session = useSessionStore((s) => s.session);

  const hidden = isOverlayHidden(
    settings,
    visibilityConditions(session, data?.onPitRoad),
    widgetEnabled,
  );

  // Transparent, frosted background + independent window bounds.
  useEffect(() => {
    document.documentElement.classList.add("overlay-mode");
    initWindow();
    return () => document.documentElement.classList.remove("overlay-mode");
  }, []);

  // The dashboard's theme override, else the global theme.
  const themeId = effectiveThemeId(settings.appearance, config.globalSettings.themeId);
  useEffect(() => {
    applyTheme(getTheme(themeId), true);
  }, [themeId]);

  useEffect(() => {
    document.title = def
      ? `${def.title} — iRacing Telemetry`
      : "Widget — iRacing Telemetry";
  }, [def]);

  if (!def) {
    return (
      <div className="grid h-full w-full place-items-center bg-bg p-4 text-center text-sm text-muted">
        <OverlayChrome kind="widget" id={id} />
        Unknown widget: <code className="text-text">{id}</code>
      </div>
    );
  }

  const Body = def.Component;
  const body = (
    <div
      className="widget-body min-h-0 flex-1 overflow-hidden"
      style={{ containerType: "size" }}
    >
      <Body data={data} />
    </div>
  );

  return (
    <div className="widget-frame flex h-full w-full flex-col overflow-hidden bg-bg text-text">
      <OverlayChrome kind="widget" id={id} />

      <div
        className={[
          "flex min-h-0 flex-1 flex-col transition-[filter,opacity]",
          hidden ? "invisible" : "",
        ].join(" ")}
        style={appearanceStyle(settings.appearance)}
      >
        {def.bare ? (
          // A bare widget is only its marks: no panel, no header, nothing
          // painted behind them for the game to be hidden by.
          body
        ) : (
          // Same panel as the widget in the dashboard grid — a widget popped
          // into its own window is the same widget, header included: the
          // window is frameless over the game, so the channel name is the
          // only title it has.
          <section className="overlay-card widget-card timing-surface flex min-h-0 flex-1 flex-col overflow-hidden rounded-card">
            <PanelHeader title={def.title} />
            {body}
          </section>
        )}
      </div>
    </div>
  );
}
