/** Named design-token bundles that drive all color/style in the app. */

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentDim: string;
  text: string;
  muted: string;
  danger: string;
  warning: string;
  sectorPurple: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

export const THEMES: readonly Theme[] = [
  {
    id: "obsidian",
    name: "Obsidian",
    description: "Default · dark green accent on near-black",
    colors: {
      bg: "#0a0a0a",
      surface: "#141414",
      surface2: "#1b1b1b",
      border: "#222222",
      borderStrong: "#333333",
      accent: "#00ff88",
      accentDim: "#00cc6e",
      text: "#e6e6e6",
      muted: "#888888",
      danger: "#ff4d4d",
      warning: "#ffcc00",
      sectorPurple: "#b061ff",
    },
  },
  {
    id: "neon",
    name: "Neon",
    description: "Electric magenta on deep navy",
    colors: {
      bg: "#05050f",
      surface: "#0e0e1e",
      surface2: "#141428",
      border: "#1c1c38",
      borderStrong: "#26264a",
      accent: "#ff00ff",
      accentDim: "#cc00cc",
      text: "#f0f0ff",
      muted: "#7070a0",
      danger: "#ff3355",
      warning: "#ffaa00",
      sectorPurple: "#8855ff",
    },
  },
  {
    id: "classic-dark",
    name: "Classic Dark",
    description: "Cool sapphire accent on charcoal",
    colors: {
      bg: "#0a0a14",
      surface: "#12121e",
      surface2: "#1a1a2c",
      border: "#22223a",
      borderStrong: "#2a2a4a",
      accent: "#4488ff",
      accentDim: "#2266cc",
      text: "#e0e4f0",
      muted: "#7080a0",
      danger: "#ff4444",
      warning: "#ffaa22",
      sectorPurple: "#aa55ff",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Warm amber on pitch black",
    colors: {
      bg: "#080808",
      surface: "#111111",
      surface2: "#181818",
      border: "#202020",
      borderStrong: "#303030",
      accent: "#ff8800",
      accentDim: "#cc6600",
      text: "#ede8e0",
      muted: "#887868",
      danger: "#ff4422",
      warning: "#ffcc00",
      sectorPurple: "#cc44ff",
    },
  },
] as const;

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const THEME_PROPS = [
  "--color-bg",
  "--color-surface",
  "--color-surface-2",
  "--color-border",
  "--color-border-strong",
  "--color-accent",
  "--color-accent-dim",
  "--color-text",
  "--color-muted",
  "--color-danger",
  "--color-warning",
  "--color-sector-purple",
  // Short aliases used in older component code
  "--bg",
  "--bg-elevated",
  "--border",
  "--accent",
  "--accent-dim",
  "--text",
  "--muted",
  "--danger",
  "--warning",
] as const;

/** Convert a `#rrggbb` / `#rgb` hex color to an `rgba()` string at `alpha`. */
export function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace("#", "").trim();
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Apply a theme's tokens as inline CSS custom properties on the root element.
 *
 * When `overlay` is true (a transparent, always-on-top overlay window or an OBS
 * browser source) the page background is made **transparent** and the widget
 * surfaces/borders **translucent**, so the game shows through. This MUST be set
 * here — inline on the same element — because inline custom properties beat the
 * `html.overlay-mode { … }` stylesheet rules; setting a solid `--color-bg`
 * inline (as the non-overlay path does) is exactly what used to paint a solid
 * black background over the game.
 */
export function applyTheme(
  theme: Theme,
  overlay = false,
  el: HTMLElement = document.documentElement
): void {
  const c = theme.colors;
  // Backgrounds/surfaces: solid normally, transparent/translucent in overlay.
  const bg = overlay ? "transparent" : c.bg;
  const surface = overlay ? hexToRgba(c.surface, 0.62) : c.surface;
  const surface2 = overlay ? hexToRgba(c.surface2, 0.62) : c.surface2;
  const border = overlay ? hexToRgba(c.border, 0.45) : c.border;
  const borderStrong = overlay ? hexToRgba(c.borderStrong, 0.45) : c.borderStrong;

  el.style.setProperty("--color-bg", bg);
  el.style.setProperty("--color-surface", surface);
  el.style.setProperty("--color-surface-2", surface2);
  el.style.setProperty("--color-border", border);
  el.style.setProperty("--color-border-strong", borderStrong);
  el.style.setProperty("--color-accent", c.accent);
  el.style.setProperty("--color-accent-dim", c.accentDim);
  el.style.setProperty("--color-text", c.text);
  el.style.setProperty("--color-muted", c.muted);
  el.style.setProperty("--color-danger", c.danger);
  el.style.setProperty("--color-warning", c.warning);
  el.style.setProperty("--color-sector-purple", c.sectorPurple);
  // Short aliases
  el.style.setProperty("--bg", bg);
  el.style.setProperty("--bg-elevated", surface);
  el.style.setProperty("--border", border);
  el.style.setProperty("--accent", c.accent);
  el.style.setProperty("--accent-dim", c.accentDim);
  el.style.setProperty("--text", c.text);
  el.style.setProperty("--muted", c.muted);
  el.style.setProperty("--danger", c.danger);
  el.style.setProperty("--warning", c.warning);
}

/** Revert to stylesheet defaults by removing all inline overrides. */
export function clearThemeOverrides(
  el: HTMLElement = document.documentElement
): void {
  for (const p of THEME_PROPS) el.style.removeProperty(p);
}
