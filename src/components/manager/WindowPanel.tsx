import { ExternalLink, Lock, Unlock, Info, AppWindow } from "lucide-react";
import { useOverlayStore } from "../../stores/useOverlayStore";
import { getDashboard } from "../../dashboards/registry";
import { openOverlayWindow } from "../../lib/overlayWindows";

interface WindowPanelProps {
  overlayId: string;
  onActivate?: (overlayId: string) => void;
}

export function WindowPanel({ overlayId, onActivate }: WindowPanelProps) {
  const { overlayMode, locked, setOverlayMode, setLocked } = useOverlayStore();
  const dashboard = getDashboard(overlayId);

  return (
    <div className="space-y-6">
      {/* Current window state */}
      <section>
        <SectionLabel>Window State</SectionLabel>
        <div className="space-y-2">
          <ControlRow
            label="Overlay Mode"
            description="Makes the window always-on-top with a transparent background, rendering over iRacing."
          >
            <ToggleSwitch
              checked={overlayMode}
              onChange={setOverlayMode}
            />
          </ControlRow>

          <ControlRow
            label="Locked"
            description="Enables click-through so all mouse input reaches iRacing. Use Ctrl+Shift+L to toggle quickly."
            disabled={!overlayMode}
          >
            <ToggleSwitch
              checked={locked}
              onChange={setLocked}
              disabled={!overlayMode}
            />
          </ControlRow>
        </div>
      </section>

      {/* Quick actions */}
      <section>
        <SectionLabel>Quick Actions</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          <ActionButton
            icon={<AppWindow className="size-4" />}
            label="Open in new window"
            description="Pop this overlay out into its own separate window"
            onClick={() => openOverlayWindow(overlayId, dashboard.label)}
          />
          <ActionButton
            icon={<ExternalLink className="size-4" />}
            label="Show here"
            description="Switch the main window to this overlay"
            onClick={() => onActivate?.(overlayId)}
          />
          <ActionButton
            icon={overlayMode && locked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
            label={overlayMode && locked ? "Unlock" : "Lock"}
            description={
              overlayMode
                ? "Toggle click-through mode (Ctrl+Shift+L)"
                : "Enable overlay mode first"
            }
            disabled={!overlayMode}
            onClick={() => setLocked(!locked)}
          />
        </div>
      </section>

      {/* Window position info */}
      <section>
        <SectionLabel>Position &amp; Size</SectionLabel>
        <WindowBoundsDisplay />
      </section>

      {/* Overlay info */}
      <section>
        <SectionLabel>Overlay Info</SectionLabel>
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs">
          <div className="space-y-1.5">
            <KV label="ID" value={dashboard.id} />
            <KV label="Label" value={dashboard.label} />
            <KV
              label="Type"
              value={
                dashboard.Screen
                  ? "Full-screen overlay"
                  : "Widget grid"
              }
            />
          </div>
        </div>
      </section>

      {/* Multi-window note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          <span className="text-text">Open in new window</span> pops this overlay
          out on its own. On the desktop app it becomes a separate always-on-top
          window you can position and size independently; in a browser it opens
          in a new tab. Each window remembers its own layout.
        </span>
      </div>
    </div>
  );
}

// ── WindowBoundsDisplay ───────────────────────────────────────────────────────

function WindowBoundsDisplay() {
  // In the future this will show live Tauri window bounds.
  // For now, show the current viewport size.
  const w = window.innerWidth;
  const h = window.innerHeight;

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted">Width</div>
        <div className="mt-0.5 font-mono text-sm text-text">{w}px</div>
      </div>
      <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
        <div className="text-[10px] uppercase tracking-wide text-muted">Height</div>
        <div className="mt-0.5 font-mono text-sm text-text">{h}px</div>
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

function ControlRow({
  label,
  description,
  disabled = false,
  children,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5",
        disabled && "opacity-40",
      ]
        .filter(Boolean)
        .join(" ")}
    >
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
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
        disabled
          ? "border-border bg-surface-2 opacity-40 cursor-not-allowed"
          : "border-border bg-surface-2 hover:border-accent/40 hover:bg-accent/5",
      ].join(" ")}
    >
      <span className="text-muted">{icon}</span>
      <span className="text-xs font-medium text-text">{label}</span>
      <span className="text-[10px] text-muted">{description}</span>
    </button>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-12 shrink-0 text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="font-mono text-text">{value}</span>
    </div>
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
