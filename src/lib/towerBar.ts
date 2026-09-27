/**
 * The tower's race-control bar: what it says, and what colour it is, for the
 * flags currently out.
 *
 * On a green track the bar is quiet paper with one filled badge naming the
 * session. Under a yellow the **whole bar** turns yellow, and under a full-course
 * caution — iRacing's pace car, which this bar calls by its broadcast name,
 * SAFETY CAR — it turns amber and takes diagonal stripes. That is the one
 * change on the tower that is meant to be seen without looking: it changes
 * what every driver on track does next.
 *
 * Neither state is carried by colour alone. Each has its own word, its own
 * glyph (a flag, a car) and the safety car its own pattern, so the two stay
 * apart for a reader who cannot tell amber from yellow.
 */

import { sessionTag } from "./sessionStrip";
import { SAFETY_CAR_STRIPES, TOWER } from "./towerPalette";

export type RaceControl = "green" | "yellow" | "safety_car";

export type BadgeGlyph = "flag" | "car" | null;

export interface TowerBarState {
  control: RaceControl;
  /** The bar's own ground and edge. */
  ground: string;
  border: string;
  /** Ink for the bar's micro-labels and values. */
  label: string;
  value: string;
  badge: {
    text: string;
    background: string;
    ink: string;
    /** Outline instead of a fill — the "no flag yet" state. */
    outline?: string;
    glyph: BadgeGlyph;
    title: string;
  };
  /** A second, smaller instruction beside the badge ("NO OVERTAKING"). */
  instruction: string | null;
}

type Rule = readonly [
  flag: string,
  control: RaceControl,
  text: string | null,
  background: string,
  ink: string,
  glyph: BadgeGlyph,
];

/**
 * Most urgent first — iRacing's mask routinely carries several bits at once
 * (green + start_go, yellow + caution_waving), so the first match wins. A
 * `null` text means "name the session instead".
 */
const RULES: readonly Rule[] = [
  ["checkered", "green", "CHEQUERED", TOWER.pit, TOWER.onPit, "flag"],
  ["red", "green", "RED FLAG", TOWER.soft, TOWER.darkInk, "flag"],
  ["disqualify", "green", "DISQUALIFIED", TOWER.dsq, TOWER.onDsq, "flag"],
  ["black", "green", "BLACK FLAG", TOWER.dsq, TOWER.onDsq, "flag"],
  ["repair", "green", "REPAIRS", TOWER.flagBadge, TOWER.caution, "flag"],
  ["caution_waving", "safety_car", "SAFETY CAR", TOWER.flagBadge, TOWER.onScBadge, "car"],
  ["caution", "safety_car", "SAFETY CAR", TOWER.flagBadge, TOWER.onScBadge, "car"],
  ["yellow_waving", "yellow", "YELLOW FLAG", TOWER.flagBadge, TOWER.onYellowBadge, "flag"],
  ["yellow", "yellow", "YELLOW FLAG", TOWER.flagBadge, TOWER.onYellowBadge, "flag"],
  ["debris", "green", "DEBRIS", TOWER.flagBadge, TOWER.caution, "flag"],
  ["furled", "green", "WARNING", TOWER.flagBadge, TOWER.caution, "flag"],
  ["blue", "green", "BLUE FLAG", TOWER.up, TOWER.darkInk, "flag"],
  ["white", "green", "FINAL LAP", TOWER.finalLap, TOWER.darkInk, "flag"],
  ["one_lap_to_green", "green", null, TOWER.raceBadge, TOWER.onRaceBadge, null],
  ["green", "green", null, TOWER.raceBadge, TOWER.onRaceBadge, null],
  ["green_held", "green", null, TOWER.raceBadge, TOWER.onRaceBadge, null],
];

const GROUND: Record<RaceControl, Pick<TowerBarState, "ground" | "border" | "label" | "value">> = {
  green: { ground: TOWER.surface, border: TOWER.border, label: TOWER.text3, value: TOWER.text },
  yellow: {
    ground: TOWER.yellowBar,
    border: TOWER.yellowBorder,
    label: TOWER.yellowLabel,
    value: TOWER.yellowValue,
  },
  safety_car: {
    ground: SAFETY_CAR_STRIPES,
    border: TOWER.scBorder,
    label: TOWER.scLabel,
    value: TOWER.scValue,
  },
};

/** The bar's full state for the active flags. */
export function towerBarState(
  flags: readonly string[],
  sessionType: string,
  sessionName: string,
): TowerBarState {
  const set = new Set(flags);
  const rule = RULES.find(([flag]) => set.has(flag));
  const tag = sessionTag(sessionType);
  if (!rule) {
    // No flag yet (gridding, between sessions): the session named in outline,
    // so the one filled badge on the bar keeps meaning "a flag is out".
    return {
      control: "green",
      ...GROUND.green,
      badge: {
        text: tag,
        background: "transparent",
        ink: TOWER.text2,
        outline: TOWER.chipBorder,
        glyph: null,
        title: sessionName,
      },
      instruction: null,
    };
  }
  const [flag, control, text, background, ink, glyph] = rule;
  return {
    control,
    ...GROUND[control],
    badge: {
      text: text ?? tag,
      background,
      ink,
      glyph,
      title: `${sessionName} · ${flag.replace(/_/g, " ")}`,
    },
    instruction: control === "safety_car" ? "NO OVERTAKING" : null,
  };
}

/** Just the race-control state, for callers that only need the ground. */
export function raceControl(flags: readonly string[]): RaceControl {
  return towerBarState(flags, "", "").control;
}
