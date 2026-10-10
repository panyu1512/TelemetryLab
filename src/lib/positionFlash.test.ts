import { describe, expect, it } from "vitest";

import { positionMove } from "./positionFlash";

describe("positionMove", () => {
  it("is up when the printed position gets smaller", () => {
    expect(positionMove(3, 2)).toBe("up");
    expect(positionMove(12, 1)).toBe("up");
  });

  it("is down when the printed position gets larger", () => {
    expect(positionMove(1, 2)).toBe("down");
  });

  it("is null when nothing changed", () => {
    expect(positionMove(4, 4)).toBeNull();
  });

  it("is null when either side is unknown", () => {
    expect(positionMove(null, 3)).toBeNull();
    expect(positionMove(3, undefined)).toBeNull();
  });

  it("does not flash a car being classified for the first time", () => {
    // iRacing reports 0 for an unclassified car; the start classifies them all.
    expect(positionMove(0, 5)).toBeNull();
    expect(positionMove(5, 0)).toBeNull();
  });
});
