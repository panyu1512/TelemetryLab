/**
 * What a car's tyre is, for the tower's tyre cell.
 *
 * `CarIdxTireCompound` is only an index, and what an index means varies by
 * series — 0 is a hard in one and a wet in another. The session now names each
 * one (`DriverInfo:DriverTires`, see `TireCompoundInfo`), so the cell can say
 * *soft* rather than *0*. Where the table is missing — an older bridge, an older
 * sim build, a car that doesn't publish it — the cell falls back to the letters
 * it always printed (P/A/B/C), in a neutral ring, rather than guessing.
 */

import type { TireCompoundInfo } from "../telemetry/types";

export type CompoundKind = "soft" | "medium" | "hard" | "inter" | "wet" | "other";

export interface CompoundLook {
  kind: CompoundKind;
  /**
   * The letter drawn inside the ring. Empty for a wet, which draws a drop
   * instead — the one compound that is a different *kind* of tyre rather than a
   * different hardness, so it gets a different shape rather than a letter.
   */
  letter: string;
  /** Full name, for the tooltip and the screen reader. */
  label: string;
}

/** The legacy labels for a bare index: primary, alternate, then B, C… */
const INDEX_LETTER: Record<number, string> = { 0: "P", 1: "A", 2: "B", 3: "C" };

/**
 * Classify iRacing's `TireCompoundType` string. Matched on substrings so the
 * spellings the sim uses across series ("Soft", "Medium", "Hard",
 * "Intermediate", "Wet", "Rain", "Qualifying", "All-Purpose", "Dry") land
 * without a table per series.
 */
function classify(type: string): CompoundLook {
  const t = type.trim().toLowerCase();
  // "inter" before "medium": "Intermediate" has "med" in it, and an
  // intermediate is a wet-weather tyre, not a dry one.
  if (t.includes("inter")) return { kind: "inter", letter: "I", label: "Intermediate" };
  if (t.includes("soft")) return { kind: "soft", letter: "S", label: "Soft" };
  if (t.includes("medium")) return { kind: "medium", letter: "M", label: "Medium" };
  if (t.includes("hard")) return { kind: "hard", letter: "H", label: "Hard" };
  if (t.includes("wet") || t.includes("rain")) return { kind: "wet", letter: "", label: "Wet" };
  const name = type.trim();
  return {
    kind: "other",
    letter: (name[0] ?? "?").toUpperCase(),
    label: name || "Unknown compound",
  };
}

/**
 * The look for compound `index` given this session's tyre table, or null when
 * the car reports no compound at all.
 */
export function compoundLook(
  index: number | null | undefined,
  table: readonly TireCompoundInfo[] | undefined,
): CompoundLook | null {
  if (index == null || index < 0) return null;
  const named = table?.find((t) => t.index === index);
  if (named && named.type.trim()) return classify(named.type);
  const letter = INDEX_LETTER[index] ?? String(index);
  return { kind: "other", letter, label: `Compound ${letter}` };
}
