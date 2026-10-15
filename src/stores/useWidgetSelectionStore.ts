/**
 * Which dashboard widgets are *enabled* — the selection the user builds with the
 * toggles before opening windows. This is a selection, not a window state:
 * toggling a widget here doesn't open or close anything. The dashboard's "Open
 * windows" action then opens exactly the enabled widgets, each in its own window
 * (see the manager). Persisted so the selection survives restarts.
 *
 * Widgets default to enabled; an absent entry means enabled.
 *
 * It is also the switch for a widget window that is already open: the
 * selection is broadcast over the window bus, and a widget window paints
 * nothing while its widget is disabled (`SingleWidgetWindow`).
 */

import { create } from "zustand";
import { broadcast, subscribe } from "../lib/windowBus";

const STORAGE_KEY = "telemetrylab.widget-selection.v1";

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return sanitize(parsed);
  } catch {
    return {};
  }
}

function persist(map: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage may be unavailable (private mode); selection just won't persist.
  }
  broadcast("widget-selection:changed", { enabled: map });
}

/** Keep only `id → boolean` entries from a map that crossed a window boundary. */
function sanitize(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

interface WidgetSelectionState {
  /** widgetId → enabled. Missing = enabled. */
  enabled: Record<string, boolean>;
  /** Whether a widget is enabled (defaults to true). */
  isEnabled: (id: string) => boolean;
  /** Flip a widget's enabled state. */
  toggle: (id: string) => void;
}

export const useWidgetSelectionStore = create<WidgetSelectionState>()(
  (set, get) => ({
    enabled: typeof window !== "undefined" ? load() : {},

    isEnabled: (id) => get().enabled[id] !== false,

    toggle: (id) => {
      set((s) => {
        const enabled = { ...s.enabled, [id]: s.enabled[id] === false };
        persist(enabled);
        return { enabled };
      });
    },
  })
);

// Adopt a selection made in another window (the Manager), so an open widget
// window shows or hides the moment its toggle flips.
subscribe("widget-selection:changed", (remote) => {
  if (!remote || typeof remote !== "object") return;
  useWidgetSelectionStore.setState({ enabled: sanitize(remote.enabled) });
});

/** Public name for the snapshot this store broadcasts over the window bus. */
export interface WidgetSelectionSnapshot {
  enabled: Record<string, boolean>;
}
