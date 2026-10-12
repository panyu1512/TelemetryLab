import { useMemo } from "react";
import {
  useStandingsBestLapOrder,
  useStandingsClasses,
  useStandingsMeta,
  useStandingsOrder,
  useStandingsTimedOrder,
} from "../../stores/useStandingsStore";
import {
  useRanksByLapTime,
  useSessionKind,
} from "../../stores/useSessionStore";
import { SessionKind } from "../../lib/sessionKind";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { sliceGroup } from "../../lib/standingsWindow";
import {
  BAND_GAP,
  CLASS_BAND_H,
  CLASS_GAP,
  SKIP_H,
  rowSlotHeight,
} from "./constants";

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
 * telemetry — which row carries the column labels, and its rank in a lap-time
 * session — is resolved here too, for the same reason: it changes on reorder,
 * not on tick.
 *
 * Class groups open with a band item when bands are on (`design.md` § Dense
 * tabular overlays, rule 2), and are separated by {@link CLASS_GAP} either way.
 *
 * Unless the whole field is asked for, each group is capped (see
 * `lib/standingsWindow`): the player's class keeps its leaders and the cars
 * around the player, other classes their top runners. Where the kept rows skip
 * part of the order, a {@link LayoutSkip} marks the break.
 */

/** One field row. */
export interface LayoutRow {
  kind: "row";
  key: string;
  top: number;
  carIdx: number;
  classId: number;
  /**
   * First row of its class group: the leader, whose gap and interval cells
   * print the columns' names.
   */
  leader: boolean;
  /**
   * The leader's row with column labels switched on: it carries the labels
   * (`design.md` § Dense tabular overlays, rule 3) in a slot one label slice
   * taller than a plain row — see `rowSlotHeight`.
   */
  labelled: boolean;
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

/** A break in the running order, where a capped group skips cars. */
export interface LayoutSkip {
  kind: "skip";
  key: string;
  top: number;
  classId: number;
}

export type LayoutItem = LayoutRow | LayoutBand | LayoutSkip;

/**
 * A block of paper: a class band, or a class group's rows and skip marker,
 * fitted to them exactly. The space between blocks is left clear —
 * {@link CLASS_GAP} between classes, {@link BAND_GAP} between a band and its
 * rows — so over live footage the game shows between them (and between the
 * session header and the field). Inside a block the rows fill their slots
 * edge to edge, so a class's colour runs down the group as one spine.
 */
export interface LayoutBlock {
  key: string;
  top: number;
  height: number;
}

export interface StandingsLayout {
  items: LayoutItem[];
  blocks: LayoutBlock[];
  totalHeight: number;
}

export function useStandingsLayout(): StandingsLayout {
  const classes = useStandingsClasses();
  const raceOrder = useStandingsOrder();
  const bestLapOrder = useStandingsBestLapOrder();
  const timedOrder = useStandingsTimedOrder();
  const byLapTime = useRanksByLapTime();
  const qualifying = useSessionKind() === SessionKind.Qualify;
  const grouping = useStandingsUiStore((s) => s.grouping);
  const showClassBands = useStandingsUiStore((s) => s.showClassBands);
  const showColumnLabels = useStandingsUiStore((s) => s.showColumnLabels);
  const showWholeField = useStandingsUiStore((s) => s.showWholeField);
  const classRows = useStandingsUiStore((s) => s.classRows);
  const otherClassRows = useStandingsUiStore((s) => s.otherClassRows);
  const { playerCarIdx } = useStandingsMeta();

  // In a lap-time session the whole table reads off the best-lap ranking; in a
  // race it reads off the bridge's race order. Both arrays hold their identity
  // between ticks, so this memo still only reruns when the field moves.
  //
  // Qualifying reads off the timed cars alone: the board starts empty and a
  // car joins it when it sets its first lap (`lib/lapTimeOrder.timedOnly`).
  const order = qualifying ? timedOrder : byLapTime ? bestLapOrder : raceOrder;

  return useMemo(() => {
    const items: LayoutItem[] = [];
    const blocks: LayoutBlock[] = [];
    let top = 0;
    let blockTop = 0;
    const openBlock = () => {
      blockTop = top;
    };
    const closeBlock = (key: string) => {
      blocks.push({ key, top: blockTop, height: top - blockTop });
    };

    // Lay out one group's kept rows (with a skip marker where the order
    // breaks). `rank` is the car's place in the *whole* group, so a capped
    // timesheet still prints P14 for the fourteenth car, not P4.
    const pushGroup = (
      group: readonly number[],
      classOf: (carIdx: number) => number,
      groupClassId: number,
      cap: number,
    ) => {
      const slice = sliceGroup(
        group.length,
        group.indexOf(playerCarIdx),
        showWholeField ? 0 : cap,
      );
      slice.positions.forEach((pos, i) => {
        if (i === slice.breakAt) {
          items.push({
            kind: "skip",
            key: `skip-${groupClassId}`,
            top,
            classId: groupClassId,
          });
          top += SKIP_H;
        }
        const carIdx = group[pos];
        const labelled = showColumnLabels && i === 0;
        items.push({
          kind: "row",
          key: `row-${carIdx}`,
          top,
          carIdx,
          classId: classOf(carIdx),
          leader: i === 0,
          labelled,
          rank: byLapTime ? pos + 1 : null,
        });
        top += rowSlotHeight(labelled);
      });
    };

    if (grouping === "overall" || classes.length === 0) {
      // One flat table in overall order. Attribute a class id per row for the
      // class-colour accent, using the class grouping when available.
      //
      // No bands here, and not because they were switched off: a flat table has
      // one group, and a band over the whole field would be naming something
      // the reader can already see.
      //
      // One group ⇒ the overall leader carries the labels, and the player's
      // cap applies to the whole table.
      const classOf = new Map<number, number>();
      for (const c of classes) for (const idx of c.order) classOf.set(idx, c.carClassId);
      if (order.length === 0) return { items, blocks, totalHeight: 0 };
      openBlock();
      pushGroup(order, (idx) => classOf.get(idx) ?? -1, -1, classRows);
      closeBlock("block-all");
      return { items, blocks, totalHeight: top };
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

    let groupIndex = 0;
    for (const c of classes) {
      const group = memberships?.get(c.carClassId) ?? c.order;
      // A qualifying class nobody has set a time in yet is not on the board:
      // no band naming an empty group, and no gap for it.
      if (group.length === 0) continue;
      // A gap between groups, and none before the first, which would just be
      // padding at the top of the overlay. The gap is clear: the paper is
      // per block.
      if (groupIndex > 0) top += CLASS_GAP;
      groupIndex += 1;
      openBlock();
      if (showClassBands) {
        items.push({
          kind: "band",
          key: `band-${c.carClassId}`,
          top,
          classId: c.carClassId,
        });
        // The band is a block of its own, with `BAND_GAP` left clear under
        // it before the rows' block — so the game shows between a class's
        // name and its first position.
        top += CLASS_BAND_H;
        closeBlock(`block-band-${c.carClassId}`);
        top += BAND_GAP;
        openBlock();
      }
      const cap = group.includes(playerCarIdx) ? classRows : otherClassRows;
      pushGroup(group, () => c.carClassId, c.carClassId, cap);
      closeBlock(`block-${c.carClassId}`);
    }
    return { items, blocks, totalHeight: groupIndex > 0 ? top : 0 };
  }, [
    classes,
    order,
    byLapTime,
    grouping,
    showClassBands,
    showColumnLabels,
    showWholeField,
    classRows,
    otherClassRows,
    playerCarIdx,
  ]);
}
