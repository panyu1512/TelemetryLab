import { useEffect } from "react";
import { useBridge } from "./hooks/useBridge";
import { useTelemetry } from "./hooks/useTelemetry";
import { TitleBar, type ConnectionStatus } from "./components/layout/TitleBar";
import { OverlayManager } from "./components/manager/ManagerWindow";
import { initWindow } from "./stores/useWindowStore";
import { useOverlayConfigStore } from "./stores/useOverlayConfigStore";
import { restoreOpenWindows } from "./lib/overlayWindows";
import { getTheme, applyTheme } from "./themes";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * The main window is a dedicated **Overlay Manager**: it configures, previews,
 * opens, closes and tracks overlay windows. It never renders an overlay itself
 * and never behaves as a floating controller — overlays live in their own
 * windows, opened directly from the manager.
 */
export default function App() {
  // Own a bridge socket for the manager's live status readout.
  useBridge();
  const { connected, iracingActive } = useTelemetry();

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

  let status: ConnectionStatus;
  if (!connected) {
    status = { label: "Connecting to bridge…", color: "var(--color-warning)" };
  } else if (!iracingActive) {
    status = { label: "Waiting for iRacing…", color: "var(--color-muted)" };
  } else {
    status = { label: "Live", color: "var(--color-accent)" };
  }

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <TitleBar status={status} />
      <OverlayManager />
    </div>
  );
}
