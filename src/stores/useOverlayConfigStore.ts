/**
 * Overlay Manager & Configuration store.
 *
 * Owns:
 *  - Named configuration profiles (create / duplicate / rename / delete / switch)
 *  - Per-overlay settings within the active profile:
 *      enabled, appearance (theme, saturation, brightness, opacity), visibility rules
 *  - Global settings: active theme, bridge endpoint, mock data, log level
 *  - The overlay the editor last had selected
 *
 * Every mutation is persisted to localStorage and broadcast over
 * {@link windowBus}, so an open overlay window updates the instant the editor
 * changes its config — no save/apply/refresh step. Incoming remote state is
 * applied without re-persisting or re-broadcasting (localStorage is shared
 * across same-origin windows), which keeps a single source of truth and avoids
 * feedback loops.
 */

import { create } from "zustand";
import { getTheme, applyTheme } from "../themes";
import type { MockSessionType } from "../lib/mockData";
import { isSingleView } from "../lib/overlayWindows";
import { broadcast, subscribe } from "../lib/windowBus";

// ── types ────────────────────────────────────────────────────────────────────

export interface OverlayAppearance {
  /** null = inherit the profile's global theme */
  themeId: string | null;
  /** 0–200; 100 = no-op (CSS saturate(100%)). */
  saturation: number;
  /** 0–200; 100 = no-op (CSS brightness(100%)). */
  brightness: number;
  /** 0–100 (%); 100 = fully opaque. */
  opacity: number;
}

export interface VisibilityRules {
  hideOnReplay: boolean;
  hideOnPits: boolean;
  hideOnLoneQualify: boolean;
}

export interface OverlaySettings {
  enabled: boolean;
  appearance: OverlayAppearance;
  visibility: VisibilityRules;
}

export interface Profile {
  id: string;
  name: string;
  /** Keyed by overlay id ("dashboard", "standings", "relative", …). */
  overlays: Record<string, OverlaySettings>;
}

export interface GlobalSettings {
  /** Active color theme id (falls back to "carbon" if unknown). */
  themeId: string;
  /** WebSocket endpoint for the telemetry bridge. */
  bridgeEndpoint: string;
  logLevel: "debug" | "info" | "warn" | "error";
  /**
   * Drive the UI from client-side synthetic telemetry when iRacing / the bridge
   * aren't available. Lets the whole app be used offline for dev, demos and
   * screenshots.
   */
  mockDataEnabled: boolean;
  /**
   * Which session the mock feed reports it is in.
   *
   * Not a cosmetic label: the timing screens read a practice or qualifying
   * session as a timesheet — ranked by best lap, with the race-only columns
   * dropped — so this switch is the only way to see that half of Standings and
   * Relative without a running sim. Ignored entirely when mock data is off.
   */
  mockSessionType: MockSessionType;
}

// ── defaults ─────────────────────────────────────────────────────────────────

export const DEFAULT_APPEARANCE: OverlayAppearance = {
  themeId: null,
  saturation: 100,
  brightness: 100,
  opacity: 100,
};

export const DEFAULT_VISIBILITY: VisibilityRules = {
  hideOnReplay: false,
  hideOnPits: false,
  hideOnLoneQualify: false,
};

export const DEFAULT_OVERLAY_SETTINGS: OverlaySettings = {
  enabled: true,
  appearance: DEFAULT_APPEARANCE,
  visibility: DEFAULT_VISIBILITY,
};

function makeDefaultGlobalSettings(): GlobalSettings {
  return {
    themeId: "carbon",
    bridgeEndpoint: "ws://127.0.0.1:8765",
    logLevel: "info",
    mockDataEnabled: false,
    mockSessionType: "Race",
  };
}

function makeProfile(id: string, name: string): Profile {
  return { id, name, overlays: {} };
}

// ── persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "telemetrylab.config.v1";

export interface Persisted {
  profiles: Profile[];
  activeProfileId: string;
  globalSettings: GlobalSettings;
  /** The overlay the editor should reopen on (last selection). */
  lastOverlayId: string | null;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    profiles: [makeProfile("default", "Default")],
    activeProfileId: "default",
    globalSettings: makeDefaultGlobalSettings(),
    lastOverlayId: null,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      profiles: p.profiles?.length ? p.profiles : fallback.profiles,
      activeProfileId: p.activeProfileId ?? fallback.activeProfileId,
      globalSettings: { ...fallback.globalSettings, ...p.globalSettings },
      lastOverlayId: p.lastOverlayId ?? fallback.lastOverlayId,
    };
  } catch {
    return fallback;
  }
}

/** True while applying a remote (bus) update, so we don't echo it back out. */
let applyingRemote = false;

/** Extract just the persisted slice of the store. */
function snapshot(s: Persisted): Persisted {
  return {
    profiles: s.profiles,
    activeProfileId: s.activeProfileId,
    globalSettings: s.globalSettings,
    lastOverlayId: s.lastOverlayId,
  };
}

function persist(s: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot(s)));
  } catch {}
  // Notify other windows so open overlays react to config changes live.
  if (!applyingRemote) broadcast("config:changed", snapshot(s));
}

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveProfile(profiles: Profile[], id: string): Profile {
  return profiles.find((p) => p.id === id) ?? profiles[0];
}

function patchOverlay(
  profiles: Profile[],
  profileId: string,
  overlayId: string,
  patch: Partial<OverlaySettings>
): Profile[] {
  return profiles.map((p) => {
    if (p.id !== profileId) return p;
    const prev = p.overlays[overlayId] ?? { ...DEFAULT_OVERLAY_SETTINGS };
    return {
      ...p,
      overlays: { ...p.overlays, [overlayId]: { ...prev, ...patch } },
    };
  });
}

function patchAppearance(
  profiles: Profile[],
  profileId: string,
  overlayId: string,
  patch: Partial<OverlayAppearance>
): Profile[] {
  return profiles.map((p) => {
    if (p.id !== profileId) return p;
    const prev = p.overlays[overlayId] ?? { ...DEFAULT_OVERLAY_SETTINGS };
    return {
      ...p,
      overlays: {
        ...p.overlays,
        [overlayId]: {
          ...prev,
          appearance: { ...prev.appearance, ...patch },
        },
      },
    };
  });
}

function patchVisibility(
  profiles: Profile[],
  profileId: string,
  overlayId: string,
  patch: Partial<VisibilityRules>
): Profile[] {
  return profiles.map((p) => {
    if (p.id !== profileId) return p;
    const prev = p.overlays[overlayId] ?? { ...DEFAULT_OVERLAY_SETTINGS };
    return {
      ...p,
      overlays: {
        ...p.overlays,
        [overlayId]: {
          ...prev,
          visibility: { ...prev.visibility, ...patch },
        },
      },
    };
  });
}

// ── store ─────────────────────────────────────────────────────────────────────

interface OverlayConfigState extends Persisted {
  // Profile CRUD
  createProfile: (name: string) => string;
  duplicateProfile: (id: string, newName: string) => string;
  renameProfile: (id: string, name: string) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string) => void;

  // Profile export (backup). Import was removed.
  exportProfile: (id: string) => string;

  // Editor selection
  setLastOverlay: (overlayId: string) => void;

  // Per-overlay settings (all scoped to the active profile)
  getOverlaySettings: (overlayId: string) => OverlaySettings;
  /** Whether an overlay is enabled in the active profile (defaults to true). */
  isOverlayEnabled: (overlayId: string) => boolean;
  setOverlayEnabled: (overlayId: string, enabled: boolean) => void;
  setOverlayTheme: (overlayId: string, themeId: string | null) => void;
  setOverlaySaturation: (overlayId: string, value: number) => void;
  setOverlayBrightness: (overlayId: string, value: number) => void;
  setOverlayOpacity: (overlayId: string, value: number) => void;
  setOverlayVisibility: (overlayId: string, patch: Partial<VisibilityRules>) => void;
  resetOverlay: (overlayId: string) => void;

  // Global settings
  setGlobalTheme: (themeId: string) => void;
  setGlobalSettings: (patch: Partial<GlobalSettings>) => void;
}

const initial = loadPersisted();

/** True when the current window is rendering as a transparent overlay. */
function isOverlayModeActive(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.classList.contains("overlay-mode") || isSingleView()
  );
}

// Apply the persisted theme immediately on module load.
if (typeof window !== "undefined") {
  applyTheme(getTheme(initial.globalSettings.themeId), isOverlayModeActive());
}

export const useOverlayConfigStore = create<OverlayConfigState>()((set, get) => ({
  ...initial,

  // ── profiles ────────────────────────────────────────────────────────────────

  createProfile(name) {
    const id = `profile_${Date.now()}`;
    set((s) => {
      const profiles = [...s.profiles, makeProfile(id, name)];
      persist({ ...s, profiles, activeProfileId: id });
      return { profiles, activeProfileId: id };
    });
    return id;
  },

  duplicateProfile(id, newName) {
    const newId = `profile_${Date.now()}`;
    set((s) => {
      const src = resolveProfile(s.profiles, id);
      const clone: Profile = {
        id: newId,
        name: newName,
        overlays: JSON.parse(JSON.stringify(src.overlays)),
      };
      const profiles = [...s.profiles, clone];
      persist({ ...s, profiles, activeProfileId: newId });
      return { profiles, activeProfileId: newId };
    });
    return newId;
  },

  renameProfile(id, name) {
    set((s) => {
      const profiles = s.profiles.map((p) =>
        p.id === id ? { ...p, name } : p
      );
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  deleteProfile(id) {
    set((s) => {
      if (s.profiles.length <= 1) return s; // always keep at least one
      const profiles = s.profiles.filter((p) => p.id !== id);
      const activeProfileId =
        s.activeProfileId === id ? profiles[0].id : s.activeProfileId;
      persist({ ...s, profiles, activeProfileId });
      return { profiles, activeProfileId };
    });
  },

  setActiveProfile(id) {
    set((s) => {
      if (!s.profiles.find((p) => p.id === id)) return s;
      persist({ ...s, activeProfileId: id });
      return { activeProfileId: id };
    });
  },

  exportProfile(id) {
    const p = resolveProfile(get().profiles, id);
    return JSON.stringify(p, null, 2);
  },

  setLastOverlay(overlayId) {
    set((s) => {
      if (s.lastOverlayId === overlayId) return s;
      persist({ ...s, lastOverlayId: overlayId });
      return { lastOverlayId: overlayId };
    });
  },

  // ── per-overlay ─────────────────────────────────────────────────────────────

  getOverlaySettings(overlayId) {
    const { profiles, activeProfileId } = get();
    const p = resolveProfile(profiles, activeProfileId);
    return p.overlays[overlayId] ?? { ...DEFAULT_OVERLAY_SETTINGS };
  },

  isOverlayEnabled(overlayId) {
    return get().getOverlaySettings(overlayId).enabled;
  },

  setOverlayEnabled(overlayId, enabled) {
    set((s) => {
      const profiles = patchOverlay(s.profiles, s.activeProfileId, overlayId, {
        enabled,
      });
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  setOverlayTheme(overlayId, themeId) {
    set((s) => {
      const profiles = patchAppearance(
        s.profiles,
        s.activeProfileId,
        overlayId,
        { themeId }
      );
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  setOverlaySaturation(overlayId, value) {
    set((s) => {
      const profiles = patchAppearance(
        s.profiles,
        s.activeProfileId,
        overlayId,
        { saturation: Math.round(Math.min(200, Math.max(0, value))) }
      );
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  setOverlayBrightness(overlayId, value) {
    set((s) => {
      const profiles = patchAppearance(
        s.profiles,
        s.activeProfileId,
        overlayId,
        { brightness: Math.round(Math.min(200, Math.max(0, value))) }
      );
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  setOverlayOpacity(overlayId, value) {
    set((s) => {
      const profiles = patchAppearance(
        s.profiles,
        s.activeProfileId,
        overlayId,
        { opacity: Math.round(Math.min(100, Math.max(0, value))) }
      );
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  setOverlayVisibility(overlayId, patch) {
    set((s) => {
      const profiles = patchVisibility(
        s.profiles,
        s.activeProfileId,
        overlayId,
        patch
      );
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  resetOverlay(overlayId) {
    set((s) => {
      const profiles = s.profiles.map((p) => {
        if (p.id !== s.activeProfileId) return p;
        const { [overlayId]: _removed, ...rest } = p.overlays;
        return { ...p, overlays: rest };
      });
      persist({ ...s, profiles });
      return { profiles };
    });
  },

  // ── global settings ─────────────────────────────────────────────────────────

  setGlobalTheme(themeId) {
    set((s) => {
      const globalSettings = { ...s.globalSettings, themeId };
      persist({ ...s, globalSettings });
      applyTheme(getTheme(themeId), isOverlayModeActive());
      return { globalSettings };
    });
  },

  setGlobalSettings(patch) {
    set((s) => {
      const globalSettings = { ...s.globalSettings, ...patch };
      persist({ ...s, globalSettings });
      return { globalSettings };
    });
  },
}));

// ── cross-window config sync ──────────────────────────────────────────────────
// Another window changed the config: adopt its state so open overlays reflect
// edits made in the manager immediately. We suppress persist/broadcast while
// applying (localStorage is already shared) to avoid a feedback loop, and only
// re-apply the theme when it actually changed.

subscribe("config:changed", (remote) => {
  // A remote snapshot may predate fields we rely on, so require the two we
  // cannot sensibly default before adopting anything.
  if (!remote || !Array.isArray(remote.profiles) || !remote.globalSettings) {
    return;
  }
  const { profiles, activeProfileId, globalSettings, lastOverlayId } = remote;
  applyingRemote = true;
  try {
    const current = useOverlayConfigStore.getState();
    const prevThemeId = current.globalSettings.themeId;
    useOverlayConfigStore.setState({
      profiles,
      activeProfileId: activeProfileId ?? current.activeProfileId,
      globalSettings,
      lastOverlayId: lastOverlayId ?? null,
    });
    if (globalSettings.themeId !== prevThemeId) {
      applyTheme(getTheme(globalSettings.themeId), isOverlayModeActive());
    }
  } finally {
    applyingRemote = false;
  }
});

/** Public name for the snapshot this store broadcasts over the window bus. */
export type OverlayConfigSnapshot = Persisted;
