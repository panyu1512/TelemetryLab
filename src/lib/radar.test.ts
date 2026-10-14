import { describe, expect, it } from "vitest";

import type { RadarCar, RadarFrame } from "../telemetry/types";
import {
  CAR_LENGTH_M,
  LANE_M,
  VIEW_M,
  bearingDeg,
  gapText,
  lateralM,
  overlap,
  placeCar,
  radarCall,
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

describe("lateralM", () => {
  it("puts a car one lane over, left negative", () => {
    expect(lateralM({ side: "left", lane: 1 })).toBe(-LANE_M);
    expect(lateralM({ side: "right", lane: 1 })).toBe(LANE_M);
  });

  it("puts the second car on a side two lanes over", () => {
    expect(lateralM({ side: "right", lane: 2 })).toBe(2 * LANE_M);
  });

  it("is unknown for a car that is not alongside", () => {
    expect(lateralM({ side: null, lane: null })).toBeNull();
  });
});

describe("bearingDeg", () => {
  it("is 90 for a car level with you, on either side", () => {
    expect(bearingDeg(0, -LANE_M)).toBe(90);
    expect(bearingDeg(0, LANE_M)).toBe(90);
  });

  it("is under 90 for a car ahead and over 90 for one behind", () => {
    expect(bearingDeg(LANE_M, LANE_M)).toBe(45);
    expect(bearingDeg(-LANE_M, -LANE_M)).toBe(135);
  });

  it("tends to 0 and 180 straight ahead and astern", () => {
    expect(bearingDeg(100, LANE_M)).toBeLessThan(2);
    expect(bearingDeg(-100, LANE_M)).toBeGreaterThan(178);
  });

  it("is a whole number", () => {
    expect(Number.isInteger(bearingDeg(1.234, 2.5))).toBe(true);
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

describe("placeCar", () => {
  it("gives a car alongside a position and a bearing", () => {
    const p = placeCar(car(3, -2.5, "left", 1));
    expect(p.x).toBe(-LANE_M);
    expect(p.y).toBe(-2.5);
    expect(p.bearing).toBe(135);
    expect(p.beyondView).toBe(false);
  });

  it("has no bearing for a car whose side is unknown", () => {
    const p = placeCar(car(3, -8));
    expect(p.x).toBeNull();
    expect(p.bearing).toBeNull();
  });

  it("flags a car too far up or back to draw in the window", () => {
    expect(placeCar(car(1, VIEW_M + 3)).beyondView).toBe(true);
    expect(placeCar(car(1, -(VIEW_M + 3))).beyondView).toBe(true);
    expect(placeCar(car(1, VIEW_M / 2)).beyondView).toBe(false);
  });
});

describe("radarCall", () => {
  it("is off without a frame", () => {
    expect(radarCall(null)).toEqual({ label: "—", left: 0, right: 0, leftCar: null, rightCar: null });
  });

  it("says clear with traffic behind but nobody alongside", () => {
    const call = radarCall(frame({ cars: [car(1, -9)] }));
    expect(call.label).toBe("CLEAR");
    expect(call.leftCar).toBeNull();
    expect(call.rightCar).toBeNull();
  });

  it("describes the car on each side", () => {
    const call = radarCall(
      frame({
        state: "car_left_right",
        left: 1,
        right: 1,
        cars: [car(1, 0.2, "left", 1), car(2, -3, "right", 1), car(3, -14)],
      }),
    );
    expect(call.label).toBe("BOTH SIDES");
    expect(call.leftCar?.car.carIdx).toBe(1);
    expect(call.rightCar?.car.carIdx).toBe(2);
  });

  it("describes the inside car when two share a side", () => {
    const call = radarCall(
      frame({
        state: "two_cars_right",
        right: 2,
        cars: [car(5, 0.1, "right", 2), car(6, -2, "right", 1)],
      }),
    );
    expect(call.label).toBe("2 RIGHT");
    expect(call.right).toBe(2);
    expect(call.rightCar?.car.carIdx).toBe(6);
  });

  it("keeps the spotter's count when no car could be placed", () => {
    const call = radarCall(frame({ state: "car_left", left: 1 }));
    expect(call.left).toBe(1);
    expect(call.leftCar).toBeNull();
  });
});
