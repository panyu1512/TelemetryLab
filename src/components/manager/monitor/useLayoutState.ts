import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  cascadePlacement,
  clampOnto,
  clampScale,
  defaultSizeFor,
  rescaleBounds,
  type Rect,
} from "../../../lib/monitorLayout";
import {
  applyWindowBounds,
  applyWindowScale,
  editorMonitors,
  FALLBACK_MONITOR,
  screenRect,
} from "../../../lib/windowControl";
import { subscribe } from "../../../lib/windowBus";
import { isPlausibleBounds, monitorOf, type LiveMonitor } from "../../../lib/windowPlacement";
import { getWindowBounds, getWindowScale, replaceWindowState, getWindowState } from "../../../lib/windowState";
import { useActiveOverlaysStore } from "../../../stores/useActiveOverlaysStore";
import { LAYOUT_TARGETS, SUGGESTED_ANCHOR, type LayoutTarget } from "./targets";

/** A target as the editor draws it right now. */
export interface LayoutItem extends LayoutTarget {
  /** Physical px. Saved bounds, or a suggested cascade when never placed. */
  bounds: Rect;
  /** True when `bounds` is a suggestion, not something the user saved. */
  suggested: boolean;
  /** The monitor the window sits on (index into `monitors`). */
  monitorIndex: number;
  /** Content scale, 1 = 100 %. */
  scale: number;
  open: boolean;
}

function readSaved(): {
  bounds: Record<string, Rect | undefined>;
  scales: Record<string, number>;
} {
  const bounds: Record<string, Rect | undefined> = {};
  const scales: Record<string, number> = {};
  for (const t of LAYOUT_TARGETS) {
    const b = getWindowBounds(t.label);
    bounds[t.label] = isPlausibleBounds(b) ? b : undefined;
    scales[t.label] = getWindowScale(t.label);
  }
  return { bounds, scales };
}

/**
 * The Layout editor's model: the monitors, every target's bounds and scale,
 * and which windows are open — kept live against the windows themselves (a
 * window dragged on screen moves its box here) and against other Manager
 * actions (presets, reset).
 */
export function useLayoutState() {
  const [monitors, setMonitors] = useState<LiveMonitor[]>([FALLBACK_MONITOR]);
  const [saved, setSaved] = useState(readSaved);
  const openWindows = useActiveOverlaysStore((s) => s.windows);

  /** Labels being dragged in the editor: their echoes from the window are ignored. */
  const dragging = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;
    editorMonitors().then((m) => {
      if (alive && m.length > 0) setMonitors(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Follow the windows: a drag of the real window, a scale change from
  // another view, a preset load.
  useEffect(() => {
    const offBounds = subscribe("window:bounds", (e) => {
      const label = e?.label;
      const b = e?.bounds;
      if (!label || !b || dragging.current.has(label)) return;
      const rect = { x: b.x ?? 0, y: b.y ?? 0, width: b.width ?? 0, height: b.height ?? 0 };
      if (!isPlausibleBounds(rect)) return;
      setSaved((s) => ({ ...s, bounds: { ...s.bounds, [label]: rect } }));
    });
    const offScale = subscribe("window:scale", (e) => {
      if (!e?.label || typeof e.scale !== "number") return;
      const { label, scale } = e;
      setSaved((s) => ({ ...s, scales: { ...s.scales, [label]: scale } }));
    });
    const offPresets = subscribe("layout-presets:changed", () => setSaved(readSaved()));
    return () => {
      offBounds();
      offScale();
      offPresets();
    };
  }, []);

  const screens = useMemo(() => monitors.map(screenRect), [monitors]);

  const items: LayoutItem[] = useMemo(() => {
    // `RememberedWindow.label` is the human title; the window label is kind-id.
    const openSet = new Set(openWindows.map((w) => `${w.kind}-${w.id}`));
    const primary = monitors[0];
    let unplaced = 0;
    return LAYOUT_TARGETS.map((t) => {
      const savedBounds = saved.bounds[t.label];
      const size = defaultSizeFor(t.kind, primary.scaleFactor);
      const anchor = SUGGESTED_ANCHOR[t.label];
      const home = screens[0];
      const bounds =
        savedBounds ??
        (anchor
          ? clampOnto(
              {
                x: Math.round(home.x + anchor[0] * home.width),
                y: Math.round(home.y + anchor[1] * home.height),
                ...size,
              },
              home
            )
          : cascadePlacement(size, unplaced++, home));
      const mon = monitorOf(bounds, screens);
      const monitorIndex = mon ? screens.indexOf(mon) : 0;
      return {
        ...t,
        bounds,
        suggested: !savedBounds,
        monitorIndex,
        scale: saved.scales[t.label] ?? 1,
        open: openSet.has(t.label),
      };
    });
  }, [saved, openWindows, monitors, screens]);

  /**
   * Set a target's bounds. Mid-drag frames (`persist` false) move the real
   * window and the box without saving; the final frame saves and broadcasts.
   */
  const setBounds = useCallback(
    (label: string, bounds: Rect, persist = true) => {
      setSaved((s) => ({ ...s, bounds: { ...s.bounds, [label]: bounds } }));
      void applyWindowBounds(label, bounds, persist);
    },
    []
  );

  /** Set a target's content scale, growing / shrinking its window to match. */
  const setScale = useCallback(
    (item: LayoutItem, next: number) => {
      const scale = clampScale(next);
      if (scale === item.scale) return;
      const bounds = rescaleBounds(item.bounds, item.scale, scale);
      setSaved((s) => ({
        bounds: { ...s.bounds, [item.label]: bounds },
        scales: { ...s.scales, [item.label]: scale },
      }));
      applyWindowScale(item.label, scale);
      void applyWindowBounds(item.label, bounds, true);
    },
    []
  );

  /** Forget a target's position and scale (it reopens at the OS default). */
  const resetItem = useCallback((label: string) => {
    const prev = getWindowState(label);
    replaceWindowState(label, { locked: prev.locked });
    applyWindowScale(label, 1);
    setSaved(readSaved());
  }, []);

  const reload = useCallback(() => setSaved(readSaved()), []);

  const beginDrag = useCallback((label: string) => dragging.current.add(label), []);
  const endDrag = useCallback((label: string) => dragging.current.delete(label), []);

  return {
    monitors,
    screens,
    items,
    setBounds,
    setScale,
    resetItem,
    reload,
    beginDrag,
    endDrag,
  };
}

export type LayoutState = ReturnType<typeof useLayoutState>;
