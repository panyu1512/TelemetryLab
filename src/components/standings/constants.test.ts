import { describe, expect, it } from "vitest";

import {
  fitColumns,
  LAP_TIME_PROTECTED,
  scopeColumnsToSession,
  tableMinWidth,
  type ColumnVisibility,
} from "./constants";

/** Every configurable column on, the app's default. */
const allOn: ColumnVisibility = () => true;

describe("scopeColumnsToSession", () => {
  it("changes nothing in a race", () => {
    const scoped = scopeColumnsToSession(allOn, false);
    for (const id of ["gap", "interval", "change", "best", "last"] as const) {
      expect(scoped(id)).toBe(true);
    }
  });

  it("drops the columns that measure a race nobody is running", () => {
    const scoped = scopeColumnsToSession(allOn, true);
    expect(scoped("gap")).toBe(false);
    expect(scoped("interval")).toBe(false);
    // Positions gained counts against the bridge's race order, which is not the
    // order on screen once the table ranks itself by lap time.
    expect(scoped("change")).toBe(false);
  });

  it("keeps the lap columns the session is actually about", () => {
    const scoped = scopeColumnsToSession(allOn, true);
    expect(scoped("best")).toBe(true);
    expect(scoped("last")).toBe(true);
  });

  it("pins the ranking column even when the user turned it off", () => {
    // A table ranked by a column you cannot see is a table in no order at all.
    const bestHidden: ColumnVisibility = (id) => id !== "best";
    expect(scopeColumnsToSession(bestHidden, false)("best")).toBe(false);
    expect(scopeColumnsToSession(bestHidden, true)("best")).toBe(true);
  });

  it("leaves every other choice to the user", () => {
    const noBrand: ColumnVisibility = (id) => id !== "brand";
    const scoped = scopeColumnsToSession(noBrand, true);
    expect(scoped("brand")).toBe(false);
    expect(scoped("irating")).toBe(true);
  });
});

describe("fitColumns", () => {
  it("drops optional columns until the table fits", () => {
    const wide = tableMinWidth(3, allOn);
    const narrow = fitColumns(600, 3, allOn);
    expect(tableMinWidth(3, narrow)).toBeLessThanOrEqual(600);
    expect(tableMinWidth(3, narrow)).toBeLessThan(wide);
  });

  it("stops at the smallest useful table rather than crushing it", () => {
    // Position, driver, interval, last lap and status are never auto-dropped,
    // so below their combined width the table scrolls sideways instead.
    const floor = tableMinWidth(3, fitColumns(1, 3, allOn));
    expect(tableMinWidth(3, fitColumns(120, 3, allOn))).toBe(floor);
    for (const id of ["pos", "driver", "interval", "last", "state"] as const) {
      expect(fitColumns(120, 3, allOn)(id)).toBe(true);
    }
  });

  it("leaves the set alone when the width is unknown", () => {
    expect(fitColumns(0, 3, allOn)("sectors")).toBe(true);
  });

  it("would drop the best-lap column on its own", () => {
    // Establishes the baseline the protection below is actually protecting
    // against, so the next test cannot pass by accident.
    expect(fitColumns(220, 3, allOn)("best")).toBe(false);
  });

  it("never drops a protected column, however narrow the window", () => {
    const scoped = scopeColumnsToSession(allOn, true);
    const fitted = fitColumns(120, 3, scoped, LAP_TIME_PROTECTED);
    expect(fitted("best")).toBe(true);
  });
});
