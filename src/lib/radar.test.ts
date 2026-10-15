import { describe, expect, it } from "vitest";

import type { RadarCar, RadarFrame } from "../telemetry/types";
import {
  CAR_LENGTH_M,
  LINE_M,
  PLAYER_SPAN,
  carSpan,
  gapText,
  overlap,
  radarLabel,
  radarLines,
} from "./radar";

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

describe("carSpan", () => {
  it("puts a car level with you in the middle of the line, over your own car", () => {
    const s = carSpan(0)!;
    expect(s.top).toBeCloseTo(0.5 - CAR_LENGTH_M / 2 / (2 * LINE_M));
    expect(s.bottom).toBeCloseTo(0.5 + CAR_LENGTH_M / 2 / (2 * LINE_M));
    expect(PLAYER_SPAN).toEqual(s);
  });

  it("slides up the line as the car comes past", () => {
    const behind = carSpan(-3)!;
    const level = carSpan(0)!;
    const ahead = carSpan(3)!;
    expect(behind.top).toBeGreaterThan(level.top);
    expect(level.top).toBeGreaterThan(ahead.top);
    // Its length on the line is its length on the road.
    expect(ahead.bottom - ahead.top).toBeCloseTo(CAR_LENGTH_M / (2 * LINE_M));
  });

  it("clips a car hanging off either end of the line", () => {
    const s = carSpan(LINE_M - 1)!;
    expect(s.top).toBe(0);
    expect(s.bottom).toBeLessThan(0.5);
    const t = carSpan(-(LINE_M - 1))!;
    expect(t.bottom).toBe(1);
  });

  it("is off the line for a car wholly beyond it", () => {
    expect(carSpan(LINE_M + CAR_LENGTH_M)).toBeNull();
    expect(carSpan(-(LINE_M + CAR_LENGTH_M))).toBeNull();
  });
});

describe("overlap", () => {
  it("is full door to door and gone at a car length", () => {
    expect(overlap(0)).toBe(1);
    expect(overlap(CAR_LENGTH_M)).toBe(0);
    expect(overlap(-CAR_LENGTH_M * 2)).toBe(0);
  });

  it("is symmetric ahead and behind", () => {
    expect(overlap(1.5)).toBeCloseTo(overlap(-1.5));
    expect(overlap(CAR_LENGTH_M / 2)).toBeCloseTo(0.5);
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

describe("radarLines", () => {
  it("is off without a frame, or when the player is not driving", () => {
    expect(radarLines(null).off).toBe(true);
    expect(radarLines(frame({ state: "off", carLeftRight: 0 })).off).toBe(true);
  });

  it("lights nothing with traffic behind but nobody alongside", () => {
    const lines = radarLines(frame({ cars: [car(1, -9)] }));
    expect(lines.off).toBe(false);
    expect(lines.left.lanes).toEqual([]);
    expect(lines.right.lanes).toEqual([]);
  });

  it("puts the overtaking car on the side the spotter calls, where it is along you", () => {
    const lines = radarLines(
      frame({ state: "car_right", right: 1, cars: [car(7, -2.5, "right", 1)] }),
    );
    expect(lines.left.lanes).toEqual([]);
    expect(lines.right.count).toBe(1);
    const lane = lines.right.lanes[0];
    expect(lane.car?.carIdx).toBe(7);
    expect(lane.estimated).toBe(false);
    expect(lane.span).toEqual(carSpan(-2.5));
    // Behind you: it starts lower on the line than your own car does.
    expect(lane.span.top).toBeGreaterThan(PLAYER_SPAN.top);
  });

  it("lights both sides independently", () => {
    const lines = radarLines(
      frame({
        state: "car_left_right",
        left: 1,
        right: 1,
        cars: [car(1, 0.2, "left", 1), car(2, -3, "right", 1), car(3, -14)],
      }),
    );
    expect(lines.left.lanes[0].car?.carIdx).toBe(1);
    expect(lines.right.lanes[0].car?.carIdx).toBe(2);
  });

  it("puts the inside car on the inner line when two share a side", () => {
    const lines = radarLines(
      frame({
        state: "two_cars_right",
        right: 2,
        cars: [car(5, 0.1, "right", 2), car(6, -2, "right", 1)],
      }),
    );
    expect(lines.right.lanes.map((l) => [l.lane, l.car?.carIdx])).toEqual([
      [1, 6],
      [2, 5],
    ]);
  });

  it("still lights a side the spotter calls when no car could be placed", () => {
    const lines = radarLines(frame({ state: "car_left", left: 1 }));
    expect(lines.left.lanes).toEqual([
      { lane: 1, span: PLAYER_SPAN, estimated: true, car: null },
    ]);
  });

  it("never draws a car on a side the spotter has not called", () => {
    const lines = radarLines(frame({ cars: [car(1, 0, "left", 1)] }));
    expect(lines.left.lanes).toEqual([]);
  });
});

describe("radarLabel", () => {
  it("speaks the call and where the car is", () => {
    expect(radarLabel(radarLines(null))).toBe("Radar: off");
    expect(radarLabel(radarLines(frame({})))).toBe("Radar: clear");
    expect(
      radarLabel(
        radarLines(
          frame({ state: "car_left_right", left: 1, right: 1, cars: [car(1, -1.84, "left", 1)] }),
        ),
      ),
    ).toBe("Radar: car left, 1.8 m behind; car right");
    expect(radarLabel(radarLines(frame({ state: "two_cars_left", left: 2 })))).toBe(
      "Radar: two cars left",
    );
  });
});
