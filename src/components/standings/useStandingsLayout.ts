import { useMemo } from "react";
import {
  useStandingsClasses,
  useStandingsOrder,
} from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { CLASS_HEADER_H, ROW_H } from "./constants";

/**
 * Flatten the grouped field into an absolutely-positioned item list.
 *
 * Every visible thing (class headers + rows) gets a fixed `top` offset. Rows are
 * then rendered with `transform: translateY(top)` and a CSS transition, so when
 * the order changes a row simply *glides* to its new slot — that is the animated
 * position-swap, for free, and it also makes windowed virtualization trivial
 * (render only the items whose offset is on screen).
 *
 * Crucially this only depends on the **order + grouping**, not on per-row data,
 * so it recomputes when cars change places — not every 10 Hz tick.
 */
export type LayoutItem =
  | { type: "class-header"; key: string; top: number; classId: number }
  | { type: "row"; key: string; top: number; carIdx: number; classId: number };

export interface StandingsLayout {
  items: LayoutItem[];
  totalHeight: number;
}

export function useStandingsLayout(): StandingsLayout {
  const classes = useStandingsClasses();
  const order = useStandingsOrder();
  const grouping = useStandingsUiStore((s) => s.grouping);
  const collapsed = useStandingsUiStore((s) => s.collapsed);
  const classFilter = useStandingsUiStore((s) => s.classFilter);

  return useMemo(() => {
    const items: LayoutItem[] = [];
    let top = 0;

    if (grouping === "overall" || classes.length === 0) {
      // One flat table in overall order. Attribute a class id per row for the
      // class-colour accent, using the class grouping when available.
      const classOf = new Map<number, number>();
      for (const c of classes) for (const idx of c.order) classOf.set(idx, c.carClassId);
      for (const carIdx of order) {
        items.push({
          type: "row",
          key: `row-${carIdx}`,
          top,
          carIdx,
          classId: classOf.get(carIdx) ?? -1,
        });
        top += ROW_H;
      }
      return { items, totalHeight: top };
    }

    for (const c of classes) {
      if (classFilter != null && c.carClassId !== classFilter) continue;
      items.push({
        type: "class-header",
        key: `cls-${c.carClassId}`,
        top,
        classId: c.carClassId,
      });
      top += CLASS_HEADER_H;
      if (collapsed[c.carClassId]) continue;
      for (const carIdx of c.order) {
        items.push({
          type: "row",
          key: `row-${carIdx}`,
          top,
          carIdx,
          classId: c.carClassId,
        });
        top += ROW_H;
      }
    }
    return { items, totalHeight: top };
  }, [classes, order, grouping, collapsed, classFilter]);
}
