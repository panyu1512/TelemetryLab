/** Named design-token bundles that drive all color/style in the app. */

export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderStrong: string;
  /** Positive status: personal best, faster, healthy. */
  accent: string;
  accentDim: string;
  /** Interactive & informational: selection, focus, links. */
  primary: string;
  primaryDim: string;
  text: string;
  /** Secondary text: labels, captions, supporting copy. */
  muted: string;
  /** Tertiary / disabled text. */
  faint: string;
  danger: string;
  warning: string;
  /** Special telemetry: overall-best laps and sectors. */
  sectorPurple: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  colors: ThemeColors;
}

/*
 * Every theme keeps the same restrained philosophy: cool dark neutrals, white
 * primary type, and accents reserved for status. Themes vary the temperature
 * of the neutrals and the exact accent hues — never the meaning of a color.
 */
export const THEMES: readonly Theme[] = [
  {
    id: "carbon",
    name: "Carbon",
    description: "Default · graphite neutrals, racing green + signal blue",
    colors: {
      bg: "#111418",
      surface: "#1a1e24",
      surface2: "#20252d",
      border: "#2c323b",
      borderStrong: "#3a424d",
      accent: "#2fd67f",
      accentDim: "#1fa862",
      primary: "#4d9cf8",
      primaryDim: "#2f7cd6",
      text: "#ffffff",
      muted: "#bac2cc",
      faint: "#6f7883",
      danger: "#f4564f",
      warning: "#f0b53c",
      sectorPurple: "#b07ef7",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep blue-black for night racing",
    colors: {
      bg: "#0c0f16",
      surface: "#131826",
      surface2: "#1a2030",
      border: "#252d40",
      borderStrong: "#323c52",
      accent: "#34d88a",
      accentDim: "#23a868",
      primary: "#5ea2ff",
      primaryDim: "#3d82e0",
      text: "#f2f6ff",
      muted: "#aab6c8",
      faint: "#68748a",
      danger: "#f45b5b",
      warning: "#efb84a",
      sectorPurple: "#a98cf8",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Pure neutral grays · minimum color, maximum focus",
    colors: {
      bg: "#101010",
      surface: "#181818",
      surface2: "#1f1f1f",
      border: "#2b2b2b",
      borderStrong: "#3a3a3a",
      accent: "#3ecf83",
      accentDim: "#2aa265",
      primary: "#8f98a3",
      primaryDim: "#6f7883",
      text: "#ffffff",
      muted: "#b8bcc2",
      faint: "#6e7278",
      danger: "#ef5350",
      warning: "#e6ae3d",
      sectorPurple: "#ab84f0",
    },
  },
  {
    id: "endurance",
    name: "Endurance",
    description: "Warm graphite with amber accents for long stints",
    colors: {
      bg: "#131211",
      surface: "#1c1a18",
      surface2: "#242120",
      border: "#322e2b",
      borderStrong: "#423d39",
      accent: "#3fd487",
      accentDim: "#2ba366",
      primary: "#e8a33d",
      primaryDim: "#c4842a",
      text: "#fdfaf6",
      muted: "#c6bfb6",
      faint: "#7d766e",
      danger: "#f25a4e",
      warning: "#f0b53c",
      sectorPurple: "#b78bf5",
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
  "--color-primary",
  "--color-primary-dim",
  "--color-text",
  "--color-muted",
  "--color-faint",
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
  const surface = overlay ? hexToRgba(c.surface, 0.66) : c.surface;
  const surface2 = overlay ? hexToRgba(c.surface2, 0.66) : c.surface2;
  const border = overlay ? hexToRgba(c.border, 0.5) : c.border;
  const borderStrong = overlay ? hexToRgba(c.borderStrong, 0.5) : c.borderStrong;

  el.style.setProperty("--color-bg", bg);
  el.style.setProperty("--color-surface", surface);
  el.style.setProperty("--color-surface-2", surface2);
  el.style.setProperty("--color-border", border);
  el.style.setProperty("--color-border-strong", borderStrong);
  el.style.setProperty("--color-accent", c.accent);
  el.style.setProperty("--color-accent-dim", c.accentDim);
  el.style.setProperty("--color-primary", c.primary);
  el.style.setProperty("--color-primary-dim", c.primaryDim);
  el.style.setProperty("--color-text", c.text);
  el.style.setProperty("--color-muted", c.muted);
  el.style.setProperty("--color-faint", c.faint);
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
