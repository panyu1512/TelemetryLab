import { Minus, X } from "lucide-react";

/** True when running inside the Tauri WebView (vs. a plain browser tab). */
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function windowAction(action: "minimize" | "close") {
  if (!isTauri) return;
  // Imported lazily so a plain browser dev session never touches the Tauri API.
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const w = getCurrentWindow();
  if (action === "minimize") await w.minimize();
  if (action === "close") await w.close();
}

export interface ConnectionStatus {
  label: string;
  /** A CSS color (token var) for the status dot + text. */
  color: string;
}

/** Frameless, draggable title bar with brand, live status, window controls. */
export function TitleBar({ status }: { status: ConnectionStatus }) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-10 flex-none items-center gap-4 border-b border-border bg-surface px-3"
    >
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 text-[13px] font-semibold tracking-wide"
      >
        <span className="text-accent">●</span>
        <span>iRacing Telemetry</span>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: status.color }}
        />
        <span style={{ color: status.color }}>{status.label}</span>
      </div>

      {isTauri && (
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => windowAction("minimize")}
            aria-label="Minimize"
            className="grid h-6 w-7 place-items-center rounded text-muted hover:bg-surface-2 hover:text-text"
          >
            <Minus className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => windowAction("close")}
            aria-label="Close"
            className="grid h-6 w-7 place-items-center rounded text-muted hover:bg-danger hover:text-bg"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </header>
  );
}
