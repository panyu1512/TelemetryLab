import { create } from "zustand";
import type {
  ClassStanding,
  SectorSplit,
  StandingsEntry,
  StandingsPayload,
} from "../telemetry/types";

/**
 * Medium-frequency (~10 Hz) computed field order for the timing screen.
 *
 * The whole design goal is to re-render **only the rows that changed** at 100+
 * cars × 10 Hz. To get there we normalize the payload:
 *
 *   - `order`      — overall carIdx sequence (drives row mounting / FLIP only).
 *   - `byIdx`      — carIdx → entry, where **unchanged rows keep their object
 *                    identity** so a row's `useStandingsRow(carIdx)` subscriber
 *                    doesn't re-render when its numbers didn't move.
 *   - `classes`    — per-class grouping metadata (headers, collapse, filter).
 *   - `meta`       — small field-wide values (bests, sector count) that a few
 *                    header cells read.
 *
 * A row component subscribes to exactly its own entry; React then re-renders the
 * handful of rows whose numbers actually changed this tick, not the whole grid.
 */
export interface StandingsMeta {
  playerCarIdx: number;
  sectorCount: number;
  overallBestLap: number | null;
  overallBestLapCarIdx: number | null;
  overallBestSectors: (number | null)[];
}

export interface StandingsState {
  order: number[];
  byIdx: Record<number, StandingsEntry>;
  classes: ClassStanding[];
  meta: StandingsMeta;
  seq: number;
  setStandings: (payload: StandingsPayload, seq: number) => void;
  clear: () => void;
}

const EMPTY_META: StandingsMeta = {
  playerCarIdx: -1,
  sectorCount: 0,
  overallBestLap: null,
  overallBestLapCarIdx: null,
  overallBestSectors: [],
};

/** Cheap signature of a car's sector splits, for identity preservation. */
function sectorsEqual(a: SectorSplit[], b: SectorSplit[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].lastTime !== b[i].lastTime ||
      a[i].bestTime !== b[i].bestTime ||
      a[i].status !== b[i].status
    )
      return false;
  }
  return true;
}

/** Field-by-field equality for a standings row (all rendered fields). */
function rowEqual(a: StandingsEntry, b: StandingsEntry): boolean {
  return (
    a.position === b.position &&
    a.classPosition === b.classPosition &&
    a.carClassId === b.carClassId &&
    a.lap === b.lap &&
    a.lastLapTime === b.lastLapTime &&
    a.bestLapTime === b.bestLapTime &&
    a.gapToLeader === b.gapToLeader &&
    a.interval === b.interval &&
    a.gapIsLaps === b.gapIsLaps &&
    a.lapsDown === b.lapsDown &&
    a.gapToClassLeader === b.gapToClassLeader &&
    a.classInterval === b.classInterval &&
    a.classGapIsLaps === b.classGapIsLaps &&
    a.intervalToPlayer === b.intervalToPlayer &&
    a.estCatchTime === b.estCatchTime &&
    a.positionsGainedTotal === b.positionsGainedTotal &&
    a.positionsGainedLastLap === b.positionsGainedLastLap &&
    a.iRatingChangeEst === b.iRatingChangeEst &&
    a.lastLapStatus === b.lastLapStatus &&
    a.theoreticalBest === b.theoreticalBest &&
    a.onPitRoad === b.onPitRoad &&
    a.trackSurfaceLabel === b.trackSurfaceLabel &&
    a.isOffTrack === b.isOffTrack &&
    a.isInPitStall === b.isInPitStall &&
    a.isInWorld === b.isInWorld &&
    a.isRetired === b.isRetired &&
    a.isPlayer === b.isPlayer &&
    a.isOverallLeader === b.isOverallLeader &&
    a.isClassLeader === b.isClassLeader &&
    a.isLapped === b.isLapped &&
    sectorsEqual(a.sectors, b.sectors)
  );
}

function sameOrder(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Shallow equality for the class-grouping array (rebuilds are rare). */
function classesEqual(a: ClassStanding[], b: ClassStanding[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x.carClassId !== y.carClassId ||
      x.carCount !== y.carCount ||
      x.leaderCarIdx !== y.leaderCarIdx ||
      x.leaderLap !== y.leaderLap ||
      x.sof !== y.sof ||
      x.fastestLap !== y.fastestLap ||
      !sameOrder(x.order, y.order)
    )
      return false;
  }
  return true;
}

function metaEqual(a: StandingsMeta, b: StandingsMeta): boolean {
  return (
    a.playerCarIdx === b.playerCarIdx &&
    a.sectorCount === b.sectorCount &&
    a.overallBestLap === b.overallBestLap &&
    a.overallBestLapCarIdx === b.overallBestLapCarIdx &&
    a.overallBestSectors.length === b.overallBestSectors.length &&
    a.overallBestSectors.every((v, i) => v === b.overallBestSectors[i])
  );
}

export const useStandingsStore = create<StandingsState>((set) => ({
  order: [],
  byIdx: {},
  classes: [],
  meta: EMPTY_META,
  seq: -1,
  setStandings: (payload, seq) =>
    set((prev) => {
      const nextByIdx: Record<number, StandingsEntry> = {};
      const order: number[] = new Array(payload.entries.length);

      for (let i = 0; i < payload.entries.length; i++) {
        const entry = payload.entries[i];
        order[i] = entry.carIdx;
        const existing = prev.byIdx[entry.carIdx];
        nextByIdx[entry.carIdx] =
          existing && rowEqual(existing, entry) ? existing : entry;
      }

      const meta: StandingsMeta = {
        playerCarIdx: payload.playerCarIdx,
        sectorCount: payload.sectorCount,
        overallBestLap: payload.overallBestLap,
        overallBestLapCarIdx: payload.overallBestLapCarIdx,
        overallBestSectors: payload.overallBestSectors,
      };

      return {
        order: sameOrder(prev.order, order) ? prev.order : order,
        byIdx: nextByIdx,
        classes: classesEqual(prev.classes, payload.classes)
          ? prev.classes
          : payload.classes,
        meta: metaEqual(prev.meta, meta) ? prev.meta : meta,
        seq,
      };
    }),
  clear: () =>
    set({ order: [], byIdx: {}, classes: [], meta: EMPTY_META, seq: -1 }),
}));

/** Subscribe to a single standings row; re-renders only when that row changes. */
export function useStandingsRow(carIdx: number): StandingsEntry | undefined {
  return useStandingsStore((s) => s.byIdx[carIdx]);
}

/** The per-class grouping (headers, collapse, filter). Stable across ticks. */
export function useStandingsClasses(): ClassStanding[] {
  return useStandingsStore((s) => s.classes);
}

/** Small field-wide values (bests, sector count). Stable across ticks. */
export function useStandingsMeta(): StandingsMeta {
  return useStandingsStore((s) => s.meta);
}

/** The overall carIdx order (drives grouping fallback + row mounting). */
export function useStandingsOrder(): number[] {
  return useStandingsStore((s) => s.order);
}
