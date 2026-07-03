/**
 * Window panel — window mode + generic per-window locking.
 *
 * Locking is identical for the main window and every popped-out overlay/widget
 * window: one control, one code path (`useWindowStore.setLock`). This panel lets
 * the user open the selected overlay in its own window and lock/unlock *any*
 * open window individually; lock changes propagate to that window immediately.
 */

import { useState } from "react";
import { AppWindow, ExternalLink, Info, Lock, Unlock } from "lucide-react";
import {
  useWindowStore,
  WINDOW_LABEL,
} from "../../stores/useWindowStore";
import { getDashboard, getWidget } from "../../dashboards/registry";
import {
  getRememberedWindows,
  openOverlayWindow,
} from "../../lib/overlayWindows";

interface WindowPanelProps {
  overlayId: string;
  onActivate?: (overlayId: string) => void;
}

/** A window row shown in the lock list. */
interface WindowRow {
  label: string;
  name: string;
  /** Main window can only be locked while in overlay mode. */
  lockable: boolean;
}

export function WindowPanel({ overlayId, onActivate }: WindowPanelProps) {
  const store = useWindowStore();
  const { overlayMode, setOverlayMode, setLock, isLocked } = store;
  const dashboard = getDashboard(overlayId);
  const [, forceRefresh] = useState(0);

  const rows: WindowRow[] = [
    { label: "main", name: "Main window", lockable: overlayMode },
    ...getRememberedWindows().map((w) => ({
      label: `${w.kind}-${w.id}`,
      name:
        w.kind === "widget"
          ? getWidget(w.id)?.title ?? w.label
          : getDashboard(w.id).label,
      lockable: true,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Main window mode */}
      <section>
        <SectionLabel>Main Window</SectionLabel>
        <ControlRow
          label="Overlay Mode"
          description="Makes the main window always-on-top with a transparent background, rendering over iRacing."
        >
          <ToggleSwitch checked={overlayMode} onChange={setOverlayMode} />
        </ControlRow>
      </section>

      {/* This overlay */}
      <section>
        <SectionLabel>{dashboard.label}</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={<AppWindow className="size-4" />}
            label="Open in new window"
            description="Pop this overlay out into its own always-on-top window"
            onClick={() => {
              openOverlayWindow(overlayId, dashboard.label);
              // Give the spawned window a moment to register, then re-list.
              setTimeout(() => forceRefresh((n) => n + 1), 150);
            }}
          />
          <ActionButton
            icon={<ExternalLink className="size-4" />}
            label="Show here"
            description="Switch the main window to this overlay"
            onClick={() => onActivate?.(overlayId)}
          />
        </div>
      </section>

      {/* Per-window locking — one mechanism for every window */}
      <section>
        <SectionLabel>Windows &amp; Locking</SectionLabel>
        <p className="mb-2 text-[11px] text-muted">
          Lock a window to make it click-through and immovable — all mouse input
          passes to iRacing. Use Ctrl+Shift+L to toggle the focused window.
        </p>
        <div className="space-y-2">
          {rows.map((row) => (
            <WindowLockRow
              key={row.label}
              name={row.name}
              isCurrent={row.label === WINDOW_LABEL}
              locked={isLocked(row.label)}
              lockable={row.lockable}
              onToggle={() => setLock(row.label, !isLocked(row.label))}
            />
          ))}
        </div>
      </section>

      {/* Note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Each window remembers its own position, size and lock state. Closing a
          window keeps that state; reopening restores it exactly.
        </span>
      </div>
    </div>
  );
}

// ── WindowLockRow ─────────────────────────────────────────────────────────────

function WindowLockRow({
  name,
  isCurrent,
  locked,
  lockable,
  onToggle,
}: {
  name: string;
  isCurrent: boolean;
  locked: boolean;
  lockable: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        locked
          ? "border-accent/40 bg-accent/5"
          : "border-border bg-surface-2",
        !lockable && "opacity-50",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {locked ? (
        <Lock className="size-4 shrink-0 text-accent" />
      ) : (
        <Unlock className="size-4 shrink-0 text-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-text">
          <span className="truncate">{name}</span>
          {isCurrent && (
            <span className="rounded bg-surface px-1 text-[9px] uppercase tracking-wide text-muted">
              this
            </span>
          )}
        </div>
        <div className="mt-0.5 text-[11px]" style={{ color: locked ? "var(--color-accent)" : "var(--color-muted)" }}>
          {locked ? "Locked · click-through" : lockable ? "Unlocked" : "Enable overlay mode to lock"}
        </div>
      </div>
      <ToggleSwitch checked={locked} onChange={onToggle} disabled={!lockable} />
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

function ControlRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="flex-1">
        <div className="text-xs font-medium text-text">{label}</div>
        <div className="mt-0.5 text-[11px] text-muted">{description}</div>
      </div>
      {children}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-2 p-3 text-left transition-colors hover:border-accent/40 hover:bg-accent/5"
    >
      <span className="text-muted">{icon}</span>
      <span className="text-xs font-medium text-text">{label}</span>
      <span className="text-[10px] text-muted">{description}</span>
    </button>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-surface border border-border-strong",
        disabled && "cursor-not-allowed",
      ]
        .filter(Boolean)
        .join(" ")}
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
