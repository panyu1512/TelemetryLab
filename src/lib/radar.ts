/**
 * The radar as two LED boxes: an **L** on the left and an **R** on the right,
 * lit when iRacing's spotter calls a car alongside on that side.
 *
 * The spotter (`CarLeftRight`) is the authority on whether a side is
 * occupied; the bridge adds which car it is and how far along you, from lap
 * distance (`bridge/telemetrylab/radar.py`). The boxes only need the first;
 * the second still feeds the screen-reader label.
 *
 * Pure and DOM-free so it can be unit-tested; `RadarWidget` only draws it.
 */

import type { RadarCar, RadarFrame } from "../telemetry/types";

/** One side of the car, as the spotter calls it. */
export interface RadarSide {
  /** Cars alongside on this side, per the spotter (0–2). */
  count: number;
  /** The car right next to you on this side, when the bridge matched one. */
  car: RadarCar | null;
}

export interface RadarSides {
  /** The player is not driving (garage, replay, spectating) or no radar yet. */
  off: boolean;
  left: RadarSide;
  right: RadarSide;
}

const CLEAR: RadarSide = { count: 0, car: null };

function side(frame: RadarFrame, which: "left" | "right"): RadarSide {
  const count = Math.max(0, Math.min(2, which === "left" ? frame.left : frame.right));
  if (count === 0) return CLEAR;
  // The inside car: lane 1 when placed, else the nearest.
  const car =
    frame.cars
      .filter((c) => c.side === which)
      .sort((a, b) => (a.lane ?? 1) - (b.lane ?? 1) || Math.abs(a.gapM) - Math.abs(b.gapM))[0] ??
    null;
  return { count, car };
}

/**
 * Which sides are lit. The spotter's counts decide, every frame — a side is
 * never lit for a car the sim has not called, and always lit when it has,
 * whether or not the bridge could say which car it was.
 */
export function radarSides(frame: RadarFrame | null | undefined): RadarSides {
  if (!frame || frame.state === "off") return { off: true, left: CLEAR, right: CLEAR };
  return { off: false, left: side(frame, "left"), right: side(frame, "right") };
}

/** Under this, a car alongside reads as level with you rather than ahead or behind. */
export const LEVEL_M = 0.5;

/** "1.8 m behind", "level", "0.6 m ahead". */
export function gapText(gapM: number): string {
  if (Math.abs(gapM) < LEVEL_M) return "level";
  return `${Math.abs(gapM).toFixed(1)} m ${gapM > 0 ? "ahead" : "behind"}`;
}

/** Screen-reader text for the radar: the spotter's call and where the car is. */
export function radarLabel(sides: RadarSides): string {
  if (sides.off) return "Radar: off";
  const part = (name: string, s: RadarSide) => {
    if (s.count === 0) return null;
    const where = s.car ? `, ${gapText(s.car.gapM)}` : "";
    return `${s.count === 2 ? "two cars" : "car"} ${name}${where}`;
  };
  const parts = [part("left", sides.left), part("right", sides.right)].filter(Boolean);
  return `Radar: ${parts.length ? parts.join("; ") : "clear"}`;
}

// ── the LED matrix ───────────────────────────────────────────────────────────

/** The matrix is square: a letter 7 dots wide and 9 tall, a dark column either side. */
export const MATRIX_SIZE = 9;

/**
 * The two letters, drawn with a two-dot stroke so they stay bold at the size
 * of a small overlay window. `#` is an LED that lights; `.` one that stays dark.
 */
export const GLYPHS: Record<"L" | "R", readonly string[]> = {
  L: [
    "##.....",
    "##.....",
    "##.....",
    "##.....",
    "##.....",
    "##.....",
    "##.....",
    "#######",
    "#######",
  ],
  R: [
    "######.",
    "#######",
    "##...##",
    "##...##",
    "#######",
    "######.",
    "##.##..",
    "##..##.",
    "##...##",
  ],
};

/**
 * Every LED of the box, row by row: true where the letter lights it. The
 * letter sits centred, with one dark column either side of it, as on the
 * physical boxes this is modelled on.
 */
export function glyphDots(letter: keyof typeof GLYPHS): boolean[] {
  const rows = GLYPHS[letter];
  const pad = Math.floor((MATRIX_SIZE - rows[0].length) / 2);
  const out: boolean[] = [];
  for (let r = 0; r < MATRIX_SIZE; r++) {
    const row = rows[r] ?? "";
    for (let c = 0; c < MATRIX_SIZE; c++) {
      out.push(row[c - pad] === "#");
    }
  }
  return out;
}
