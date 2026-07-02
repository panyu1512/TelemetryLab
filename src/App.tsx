import { useEffect, useState } from "react";
import { useBridge } from "./hooks/useBridge";
import { useTelemetry } from "./hooks/useTelemetry";
import { useDashboardLayout } from "./hooks/useDashboardLayout";
import { TitleBar, type ConnectionStatus } from "./components/layout/TitleBar";
import { DashboardGrid } from "./components/layout/DashboardGrid";
import { Dock } from "./components/layout/Dock";
import { OverlayManager } from "./components/layout/OverlayManager";
import {
  useOverlayStore,
  initWindowBoundsPersistence,
} from "./stores/useOverlayStore";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export default function App() {
  // Own the bridge WebSocket for the app's lifetime; it feeds all the stores.
  useBridge();
  const { data, connected, iracingActive } = useTelemetry();
  const layout = useDashboardLayout();
  const [managerOpen, setManagerOpen] = useState(false);
  const { overlayMode, locked } = useOverlayStore();

  // ── Overlay CSS class sync ──────────────────────────────────────────────
  // Keep <html> class list in sync with store so CSS rules can target it.
  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle("overlay-mode", overlayMode);
    html.classList.toggle("overlay-locked", overlayMode && locked);
  }, [overlayMode, locked]);

  // ── Tauri: init window bounds + Ctrl+Shift+L hotkey listener ───────────
  useEffect(() => {
    initWindowBoundsPersistence();

    if (!isTauri) return;

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

  // ── Esc closes the overlay manager ─────────────────────────────────────
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

  return (
    <div className="flex h-full flex-col bg-bg text-text">
      <TitleBar status={status} />

      <main className="relative flex-1 overflow-auto p-4 pb-28">
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

      {/* Floating overlay: dock + (optionally) the widget manager above it.
          Hidden when the overlay is locked so it doesn't block iRacing. */}
      {!locked && (
        <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex flex-col items-center gap-3 px-4">
          {managerOpen && (
            <div className="pointer-events-auto">
              <OverlayManager
                layout={layout}
                onClose={() => setManagerOpen(false)}
              />
            </div>
          )}
          <div className="pointer-events-auto">
            <Dock
              layout={layout}
              managerOpen={managerOpen}
              onToggleManager={() => setManagerOpen((o) => !o)}
            />
          </div>
        </div>
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
