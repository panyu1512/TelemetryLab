import { create } from "zustand";
import { broadcast, subscribe } from "../lib/windowBus";
import {
  CONFIGURABLE_COLUMNS,
  type StandingsColumnId,
} from "../components/standings/constants";

/**
 * View preferences for the standings screen — kept out of the high-frequency
 * data store so toggling a collapse, a filter or a column never touches row
 * state (and vice-versa). Persisted to localStorage so a chosen view survives
 * reloads, and broadcast over {@link windowBus} so changing a preference in the
 * manager updates an open standings overlay window in real time.
 *
 * These are *presentation* choices only; the data store stays the single source
 * of truth for the field itself.
 */
export type Grouping = "class" | "overall";

/** Column id → visible. Absent ids default to visible. */
export type ColumnVisibilityMap = Partial<Record<StandingsColumnId, boolean>>;

export interface StandingsUiState {
  /** class → grouped headers + collapse; overall → one flat table. */
  grouping: Grouping;
  /** Collapsed class ids (bodies hidden, header still shown). */
  collapsed: Record<number, boolean>;
  /** When set, show only this class; null = all classes. */
  classFilter: number | null;
  /** Follow the player: keep their row scrolled into view. */
  followPlayer: boolean;
  /** Which configurable columns are shown (missing = shown). */
  columns: ColumnVisibilityMap;
  setGrouping: (g: Grouping) => void;
  toggleCollapsed: (classId: number) => void;
  setClassFilter: (classId: number | null) => void;
  toggleFollowPlayer: () => void;
  /** Whether a column is currently visible (configurable ones default to true). */
  isColumnVisible: (id: StandingsColumnId) => boolean;
  toggleColumn: (id: StandingsColumnId) => void;
  /** Show every configurable column again. */
  resetColumns: () => void;
}

const STORAGE_KEY = "telemetrylab.standings.ui.v1";

interface Persisted {
  grouping: Grouping;
  collapsed: Record<number, boolean>;
  classFilter: number | null;
  followPlayer: boolean;
  columns: ColumnVisibilityMap;
}

const DEFAULTS: Persisted = {
  grouping: "class",
  collapsed: {},
  classFilter: null,
  followPlayer: true,
  columns: {},
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return { ...DEFAULTS, ...parsed, columns: parsed.columns ?? {} };
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

/** True while applying a remote (bus) update, so we don't echo it back out. */
let applyingRemote = false;

export const useStandingsUiStore = create<StandingsUiState>((set, get) => {
  const save = () => {
    const { grouping, collapsed, classFilter, followPlayer, columns } = get();
    const snapshot: Persisted = {
      grouping,
      collapsed,
      classFilter,
      followPlayer,
      columns,
    };
    persist(snapshot);
    if (!applyingRemote) broadcast("standings-ui:changed", snapshot);
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
    isColumnVisible: (id) => get().columns[id] !== false,
    toggleColumn: (id) => {
      set((s) => ({
        columns: { ...s.columns, [id]: s.columns[id] === false },
      }));
      save();
    },
    resetColumns: () => {
      set({ columns: {} });
      save();
    },
  };
});

// Adopt standings-view changes made in another window (e.g. the manager) so an
// open standings overlay updates its columns/grouping live.
subscribe("standings-ui:changed", (payload) => {
  const remote = payload as Persisted | undefined;
  if (!remote || typeof remote !== "object") return;
  applyingRemote = true;
  try {
    useStandingsUiStore.setState({
      grouping: remote.grouping,
      collapsed: remote.collapsed ?? {},
      classFilter: remote.classFilter ?? null,
      followPlayer: remote.followPlayer,
      columns: remote.columns ?? {},
    });
  } finally {
    applyingRemote = false;
  }
});

// Re-export for consumers that build column toggles.
export { CONFIGURABLE_COLUMNS };
