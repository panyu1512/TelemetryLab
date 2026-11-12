import { describe, expect, it } from "vitest";

import {
  MAX_PROFILE_BYTES,
  PROFILE_SCHEMA,
  parseProfileImport,
  serializeProfile,
  uniqueName,
  type ImportContext,
} from "./profileImport";

const ctx: ImportContext = {
  overlayIds: ["dashboard", "standings", "relative"],
  themeIds: ["hornet", "carbon"],
  existingNames: ["Default", "Sprint"],
  newId: "new-1",
};

const sample = {
  id: "old",
  name: "Sprint",
  overlays: {
    standings: {
      enabled: false,
      appearance: { themeId: "carbon", saturation: 120, brightness: 90, opacity: 80 },
      visibility: { hideOnReplay: true, hideOnPits: false, hideOnLoneQualify: true },
    },
  },
};

describe("serializeProfile", () => {
  it("wraps the profile in a versioned envelope that imports back", () => {
    const text = serializeProfile(sample);
    expect(JSON.parse(text)).toMatchObject({ schema: PROFILE_SCHEMA, version: 1 });
    const r = parseProfileImport(text, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.overlays.standings).toEqual(sample.overlays.standings);
  });
});

describe("parseProfileImport", () => {
  it("accepts a bare (pre-1.30) profile", () => {
    const r = parseProfileImport(JSON.stringify(sample), ctx);
    expect(r.ok).toBe(true);
  });

  it("gives the import a fresh id and a free name", () => {
    const r = parseProfileImport(JSON.stringify(sample), ctx);
    expect(r.ok && r.profile.id).toBe("new-1");
    expect(r.ok && r.profile.name).toBe("Sprint (2)");
  });

  it("drops overlays this build does not know", () => {
    const r = parseProfileImport(
      JSON.stringify({ name: "x", overlays: { ...sample.overlays, hologram: {} } }),
      ctx
    );
    expect(r.ok && Object.keys(r.profile.overlays)).toEqual(["standings"]);
    expect(r.ok && r.dropped).toEqual(["hologram"]);
  });

  it("clamps sliders, defaults missing fields and forgets unknown themes", () => {
    const r = parseProfileImport(
      JSON.stringify({
        name: "x",
        overlays: {
          relative: { appearance: { themeId: "neon", saturation: 900, opacity: -5 } },
        },
      }),
      ctx
    );
    expect(r.ok && r.profile.overlays.relative).toEqual({
      enabled: true,
      appearance: { themeId: null, saturation: 200, brightness: 100, opacity: 0 },
      visibility: { hideOnReplay: false, hideOnPits: false, hideOnLoneQualify: false },
    });
  });

  it("rejects what is not a profile", () => {
    expect(parseProfileImport("{oops", ctx)).toMatchObject({ ok: false });
    expect(parseProfileImport("[]", ctx)).toMatchObject({ ok: false });
    expect(parseProfileImport(JSON.stringify({ name: "x" }), ctx)).toMatchObject({ ok: false });
    expect(
      parseProfileImport(JSON.stringify({ schema: "other.app", profile: sample }), ctx)
    ).toMatchObject({ ok: false });
  });

  it("rejects a file from a newer format version", () => {
    const r = parseProfileImport(
      JSON.stringify({ schema: PROFILE_SCHEMA, version: 99, profile: sample }),
      ctx
    );
    expect(r).toMatchObject({ ok: false });
    expect(!r.ok && r.error).toMatch(/newer/);
  });

  it("rejects an oversized file before parsing it", () => {
    const r = parseProfileImport("x".repeat(MAX_PROFILE_BYTES + 1), ctx);
    expect(!r.ok && r.error).toMatch(/too large/);
  });
});

describe("uniqueName", () => {
  it("numbers a taken name, case-insensitively", () => {
    expect(uniqueName("sprint", ["Sprint", "Sprint (2)"])).toBe("sprint (3)");
    expect(uniqueName("  ", [])).toBe("Imported");
  });
});
