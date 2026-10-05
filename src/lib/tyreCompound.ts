import type { TireCompoundInfo } from "../telemetry/types";

/** What a compound is for, as far as the driver cares: dry or wet running. */
export type TyreKind = "slick" | "wet";

/**
 * Names iRacing gives a treaded tyre. Only "Wet" ships today; "inter" and
 * "rain" are here so an intermediate or a renamed wet still reads as treaded
 * rather than falling through to a slick.
 */
const WET_NAME = /wet|inter|rain/i;

/**
 * Whether a car's compound is a slick or a wet, or `null` when we cannot say.
 *
 * `compounds` is the player car's `DriverTires` list — the only one the sim
 * publishes — applied to the whole field. That is exact for every car of the
 * player's model, and holds across the rain-capable classes in practice, which
 * list their dry compounds before the wet.
 *
 * - An index in the list is classified by its name.
 * - An empty list means the player's car has no wet tyre (or the bridge
 *   predates the field): every car is on a slick, because before the sim had
 *   rain it had no wet compounds at all.
 * - An index missing from a non-empty list belongs to some other car's range,
 *   so the answer is `null` and the cell falls back to the compound letter.
 */
export function tyreKind(
  compound: number | null,
  compounds: readonly TireCompoundInfo[] | undefined,
): TyreKind | null {
  if (compound == null) return null;
  if (!compounds || compounds.length === 0) return "slick";
  const entry = compounds.find((c) => c.index === compound);
  if (!entry) return null;
  return WET_NAME.test(entry.type) ? "wet" : "slick";
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
