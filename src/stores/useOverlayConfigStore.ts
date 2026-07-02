/**
 * v0.7.0 — Overlay Manager & Configuration store.
 *
 * Owns:
 *  - Named configuration profiles (create / duplicate / rename / delete / switch)
 *  - Per-overlay settings within the active profile:
 *      enabled, appearance (theme, saturation, brightness, opacity), visibility rules
 *  - Global settings: active theme, bridge endpoint, HTTP server config, log level
 *
 * All state is persisted to localStorage on every mutation.
 */

import { create } from "zustand";
import { getTheme, applyTheme } from "../themes";

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
  /** Active color theme id (falls back to "obsidian" if unknown). */
  themeId: string;
  /** WebSocket endpoint for the telemetry bridge. */
  bridgeEndpoint: string;
  /** Local HTTP server port (for browser-source OBS URLs). */
  httpServerPort: number;
  httpServerEnabled: boolean;
  browserSourcesEnabled: boolean;
  logLevel: "debug" | "info" | "warn" | "error";
  /** Simple token guarding the /overlay/* HTTP endpoints. */
  authKey: string;
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
    themeId: "obsidian",
    bridgeEndpoint: "ws://127.0.0.1:8765",
    httpServerPort: 9999,
    httpServerEnabled: false,
    browserSourcesEnabled: false,
    logLevel: "info",
    authKey: genKey(),
  };
}

function genKey(): string {
  const a = Math.random().toString(36).slice(2, 10);
  const b = Math.random().toString(36).slice(2, 10);
  return a + b;
}

function makeProfile(id: string, name: string): Profile {
  return { id, name, overlays: {} };
}

// ── persistence ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "telemetrylab.config.v1";

interface Persisted {
  profiles: Profile[];
  activeProfileId: string;
  globalSettings: GlobalSettings;
}

function loadPersisted(): Persisted {
  const fallback: Persisted = {
    profiles: [makeProfile("default", "Default")],
    activeProfileId: "default",
    globalSettings: makeDefaultGlobalSettings(),
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Persisted>;
    return {
      profiles: p.profiles?.length ? p.profiles : fallback.profiles,
      activeProfileId: p.activeProfileId ?? fallback.activeProfileId,
      globalSettings: { ...fallback.globalSettings, ...p.globalSettings },
    };
  } catch {
    return fallback;
  }
}

function persist(s: Persisted): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
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

  // Profile export/import
  exportProfile: (id: string) => string;
  importProfile: (json: string) => boolean;

  // Per-overlay settings (all scoped to the active profile)
  getOverlaySettings: (overlayId: string) => OverlaySettings;
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
  regenerateAuthKey: () => void;
}

const initial = loadPersisted();

// Apply the persisted theme immediately on module load.
if (typeof window !== "undefined") {
  applyTheme(getTheme(initial.globalSettings.themeId));
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

  importProfile(json) {
    try {
      const p = JSON.parse(json) as Profile;
      if (!p.id || !p.name) return false;
      const newId = `profile_${Date.now()}`;
      const imported: Profile = { ...p, id: newId };
      set((s) => {
        const profiles = [...s.profiles, imported];
        persist({ ...s, profiles, activeProfileId: newId });
        return { profiles, activeProfileId: newId };
      });
      return true;
    } catch {
      return false;
    }
  },

  // ── per-overlay ─────────────────────────────────────────────────────────────

  getOverlaySettings(overlayId) {
    const { profiles, activeProfileId } = get();
    const p = resolveProfile(profiles, activeProfileId);
    return p.overlays[overlayId] ?? { ...DEFAULT_OVERLAY_SETTINGS };
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
      applyTheme(getTheme(themeId));
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

  regenerateAuthKey() {
    set((s) => {
      const globalSettings = { ...s.globalSettings, authKey: genKey() };
      persist({ ...s, globalSettings });
      return { globalSettings };
    });
  },
}));
