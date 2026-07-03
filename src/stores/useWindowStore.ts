/**
 * Window store — overlay mode + generic, per-window locking.
 *
 * There is exactly one lock concept in the app and it works identically for the
 * `main` window and every popped-out `overlay-*` / `widget-*` window:
 *
 *   - **locked** = click-through. Pointer events pass straight to the game, and
 *     the window can't be moved or accidentally modified.
 *
 * Lock state is the single source of truth in {@link windowState} (persisted per
 * label) mirrored reactively here as `locks`. Changing a lock — for *this*
 * window or any other — persists it and broadcasts over {@link windowBus}; the
 * target window applies the OS-level click-through to itself and the manager UI
 * updates from the same event. No polling, no duplicated lock logic per window.
 *
 * `overlayMode` (transparent, always-on-top) is a property of the *main* window
 * only; spawned overlay/widget windows are inherently transparent overlays.
 */

import { create } from "zustand";
import { currentWindowLabel } from "../lib/overlayWindows";
import { broadcast, subscribe } from "../lib/windowBus";
import {
  getWindowBounds,
  isWindowLocked,
  saveWindowBounds,
  saveWindowLock,
} from "../lib/windowState";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Label of the window this module instance is running in. */
export const WINDOW_LABEL =
  typeof window !== "undefined" ? currentWindowLabel() : "main";

const IS_MAIN = WINDOW_LABEL === "main";

async function getWin() {
  if (!isTauri) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

// ── overlay-mode persistence (main window) ────────────────────────────────────

const OVERLAY_KEY = "telemetrylab.overlay.v1";

function loadOverlayMode(): boolean {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return false;
    return Boolean((JSON.parse(raw) as { overlayMode?: boolean }).overlayMode);
  } catch {
    return false;
  }
}

function saveOverlayMode(overlayMode: boolean): void {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify({ overlayMode }));
  } catch {}
}

// ── CSS class helpers (current window) ────────────────────────────────────────

function syncClasses(overlayMode: boolean, locked: boolean): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  // Spawned overlay/widget windows are always overlay-mode; main follows toggle.
  const overlay = IS_MAIN ? overlayMode : true;
  html.classList.toggle("overlay-mode", overlay);
  html.classList.toggle("overlay-locked", locked);
}

/**
 * Apply click-through to *this* window. Locking the main window only makes sense
 * while it's an overlay; spawned windows are always overlays so they always may.
 */
async function applyCurrentWindowLock(
  locked: boolean,
  overlayMode: boolean
): Promise<void> {
  const w = await getWin();
  if (!w) return;
  const canClickThrough = IS_MAIN ? overlayMode : true;
  await w.setIgnoreCursorEvents(canClickThrough ? locked : false);
}

// ── store ─────────────────────────────────────────────────────────────────────

interface WindowState {
  /** Main window transparent/always-on-top overlay mode. */
  overlayMode: boolean;
  /** Reactive mirror of each window's persisted lock, keyed by label. */
  locks: Record<string, boolean>;

  /** Toggle the main window's overlay (transparent, always-on-top) mode. */
  setOverlayMode: (enabled: boolean) => void;
  /** Lock or unlock any window by label. Propagates to that window at once. */
  setLock: (label: string, locked: boolean) => void;
  /** Toggle the current window's lock (Ctrl+Shift+L). */
  toggleLock: () => void;
  /** Current lock state for a label (persisted fallback if not yet mirrored). */
  isLocked: (label: string) => boolean;
}

const initialLocked = isWindowLocked(WINDOW_LABEL);

export const useWindowStore = create<WindowState>()((set, get) => ({
  overlayMode: IS_MAIN ? loadOverlayMode() : false,
  locks: { [WINDOW_LABEL]: initialLocked },

  setOverlayMode(enabled) {
    // Leaving overlay mode always clears the lock so the app stays usable.
    const locked = enabled ? get().isLocked(WINDOW_LABEL) : false;
    set((s) => ({
      overlayMode: enabled,
      locks: { ...s.locks, [WINDOW_LABEL]: locked },
    }));
    saveOverlayMode(enabled);
    if (!enabled) saveWindowLock(WINDOW_LABEL, false);
    syncClasses(enabled, locked);
    getWin().then((w) => {
      if (!w) return;
      w.setAlwaysOnTop(enabled);
      if (!enabled) w.setIgnoreCursorEvents(false);
    });
  },

  setLock(label, locked) {
    set((s) => ({ locks: { ...s.locks, [label]: locked } }));
    saveWindowLock(label, locked);
    broadcast("window:lock", { label, locked });
    if (label === WINDOW_LABEL) {
      syncClasses(get().overlayMode, locked);
      applyCurrentWindowLock(locked, get().overlayMode);
    }
  },

  toggleLock() {
    const { overlayMode, isLocked, setLock } = get();
    // The main window can only be locked while it is acting as an overlay.
    if (IS_MAIN && !overlayMode) return;
    setLock(WINDOW_LABEL, !isLocked(WINDOW_LABEL));
  },

  isLocked(label) {
    const mirrored = get().locks[label];
    return mirrored ?? isWindowLocked(label);
  },
}));

// ── cross-window lock propagation ─────────────────────────────────────────────
// A lock change in any window arrives here; mirror it and, if it targets *this*
// window, apply the OS-level click-through. We never re-broadcast (the sender
// already did), so there is no feedback loop.

subscribe("window:lock", (payload) => {
  const { label, locked } = (payload ?? {}) as {
    label?: string;
    locked?: boolean;
  };
  if (!label || typeof locked !== "boolean") return;
  const store = useWindowStore;
  store.setState((s) => ({ locks: { ...s.locks, [label]: locked } }));
  if (label === WINDOW_LABEL) {
    const { overlayMode } = store.getState();
    syncClasses(overlayMode, locked);
    applyCurrentWindowLock(locked, overlayMode);
  }
});

// ── window lifecycle: bounds restore/persist + lock apply + hotkey ────────────

/**
 * Restore this window's saved position/size, re-apply persisted overlay/lock
 * state, then keep bounds in sync on every move/resize. Also wires the
 * Ctrl+Shift+L lock hotkey to the *focused* window. Idempotent-ish: safe to call
 * once per window on mount. No-op outside Tauri except for class syncing.
 */
export async function initWindow(): Promise<void> {
  const { overlayMode } = useWindowStore.getState();
  const locked = isWindowLocked(WINDOW_LABEL);
  syncClasses(overlayMode, locked);

  if (!isTauri) return;

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
  const { listen } = await import("@tauri-apps/api/event");
  const w = getCurrentWindow();

  // Restore saved bounds on launch (exact position + size).
  const bounds = getWindowBounds(WINDOW_LABEL);
  if (bounds) {
    try {
      await w.setPosition(new PhysicalPosition(bounds.x, bounds.y));
      await w.setSize(new PhysicalSize(bounds.width, bounds.height));
    } catch {}
  }

  // Re-apply overlay + lock state for this window.
  if (IS_MAIN && overlayMode) await w.setAlwaysOnTop(true);
  if (locked) await applyCurrentWindowLock(true, overlayMode);

  const saveBounds = async () => {
    try {
      const pos = await w.innerPosition();
      const size = await w.innerSize();
      saveWindowBounds(WINDOW_LABEL, {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
      });
    } catch {}
  };
  await w.listen("tauri://move", saveBounds);
  await w.listen("tauri://resize", saveBounds);

  // Global Ctrl+Shift+L: only the focused window toggles its own lock.
  await listen("overlay://toggle-lock", () => {
    if (typeof document !== "undefined" && !document.hasFocus()) return;
    useWindowStore.getState().toggleLock();
  });
}

// Apply initial classes synchronously on module load (before React renders).
if (typeof window !== "undefined") {
  syncClasses(useWindowStore.getState().overlayMode, initialLocked);
}
