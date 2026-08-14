import { describe, expect, it } from "vitest";

import { ranksByLapTime, SessionKind, sessionKind } from "./sessionKind";

describe("sessionKind", () => {
  it("recognises the race names series actually ship", () => {
    expect(sessionKind("Race")).toBe(SessionKind.Race);
    expect(sessionKind("RACE")).toBe(SessionKind.Race);
    expect(sessionKind("Heat Race")).toBe(SessionKind.Race);
  });

  it("recognises both qualifying formats", () => {
    expect(sessionKind("Lone Qualify")).toBe(SessionKind.Qualify);
    expect(sessionKind("Open Qualify")).toBe(SessionKind.Qualify);
    expect(sessionKind("Qualifying")).toBe(SessionKind.Qualify);
  });

  it("reads a qualifier that also says race as a qualifier", () => {
    expect(sessionKind("Qualifying Race")).toBe(SessionKind.Qualify);
  });

  it("groups practice, testing and warmup together", () => {
    expect(sessionKind("Practice")).toBe(SessionKind.Practice);
    expect(sessionKind("Offline Testing")).toBe(SessionKind.Practice);
    expect(sessionKind("Testing")).toBe(SessionKind.Practice);
    expect(sessionKind("Warmup")).toBe(SessionKind.Practice);
  });

  it("is Unknown for anything it cannot place, including no session", () => {
    expect(sessionKind("Heat 1")).toBe(SessionKind.Unknown);
    expect(sessionKind("")).toBe(SessionKind.Unknown);
    expect(sessionKind(null)).toBe(SessionKind.Unknown);
    expect(sessionKind(undefined)).toBe(SessionKind.Unknown);
  });
});

describe("ranksByLapTime", () => {
  it("is true for the sessions ranked on the timesheet", () => {
    expect(ranksByLapTime(SessionKind.Qualify)).toBe(true);
    expect(ranksByLapTime(SessionKind.Practice)).toBe(true);
  });

  it("is false for a race", () => {
    expect(ranksByLapTime(SessionKind.Race)).toBe(false);
  });

  it("keeps the race behaviour when the session is unrecognised", () => {
    // Hiding columns on a guess is worse than showing a number the driver can
    // judge for themselves.
    expect(ranksByLapTime(SessionKind.Unknown)).toBe(false);
  });
});
