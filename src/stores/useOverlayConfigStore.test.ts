import { describe, expect, it } from "vitest";

import { migrateToHornet, useOverlayConfigStore } from "./useOverlayConfigStore";

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

describe("Hornet migration", () => {
  function memStorage(initial: Record<string, string> = {}) {
    const m = new Map(Object.entries(initial));
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  }
  const base = store().globalSettings;

  it("defaults new installs to Hornet", () => {
    expect(base.themeId).toBe("hornet");
  });

  it("moves a saved Carbon (the old default) to Hornet once", () => {
    const storage = memStorage();
    const out = migrateToHornet({ ...base, themeId: "carbon" }, storage);
    expect(out.themeId).toBe("hornet");
    // A later deliberate choice of Carbon survives.
    expect(migrateToHornet({ ...base, themeId: "carbon" }, storage).themeId).toBe(
      "carbon"
    );
  });

  it("leaves any other saved theme alone", () => {
    const out = migrateToHornet({ ...base, themeId: "midnight" }, memStorage());
    expect(out.themeId).toBe("midnight");
  });
});
