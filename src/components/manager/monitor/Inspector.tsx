import { useEffect, useState } from "react";
import { AppWindow, Lock, MousePointer2, PanelTopClose, RotateCcw } from "lucide-react";

import {
  clampOnto,
  minSizeFor,
  moveToMonitor,
  type Rect,
} from "../../../lib/monitorLayout";
import { useActiveOverlaysStore } from "../../../stores/useActiveOverlaysStore";
import { useOverlayConfigStore } from "../../../stores/useOverlayConfigStore";
import { useWidgetSelectionStore } from "../../../stores/useWidgetSelectionStore";
import { useWindowStore } from "../../../stores/useWindowStore";
import { Button, Segmented, SegmentedButton, ToggleSwitch } from "../../ui/controls";
import { SliderRow } from "../AppearancePanel";
import type { LayoutItem, LayoutState } from "./useLayoutState";

/**
 * Everything about the selected window: where it is to the pixel, how big
 * its content draws, how see-through it is, whether it is on and whether it
 * lets the mouse through to the game. Every field applies at once to the
 * real window.
 */
export function Inspector({
  layout,
  item,
}: {
  layout: LayoutState;
  item: LayoutItem | undefined;
}) {
  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MousePointer2 className="size-5 text-faint" />
        <p className="text-xs text-muted">
          Select a window on the monitor — or in the list — to place it to the
          pixel.
        </p>
      </div>
    );
  }
  return <ItemInspector key={item.label} layout={layout} item={item} />;
}

function ItemInspector({ layout, item }: { layout: LayoutState; item: LayoutItem }) {
  const config = useOverlayConfigStore();
  const settings = config.getOverlaySettings(item.configId);
  const widgetEnabled = useWidgetSelectionStore((s) => s.isEnabled(item.id));
  const toggleWidget = useWidgetSelectionStore((s) => s.toggle);
  const locked = useWindowStore((s) => s.locks[item.label] ?? s.isLocked(item.label));
  const setLock = useWindowStore((s) => s.setLock);
  const active = useActiveOverlaysStore();

  const screen = layout.screens[item.monitorIndex] ?? layout.screens[0];
  const monitor = layout.monitors[item.monitorIndex] ?? layout.monitors[0];
  const dpi = monitor.scaleFactor || 1;

  const enabled = item.kind === "widget" ? widgetEnabled && settings.enabled : settings.enabled;
  const Icon = item.icon;

  /** Commit a bounds edit, kept on the monitor and above the minimum size. */
  const commit = (next: Rect) => {
    const min = minSizeFor(item.kind, dpi);
    const sized = {
      ...next,
      width: Math.max(min.width, next.width),
      height: Math.max(min.height, next.height),
    };
    layout.setBounds(item.label, clampOnto(sized, screen));
  };

  const openClose = () => {
    if (item.kind === "overlay") {
      if (item.open) active.closeOverlay(item.id);
      else active.openOverlay(item.id, item.title);
    } else if (item.open) active.closeWidget(item.id);
    else active.openWidget(item.id, item.title);
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-card border border-border bg-surface text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="display-title truncate text-lg text-text">{item.title}</h3>
            <p className="tnum font-mono text-small text-faint">
              {item.kind} · {item.open ? <span className="text-primary">open</span> : "closed"}
              {item.suggested && " · not placed yet"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant={item.open ? "secondary" : "primary"}
            icon={item.open ? <PanelTopClose className="size-3.5" /> : <AppWindow className="size-3.5" />}
            onClick={openClose}
          >
            {item.open ? "Close window" : "Open window"}
          </Button>
          <Button
            variant="ghost"
            icon={<RotateCcw className="size-3.5" />}
            title="Forget this window's position and scale"
            onClick={() => layout.resetItem(item.label)}
          >
            Reset
          </Button>
        </div>
      </div>

      <InspectorSection title="Position & size" hint="screen px">
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="X"
            value={item.bounds.x - screen.x}
            onCommit={(v) => commit({ ...item.bounds, x: screen.x + v })}
          />
          <NumberField
            label="Y"
            value={item.bounds.y - screen.y}
            onCommit={(v) => commit({ ...item.bounds, y: screen.y + v })}
          />
          <NumberField
            label="W"
            value={item.bounds.width}
            onCommit={(v) => commit({ ...item.bounds, width: v })}
          />
          <NumberField
            label="H"
            value={item.bounds.height}
            onCommit={(v) => commit({ ...item.bounds, height: v })}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {(
            [
              ["Left", { x: screen.x }],
              ["Centre", { x: Math.round(screen.x + (screen.width - item.bounds.width) / 2) }],
              ["Right", { x: screen.x + screen.width - item.bounds.width }],
              ["Top", { y: screen.y }],
              ["Middle", { y: Math.round(screen.y + (screen.height - item.bounds.height) / 2) }],
              ["Bottom", { y: screen.y + screen.height - item.bounds.height }],
            ] as const
          ).map(([label, patch]) => (
            <button
              key={label}
              type="button"
              onClick={() => commit({ ...item.bounds, ...patch })}
              className="rounded-ctl border border-border bg-surface-2 px-1.5 py-1 text-small font-medium text-muted transition-colors hover:border-primary/60 hover:text-text"
            >
              {label}
            </button>
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="Look">
        <div className="space-y-4">
          <SliderRow
            label="Scale"
            value={Math.round(item.scale * 100)}
            min={50}
            max={200}
            defaultValue={100}
            unit="%"
            onChange={(v) => layout.setScale(item, v / 100)}
          />
          <SliderRow
            label="Opacity"
            value={settings.appearance.opacity}
            min={0}
            max={100}
            defaultValue={100}
            unit="%"
            onChange={(v) => config.setOverlayOpacity(item.configId, v)}
          />
          {item.kind === "widget" && (
            <p className="text-small text-faint">
              Opacity and theme are shared by every Dashboard widget.
            </p>
          )}
        </div>
      </InspectorSection>

      <InspectorSection title="Behaviour">
        <div className="space-y-3">
          <Row label="Enabled" hint={item.kind === "widget" ? "Shown when its window is open" : "Hidden when off, window kept"}>
            <ToggleSwitch
              checked={enabled}
              onChange={(v) => {
                if (item.kind === "widget") {
                  if (v !== widgetEnabled) toggleWidget(item.id);
                  if (v && !settings.enabled) config.setOverlayEnabled(item.configId, true);
                } else config.setOverlayEnabled(item.configId, v);
              }}
            />
          </Row>
          <Row label="Lock" hint="Click-through: the mouse goes to the game" icon={<Lock className="size-3" />}>
            <ToggleSwitch checked={locked} onChange={(v) => setLock(item.label, v)} />
          </Row>
        </div>
      </InspectorSection>

      {layout.monitors.length > 1 && (
        <InspectorSection title="Monitor">
          <Segmented>
            {layout.monitors.map((m, i) => (
              <SegmentedButton
                key={i}
                active={i === item.monitorIndex}
                onClick={() => {
                  if (i === item.monitorIndex) return;
                  layout.setBounds(item.label, moveToMonitor(item.bounds, screen, layout.screens[i]));
                }}
              >
                {i + 1}
                <span className="text-faint">{m.full?.width ?? m.width}×{m.full?.height ?? m.height}</span>
              </SegmentedButton>
            ))}
          </Segmented>
        </InspectorSection>
      )}

      <p className="mt-auto p-4 text-small text-faint">
        Drag the box to move, an edge or corner to resize. Arrow keys nudge
        1 px, Shift for a grid step; hold Alt while dragging to ignore the
        grid.
      </p>
    </div>
  );
}

function InspectorSection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="section-block" aria-hidden />
        <h4 className="display-title text-sm uppercase text-text">{title}</h4>
        {hint && <span className="label-caps ml-auto">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Row({
  label,
  hint,
  icon,
  children,
}: {
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs font-medium text-text">
          {icon}
          {label}
        </p>
        {hint && <p className="text-small text-faint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** A numeric field that commits on Enter or blur, and follows outside edits. */
function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(Math.round(value)));
  useEffect(() => setText(String(Math.round(value))), [value]);
  const commit = () => {
    const n = Number(text);
    if (Number.isFinite(n) && Math.round(n) !== Math.round(value)) onCommit(Math.round(n));
    else setText(String(Math.round(value)));
  };
  return (
    <label className="flex items-center gap-2 rounded-ctl border border-border bg-bg px-2 py-1.5 focus-within:border-primary">
      <span className="label-caps w-3">{label}</span>
      <input
        inputMode="numeric"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setText(String(Math.round(value)));
        }}
        className="tnum w-full min-w-0 bg-transparent text-xs text-text outline-none"
      />
    </label>
  );
}
