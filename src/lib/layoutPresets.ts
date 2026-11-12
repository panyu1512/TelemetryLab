/**
 * Layout presets: a named snapshot of where every overlay / widget window
 * sits, how large its content draws, whether it is locked and whether it is
 * open — so "GT3 sprint on the triple" and "endurance on one screen" are one
 * click apart.
 *
 * This module is the pure part: building a preset from window states, keeping
 * the saved list, and working out what loading one changes. Opening, closing
 * and moving the windows is the Layout editor's job.
 */

import type { WindowBounds, WindowState } from "./windowState";
import { isPlausibleBounds } from "./windowPlacement";

export interface PresetWindow {
  bounds?: WindowBounds;
  /** Content scale, 1 = 100 %. */
  scale: number;
  locked: boolean;
  open: boolean;
}

export interface LayoutPreset {
  id: string;
  name: string;
  /** ms since epoch. */
  savedAt: number;
  /** Keyed by window label (`overlay-<id>` / `widget-<id>`). */
  windows: Record<string, PresetWindow>;
}

export const PRESETS_KEY = "telemetrylab.layout-presets.v1";

/** Most presets kept; the oldest beyond this are dropped on save. */
export const MAX_PRESETS = 24;

type KV = Pick<Storage, "getItem" | "setItem">;

function isPresetWindow(w: unknown): w is PresetWindow {
  if (!w || typeof w !== "object") return false;
  const o = w as Record<string, unknown>;
  return (
    typeof o.scale === "number" &&
    typeof o.locked === "boolean" &&
    typeof o.open === "boolean" &&
    (o.bounds === undefined || isPlausibleBounds(o.bounds as WindowBounds))
  );
}

function isPreset(p: unknown): p is LayoutPreset {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.savedAt === "number" &&
    !!o.windows &&
    typeof o.windows === "object" &&
    Object.values(o.windows as object).every(isPresetWindow)
  );
}

/** The saved presets, newest first. Anything malformed is skipped. */
export function loadPresets(storage: KV): LayoutPreset[] {
  try {
    const raw = storage.getItem(PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isPreset) : [];
  } catch {
    return [];
  }
}

export function savePresets(storage: KV, presets: readonly LayoutPreset[]): void {
  try {
    storage.setItem(PRESETS_KEY, JSON.stringify(presets.slice(0, MAX_PRESETS)));
  } catch {
    // Storage unavailable: presets just won't persist.
  }
}

/** Snapshot the given windows into a preset. */
export function capturePreset(
  name: string,
  labels: readonly string[],
  stateOf: (label: string) => WindowState,
  isOpen: (label: string) => boolean,
  now = Date.now(),
  id = `preset-${now.toString(36)}`
): LayoutPreset {
  const windows: Record<string, PresetWindow> = {};
  for (const label of labels) {
    const s = stateOf(label);
    windows[label] = {
      ...(isPlausibleBounds(s.bounds) ? { bounds: s.bounds } : {}),
      scale: typeof s.scale === "number" && s.scale > 0 ? s.scale : 1,
      locked: !!s.locked,
      open: isOpen(label),
    };
  }
  return { id, name: name.trim() || "Layout", savedAt: now, windows };
}

/**
 * Add a preset to the front of the list. A preset with the same name (case
 * insensitive) is replaced rather than duplicated — "Save as" over an
 * existing name updates it.
 */
export function upsertPreset(
  list: readonly LayoutPreset[],
  preset: LayoutPreset
): LayoutPreset[] {
  const key = preset.name.trim().toLowerCase();
  return [preset, ...list.filter((p) => p.name.trim().toLowerCase() !== key)].slice(
    0,
    MAX_PRESETS
  );
}

export function removePreset(list: readonly LayoutPreset[], id: string): LayoutPreset[] {
  return list.filter((p) => p.id !== id);
}

/** What loading a preset does to the windows. */
export interface PresetPlan {
  /** Windows to open (closed now, open in the preset). */
  open: string[];
  /** Windows to close (open now, closed in the preset). */
  close: string[];
  /** The state every window in the preset should end up with. */
  states: Record<string, WindowState>;
}

/**
 * Work out a preset load against what is open now. Windows the preset does
 * not mention are left exactly as they are.
 */
export function planPresetLoad(
  preset: LayoutPreset,
  currentlyOpen: ReadonlySet<string>
): PresetPlan {
  const plan: PresetPlan = { open: [], close: [], states: {} };
  for (const [label, w] of Object.entries(preset.windows)) {
    plan.states[label] = {
      ...(w.bounds ? { bounds: w.bounds } : {}),
      locked: w.locked,
      scale: w.scale,
    };
    const isOpen = currentlyOpen.has(label);
    if (w.open && !isOpen) plan.open.push(label);
    if (!w.open && isOpen) plan.close.push(label);
  }
  return plan;
}
