import { useEffect, useState } from "react";
import { useBridge } from "./hooks/useBridge";
import { useTelemetry } from "./hooks/useTelemetry";
import { useDashboardLayout } from "./hooks/useDashboardLayout";
import { TitleBar, type ConnectionStatus } from "./components/layout/TitleBar";
import { DashboardGrid } from "./components/layout/DashboardGrid";
import { Dock } from "./components/layout/Dock";
import { ManagerWindow } from "./components/manager/ManagerWindow";
import {
  useOverlayStore,
  initWindowBoundsPersistence,
} from "./stores/useOverlayStore";
import { useOverlayConfigStore } from "./stores/useOverlayConfigStore";
import { useSessionStore } from "./stores/useSessionStore";
import { restoreOpenWindows } from "./lib/overlayWindows";
import { getTheme, applyTheme } from "./themes";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function App() {
  // Own the bridge WebSocket for the app's lifetime; it feeds all the stores.
  useBridge();
  const { data, connected, iracingActive } = useTelemetry();
  const layout = useDashboardLayout();
  const [managerOpen, setManagerOpen] = useState(false);
  const { overlayMode, locked } = useOverlayStore();

  // v0.7.0 overlay config
  const configStore = useOverlayConfigStore();
  const activeOverlayId = layout.active;
  const overlaySettings = configStore.getOverlaySettings(activeOverlayId);

  // Session state for conditional visibility
  const session = useSessionStore((s) => s.session);
  const sessionFlags = session?.flags ?? [];
  const sessionState = session?.sessionStateLabel ?? "";

  // ── Conditional visibility ───────────────────────────────────────────────
  // Determine whether the active overlay should be shown based on visibility rules.
  const isReplay = sessionState === "Replay" || sessionFlags.includes("replay");
  const isLoneQualify = sessionFlags.includes("lone_qualify");

  const shouldHide =
    overlaySettings.enabled === false ||
    (overlaySettings.visibility.hideOnReplay && isReplay) ||
    (overlaySettings.visibility.hideOnLoneQualify && isLoneQualify);

  // ── Overlay CSS class sync ───────────────────────────────────────────────
  // Keep <html> class list in sync with store so CSS rules can target it.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("overlay-mode", overlayMode);
    html.classList.toggle("overlay-locked", overlayMode && locked);
  }, [overlayMode, locked]);

  // ── Theme sync ───────────────────────────────────────────────────────────
  // Apply the *active overlay's* effective theme: its own override if set,
  // otherwise the profile's global theme. This is what makes both the
  // per-overlay theme picker (Appearance tab) and the global theme selector
  // take effect live.
  const effectiveThemeId =
    overlaySettings.appearance.themeId ?? configStore.globalSettings.themeId;
  useEffect(() => {
    // In overlay mode the background must be transparent so the game shows
    // through; applyTheme owns that (inline vars beat the overlay-mode CSS).
    applyTheme(getTheme(effectiveThemeId), overlayMode);
  }, [effectiveThemeId, overlayMode]);

  // ── Tauri: init window bounds + Ctrl+Shift+L hotkey listener ────────────
  useEffect(() => {
    initWindowBoundsPersistence();

    if (!isTauri) return;

    // Re-open the overlay/widget windows the user had open last session.
    restoreOpenWindows();

    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen("overlay://toggle-lock", () => {
        useOverlayStore.getState().toggleLock();
      }).then((fn) => {
        unlisten = fn;
      });
    });

    return () => {
      unlisten?.();
    };
  }, []);

  // ── Esc closes the overlay manager ──────────────────────────────────────
  useEffect(() => {
    if (!managerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setManagerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [managerOpen]);

  let status: ConnectionStatus;
  if (!connected) {
    status = { label: "Connecting to bridge…", color: "var(--color-warning)" };
  } else if (!iracingActive) {
    status = { label: "Waiting for iRacing…", color: "var(--color-muted)" };
  } else {
    status = { label: "Live", color: "var(--color-accent)" };
  }

  // ── Per-overlay appearance filters ──────────────────────────────────────
  // Apply saturation/brightness/opacity from the active overlay's settings
  // as a CSS filter on the main content area.
  const { saturation, brightness, opacity } = overlaySettings.appearance;
  const appearanceStyle: React.CSSProperties = {};
  if (saturation !== 100 || brightness !== 100) {
    appearanceStyle.filter = `saturate(${saturation}%) brightness(${brightness}%)`;
  }
  if (opacity !== 100) {
    appearanceStyle.opacity = opacity / 100;
  }

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <TitleBar status={status} />

      <main
        className={[
          "relative flex-1 overflow-auto p-4 pb-28 transition-[filter,opacity]",
          shouldHide && overlayMode ? "invisible" : "",
        ].join(" ")}
        style={appearanceStyle}
      >
        {!iracingActive && !overlayMode && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted">
            <span
              className="inline-block size-1.5 rounded-full"
              style={{ background: status.color }}
            />
            {connected
              ? "Bridge connected — start a session in iRacing (or run the mock bridge) to see live data."
              : "Reaching the telemetry bridge… the layout below is fully usable offline."}
          </div>
        )}

        <DashboardGrid layout={layout} data={data} />
      </main>

      {/* Floating overlay: dock. Hidden when the overlay is locked so it doesn't
          block iRacing input. */}
      {!locked && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-3 px-4">
          <div className="pointer-events-auto">
            <Dock
              layout={layout}
              managerOpen={managerOpen}
              onToggleManager={() => setManagerOpen((o) => !o)}
            />
          </div>
        </div>
      )}

      {/* v0.7.0 — Full-screen Overlay Manager */}
      {managerOpen && (
        <ManagerWindow
          onClose={() => setManagerOpen(false)}
          onActivateOverlay={(overlayId) => {
            layout.setActive(overlayId);
            setManagerOpen(false);
          }}
        />
      )}

      {/* Locked-mode indicator: a small floating pill showing the hotkey hint. */}
      {overlayMode && locked && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-accent/30 bg-bg/60 px-3 py-1 text-[11px] text-accent/70 backdrop-blur-md">
            <span className="inline-block size-1.5 rounded-full bg-accent" />
            Locked · Ctrl+Shift+L to unlock
          </div>
        </div>
      )}
    </div>
  );
}
