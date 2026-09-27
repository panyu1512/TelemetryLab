import { create } from "zustand";
import { broadcast, subscribe } from "../lib/windowBus";

/**
 * The driver's own class colours, picked in the Overlay Manager.
 *
 * Keyed by class short name ("GT3", "LMP2") — see `resolveClassColor` for why
 * that and not the class id. An absent key means "use the ramp", so the empty
 * map is the out-of-the-box look and resetting a class is deleting its key.
 *
 * Persisted, and broadcast over the window bus the same way the standings view
 * preferences are, so a colour picked in the Manager repaints an open
 * standings, relative or broadcast window at once.
 */
export interface ClassColorsState {
  overrides: Record<string, string>;
  setClassColor: (shortName: string, color: string | null) => void;
  resetAll: () => void;
}

const STORAGE_KEY = "telemetrylab.class-colors.v1";

export interface ClassColorsSnapshot {
  overrides: Record<string, string>;
}

/** Keep only string → `#rrggbb` pairs; anything else in storage is dropped. */
export function sanitizeOverrides(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string> = {};
  for (const [name, color] of Object.entries(raw as Record<string, unknown>)) {
    if (name && typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) {
      out[name] = color.toLowerCase();
    }
  }
  return out;
}

function load(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return sanitizeOverrides((JSON.parse(raw) as Partial<ClassColorsSnapshot>).overrides);
  } catch {
    return {};
  }
}

function persist(overrides: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ overrides }));
  } catch {
    // Storage may be unavailable (private mode); picks just won't persist.
  }
}

/** True while applying a remote (bus) update, so we don't echo it back out. */
let applyingRemote = false;

export const useClassColorsStore = create<ClassColorsState>((set, get) => {
  const save = () => {
    const { overrides } = get();
    persist(overrides);
    if (!applyingRemote) broadcast("class-colors:changed", { overrides });
  };
  return {
    overrides: load(),
    setClassColor: (shortName, color) => {
      if (!shortName) return;
      set((s) => {
        const next = { ...s.overrides };
        const clean = color ? sanitizeOverrides({ [shortName]: color })[shortName] : undefined;
        if (clean) next[shortName] = clean;
        else delete next[shortName];
        return { overrides: next };
      });
      save();
    },
    resetAll: () => {
      set({ overrides: {} });
      save();
    },
  };
});

subscribe("class-colors:changed", (remote) => {
  if (!remote || typeof remote !== "object") return;
  applyingRemote = true;
  try {
    useClassColorsStore.setState({ overrides: sanitizeOverrides(remote.overrides) });
  } finally {
    applyingRemote = false;
  }
});

/** The override map (stable identity until a pick changes). */
export function useClassColorOverrides(): Record<string, string> {
  return useClassColorsStore((s) => s.overrides);
}
