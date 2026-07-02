import { Minus, X, Monitor, Lock, Unlock } from "lucide-react";
import { useOverlayStore } from "../../stores/useOverlayStore";

/** True when running inside the Tauri WebView (vs. a plain browser tab). */
const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function windowAction(action: "minimize" | "close") {
  if (!isTauri) return;
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

/** Frameless, draggable title bar with brand, live status, overlay controls, and window buttons. */
export function TitleBar({ status }: { status: ConnectionStatus }) {
  const { overlayMode, locked, setOverlayMode, setLocked } = useOverlayStore();

  return (
    <header
      data-tauri-drag-region
      className={[
        "flex h-10 flex-none items-center gap-4 border-b px-3 transition-colors",
        overlayMode
          ? "border-accent/20 bg-bg/60 backdrop-blur-xl"
          : "border-border bg-surface",
      ].join(" ")}
    >
      {/* Brand */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2 text-[13px] font-semibold tracking-wide"
      >
        <span
          className="inline-block size-2 rounded-full transition-colors"
          style={{ background: overlayMode ? "var(--color-accent)" : status.color }}
        />
        <span data-tauri-drag-region>iRacing Telemetry</span>
      </div>

      {/* Connection status — hidden while locked in overlay (saves space) */}
      {(!overlayMode || !locked) && (
        <div className="flex items-center gap-2 text-xs">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: status.color }}
          />
          <span style={{ color: status.color }}>{status.label}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        {/* Overlay mode toggle — only meaningful inside Tauri */}
        {isTauri && (
          <TitleBarBtn
            onClick={() => setOverlayMode(!overlayMode)}
            title={overlayMode ? "Exit overlay mode" : "Enter overlay mode (always-on-top)"}
            active={overlayMode}
          >
            <Monitor className="size-4" />
          </TitleBarBtn>
        )}

        {/* Lock/unlock — only in overlay mode */}
        {overlayMode && (
          <TitleBarBtn
            onClick={() => setLocked(!locked)}
            title={
              locked
                ? "Unlock overlay (Ctrl+Shift+L)"
                : "Lock overlay — enable click-through (Ctrl+Shift+L)"
            }
            active={locked}
            danger={locked}
          >
            {locked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
          </TitleBarBtn>
        )}

        {/* Standard window controls */}
        {isTauri && (
          <>
            <TitleBarBtn
              onClick={() => windowAction("minimize")}
              title="Minimize"
            >
              <Minus className="size-4" />
            </TitleBarBtn>
            <TitleBarBtn
              onClick={() => windowAction("close")}
              title="Close"
              closeBtn
            >
              <X className="size-4" />
            </TitleBarBtn>
          </>
        )}
      </div>
    </header>
  );
}

// ── small reusable button ────────────────────────────────────────────────────

function TitleBarBtn({
  onClick,
  title,
  active = false,
  danger = false,
  closeBtn = false,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  danger?: boolean;
  closeBtn?: boolean;
  children: React.ReactNode;
}) {
  const base = "grid h-6 w-7 place-items-center rounded transition-colors";

  let cls: string;
  if (closeBtn) {
    cls = `${base} text-muted hover:bg-danger hover:text-bg`;
  } else if (danger && active) {
    cls = `${base} bg-danger/15 text-danger hover:bg-danger/25`;
  } else if (active) {
    cls = `${base} bg-accent/15 text-accent hover:bg-accent/25`;
  } else {
    cls = `${base} text-muted hover:bg-surface-2 hover:text-text`;
  }

  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={active} className={cls}>
      {children}
    </button>
  );
}
