import { create } from "zustand";
import { broadcast, subscribe } from "../lib/windowBus";

/**
 * View preferences for the relative screen, mirroring how
 * {@link useStandingsUiStore} works: presentation choices only, persisted to
 * localStorage so they survive reloads, and broadcast over the window bus so
 * changing an option in the manager updates an open relative overlay window
 * live (and vice-versa).
 */

export const RELATIVE_WINDOW_MIN = 3;
export const RELATIVE_WINDOW_MAX = 10;

export interface RelativeUiState {
  /** Show the car-brand icon next to each driver. */
  showBrand: boolean;
  /** Show each driver's country flag. */
  showCountry: boolean;
  /** Cars shown per side (ahead/behind). */
  windowSize: number;
  /**
   * Show the session readout strip above the field (lap, time left, incidents,
   * temperatures, SoF, clock). A readout, never a control — see
   * `design.md` § Dense tabular overlays, rule 7.
   */
  showSessionStrip: boolean;
  /**
   * Print the `P # DRIVER CL GAP LAST` micro-labels in the first row's top
   * slice. Off by default — see the note in `useStandingsUiStore`.
   */
  showColumnLabels: boolean;
  setShowBrand: (v: boolean) => void;
  setShowCountry: (v: boolean) => void;
  setWindowSize: (n: number) => void;
  setShowSessionStrip: (v: boolean) => void;
  setShowColumnLabels: (v: boolean) => void;
}

const STORAGE_KEY = "telemetrylab.relative.ui.v1";

export interface Persisted {
  showBrand: boolean;
  showCountry: boolean;
  windowSize: number;
  showSessionStrip: boolean;
  showColumnLabels: boolean;
}

const DEFAULTS: Persisted = {
  showBrand: true,
  showCountry: true,
  windowSize: 5,
  showSessionStrip: true,
  showColumnLabels: false,
};

function clampWindow(n: number): number {
  return Math.max(RELATIVE_WINDOW_MIN, Math.min(RELATIVE_WINDOW_MAX, n));
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      ...DEFAULTS,
      ...parsed,
      windowSize: clampWindow(parsed.windowSize ?? DEFAULTS.windowSize),
    };
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

export const useRelativeUiStore = create<RelativeUiState>((set, get) => {
  const save = () => {
    const {
      showBrand,
      showCountry,
      windowSize,
      showSessionStrip,
      showColumnLabels,
    } = get();
    const snapshot: Persisted = {
      showBrand,
      showCountry,
      windowSize,
      showSessionStrip,
      showColumnLabels,
    };
    persist(snapshot);
    if (!applyingRemote) broadcast("relative-ui:changed", snapshot);
  };
  return {
    ...load(),
    setShowBrand: (showBrand) => {
      set({ showBrand });
      save();
    },
    setShowCountry: (showCountry) => {
      set({ showCountry });
      save();
    },
    setWindowSize: (n) => {
      set({ windowSize: clampWindow(n) });
      save();
    },
    setShowSessionStrip: (showSessionStrip) => {
      set({ showSessionStrip });
      save();
    },
    setShowColumnLabels: (showColumnLabels) => {
      set({ showColumnLabels });
      save();
    },
  };
});

// Adopt relative-view changes made in another window (e.g. the manager) so an
// open relative overlay updates live.
subscribe("relative-ui:changed", (remote) => {
  if (!remote || typeof remote !== "object") return;
  applyingRemote = true;
  try {
    useRelativeUiStore.setState({
      showBrand: remote.showBrand ?? DEFAULTS.showBrand,
      showCountry: remote.showCountry ?? DEFAULTS.showCountry,
      windowSize: clampWindow(remote.windowSize ?? DEFAULTS.windowSize),
      showSessionStrip:
        remote.showSessionStrip ?? DEFAULTS.showSessionStrip,
      showColumnLabels:
        remote.showColumnLabels ?? DEFAULTS.showColumnLabels,
    });
  } finally {
    applyingRemote = false;
  }
});

/** Public name for the snapshot this store broadcasts over the window bus. */
export type RelativeUiSnapshot = Persisted;
