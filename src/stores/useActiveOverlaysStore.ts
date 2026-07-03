/**
 * Active-overlays store — the manager's view of which overlay windows are open.
 *
 * The app's main window is a dedicated Overlay Manager: it owns opening,
 * closing, tracking and restoring overlay windows. This store is the reactive
 * mirror of the persisted open-window set ({@link getRememberedWindows}); it
 * stays in sync across windows via {@link windowBus} — when an overlay window is
 * closed from its own chrome, it broadcasts `windows:changed` and the manager
 * refreshes here.
 *
 * There is no intermediate controller: the manager opens overlay windows
 * directly and closes them by label.
 */

import { create } from "zustand";
import { subscribe } from "../lib/windowBus";
import {
  closeOverlayWindow,
  getRememberedWindows,
  openOverlayWindow,
  type RememberedWindow,
} from "../lib/overlayWindows";

interface ActiveOverlaysState {
  /** Reactive mirror of the persisted open overlay/widget windows. */
  windows: RememberedWindow[];
  /** Whether an overlay (by id) currently has an open window. */
  isOverlayOpen: (id: string) => boolean;
  /** Open an overlay in its own window and track it as active. */
  openOverlay: (id: string, label: string) => void;
  /** Close an overlay's window and stop tracking it. */
  closeOverlay: (id: string) => void;
  /** Re-read the persisted set (after a cross-window change). */
  refresh: () => void;
}

export const useActiveOverlaysStore = create<ActiveOverlaysState>()((set, get) => ({
  windows: typeof window !== "undefined" ? getRememberedWindows() : [],

  isOverlayOpen(id) {
    return get().windows.some((w) => w.kind === "overlay" && w.id === id);
  },

  openOverlay(id, label) {
    // openOverlayWindow persists via saveRemembered → broadcasts windows:changed;
    // refresh immediately for snappy local feedback too.
    openOverlayWindow(id, label);
    set({ windows: getRememberedWindows() });
  },

  closeOverlay(id) {
    closeOverlayWindow("overlay", id);
    set({ windows: getRememberedWindows() });
  },

  refresh() {
    set({ windows: getRememberedWindows() });
  },
}));

// Any window opening/closing (including an overlay closing itself) refreshes the
// manager's active list.
subscribe("windows:changed", () => {
  useActiveOverlaysStore.getState().refresh();
});
