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
import { InfoNote, Readout, SectionLabel, ToggleSwitch } from "../ui/controls";

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
          "flex items-center gap-3 rounded-card border px-3 py-2.5 transition-colors",
          locked ? "border-primary/40 bg-primary/5" : "border-border bg-surface",
        ].join(" ")}
      >
        {locked ? (
          <Lock className="size-4 shrink-0 text-primary" />
        ) : (
          <Unlock className="size-4 shrink-0 text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-text">Lock window</div>
          <div
            className="mt-0.5 text-[11px]"
            style={{
              color: locked ? "var(--color-primary)" : "var(--color-faint)",
            }}
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
            <Readout label="X" value={`${bounds.x}`} unit="px" />
            <Readout label="Y" value={`${bounds.y}`} unit="px" />
            <Readout label="W" value={`${bounds.width}`} unit="px" />
            <Readout label="H" value={`${bounds.height}`} unit="px" />
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface px-3 py-2.5 text-[11px] text-faint">
            Not saved yet — open the window and move or resize it once.
          </div>
        )}
      </section>

      {/* Note */}
      <InfoNote icon={<Info className="mt-0.5 size-3.5 shrink-0 text-primary" />}>
        This overlay's window remembers its own position, size and lock state.
        {isOpen
          ? " Changes apply to the open window immediately."
          : " They'll be restored the next time you open it."}
      </InfoNote>
    </div>
  );
}
