/**
 * Window panel — locking and window state for a single overlay's window.
 *
 * Opening/closing the overlay window lives in the page header; this section owns
 * the click-through **lock** and shows the window's remembered position/size.
 * Locking is generic (any overlay/widget window uses the same
 * `useWindowStore.setLock` path) and propagates to the open window immediately.
 */

import { Info, Lock, Unlock } from "lucide-react";
import { useWindowStore } from "../../stores/useWindowStore";
import { useActiveOverlaysStore } from "../../stores/useActiveOverlaysStore";
import { getWindowState } from "../../lib/windowState";

interface WindowPanelProps {
  overlayId: string;
}

export function WindowPanel({ overlayId }: WindowPanelProps) {
  const label = `overlay-${overlayId}`;
  const isOpen = useActiveOverlaysStore((s) => s.isOverlayOpen(overlayId));
  const setLock = useWindowStore((s) => s.setLock);
  const locked = useWindowStore((s) => s.isLocked(label));

  // Persisted bounds are re-read on each render; they change on move/resize.
  const bounds = getWindowState(label).bounds;

  return (
    <div className="space-y-4">
      {/* Lock */}
      <div
        className={[
          "flex items-center gap-3 rounded-lg border px-3 py-2.5",
          locked ? "border-accent/40 bg-accent/5" : "border-border bg-surface-2",
        ].join(" ")}
      >
        {locked ? (
          <Lock className="size-4 shrink-0 text-accent" />
        ) : (
          <Unlock className="size-4 shrink-0 text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-text">Lock window</div>
          <div
            className="mt-0.5 text-[11px]"
            style={{ color: locked ? "var(--color-accent)" : "var(--color-muted)" }}
          >
            {locked
              ? "Locked · click-through, can't be moved (Ctrl+Shift+L)"
              : "Unlocked · movable and interactive"}
          </div>
        </div>
        <ToggleSwitch checked={locked} onChange={(v) => setLock(label, v)} />
      </div>

      {/* Position & size */}
      <section>
        <SectionLabel>Position &amp; Size</SectionLabel>
        {bounds ? (
          <div className="grid grid-cols-4 gap-2">
            <Metric label="X" value={`${bounds.x}`} />
            <Metric label="Y" value={`${bounds.y}`} />
            <Metric label="W" value={`${bounds.width}`} />
            <Metric label="H" value={`${bounds.height}`} />
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-[11px] text-muted">
            Not saved yet — open the window and move or resize it once.
          </div>
        )}
      </section>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          This overlay's window remembers its own position, size and lock state.
          {isOpen
            ? " Changes apply to the open window immediately."
            : " They'll be restored the next time you open it."}
        </span>
      </div>
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </p>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-text">{value}</div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-surface border border-border-strong",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 size-4 rounded-full bg-bg transition-[left]",
          checked ? "left-[18px]" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}
