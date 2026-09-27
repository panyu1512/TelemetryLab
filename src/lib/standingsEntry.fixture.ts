/**
 * A complete, unremarkable standings row for tests to patch: a car racing on
 * track, in class 1, with nothing special about it. Kept out of any one test
 * file because several need to build fields from it.
 */

import type { StandingsEntry } from "../telemetry/types";

export function entry(carIdx: number, patch: Partial<StandingsEntry> = {}): StandingsEntry {
  return {
    carIdx,
    position: carIdx + 1,
    classPosition: carIdx + 1,
    carClassId: 1,
    lap: 10,
    lapDistPct: 0.5,
    lastLapTime: 92,
    bestLapTime: 91,
    gapToLeader: carIdx * 2,
    interval: carIdx === 0 ? 0 : 2,
    gapIsLaps: false,
    lapsDown: 0,
    gapToClassLeader: carIdx * 2,
    classInterval: carIdx === 0 ? 0 : 2,
    classGapIsLaps: false,
    intervalToPlayer: null,
    estCatchTime: null,
    positionsGainedTotal: 0,
    positionsGainedLastLap: 0,
    iRating: 2500,
    iRatingChangeEst: 0,
    lastLapStatus: "normal",
    sectors: [],
    theoreticalBest: null,
    onPitRoad: false,
    trackSurfaceLabel: "OnTrack",
    isOffTrack: false,
    isInPitStall: false,
    isInWorld: true,
    isRetired: false,
    isPlayer: false,
    isOverallLeader: carIdx === 0,
    isClassLeader: carIdx === 0,
    isLapped: false,
    tireCompound: 0,
    tireLaps: 5,
    ...patch,
  };
}
