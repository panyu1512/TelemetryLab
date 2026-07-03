import { useState, useEffect, useRef } from "react";
import {
  X,
  Settings,
  Bug,
  Plus,
  ChevronDown,
  Copy,
  Pencil,
  Trash2,
  FileDown,
  Check,
} from "lucide-react";
import {
  DASHBOARDS,
  getDashboard,
  type DashboardDef,
} from "../../dashboards/registry";
import {
  useOverlayConfigStore,
  type Profile,
} from "../../stores/useOverlayConfigStore";
import { useBridgeStore } from "../../stores/useBridgeStore";
import { AppearancePanel } from "./AppearancePanel";
import { VisibilityPanel } from "./VisibilityPanel";
import { WindowPanel } from "./WindowPanel";
import { LivePreview } from "./LivePreview";
import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
import { DebugPanel } from "./DebugPanel";

// ── types ─────────────────────────────────────────────────────────────────────

type SidebarItem =
  | { kind: "overlay"; overlayId: string }
  | { kind: "global" }
  | { kind: "debug" };

// ── ManagerWindow ──────────────────────────────────────────────────────────────

interface ManagerWindowProps {
  onClose: () => void;
  onActivateOverlay?: (overlayId: string) => void;
}

/**
 * The overlay configuration surface, laid out as a single full-window page
 * (not a modal): a left list of overlays + settings sections, and a main area
 * that shows the selected overlay's *entire* configuration inline on one
 * scrolling page — no dialogs, no tabs. This mirrors dedicated overlay editors
 * like Kapps, where everything for an overlay is set up in one place.
 */
export function ManagerWindow({ onClose, onActivateOverlay }: ManagerWindowProps) {
  const setLastOverlay = useOverlayConfigStore((s) => s.setLastOverlay);
  // Reopen on the overlay the user last edited (persisted), falling back to the
  // first overlay if the stored id is unknown.
  const [selected, setSelected] = useState<SidebarItem>(() => {
    const last = useOverlayConfigStore.getState().lastOverlayId;
    const overlayId = DASHBOARDS.some((d) => d.id === last)
      ? (last as string)
      : DASHBOARDS[0].id;
    return { kind: "overlay", overlayId };
  });

  const selectItem = (item: SidebarItem) => {
    setSelected(item);
    if (item.kind === "overlay") setLastOverlay(item.overlayId);
  };

  // Close on Escape (App.tsx also handles this, but belt-and-suspenders)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-bg"
      style={{ animation: "manager-in 160ms ease-out" }}
    >
      <ManagerHeader onClose={onClose} />

      {/* Body: sidebar + content */}
      <div className="flex min-h-0 flex-1">
        <Sidebar selected={selected} onSelect={selectItem} />

        <div className="flex min-h-0 flex-1 flex-col">
          {selected.kind === "overlay" && (
            <div className="flex min-h-0 flex-1">
              {/* One scrolling page with every setting for this overlay. */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <OverlayConfigPage
                  overlayId={selected.overlayId}
                  onActivate={onActivateOverlay}
                />
              </div>
              {/* Live preview, pinned alongside. */}
              <div className="hidden w-80 flex-none border-l border-border bg-surface p-4 lg:block">
                <LivePreview overlayId={selected.overlayId} />
              </div>
            </div>
          )}

          {selected.kind === "global" && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mx-auto max-w-3xl">
                <h2 className="mb-4 text-sm font-semibold text-text">
                  Global Settings
                </h2>
                <GlobalSettingsPanel />
              </div>
            </div>
          )}

          {selected.kind === "debug" && (
            <div className="flex min-h-0 flex-1 flex-col p-6">
              <h2 className="mb-4 text-sm font-semibold text-text">
                Debug &amp; Diagnostics
              </h2>
              <div className="min-h-0 flex-1">
                <DebugPanel />
              </div>
            </div>
          )}
        </div>
      </div>

      <ManagerFooter />
    </div>
  );
}

// ── OverlayConfigPage ─────────────────────────────────────────────────────────

/**
 * The full configuration for a single overlay, stacked inline on one page:
 * a header (name + enable), then Appearance, Visibility and Window sections —
 * everything visible and editable without switching tabs or opening dialogs.
 */
function OverlayConfigPage({
  overlayId,
  onActivate,
}: {
  overlayId: string;
  onActivate?: (overlayId: string) => void;
}) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const dashboard = getDashboard(overlayId);
  const Icon = dashboard.icon;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-text">
            {dashboard.label}
          </h1>
          <p className="text-xs text-muted">
            Appearance, visibility and window behaviour — all on one page.
          </p>
        </div>
        <EnableToggle
          enabled={settings.enabled}
          onChange={(v) => store.setOverlayEnabled(overlayId, v)}
        />
      </div>

      <ConfigSection
        title="Appearance"
        description="Theme, saturation, brightness and opacity for this overlay."
      >
        <AppearancePanel overlayId={overlayId} />
      </ConfigSection>

      <ConfigSection
        title="Visibility"
        description="Automatically hide the overlay in certain session conditions."
      >
        <VisibilityPanel overlayId={overlayId} />
      </ConfigSection>

      <ConfigSection
        title="Window & Locking"
        description="Open this overlay in its own window and lock any window."
      >
        <WindowPanel overlayId={overlayId} onActivate={onActivate} />
      </ConfigSection>
    </div>
  );
}

function ConfigSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-6">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EnableToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 transition-colors hover:border-border-strong"
    >
      <span className="text-xs font-medium text-text">
        {enabled ? "Enabled" : "Disabled"}
      </span>
      <span
        className={[
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          enabled ? "bg-accent" : "bg-surface border border-border-strong",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-3 rounded-full bg-bg transition-[left]",
            enabled ? "left-[14px]" : "left-0.5",
          ].join(" ")}
        />
      </span>
    </button>
  );
}

// ── ManagerHeader ─────────────────────────────────────────────────────────────

function ManagerHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="flex h-12 flex-none items-center gap-4 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted">
          iRacing Telemetry
        </span>
        <span className="text-muted/40">·</span>
        <span className="text-sm font-semibold text-text">
          Overlay Editor
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ProfileSelector />
        <button
          type="button"
          onClick={onClose}
          title="Back to overlay (Esc)"
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-border-strong"
        >
          <X className="size-3.5" />
          Done
        </button>
      </div>
    </header>
  );
}

// ── ProfileSelector ────────────────────────────────────────────────────────────

function ProfileSelector() {
  const store = useOverlayConfigStore();
  const { profiles, activeProfileId } = store;
  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const startRename = (profile: Profile) => {
    setRenaming(profile.id);
    setRenameValue(profile.name);
  };

  const commitRename = () => {
    if (renaming && renameValue.trim()) {
      store.renameProfile(renaming, renameValue.trim());
    }
    setRenaming(null);
  };

  const commitCreate = () => {
    if (newName.trim()) {
      store.createProfile(newName.trim());
    }
    setCreating(false);
    setNewName("");
  };

  const handleExport = (id: string) => {
    const json = store.exportProfile(id);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const name = profiles.find((p) => p.id === id)?.name ?? id;
    a.download = `telemetrylab-profile-${name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs transition-colors hover:border-border-strong"
      >
        <span className="max-w-32 truncate text-text">
          {activeProfile?.name ?? "Default"}
        </span>
        <ChevronDown className="size-3 text-muted" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl">
          {/* Profile list */}
          <div className="max-h-52 overflow-y-auto p-1">
            {profiles.map((p) => (
              <div
                key={p.id}
                className={[
                  "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition-colors",
                  p.id === activeProfileId
                    ? "bg-accent/10 text-accent"
                    : "hover:bg-surface-2",
                ].join(" ")}
              >
                {renaming === p.id ? (
                  <form
                    className="flex flex-1 items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      commitRename();
                    }}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitRename}
                      className="flex-1 rounded border border-accent bg-bg px-1.5 py-0.5 text-xs text-text outline-none"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-xs"
                    onClick={() => {
                      store.setActiveProfile(p.id);
                      setOpen(false);
                    }}
                  >
                    {p.name}
                  </button>
                )}

                {/* Profile actions (shown on hover) */}
                <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                  <IconBtn
                    icon={<Pencil className="size-2.5" />}
                    title="Rename"
                    onClick={() => startRename(p)}
                  />
                  <IconBtn
                    icon={<Copy className="size-2.5" />}
                    title="Duplicate"
                    onClick={() => store.duplicateProfile(p.id, `${p.name} copy`)}
                  />
                  <IconBtn
                    icon={<FileDown className="size-2.5" />}
                    title="Export"
                    onClick={() => handleExport(p.id)}
                  />
                  {profiles.length > 1 && (
                    <IconBtn
                      icon={<Trash2 className="size-2.5" />}
                      title="Delete"
                      danger
                      onClick={() => store.deleteProfile(p.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border p-1">
            {creating ? (
              <form
                className="flex items-center gap-1 px-2 py-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitCreate();
                }}
              >
                <input
                  autoFocus
                  placeholder="Profile name…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={commitCreate}
                  className="flex-1 rounded border border-accent bg-bg px-1.5 py-0.5 text-xs text-text outline-none placeholder:text-muted"
                />
                <button
                  type="submit"
                  className="grid size-5 place-items-center rounded bg-accent/20 text-accent"
                >
                  <Check className="size-3" />
                </button>
              </form>
            ) : (
              <MenuAction
                icon={<Plus className="size-3" />}
                label="New profile"
                onClick={() => setCreating(true)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({
  selected,
  onSelect,
}: {
  selected: SidebarItem;
  onSelect: (item: SidebarItem) => void;
}) {
  const store = useOverlayConfigStore();

  return (
    <aside className="flex w-52 flex-none flex-col border-r border-border bg-bg">
      {/* Overlay catalog */}
      <div className="flex-1 overflow-y-auto p-2">
        <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Overlays
        </p>
        {DASHBOARDS.map((d) => {
          const isSelected =
            selected.kind === "overlay" && selected.overlayId === d.id;
          const settings = store.getOverlaySettings(d.id);

          return (
            <OverlaySidebarItem
              key={d.id}
              dashboard={d}
              selected={isSelected}
              enabled={settings.enabled}
              onSelect={() => onSelect({ kind: "overlay", overlayId: d.id })}
              onToggleEnabled={() =>
                store.setOverlayEnabled(d.id, !settings.enabled)
              }
            />
          );
        })}
      </div>

      {/* Bottom nav */}
      <div className="border-t border-border p-2">
        <NavItem
          icon={<Settings className="size-3.5" />}
          label="Global Settings"
          selected={selected.kind === "global"}
          onClick={() => onSelect({ kind: "global" })}
        />
        <NavItem
          icon={<Bug className="size-3.5" />}
          label="Debug"
          selected={selected.kind === "debug"}
          onClick={() => onSelect({ kind: "debug" })}
        />
      </div>
    </aside>
  );
}

function OverlaySidebarItem({
  dashboard,
  selected,
  enabled,
  onSelect,
  onToggleEnabled,
}: {
  dashboard: DashboardDef;
  selected: boolean;
  enabled: boolean;
  onSelect: () => void;
  onToggleEnabled: () => void;
}) {
  const Icon = dashboard.icon;
  return (
    <div
      className={[
        "group flex items-center gap-2 rounded-lg px-2 py-2 transition-colors",
        selected
          ? "bg-accent/10 text-accent"
          : enabled
            ? "text-text hover:bg-surface-2"
            : "text-muted hover:bg-surface-2",
      ].join(" ")}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onSelect}
      >
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate text-xs font-medium">{dashboard.label}</span>
      </button>

      {/* Enable/disable toggle */}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={(e) => {
          e.stopPropagation();
          onToggleEnabled();
        }}
        title={enabled ? "Disable overlay" : "Enable overlay"}
        className={[
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          enabled
            ? selected
              ? "bg-accent"
              : "bg-accent/60"
            : "bg-surface-2 border border-border-strong",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-3 rounded-full bg-bg transition-[left]",
            enabled ? "left-[14px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function NavItem({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs transition-colors",
        selected
          ? "bg-accent/10 text-accent"
          : "text-muted hover:bg-surface-2 hover:text-text",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

// ── ManagerFooter ─────────────────────────────────────────────────────────────

function ManagerFooter() {
  const { socketConnected, iracingActive } = useBridgeStore();

  let label: string;
  let color: string;
  if (!socketConnected) {
    label = "Connecting to bridge…";
    color = "var(--color-warning)";
  } else if (!iracingActive) {
    label = "Waiting for iRacing…";
    color = "var(--color-muted)";
  } else {
    label = "Live";
    color = "var(--color-accent)";
  }

  return (
    <footer className="flex h-8 flex-none items-center gap-2 border-t border-border px-4">
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ background: color }}
      />
      <span className="text-[11px]" style={{ color }}>
        {label}
      </span>
      <span className="ml-auto text-[11px] text-muted">
        Press Esc to close
      </span>
    </footer>
  );
}

// ── utility components ────────────────────────────────────────────────────────

function IconBtn({
  icon,
  title,
  danger = false,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        "grid size-5 place-items-center rounded transition-colors",
        danger
          ? "text-muted hover:bg-danger/15 hover:text-danger"
          : "text-muted hover:bg-surface hover:text-text",
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

function MenuAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      {icon}
      {label}
    </button>
  );
}
