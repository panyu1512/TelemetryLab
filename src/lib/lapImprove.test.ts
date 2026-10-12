import { describe, expect, it } from "vitest";

import { lapImproved } from "./lapImprove";

describe("lapImproved", () => {
  it("is true when the best lap gets faster", () => {
    expect(lapImproved(92.4, 92.1)).toBe(true);
  });

  it("is false when nothing changed or the time got slower", () => {
    expect(lapImproved(92.4, 92.4)).toBe(false);
    expect(lapImproved(92.1, 92.4)).toBe(false);
  });

  it("does not treat a first lap as an improvement", () => {
    // A first time is the car arriving on the board — a different effect.
    expect(lapImproved(null, 92.4)).toBe(false);
    expect(lapImproved(undefined, 92.4)).toBe(false);
    expect(lapImproved(0, 92.4)).toBe(false);
    expect(lapImproved(-1, 92.4)).toBe(false);
  });

  it("ignores a best lap that disappears", () => {
    expect(lapImproved(92.4, null)).toBe(false);
  });
});
