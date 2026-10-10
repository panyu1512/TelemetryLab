import { describe, expect, it } from "vitest";

import { isPlausibleBounds, monitorOf, placeWindow } from "./windowPlacement";

const PRIMARY = { x: 0, y: 0, width: 1920, height: 1040 };
const RIGHT = { x: 1920, y: 0, width: 2560, height: 1400 };

describe("isPlausibleBounds", () => {
  it("accepts an ordinary window", () => {
    expect(isPlausibleBounds({ x: 100, y: 80, width: 640, height: 420 })).toBe(true);
  });

  it("rejects Windows' minimized parking spot", () => {
    expect(isPlausibleBounds({ x: -32000, y: -32000, width: 160, height: 28 })).toBe(false);
  });

  it("rejects a collapsed size and non-numbers", () => {
    expect(isPlausibleBounds({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
    expect(isPlausibleBounds({ x: NaN, y: 0, width: 640, height: 420 })).toBe(false);
    expect(isPlausibleBounds(undefined)).toBe(false);
  });

  it("allows negative coordinates of a monitor left of the primary", () => {
    expect(isPlausibleBounds({ x: -1800, y: 40, width: 640, height: 420 })).toBe(true);
  });
});

describe("placeWindow", () => {
  it("restores a window that is fully on screen exactly", () => {
    const saved = { x: 2200, y: 300, width: 640, height: 420 };
    expect(placeWindow(saved, [PRIMARY, RIGHT])).toEqual(saved);
  });

  it("centres a window on the primary when its monitor is gone", () => {
    // Saved on the right-hand screen, which is now unplugged.
    const saved = { x: 2200, y: 300, width: 640, height: 420 };
    expect(placeWindow(saved, [PRIMARY])).toEqual({
      x: 640,
      y: 310,
      width: 640,
      height: 420,
    });
  });

  it("centres a window when the primary display changed and shifted the desktop", () => {
    // The old right-hand monitor became primary; the old primary now sits to
    // its *left* at negative x. A window saved at x = 4000 is nowhere.
    const newPrimary = { x: 0, y: 0, width: 2560, height: 1400 };
    const oldPrimary = { x: -1920, y: 0, width: 1920, height: 1040 };
    const saved = { x: 4000, y: 200, width: 1400, height: 900 };
    expect(placeWindow(saved, [newPrimary, oldPrimary])).toEqual({
      x: 580,
      y: 250,
      width: 1400,
      height: 900,
    });
  });

  it("pulls a window hanging off an edge fully back onto its monitor", () => {
    const saved = { x: 1700, y: 900, width: 640, height: 420 };
    expect(placeWindow(saved, [PRIMARY])).toEqual({
      x: 1280,
      y: 620,
      width: 640,
      height: 420,
    });
  });

  it("shrinks a window to a monitor that got smaller", () => {
    const saved = { x: 0, y: 0, width: 2560, height: 1400 };
    expect(placeWindow(saved, [PRIMARY])).toEqual({ x: 0, y: 0, width: 1920, height: 1040 });
  });

  it("ignores minimized bounds instead of restoring them", () => {
    expect(placeWindow({ x: -32000, y: -32000, width: 160, height: 28 }, [PRIMARY])).toBeNull();
  });

  it("trusts saved bounds when the monitor layout is unknown", () => {
    const saved = { x: 2200, y: 300, width: 640, height: 420 };
    expect(placeWindow(saved, [])).toEqual(saved);
  });
});

describe("monitorOf", () => {
  it("picks the monitor holding most of the window", () => {
    const monitors = [
      { ...PRIMARY, scaleFactor: 1 },
      { ...RIGHT, scaleFactor: 1.5 },
    ];
    expect(monitorOf({ x: 2000, y: 0, width: 400, height: 400 }, monitors)?.scaleFactor).toBe(1.5);
    expect(monitorOf({ x: 100, y: 0, width: 400, height: 400 }, monitors)?.scaleFactor).toBe(1);
  });
});
