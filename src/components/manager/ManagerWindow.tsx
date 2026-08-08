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
import { PreviewCanvas } from "./PreviewCanvas";
import { StandingsColumnsPanel } from "./StandingsColumnsPanel";
import { StandingsViewPanel } from "./StandingsViewPanel";
import { RelativeOptionsPanel } from "./RelativeOptionsPanel";
import { GlobalSettingsPanel } from "./GlobalSettingsPanel";
import { DebugPanel } from "./DebugPanel";
import { Button, IconButton, ToggleSwitch } from "../ui/controls";

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
              {/* Every setting for this overlay on one page. On large screens
                  it's a fixed-width column so the preview canvas gets the rest
                  of the space; on small screens it takes over.

                  The control head is pinned outside the scroll container: the
                  one action that matters here — open or close this overlay's
                  window — must stay reachable when the Manager is opened onto
                  a half-scrolled panel mid-session. */}
              <div className="flex min-h-0 flex-1 flex-col lg:w-[480px] lg:flex-none">
                <OverlayControlHead overlayId={selected.overlayId} />
                <div className="min-h-0 flex-1 overflow-y-auto">
                  <OverlayConfigSections overlayId={selected.overlayId} />
                </div>
              </div>
              {/* Preview Canvas: the workspace fills the remaining space. */}
              <div className="hidden min-w-0 flex-1 border-l border-border lg:block">
                <PreviewCanvas
                  overlayId={selected.overlayId}
                  onSelect={(overlayId) =>
                    selectItem({ kind: "overlay", overlayId })
                  }
                />
              </div>
            </div>
          )}

          {selected.kind === "global" && (
            <div className="flex-1 overflow-y-auto p-8">
              <div className="mx-auto max-w-3xl">
                <PageTitle
                  title="Global Settings"
                  subtitle="Defaults that apply to every overlay and the telemetry bridge."
                />
                <GlobalSettingsPanel />
              </div>
            </div>
          )}

          {selected.kind === "debug" && (
            <div className="flex min-h-0 flex-1 flex-col p-8">
              <PageTitle
                title="Debug & Diagnostics"
                subtitle="Bridge connection, live session snapshot and log stream."
              />
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

function PageTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold tracking-tight text-text">
        {title}
      </h2>
      <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
    </div>
  );
}

// ── OverlayConfigPage ─────────────────────────────────────────────────────────

/**
 * The pinned control head for the selected overlay: what it is, whether it's
 * enabled, whether it currently has a window, and the open/close action.
 *
 * This band never scrolls. Everything below it is tuning; this is the part you
 * came for.
 */
function OverlayControlHead({ overlayId }: { overlayId: string }) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const dashboard = getDashboard(overlayId);
  const Icon = dashboard.icon;
  const isWidgetDashboard = dashboard.widgets.length > 0;

  const openWindows = useActiveOverlaysStore((s) => s.windows);
  const widgetIds = new Set(dashboard.widgets.map((w) => w.id));
  const openCount = isWidgetDashboard
    ? openWindows.filter((w) => w.kind === "widget" && widgetIds.has(w.id))
        .length
    : openWindows.filter((w) => w.kind === "overlay" && w.id === overlayId)
        .length;

  return (
    <div className="flex-none border-b border-border bg-surface/40 px-6 py-4">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-card border border-border bg-surface text-muted">
          <Icon className="size-5" />
        </span>
        <div className="min-w-[8rem] flex-1">
          <h1 className="truncate text-base font-semibold tracking-tight text-text">
            {dashboard.label}
          </h1>
          {/* The status line is mono: it reports machine state, not prose. */}
          <p className="tnum mt-0.5 font-mono text-[11px] tracking-tight">
            <span className={settings.enabled ? "text-muted" : "text-faint"}>
              {settings.enabled ? "enabled" : "disabled"}
            </span>
            <span className="text-faint"> · </span>
            <span className={openCount > 0 ? "text-primary" : "text-faint"}>
              {openCount === 0
                ? "no window"
                : `${openCount} window${openCount === 1 ? "" : "s"} open`}
            </span>
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
    </div>
  );
}

/**
 * Everything below the control head: the tuning sections, stacked inline on
 * one scrolling page — no dialogs, no tabs.
 */
function OverlayConfigSections({ overlayId }: { overlayId: string }) {
  const dashboard = getDashboard(overlayId);
  const isWidgetDashboard = dashboard.widgets.length > 0;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-10 pt-6">
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
          title="View"
          description="How the field is grouped, and whether the table follows your row."
        >
          <StandingsViewPanel />
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

      {overlayId === "relative" && (
        <ConfigSection
          title="Options"
          description="What each row of the relative shows."
        >
          <RelativeOptionsPanel />
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
    <Button
      variant="danger"
      icon={<PanelTopClose className="size-3.5" />}
      onClick={() => closeOverlay(overlayId)}
    >
      Close window
    </Button>
  ) : (
    <Button
      variant="primary"
      icon={<AppWindow className="size-3.5" />}
      onClick={() => openOverlay(overlayId, label)}
    >
      Open window
    </Button>
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
        <Button
          variant="danger"
          icon={<PanelTopClose className="size-3.5" />}
          onClick={closeAll}
        >
          Close {open.length}
        </Button>
      )}
      <Button
        variant="primary"
        icon={<AppWindow className="size-3.5" />}
        disabled={enabled.length === 0}
        title={
          enabled.length === 0
            ? "Enable at least one widget first"
            : "Open each enabled widget in its own window"
        }
        onClick={openAll}
      >
        {open.length > 0
          ? "Open windows"
          : `Open ${enabled.length} window${enabled.length === 1 ? "" : "s"}`}
      </Button>
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
        "flex items-center gap-3 rounded-card border px-3 py-2.5 transition-colors",
        enabled
          ? "border-border bg-surface"
          : "border-border/60 bg-transparent",
      ].join(" ")}
    >
      <Icon
        className={["size-4 shrink-0", enabled ? "text-muted" : "text-faint"].join(" ")}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={[
              "text-xs font-medium",
              enabled ? "text-text" : "text-faint",
            ].join(" ")}
          >
            {widget.title}
          </span>
          {open && (
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-primary">
              <span aria-hidden className="size-1 rounded-full bg-primary" />
              Open
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-faint">
          {widget.description}
        </div>
      </div>
      <ToggleSwitch
        checked={enabled}
        onChange={() => toggle(widget.id)}
        title={enabled ? "Disable widget" : "Enable widget"}
      />
    </div>
  );
}

/**
 * A tuning section.
 *
 * The divider is a rule that runs from the heading and fades out to the right
 * — the same `.header-rule` idiom the widget headers use — rather than a
 * full-width border above every block. It reads as a panel legend instead of
 * a stack of identical horizontal bands, and it ties the Manager's chrome to
 * the vocabulary the overlays already speak.
 */
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
    <section className="pt-8 first:pt-0">
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <h2 className="whitespace-nowrap text-sm font-semibold tracking-tight text-text">
            {title}
          </h2>
          <span className="header-rule" aria-hidden />
        </div>
        <p className="mt-1 max-w-prose text-xs text-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The enable switch in the control head.
 *
 * Draws its own track rather than wrapping a `ToggleSwitch`: nesting one
 * button inside another is invalid markup, and it left the label and the
 * switch as two separate tab stops for the same single control.
 */
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
      className="flex items-center gap-2 whitespace-nowrap rounded-ctl border border-border bg-surface-2 px-2.5 py-1.5 transition-colors hover:border-border-strong active:brightness-95"
    >
      <span
        className={[
          "text-xs font-medium",
          enabled ? "text-text" : "text-faint",
        ].join(" ")}
      >
        {enabled ? "Enabled" : "Disabled"}
      </span>
      <span
        aria-hidden
        className={[
          "relative h-4 w-7 shrink-0 rounded-full transition-colors",
          enabled
            ? "bg-primary"
            : "border border-border-strong bg-surface",
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-0.5 size-3 rounded-full bg-text shadow-sm transition-[left]",
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
      <span className="text-sm font-semibold tracking-tight text-text">
        Overlay Manager
      </span>

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
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 whitespace-nowrap rounded-ctl border border-border bg-surface-2 px-3 py-1.5 text-xs transition-colors hover:border-border-strong active:brightness-95"
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
          Profile
        </span>
        <span className="max-w-32 truncate font-medium text-text">
          {activeProfile?.name ?? "Default"}
        </span>
        <ChevronDown className="size-3 text-faint" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-10 mt-1.5 w-64 overflow-hidden rounded-panel border border-border bg-surface"
          style={{ boxShadow: "var(--shadow-float)" }}
        >
          {/* Profile list */}
          <div className="max-h-52 overflow-y-auto p-1">
            {profiles.map((p) => (
              <div
                key={p.id}
                className={[
                  "group flex items-center gap-1 rounded-ctl px-2 py-1.5 transition-colors",
                  p.id === activeProfileId
                    ? "bg-primary/10 text-primary"
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
                      className="flex-1 rounded-ctl border border-primary bg-bg px-1.5 py-0.5 text-xs text-text"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    className="flex-1 truncate text-left text-xs font-medium"
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
                  <IconButton
                    size="sm"
                    icon={<Pencil className="size-2.5" />}
                    title="Rename"
                    onClick={() => startRename(p)}
                  />
                  <IconButton
                    size="sm"
                    icon={<Copy className="size-2.5" />}
                    title="Duplicate"
                    onClick={() => store.duplicateProfile(p.id, `${p.name} copy`)}
                  />
                  <IconButton
                    size="sm"
                    icon={<FileDown className="size-2.5" />}
                    title="Export"
                    onClick={() => handleExport(p.id)}
                  />
                  {profiles.length > 1 && (
                    <IconButton
                      size="sm"
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
                  className="flex-1 rounded-ctl border border-primary bg-bg px-1.5 py-0.5 text-xs text-text placeholder:text-faint"
                />
                <button
                  type="submit"
                  className="grid size-5 place-items-center rounded-ctl bg-primary/20 text-primary"
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
    <aside className="flex w-56 flex-none flex-col border-r border-border">
      {/* Overlay catalog */}
      <div className="flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
          Overlays
        </p>
        <div className="space-y-0.5">
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
      </div>

      {/* Bottom nav */}
      <div className="space-y-0.5 border-t border-border p-3">
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

  /*
   * The rail carries *liveness*, not selection — the two used to share it, so
   * a blue bar could mean either "you're looking at this" or "this is on
   * screen right now". Selection is the filled row; the rail is a three-state
   * readout you can take in without reading a single word:
   *
   *   transparent  → disabled
   *   border       → enabled, no window
   *   primary      → window open over the game
   */
  const rail = open
    ? "bg-primary"
    : enabled
      ? "bg-border-strong"
      : "bg-transparent";

  return (
    <div
      className={[
        "group flex items-center gap-2 rounded-ctl py-2 pl-1 pr-2 transition-colors",
        selected
          ? "bg-surface-2 text-text"
          : enabled
            ? "text-muted hover:bg-surface hover:text-text"
            : "text-faint hover:bg-surface",
      ].join(" ")}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        onClick={onSelect}
        aria-current={selected ? "page" : undefined}
      >
        <span
          aria-hidden
          className={[
            "h-5 w-[3px] shrink-0 rounded-full transition-colors",
            rail,
          ].join(" ")}
        />
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate text-xs font-medium">{dashboard.label}</span>
        {/* The rail is the glanceable channel; this is the same fact spelled
            out for screen readers and for anyone who can't rely on color. */}
        <span className="sr-only">
          {enabled ? "enabled" : "disabled"}
          {open ? ", window open" : ""}
        </span>
      </button>

      {/* Enable/disable toggle */}
      <ToggleSwitch
        size="sm"
        checked={enabled}
        onChange={onToggleEnabled}
        title={enabled ? "Disable overlay" : "Enable overlay"}
      />
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
        "flex w-full items-center gap-2.5 rounded-ctl px-2.5 py-2 text-xs font-medium transition-colors",
        selected
          ? "bg-surface-2 text-text"
          : "text-muted hover:bg-surface hover:text-text",
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

// ── ManagerFooter ─────────────────────────────────────────────────────────────

/**
 * The status strip: one mono line of what the Manager actually knows.
 *
 * Deliberately *not* a bridge-connection readout. The Manager never opens a
 * bridge — it drives its own stores from `MockFeed` so the preview can render
 * real overlay components offline (see `App`). `useBridgeStore` therefore
 * always reports "connected, session active" in this window, which would make
 * a connection indicator here permanently green and permanently meaningless.
 * The overlay windows each own a real connection; Debug & Diagnostics is where
 * that state is genuinely reported.
 *
 * What this strip can honestly say is how much is armed and how much is on
 * screen — which is also the pair worth knowing at a glance mid-session.
 */
function ManagerFooter() {
  const openCount = useActiveOverlaysStore((s) => s.windows.length);
  const enabledCount = useOverlayConfigStore(
    (s) => DASHBOARDS.filter((d) => s.getOverlaySettings(d.id).enabled).length
  );

  return (
    <footer className="flex h-8 flex-none items-center gap-2 border-t border-border bg-surface px-4">
      <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full bg-primary" />
      <span className="truncate font-mono text-[11px] tracking-tight text-faint">
        preview · mock data
      </span>
      <span className="tnum ml-auto shrink-0 font-mono text-[11px] text-faint">
        {enabledCount}/{DASHBOARDS.length} enabled
        <span className="mx-1.5 text-border-strong">·</span>
        {openCount === 0
          ? "no windows"
          : `${openCount} window${openCount === 1 ? "" : "s"}`}
      </span>
    </footer>
  );
}

// ── utility components ────────────────────────────────────────────────────────

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
      className="flex w-full items-center justify-center gap-1.5 rounded-ctl px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      {icon}
      {label}
    </button>
  );
}
