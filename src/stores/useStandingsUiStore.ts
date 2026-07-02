import { create } from "zustand";

/**
 * View preferences for the standings screen — kept out of the high-frequency
 * data store so toggling a collapse or a filter never touches row state (and
 * vice-versa). Persisted to localStorage so a chosen view survives reloads.
 *
 * These are *presentation* choices only; the data store stays the single source
 * of truth for the field itself.
 */
export type Grouping = "class" | "overall";

export interface StandingsUiState {
  /** class → grouped headers + collapse; overall → one flat table. */
  grouping: Grouping;
  /** Collapsed class ids (bodies hidden, header still shown). */
  collapsed: Record<number, boolean>;
  /** When set, show only this class; null = all classes. */
  classFilter: number | null;
  /** Follow the player: keep their row scrolled into view. */
  followPlayer: boolean;
  setGrouping: (g: Grouping) => void;
  toggleCollapsed: (classId: number) => void;
  setClassFilter: (classId: number | null) => void;
  toggleFollowPlayer: () => void;
}

const STORAGE_KEY = "telemetrylab.standings.ui.v1";

interface Persisted {
  grouping: Grouping;
  collapsed: Record<number, boolean>;
  classFilter: number | null;
  followPlayer: boolean;
}

const DEFAULTS: Persisted = {
  grouping: "class",
  collapsed: {},
  classFilter: null,
  followPlayer: true,
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function persist(state: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode); prefs just won't persist.
  }
}

export const useStandingsUiStore = create<StandingsUiState>((set, get) => {
  const save = () => {
    const { grouping, collapsed, classFilter, followPlayer } = get();
    persist({ grouping, collapsed, classFilter, followPlayer });
  };
  return {
    ...load(),
    setGrouping: (grouping) => {
      set({ grouping });
      save();
    },
    toggleCollapsed: (classId) => {
      set((s) => ({
        collapsed: { ...s.collapsed, [classId]: !s.collapsed[classId] },
      }));
      save();
    },
    setClassFilter: (classFilter) => {
      set({ classFilter });
      save();
    },
    toggleFollowPlayer: () => {
      set((s) => ({ followPlayer: !s.followPlayer }));
      save();
    },
  };
});
