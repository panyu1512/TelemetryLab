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
    // …and the pedal is materially released by the apex (trail braking).
    const apex = sweep[sweep.length - 1].brake;
    expect(apex).toBeLessThan(sweep[peakAt].brake * 0.4);
    expect(apex).toBeGreaterThan(0);
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
    expect(sweep[0].throttle).toBeGreaterThan(0);
    expect(sweep[0].throttle).toBeLessThan(0.35);
    expect(sweep[sweep.length - 1].throttle).toBe(1);
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
  Equals<DrivePhase, "flat-out" | "lift" | "braking" | "squeeze">
>;

/** Pedal outputs stay readonly — callers must not mutate a sampled frame. */
export type _PedalsReadonly = Expect<
  Equals<PedalInputs, { readonly throttle: number; readonly brake: number }>
>;
