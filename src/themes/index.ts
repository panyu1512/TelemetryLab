/**
 * Named design-token bundles that drive all color/style in the app.
 *
 * Every value is OKLCH. The channels are perceptual, so a token can be lifted
 * to clear a contrast target without dragging its hue along, and the four
 * themes below stay comparable to each other channel-by-channel.
 */

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
  /**
   * Text drawn on top of ANY filled status color — primary, danger, accent.
   * Every accent here is light and every paper dark, so white-on-accent lands
   * at 2.2–2.9:1; dark ink on the same fill reads at 6.5–8.7:1. Filled
   * controls must use this, never white.
   */
  onAccent: string;
  /**
   * The keyboard focus ring. Deliberately its own token rather than an alias
   * of `primary`: a theme whose interactive hue sits near `warning` needs to
   * move one without moving the other.
   */
  focus: string;
  text: string;
  /** Secondary text: labels, captions, supporting copy. */
  muted: string;
  /** Tertiary / disabled text. Held at L≈61% — the floor that clears 4.5:1
   *  against `surface`, since it carries 10–11 px labels on cards. */
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
      bg: "oklch(19% 0.0094 256)",
      surface: "oklch(23.4% 0.0131 258)",
      surface2: "oklch(26.3% 0.0167 260)",
      border: "oklch(31.5% 0.0182 258)",
      borderStrong: "oklch(37.6% 0.0217 256)",
      accent: "oklch(77.4% 0.181 154)",
      accentDim: "oklch(64.6% 0.1526 155)",
      primary: "oklch(68.6% 0.1569 254)",
      primaryDim: "oklch(58.5% 0.1568 255)",
      onAccent: "oklch(19% 0.0094 256)",
      focus: "oklch(68.6% 0.1569 254)",
      text: "oklch(100% 0 0)",
      muted: "oklch(81.1% 0.0166 254)",
      faint: "oklch(62% 0.021 256)",
      danger: "oklch(66.5% 0.195 26)",
      warning: "oklch(80.7% 0.1472 81)",
      sectorPurple: "oklch(69.4% 0.1763 301)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deep blue-black for night racing",
    colors: {
      bg: "oklch(16.9% 0.0155 267)",
      surface: "oklch(21.1% 0.0289 269)",
      surface2: "oklch(24.6% 0.0319 268)",
      border: "oklch(29.9% 0.0365 267)",
      borderStrong: "oklch(35.7% 0.0407 265)",
      accent: "oklch(78.2% 0.1725 157)",
      accentDim: "oklch(64.8% 0.146 156)",
      primary: "oklch(70.9% 0.1534 257)",
      primaryDim: "oklch(60.9% 0.1589 257)",
      onAccent: "oklch(16.9% 0.0155 267)",
      focus: "oklch(70.9% 0.1534 257)",
      text: "oklch(97.3% 0.0128 267)",
      muted: "oklch(77.3% 0.029 258)",
      faint: "oklch(60.7% 0.0369 261)",
      danger: "oklch(67.3% 0.1884 24)",
      warning: "oklch(81.3% 0.1392 82)",
      sectorPurple: "oklch(71.1% 0.1552 295)",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Pure neutral grays · minimum color, maximum focus",
    colors: {
      bg: "oklch(17.3% 0 0)",
      surface: "oklch(20.9% 0 0)",
      surface2: "oklch(23.9% 0 0)",
      border: "oklch(28.9% 0 0)",
      borderStrong: "oklch(34.8% 0 0)",
      accent: "oklch(76% 0.1641 156)",
      accentDim: "oklch(63.2% 0.1388 156)",
      primary: "oklch(67.6% 0.0193 253)",
      primaryDim: "oklch(56.9% 0.0201 253)",
      onAccent: "oklch(17.3% 0 0)",
      focus: "oklch(67.6% 0.0193 253)",
      text: "oklch(100% 0 0)",
      muted: "oklch(79.4% 0.0096 258)",
      faint: "oklch(60.6% 0.0116 262)",
      danger: "oklch(65.4% 0.1926 25)",
      warning: "oklch(78.4% 0.1405 81)",
      sectorPurple: "oklch(69.5% 0.1574 299)",
    },
  },
  {
    /*
     * Endurance's interactive hue used to sit 8° from `warning` at nearly the
     * same lightness — "you can click this" and "caution" were, in practice,
     * the same color, in a system whose whole premise is that a color means
     * one thing. Pulled to copper (45°), which holds the warm identity and
     * puts 36° between interactive and caution.
     */
    id: "endurance",
    name: "Endurance",
    description: "Warm graphite with copper accents for long stints",
    colors: {
      bg: "oklch(18.3% 0.0026 68)",
      surface: "oklch(21.9% 0.005 68)",
      surface2: "oklch(25.1% 0.0049 39)",
      border: "oklch(30.4% 0.0079 59)",
      borderStrong: "oklch(36.4% 0.0097 61)",
      accent: "oklch(77.4% 0.1667 156)",
      accentDim: "oklch(63.6% 0.1389 156)",
      primary: "oklch(70% 0.15 45)",
      primaryDim: "oklch(62% 0.145 44)",
      onAccent: "oklch(18.3% 0.0026 68)",
      focus: "oklch(70% 0.15 45)",
      text: "oklch(98.6% 0.0062 75)",
      muted: "oklch(80.8% 0.0148 74)",
      faint: "oklch(61.4% 0.0146 71)",
      danger: "oklch(66.6% 0.1891 28)",
      warning: "oklch(80.7% 0.1472 81)",
      sectorPurple: "oklch(72.1% 0.1549 302)",
    },
  },
] as const;

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

const THEME_PROPS = [
  "--color-bg",
  "--color-timing-bg",
  "--color-surface",
  "--color-surface-2",
  "--color-border",
  "--color-border-strong",
  "--color-accent",
  "--color-accent-dim",
  "--color-primary",
  "--color-primary-dim",
  "--color-on-accent",
  "--color-focus",
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
  "--focus",
] as const;

/**
 * Apply `alpha` to an OKLCH color string using CSS's relative-alpha syntax —
 * `oklch(L C H)` becomes `oklch(L C H / alpha)`.
 *
 * Anything that isn't a plain `oklch(…)` value (notably the literal
 * `transparent`) is returned unchanged, so callers can pass a color through
 * without first checking its shape.
 */
export function withAlpha(color: string, alpha: number): string {
  const match = /^oklch\(([^/)]+)\)$/i.exec(color.trim());
  if (!match) return color;
  return `oklch(${match[1].trim()} / ${alpha})`;
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
  const surface = overlay ? withAlpha(c.surface, 0.66) : c.surface;
  const surface2 = overlay ? withAlpha(c.surface2, 0.66) : c.surface2;
  const border = overlay ? withAlpha(c.border, 0.5) : c.border;
  const borderStrong = overlay ? withAlpha(c.borderStrong, 0.5) : c.borderStrong;
  // The timing surfaces' own near-black paper (see `--color-timing-bg` in
  // styles.css). Over live footage it stays *opaque enough to read as its own
  // panel* rather than following the other surfaces down to 0.66 glass — a
  // 30 px row of 12 px type has no room to lose contrast to a bright sky.
  const timingBg = overlay
    ? "rgb(0 0 0 / 0.82)"
    : `color-mix(in oklab, ${c.bg} 30%, #000)`;

  el.style.setProperty("--color-bg", bg);
  el.style.setProperty("--color-timing-bg", timingBg);
  el.style.setProperty("--color-surface", surface);
  el.style.setProperty("--color-surface-2", surface2);
  el.style.setProperty("--color-border", border);
  el.style.setProperty("--color-border-strong", borderStrong);
  el.style.setProperty("--color-accent", c.accent);
  el.style.setProperty("--color-accent-dim", c.accentDim);
  el.style.setProperty("--color-primary", c.primary);
  el.style.setProperty("--color-primary-dim", c.primaryDim);
  el.style.setProperty("--color-on-accent", c.onAccent);
  el.style.setProperty("--color-focus", c.focus);
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
  el.style.setProperty("--focus", c.focus);
}

/** Revert to stylesheet defaults by removing all inline overrides. */
export function clearThemeOverrides(
  el: HTMLElement = document.documentElement
): void {
  for (const p of THEME_PROPS) el.style.removeProperty(p);
}
