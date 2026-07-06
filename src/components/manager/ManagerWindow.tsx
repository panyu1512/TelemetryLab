import { useState, useEffect, useRef } from "react";
import {
  Settings,
  Bug,
  Plus,
  ChevronDown,
  Copy,
  Pencil,
  Trash2,
  FileDown,
  Check,
  AppWindow,
  PanelTopClose,
} from "lucide-react";
import {
  DASHBOARDS,
  getDashboard,
  type DashboardDef,
  type WidgetDef,
} from "../../dashboards/registry";
import {
  useOverlayConfigStore,
  type Profile,
} from "../../stores/useOverlayConfigStore";
import { useActiveOverlaysStore } from "../../stores/useActiveOverlaysStore";
import { useWidgetSelectionStore } from "../../stores/useWidgetSelectionStore";
import { AppearancePanel } from "./AppearancePanel";
import { VisibilityPanel } from "./VisibilityPanel";
import { WindowPanel } from "./WindowPanel";
import { LivePreview } from "./LivePreview";
import { StandingsColumnsPanel } from "./StandingsColumnsPanel";
import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
import { DebugPanel } from "./DebugPanel";

// ── types ─────────────────────────────────────────────────────────────────────

type SidebarItem =
  | { kind: "overlay"; overlayId: string }
  | { kind: "global" }
  | { kind: "debug" };

// ── OverlayManager ──────────────────────────────────────────────────────────────

/**
 * The main window *is* the Overlay Manager — a dedicated surface for
 * configuring, previewing, opening, closing and tracking overlay windows. It is
 * not a modal and never behaves as an overlay itself.
 *
 * Layout: a left list of overlays + settings sections, and a main area that
 * shows the selected overlay's *entire* configuration inline on one scrolling
 * page — no dialogs, no tabs — with a live preview pinned alongside.
 */
export function OverlayManager() {
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

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ animation: "manager-in 160ms ease-out" }}
    >
      <ManagerHeader />

      {/* Body: sidebar + content */}
      <div className="flex min-h-0 flex-1">
        <Sidebar selected={selected} onSelect={selectItem} />

        <div className="flex min-h-0 flex-1 flex-col">
          {selected.kind === "overlay" && (
            <div className="flex min-h-0 flex-1">
              {/* One scrolling page with every setting for this overlay. */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <OverlayConfigPage overlayId={selected.overlayId} />
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
function OverlayConfigPage({ overlayId }: { overlayId: string }) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const dashboard = getDashboard(overlayId);
  const Icon = dashboard.icon;
  const isWidgetDashboard = dashboard.widgets.length > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-accent/10 text-accent">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-text">
            {dashboard.label}
          </h1>
          <p className="text-xs text-muted">
            {isWidgetDashboard
              ? "Enable widgets, then open them — each in its own window."
              : "Configure, preview and open this overlay — all on one page."}
          </p>
        </div>

        <EnableToggle
          enabled={settings.enabled}
          onChange={(v) => store.setOverlayEnabled(overlayId, v)}
        />
        {isWidgetDashboard ? (
          <DashboardWindowActions dashboard={dashboard} />
        ) : (
          <OverlayWindowAction overlayId={overlayId} label={dashboard.label} />
        )}
      </div>

      {isWidgetDashboard && (
        <ConfigSection
          title="Widgets"
          description="Choose which widgets to show. Open windows opens each enabled widget on its own."
        >
          <div className="space-y-2">
            {dashboard.widgets.map((w) => (
              <WidgetRow key={w.id} widget={w} />
            ))}
          </div>
        </ConfigSection>
      )}

      {overlayId === "standings" && (
        <ConfigSection
          title="Columns"
          description="Choose which timing columns the standings table shows."
        >
          <StandingsColumnsPanel />
        </ConfigSection>
      )}

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
        description="Position, size and click-through lock for this overlay's window."
      >
        <WindowPanel overlayId={overlayId} />
      </ConfigSection>
    </div>
  );
}

/** Open/close action for a single-window overlay (standings/relative/fuel). */
function OverlayWindowAction({
  overlayId,
  label,
}: {
  overlayId: string;
  label: string;
}) {
  const isOpen = useActiveOverlaysStore((s) => s.isOverlayOpen(overlayId));
  const openOverlay = useActiveOverlaysStore((s) => s.openOverlay);
  const closeOverlay = useActiveOverlaysStore((s) => s.closeOverlay);

  return isOpen ? (
    <button
      type="button"
      onClick={() => closeOverlay(overlayId)}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-danger/50 hover:text-danger"
    >
      <PanelTopClose className="size-3.5" />
      Close window
    </button>
  ) : (
    <button
      type="button"
      onClick={() => openOverlay(overlayId, label)}
      className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-bg transition-opacity hover:opacity-90"
    >
      <AppWindow className="size-3.5" />
      Open window
    </button>
  );
}

/**
 * Dashboard action: open every *enabled* widget, each in its own window, or
 * close the ones that are open. Never opens all widgets in a single window.
 */
function DashboardWindowActions({ dashboard }: { dashboard: DashboardDef }) {
  const windows = useActiveOverlaysStore((s) => s.windows);
  const enabledMap = useWidgetSelectionStore((s) => s.enabled);
  const openWidget = useActiveOverlaysStore((s) => s.openWidget);
  const closeWidget = useActiveOverlaysStore((s) => s.closeWidget);

  const openIds = new Set(
    windows.filter((w) => w.kind === "widget").map((w) => w.id)
  );
  const enabled = dashboard.widgets.filter((w) => enabledMap[w.id] !== false);
  const open = dashboard.widgets.filter((w) => openIds.has(w.id));

  const openAll = () => enabled.forEach((w) => openWidget(w.id, w.title));
  const closeAll = () => open.forEach((w) => closeWidget(w.id));

  return (
    <div className="flex items-center gap-2">
      {open.length > 0 && (
        <button
          type="button"
          onClick={closeAll}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-danger/50 hover:text-danger"
        >
          <PanelTopClose className="size-3.5" />
          Close {open.length}
        </button>
      )}
      <button
        type="button"
        onClick={openAll}
        disabled={enabled.length === 0}
        title={
          enabled.length === 0
            ? "Enable at least one widget first"
            : "Open each enabled widget in its own window"
        }
        className={[
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-opacity",
          enabled.length === 0
            ? "cursor-not-allowed bg-surface-2 text-muted"
            : "bg-accent text-bg hover:opacity-90",
        ].join(" ")}
      >
        <AppWindow className="size-3.5" />
        {open.length > 0 ? "Open windows" : `Open ${enabled.length} window${enabled.length === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

/**
 * A widget row: the toggle **enables/disables** the widget (a selection). It
 * doesn't open a window on its own — the dashboard's "Open windows" opens the
 * enabled ones. A dot shows whether that widget currently has a window open.
 */
function WidgetRow({ widget }: { widget: WidgetDef }) {
  const enabled = useWidgetSelectionStore((s) => s.isEnabled(widget.id));
  const toggle = useWidgetSelectionStore((s) => s.toggle);
  const open = useActiveOverlaysStore((s) => s.isWidgetOpen(widget.id));
  const Icon = widget.icon;

  return (
    <div
      className={[
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        enabled ? "border-accent/40 bg-accent/5" : "border-border bg-surface-2",
      ].join(" ")}
    >
      <Icon
        className={["size-4 shrink-0", enabled ? "text-accent" : "text-muted"].join(" ")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-text">{widget.title}</span>
          {open && (
            <span className="rounded bg-accent/15 px-1 py-0.5 text-[9px] uppercase tracking-wide text-accent">
              Open
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-muted">
          {widget.description}
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        title={enabled ? "Disable widget" : "Enable widget"}
        onClick={() => toggle(widget.id)}
        className={[
          "relative h-5 w-9 shrink-0 rounded-full transition-colors",
          enabled ? "bg-accent" : "bg-surface border border-border-strong",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-4 rounded-full bg-bg transition-[left]",
            enabled ? "left-[18px]" : "left-0.5",
          ].join(" ")}
        />
      </button>
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

function ManagerHeader() {
  return (
    <header className="flex h-12 flex-none items-center gap-4 border-b border-border px-4">
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted">
          iRacing Telemetry
        </span>
        <span className="text-muted/40">·</span>
        <span className="text-sm font-semibold text-text">
          Overlay Manager
        </span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ProfileSelector />
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
  const openWindows = useActiveOverlaysStore((s) => s.windows);
  const openOverlayIds = new Set(
    openWindows.filter((w) => w.kind === "overlay").map((w) => w.id)
  );
  // A widget dashboard is "open" when any of its widget windows are open.
  const anyWidgetOpen = openWindows.some((w) => w.kind === "widget");

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
          const open =
            d.widgets.length > 0 ? anyWidgetOpen : openOverlayIds.has(d.id);

          return (
            <OverlaySidebarItem
              key={d.id}
              dashboard={d}
              selected={isSelected}
              enabled={settings.enabled}
              open={open}
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
  open,
  onSelect,
  onToggleEnabled,
}: {
  dashboard: DashboardDef;
  selected: boolean;
  enabled: boolean;
  open: boolean;
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
        <span className="relative shrink-0">
          <Icon className="size-3.5" />
          {/* Active-window indicator dot. */}
          {open && (
            <span
              className="absolute -right-1 -top-1 size-1.5 rounded-full bg-accent ring-2 ring-bg"
              title="Window open"
            />
          )}
        </span>
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
  const openCount = useActiveOverlaysStore((s) => s.windows.length);

  return (
    <footer className="flex h-8 flex-none items-center gap-2 border-t border-border px-4">
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ background: "var(--color-accent)" }}
      />
      <span className="text-[11px] text-muted">Preview · mock data</span>
      <span className="ml-auto text-[11px] text-muted">
        {openCount === 0
          ? "No windows open"
          : `${openCount} window${openCount === 1 ? "" : "s"} open`}
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
