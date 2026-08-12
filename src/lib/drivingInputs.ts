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
 * The functions here are pure and take an explicit phase, so the shapes can be
 * tested directly rather than inferred from a rendered widget.
 */

/** Where the car is in the corner cycle. */
export const DrivePhase = {
  /** Pedal on the stop, straight-line. */
  FlatOut: "flat-out",
  /** Throttle released, brake not yet applied — the coast before turn-in. */
  Lift: "lift",
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
}

// ── shape constants ──────────────────────────────────────────────────────────

/** Fraction of the approach spent lifting/coasting before the brake goes on. */
const LIFT_FRACTION = 0.08;
/** Fraction of the braking zone spent reaching peak pressure. */
const RISE_FRACTION = 0.16;
/** How much of peak pressure is bled off by the apex (trail braking). */
const TRAIL_DEPTH = 0.78;
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

/** Classify the corner phase. Exported so the shape can be asserted directly. */
export function drivePhase(corner: CornerPhase): DrivePhase {
  const { approach, exit } = corner;
  if (approach != null) {
    return approach < LIFT_FRACTION ? DrivePhase.Lift : DrivePhase.Braking;
  }
  if (exit != null) return DrivePhase.Squeeze;
  return DrivePhase.FlatOut;
}

/**
 * Brake pressure across the approach: a quick stab to peak, then a progressive
 * release into the apex. Peak pressure scales with how slow the corner is.
 */
function brakeAt(approach: number, severity: number): number {
  if (approach < LIFT_FRACTION) return 0;
  const u = (approach - LIFT_FRACTION) / (1 - LIFT_FRACTION);
  const peak = PEAK_MIN + (PEAK_MAX - PEAK_MIN) * clamp01(severity);
  if (u < RISE_FRACTION) return peak * smoothstep(u / RISE_FRACTION);
  const trail = (u - RISE_FRACTION) / (1 - RISE_FRACTION);
  return peak * (1 - TRAIL_DEPTH * smoothstep(trail));
}

/**
 * Throttle across the exit: picked up at {@link SQUEEZE_START} and wound on to
 * full over a slice of the exit that lengthens with corner severity — you are
 * back to full throttle far sooner out of a fast sweeper than a hairpin.
 */
function throttleAt(exit: number, severity: number): number {
  const len =
    SQUEEZE_LEN_MIN + (SQUEEZE_LEN_MAX - SQUEEZE_LEN_MIN) * clamp01(severity);
  const u = smoothstep(exit / len);
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

  if (approach != null) {
    // Release is quick but not instant — this is the edge that used to be a
    // single-frame cliff from 1.00 to 0.00.
    const release = clamp01(approach / LIFT_FRACTION);
    return {
      throttle: approach < LIFT_FRACTION ? 1 - smoothstep(release) : 0,
      brake: brakeAt(approach, severity),
    };
  }

  if (exit != null) {
    return { throttle: throttleAt(exit, severity), brake: 0 };
  }

  return { throttle: 1, brake: 0 };
}

/**
 * How slow a corner is, normalized to 0–1 from its apex speed in km/h.
 * A hairpin lands near 1, a fast sweeper near 0.
 */
export function cornerSeverity(apexKmh: number, topKmh: number): number {
  return clamp01((topKmh - apexKmh) / Math.max(1, topKmh - 40));
}
