import { create } from "zustand";
import { broadcast, subscribe } from "../lib/windowBus";
import {
  CONFIGURABLE_COLUMNS,
  type StandingsColumnId,
} from "../components/standings/constants";

/**
 * View preferences for the standings screen — kept out of the high-frequency
 * data store so toggling a column or the grouping never touches row state (and
 * vice-versa). Persisted to localStorage so a chosen view survives reloads, and
 * broadcast over {@link windowBus} so changing a preference in the manager
 * updates an open standings overlay window in real time.
 *
 * Everything here is set from the Overlay Manager: the timing screens themselves
 * have no controls. Per-class collapse and solo used to live on the screen's own
 * class band; both went with it, deliberately rather than being stranded — a
 * persisted `collapsed` with no UI to undo it would hide a class forever.
 *
 * These are *presentation* choices only; the data store stays the single source
 * of truth for the field itself.
 */
export type Grouping = "class" | "overall";

/** Column id → visible. Absent ids default to visible. */
export type ColumnVisibilityMap = Partial<Record<StandingsColumnId, boolean>>;

export interface StandingsUiState {
  /** class → one group per class, gap-separated; overall → one flat table. */
  grouping: Grouping;
  /** Follow the player: keep their row scrolled into view. */
  followPlayer: boolean;
  /** Which configurable columns are shown (missing = shown). */
  columns: ColumnVisibilityMap;
  /**
   * Show the session readout strip above the field (lap, time left, incidents,
   * temperatures, SoF, clock). A readout, never a control — see
   * `design.md` § Dense tabular overlays, rule 7.
   */
  showSessionStrip: boolean;
  setGrouping: (g: Grouping) => void;
  setFollowPlayer: (v: boolean) => void;
  setShowSessionStrip: (v: boolean) => void;
  /** Whether a column is currently visible (configurable ones default to true). */
  isColumnVisible: (id: StandingsColumnId) => boolean;
  toggleColumn: (id: StandingsColumnId) => void;
  /** Show every configurable column again. */
  resetColumns: () => void;
}

const STORAGE_KEY = "telemetrylab.standings.ui.v1";

interface Persisted {
  grouping: Grouping;
  followPlayer: boolean;
  columns: ColumnVisibilityMap;
  showSessionStrip: boolean;
}

const DEFAULTS: Persisted = {
  grouping: "class",
  followPlayer: true,
  columns: {},
  showSessionStrip: true,
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
    const { grouping, followPlayer, columns, showSessionStrip } = get();
    const snapshot: Persisted = {
      grouping,
      followPlayer,
      columns,
      showSessionStrip,
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
    setFollowPlayer: (followPlayer) => {
      set({ followPlayer });
      save();
    },
    setShowSessionStrip: (showSessionStrip) => {
      set({ showSessionStrip });
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

// Adopt standings-view changes made in the manager so an open standings overlay
// updates its columns/grouping live.
subscribe("standings-ui:changed", (payload) => {
  const remote = payload as Persisted | undefined;
  if (!remote || typeof remote !== "object") return;
  applyingRemote = true;
  try {
    useStandingsUiStore.setState({
      grouping: remote.grouping,
      followPlayer: remote.followPlayer,
      columns: remote.columns ?? {},
      showSessionStrip:
        remote.showSessionStrip ?? DEFAULTS.showSessionStrip,
    });
  } finally {
    applyingRemote = false;
  }
});

// Re-export for consumers that build column toggles.
export { CONFIGURABLE_COLUMNS };
