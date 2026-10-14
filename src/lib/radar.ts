/**
 * Radar geometry: the spotter's call drawn as two lines, one each side of you.
 *
 * Each line is a stretch of track running past your door, {@link LINE_M} ahead
 * of your car's centre at the top and as far behind it at the bottom. A car
 * the spotter calls alongside lights the part of the line it covers, so as a
 * car comes past, its mark slides up the line exactly as it slides up your
 * door — from your rear wheel, level, to your front wheel and away.
 *
 * Everything drawn is measured: the bridge sends each nearby car's gap along
 * the track (lap distance × track length) and, when the spotter has it
 * alongside, its side (see `bridge/telemetrylab/radar.py`). Nothing lateral is
 * drawn, because iRacing never publishes it — the old map's "one lane over"
 * angle was an estimate presented as a reading, and it was the part drivers
 * could not trust.
 *
 * Pure and DOM-free so it can be unit-tested; `RadarWidget` only draws it.
 */

import type { RadarCar, RadarFrame } from "../telemetry/types";

/** Drawn car length, in metres (a GT3's footprint, near enough for any car). */
export const CAR_LENGTH_M = 4.6;

/**
 * Metres of track each line shows ahead of and behind your car's centre. The
 * spotter only calls a car once it overlaps (a gap under a car length), and
 * the bridge matches cars up to 8 m away, so this holds every car it can
 * place with its whole length on the line.
 */
export const LINE_M = 8;

/** A stretch of a line, as fractions of its height: 0 is the top (ahead). */
export interface LineSpan {
  top: number;
  bottom: number;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/** Where along a line a car `gapM` metres ahead of you sits, or null if off it. */
export function carSpan(gapM: number, lineM = LINE_M): LineSpan | null {
  const front = gapM + CAR_LENGTH_M / 2;
  const rear = gapM - CAR_LENGTH_M / 2;
  if (rear >= lineM || front <= -lineM) return null;
  return {
    top: clamp01((lineM - front) / (2 * lineM)),
    bottom: clamp01((lineM - rear) / (2 * lineM)),
  };
}

/** Your own car's stretch of each line: the reference the others are read against. */
export const PLAYER_SPAN: LineSpan = carSpan(0) as LineSpan;

/**
 * How much of the two cars overlap, 0–1: 1 is door to door, 0 is nose to
 * tail. Same-length cars overlap by one car length minus the gap.
 */
export function overlap(gapM: number): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(gapM) / CAR_LENGTH_M));
}

/** One lane of one side: lane 1 is right next to you, lane 2 beyond it. */
export interface RadarLane {
  lane: 1 | 2;
  /**
   * Where the car in this lane is. When the spotter calls a car here but the
   * bridge could not match one by lap distance, this is your own car's span,
   * marked `estimated`: the sim says it is alongside, not where.
   */
  span: LineSpan;
  estimated: boolean;
  /** The car, when one was matched. */
  car: RadarCar | null;
}

export interface RadarSide {
  /** Cars alongside on this side, per the spotter (0–2). */
  count: number;
  /** The lit lanes, inside first; empty when the side is clear. */
  lanes: RadarLane[];
}

export interface RadarLines {
  /** The player is not driving (garage, replay, spectating) or no radar yet. */
  off: boolean;
  left: RadarSide;
  right: RadarSide;
}

function side(frame: RadarFrame, which: "left" | "right"): RadarSide {
  const count = Math.max(0, Math.min(2, which === "left" ? frame.left : frame.right));
  const placed = frame.cars
    .filter((c) => c.side === which)
    .sort((a, b) => (a.lane ?? 1) - (b.lane ?? 1) || Math.abs(a.gapM) - Math.abs(b.gapM));
  const lanes: RadarLane[] = [];
  for (let i = 0; i < count; i++) {
    const lane = (i + 1) as 1 | 2;
    const car = placed[i] ?? null;
    const span = car ? carSpan(car.gapM) : null;
    lanes.push(
      span
        ? { lane, span, estimated: false, car }
        : { lane, span: PLAYER_SPAN, estimated: true, car: null },
    );
  }
  return { count, lanes };
}

const CLEAR: RadarSide = { count: 0, lanes: [] };

/**
 * The radar as lines. The spotter's counts decide whether a side is lit —
 * a car is never drawn on a side the sim has not called — and the bridge's
 * placement decides where along it.
 */
export function radarLines(frame: RadarFrame | null | undefined): RadarLines {
  if (!frame || frame.state === "off") return { off: true, left: CLEAR, right: CLEAR };
  return { off: false, left: side(frame, "left"), right: side(frame, "right") };
}

/** Screen-reader text for the radar: the spotter's call and where the car is. */
export function radarLabel(lines: RadarLines): string {
  if (lines.off) return "Radar: off";
  const part = (name: string, s: RadarSide) => {
    if (s.count === 0) return null;
    const car = s.lanes[0]?.car;
    const where = car ? `, ${gapText(car.gapM)}` : "";
    return `${s.count === 2 ? "two cars" : "car"} ${name}${where}`;
  };
  const parts = [part("left", lines.left), part("right", lines.right)].filter(Boolean);
  return `Radar: ${parts.length ? parts.join("; ") : "clear"}`;
}

/** Under this, a car alongside reads as level with you rather than ahead or behind. */
export const LEVEL_M = 0.5;

/** "1.8 m behind", "level", "0.6 m ahead". */
export function gapText(gapM: number): string {
  if (Math.abs(gapM) < LEVEL_M) return "level";
  return `${Math.abs(gapM).toFixed(1)} m ${gapM > 0 ? "ahead" : "behind"}`;
}
