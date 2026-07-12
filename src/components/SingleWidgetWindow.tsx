/**
 * Single-widget window.
 *
 * Rendered when the URL carries `?widget=<id>` — one telemetry widget (speed,
 * fuel, inputs, …) popped out into its own transparent, always-on-top window so
 * the driver can position individual metrics independently instead of the whole
 * dashboard as one block. Owns its own bridge connection and renders with the
 * overlay (transparent) treatment, like `OverlayWindow`.
 */

import { useEffect } from "react";
import { useBridge } from "../hooks/useBridge";
import { useTelemetry } from "../hooks/useTelemetry";
import { OverlayChrome } from "./OverlayChrome";
import { getWidget } from "../dashboards/registry";
import { useOverlayConfigStore } from "../stores/useOverlayConfigStore";
import { getTheme, applyTheme } from "../themes";
import { initWindow } from "../stores/useWindowStore";

export function SingleWidgetWindow({ id }: { id: string }) {
  useBridge();
  const { data } = useTelemetry();
  const config = useOverlayConfigStore();
  const def = getWidget(id);

  // Transparent, frosted background + independent window bounds.
  useEffect(() => {
    document.documentElement.classList.add("overlay-mode");
    initWindow();
    return () => document.documentElement.classList.remove("overlay-mode");
  }, []);

  // Widget windows follow the global theme (they aren't a configurable overlay).
  const themeId = config.globalSettings.themeId;
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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg text-text">
      <OverlayChrome kind="widget" id={id} />

      <section className="overlay-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-border/60 bg-surface p-3.5">
        <header className="mb-3 flex shrink-0 items-center gap-2">
          <def.icon className="size-3.5 text-faint" strokeWidth={2} />
          <h3 className="select-none text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
            {def.title}
          </h3>
        </header>
        <div
          className="min-h-0 flex-1 overflow-hidden"
          style={{ containerType: "size" }}
        >
          <Body data={data} />
        </div>
      </section>
    </div>
  );
}
