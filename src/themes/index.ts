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
 * Every theme is the same instrument: near-monochrome graphite, light-grey
 * ink, ONE accent for focus and selection, and semantic colour only where it
 * means something. Themes vary the temperature of the neutrals and the exact
 * tone of the accent — never what a colour means, and never the accent's
 * family: it stays a cool cyan in all four, so the five car-class colours
 * (`lib/classColors`) can be spaced against a single reserved hue.
 */
export const THEMES: readonly Theme[] = [
  {
    id: "carbon",
    name: "Carbon",
    description: "Default · blue-black graphite, cyan accent",
    colors: {
      bg: "oklch(17.5% 0.009 255)",
      surface: "oklch(20.5% 0.01 255)",
      surface2: "oklch(23.5% 0.011 255)",
      border: "oklch(29% 0.012 255)",
      borderStrong: "oklch(36% 0.013 255)",
      accent: "oklch(75% 0.125 152)",
      accentDim: "oklch(64% 0.11 152)",
      primary: "oklch(79% 0.09 226)",
      primaryDim: "oklch(68% 0.085 226)",
      onAccent: "oklch(15% 0.008 255)",
      focus: "oklch(79% 0.09 226)",
      text: "oklch(91% 0.005 255)",
      muted: "oklch(72% 0.012 255)",
      faint: "oklch(60% 0.012 255)",
      danger: "oklch(67% 0.16 22)",
      warning: "oklch(84% 0.12 90)",
      sectorPurple: "oklch(70% 0.13 305)",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Deeper blue-black for night racing",
    colors: {
      bg: "oklch(15% 0.016 262)",
      surface: "oklch(18% 0.019 262)",
      surface2: "oklch(21% 0.021 262)",
      border: "oklch(26.5% 0.022 262)",
      borderStrong: "oklch(34% 0.024 262)",
      accent: "oklch(75% 0.125 152)",
      accentDim: "oklch(64% 0.11 152)",
      primary: "oklch(78% 0.09 234)",
      primaryDim: "oklch(67% 0.085 234)",
      onAccent: "oklch(13% 0.014 262)",
      focus: "oklch(78% 0.09 234)",
      text: "oklch(91% 0.01 262)",
      muted: "oklch(72% 0.018 262)",
      faint: "oklch(59% 0.02 262)",
      danger: "oklch(67% 0.16 22)",
      warning: "oklch(84% 0.12 90)",
      sectorPurple: "oklch(70% 0.13 305)",
    },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Pure neutral greys · a steel accent, minimum colour",
    colors: {
      bg: "oklch(17% 0 0)",
      surface: "oklch(20% 0 0)",
      surface2: "oklch(23% 0 0)",
      border: "oklch(28.5% 0 0)",
      borderStrong: "oklch(35.5% 0 0)",
      accent: "oklch(74% 0.115 152)",
      accentDim: "oklch(63% 0.1 152)",
      primary: "oklch(82% 0.045 228)",
      primaryDim: "oklch(71% 0.04 228)",
      onAccent: "oklch(14% 0 0)",
      focus: "oklch(82% 0.045 228)",
      text: "oklch(91% 0 0)",
      muted: "oklch(72% 0 0)",
      faint: "oklch(60% 0 0)",
      danger: "oklch(66% 0.15 22)",
      warning: "oklch(83% 0.11 90)",
      sectorPurple: "oklch(70% 0.12 305)",
    },
  },
  {
    /*
     * Endurance keeps its warm graphite, and gives up the copper accent it
     * used to carry: the system now has one accent family, and a copper
     * "interactive" sat between `danger` and `warning`, where the class
     * palette needs its orange.
     */
    id: "endurance",
    name: "Endurance",
    description: "Warm graphite with a pale cyan accent for long stints",
    colors: {
      bg: "oklch(17.5% 0.005 70)",
      surface: "oklch(20.5% 0.006 70)",
      surface2: "oklch(23.5% 0.007 70)",
      border: "oklch(29% 0.008 70)",
      borderStrong: "oklch(36% 0.009 70)",
      accent: "oklch(75% 0.125 152)",
      accentDim: "oklch(64% 0.11 152)",
      primary: "oklch(79% 0.085 222)",
      primaryDim: "oklch(68% 0.08 222)",
      onAccent: "oklch(15% 0.005 70)",
      focus: "oklch(79% 0.085 222)",
      text: "oklch(91% 0.008 80)",
      muted: "oklch(72% 0.012 75)",
      faint: "oklch(60% 0.012 72)",
      danger: "oklch(67% 0.16 22)",
      warning: "oklch(84% 0.12 90)",
      sectorPurple: "oklch(70% 0.13 305)",
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
  // The overlay panels' own graphite paper (see `--color-timing-bg` in
  // styles.css): a step under `bg`, so a panel is the darkest graphite in the
  // palette — never pure black. Over live footage it stays nearly opaque
  // rather than following the frame down to 0.66: a row of 12 px figures has
  // no room to lose contrast to a bright sky. Standings and Relative lay this
  // paper per block and leave the gaps clear, so the game is already in view
  // around the panels and the panels themselves can be solid.
  const timingBg = overlay
    ? `color-mix(in oklab, color-mix(in oklab, ${c.bg} 86%, #000) 92%, transparent)`
    : `color-mix(in oklab, ${c.bg} 86%, #000)`;

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
