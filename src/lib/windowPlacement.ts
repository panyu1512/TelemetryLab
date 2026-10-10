/**
 * Keeping a restored window on a screen that exists.
 *
 * Every window reopens at the bounds it was last saved with (`windowState`),
 * in the OS's physical virtual-desktop coordinates. Those coordinates are only
 * meaningful against the monitor layout they were saved under, and that layout
 * moves under us:
 *
 *   - **The primary display changes.** Windows measures the whole desktop from
 *     the primary monitor's top-left corner, so swapping which screen is "main"
 *     shifts every other screen's origin. A window saved at x = 2200 on the
 *     right-hand monitor is now 2200 px into nothing.
 *   - **A monitor is unplugged or turned off** (a sim rig's side screens).
 *   - **The window was minimized when its bounds were saved.** Windows parks a
 *     minimized window at (-32000, -32000), and a move event fires on the way
 *     there, so a naive save writes that sentinel to disk and the next launch
 *     opens the window at it.
 *
 * Each of these reopens a borderless, transparent window entirely off screen.
 * It is running, it just cannot be seen — "the app opens sometimes and not
 * others", depending on what the last session left behind.
 *
 * This module is the pure part of the fix: given saved bounds and the monitors
 * that exist now, say where the window can actually go.
 */

import type { WindowBounds } from "./windowState";

/** A monitor's usable rectangle, in physical pixels. */
export interface MonitorRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Anything at or past this on either axis is the minimized-window sentinel
 * (Windows uses -32000), not a real position on any desktop.
 */
const MINIMIZED_COORD = -30000;

/** Smaller than this is a collapsed (minimized) window, not a saved size. */
const MIN_SIDE = 60;

/**
 * How much of the window's top strip must be on a monitor for the user to be
 * able to grab it, in physical px. A window that only clips the edge of a
 * screen by a few pixels is as good as lost.
 */
const MIN_VISIBLE = 80;

/** Height of the top strip measured above — roughly where the drag handle is. */
const GRAB_STRIP = 40;

/**
 * Whether bounds describe a real, visible window rather than a minimized one or
 * a corrupt record. Used both before saving and before restoring.
 */
export function isPlausibleBounds(b: WindowBounds | undefined): b is WindowBounds {
  if (!b) return false;
  const nums = [b.x, b.y, b.width, b.height];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  if (b.x <= MINIMIZED_COORD || b.y <= MINIMIZED_COORD) return false;
  return b.width >= MIN_SIDE && b.height >= MIN_SIDE;
}

function overlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/** Area of the window's top strip that lands on a monitor. */
function grabbableArea(b: WindowBounds, m: MonitorRect): number {
  const strip = Math.min(GRAB_STRIP, b.height);
  return (
    overlap(b.x, b.x + b.width, m.x, m.x + m.width) *
    overlap(b.y, b.y + strip, m.y, m.y + m.height)
  );
}

/** Shrink to fit the monitor, then slide fully onto it. */
function clampInto(b: WindowBounds, m: MonitorRect): WindowBounds {
  const width = Math.min(b.width, m.width);
  const height = Math.min(b.height, m.height);
  const x = Math.min(Math.max(b.x, m.x), m.x + m.width - width);
  const y = Math.min(Math.max(b.y, m.y), m.y + m.height - height);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

/** The bounds' size, centred on a monitor (shrunk if it does not fit). */
function centreOn(b: WindowBounds, m: MonitorRect): WindowBounds {
  const width = Math.min(b.width, m.width);
  const height = Math.min(b.height, m.height);
  return {
    x: Math.round(m.x + (m.width - width) / 2),
    y: Math.round(m.y + (m.height - height) / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Where a window saved at `saved` should reopen, given the monitors that exist
 * now (primary first).
 *
 *   - Implausible bounds (minimized sentinel, collapsed size) → `null`: ignore
 *     them and let the window open at its default position.
 *   - Still grabbable on some monitor → kept on the monitor holding most of its
 *     top strip, pulled fully onto it and shrunk if that screen got smaller.
 *     A window that was already fully on screen comes back exactly where it was.
 *   - On no monitor at all (the primary changed, a screen was unplugged) →
 *     centred on the primary monitor at its saved size.
 *
 * With no monitor information (the query failed) the saved bounds are trusted
 * as they are; there is nothing better to compare them against.
 */
export function placeWindow(
  saved: WindowBounds | undefined,
  monitors: readonly MonitorRect[]
): WindowBounds | null {
  if (!isPlausibleBounds(saved)) return null;
  const screens = monitors.filter((m) => m.width > 0 && m.height > 0);
  if (screens.length === 0) return saved;

  let best: MonitorRect | null = null;
  let bestArea = 0;
  for (const m of screens) {
    const area = grabbableArea(saved, m);
    if (area > bestArea) {
      bestArea = area;
      best = m;
    }
  }

  const visibleWidth = bestArea / Math.min(GRAB_STRIP, saved.height);
  if (best && visibleWidth >= Math.min(MIN_VISIBLE, saved.width)) {
    return clampInto(saved, best);
  }
  return centreOn(saved, screens[0]);
}

// ── querying the live monitor layout (Tauri only) ─────────────────────────────

/** A monitor's work area plus the DPI scale its windows are drawn at. */
export interface LiveMonitor extends MonitorRect {
  scaleFactor: number;
}

/**
 * The monitors attached right now, primary first, as work areas (the screen
 * minus the taskbar). Empty outside Tauri or if the query fails — which
 * {@link placeWindow} reads as "trust the saved bounds".
 */
export async function liveMonitors(): Promise<LiveMonitor[]> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return [];
  try {
    const { availableMonitors, primaryMonitor } = await import("@tauri-apps/api/window");
    const [all, primary] = await Promise.all([availableMonitors(), primaryMonitor()]);
    const rects = all.map((m) => {
      const area = m.workArea ?? { position: m.position, size: m.size };
      return {
        x: area.position.x,
        y: area.position.y,
        width: area.size.width,
        height: area.size.height,
        scaleFactor: m.scaleFactor || 1,
        primary: !!primary && m.name === primary.name &&
          m.position.x === primary.position.x && m.position.y === primary.position.y,
      };
    });
    rects.sort((a, b) => Number(b.primary) - Number(a.primary));
    return rects.map(({ primary: _p, ...r }) => r);
  } catch {
    return [];
  }
}

/** The monitor a placed window sits on (most overlap), for its DPI scale. */
export function monitorOf<M extends MonitorRect>(
  b: WindowBounds,
  monitors: readonly M[]
): M | undefined {
  let best: M | undefined;
  let bestArea = 0;
  for (const m of monitors) {
    const area =
      overlap(b.x, b.x + b.width, m.x, m.x + m.width) *
      overlap(b.y, b.y + b.height, m.y, m.y + m.height);
    if (area > bestArea) {
      bestArea = area;
      best = m;
    }
  }
  return best;
}
