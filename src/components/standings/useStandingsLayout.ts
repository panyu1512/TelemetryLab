import { useMemo } from "react";
import {
  useStandingsClasses,
  useStandingsOrder,
} from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { CLASS_GAP, ROW_H } from "./constants";

/**
 * Flatten the grouped field into an absolutely-positioned row list.
 *
 * Every row gets a fixed `top` offset and is rendered with
 * `transform: translateY(top)` plus a CSS transition, so when the order changes
 * a row simply *glides* to its new slot — that is the animated position-swap,
 * for free, and it also makes windowed virtualization trivial (render only the
 * rows whose offset is on screen).
 *
 * Crucially this only depends on the **order + grouping**, not on per-row data,
 * so it recomputes when cars change places — not every 10 Hz tick.
 *
 * Row presentation that follows from *position in the field* rather than from
 * telemetry — which row carries the column labels, which zebra phase a row is
 * on, which tone its class group sits at — is resolved here too, for the same
 * reason: it changes on reorder, not on tick.
 *
 * There are no class-header items. Classes are separated by {@link CLASS_GAP}
 * and a tone shift (`design.md` § Dense tabular overlays, rule 2), which costs a
 * third of a band and needs nothing clickable.
 */
export interface LayoutRow {
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
}

export interface StandingsLayout {
  items: LayoutRow[];
  totalHeight: number;
}

export function useStandingsLayout(): StandingsLayout {
  const classes = useStandingsClasses();
  const order = useStandingsOrder();
  const grouping = useStandingsUiStore((s) => s.grouping);

  return useMemo(() => {
    const items: LayoutRow[] = [];
    let top = 0;

    if (grouping === "overall" || classes.length === 0) {
      // One flat table in overall order. Attribute a class id per row for the
      // class-colour accent, using the class grouping when available.
      const classOf = new Map<number, number>();
      for (const c of classes) for (const idx of c.order) classOf.set(idx, c.carClassId);
      order.forEach((carIdx, i) => {
        items.push({
          key: `row-${carIdx}`,
          top,
          carIdx,
          classId: classOf.get(carIdx) ?? -1,
          // One group ⇒ the overall leader carries the labels, one tone throughout.
          leader: i === 0,
          tone: 0,
          zebra: i % 2 === 1,
        });
        top += ROW_H;
      });
      return { items, totalHeight: top };
    }

    classes.forEach((c, groupIndex) => {
      // A gap between groups, and none before the first, which would just be
      // padding at the top of the overlay.
      if (groupIndex > 0) top += CLASS_GAP;
      c.order.forEach((carIdx, i) => {
        items.push({
          key: `row-${carIdx}`,
          top,
          carIdx,
          classId: c.carClassId,
          leader: i === 0,
          tone: groupIndex % 2,
          zebra: i % 2 === 1,
        });
        top += ROW_H;
      });
    });
    return { items, totalHeight: top };
  }, [classes, order, grouping]);
}
