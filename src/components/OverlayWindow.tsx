/**
 * Single-overlay window.
 *
 * Rendered instead of the full app when the URL carries `?overlay=<id>` — used
 * both for spawned desktop windows and for browser-source links. It shows just
 * that one overlay full-bleed (no dock, title bar or manager), owns its own
 * bridge connection, and applies the overlay's own theme + appearance so it
 * looks identical to how it does inside the main window.
 *
 * The page renders with a **transparent background** (via the `overlay-mode`
 * class): a popped-out desktop window floats over iRacing, and an OBS Browser
 * Source composites over the game capture — in both cases only the frosted
 * widget surfaces should paint, never a solid black page. A thin drag strip at
 * the top lets the user reposition the frameless desktop window.
 */

import { useEffect } from "react";
import { useBridge } from "../hooks/useBridge";
import { useTelemetry } from "../hooks/useTelemetry";
import { useDashboardLayout } from "../hooks/useDashboardLayout";
import { DashboardGrid } from "./layout/DashboardGrid";
import { OverlayChrome } from "./OverlayChrome";
import { getDashboard } from "../dashboards/registry";
import { useOverlayConfigStore } from "../stores/useOverlayConfigStore";
import { useSessionStore } from "../stores/useSessionStore";
import { getTheme, applyTheme } from "../themes";
import { initWindow } from "../stores/useWindowStore";

export function OverlayWindow({ id }: { id: string }) {
  // Each overlay window owns its own socket to the bridge.
  useBridge();
  const { data } = useTelemetry();
  const layout = useDashboardLayout(id);

  const config = useOverlayConfigStore();
  const settings = config.getOverlaySettings(id);
  const dashboard = getDashboard(id);

  // Conditional visibility: hide this overlay's content when it's disabled or
  // when the session matches a "hide when in" rule. The window stays open (so it
  // still restores), but paints nothing while hidden.
  const session = useSessionStore((s) => s.session);
  const isReplay =
    session?.sessionStateLabel === "Replay" ||
    (session?.flags ?? []).includes("replay");
  const isLoneQualify = (session?.flags ?? []).includes("lone_qualify");
  const hidden =
    !settings.enabled ||
    (settings.visibility.hideOnReplay && isReplay) ||
    (settings.visibility.hideOnLoneQualify && isLoneQualify);

  // Transparent, frosted background so the game (or an OBS capture) shows
  // through — a single-overlay render is always "overlay mode". Also remember
  // this window's position/size independently of the main window.
  useEffect(() => {
    document.documentElement.classList.add("overlay-mode");
    initWindow();
    return () => document.documentElement.classList.remove("overlay-mode");
  }, []);

  // Apply this overlay's effective theme (own override, else global default).
  const effectiveThemeId =
    settings.appearance.themeId ?? config.globalSettings.themeId;
  useEffect(() => {
    // A single-overlay window is always an overlay: transparent background.
    applyTheme(getTheme(effectiveThemeId), true);
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
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg text-text">
      <OverlayChrome kind="overlay" id={id} />

      <main
        className={[
          "min-h-0 flex-1 overflow-auto p-2 transition-[filter,opacity]",
          hidden ? "invisible" : "",
        ].join(" ")}
        style={style}
      >
        <DashboardGrid layout={layout} data={data} />
      </main>
    </div>
  );
}
