/**
 * Per-window persisted state — position, size and lock — keyed by window label.
 *
 * Every window (the `main` window and each popped-out `overlay-<id>` /
 * `widget-<id>` window) owns an independent record so closing and reopening a
 * window restores it *exactly* where the user left it: same X/Y, same width and
 * height, same lock state. This mirrors how professional streaming/overlay tools
 * behave — a closed overlay is remembered, not reset.
 *
 * localStorage is shared across all same-origin Tauri webviews, so this is a
 * genuine single source of truth on disk; the reactive mirror lives in the
 * window store, kept in sync via {@link windowBus}.
 */

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowState {
  bounds?: WindowBounds;
  /** Click-through lock: pointer events pass through to the game underneath. */
  locked: boolean;
}

const STORAGE_KEY = "telemetrylab.window-state.v1";

const DEFAULT_STATE: WindowState = { locked: false };

function readAll(): Record<string, WindowState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, WindowState>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, WindowState>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage may be unavailable (private mode); state just won't persist.
  }
}

/** Full persisted state for a window label (defaults when never saved). */
export function getWindowState(label: string): WindowState {
  return { ...DEFAULT_STATE, ...readAll()[label] };
}

/** Merge a partial update into a window's persisted state. */
export function patchWindowState(label: string, patch: Partial<WindowState>): void {
  const all = readAll();
  all[label] = { ...DEFAULT_STATE, ...all[label], ...patch };
  writeAll(all);
}

/** Persisted bounds for a window label, or `undefined` if never saved. */
export function getWindowBounds(label: string): WindowBounds | undefined {
  return readAll()[label]?.bounds;
}

/** Persist a window's bounds (called on move/resize). */
export function saveWindowBounds(label: string, bounds: WindowBounds): void {
  patchWindowState(label, { bounds });
}

/** Whether a window is currently persisted as locked. */
export function isWindowLocked(label: string): boolean {
  return getWindowState(label).locked;
}

/** Persist a window's lock state. */
export function saveWindowLock(label: string, locked: boolean): void {
  patchWindowState(label, { locked });
}
