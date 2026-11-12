import type { ComponentType } from "react";

import { DASHBOARDS } from "../../../dashboards/registry";

/**
 * One window the Layout editor can place: every full overlay that has its own
 * screen (Standings, Relative, Fuel Calc, Coach) and every Dashboard widget,
 * each of which opens in its own window. The Dashboard grid window itself is
 * left out — the Manager opens the widgets one by one, and laying out both
 * would put the same gauges on screen twice.
 */
export interface LayoutTarget {
  /** The window label, which keys its saved bounds, lock and scale. */
  label: string;
  kind: "overlay" | "widget";
  /** Overlay id or widget id — what opens the window. */
  id: string;
  title: string;
  icon: ComponentType<{ className?: string }>;
  /** The overlay whose settings (enabled, opacity, theme) apply to it. */
  configId: string;
}

/**
 * Where each window is *suggested* before the user has placed it, as the
 * fraction of the screen its top-left sits at: a conventional sim-racing HUD —
 * timing down the left, strategy top right, the Relative beside the mirror
 * line, the driving widgets in a row along the bottom. Only a suggestion: it
 * is drawn, never saved, until the user moves the window.
 */
export const SUGGESTED_ANCHOR: Readonly<Record<string, readonly [number, number]>> = {
  "overlay-standings": [0.01, 0.02],
  "overlay-fuel": [0.66, 0.02],
  "overlay-relative": [0.66, 0.4],
  "overlay-coach": [0.01, 0.42],
  "widget-timing": [0.42, 0.02],
  "widget-radar": [0.42, 0.4],
  "widget-position": [0.08, 0.79],
  "widget-inputs": [0.25, 0.79],
  "widget-cluster": [0.42, 0.79],
  "widget-fuel": [0.59, 0.79],
  "widget-tyres": [0.76, 0.79],
};

export const LAYOUT_TARGETS: readonly LayoutTarget[] = [
  ...DASHBOARDS.filter((d) => d.Screen).map((d) => ({
    label: `overlay-${d.id}`,
    kind: "overlay" as const,
    id: d.id,
    title: d.label,
    icon: d.icon,
    configId: d.id,
  })),
  ...DASHBOARDS.flatMap((d) =>
    d.widgets.map((w) => ({
      label: `widget-${w.id}`,
      kind: "widget" as const,
      id: w.id,
      title: w.title,
      icon: w.icon,
      configId: d.id,
    }))
  ),
];

export function getTarget(label: string): LayoutTarget | undefined {
  return LAYOUT_TARGETS.find((t) => t.label === label);
}
