import { describe, expect, it } from "vitest";

import type { RadarCar, RadarFrame } from "../telemetry/types";
import { GLYPHS, MATRIX_SIZE, gapText, glyphDots, radarLabel, radarSides } from "./radar";

function car(carIdx: number, gapM: number, side: RadarCar["side"] = null, lane: RadarCar["lane"] = null): RadarCar {
  return { carIdx, gapM, side, lane };
}

function frame(partial: Partial<RadarFrame>): RadarFrame {
  return {
    state: "clear",
    carLeftRight: 1,
    left: 0,
    right: 0,
    rangeM: 30,
    cars: [],
    ...partial,
  };
}

/** A glyph's dots back as text, for readable assertions. */
function draw(letter: keyof typeof GLYPHS): string[] {
  const dots = glyphDots(letter);
  return Array.from({ length: MATRIX_SIZE }, (_, r) =>
    dots
      .slice(r * MATRIX_SIZE, (r + 1) * MATRIX_SIZE)
      .map((on) => (on ? "#" : "."))
      .join(""),
  );
}

describe("radarSides", () => {
  it("is off without a frame, or when the player is not driving", () => {
    expect(radarSides(null).off).toBe(true);
    expect(radarSides(undefined).off).toBe(true);
    expect(radarSides(frame({ state: "off", carLeftRight: 0 })).off).toBe(true);
  });

  it("lights nothing with traffic behind but nobody alongside", () => {
    const sides = radarSides(frame({ cars: [car(1, -9)] }));
    expect(sides.off).toBe(false);
    expect(sides.left).toEqual({ count: 0, car: null });
    expect(sides.right).toEqual({ count: 0, car: null });
  });

  it("lights the side the spotter calls, with the car next to you", () => {
    const sides = radarSides(frame({ state: "car_right", right: 1, cars: [car(7, -2.5, "right", 1)] }));
    expect(sides.left.count).toBe(0);
    expect(sides.right.count).toBe(1);
    expect(sides.right.car?.carIdx).toBe(7);
  });

  it("lights both sides independently", () => {
    const sides = radarSides(
      frame({
        state: "car_left_right",
        left: 1,
        right: 1,
        cars: [car(1, 0.2, "left", 1), car(2, -3, "right", 1), car(3, -14)],
      }),
    );
    expect(sides.left.car?.carIdx).toBe(1);
    expect(sides.right.car?.carIdx).toBe(2);
  });

  it("names the inside car when two share a side", () => {
    const sides = radarSides(
      frame({
        state: "two_cars_right",
        right: 2,
        cars: [car(5, 0.1, "right", 2), car(6, -2, "right", 1)],
      }),
    );
    expect(sides.right.count).toBe(2);
    expect(sides.right.car?.carIdx).toBe(6);
  });

  it("still lights a side the spotter calls when no car could be matched", () => {
    expect(radarSides(frame({ state: "car_left", left: 1 })).left).toEqual({ count: 1, car: null });
  });

  it("never lights a side the spotter has not called", () => {
    expect(radarSides(frame({ cars: [car(1, 0, "left", 1)] })).left.count).toBe(0);
  });
});

describe("gapText", () => {
  it("says level when the cars are within half a metre", () => {
    expect(gapText(0.3)).toBe("level");
    expect(gapText(-0.49)).toBe("level");
  });

  it("says ahead or behind with one decimal", () => {
    expect(gapText(1.84)).toBe("1.8 m ahead");
    expect(gapText(-3.06)).toBe("3.1 m behind");
  });
});

describe("radarLabel", () => {
  it("speaks the call and where the car is", () => {
    expect(radarLabel(radarSides(null))).toBe("Radar: off");
    expect(radarLabel(radarSides(frame({})))).toBe("Radar: clear");
    expect(
      radarLabel(
        radarSides(
          frame({ state: "car_left_right", left: 1, right: 1, cars: [car(1, -1.84, "left", 1)] }),
        ),
      ),
    ).toBe("Radar: car left, 1.8 m behind; car right");
    expect(radarLabel(radarSides(frame({ state: "two_cars_left", left: 2 })))).toBe(
      "Radar: two cars left",
    );
  });
});

describe("the LED letters", () => {
  it("fill a square matrix", () => {
    for (const letter of ["L", "R"] as const) {
      expect(glyphDots(letter)).toHaveLength(MATRIX_SIZE * MATRIX_SIZE);
      expect(GLYPHS[letter]).toHaveLength(MATRIX_SIZE);
    }
  });

  it("draw an L and an R, centred with a dark column either side", () => {
    expect(draw("L")).toEqual([
      ".##......",
      ".##......",
      ".##......",
      ".##......",
      ".##......",
      ".##......",
      ".##......",
      ".#######.",
      ".#######.",
    ]);
    expect(draw("R")).toEqual([
      ".######..",
      ".#######.",
      ".##...##.",
      ".##...##.",
      ".#######.",
      ".######..",
      ".##.##...",
      ".##..##..",
      ".##...##.",
    ]);
  });
});
