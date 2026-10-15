/**
 * The coach overlay's logic: which corners become tips, what each one says,
 * and what state the screen is in.
 *
 * The bridge's coach (`bridge/telemetrylab/coaching/`) sends every corner of
 * the last lap, gains included, each with its measurements and a cause. It
 * deliberately does not decide what is worth saying — that depends on two
 * preferences the driver sets in the Manager (the smallest loss worth a tip,
 * and how many tips to show), so it is decided here, at render time, and a
 * change to either re-renders the open overlay without waiting for a lap.
 *
 * Everything here is pure and tested without React.
 */

import type {
  CoachCause,
  CoachCorner,
  CoachInvalidReason,
  CoachingPayload,
  CornerAnalysis,
  SessionBestRef,
} from "../telemetry/types";
import { formatDriverName } from "./driverName";

export interface CoachOptions {
  /** The smallest loss, in seconds, worth a tip. */
  minLoss: number;
  /** How many tips to show at most. */
  tipCount: number;
}

export const MIN_LOSS_DEFAULT = 0.05;
export const MIN_LOSS_MIN = 0.02;
export const MIN_LOSS_MAX = 0.3;
export const TIP_COUNT_DEFAULT = 2;
export const TIP_COUNT_MIN = 1;
export const TIP_COUNT_MAX = 3;

/** Causes that blame the driver — the only ones that become tips. */
const DRIVER_CAUSES: ReadonlySet<CoachCause> = new Set([
  "early_brake",
  "coasting",
  "overdrove",
  "over_slowed",
  "late_throttle",
  "slow_exit",
  "line",
]);

export function isDriverCause(cause: CoachCause): boolean {
  return DRIVER_CAUSES.has(cause);
}

// ── grading ──────────────────────────────────────────────────────────────────

/**
 * How a corner went, in the timing surfaces' status language: `gain` green,
 * `loss` amber, `big` red, `even` unmarked. "Big" is three tips' worth of
 * loss, and never less than a quarter of a second — the point at which the
 * Standings' sector grading also turns red (`MUCH_SLOWER_THRESHOLD` there is
 * per sector; a corner is a smaller piece of lap, so this sits lower).
 */
export type CornerGrade = "gain" | "even" | "loss" | "big";

export function cornerGrade(timeLost: number, minLoss: number): CornerGrade {
  if (timeLost <= -minLoss) return "gain";
  if (timeLost < minLoss) return "even";
  return timeLost >= Math.max(0.25, 3 * minLoss) ? "big" : "loss";
}

export function gradeColor(grade: CornerGrade): string {
  switch (grade) {
    case "gain":
      return "var(--color-accent)";
    case "loss":
      return "var(--color-warning)";
    case "big":
      return "var(--color-danger)";
    default:
      return "var(--color-muted)";
  }
}

// ── wording ──────────────────────────────────────────────────────────────────

const MINUS = "−";

/** `+0.21 s` / `−0.08 s` — a corner's or a lap's time against the reference. */
export function formatLoss(seconds: number, digits = 2): string {
  const sign = seconds >= 0 ? "+" : MINUS;
  return `${sign}${Math.abs(seconds).toFixed(digits)} s`;
}

function metres(x: number): number {
  return Math.round(Math.abs(x));
}

function kmh(x: number): number {
  return Math.round(Math.abs(x));
}

/** The short tag a corner wears in the corner list. */
export function causeTag(cause: CoachCause): string {
  switch (cause) {
    case "early_brake":
      return "Early brake";
    case "coasting":
      return "Coasting";
    case "overdrove":
      return "Too hot";
    case "over_slowed":
      return "Over-slowed";
    case "late_throttle":
      return "Late throttle";
    case "slow_exit":
      return "Slow exit";
    case "traffic":
      return "Traffic";
    case "gain":
      return "Gained";
    case "line":
      return "Slower";
    default:
      return "";
  }
}

/**
 * One sentence: what went wrong, with the number that says how much. Falls
 * back to the plain phrase when the bridge could not measure that number (no
 * braking zone to compare, say).
 */
export function causeHeadline(a: CornerAnalysis): string {
  switch (a.cause) {
    case "early_brake":
      return a.brakeDeltaM == null
        ? "Braked early"
        : `Braked ${metres(a.brakeDeltaM)} m early`;
    case "coasting":
      return a.coastDeltaM == null
        ? "Coasted off both pedals"
        : `Coasted ${metres(a.coastDeltaM)} m off both pedals`;
    case "overdrove":
      return a.minSpeedDeltaKmh == null
        ? "Too hot into the corner"
        : `Too hot in — apex ${kmh(a.minSpeedDeltaKmh)} km/h slower`;
    case "over_slowed":
      return a.minSpeedDeltaKmh == null
        ? "Over-slowed the apex"
        : `Over-slowed — apex ${kmh(a.minSpeedDeltaKmh)} km/h slower`;
    case "late_throttle":
      return a.throttleDeltaM == null
        ? "Late back on the throttle"
        : `Back on the throttle ${metres(a.throttleDeltaM)} m later`;
    case "slow_exit":
      return a.exitSpeedDeltaKmh == null
        ? "Slow out of the corner"
        : `Exit ${kmh(a.exitSpeedDeltaKmh)} km/h slower`;
    case "traffic":
      return "Held up by traffic";
    case "gain":
      return "Gained on your reference";
    case "even":
      return "Matched your reference";
    default:
      return "Slower through the corner";
  }
}

type Measure = "brake" | "entry" | "apex" | "throttle" | "exit" | "coast";

/** The measurement each cause's headline already quotes. */
const PRIMARY: Partial<Record<CoachCause, Measure>> = {
  early_brake: "brake",
  coasting: "coast",
  overdrove: "apex",
  over_slowed: "apex",
  late_throttle: "throttle",
  slow_exit: "exit",
};

function signed(x: number, unit: string, round: (v: number) => number): string {
  return `${x >= 0 ? "+" : MINUS}${round(x)} ${unit}`;
}

/**
 * The supporting numbers, quietest last: everything that moved by enough to
 * matter except the one the headline already says. At most three — a detail
 * line read at 200 km/h is a glance, not a table.
 */
export function causeDetail(a: CornerAnalysis): string[] {
  const skip = PRIMARY[a.cause];
  const out: string[] = [];
  const add = (m: Measure, text: string | null) => {
    if (m !== skip && text) out.push(text);
  };
  const b = a.brakeDeltaM;
  add(
    "brake",
    b != null && Math.abs(b) >= 3
      ? b > 0
        ? `braked ${metres(b)} m early`
        : `braked ${metres(b)} m late`
      : null,
  );
  const e = a.entrySpeedDeltaKmh;
  add("entry", e != null && Math.abs(e) >= 2 ? `entry ${signed(e, "km/h", kmh)}` : null);
  const ap = a.minSpeedDeltaKmh;
  add("apex", ap != null && Math.abs(ap) >= 1.5 ? `apex ${signed(ap, "km/h", kmh)}` : null);
  const th = a.throttleDeltaM;
  add(
    "throttle",
    th != null && Math.abs(th) >= 5 ? `throttle ${signed(th, "m", metres)}` : null,
  );
  const ex = a.exitSpeedDeltaKmh;
  add("exit", ex != null && Math.abs(ex) >= 1.5 ? `exit ${signed(ex, "km/h", kmh)}` : null);
  const c = a.coastDeltaM;
  add("coast", c != null && c >= 10 ? `coast +${metres(c)} m` : null);
  return out.slice(0, 3);
}

/** "4 of the last 6 laps" — only when it is a habit, not a one-off. */
export function repeatText(a: CornerAnalysis): string | null {
  if (!isDriverCause(a.cause) || a.repeat < 2 || a.repeatWindow < 2) return null;
  return `${a.repeat} of the last ${a.repeatWindow} laps`;
}

export function invalidReasonText(reason: CoachInvalidReason | null): string {
  switch (reason) {
    case "pit":
      return "pit lane";
    case "reset":
      return "reset or tow";
    case "incomplete":
      return "telemetry gap";
    case "off_track":
      return "off track";
    case "incident":
      return "incident";
    default:
      return "not a clean lap";
  }
}

// ── tips ─────────────────────────────────────────────────────────────────────

export interface CoachTip {
  corner: number;
  label: string;
  timeLost: number;
  cause: CoachCause;
  grade: CornerGrade;
  headline: string;
  detail: string[];
  repeat: string | null;
}

function labelOf(corners: CoachCorner[], n: number): string {
  return corners.find((c) => c.number === n)?.label ?? `T${n}`;
}

function toTip(a: CornerAnalysis, corners: CoachCorner[], minLoss: number): CoachTip {
  return {
    corner: a.corner,
    label: labelOf(corners, a.corner),
    timeLost: a.timeLost,
    cause: a.cause,
    grade: cornerGrade(a.timeLost, minLoss),
    headline: causeHeadline(a),
    detail: causeDetail(a),
    repeat: repeatText(a),
  };
}

/** The corners worth a tip: driver causes at or over `minLoss`, biggest first. */
export function pickTips(payload: CoachingPayload, opts: CoachOptions): CoachTip[] {
  return payload.analysis
    .filter((a) => isDriverCause(a.cause) && a.timeLost >= opts.minLoss)
    .sort((x, y) => y.timeLost - x.timeLost)
    .slice(0, Math.max(0, opts.tipCount))
    .map((a) => toTip(a, payload.corners, opts.minLoss));
}

/** Where a new best came from: the corners gained by `minLoss` or more. */
export function pickGains(payload: CoachingPayload, opts: CoachOptions): CoachTip[] {
  return payload.analysis
    .filter((a) => a.timeLost <= -opts.minLoss)
    .sort((x, y) => x.timeLost - y.timeLost)
    .slice(0, Math.max(0, opts.tipCount))
    .map((a) => toTip(a, payload.corners, opts.minLoss));
}

// ── the screen's state ───────────────────────────────────────────────────────

export type CoachView =
  /** Nothing from the bridge yet. */
  | { kind: "none" }
  /** No reference yet; the last lap (if any) did not count. */
  | { kind: "waiting"; lap: number | null; reason: CoachInvalidReason | null }
  /** The last lap could not be compared at all. */
  | { kind: "skipped"; lap: number; reason: CoachInvalidReason | null }
  /** The first clean lap: it is the reference now, nothing to compare yet. */
  | { kind: "reference"; lap: number; lapTime: number }
  /** A new best — and where it was found. */
  | { kind: "best"; lap: number; lapTime: number; delta: number; gains: CoachTip[] }
  /** Compared, and no corner lost enough to be worth saying. */
  | { kind: "clean"; lap: number; delta: number; unclean: CoachInvalidReason | null }
  /** Compared, with something to say. */
  | {
      kind: "tips";
      lap: number;
      delta: number;
      tips: CoachTip[];
      unclean: CoachInvalidReason | null;
    };

export function coachView(payload: CoachingPayload | null, opts: CoachOptions): CoachView {
  if (!payload) return { kind: "none" };
  const last = payload.lastLap;
  if (payload.state === "waiting" || !last) {
    return { kind: "waiting", lap: last?.lap ?? null, reason: last?.invalidReason ?? null };
  }
  if (payload.state === "skipped") {
    return { kind: "skipped", lap: last.lap, reason: last.invalidReason };
  }
  if (payload.newReference) {
    if (payload.analysis.length === 0 || last.delta == null) {
      return { kind: "reference", lap: last.lap, lapTime: last.lapTime };
    }
    return {
      kind: "best",
      lap: last.lap,
      lapTime: last.lapTime,
      delta: last.delta,
      gains: pickGains(payload, opts),
    };
  }
  const delta = last.delta ?? 0;
  const unclean = last.valid ? null : last.invalidReason;
  const tips = pickTips(payload, opts);
  if (tips.length === 0) return { kind: "clean", lap: last.lap, delta, unclean };
  return { kind: "tips", lap: last.lap, delta, tips, unclean };
}

// ── the lap strip and corner list ────────────────────────────────────────────

export interface LapSegment {
  corner: number;
  label: string;
  /** Lap fractions; a segment that wraps the line is split into two. */
  from: number;
  to: number;
  timeLost: number | null;
}

/**
 * Each corner's segment along the lap — from its start to the next corner's —
 * for the strip under the tips. The one that wraps the line (on most tracks
 * the first corner's braking zone starts before it) comes back as two pieces,
 * at the right-hand end of the strip and at the left.
 */
export function lapSegments(
  corners: CoachCorner[],
  analysis: CornerAnalysis[],
): LapSegment[] {
  if (corners.length === 0) return [];
  const lost = new Map(analysis.map((a) => [a.corner, a.timeLost]));
  const sorted = [...corners].sort((a, b) => a.startPct - b.startPct);
  const out: LapSegment[] = [];
  sorted.forEach((c, i) => {
    const next = sorted[(i + 1) % sorted.length];
    const base = { corner: c.number, label: c.label, timeLost: lost.get(c.number) ?? null };
    if (sorted.length === 1) {
      out.push({ ...base, from: 0, to: 1 });
    } else if (next.startPct > c.startPct) {
      out.push({ ...base, from: c.startPct, to: next.startPct });
    } else {
      out.push({ ...base, from: c.startPct, to: 1 });
      if (next.startPct > 0) out.push({ ...base, from: 0, to: next.startPct });
    }
  });
  return out.sort((a, b) => a.from - b.from);
}

/**
 * Half-width of the corner list's diverging bars, in seconds: the biggest
 * swing on this lap, but never under 0.3 s — so a lap of small losses does
 * not draw them as full-width alarms.
 */
export function barScale(analysis: ReadonlyArray<{ timeLost: number }>): number {
  return analysis.reduce((m, a) => Math.max(m, Math.abs(a.timeLost)), 0.3);
}

// ── the session best ─────────────────────────────────────────────────────────

/** One corner of the last lap against the session best, ready to draw. */
export interface BestRow {
  corner: number;
  label: string;
  /** Seconds: + lost to the session best, − gained on it. */
  timeLost: number;
}

/**
 * The last lap's corners against the session best, in the coach's corner
 * order with the coach's labels. Empty when the lap was not compared (an
 * older bridge, no session best yet, or a lap that was not timed).
 */
export function vsBestRows(payload: CoachingPayload | null): BestRow[] {
  const vs = payload?.vsBest;
  if (!vs) return [];
  const label = new Map(payload.corners.map((c) => [c.number, c.label]));
  return vs.corners.map((c) => ({
    corner: c.corner,
    label: label.get(c.corner) ?? `T${c.corner}`,
    timeLost: c.timeLost,
  }));
}

/**
 * Who holds a session best, as the overlay names them: "You" for the player's
 * own lap, else the driver's name from the roster, else their car number,
 * else the car slot.
 */
export function bestHolder(
  ref: Pick<SessionBestRef, "carIdx" | "isPlayer">,
  driver?: { userName?: string | null; carNumber?: string | null } | null,
): string {
  if (ref.isPlayer) return "You";
  const name = formatDriverName(driver?.userName);
  if (name) return name;
  if (driver?.carNumber) return `#${driver.carNumber}`;
  return ref.carIdx != null ? `Car ${ref.carIdx}` : "—";
}
