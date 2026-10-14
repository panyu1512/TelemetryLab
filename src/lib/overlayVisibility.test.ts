import { describe, expect, it } from "vitest";

import {
  appearanceStyle,
  effectiveThemeId,
  hiddenByRules,
  isOverlayHidden,
  visibilityConditions,
} from "./overlayVisibility";

const NOTHING = { replay: false, loneQualify: false, onPitRoad: false };
const NO_RULES = { hideOnReplay: false, hideOnPits: false, hideOnLoneQualify: false };
const ALL_RULES = { hideOnReplay: true, hideOnPits: true, hideOnLoneQualify: true };

describe("visibilityConditions", () => {
  it("reads replay from the state label or the flag", () => {
    expect(visibilityConditions({ sessionStateLabel: "Replay", flags: [] }, null).replay).toBe(
      true,
    );
    expect(visibilityConditions({ sessionStateLabel: "Racing", flags: ["replay"] }, null)).toEqual(
      { replay: true, loneQualify: false, onPitRoad: false },
    );
  });

  it("reads lone qualifying from the flags and the pits from the frame", () => {
    expect(
      visibilityConditions({ sessionStateLabel: "Racing", flags: ["lone_qualify"] }, true),
    ).toEqual({ replay: false, loneQualify: true, onPitRoad: true });
  });

  it("treats no session and no frame as nothing going on", () => {
    expect(visibilityConditions(null, null)).toEqual(NOTHING);
    expect(visibilityConditions(undefined, undefined)).toEqual(NOTHING);
  });
});

describe("hiddenByRules", () => {
  it("hides only when a ticked rule matches", () => {
    expect(hiddenByRules(NO_RULES, { replay: true, loneQualify: true, onPitRoad: true })).toBe(
      false,
    );
    expect(hiddenByRules(ALL_RULES, NOTHING)).toBe(false);
    expect(hiddenByRules({ ...NO_RULES, hideOnPits: true }, { ...NOTHING, onPitRoad: true })).toBe(
      true,
    );
    expect(hiddenByRules({ ...NO_RULES, hideOnReplay: true }, { ...NOTHING, replay: true })).toBe(
      true,
    );
    expect(
      hiddenByRules({ ...NO_RULES, hideOnLoneQualify: true }, { ...NOTHING, loneQualify: true }),
    ).toBe(true);
  });
});

describe("isOverlayHidden", () => {
  it("hides a disabled overlay whatever the session", () => {
    expect(isOverlayHidden({ enabled: false, visibility: NO_RULES }, NOTHING)).toBe(true);
  });

  it("hides a widget whose own toggle is off, even on an enabled dashboard", () => {
    expect(isOverlayHidden({ enabled: true, visibility: NO_RULES }, NOTHING, false)).toBe(true);
    expect(isOverlayHidden({ enabled: true, visibility: NO_RULES }, NOTHING, true)).toBe(false);
  });

  it("applies the Hide-when rules on top", () => {
    expect(
      isOverlayHidden({ enabled: true, visibility: ALL_RULES }, { ...NOTHING, onPitRoad: true }),
    ).toBe(true);
    expect(isOverlayHidden({ enabled: true, visibility: ALL_RULES }, NOTHING)).toBe(false);
  });
});

describe("appearanceStyle", () => {
  it("is empty at the defaults", () => {
    expect(appearanceStyle({ saturation: 100, brightness: 100, opacity: 100 })).toEqual({});
  });

  it("emits a filter for saturation or brightness and a fraction for opacity", () => {
    expect(appearanceStyle({ saturation: 50, brightness: 100, opacity: 100 })).toEqual({
      filter: "saturate(50%) brightness(100%)",
    });
    expect(appearanceStyle({ saturation: 100, brightness: 140, opacity: 40 })).toEqual({
      filter: "saturate(100%) brightness(140%)",
      opacity: 0.4,
    });
  });
});

describe("effectiveThemeId", () => {
  it("prefers the overlay's own theme, else the global one", () => {
    expect(effectiveThemeId({ themeId: "paddock" }, "carbon")).toBe("paddock");
    expect(effectiveThemeId({ themeId: null }, "carbon")).toBe("carbon");
  });
});
