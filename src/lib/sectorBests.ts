/**
 * Class-best sectors — the bar a sector has to meet to paint purple on the
 * tower.
 *
 * The bridge grades each sector against the *whole field* (`overall_best`),
 * which in a multi-class race means the slower classes never see purple at all:
 * a GT4 does not set a sector faster than a GT3. The tower grades against the
 * car's own class instead, because that is the field it is racing, so the
 * per-class best is derived here from what every car in the class has done.
 */

import type { SectorSplit, StandingsEntry } from "../telemetry/types";

/** Tolerance for "equal to the best": sector times arrive rounded to 1 ms. */
const EPS = 1e-3;

/**
 * For each class, the quickest personal-best time anyone in it holds for each
 * sector (`null` where nobody has one yet).
 */
export function classBestSectors(
  entries: readonly StandingsEntry[],
  sectorCount: number,
): Record<number, (number | null)[]> {
  const out: Record<number, (number | null)[]> = {};
  for (const e of entries) {
    const bests = (out[e.carClassId] ??= Array.from({ length: sectorCount }, () => null));
    for (let i = 0; i < sectorCount; i++) {
      const t = e.sectors[i]?.bestTime;
      if (t == null || t <= 0) continue;
      const cur = bests[i];
      if (cur == null || t < cur) bests[i] = t;
    }
  }
  return out;
}

/** Same classes with the same sector bests — to keep the map's identity stable. */
export function sameClassBests(
  a: Readonly<Record<number, (number | null)[]>>,
  b: Readonly<Record<number, (number | null)[]>>,
): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) {
    const x = a[Number(k)];
    const y = b[Number(k)];
    if (!y || x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  }
  return true;
}

/**
 * How the tower grades one sector cell.
 *
 * `class_best` — this lap's sector *is* the class best: purple fill.
 * `personal_best` — the car's own best: green tint.
 * `much_slower` — well off its own best: orange ink.
 * `slower` — a little off: the plain delta.
 */
export type TowerSectorGrade = "class_best" | "personal_best" | "much_slower" | "slower" | "none";

export function gradeSector(
  sector: SectorSplit | undefined,
  classBest: number | null | undefined,
): TowerSectorGrade {
  if (!sector || sector.lastTime == null) return "none";
  if (classBest != null && sector.lastTime <= classBest + EPS) return "class_best";
  if (sector.status === "overall_best" || sector.status === "personal_best") {
    return "personal_best";
  }
  if (sector.status === "much_slower") return "much_slower";
  return "slower";
}
