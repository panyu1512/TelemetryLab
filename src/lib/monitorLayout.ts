/**
 * The pure geometry behind the Layout editor (`components/manager/monitor`).
 *
 * The editor draws a monitor as a canvas and every overlay / widget window as a
 * box on it, where it really sits on that screen. Everything here works in the
 * OS's **physical** virtual-desktop pixels — the unit `windowState` saves and
 * Tauri's `setPosition` / `setSize` take — and only {@link fitMonitor} knows
 * about the canvas. Mixed-DPI rigs stay correct because nothing is converted to
 * logical pixels until a window is drawn.
 */

import type { WindowBounds } from "./windowState";
import type { MonitorRect } from "./windowPlacement";

export type Rect = WindowBounds;

/** How a monitor maps onto the editor canvas. */
export interface CanvasFit {
  /** Canvas px per physical px. */
  k: number;
  /** The monitor's top-left, in canvas px (it is centred in the box). */
  offsetX: number;
  offsetY: number;
  /** The drawn monitor's size in canvas px. */
  width: number;
  height: number;
}

/** Fit a monitor into a canvas box, preserving its aspect, centred. */
export function fitMonitor(
  monitor: MonitorRect,
  box: { width: number; height: number },
  padding = 0
): CanvasFit {
  const availW = Math.max(1, box.width - padding * 2);
  const availH = Math.max(1, box.height - padding * 2);
  const k = Math.min(availW / monitor.width, availH / monitor.height);
  const width = monitor.width * k;
  const height = monitor.height * k;
  return {
    k,
    width,
    height,
    offsetX: (box.width - width) / 2,
    offsetY: (box.height - height) / 2,
  };
}

/** A window's rectangle on the canvas, relative to the drawn monitor. */
export function toCanvas(b: Rect, monitor: MonitorRect, fit: CanvasFit): Rect {
  return {
    x: (b.x - monitor.x) * fit.k,
    y: (b.y - monitor.y) * fit.k,
    width: b.width * fit.k,
    height: b.height * fit.k,
  };
}

/** Which part of a box a drag grabbed: the body, or one edge / corner. */
export type DragHandle = "move" | "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface DragOptions {
  /** Smallest size the window may be resized to, physical px. */
  min: { width: number; height: number };
  /** Keep the result on this rectangle (the monitor). */
  within?: MonitorRect;
  /** Snap edges to a grid of this many physical px, measured from `within`. */
  grid?: number;
}

/** Round `v` to the nearest multiple of `step` measured from `origin`. */
export function snap(v: number, step: number, origin = 0): number {
  if (!(step > 0)) return v;
  return origin + Math.round((v - origin) / step) * step;
}

/**
 * The bounds after dragging `handle` by (`dx`, `dy`) physical px from
 * `start`. Moving keeps the size; resizing moves only the grabbed edges, never
 * below `min`, and the opposite edge stays put. With `grid` the moved edges
 * snap; with `within` the result is kept on the monitor (a move slides, a
 * resize stops at the edge).
 */
export function applyDrag(
  start: Rect,
  handle: DragHandle,
  dx: number,
  dy: number,
  opts: DragOptions
): Rect {
  const { min, within, grid } = opts;
  const ox = within?.x ?? 0;
  const oy = within?.y ?? 0;

  if (handle === "move") {
    let x = start.x + dx;
    let y = start.y + dy;
    if (grid) {
      x = snap(x, grid, ox);
      y = snap(y, grid, oy);
    }
    const moved = { ...start, x, y };
    return within ? clampOnto(moved, within) : round(moved);
  }

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (handle.includes("w")) left = start.x + dx;
  if (handle.includes("e")) right = start.x + start.width + dx;
  if (handle.includes("n")) top = start.y + dy;
  if (handle.includes("s")) bottom = start.y + start.height + dy;

  if (grid) {
    if (handle.includes("w")) left = snap(left, grid, ox);
    if (handle.includes("e")) right = snap(right, grid, ox);
    if (handle.includes("n")) top = snap(top, grid, oy);
    if (handle.includes("s")) bottom = snap(bottom, grid, oy);
  }

  if (within) {
    left = Math.max(left, within.x);
    top = Math.max(top, within.y);
    right = Math.min(right, within.x + within.width);
    bottom = Math.min(bottom, within.y + within.height);
  }

  // Enforce the minimum by pushing back the edge that moved.
  if (right - left < min.width) {
    if (handle.includes("w")) left = right - min.width;
    else right = left + min.width;
  }
  if (bottom - top < min.height) {
    if (handle.includes("n")) top = bottom - min.height;
    else bottom = top + min.height;
  }

  return round({ x: left, y: top, width: right - left, height: bottom - top });
}

/** Shrink to fit a monitor if needed, then slide fully onto it. */
export function clampOnto(b: Rect, m: MonitorRect): Rect {
  const width = Math.min(b.width, m.width);
  const height = Math.min(b.height, m.height);
  const x = Math.min(Math.max(b.x, m.x), m.x + m.width - width);
  const y = Math.min(Math.max(b.y, m.y), m.y + m.height - height);
  return round({ x, y, width, height });
}

function round(b: Rect): Rect {
  return {
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.round(b.width),
    height: Math.round(b.height),
  };
}

/**
 * The smallest a window may be, in physical px — the same floor the spawned
 * windows set (`minWidth` / `minHeight` in `overlayWindows`, which are
 * logical), times the monitor's DPI scale.
 */
export function minSizeFor(
  kind: "overlay" | "widget",
  scaleFactor = 1
): { width: number; height: number } {
  const logical = kind === "widget" ? { width: 160, height: 120 } : { width: 320, height: 200 };
  return {
    width: Math.round(logical.width * scaleFactor),
    height: Math.round(logical.height * scaleFactor),
  };
}

/** The size a window opens at when it has none saved, physical px. */
export function defaultSizeFor(
  kind: "overlay" | "widget",
  scaleFactor = 1
): { width: number; height: number } {
  const logical = kind === "widget" ? { width: 320, height: 220 } : { width: 640, height: 420 };
  return {
    width: Math.round(logical.width * scaleFactor),
    height: Math.round(logical.height * scaleFactor),
  };
}

/**
 * Where to draw the `index`-th window that has no saved bounds: a cascade
 * from the monitor's top-left, wrapping before it leaves the screen. These are
 * only suggestions until the user drags one — nothing is saved for a window
 * the user has not placed.
 */
export function cascadePlacement(
  size: { width: number; height: number },
  index: number,
  monitor: MonitorRect,
  step = Math.round(Math.min(monitor.width, monitor.height) * 0.04)
): Rect {
  const margin = step;
  const spanX = Math.max(1, monitor.width - size.width - margin * 2);
  const spanY = Math.max(1, monitor.height - size.height - margin * 2);
  const perRow = Math.max(1, Math.floor(Math.min(spanX, spanY) / Math.max(1, step)));
  const i = index % perRow;
  const wrap = Math.floor(index / perRow);
  return clampOnto(
    {
      x: monitor.x + margin + i * step + wrap * size.width * 0.5,
      y: monitor.y + margin + i * step,
      width: size.width,
      height: size.height,
    },
    monitor
  );
}

/**
 * Bounds after changing a window's content scale from `from` to `to`: the
 * window grows or shrinks by the same ratio about its top-left, so the content
 * keeps its layout and only its size changes.
 */
export function rescaleBounds(b: Rect, from: number, to: number): Rect {
  const r = from > 0 ? to / from : 1;
  return round({ x: b.x, y: b.y, width: b.width * r, height: b.height * r });
}

/**
 * The same position relative to another monitor: keep the window's offset
 * from the top-left as a fraction of the screen, then clamp onto it. Used by
 * "Move to monitor".
 */
export function moveToMonitor(b: Rect, from: MonitorRect, to: MonitorRect): Rect {
  const fx = (b.x - from.x) / Math.max(1, from.width);
  const fy = (b.y - from.y) / Math.max(1, from.height);
  return clampOnto(
    { x: to.x + fx * to.width, y: to.y + fy * to.height, width: b.width, height: b.height },
    to
  );
}

/** Clamp a content scale to the editor's range (50–200 %). */
export function clampScale(s: number): number {
  if (!Number.isFinite(s)) return 1;
  return Math.min(2, Math.max(0.5, Math.round(s * 100) / 100));
}
