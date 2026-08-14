/**
 * Pedal shapes for the mock feed — what a *driver* does, not what the speed
 * curve implies.
 *
 * The mock lap derives speed from a geometric corner model, and the pedals used
 * to be read straight off its gradient. That produces a trace no real telemetry
 * ever shows:
 *
 *   - Throttle stepped 1.00 → 0.00 between two frames, a vertical cliff.
 *   - Brake ramped up and then **pinned at exactly 1.00** for the whole zone,
 *     releasing to 0 at the apex in one frame.
 *
 * A driver's inputs have a shape. Coming to a corner they lift, coast for a
 * moment, hit the brake hard, then bleed it off progressively as the car turns
 * in — peak pressure comes early and the pedal is trailing by the apex. Coming
 * out they squeeze the throttle back on over a good fraction of the exit rather
 * than snapping to full. That shape is what makes an input trace legible, and
 * it is what this module models.
 *
 * Crucially there are stretches on **neither** pedal. The brake comes fully off
 * before the apex and the throttle is not picked up until after it, so every
 * corner has a neutral window through the middle; and some entries are taken as
 * a lift-and-coast, off the pedals well before the braking point. A trace where
 * one pedal is always down is as unconvincing as a square wave.
 *
 * The functions here are pure and take an explicit phase, so the shapes can be
 * tested directly rather than inferred from a rendered widget.
 */

/** Where the car is in the corner cycle. */
export const DrivePhase = {
  /** Pedal on the stop, straight-line. */
  FlatOut: "flat-out",
  /** Throttle released, brake not yet applied — the coast before turn-in. */
  Lift: "lift",
  /** Off both pedals: brake released, throttle not yet picked up. */
  Coast: "coast",
  /** On the brake, including the trailing release into the apex. */
  Braking: "braking",
  /** Progressive throttle application from the apex outwards. */
  Squeeze: "squeeze",
} as const;

export type DrivePhase = (typeof DrivePhase)[keyof typeof DrivePhase];

/** Throttle and brake, each 0–1. */
export interface PedalInputs {
  readonly throttle: number;
  readonly brake: number;
}

/**
 * Where the car sits relative to the nearest corner. Both phases are null when
 * the car is on a straight; at most one is ever set.
 */
export interface CornerPhase {
  /** 0 at brake-zone entry → 1 at the apex, or null when not approaching. */
  readonly approach: number | null;
  /** 0 at the apex → 1 back at full speed, or null when not exiting. */
  readonly exit: number | null;
  /** 0 = fast sweeper, 1 = hairpin. Drives pressure and squeeze length. */
  readonly severity: number;
  /**
   * How much of a lift-and-coast this entry is, 0–1. Drivers do not brake at
   * the same point every lap — sometimes they lift early and roll in. Left at 0
   * this is an ordinary entry.
   */
  readonly lift?: number;
}

// ── shape constants ──────────────────────────────────────────────────────────

/** Fraction of the approach spent lifting/coasting before the brake goes on. */
const LIFT_FRACTION = 0.08;
/**
 * How much longer a lift-and-coast entry stays off the pedals, as a share of
 * the approach. Layered on top of {@link LIFT_FRACTION} when a corner is taken
 * that way, so those entries have a visibly long flat-zero stretch.
 */
const LIFT_EXTRA_MAX = 0.34;
/**
 * Share of the approach *after* the brake is fully released — the car is
 * neutral into the apex. Longer in faster corners, where a driver is off both
 * pedals through the middle rather than trailing the brake to the apex.
 */
const APEX_COAST_MIN = 0.06;
const APEX_COAST_MAX = 0.2;
/** Share of the exit before the throttle is picked up, continuing the coast. */
const EXIT_COAST = 0.08;
/** Fraction of the braking zone spent reaching peak pressure. */
const RISE_FRACTION = 0.16;
/** Peak brake pressure for the fastest / slowest corners on the lap. */
const PEAK_MIN = 0.82;
const PEAK_MAX = 1.0;
/** Throttle the moment the car picks it up at the apex. */
const SQUEEZE_START = 0.18;
/** Share of the exit spent winding on to full throttle (fast → slow corner). */
const SQUEEZE_LEN_MIN = 0.3;
const SQUEEZE_LEN_MAX = 0.72;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Smoothstep — an S-curve, which is how a foot actually moves a pedal. */
function smoothstep(v: number): number {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
}

/** Where the lift ends and braking begins, as a share of the approach. */
function liftEnd(lift: number): number {
  return LIFT_FRACTION + clamp01(lift) * LIFT_EXTRA_MAX;
}

/** Where the brake is fully released, as a share of the approach. */
function brakeEnd(severity: number): number {
  // Slow corners are trailed nearly to the apex; fast ones are let go earlier.
  return 1 - (APEX_COAST_MAX - (APEX_COAST_MAX - APEX_COAST_MIN) * clamp01(severity));
}

/** Classify the corner phase. Exported so the shape can be asserted directly. */
export function drivePhase(corner: CornerPhase): DrivePhase {
  const { approach, exit } = corner;
  if (approach != null) {
    if (approach < liftEnd(corner.lift ?? 0)) return DrivePhase.Lift;
    return approach < brakeEnd(corner.severity)
      ? DrivePhase.Braking
      : DrivePhase.Coast;
  }
  if (exit != null) {
    return exit < EXIT_COAST ? DrivePhase.Coast : DrivePhase.Squeeze;
  }
  return DrivePhase.FlatOut;
}

/**
 * Brake pressure across the approach: a quick stab to peak, then a progressive
 * release into the apex. Peak pressure scales with how slow the corner is.
 */
function brakeAt(approach: number, severity: number, lift: number): number {
  const start = liftEnd(lift);
  const end = brakeEnd(severity);
  // Off the brake entirely before the apex: the car rolls in neutral.
  if (approach < start || approach >= end) return 0;
  const u = (approach - start) / Math.max(end - start, 1e-6);
  const peak = PEAK_MIN + (PEAK_MAX - PEAK_MIN) * clamp01(severity);
  if (u < RISE_FRACTION) return peak * smoothstep(u / RISE_FRACTION);
  const trail = (u - RISE_FRACTION) / (1 - RISE_FRACTION);
  // Ends at zero rather than snapping off a trailing 20 %.
  return peak * (1 - smoothstep(trail));
}

/**
 * Throttle across the exit: picked up at {@link SQUEEZE_START} and wound on to
 * full over a slice of the exit that lengthens with corner severity — you are
 * back to full throttle far sooner out of a fast sweeper than a hairpin.
 */
function throttleAt(exit: number, severity: number): number {
  // The coast carries past the apex before the throttle is picked up at all.
  if (exit < EXIT_COAST) return 0;
  const len =
    SQUEEZE_LEN_MIN + (SQUEEZE_LEN_MAX - SQUEEZE_LEN_MIN) * clamp01(severity);
  const u = smoothstep((exit - EXIT_COAST) / len);
  return clamp01(SQUEEZE_START + (1 - SQUEEZE_START) * u);
}

/**
 * The pedals at a point in the corner cycle.
 *
 * Throttle and brake are never both meaningfully applied: the lift phase puts a
 * genuine coast between them, which is the gap the old gradient model lacked.
 */
export function pedalsFor(corner: CornerPhase): PedalInputs {
  const { approach, exit, severity } = corner;
  const lift = clamp01(corner.lift ?? 0);

  if (approach != null) {
    // Release is quick but not instant — this is the edge that used to be a
    // single-frame cliff from 1.00 to 0.00. A lift-and-coast entry releases
    // over the same distance, then simply stays off the pedals for longer.
    const release = clamp01(approach / LIFT_FRACTION);
    return {
      throttle: approach < LIFT_FRACTION ? 1 - smoothstep(release) : 0,
      brake: brakeAt(approach, severity, lift),
    };
  }

  if (exit != null) {
    return { throttle: throttleAt(exit, severity), brake: 0 };
  }

  return { throttle: 1, brake: 0 };
}

/**
 * Speed (km/h) below which the mock driver starts feeding the clutch in, and
 * the speed by which it is on the floor. Spa's La Source, the one hairpin on
 * the mock lap, bottoms out around 63 km/h, so the band sits either side of
 * that: idle everywhere else, most of the way down through the hairpin.
 *
 * Tuned to the mock's own lap rather than to a real one, and worth being plain
 * about why. A GT3 on a flying lap does not touch the clutch at all — it is a
 * sequential box, and the clutch is for the standing start, the pit box and
 * recovering from a spin, none of which this mock models. A mock that showed
 * the truth here would show a bar that never moves, and then nobody could see
 * whether the bar worked. This is the mock earning its keep as a demo (see
 * `mockData`), not a claim about how the pedal is used.
 */
const CLUTCH_LIFT_KMH = 85;
const CLUTCH_FLOOR_KMH = 58;

/**
 * Clutch **pedal travel** at a given speed: 0 = foot off, 1 = to the floor.
 *
 * Note the direction. iRacing's own `Clutch` channel runs the other way
 * ("0=disengaged to 1=fully engaged"), and the bridge flips it before it
 * reaches the app; this models what the driver's foot is doing, so it matches
 * `clutchPedal` and reads like the throttle and brake beside it.
 *
 * Deliberately zero for nearly the whole lap. A clutch that was always doing
 * something would make the third bar look busy and lie about how the pedal is
 * actually used — it is idle from the exit of one hairpin to the entry of the
 * next, and the bar sitting still is the honest picture.
 */
export function clutchFor(kmh: number): number {
  if (kmh >= CLUTCH_LIFT_KMH) return 0;
  const u = (CLUTCH_LIFT_KMH - kmh) / (CLUTCH_LIFT_KMH - CLUTCH_FLOOR_KMH);
  return smoothstep(u);
}

/**
 * How slow a corner is, normalized to 0–1 from its apex speed in km/h.
 * A hairpin lands near 1, a fast sweeper near 0.
 */
export function cornerSeverity(apexKmh: number, topKmh: number): number {
  return clamp01((topKmh - apexKmh) / Math.max(1, topKmh - 40));
}
