/**
 * Single-overlay window.
 *
 * Rendered instead of the full app when the URL carries `?overlay=<id>` — used
 * both for spawned desktop windows and for browser-source links. It shows just
 * that one overlay full-bleed (no dock, title bar or manager), owns its own
 * bridge connection, and applies the overlay's own theme + appearance so it
 * looks identical to how it does inside the main window.
 */

import { useEffect } from "react";
import { useBridge } from "../hooks/useBridge";
import { useTelemetry } from "../hooks/useTelemetry";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { DashboardGrid } from "./layout/DashboardGrid";
import { getDashboard } from "../dashboards/registry";
import { useOverlayConfigStore } from "../stores/useOverlayConfigStore";
import { getTheme, applyTheme } from "../themes";

export function OverlayWindow({ id }: { id: string }) {
  // Each overlay window owns its own socket to the bridge.
  useBridge();
  const { data } = useTelemetry();
  const layout = useDashboardLayout(id);

  const config = useOverlayConfigStore();
  const settings = config.getOverlaySettings(id);
  const dashboard = getDashboard(id);

  // Apply this overlay's effective theme (own override, else global default).
  const effectiveThemeId =
    settings.appearance.themeId ?? config.globalSettings.themeId;
  useEffect(() => {
    applyTheme(getTheme(effectiveThemeId));
  }, [effectiveThemeId]);

  useEffect(() => {
    document.title = `${dashboard.label} — iRacing Telemetry`;
  }, [dashboard.label]);

  // Per-overlay appearance adjustments (saturation / brightness / opacity).
  const { saturation, brightness, opacity } = settings.appearance;
  const style: React.CSSProperties = {};
  if (saturation !== 100 || brightness !== 100) {
    style.filter = `saturate(${saturation}%) brightness(${brightness}%)`;
  }
  if (opacity !== 100) style.opacity = opacity / 100;

  return (
    <div className="h-full w-full overflow-hidden bg-bg text-text">
      <main
        className="h-full overflow-auto p-2 transition-[filter,opacity]"
        style={style}
      >
        <DashboardGrid layout={layout} data={data} />
      </main>
    </div>
  );
}
