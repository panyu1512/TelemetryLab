/**
 * Which dashboard widgets are *enabled* — the selection the user builds with the
 * toggles before opening windows. This is a selection, not a window state:
 * toggling a widget here doesn't open or close anything. The dashboard's "Open
 * windows" action then opens exactly the enabled widgets, each in its own window
 * (see the manager). Persisted so the selection survives restarts.
 *
 * Widgets default to enabled; an absent entry means enabled.
 */

import { create } from "zustand";

const STORAGE_KEY = "telemetrylab.widget-selection.v1";

function load(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === "object" ? parsed : {};
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
