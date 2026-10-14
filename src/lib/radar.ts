/**
 * Radar geometry: where a car alongside sits, and at what angle.
 *
 * The bridge sends each nearby car's gap along the track (exact: lap distance
 * × track length) and, when the spotter has it alongside, its side and lane
 * (see `bridge/telemetrylab/radar.py`). iRacing never publishes how far apart
 * two cars are *across* the track, so a car alongside is put one lane over —
 * {@link LANE_M} centre to centre — or two when the spotter calls two cars on
 * that side. Everything lateral below rests on that one assumption; everything
 * longitudinal is measured.
 *
 * Pure and DOM-free so it can be unit-tested; `RadarWidget` only draws it.
 */

import type { RadarCar, RadarFrame } from "../telemetry/types";

/**
 * Centre-to-centre distance between two cars side by side, in metres. A GT3
 * is ~2.0 m wide; two of them racing door to door leave about half a metre
 * between them.
 */
export const LANE_M = 2.5;

/** Drawn car size, in metres (a GT3's footprint, near enough for any car). */
export const CAR_LENGTH_M = 4.6;
export const CAR_WIDTH_M = 1.95;

/** Metres of track shown each way from the player's car. */
export const VIEW_M = 12;

/** Under this, a car alongside reads as level with you rather than ahead or behind. */
export const LEVEL_M = 0.5;

/** How far across the track a car is from the player, in metres (left negative). */
export function lateralM(car: Pick<RadarCar, "side" | "lane">): number | null {
  if (!car.side) return null;
  const lanes = car.lane ?? 1;
  return (car.side === "left" ? -1 : 1) * lanes * LANE_M;
}

/**
 * Bearing from the player's car to another, in degrees from your car's nose:
 * 0 dead ahead, 90 straight out of your door, 180 dead astern. Always 0–180;
 * the side is carried separately, the way a spotter says it ("left, 120").
 */
export function bearingDeg(gapM: number, latM: number): number {
  const deg = (Math.atan2(Math.abs(latM), gapM) * 180) / Math.PI;
  return Math.round(deg);
}

/**
 * How much of the two cars overlap, 0–1: 1 is door to door, 0 is nose to
 * tail. Same-length cars overlap by one car length minus the gap.
 */
export function overlap(gapM: number): number {
  return Math.max(0, Math.min(1, 1 - Math.abs(gapM) / CAR_LENGTH_M));
}

/** "1.8 m behind", "level", "0.6 m ahead". */
export function gapText(gapM: number): string {
  if (Math.abs(gapM) < LEVEL_M) return "level";
  return `${Math.abs(gapM).toFixed(1)} m ${gapM > 0 ? "ahead" : "behind"}`;
}

/** One car on the radar, resolved for drawing. */
export interface PlacedCar {
  car: RadarCar;
  /** Metres across the track (left negative); `null` when the side is unknown. */
  x: number | null;
  /** Metres along it (ahead positive). */
  y: number;
  /** Bearing in degrees (see {@link bearingDeg}); only for a car alongside. */
  bearing: number | null;
  /** Off the top or bottom of the drawn window — draw an edge marker instead. */
  beyondView: boolean;
}

export function placeCar(car: RadarCar, viewM = VIEW_M): PlacedCar {
  const x = lateralM(car);
  return {
    car,
    x,
    y: car.gapM,
    bearing: x === null ? null : bearingDeg(car.gapM, x),
    beyondView: Math.abs(car.gapM) > viewM - CAR_LENGTH_M / 2,
  };
}

/** The line under the radar: what a spotter would say right now. */
export interface RadarCall {
  /** "LEFT", "RIGHT", "BOTH SIDES", "2 LEFT", "CLEAR", or "—" when off. */
  label: string;
  /** The spotter's counts, which light a side whether or not a car is placed on it. */
  left: number;
  right: number;
  /** The car right next to you on each side — the one its angle and gap describe. */
  leftCar: PlacedCar | null;
  rightCar: PlacedCar | null;
}

const LABELS: Record<RadarFrame["state"], string> = {
  off: "—",
  clear: "CLEAR",
  car_left: "LEFT",
  car_right: "RIGHT",
  car_left_right: "BOTH SIDES",
  two_cars_left: "2 LEFT",
  two_cars_right: "2 RIGHT",
};

/** The inside car on one side: lane 1 if it is placed, else the nearest. */
function nextTo(cars: RadarCar[], side: "left" | "right"): PlacedCar | null {
  const on = cars
    .filter((c) => c.side === side)
    .sort((a, b) => (a.lane ?? 1) - (b.lane ?? 1) || Math.abs(a.gapM) - Math.abs(b.gapM));
  return on.length ? placeCar(on[0]) : null;
}

export function radarCall(frame: RadarFrame | null | undefined): RadarCall {
  if (!frame) {
    return { label: LABELS.off, left: 0, right: 0, leftCar: null, rightCar: null };
  }
  return {
    label: LABELS[frame.state] ?? LABELS.off,
    left: frame.left,
    right: frame.right,
    leftCar: nextTo(frame.cars, "left"),
    rightCar: nextTo(frame.cars, "right"),
  };
}
