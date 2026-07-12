import { describe, expect, it } from "vitest";

import { applyTheme, getTheme, hexToRgba } from "./index";

describe("hexToRgba", () => {
  it("converts a 6-digit hex", () => {
    expect(hexToRgba("#141414", 0.62)).toBe("rgba(20, 20, 20, 0.62)");
  });

  it("expands a 3-digit hex", () => {
    expect(hexToRgba("#fff", 1)).toBe("rgba(255, 255, 255, 1)");
  });

  it("returns the input unchanged for a non-hex value", () => {
    expect(hexToRgba("transparent", 0.5)).toBe("transparent");
  });
});

/** A minimal stand-in for an element's style map. */
function fakeEl() {
  const props = new Map<string, string>();
  return {
    props,
    style: {
      setProperty: (k: string, v: string) => void props.set(k, v),
    },
  } as unknown as HTMLElement & { props: Map<string, string> };
}

describe("applyTheme", () => {
  it("uses solid backgrounds outside overlay mode", () => {
    const el = fakeEl() as HTMLElement & { props: Map<string, string> };
    applyTheme(getTheme("carbon"), false, el);
    expect(el.props.get("--color-bg")).toBe("#111418");
    expect(el.props.get("--color-surface")).toBe("#1a1e24");
  });

  it("makes the background transparent + surfaces translucent in overlay mode", () => {
    // This is the fix for the black-overlay bug: applyTheme owns the inline
    // vars, and inline vars beat the overlay-mode stylesheet rules.
    const el = fakeEl() as HTMLElement & { props: Map<string, string> };
    applyTheme(getTheme("carbon"), true, el);
    expect(el.props.get("--color-bg")).toBe("transparent");
    expect(el.props.get("--bg")).toBe("transparent");
    expect(el.props.get("--color-surface")).toContain("rgba(");
    // Text/accent stay solid so content is readable over the game.
    expect(el.props.get("--color-text")).toBe("#ffffff");
  });

  it("falls back to the default theme for an unknown id", () => {
    expect(getTheme("obsidian").id).toBe("carbon");
  });
});
