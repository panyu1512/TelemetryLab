import { describe, expect, it } from "vitest";

import { raceControl, towerBarState } from "./towerBar";
import { SAFETY_CAR_STRIPES, TOWER } from "./towerPalette";

describe("towerBarState", () => {
  it("is quiet paper with the session named on green", () => {
    const st = towerBarState(["green"], "Race", "RACE");
    expect(st.control).toBe("green");
    expect(st.ground).toBe(TOWER.surface);
    expect(st.badge.text).toBe("RACE");
    expect(st.badge.background).toBe(TOWER.raceBadge);
    expect(st.instruction).toBeNull();
  });

  it("names the session it is, not always a race", () => {
    expect(towerBarState(["green"], "Open Qualify", "QUALIFY").badge.text).toBe("QUAL");
    expect(towerBarState(["green"], "Practice", "PRACTICE").badge.text).toBe("PRAC");
  });

  it("outlines the badge before any flag is out", () => {
    const st = towerBarState([], "Race", "RACE");
    expect(st.badge.background).toBe("transparent");
    expect(st.badge.outline).toBeDefined();
  });

  it("turns the whole bar yellow under a yellow, and says so", () => {
    for (const flags of [["yellow"], ["yellow_waving"], ["green", "yellow"]]) {
      const st = towerBarState(flags, "Race", "RACE");
      expect(st.control).toBe("yellow");
      expect(st.ground).toBe(TOWER.yellowBar);
      expect(st.badge.text).toBe("YELLOW FLAG");
      expect(st.badge.glyph).toBe("flag");
    }
  });

  it("turns it amber and striped under a caution, with the instruction", () => {
    const st = towerBarState(["caution", "yellow"], "Race", "RACE");
    expect(st.control).toBe("safety_car");
    expect(st.ground).toBe(SAFETY_CAR_STRIPES);
    expect(st.badge.text).toBe("SAFETY CAR");
    expect(st.badge.glyph).toBe("car");
    expect(st.instruction).toBe("NO OVERTAKING");
  });

  it("keeps the two apart without colour: word, glyph and pattern all differ", () => {
    const yellow = towerBarState(["yellow"], "Race", "RACE");
    const sc = towerBarState(["caution_waving"], "Race", "RACE");
    expect(yellow.badge.text).not.toBe(sc.badge.text);
    expect(yellow.badge.glyph).not.toBe(sc.badge.glyph);
    expect(sc.ground).toContain("repeating-linear-gradient");
    expect(yellow.ground).not.toContain("gradient");
  });

  it("puts the more urgent flag first", () => {
    expect(towerBarState(["caution", "red"], "Race", "RACE").badge.text).toBe("RED FLAG");
    expect(towerBarState(["white", "green"], "Race", "RACE").badge.text).toBe("FINAL LAP");
    expect(towerBarState(["checkered", "white"], "Race", "RACE").badge.text).toBe("CHEQUERED");
  });

  it("keeps a flag that is not race control on a green bar", () => {
    const st = towerBarState(["blue"], "Race", "RACE");
    expect(st.control).toBe("green");
    expect(st.badge.text).toBe("BLUE FLAG");
  });
});

describe("raceControl", () => {
  it("reads just the ground", () => {
    expect(raceControl(["green"])).toBe("green");
    expect(raceControl(["yellow"])).toBe("yellow");
    expect(raceControl(["caution"])).toBe("safety_car");
  });
});
