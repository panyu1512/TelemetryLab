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

/**
 * The TelemetryLab mark: a TL monogram leaning 19° forward, the T in the text
 * colour and the L in the brand teal. The same two paths ship in
 * `public/favicon.svg` (which is what the platform icons are generated from)
 * and in the marketing page's nav and footer — change one and change them all.
 */
function BrandMark() {
  // 22px, not 18: the ink fills 52 % of the box's height, so this sets the
  // letters a fifth taller than the cap height of the 13px name beside it.
  return (
    <svg viewBox="0 0 32 32" className="size-[22px]" fill="var(--color-text)" aria-hidden>
      <path d="M6.09 7.64L22.78 7.64L19.68 10.64L14.54 10.64L9.86 24.36L5.82 24.36L10.5 10.64L4 10.64Z" />
      <path
        fill="var(--color-brand)"
        d="M16.36 11.52L20.4 11.52L16.99 21.53L28 21.53L25.2 24.36L11.98 24.36Z"
      />
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
      className="relative flex h-10 flex-none items-center gap-3 border-b border-border bg-surface px-4"
    >
      {/* Brand */}
      <div
        data-tauri-drag-region
        className="flex items-center gap-2.5 text-name font-semibold tracking-tight text-text"
      >
        <BrandMark />
        <span data-tauri-drag-region>TelemetryLab</span>
        <span
          data-tauri-drag-region
          className="text-name font-normal text-faint"
        >
          for iRacing
        </span>
      </div>

      {/* Connection status readout: a live dot that breathes, and the
          state in words. */}
      <div className="ml-2 inline-flex items-center gap-1.5 rounded-ctl border border-border bg-surface-2 px-2 py-1 text-small font-medium">
        <span className="live-dot" style={{ color: status.color }} />
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
  // `on-accent`, not white: `danger` is a light red, so a white glyph on it
  // sits near 2.9:1 — the same failure the filled buttons had.
  const cls = closeBtn
    ? `${base} text-muted hover:bg-danger hover:text-on-accent`
    : `${base} text-muted hover:bg-surface-2 hover:text-text`;

  return (
    <button type="button" onClick={onClick} title={title} className={cls}>
      {children}
    </button>
  );
}
