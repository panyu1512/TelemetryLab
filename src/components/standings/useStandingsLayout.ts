import { useMemo } from "react";
import {
  useStandingsBestLapOrder,
  useStandingsClasses,
  useStandingsOrder,
} from "../../stores/useStandingsStore";
import { useRanksByLapTime } from "../../stores/useSessionStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { BAND_GAP, CLASS_BAND_H, CLASS_GAP, ROW_H } from "./constants";

/**
 * Flatten the grouped field into an absolutely-positioned item list.
 *
 * Every item gets a fixed `top` offset and is rendered with
 * `transform: translateY(top)` plus a CSS transition, so when the order changes
 * a row simply *glides* to its new slot — that is the animated position-swap,
 * for free, and it also makes windowed virtualization trivial (render only the
 * items whose offset is on screen).
 *
 * Crucially this only depends on the **order + grouping**, not on per-row data,
 * so it recomputes when cars change places — not every 10 Hz tick.
 *
 * Row presentation that follows from *position in the field* rather than from
 * telemetry — which row carries the column labels, which zebra phase a row is
 * on, which tone its class group sits at — is resolved here too, for the same
 * reason: it changes on reorder, not on tick.
 *
 * Class groups open with a band item when bands are on (`design.md` § Dense
 * tabular overlays, rule 2), and are separated by {@link CLASS_GAP} plus a tone
 * shift either way.
 */

/** One field row. */
export interface LayoutRow {
  kind: "row";
  key: string;
  top: number;
  carIdx: number;
  classId: number;
  /**
   * First row of its class group, so it carries the column labels
   * (`design.md` § Dense tabular overlays, rule 3).
   */
  leader: boolean;
  /** Alternating class-group tone index into `GROUP_TONE` (rule 2). */
  tone: number;
  /** Zebra phase within the group — derived here so reorders stay stable. */
  zebra: boolean;
  /**
   * The rank to print in the position column, or null to use the car's own
   * `position` from iRacing.
   *
   * Set only in a lap-time session, where the rows were ordered here rather
   * than by the bridge. It has to come from the same pass that placed the row:
   * a table sorted by best lap while printing iRacing's race position numbers
   * the rows P1, P4, P2 down the page, which is worse than either ordering on
   * its own.
   */
  rank: number | null;
}

/** The band that opens a class group and carries that class's own numbers. */
export interface LayoutBand {
  kind: "band";
  key: string;
  top: number;
  classId: number;
}

export type LayoutItem = LayoutRow | LayoutBand;

export interface StandingsLayout {
  items: LayoutItem[];
  totalHeight: number;
}

export function useStandingsLayout(): StandingsLayout {
  const classes = useStandingsClasses();
  const raceOrder = useStandingsOrder();
  const bestLapOrder = useStandingsBestLapOrder();
  const byLapTime = useRanksByLapTime();
  const grouping = useStandingsUiStore((s) => s.grouping);
  const showClassBands = useStandingsUiStore((s) => s.showClassBands);

  // In a lap-time session the whole table reads off the best-lap ranking; in a
  // race it reads off the bridge's race order. Both arrays hold their identity
  // between ticks, so this memo still only reruns when the field moves.
  const order = byLapTime ? bestLapOrder : raceOrder;

  return useMemo(() => {
    const items: LayoutItem[] = [];
    let top = 0;

    if (grouping === "overall" || classes.length === 0) {
      // One flat table in overall order. Attribute a class id per row for the
      // class-colour accent, using the class grouping when available.
      //
      // No bands here, and not because they were switched off: a flat table has
      // one group, and a band over the whole field would be naming something
      // the reader can already see.
      const classOf = new Map<number, number>();
      for (const c of classes) for (const idx of c.order) classOf.set(idx, c.carClassId);
      order.forEach((carIdx, i) => {
        items.push({
          kind: "row",
          key: `row-${carIdx}`,
          top,
          carIdx,
          classId: classOf.get(carIdx) ?? -1,
          // One group ⇒ the overall leader carries the labels, one tone throughout.
          leader: i === 0,
          tone: 0,
          zebra: i % 2 === 1,
          rank: byLapTime ? i + 1 : null,
        });
        top += ROW_H;
      });
      return { items, totalHeight: top };
    }

    // Grouped by class. The bridge's per-class `order` is a race order, so a
    // lap-time session rebuilds each group by filtering the best-lap ranking
    // down to that class's members — which keeps one ranking behind both the
    // flat table and the grouped one.
    const memberships = byLapTime
      ? new Map(
          classes.map((c) => {
            const members = new Set(c.order);
            return [c.carClassId, order.filter((idx) => members.has(idx))];
          }),
        )
      : null;

    classes.forEach((c, groupIndex) => {
      // A gap between groups, and none before the first, which would just be
      // padding at the top of the overlay.
      if (groupIndex > 0) top += CLASS_GAP;
      if (showClassBands) {
        items.push({
          kind: "band",
          key: `band-${c.carClassId}`,
          top,
          classId: c.carClassId,
        });
        top += CLASS_BAND_H + BAND_GAP;
      }
      const group = memberships?.get(c.carClassId) ?? c.order;
      group.forEach((carIdx, i) => {
        items.push({
          kind: "row",
          key: `row-${carIdx}`,
          top,
          carIdx,
          classId: c.carClassId,
          leader: i === 0,
          tone: groupIndex % 2,
          zebra: i % 2 === 1,
          rank: byLapTime ? i + 1 : null,
        });
        top += ROW_H;
      });
    });
    return { items, totalHeight: top };
  }, [classes, order, byLapTime, grouping, showClassBands]);
}
