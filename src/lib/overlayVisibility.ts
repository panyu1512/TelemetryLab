/**
 * When an overlay paints, and how: the Manager's Enabled switch, its "Hide
 * when" rules, and its appearance adjustments, resolved for one window.
 *
 * Every single-view window — a whole overlay (`OverlayWindow`) or one of the
 * Dashboard's widgets popped into its own window (`SingleWidgetWindow`) — runs
 * the same rules through here. Widget windows used to skip them, so the
 * Dashboard's Enabled switch, theme and sliders changed the Manager's preview
 * and nothing over the game.
 *
 * Pure and DOM-free so it can be unit-tested.
 */

import type {
  OverlayAppearance,
  OverlaySettings,
} from "../stores/useOverlayConfigStore";
import type { SessionInfo } from "../telemetry/types";

/** The live conditions the "Hide when" rules test. */
export interface VisibilityConditions {
  replay: boolean;
  loneQualify: boolean;
  onPitRoad: boolean;
}

/** Read the conditions off the session and the player's frame. */
export function visibilityConditions(
  session: Pick<SessionInfo, "sessionStateLabel" | "flags"> | null | undefined,
  onPitRoad: boolean | null | undefined,
): VisibilityConditions {
  const flags = session?.flags ?? [];
  return {
    replay: session?.sessionStateLabel === "Replay" || flags.includes("replay"),
    loneQualify: flags.includes("lone_qualify"),
    onPitRoad: onPitRoad === true,
  };
}

/** True when a "Hide when" rule matches right now (ignores Enabled). */
export function hiddenByRules(
  visibility: OverlaySettings["visibility"],
  c: VisibilityConditions,
): boolean {
  return (
    (visibility.hideOnReplay && c.replay) ||
    (visibility.hideOnPits && c.onPitRoad) ||
    (visibility.hideOnLoneQualify && c.loneQualify)
  );
}

/**
 * Whether a window should paint nothing. The window itself stays open, so it
 * still restores next launch and comes back the moment the rule stops
 * matching.
 *
 * `widgetEnabled` is the Dashboard's per-widget switch; a whole-overlay window
 * leaves it at its default.
 */
export function isOverlayHidden(
  settings: Pick<OverlaySettings, "enabled" | "visibility">,
  c: VisibilityConditions,
  widgetEnabled = true,
): boolean {
  return !settings.enabled || !widgetEnabled || hiddenByRules(settings.visibility, c);
}

/** The CSS an overlay's saturation, brightness and opacity sliders amount to. */
export function appearanceStyle(
  appearance: Pick<OverlayAppearance, "saturation" | "brightness" | "opacity">,
): { filter?: string; opacity?: number } {
  const style: { filter?: string; opacity?: number } = {};
  if (appearance.saturation !== 100 || appearance.brightness !== 100) {
    style.filter = `saturate(${appearance.saturation}%) brightness(${appearance.brightness}%)`;
  }
  if (appearance.opacity !== 100) style.opacity = appearance.opacity / 100;
  return style;
}

/** The theme an overlay paints in: its own override, else the global one. */
export function effectiveThemeId(
  appearance: Pick<OverlayAppearance, "themeId">,
  globalThemeId: string,
): string {
  return appearance.themeId ?? globalThemeId;
}
