import { useEffect } from "react";
import { TitleBar, type ConnectionStatus } from "./components/layout/TitleBar";
import { OverlayManager } from "./components/manager/ManagerWindow";
import { initWindow } from "./stores/useWindowStore";
import { useOverlayConfigStore } from "./stores/useOverlayConfigStore";
import { restoreOpenWindows } from "./lib/overlayWindows";
import { MockFeed } from "./telemetry/mockFeed";
import { getTheme, applyTheme } from "./themes";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * The main window is a dedicated **Overlay Manager**: it configures, previews,
 * opens, closes and tracks overlay windows. It never renders an overlay itself
 * and never behaves as a floating controller — overlays live in their own
 * windows, opened directly from the manager.
 *
 * The manager isn't a telemetry consumer, so instead of connecting to the real
 * bridge it drives its own stores with the {@link MockFeed}. That lets the live
 * preview render the *real* overlay components with representative data offline,
 * without a running sim or bridge. (Each overlay window still owns a real bridge
 * connection — or mock, per Global Settings — independently.)
 */
export default function App() {
  // Feed the live preview with synthetic telemetry for the manager's lifetime.
  useEffect(() => {
    const feed = new MockFeed();
    feed.start();
    return () => feed.stop();
  }, []);

  // The manager is a normal (non-overlay) window: paint with the global theme.
  const globalThemeId = useOverlayConfigStore((s) => s.globalSettings.themeId);
  useEffect(() => {
    applyTheme(getTheme(globalThemeId), false);
  }, [globalThemeId]);

  // Restore window bounds + re-open the overlays the user had open last session.
  useEffect(() => {
    initWindow();
    if (isTauri) restoreOpenWindows();
  }, []);

  const status: ConnectionStatus = {
    label: "Preview · mock data",
    color: "var(--color-accent)",
  };

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <TitleBar status={status} />
      <OverlayManager />
    </div>
  );
}
