import type { TireCompoundInfo } from "../telemetry/types";

/**
 * A compound as the driver reads it off a timing graphic. `dry` is a slick the
 * sim names in no way we recognise ("Dry", "Primary", …), or any slick on a car
 * that lists no compounds at all.
 */
export type TyreCompound = "soft" | "medium" | "hard" | "inter" | "wet" | "dry";

/** The badge's letter for each compound. */
export const TYRE_LETTER: Record<TyreCompound, string> = {
  soft: "S",
  medium: "M",
  hard: "H",
  inter: "I",
  wet: "W",
  dry: "D",
};

/** A compound's name in full, for the badge's tooltip and accessible name. */
export const TYRE_NAME: Record<TyreCompound, string> = {
  soft: "Soft",
  medium: "Medium",
  hard: "Hard",
  inter: "Intermediate",
  wet: "Wet",
  dry: "Dry",
};

/**
 * Names iRacing gives its compounds, checked in order. "Wet" is the only
 * treaded tyre that ships today; "inter" and "rain" are here so an
 * intermediate or a renamed wet still reads as one rather than falling
 * through to a dry. "Supersoft" and the like land on soft.
 */
const BY_NAME: readonly (readonly [RegExp, TyreCompound])[] = [
  [/inter/i, "inter"],
  [/wet|rain/i, "wet"],
  [/soft/i, "soft"],
  [/med/i, "medium"],
  [/hard/i, "hard"],
];

/**
 * A car's compound, or `null` when we cannot say.
 *
 * `compounds` is the player car's `DriverTires` list — the only one the sim
 * publishes — applied to the whole field. That is exact for every car of the
 * player's model, and holds across the rain-capable classes in practice, which
 * list their dry compounds before the wet.
 *
 * - An index in the list is classified by its name.
 * - An empty list means the player's car has no wet tyre (or the bridge
 *   predates the field): every car is on a dry, because before the sim had
 *   rain it had no wet compounds at all.
 * - An index missing from a non-empty list belongs to some other car's range,
 *   so the answer is `null` and the cell falls back to the compound letter.
 */
export function tyreCompound(
  compound: number | null,
  compounds: readonly TireCompoundInfo[] | undefined,
): TyreCompound | null {
  if (compound == null) return null;
  if (!compounds || compounds.length === 0) return "dry";
  const entry = compounds.find((c) => c.index === compound);
  if (!entry) return null;
  return BY_NAME.find(([re]) => re.test(entry.type))?.[1] ?? "dry";
}

/** The sim's name for a compound ("Hard", "Wet"), or `null` if unlisted. */
export function tyreName(
  compound: number | null,
  compounds: readonly TireCompoundInfo[] | undefined,
): string | null {
  if (compound == null) return null;
  const name = compounds?.find((c) => c.index === compound)?.type;
  return name ? name : null;
}
