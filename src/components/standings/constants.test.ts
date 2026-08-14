import { describe, expect, it } from "vitest";

import {
  scopeColumnsToSession,
  tableMinWidth,
  visibleColumns,
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

describe("tableMinWidth", () => {
  it("is the width the chosen columns want, gaps and padding included", () => {
    const cols = visibleColumns(3, allOn);
    const sum = cols.reduce((n, c) => n + c.col.px, 0);
    expect(tableMinWidth(3, allOn)).toBe(sum + (cols.length - 1) * 4 + 16);
  });

  it("grows with the sector count", () => {
    expect(tableMinWidth(3, allOn)).toBeGreaterThan(tableMinWidth(1, allOn));
  });

  /*
   * This is the number the table now scales *against*, rather than a threshold
   * it sheds columns to reach, so it has to stay a function of the column set
   * alone — never of the window.
   */
  it("shrinks when a column is switched off", () => {
    const noSectors: ColumnVisibility = (id) => id !== "sectors";
    expect(tableMinWidth(3, noSectors)).toBeLessThan(tableMinWidth(3, allOn));
  });

  it("tracks the session scoping, so a timesheet asks for less room", () => {
    const race = tableMinWidth(3, scopeColumnsToSession(allOn, false));
    const timesheet = tableMinWidth(3, scopeColumnsToSession(allOn, true));
    expect(timesheet).toBeLessThan(race);
  });
});
