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
 * The TelemetryLab mark: a TL monogram sheared 13.5° off vertical, with every
 * free terminal cut on the same diagonal. The same two paths ship in
 * `public/favicon.svg` (which is what the platform icons are generated from)
 * and in the marketing page's nav — change one and change all three.
 *
 * One colour, not two. The mark it replaces filled its counter with `accent`,
 * which by the design system's own table means "positive" and is never
 * decoration; `primary` alone is the informational/chrome sense this wants.
 */
function BrandMark() {
  // 18px, not `size-4`: the ink fills 62.5 % of the box, so a 16px box would
  // set the mark below the cap height of the 13px name beside it.
  return (
    <svg viewBox="0 0 32 32" className="size-[18px]" fill="var(--color-primary)" aria-hidden>
      <path d="M8.69 9L18.89 9L17.69 14L15.69 14L13.48 23.2L7.81 26L10.69 14L4.69 14Z" />
      <path d="M20.41 6L25.41 6L21.81 21L27.31 21L23.31 26L15.61 26Z" />
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
