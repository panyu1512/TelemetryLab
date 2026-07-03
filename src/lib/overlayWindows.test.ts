import { describe, expect, it } from "vitest";

import { parseOverlayId } from "./overlayWindows";

describe("parseOverlayId", () => {
  it("reads the canonical ?overlay= query param", () => {
    expect(parseOverlayId("?overlay=dashboard", "")).toBe("dashboard");
  });

  it("ignores other query params alongside overlay", () => {
    expect(parseOverlayId("?foo=1&overlay=standings&bar=2", "")).toBe(
      "standings"
    );
  });

  it("trims whitespace and decodes the value", () => {
    expect(parseOverlayId("?overlay=%20relative%20", "")).toBe("relative");
  });

  it("returns null when nothing selects an overlay", () => {
    expect(parseOverlayId("", "")).toBeNull();
    expect(parseOverlayId(undefined, undefined)).toBeNull();
    expect(parseOverlayId("?other=1", "")).toBeNull();
  });

  it("falls back to a hash query (#overlay=…) for static hosting / OBS", () => {
    expect(parseOverlayId("", "#overlay=relative")).toBe("relative");
    expect(parseOverlayId("", "#?overlay=fuel")).toBe("fuel");
  });

  it("supports a bare hash route (#/id or #id)", () => {
    expect(parseOverlayId("", "#/dashboard")).toBe("dashboard");
    expect(parseOverlayId("", "#standings")).toBe("standings");
  });

  it("prefers the query string over the hash when both are present", () => {
    expect(parseOverlayId("?overlay=dashboard", "#overlay=standings")).toBe(
      "dashboard"
    );
  });

  it("treats an empty overlay value as absent", () => {
    expect(parseOverlayId("?overlay=", "")).toBeNull();
    expect(parseOverlayId("?overlay=", "#relative")).toBe("relative");
  });
});
