import { Minus, X } from "lucide-react";

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

/** The TelemetryLab mark: a chevron-cut square that reads as a speed block. */
function BrandMark() {
  return (
    <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
      <path
        d="M4 3h9.5a2.5 2.5 0 0 1 2.5 2.5v9A2.5 2.5 0 0 1 13.5 17H4l4.2-7L4 3Z"
        fill="var(--color-primary)"
      />
      <path d="M4 3l4.2 7L4 17V3Z" fill="var(--color-accent)" opacity="0.9" />
    </svg>
  );
}

/**
 * Frameless, draggable title bar for the Overlay Manager: brand, live bridge
 * status and standard window buttons. The manager is a normal window — it never
 * becomes an overlay, so there are no overlay-mode or lock controls here.
 */
export function TitleBar({ status }: { status: ConnectionStatus }) {
  return (
    <header
      data-tauri-drag-region
      className="relative flex h-11 flex-none items-center gap-3 border-b border-border bg-surface px-4"
    >
      {/* Signature speed stripe: the brand mark's two hues, racing off-edge. */}
      <span
        aria-hidden
        className="absolute bottom-[-1px] left-0 h-px w-44"
        style={{
          background:
            "linear-gradient(90deg, var(--color-primary), var(--color-accent) 65%, transparent)",
        }}
      />
      {/* Brand */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2.5 text-[13px] font-semibold tracking-tight text-text"
      >
        <BrandMark />
        <span data-tauri-drag-region>TelemetryLab</span>
        <span
          data-tauri-drag-region
          className="text-[13px] font-normal text-faint"
        >
          for iRacing
        </span>
      </div>

      {/* Connection status pill */}
      <div className="ml-2 flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium">
        <span
          className="inline-block size-1.5 rounded-full"
          style={{ background: status.color }}
        />
        <span className="text-muted">{status.label}</span>
      </div>

      {/* Standard window controls */}
      {isTauri && (
        <div className="ml-auto flex items-center gap-1">
          <TitleBarBtn onClick={() => windowAction("minimize")} title="Minimize">
            <Minus className="size-4" />
          </TitleBarBtn>
          <TitleBarBtn onClick={() => windowAction("close")} title="Close" closeBtn>
            <X className="size-4" />
          </TitleBarBtn>
        </div>
      )}
    </header>
  );
}

// ── small reusable button ────────────────────────────────────────────────────

function TitleBarBtn({
  onClick,
  title,
  closeBtn = false,
  children,
}: {
  onClick: () => void;
  title: string;
  closeBtn?: boolean;
  children: React.ReactNode;
}) {
  const base = "grid h-7 w-8 place-items-center rounded-ctl transition-colors";
  const cls = closeBtn
    ? `${base} text-muted hover:bg-danger hover:text-white`
    : `${base} text-muted hover:bg-surface-2 hover:text-text`;

  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  );
}
