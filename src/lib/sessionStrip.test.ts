import { describe, expect, it } from "vitest";

import {
  activeFlag,
  incidentColor,
  raceDistance,
  sessionTag,
} from "./sessionStrip";

describe("activeFlag", () => {
  it("returns null when no flag is flying", () => {
    expect(activeFlag([])).toBeNull();
  });

  it("returns null when only bits the strip doesn't show are set", () => {
    // The mask carries pit/start state alongside the marshal's flags; those
    // alone must not colour the strip.
    expect(activeFlag(["start_go", "start_ready"])).toBeNull();
  });

  it("picks the most urgent flag when several bits are set at once", () => {
    // iRacing routinely flies green + start_go, or yellow + caution_waving.
    expect(activeFlag(["green", "start_go"])?.label).toBe("Green");
    expect(activeFlag(["yellow", "caution_waving"])?.label).toBe("Caution");
    expect(activeFlag(["green", "red"])?.label).toBe("Red flag");
  });

  it("puts the chequered flag above everything", () => {
    expect(activeFlag(["checkered", "yellow", "black"])?.label).toBe(
      "Chequered"
    );
  });

  it("colours by status meaning, not by the flag's literal colour", () => {
    // A black flag is critical to the driver — and black-on-black is invisible.
    expect(activeFlag(["black"])?.color).toBe("var(--color-danger)");
    expect(activeFlag(["blue"])?.color).toBe("var(--color-primary)");
  });
});

describe("sessionTag", () => {
  it("collapses the series-specific session names to four characters", () => {
    expect(sessionTag("Race")).toBe("RACE");
    expect(sessionTag("Lone Qualify")).toBe("QUAL");
    expect(sessionTag("Open Qualify")).toBe("QUAL");
    expect(sessionTag("Practice")).toBe("PRAC");
    expect(sessionTag("Offline Testing")).toBe("PRAC");
    expect(sessionTag("Warmup")).toBe("WARM");
  });

  it("truncates anything it doesn't recognise instead of blanking it", () => {
    expect(sessionTag("Heat 1")).toBe("HEAT");
    expect(sessionTag("")).toBe("—");
  });
});

describe("incidentColor", () => {
  it("stays quiet well below any series limit", () => {
    expect(incidentColor(0)).toBe("var(--color-text)");
    expect(incidentColor(7)).toBe("var(--color-text)");
  });

  it("warns once a 17x limit is in sight and alarms once it is close", () => {
    expect(incidentColor(8)).toBe("var(--color-warning)");
    expect(incidentColor(12)).toBe("var(--color-warning)");
    expect(incidentColor(13)).toBe("var(--color-danger)");
  });
});

describe("raceDistance", () => {
  const timed = {
    isTimed: true,
    sessionTimeRemain: 3024,
    sessionLapsTotal: null,
    carEstLapTime: 120,
  };

  it("uses the published distance when the race has one", () => {
    expect(
      raceDistance({ ...timed, isTimed: false, sessionLapsTotal: 35 }, 6)
    ).toBe("6/35");
  });

  it("projects a distance for a timed race and marks it as an estimate", () => {
    // 6 done + 3024 s left ÷ a 120 s lap ≈ 25.2 more ⇒ ≈31.
    expect(raceDistance(timed, 6)).toBe("6/≈31");
  });

  it("falls back to the bare lap when neither is available", () => {
    expect(raceDistance({ ...timed, sessionTimeRemain: null }, 6)).toBe("6");
    expect(raceDistance({ ...timed, carEstLapTime: null }, 6)).toBe("6");
    expect(raceDistance({ ...timed, carEstLapTime: 0 }, 6)).toBe("6");
  });

  it("renders an em dash before the first lap of an unbounded session", () => {
    expect(raceDistance({ ...timed, sessionTimeRemain: null }, 0)).toBe("—");
  });
});
