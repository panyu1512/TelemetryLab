import { create } from "zustand";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function getWin() {
  if (!isTauri) return null;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

// ── persistence ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "telemetrylab.overlay.v1";
/**
 * Window bounds are persisted **per window label** so the main window and each
 * popped-out overlay window remember their own position/size independently. A
 * single shared key made every window clobber the others' bounds on move.
 */
const BOUNDS_KEY_PREFIX = "telemetrylab.window-bounds.v2";

function boundsKey(label: string): string {
  return `${BOUNDS_KEY_PREFIX}.${label}`;
}

interface PersistedOverlay {
  overlayMode: boolean;
}

function loadOverlay(): PersistedOverlay {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { overlayMode: false };
    const parsed = JSON.parse(raw) as Partial<PersistedOverlay>;
    return { overlayMode: parsed.overlayMode ?? false };
  } catch {
    return { overlayMode: false };
  }
}

function saveOverlay(state: PersistedOverlay) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ── CSS class helpers ────────────────────────────────────────────────────────

function syncClasses(overlayMode: boolean, locked: boolean) {
  const html = document.documentElement;
  html.classList.toggle("overlay-mode", overlayMode);
  html.classList.toggle("overlay-locked", overlayMode && locked);
}

// ── store ────────────────────────────────────────────────────────────────────

interface OverlayState {
  /** Window is always-on-top with a transparent background. */
  overlayMode: boolean;
  /** Click-through locked: all pointer events pass through to iRacing. */
  locked: boolean;

  setOverlayMode: (enabled: boolean) => void;
  setLocked: (locked: boolean) => void;
  /** Convenience toggle used by the Ctrl+Shift+L hotkey. No-op outside overlay mode. */
  toggleLock: () => void;
}

const persisted = loadOverlay();

export const useOverlayStore = create<OverlayState>()((set, get) => ({
  overlayMode: persisted.overlayMode,
  // Always start unlocked for safety — the user explicitly locks via hotkey.
  locked: false,

  setOverlayMode: (enabled) => {
    const locked = enabled ? get().locked : false;
    set({ overlayMode: enabled, locked });
    syncClasses(enabled, locked);
    saveOverlay({ overlayMode: enabled });

    getWin().then((w) => {
      if (!w) return;
      w.setAlwaysOnTop(enabled);
      if (!enabled) w.setIgnoreCursorEvents(false);
    });
  },

  setLocked: (locked) => {
    const { overlayMode } = get();
    set({ locked });
    syncClasses(overlayMode, locked);

    getWin().then((w) => {
      if (!w) return;
      w.setIgnoreCursorEvents(locked);
    });
  },

  toggleLock: () => {
    const { overlayMode, locked, setLocked } = get();
    if (!overlayMode) return;
    setLocked(!locked);
  },
}));

// ── window bounds persistence ─────────────────────────────────────────────────
// Saves position/size on every move or resize so the overlay reopens exactly
// where the user left it. Opt-in: only runs inside Tauri.

export async function initWindowBoundsPersistence() {
  if (!isTauri) return;

  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
  const w = getCurrentWindow();
  const key = boundsKey(w.label);

  // Restore saved bounds on launch.
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const b = JSON.parse(raw) as {
        x: number;
        y: number;
        width: number;
        height: number;
      };
      await w.setPosition(new PhysicalPosition(b.x, b.y));
      await w.setSize(new PhysicalSize(b.width, b.height));
    }
  } catch {}

  // Re-apply overlay mode state from persisted storage.
  const { overlayMode } = useOverlayStore.getState();
  if (overlayMode) {
    await w.setAlwaysOnTop(true);
    syncClasses(true, false);
  }

  const save = async () => {
    try {
      const pos = await w.innerPosition();
      const size = await w.innerSize();
      localStorage.setItem(
        key,
        JSON.stringify({ x: pos.x, y: pos.y, width: size.width, height: size.height })
      );
    } catch {}
  };

  await w.listen("tauri://move", save);
  await w.listen("tauri://resize", save);
}

// Apply initial classes synchronously on module load (before React renders).
if (typeof window !== "undefined") {
  syncClasses(persisted.overlayMode, false);
}
