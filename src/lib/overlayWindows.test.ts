import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  currentWindowLabel,
  forgetWindow,
  getRememberedWindows,
  parseOverlayId,
  parseWidgetId,
  rememberWindow,
} from "./overlayWindows";

describe("currentWindowLabel", () => {
  it("defaults to the main window when there is no route", () => {
    // No `window` in the node test env → the primary window label.
    expect(currentWindowLabel()).toBe("main");
  });
});

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

describe("parseWidgetId", () => {
  it("reads ?widget= from the query string", () => {
    expect(parseWidgetId("?widget=fuel", "")).toBe("fuel");
  });

  it("falls back to a hash query (#widget=…)", () => {
    expect(parseWidgetId("", "#widget=speed")).toBe("speed");
    expect(parseWidgetId("", "#?widget=tyres")).toBe("tyres");
  });

  it("does not steal the bare overlay hash route", () => {
    // `#dashboard` selects an overlay, never a widget.
    expect(parseWidgetId("", "#dashboard")).toBeNull();
  });

  it("returns null when no widget is selected", () => {
    expect(parseWidgetId("?overlay=dashboard", "")).toBeNull();
    expect(parseWidgetId("", "")).toBeNull();
  });
});

describe("open-window persistence", () => {
  // Minimal in-memory localStorage for the node test environment.
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    };
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it("remembers, dedupes and forgets windows", () => {
    expect(getRememberedWindows()).toEqual([]);

    rememberWindow({ kind: "overlay", id: "standings", label: "Standings" });
    rememberWindow({ kind: "widget", id: "fuel", label: "Fuel" });
    // Duplicate kind+id is ignored.
    rememberWindow({ kind: "overlay", id: "standings", label: "Standings" });

    const list = getRememberedWindows();
    expect(list).toHaveLength(2);
    expect(list.map((w) => `${w.kind}:${w.id}`)).toEqual([
      "overlay:standings",
      "widget:fuel",
    ]);

    forgetWindow("overlay", "standings");
    expect(getRememberedWindows().map((w) => w.id)).toEqual(["fuel"]);
  });

  it("survives corrupt storage", () => {
    localStorage.setItem("telemetrylab.open-windows.v1", "{not json");
    expect(getRememberedWindows()).toEqual([]);
  });
});
