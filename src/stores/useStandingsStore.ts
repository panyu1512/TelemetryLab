import { create } from "zustand";
import type { StandingsEntry, StandingsPayload } from "../telemetry/types";

/**
 * Medium-frequency (~5–10 Hz) computed field order.
 *
 * The key design choice here is **normalization for render performance**. A
 * naive `entries: StandingsEntry[]` would give every row a new object every tick
 * and re-render the entire table (death at 100+ cars × 10 Hz). Instead we keep:
 *
 *   - `order`  — the carIdx sequence (drives row mounting/reordering only)
 *   - `byIdx`  — carIdx → entry, where **unchanged rows keep their identity**
 *
 * A row component subscribes to exactly its own entry
 * (`useStandingsRow(carIdx)`); React then re-renders only the handful of rows
 * whose numbers actually moved this tick, not the whole grid.
 */
export interface StandingsState {
  order: number[];
  byIdx: Record<number, StandingsEntry>;
  playerCarIdx: number;
  seq: number;
  setStandings: (payload: StandingsPayload, seq: number) => void;
  clear: () => void;
}

/** Shallow field-by-field equality for a standings row. */
function rowEqual(a: StandingsEntry, b: StandingsEntry): boolean {
  return (
    a.position === b.position &&
    a.classPosition === b.classPosition &&
    a.lap === b.lap &&
    a.lapDistPct === b.lapDistPct &&
    a.lastLapTime === b.lastLapTime &&
    a.bestLapTime === b.bestLapTime &&
    a.gapToLeader === b.gapToLeader &&
    a.interval === b.interval &&
    a.gapIsLaps === b.gapIsLaps &&
    a.onPitRoad === b.onPitRoad &&
    a.trackSurfaceLabel === b.trackSurfaceLabel &&
    a.carClassId === b.carClassId &&
    a.isPlayer === b.isPlayer
  );
}

function sameOrder(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export const useStandingsStore = create<StandingsState>((set) => ({
  order: [],
  byIdx: {},
  playerCarIdx: -1,
  seq: -1,
  setStandings: (payload, seq) =>
    set((prev) => {
      const nextByIdx: Record<number, StandingsEntry> = {};
      const order: number[] = new Array(payload.entries.length);

      for (let i = 0; i < payload.entries.length; i++) {
        const entry = payload.entries[i];
        order[i] = entry.carIdx;
        const existing = prev.byIdx[entry.carIdx];
        // Preserve the previous object's identity when nothing changed so row
        // subscribers don't re-render.
        nextByIdx[entry.carIdx] =
          existing && rowEqual(existing, entry) ? existing : entry;
      }

      return {
        order: sameOrder(prev.order, order) ? prev.order : order,
        byIdx: nextByIdx,
        playerCarIdx: payload.playerCarIdx,
        seq,
      };
    }),
  clear: () => set({ order: [], byIdx: {}, playerCarIdx: -1, seq: -1 }),
}));

/** Subscribe to a single standings row; re-renders only when that row changes. */
export function useStandingsRow(carIdx: number): StandingsEntry | undefined {
  return useStandingsStore((s) => s.byIdx[carIdx]);
}
