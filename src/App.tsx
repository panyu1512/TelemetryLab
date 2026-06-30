import { useEffect, useState } from "react";
import { useTelemetry } from "./hooks/useTelemetry";
import { useDashboardLayout } from "./hooks/useDashboardLayout";
import { TitleBar, type ConnectionStatus } from "./components/layout/TitleBar";
import { DashboardGrid } from "./components/layout/DashboardGrid";
import { Dock } from "./components/layout/Dock";
import { OverlayManager } from "./components/layout/OverlayManager";

export default function App() {
  const { data, connected, iracingActive } = useTelemetry();
  const layout = useDashboardLayout();
  const [managerOpen, setManagerOpen] = useState(false);

  // Esc closes the overlay manager.
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
        {!iracingActive && (
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

      {/* Floating overlay: dock + (optionally) the widget manager above it. */}
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
    </div>
  );
}
