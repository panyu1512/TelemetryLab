import { describe, expect, it } from "vitest";

import {
  delta,
  gap,
  gearLabel,
  interval,
  lapTime,
  num,
  pct,
  sectorTime,
  signed,
} from "./format";

const DASH = "—";

describe("num", () => {
  it("formats with the requested precision", () => {
    expect(num(3.14159, 2)).toBe("3.14");
    expect(num(10)).toBe("10");
  });

  it("renders an em dash for null/undefined/NaN", () => {
    expect(num(null)).toBe(DASH);
    expect(num(undefined)).toBe(DASH);
    expect(num(NaN)).toBe(DASH);
  });
});

describe("pct", () => {
  it("renders a 0..1 fraction as a whole percentage", () => {
    expect(pct(0.5)).toBe("50");
    expect(pct(0.123)).toBe("12");
    expect(pct(1)).toBe("100");
  });

  it("handles missing values", () => {
    expect(pct(null)).toBe(DASH);
    expect(pct(NaN)).toBe(DASH);
  });
});

describe("gearLabel", () => {
  it("maps reverse/neutral/forward", () => {
    expect(gearLabel(-1)).toBe("R");
    expect(gearLabel(0)).toBe("N");
    expect(gearLabel(3)).toBe("3");
  });

  it("renders a dash when null", () => {
    expect(gearLabel(null)).toBe(DASH);
  });
});

describe("lapTime", () => {
  it("formats minutes:seconds.millis", () => {
    expect(lapTime(92.123)).toBe("1:32.123");
    expect(lapTime(5.5)).toBe("0:05.500");
    expect(lapTime(125.0)).toBe("2:05.000");
  });

  it("rejects non-positive and missing values", () => {
    expect(lapTime(0)).toBe(DASH);
    expect(lapTime(-1)).toBe(DASH);
    expect(lapTime(null)).toBe(DASH);
    expect(lapTime(NaN)).toBe(DASH);
  });
});

describe("gap", () => {
  it("formats a seconds gap", () => {
    expect(gap(3.4, false)).toBe("+3.4");
  });

  it("drops precision past 100s", () => {
    expect(gap(123.6, false)).toBe("+124");
  });

  it("formats a lap-count gap when isLaps", () => {
    expect(gap(2, true)).toBe("+2L");
    expect(gap(1, true)).toBe("+1L");
  });

  it("dashes sub-lap gaps when isLaps", () => {
    expect(gap(0.4, true)).toBe(DASH);
  });

  it("dashes non-positive seconds and missing values", () => {
    expect(gap(0, false)).toBe(DASH);
    expect(gap(null, false)).toBe(DASH);
    expect(gap(NaN, false)).toBe(DASH);
  });
});

describe("interval", () => {
  it("formats a positive interval", () => {
    expect(interval(0.7)).toBe("+0.7");
    expect(interval(250)).toBe("+250");
  });

  it("dashes zero/negative/missing", () => {
    expect(interval(0)).toBe(DASH);
    expect(interval(-2)).toBe(DASH);
    expect(interval(null)).toBe(DASH);
  });
});

describe("delta", () => {
  it("adds a sign and precision", () => {
    expect(delta(0.312, 3)).toBe("+0.312");
    expect(delta(-0.312, 3)).toBe("-0.312");
    expect(delta(0.7)).toBe("+0.7");
  });

  it("renders a bare zero without a sign", () => {
    expect(delta(0)).toBe("0.0");
  });

  it("dashes missing values", () => {
    expect(delta(null)).toBe(DASH);
    expect(delta(NaN)).toBe(DASH);
  });
});

describe("sectorTime", () => {
  it("shows sub-minute times to one decimal", () => {
    expect(sectorTime(23.74)).toBe("23.7");
  });

  it("shows minute+ times as m:ss.s", () => {
    expect(sectorTime(100.2)).toBe("1:40.2");
  });

  it("dashes non-positive/missing", () => {
    expect(sectorTime(0)).toBe(DASH);
    expect(sectorTime(null)).toBe(DASH);
  });
});

describe("signed", () => {
  it("prefixes a plus on positives only", () => {
    expect(signed(14)).toBe("+14");
    expect(signed(-3)).toBe("-3");
    expect(signed(0)).toBe("0");
  });

  it("dashes missing values", () => {
    expect(signed(null)).toBe(DASH);
    expect(signed(NaN)).toBe(DASH);
  });
});
