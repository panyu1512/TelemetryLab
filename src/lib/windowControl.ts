/**
 * Moving, resizing and rescaling overlay / widget windows **from the
 * Manager** — the Layout editor's side effects.
 *
 * The Manager already holds the Tauri permissions to set another window's
 * position and size (`src-tauri/capabilities/default.json`), so it drives the
 * real window directly by label rather than asking it over the bus. Every
 * change is also saved in `windowState`, so a window that is closed now opens
 * where it was placed, and broadcast, so other views of the layout follow.
 *
 * Outside Tauri (browser dev, Playwright) there are no windows to move: the
 * bounds are only saved and broadcast, and the editor runs against a stand-in
 * monitor ({@link editorMonitors}).
 */

import { broadcast } from "./windowBus";
import { liveMonitors, type LiveMonitor } from "./windowPlacement";
import { saveWindowBounds, saveWindowScale, type WindowBounds } from "./windowState";

const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Put a window at `bounds` (physical px): move the real window if it is open,
 * and — unless `persist` is false (mid-drag frames) — save and broadcast.
 */
export async function applyWindowBounds(
  label: string,
  bounds: WindowBounds,
  persist = true
): Promise<void> {
  if (persist) {
    saveWindowBounds(label, bounds);
    broadcast("window:bounds", { label, bounds });
  }
  if (!isTauri()) return;
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
    const w = await WebviewWindow.getByLabel(label);
    if (!w) return;
    // Size first, so a window moved toward a screen edge is not clamped by
    // the OS at its old, larger size.
    await w.setSize(new PhysicalSize(bounds.width, bounds.height));
    await w.setPosition(new PhysicalPosition(bounds.x, bounds.y));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[layout] failed to place ${label}:`, err);
  }
}

/** Set a window's content scale (1 = 100 %), save it and tell the window. */
export function applyWindowScale(label: string, scale: number): void {
  saveWindowScale(label, scale);
  broadcast("window:scale", { label, scale });
}

/** The 1080p screen the editor falls back to when it cannot ask the OS. */
export const FALLBACK_MONITOR: LiveMonitor = {
  x: 0,
  y: 0,
  width: 1920,
  height: 1080,
  scaleFactor: 1,
  full: { x: 0, y: 0, width: 1920, height: 1080 },
  name: "Display",
};

/**
 * The monitors the editor draws, primary first. In Tauri, the real ones;
 * elsewhere a single stand-in the size of this screen (or 1080p when the
 * browser reports something too small to be a desktop).
 */
export async function editorMonitors(): Promise<LiveMonitor[]> {
  const live = await liveMonitors();
  if (live.length > 0) return live;
  if (typeof window === "undefined" || !window.screen) return [FALLBACK_MONITOR];
  const dpr = window.devicePixelRatio || 1;
  const width = Math.round(window.screen.width * dpr);
  const height = Math.round(window.screen.height * dpr);
  if (width < 1280 || height < 720) return [FALLBACK_MONITOR];
  return [
    {
      x: 0,
      y: 0,
      width,
      height,
      scaleFactor: dpr,
      full: { x: 0, y: 0, width, height },
      name: "Display",
    },
  ];
}

/** The rectangle the editor draws for a monitor: the whole screen. */
export function screenRect(m: LiveMonitor) {
  return m.full ?? { x: m.x, y: m.y, width: m.width, height: m.height };
}
