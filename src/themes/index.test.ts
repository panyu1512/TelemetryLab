import { describe, expect, it } from "vitest";

import { THEMES, applyTheme, getTheme, withAlpha } from "./index";

describe("withAlpha", () => {
  it("appends an alpha channel to an oklch color", () => {
    expect(withAlpha("oklch(23.4% 0.0131 258)", 0.66)).toBe(
      "oklch(23.4% 0.0131 258 / 0.66)"
    );
  });

  it("handles an achromatic color", () => {
    expect(withAlpha("oklch(17.3% 0 0)", 0.5)).toBe("oklch(17.3% 0 0 / 0.5)");
  });

  it("returns the input unchanged for a non-oklch value", () => {
    expect(withAlpha("transparent", 0.5)).toBe("transparent");
  });

  it("does not double-apply an alpha that is already present", () => {
    expect(withAlpha("oklch(19% 0.0094 256 / 0.4)", 0.8)).toBe(
      "oklch(19% 0.0094 256 / 0.4)"
    );
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
    expect(el.props.get("--color-bg")).toBe("oklch(19% 0.0094 256)");
    expect(el.props.get("--color-surface")).toBe("oklch(23.4% 0.0131 258)");
  });

  it("makes the background transparent + surfaces translucent in overlay mode", () => {
    // This is the fix for the black-overlay bug: applyTheme owns the inline
    // vars, and inline vars beat the overlay-mode stylesheet rules.
    const el = fakeEl() as HTMLElement & { props: Map<string, string> };
    applyTheme(getTheme("carbon"), true, el);
    expect(el.props.get("--color-bg")).toBe("transparent");
    expect(el.props.get("--bg")).toBe("transparent");
    expect(el.props.get("--color-surface")).toBe(
      "oklch(23.4% 0.0131 258 / 0.66)"
    );
    // Text/accent stay solid so content is readable over the game.
    expect(el.props.get("--color-text")).toBe("oklch(100% 0 0)");
  });

  it("emits the focus and on-accent tokens", () => {
    const el = fakeEl() as HTMLElement & { props: Map<string, string> };
    applyTheme(getTheme("carbon"), false, el);
    expect(el.props.get("--color-focus")).toBe("oklch(68.6% 0.1569 254)");
    expect(el.props.get("--color-on-accent")).toBe("oklch(19% 0.0094 256)");
  });

  it("falls back to the default theme for an unknown id", () => {
    expect(getTheme("obsidian").id).toBe("carbon");
  });
});

describe("theme token contract", () => {
  it("declares every color channel as an oklch value", () => {
    for (const theme of THEMES) {
      for (const [channel, value] of Object.entries(theme.colors)) {
        expect(
          value,
          `${theme.id}.${channel} must be OKLCH, got "${value}"`
        ).toMatch(/^oklch\(/);
      }
    }
  });

  it("pairs every theme's primary fill with a dark ink", () => {
    // `onAccent` is what filled controls put on top of `primary`. If a theme
    // ever ships a light ink here, every primary button in the app drops below
    // the 4.5:1 floor — which is exactly the bug this token was added to fix.
    for (const theme of THEMES) {
      const lightness = Number(
        /^oklch\(([\d.]+)%/.exec(theme.colors.onAccent)?.[1]
      );
      expect(lightness, `${theme.id}.onAccent lightness`).toBeLessThan(30);
    }
  });
});
