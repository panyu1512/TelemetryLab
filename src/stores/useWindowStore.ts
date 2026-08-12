/**
 * Window store — generic, per-window locking for overlay/widget windows.
 *
 * The main window is a dedicated Overlay Manager: it is never an overlay and is
 * never locked. Only popped-out `overlay-*` / `widget-*` windows can be locked:
 *
 *   - **locked** = click-through. Pointer events pass straight to the game, and
 *     the window can't be moved or accidentally modified.
 *
 * Lock state is the single source of truth in {@link windowState} (persisted per
 * label) mirrored reactively here as `locks`. Changing a lock persists it and
 * broadcasts over {@link windowBus}; the target window applies the OS-level
 * click-through to itself. No polling, no duplicated lock logic per window.
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

// ── CSS class helpers (current window) ────────────────────────────────────────

function syncClasses(locked: boolean): void {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  // The main window (the manager) is never an overlay; spawned windows always are.
  html.classList.toggle("overlay-mode", !IS_MAIN);
  html.classList.toggle("overlay-locked", locked);
}

/**
 * Apply click-through to *this* window. Only spawned overlay/widget windows are
 * ever locked; the main manager window never becomes click-through.
 */
async function applyCurrentWindowLock(locked: boolean): Promise<void> {
  if (IS_MAIN) return;
  const w = await getWin();
  if (!w) return;
  await w.setIgnoreCursorEvents(locked);
}

// ── store ─────────────────────────────────────────────────────────────────────

interface WindowState {
  /** Reactive mirror of each window's persisted lock, keyed by label. */
  locks: Record<string, boolean>;

  /** Lock or unlock any window by label. Propagates to that window at once. */
  setLock: (label: string, locked: boolean) => void;
  /** Toggle the current window's lock (Ctrl+Shift+L). No-op in the manager. */
  toggleLock: () => void;
  /** Current lock state for a label (persisted fallback if not yet mirrored). */
  isLocked: (label: string) => boolean;
}

const initialLocked = isWindowLocked(WINDOW_LABEL);

export const useWindowStore = create<WindowState>()((set, get) => ({
  locks: { [WINDOW_LABEL]: initialLocked },

  setLock(label, locked) {
    // The manager window is never locked.
    if (label === "main") return;
    set((s) => ({ locks: { ...s.locks, [label]: locked } }));
    saveWindowLock(label, locked);
    broadcast("window:lock", { label, locked });
    if (label === WINDOW_LABEL) {
      syncClasses(locked);
      applyCurrentWindowLock(locked);
    }
  },

  toggleLock() {
    // Only spawned overlay/widget windows lock; the manager never does.
    if (IS_MAIN) return;
    const { isLocked, setLock } = get();
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

subscribe("window:lock", (event) => {
  const { label, locked } = event ?? {};
  if (!label || typeof locked !== "boolean") return;
  useWindowStore.setState((s) => ({ locks: { ...s.locks, [label]: locked } }));
  if (label === WINDOW_LABEL) {
    syncClasses(locked);
    applyCurrentWindowLock(locked);
  }
});

// ── window lifecycle: bounds restore/persist + lock apply + hotkey ────────────

/**
 * Restore this window's saved position/size, re-apply persisted lock state, then
 * keep bounds in sync on every move/resize. Also wires the Ctrl+Shift+L lock
 * hotkey to the *focused* window. Safe to call once per window on mount.
 */
export async function initWindow(): Promise<void> {
  const locked = isWindowLocked(WINDOW_LABEL);
  syncClasses(locked);

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

  // Re-apply this window's lock (spawned overlay/widget windows only).
  if (locked) await applyCurrentWindowLock(true);

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
  syncClasses(initialLocked);
}
