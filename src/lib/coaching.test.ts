import { describe, expect, it } from "vitest";

import type {
  CoachCorner,
  CoachingPayload,
  CornerAnalysis,
} from "../telemetry/types";
import {
  MIN_LOSS_DEFAULT,
  barScale,
  causeDetail,
  causeHeadline,
  causeTag,
  coachView,
  cornerGrade,
  formatLoss,
  gradeColor,
  invalidReasonText,
  isDriverCause,
  lapSegments,
  pickGains,
  pickTips,
  repeatText,
} from "./coaching";

const OPTS = { minLoss: MIN_LOSS_DEFAULT, tipCount: 2 };

function corner(n: number, start: number, apex = start + 0.02): CoachCorner {
  return {
    number: n,
    label: `T${n}`,
    startPct: start,
    entryPct: start + 0.01,
    apexPct: apex,
    exitPct: apex + 0.001,
  };
}

function a(n: number, timeLost: number, extra: Partial<CornerAnalysis> = {}): CornerAnalysis {
  return {
    corner: n,
    timeLost,
    cause: "line",
    brakeDeltaM: 0,
    entrySpeedDeltaKmh: 0,
    minSpeedDeltaKmh: 0,
    exitSpeedDeltaKmh: 0,
    throttleDeltaM: 0,
    coastDeltaM: 0,
    traffic: false,
    repeat: 1,
    repeatWindow: 1,
    ...extra,
  };
}

const CORNERS = [corner(1, 0.9994, 0.02), corner(2, 0.265), corner(3, 0.37), corner(4, 0.53)];

function payload(over: Partial<CoachingPayload> = {}): CoachingPayload {
  return {
    state: "analysed",
    trackLengthM: 7004,
    reference: { lap: 3, lapTime: 136.3 },
    lastLap: { lap: 5, lapTime: 137.1, valid: true, invalidReason: null, delta: 0.8 },
    newReference: false,
    corners: CORNERS,
    analysis: [
      a(1, 0.02, { cause: "even" }),
      a(2, 0.31, { cause: "early_brake", brakeDeltaM: 14, repeat: 4, repeatWindow: 6 }),
      a(3, 0.12, { cause: "late_throttle", throttleDeltaM: 24, exitSpeedDeltaKmh: -2 }),
      a(4, 0.35, { cause: "traffic", traffic: true }),
    ],
    lapsAnalysed: 4,
    ...over,
  };
}

describe("cornerGrade", () => {
  it("grades against the threshold, with a floor for red", () => {
    expect(cornerGrade(-0.06, 0.05)).toBe("gain");
    expect(cornerGrade(0.04, 0.05)).toBe("even");
    expect(cornerGrade(-0.04, 0.05)).toBe("even");
    expect(cornerGrade(0.1, 0.05)).toBe("loss");
    expect(cornerGrade(0.25, 0.05)).toBe("big");
    // A high threshold raises the bar for red with it.
    expect(cornerGrade(0.25, 0.2)).toBe("loss");
    expect(cornerGrade(0.7, 0.2)).toBe("big");
  });

  it("maps grades to status tokens", () => {
    expect(gradeColor("gain")).toContain("accent");
    expect(gradeColor("loss")).toContain("warning");
    expect(gradeColor("big")).toContain("danger");
    expect(gradeColor("even")).toContain("muted");
  });
});

describe("wording", () => {
  it("formats signed losses", () => {
    expect(formatLoss(0.214)).toBe("+0.21 s");
    expect(formatLoss(-0.08)).toBe("−0.08 s");
    expect(formatLoss(1.2345, 3)).toBe("+1.234 s");
  });

  it("says each cause with its number", () => {
    expect(causeHeadline(a(1, 0.2, { cause: "early_brake", brakeDeltaM: 14.4 }))).toBe(
      "Braked 14 m early",
    );
    expect(causeHeadline(a(1, 0.2, { cause: "coasting", coastDeltaM: 112 }))).toBe(
      "Coasted 112 m off both pedals",
    );
    expect(causeHeadline(a(1, 0.2, { cause: "overdrove", minSpeedDeltaKmh: -6 }))).toBe(
      "Too hot in — apex 6 km/h slower",
    );
    expect(causeHeadline(a(1, 0.2, { cause: "over_slowed", minSpeedDeltaKmh: -8.2 }))).toBe(
      "Over-slowed — apex 8 km/h slower",
    );
    expect(causeHeadline(a(1, 0.2, { cause: "late_throttle", throttleDeltaM: 30 }))).toBe(
      "Back on the throttle 30 m later",
    );
    expect(causeHeadline(a(1, 0.2, { cause: "slow_exit", exitSpeedDeltaKmh: -4 }))).toBe(
      "Exit 4 km/h slower",
    );
    expect(causeHeadline(a(1, 0.2, { cause: "traffic" }))).toBe("Held up by traffic");
    expect(causeHeadline(a(1, -0.2, { cause: "gain" }))).toBe("Gained on your reference");
    expect(causeHeadline(a(1, 0, { cause: "even" }))).toBe("Matched your reference");
    expect(causeHeadline(a(1, 0.2))).toBe("Slower through the corner");
  });

  it("falls back when the number is missing", () => {
    const nulls = {
      brakeDeltaM: null,
      coastDeltaM: null,
      minSpeedDeltaKmh: null,
      throttleDeltaM: null,
      exitSpeedDeltaKmh: null,
    };
    expect(causeHeadline(a(1, 0.2, { ...nulls, cause: "early_brake" }))).toBe("Braked early");
    expect(causeHeadline(a(1, 0.2, { ...nulls, cause: "coasting" }))).toBe(
      "Coasted off both pedals",
    );
    expect(causeHeadline(a(1, 0.2, { ...nulls, cause: "overdrove" }))).toBe(
      "Too hot into the corner",
    );
    expect(causeHeadline(a(1, 0.2, { ...nulls, cause: "over_slowed" }))).toBe(
      "Over-slowed the apex",
    );
    expect(causeHeadline(a(1, 0.2, { ...nulls, cause: "late_throttle" }))).toBe(
      "Late back on the throttle",
    );
    expect(causeHeadline(a(1, 0.2, { ...nulls, cause: "slow_exit" }))).toBe(
      "Slow out of the corner",
    );
  });

  it("details the other numbers, not the headline's, at most three", () => {
    const x = a(1, 0.3, {
      cause: "over_slowed",
      brakeDeltaM: -7,
      entrySpeedDeltaKmh: 3,
      minSpeedDeltaKmh: -8,
      throttleDeltaM: 12,
      exitSpeedDeltaKmh: -5,
      coastDeltaM: 20,
    });
    expect(causeDetail(x)).toEqual(["braked 7 m late", "entry +3 km/h", "throttle +12 m"]);
    const y = a(1, 0.3, { cause: "early_brake", brakeDeltaM: 14, coastDeltaM: 30 });
    expect(causeDetail(y)).toEqual(["coast +30 m"]);
    const z = a(1, 0.3, { cause: "line", brakeDeltaM: 5, exitSpeedDeltaKmh: -2 });
    expect(causeDetail(z)).toEqual(["braked 5 m early", "exit −2 km/h"]);
    expect(causeDetail(a(1, 0.3))).toEqual([]);
  });

  it("calls out habits, not one-offs", () => {
    expect(repeatText(a(1, 0.2, { cause: "early_brake", repeat: 4, repeatWindow: 6 }))).toBe(
      "4 of the last 6 laps",
    );
    expect(repeatText(a(1, 0.2, { cause: "early_brake", repeat: 1, repeatWindow: 6 }))).toBeNull();
    expect(repeatText(a(1, 0.2, { cause: "traffic", repeat: 3, repeatWindow: 6 }))).toBeNull();
  });

  it("names causes and reasons", () => {
    expect(causeTag("early_brake")).toBe("Early brake");
    expect(causeTag("even")).toBe("");
    for (const c of [
      "coasting",
      "overdrove",
      "over_slowed",
      "late_throttle",
      "slow_exit",
      "traffic",
      "gain",
      "line",
    ] as const) {
      expect(causeTag(c)).not.toBe("");
    }
    expect(invalidReasonText("pit")).toBe("pit lane");
    expect(invalidReasonText("reset")).toBe("reset or tow");
    expect(invalidReasonText("incomplete")).toBe("telemetry gap");
    expect(invalidReasonText("off_track")).toBe("off track");
    expect(invalidReasonText("incident")).toBe("incident");
    expect(invalidReasonText(null)).toBe("not a clean lap");
    expect(isDriverCause("traffic")).toBe(false);
    expect(isDriverCause("line")).toBe(true);
  });
});

describe("pickTips", () => {
  it("keeps driver causes over the threshold, biggest first, up to the count", () => {
    const tips = pickTips(payload(), OPTS);
    // T4 lost the most, but to traffic: not a tip.
    expect(tips.map((t) => t.label)).toEqual(["T2", "T3"]);
    expect(tips[0]).toMatchObject({
      headline: "Braked 14 m early",
      repeat: "4 of the last 6 laps",
      grade: "big",
    });
    expect(tips[1].detail).toEqual(["exit −2 km/h"]);
  });

  it("honours the tip count and threshold", () => {
    expect(pickTips(payload(), { minLoss: 0.05, tipCount: 1 })).toHaveLength(1);
    expect(pickTips(payload(), { minLoss: 0.2, tipCount: 3 }).map((t) => t.label)).toEqual([
      "T2",
    ]);
  });

  it("labels a corner missing from the map by number", () => {
    const p = payload({ corners: [] });
    expect(pickTips(p, OPTS)[0].label).toBe("T2");
  });

  it("finds where a new best came from", () => {
    const p = payload({
      analysis: [a(1, -0.2, { cause: "gain" }), a(2, -0.06, { cause: "gain" }), a(3, 0.1)],
    });
    expect(pickGains(p, OPTS).map((t) => t.label)).toEqual(["T1", "T2"]);
  });
});

describe("coachView", () => {
  it("is empty before anything arrives", () => {
    expect(coachView(null, OPTS)).toEqual({ kind: "none" });
  });

  it("waits for a reference", () => {
    expect(
      coachView(payload({ state: "waiting", lastLap: null, reference: null }), OPTS),
    ).toEqual({ kind: "waiting", lap: null, reason: null });
    const offFirst = payload({
      state: "waiting",
      reference: null,
      lastLap: { lap: 1, lapTime: 140, valid: false, invalidReason: "off_track", delta: null },
    });
    expect(coachView(offFirst, OPTS)).toEqual({ kind: "waiting", lap: 1, reason: "off_track" });
  });

  it("reports a skipped lap", () => {
    const p = payload({
      state: "skipped",
      lastLap: { lap: 6, lapTime: 160, valid: false, invalidReason: "pit", delta: null },
    });
    expect(coachView(p, OPTS)).toEqual({ kind: "skipped", lap: 6, reason: "pit" });
  });

  it("announces the first reference", () => {
    const p = payload({
      newReference: true,
      analysis: [],
      lastLap: { lap: 1, lapTime: 136.3, valid: true, invalidReason: null, delta: null },
    });
    expect(coachView(p, OPTS)).toEqual({ kind: "reference", lap: 1, lapTime: 136.3 });
  });

  it("shows where a new best came from", () => {
    const p = payload({
      newReference: true,
      lastLap: { lap: 7, lapTime: 135.9, valid: true, invalidReason: null, delta: -0.41 },
      analysis: [a(1, -0.3, { cause: "gain" }), a(2, -0.11, { cause: "gain" })],
    });
    const v = coachView(p, OPTS);
    expect(v.kind).toBe("best");
    if (v.kind === "best") {
      expect(v.delta).toBe(-0.41);
      expect(v.gains.map((g) => g.label)).toEqual(["T1", "T2"]);
    }
  });

  it("gives tips, and flags a lap that did not count", () => {
    const v = coachView(payload(), OPTS);
    expect(v.kind).toBe("tips");
    const off = payload({
      lastLap: { lap: 8, lapTime: 137, valid: false, invalidReason: "off_track", delta: 0.7 },
    });
    const w = coachView(off, OPTS);
    expect(w.kind === "tips" && w.unclean).toBe("off_track");
  });

  it("is clean when nothing clears the threshold", () => {
    const v = coachView(payload(), { minLoss: 0.5, tipCount: 2 });
    expect(v).toEqual({ kind: "clean", lap: 5, delta: 0.8, unclean: null });
  });
});

describe("lapSegments", () => {
  it("splits the segment that wraps the line and carries each loss", () => {
    const segs = lapSegments(CORNERS, payload().analysis);
    expect(segs.map((s) => [s.label, s.from, s.to])).toEqual([
      ["T1", 0, 0.265],
      ["T2", 0.265, 0.37],
      ["T3", 0.37, 0.53],
      ["T4", 0.53, 0.9994],
      ["T1", 0.9994, 1],
    ]);
    expect(segs[1].timeLost).toBe(0.31);
  });

  it("handles no corners, one corner, and a corner without analysis", () => {
    expect(lapSegments([], [])).toEqual([]);
    expect(lapSegments([corner(1, 0.4)], [])).toEqual([
      { corner: 1, label: "T1", from: 0, to: 1, timeLost: null },
    ]);
    const twoNoWrap = lapSegments([corner(1, 0), corner(2, 0.5)], []);
    expect(twoNoWrap.map((s) => [s.from, s.to])).toEqual([
      [0, 0.5],
      [0.5, 1],
    ]);
  });

  it("scales bars to the biggest swing, with a floor", () => {
    expect(barScale([a(1, 0.1), a(2, -0.05)])).toBe(0.3);
    expect(barScale([a(1, 0.1), a(2, -0.8)])).toBe(0.8);
  });
});
