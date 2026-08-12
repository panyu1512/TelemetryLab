import { describe, expect, it } from "vitest";

import type { Equals, Expect } from "./typeAssert";
import type { CornerPhase, PedalInputs } from "./drivingInputs";
import {
  cornerSeverity,
  DrivePhase,
  drivePhase,
  pedalsFor,
} from "./drivingInputs";

/** Sample the approach (entry → apex) at `n` points. */
function approachSweep(severity = 0.8, n = 60): PedalInputs[] {
  return Array.from({ length: n }, (_, i) =>
    pedalsFor({ approach: i / (n - 1), exit: null, severity }),
  );
}

/** Sample the exit (apex → full speed) at `n` points. */
function exitSweep(severity = 0.8, n = 60): PedalInputs[] {
  return Array.from({ length: n }, (_, i) =>
    pedalsFor({ approach: null, exit: i / (n - 1), severity }),
  );
}

const phase = (p: Partial<CornerPhase>): CornerPhase => ({
  approach: null,
  exit: null,
  severity: 0.8,
  ...p,
});

describe("pedalsFor — straights", () => {
  it("pins the throttle and leaves the brake alone", () => {
    expect(pedalsFor(phase({}))).toEqual({ throttle: 1, brake: 0 });
  });
});

describe("pedalsFor — approach", () => {
  it("releases the throttle progressively rather than in one step", () => {
    const sweep = approachSweep();
    // The regression this module exists for: the old model dropped 1.00 → 0.00
    // between two frames. No adjacent pair may fall by more than a third.
    const worst = Math.max(
      ...sweep.slice(1).map((s, i) => sweep[i].throttle - s.throttle),
    );
    expect(worst).toBeLessThan(0.34);
  });

  it("coasts: the throttle is off before the brake comes on", () => {
    const sweep = approachSweep();
    const firstBrake = sweep.findIndex((s) => s.brake > 0.01);
    expect(firstBrake).toBeGreaterThan(0);
    expect(sweep[firstBrake].throttle).toBe(0);
  });

  it("never applies both pedals meaningfully at once", () => {
    for (const s of approachSweep()) {
      expect(Math.min(s.throttle, s.brake)).toBeLessThan(0.02);
    }
  });

  it("peaks early and trails off into the apex", () => {
    const sweep = approachSweep();
    const peakAt = sweep.reduce(
      (best, s, i) => (s.brake > sweep[best].brake ? i : best),
      0,
    );
    // Peak pressure arrives in the first half of the zone…
    expect(peakAt / sweep.length).toBeLessThan(0.5);
    // …and the pedal is fully released before the apex, leaving the car
    // neutral through the middle rather than trailing brake into it.
    expect(sweep[sweep.length - 1].brake).toBe(0);
    // The release is progressive, not a snap: the last pressure before zero is
    // a small fraction of peak.
    const lastOn = sweep.filter((s) => s.brake > 0).pop()!;
    expect(lastOn.brake).toBeLessThan(sweep[peakAt].brake * 0.4);
  });

  it("does not pin the brake at a constant value through the zone", () => {
    // The old model sat at exactly 1.00 for the whole zone.
    const braking = approachSweep().filter((s) => s.brake > 0.01);
    const distinct = new Set(braking.map((s) => s.brake.toFixed(3)));
    expect(distinct.size).toBeGreaterThan(braking.length * 0.8);
  });

  it("brakes harder for a hairpin than for a fast sweeper", () => {
    const peak = (sev: number) =>
      Math.max(...approachSweep(sev).map((s) => s.brake));
    expect(peak(1)).toBeGreaterThan(peak(0));
  });
});

describe("pedalsFor — exit", () => {
  it("squeezes the throttle on instead of snapping to full", () => {
    const sweep = exitSweep();
    // Picked up after the apex coast, and gently when it is.
    const firstOn = sweep.find((s) => s.throttle > 0)!;
    expect(firstOn.throttle).toBeLessThan(0.35);
    expect(sweep[sweep.length - 1].throttle).toBe(1);
  });

  it("stays off the throttle briefly past the apex", () => {
    expect(exitSweep()[0].throttle).toBe(0);
  });

  it("applies throttle monotonically out of the corner", () => {
    const sweep = exitSweep();
    for (let i = 1; i < sweep.length; i++) {
      expect(sweep[i].throttle).toBeGreaterThanOrEqual(sweep[i - 1].throttle);
    }
  });

  it("keeps the brake off on the way out", () => {
    expect(exitSweep().every((s) => s.brake === 0)).toBe(true);
  });

  it("takes longer to reach full throttle out of a slower corner", () => {
    const full = (sev: number) =>
      exitSweep(sev).findIndex((s) => s.throttle >= 0.999);
    expect(full(1)).toBeGreaterThan(full(0));
  });
});

describe("pedalsFor — off the pedals", () => {
  it("leaves a neutral window on the way into the apex", () => {
    const neutral = approachSweep().filter(
      (s) => s.throttle === 0 && s.brake === 0,
    );
    // Both the lift before the brake and the release before the apex.
    expect(neutral.length).toBeGreaterThan(3);
  });

  it("carries the coast across the apex, off both pedals", () => {
    // The end of the approach and the start of the exit are both neutral, so
    // the car rolls through the apex itself on neither pedal.
    const intoApex = pedalsFor({ approach: 0.99, exit: null, severity: 0.8 });
    const pastApex = pedalsFor({ approach: null, exit: 0.01, severity: 0.8 });
    expect(intoApex).toEqual({ throttle: 0, brake: 0 });
    expect(pastApex).toEqual({ throttle: 0, brake: 0 });
  });

  it("coasts for longer through a fast corner than a hairpin", () => {
    const coastLen = (sev: number) =>
      approachSweep(sev).filter((s) => s.throttle === 0 && s.brake === 0).length;
    expect(coastLen(0)).toBeGreaterThan(coastLen(1));
  });

  it("stays off the pedals far longer on a lift-and-coast entry", () => {
    const neutral = (lift: number) =>
      Array.from({ length: 60 }, (_, i) =>
        pedalsFor({ approach: i / 59, exit: null, severity: 0.8, lift }),
      ).filter((s) => s.throttle === 0 && s.brake === 0).length;
    expect(neutral(1)).toBeGreaterThan(neutral(0) * 1.5);
  });

  it("still gets on the brake on a lift-and-coast entry", () => {
    const braked = Array.from({ length: 60 }, (_, i) =>
      pedalsFor({ approach: i / 59, exit: null, severity: 0.8, lift: 1 }),
    );
    expect(Math.max(...braked.map((s) => s.brake))).toBeGreaterThan(0.5);
  });
});

describe("pedalsFor — bounds", () => {
  it("keeps both pedals within 0–1 everywhere", () => {
    for (const sev of [0, 0.5, 1]) {
      for (const s of [...approachSweep(sev), ...exitSweep(sev)]) {
        expect(s.throttle).toBeGreaterThanOrEqual(0);
        expect(s.throttle).toBeLessThanOrEqual(1);
        expect(s.brake).toBeGreaterThanOrEqual(0);
        expect(s.brake).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("drivePhase", () => {
  it("names each part of the corner cycle", () => {
    expect(drivePhase(phase({}))).toBe(DrivePhase.FlatOut);
    expect(drivePhase(phase({ approach: 0.01 }))).toBe(DrivePhase.Lift);
    expect(drivePhase(phase({ approach: 0.5 }))).toBe(DrivePhase.Braking);
    expect(drivePhase(phase({ approach: 0.99 }))).toBe(DrivePhase.Coast);
    expect(drivePhase(phase({ exit: 0.01 }))).toBe(DrivePhase.Coast);
    expect(drivePhase(phase({ exit: 0.2 }))).toBe(DrivePhase.Squeeze);
  });
});

describe("cornerSeverity", () => {
  it("rates a hairpin above a fast sweeper", () => {
    expect(cornerSeverity(62, 288)).toBeGreaterThan(cornerSeverity(165, 288));
  });

  it("stays within 0–1 at the extremes", () => {
    expect(cornerSeverity(288, 288)).toBe(0);
    expect(cornerSeverity(0, 288)).toBe(1);
  });
});

// ── type-level contracts ─────────────────────────────────────────────────────

/** The phase union is derived from the const object, so the two cannot drift. */
export type _PhaseUnion = Expect<
  Equals<DrivePhase, "flat-out" | "lift" | "coast" | "braking" | "squeeze">
>;

/** Pedal outputs stay readonly — callers must not mutate a sampled frame. */
export type _PedalsReadonly = Expect<
  Equals<PedalInputs, { readonly throttle: number; readonly brake: number }>
>;
