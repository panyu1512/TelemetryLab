import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  ChevronDown,
  Grid3x3,
  Maximize,
  Minimize,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import {
  capturePreset,
  loadPresets,
  planPresetLoad,
  removePreset,
  savePresets,
  upsertPreset,
  type LayoutPreset,
} from "../../../lib/layoutPresets";
import { applyWindowBounds, applyWindowScale } from "../../../lib/windowControl";
import { broadcast, subscribe } from "../../../lib/windowBus";
import { getWindowState, replaceWindowState } from "../../../lib/windowState";
import { useActiveOverlaysStore } from "../../../stores/useActiveOverlaysStore";
import { useWindowStore } from "../../../stores/useWindowStore";
import { Button, Segmented, SegmentedButton, ToggleSwitch } from "../../ui/controls";
import { BACKDROPS, type Backdrop } from "../PreviewCanvas";
import { Inspector } from "./Inspector";
import { MonitorCanvas } from "./MonitorCanvas";
import { LAYOUT_TARGETS, getTarget } from "./targets";
import { useLayoutState, type LayoutItem, type LayoutState } from "./useLayoutState";

const PREFS_KEY = "telemetrylab.layout-editor.v1";

interface EditorPrefs {
  snap: boolean;
  backdrop: Backdrop;
  showClosed: boolean;
}

function readPrefs(): EditorPrefs {
  const fallback: EditorPrefs = { snap: true, backdrop: "asphalt", showClosed: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<EditorPrefs>) } : fallback;
  } catch {
    return fallback;
  }
}

/**
 * The Layout editor: the monitor as a canvas with every overlay and widget
 * window on it, live, where it really sits. Drag to move, pull an edge to
 * resize, fine-tune in the inspector, save the whole arrangement as a preset.
 * Every change moves the real window as it happens.
 */
export function MonitorEditor() {
  const layout = useLayoutState();
  const [selected, setSelected] = useState<string | null>(null);
  const [monitorIndex, setMonitorIndex] = useState(0);
  const [prefs, setPrefs] = useState(readPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // Selecting a window on another monitor shows that monitor.
  const selectedItem = layout.items.find((i) => i.label === selected);
  useEffect(() => {
    if (selectedItem && selectedItem.monitorIndex !== monitorIndex) {
      setMonitorIndex(selectedItem.monitorIndex);
    }
  }, [selectedItem, monitorIndex]);

  const monitor = layout.monitors[monitorIndex] ?? layout.monitors[0];
  const screen = layout.screens[monitorIndex] ?? layout.screens[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Head */}
      <div className="flex flex-none flex-wrap items-end gap-x-6 gap-y-3 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h1 className="display-title text-2xl text-text">
            Layout <span className="text-primary">editor</span>
          </h1>
          <p className="mt-1 text-xs text-muted">
            Drag to move, pull an edge or corner to resize. Changes apply to
            the open windows live.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PresetMenu layout={layout} />
          <Button
            icon={<Minimize className="size-3.5" />}
            title="Every window at 85 % content scale"
            onClick={() => layout.items.forEach((i) => layout.setScale(i, 0.85))}
          >
            All compact
          </Button>
          <Button
            icon={<Maximize className="size-3.5" />}
            title="Every window at 125 % content scale"
            onClick={() => layout.items.forEach((i) => layout.setScale(i, 1.25))}
          >
            All large
          </Button>
          <ResetLayoutButton layout={layout} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-none flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-surface/40 px-6 py-2">
        {layout.monitors.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="label-caps">Monitor</span>
            <Segmented>
              {layout.monitors.map((_m, i) => (
                <SegmentedButton
                  key={i}
                  active={i === monitorIndex}
                  onClick={() => setMonitorIndex(i)}
                >
                  {i + 1}
                  {i === 0 && <span className="text-faint">primary</span>}
                </SegmentedButton>
              ))}
            </Segmented>
          </div>
        )}
        <span className="tnum font-mono text-small text-faint">
          {screen.width}×{screen.height}
          {monitor.scaleFactor !== 1 && ` @${Math.round(monitor.scaleFactor * 100)}%`}
        </span>
        <label className="flex items-center gap-2 text-small font-medium text-muted">
          <Grid3x3 className="size-3.5" />
          Snap to grid
          <ToggleSwitch
            size="sm"
            checked={prefs.snap}
            onChange={(snap) => setPrefs((p) => ({ ...p, snap }))}
          />
        </label>
        <label className="flex items-center gap-2 text-small font-medium text-muted">
          Show closed
          <ToggleSwitch
            size="sm"
            checked={prefs.showClosed}
            onChange={(showClosed) => setPrefs((p) => ({ ...p, showClosed }))}
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          <span className="label-caps">Behind</span>
          <Segmented>
            {(Object.keys(BACKDROPS) as Backdrop[]).map((b) => (
              <SegmentedButton
                key={b}
                active={prefs.backdrop === b}
                onClick={() => setPrefs((p) => ({ ...p, backdrop: b }))}
              >
                {BACKDROPS[b].label}
              </SegmentedButton>
            ))}
          </Segmented>
        </div>
      </div>

      {/* Body: modules · canvas · inspector */}
      <div className="flex min-h-0 flex-1">
        <ModuleList layout={layout} selected={selected} onSelect={setSelected} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MonitorCanvas
            layout={layout}
            monitor={monitor}
            monitorIndex={monitorIndex}
            selected={selected}
            onSelect={setSelected}
            snapOn={prefs.snap}
            backdrop={prefs.backdrop}
            showClosed={prefs.showClosed}
          />
          <p className="flex-none border-t border-border px-4 py-2 text-small text-faint">
            Live preview with mock data. Faded boxes are closed windows — place
            them now and they open right there.
          </p>
        </div>
        <aside className="w-72 flex-none border-l border-border bg-surface/30">
          <Inspector layout={layout} item={selectedItem} />
        </aside>
      </div>
    </div>
  );
}

/** Every window, with a switch that opens or closes it. */
function ModuleList({
  layout,
  selected,
  onSelect,
}: {
  layout: LayoutState;
  selected: string | null;
  onSelect: (label: string) => void;
}) {
  const active = useActiveOverlaysStore();
  const groups: [string, LayoutItem[]][] = [
    ["Overlays", layout.items.filter((i) => i.kind === "overlay")],
    ["Widgets", layout.items.filter((i) => i.kind === "widget")],
  ];

  const toggle = (item: LayoutItem, open: boolean) => {
    if (item.kind === "overlay") {
      if (open) active.openOverlay(item.id, item.title);
      else active.closeOverlay(item.id);
    } else if (open) active.openWidget(item.id, item.title);
    else active.closeWidget(item.id);
  };

  return (
    <aside className="w-56 flex-none overflow-y-auto border-r border-border p-3">
      {groups.map(([title, items]) => (
        <div key={title} className="mb-4">
          <p className="label-caps mb-2 px-2">{title}</p>
          <div className="space-y-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const isSel = item.label === selected;
              return (
                <div
                  key={item.label}
                  className={[
                    "flex items-center gap-2 rounded-ctl py-1.5 pl-2 pr-1.5 transition-colors",
                    isSel ? "bg-primary/10 text-text" : "text-muted hover:bg-surface hover:text-text",
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(item.label)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <Icon className={["size-3.5 shrink-0", isSel ? "text-primary" : ""].join(" ")} />
                    <span className="truncate text-xs font-medium">{item.title}</span>
                  </button>
                  <ToggleSwitch
                    size="sm"
                    checked={item.open}
                    title={item.open ? "Close window" : "Open window"}
                    onChange={(v) => toggle(item, v)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
}

/** Reset needs a second click within a few seconds — it forgets everything. */
function ResetLayoutButton({ layout }: { layout: LayoutState }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <Button
      variant="danger"
      icon={<RotateCcw className="size-3.5" />}
      title="Forget every window's position and scale"
      onClick={() => {
        if (!armed) return setArmed(true);
        setArmed(false);
        for (const t of LAYOUT_TARGETS) layout.resetItem(t.label);
      }}
    >
      {armed ? "Click again to reset" : "Reset layout"}
    </Button>
  );
}

// ── presets ───────────────────────────────────────────────────────────────────

function usePresets() {
  const [presets, setPresets] = useState<LayoutPreset[]>(() => loadPresets(localStorage));
  useEffect(
    () => subscribe("layout-presets:changed", () => setPresets(loadPresets(localStorage))),
    []
  );
  const commit = (next: LayoutPreset[]) => {
    savePresets(localStorage, next);
    setPresets(next);
    broadcast("layout-presets:changed", null);
  };
  return { presets, commit };
}

function PresetMenu({ layout }: { layout: LayoutState }) {
  const { presets, commit } = usePresets();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const active = useActiveOverlaysStore();
  const setLock = useWindowStore((s) => s.setLock);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const openLabels = useMemo(
    () => new Set(layout.items.filter((i) => i.open).map((i) => i.label)),
    [layout.items]
  );

  const saveCurrent = () => {
    const preset = capturePreset(
      name,
      LAYOUT_TARGETS.map((t) => t.label),
      (label) => {
        // A window never placed has no saved bounds; keep what the editor
        // shows for it so the preset reproduces this exact arrangement.
        const s = getWindowState(label);
        const item = layout.items.find((i) => i.label === label);
        return { ...s, bounds: s.bounds ?? item?.bounds };
      },
      (label) => openLabels.has(label)
    );
    commit(upsertPreset(presets, preset));
    setLoaded(preset.id);
    setName("");
  };

  const load = (preset: LayoutPreset) => {
    const plan = planPresetLoad(preset, openLabels);
    // Restore state first: a window opened below reads its saved bounds.
    for (const [label, state] of Object.entries(plan.states)) {
      replaceWindowState(label, state);
      applyWindowScale(label, state.scale ?? 1);
      setLock(label, state.locked);
      if (state.bounds) void applyWindowBounds(label, state.bounds);
    }
    for (const label of plan.close) {
      const t = getTarget(label);
      if (!t) continue;
      if (t.kind === "overlay") active.closeOverlay(t.id);
      else active.closeWidget(t.id);
    }
    for (const label of plan.open) {
      const t = getTarget(label);
      if (!t) continue;
      if (t.kind === "overlay") active.openOverlay(t.id, t.title);
      else active.openWidget(t.id, t.title);
    }
    layout.reload();
    setLoaded(preset.id);
    setOpen(false);
  };

  const current = presets.find((p) => p.id === loaded);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-ctl border border-border bg-surface-2 px-3 py-1.5 text-xs transition-colors hover:border-border-strong"
      >
        <Bookmark className="size-3.5 text-primary" />
        <span className="label-caps">Preset</span>
        <span className="max-w-36 truncate font-medium text-text">
          {current?.name ?? "Layout presets…"}
        </span>
        <ChevronDown className="size-3 text-faint" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1.5 w-72 overflow-hidden rounded-panel border border-border bg-surface"
          style={{ boxShadow: "var(--shadow-float)" }}
        >
          <div className="max-h-64 overflow-y-auto p-1">
            {presets.length === 0 && (
              <p className="px-2 py-3 text-center text-small text-faint">
                No presets yet. Arrange your windows, then save the layout
                below.
              </p>
            )}
            {presets.map((p) => (
              <div
                key={p.id}
                className={[
                  "group flex items-center gap-1 rounded-ctl px-2 py-1.5",
                  p.id === loaded ? "bg-primary/10 text-primary" : "hover:bg-surface-2",
                ].join(" ")}
              >
                <button
                  type="button"
                  role="menuitem"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => load(p)}
                >
                  <span className="block truncate text-xs font-medium">{p.name}</span>
                  <span className="tnum block font-mono text-small text-faint">
                    {Object.values(p.windows).filter((w) => w.open).length} open ·{" "}
                    {new Date(p.savedAt).toLocaleDateString()}
                  </span>
                </button>
                <button
                  type="button"
                  title={`Delete ${p.name}`}
                  onClick={() => {
                    commit(removePreset(presets, p.id));
                    if (loaded === p.id) setLoaded(null);
                  }}
                  className="grid size-6 place-items-center rounded-ctl text-faint opacity-0 transition-opacity hover:bg-surface hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
          <form
            className="flex items-center gap-1.5 border-t border-border p-2"
            onSubmit={(e) => {
              e.preventDefault();
              saveCurrent();
            }}
          >
            <input
              aria-label="Preset name"
              placeholder="Save current as…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-0 flex-1 rounded-ctl border border-border bg-bg px-2 py-1 text-xs text-text placeholder:text-faint focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              title="Save as preset"
              className="inline-flex items-center gap-1 rounded-pill bg-primary px-3 py-1 text-small font-semibold uppercase tracking-caps text-on-accent shadow-glow"
            >
              <Save className="size-3" />
              Save
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
