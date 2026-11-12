/**
 * Profile import / export — the file format, and the checks a profile file
 * goes through before it is trusted.
 *
 * Export writes a small versioned wrapper so a future format change can be
 * told apart. Import accepts that wrapper and also a bare profile object (what
 * exports before 1.30 wrote). Nothing in a file is taken on faith: it may have
 * been hand-edited, come from a newer or older version, or not be a profile at
 * all. Unknown overlays are dropped, sliders are clamped to their ranges, an
 * unknown theme falls back to "follow the global theme", and the profile gets
 * a fresh id (and a unique name) so it can never overwrite one that exists.
 */

import type {
  OverlayAppearance,
  OverlaySettings,
  Profile,
  VisibilityRules,
} from "../stores/useOverlayConfigStore";

export const PROFILE_SCHEMA = "telemetrylab.profile";
export const PROFILE_VERSION = 1;

/** Larger than any real profile by two orders of magnitude. */
export const MAX_PROFILE_BYTES = 256 * 1024;

export interface ProfileFile {
  schema: typeof PROFILE_SCHEMA;
  version: number;
  profile: Profile;
}

/** The JSON an export writes. */
export function serializeProfile(profile: Profile): string {
  const file: ProfileFile = { schema: PROFILE_SCHEMA, version: PROFILE_VERSION, profile };
  return JSON.stringify(file, null, 2);
}

export type ImportResult =
  | { ok: true; profile: Profile; dropped: string[] }
  | { ok: false; error: string };

export interface ImportContext {
  /** Overlay ids this build knows. */
  overlayIds: readonly string[];
  /** Theme ids this build knows. */
  themeIds: readonly string[];
  /** Names already taken, so the import can be given a unique one. */
  existingNames: readonly string[];
  /** The id to give the imported profile. */
  newId: string;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function clampNum(v: unknown, lo: number, hi: number, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v)
    ? Math.min(hi, Math.max(lo, Math.round(v)))
    : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function readOverlay(v: unknown, themeIds: readonly string[]): OverlaySettings {
  const o = isObj(v) ? v : {};
  const a = isObj(o.appearance) ? o.appearance : {};
  const vis = isObj(o.visibility) ? o.visibility : {};
  const appearance: OverlayAppearance = {
    themeId:
      typeof a.themeId === "string" && themeIds.includes(a.themeId) ? a.themeId : null,
    saturation: clampNum(a.saturation, 0, 200, 100),
    brightness: clampNum(a.brightness, 0, 200, 100),
    opacity: clampNum(a.opacity, 0, 100, 100),
  };
  const visibility: VisibilityRules = {
    hideOnReplay: bool(vis.hideOnReplay, false),
    hideOnPits: bool(vis.hideOnPits, false),
    hideOnLoneQualify: bool(vis.hideOnLoneQualify, false),
  };
  return { enabled: bool(o.enabled, true), appearance, visibility };
}

/** "Sprint", "Sprint (2)", "Sprint (3)" … whichever is free. */
export function uniqueName(name: string, taken: readonly string[]): string {
  const lower = new Set(taken.map((n) => n.trim().toLowerCase()));
  const base = name.trim().slice(0, 60) || "Imported";
  if (!lower.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base} (${i})`;
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
}

/** Parse and validate a profile file's text. */
export function parseProfileImport(text: string, ctx: ImportContext): ImportResult {
  if (new Blob([text]).size > MAX_PROFILE_BYTES) {
    return { ok: false, error: "That file is too large to be a TelemetryLab profile." };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file is not valid JSON." };
  }
  if (!isObj(parsed)) return { ok: false, error: "That file does not contain a profile." };

  let raw: Record<string, unknown>;
  if (parsed.schema !== undefined) {
    if (parsed.schema !== PROFILE_SCHEMA) {
      return { ok: false, error: "That file is not a TelemetryLab profile." };
    }
    if (typeof parsed.version !== "number" || parsed.version > PROFILE_VERSION) {
      return {
        ok: false,
        error: "That profile was exported by a newer TelemetryLab. Update the app to import it.",
      };
    }
    if (!isObj(parsed.profile)) return { ok: false, error: "That file does not contain a profile." };
    raw = parsed.profile;
  } else {
    raw = parsed;
  }

  if (!isObj(raw.overlays)) {
    return { ok: false, error: "That file does not contain a profile." };
  }

  const overlays: Record<string, OverlaySettings> = {};
  const dropped: string[] = [];
  for (const [id, settings] of Object.entries(raw.overlays)) {
    if (ctx.overlayIds.includes(id)) overlays[id] = readOverlay(settings, ctx.themeIds);
    else dropped.push(id);
  }

  return {
    ok: true,
    dropped,
    profile: {
      id: ctx.newId,
      name: uniqueName(typeof raw.name === "string" ? raw.name : "Imported", ctx.existingNames),
      overlays,
    },
  };
}
