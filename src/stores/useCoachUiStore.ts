import { create } from "zustand";
import { broadcast, subscribe } from "../lib/windowBus";
import {
  MIN_LOSS_DEFAULT,
  MIN_LOSS_MAX,
  MIN_LOSS_MIN,
  TIP_COUNT_DEFAULT,
  TIP_COUNT_MAX,
  TIP_COUNT_MIN,
} from "../lib/coaching";

/**
 * Preferences for the coach overlay, mirroring {@link useRelativeUiStore}:
 * presentation choices only, persisted to localStorage and broadcast over the
 * window bus, so changing one in the Manager updates an open coach overlay
 * live. None of them reach the bridge — it sends every corner, and these
 * decide which ones the overlay turns into tips (`lib/coaching.ts`).
 */
export interface CoachUiState {
  /** The smallest loss, in seconds, worth a tip. */
  minLoss: number;
  /** How many tips to show at most. */
  tipCount: number;
  /** Show every corner's loss or gain as a row under the tips. */
  showCorners: boolean;
  /** Show the lap as a strip, each corner's stretch in its grade's colour. */
  showLapStrip: boolean;
  setMinLoss: (v: number) => void;
  setTipCount: (n: number) => void;
  setShowCorners: (v: boolean) => void;
  setShowLapStrip: (v: boolean) => void;
}

const STORAGE_KEY = "telemetrylab.coach.ui.v1";

export interface Persisted {
  minLoss: number;
  tipCount: number;
  showCorners: boolean;
  showLapStrip: boolean;
}

const DEFAULTS: Persisted = {
  minLoss: MIN_LOSS_DEFAULT,
  tipCount: TIP_COUNT_DEFAULT,
  showCorners: true,
  showLapStrip: true,
};

export function clampMinLoss(v: number): number {
  if (!Number.isFinite(v)) return DEFAULTS.minLoss;
  return Math.round(Math.max(MIN_LOSS_MIN, Math.min(MIN_LOSS_MAX, v)) * 100) / 100;
}

export function clampTipCount(n: number): number {
  if (!Number.isFinite(n)) return DEFAULTS.tipCount;
  return Math.round(Math.max(TIP_COUNT_MIN, Math.min(TIP_COUNT_MAX, n)));
}

function sanitize(raw: Partial<Persisted> | null | undefined): Persisted {
  return {
    minLoss: clampMinLoss(raw?.minLoss ?? DEFAULTS.minLoss),
    tipCount: clampTipCount(raw?.tipCount ?? DEFAULTS.tipCount),
    showCorners: raw?.showCorners ?? DEFAULTS.showCorners,
    showLapStrip: raw?.showLapStrip ?? DEFAULTS.showLapStrip,
  };
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw) as Partial<Persisted>) : DEFAULTS;
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

export const useCoachUiStore = create<CoachUiState>((set, get) => {
  const save = () => {
    const { minLoss, tipCount, showCorners, showLapStrip } = get();
    const snapshot: Persisted = { minLoss, tipCount, showCorners, showLapStrip };
    persist(snapshot);
    if (!applyingRemote) broadcast("coach-ui:changed", snapshot);
  };
  return {
    ...load(),
    setMinLoss: (v) => {
      set({ minLoss: clampMinLoss(v) });
      save();
    },
    setTipCount: (n) => {
      set({ tipCount: clampTipCount(n) });
      save();
    },
    setShowCorners: (showCorners) => {
      set({ showCorners });
      save();
    },
    setShowLapStrip: (showLapStrip) => {
      set({ showLapStrip });
      save();
    },
  };
});

// Adopt coach-option changes made in another window (e.g. the manager).
subscribe("coach-ui:changed", (remote) => {
  if (!remote || typeof remote !== "object") return;
  applyingRemote = true;
  try {
    useCoachUiStore.setState(sanitize(remote));
  } finally {
    applyingRemote = false;
  }
});

/** Public name for the snapshot this store broadcasts over the window bus. */
export type CoachUiSnapshot = Persisted;
