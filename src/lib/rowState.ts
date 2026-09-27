/**
 * What state a tower row is in, and how much of it to grey out.
 *
 * Every state carries a word and a glyph, never colour alone, so it survives a
 * colour-blind reader and a sunlit kerb: PIT, OFF TRACK, DAMAGE, FINAL LAP and
 * FINISHED are chips beside the name, OUT is a chip and a greyed row, and DSQ
 * takes over the position block itself and strikes the name through.
 *
 * **OUT, not DISCONNECTED.** The SDK reports a disconnected car and a car
 * being towed the same way — not in the world — and a tow happens in nearly
 * every race. A chip reading DISCONNECTED on a car sitting out a tow would be a
 * visible, frequent lie; OUT is true of both.
 */

import type { StandingsEntry } from "../telemetry/types";

export type ChipKind = "out" | "pit" | "off" | "repair" | "final" | "finished";

export interface RowState {
  dsq: boolean;
  out: boolean;
  pit: boolean;
  /**
   * Grey the whole row — name, numbers, timing. The car is not racing: it is
   * out of the world or disqualified.
   */
  dimAll: boolean;
  /**
   * Grey the *live* timing only — gap, interval, last lap, trend, sectors. A
   * car in the pit lane is still racing, but its live numbers are describing a
   * pit stop, not its pace.
   */
  dimLive: boolean;
  /** Chips beside the name, most important first. */
  chips: ChipKind[];
}

const NONE: RowState = {
  dsq: false,
  out: false,
  pit: false,
  dimAll: false,
  dimLive: false,
  chips: [],
};

export function rowState(e: StandingsEntry | undefined): RowState {
  if (!e) return NONE;
  const dsq = e.isDisqualified === true;
  const out = !e.isInWorld;
  const pit = !out && (e.onPitRoad === true || e.isInPitStall);
  const chips: ChipKind[] = [];
  if (out) chips.push("out");
  if (pit) chips.push("pit");
  if (!out && !pit && e.isOffTrack) chips.push("off");
  if (e.needsRepair && !dsq) chips.push("repair");
  if (e.hasFinished) chips.push("finished");
  else if (e.onFinalLap && !dsq && !out) chips.push("final");
  const dimAll = dsq || out;
  return { dsq, out, pit, dimAll, dimLive: dimAll || pit, chips };
}
