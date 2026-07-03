import { describe, expect, it } from "vitest";

import { useOverlayConfigStore } from "./useOverlayConfigStore";

const store = () => useOverlayConfigStore.getState();

describe("mock data setting", () => {
  it("defaults off and can be toggled on", () => {
    expect(store().globalSettings.mockDataEnabled).toBe(false);
    store().setGlobalSettings({ mockDataEnabled: true });
    expect(store().globalSettings.mockDataEnabled).toBe(true);
    store().setGlobalSettings({ mockDataEnabled: false });
    expect(store().globalSettings.mockDataEnabled).toBe(false);
  });
});

describe("overlay enable/disable", () => {
  it("overlays are enabled by default", () => {
    expect(store().isOverlayEnabled("standings")).toBe(true);
  });

  it("can disable and re-enable an individual overlay", () => {
    store().setOverlayEnabled("relative", false);
    expect(store().isOverlayEnabled("relative")).toBe(false);
    store().setOverlayEnabled("relative", true);
    expect(store().isOverlayEnabled("relative")).toBe(true);
  });
});

describe("appearance clamping", () => {
  it("clamps opacity to 0–100", () => {
    store().setOverlayOpacity("dashboard", 999);
    expect(store().getOverlaySettings("dashboard").appearance.opacity).toBe(100);
    store().setOverlayOpacity("dashboard", -50);
    expect(store().getOverlaySettings("dashboard").appearance.opacity).toBe(0);
  });

  it("clamps saturation/brightness to 0–200", () => {
    store().setOverlaySaturation("dashboard", 500);
    expect(store().getOverlaySettings("dashboard").appearance.saturation).toBe(
      200
    );
    store().setOverlayBrightness("dashboard", -5);
    expect(store().getOverlaySettings("dashboard").appearance.brightness).toBe(0);
  });
});
