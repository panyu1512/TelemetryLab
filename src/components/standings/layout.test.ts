import { describe, expect, it } from "vitest";

import {
  CARD_BORDER,
  CARD_GAP,
  CLASS_BAND_H,
  LABEL_ROW_H,
  ROW_H,
} from "./constants";
import { itemHeight, layoutField, type LayoutRow } from "./layout";

const CLASSES = [
  { carClassId: 1, order: [10, 11, 12, 13, 14, 15, 16] },
  { carClassId: 2, order: [20, 21] },
];
const ORDER = [10, 11, 12, 20, 13, 14, 21, 15, 16];

const rows = (items: ReturnType<typeof layoutField>["items"]) =>
  items.filter((i): i is LayoutRow => i.kind === "row");

describe("layoutField — grouped by class", () => {
  const base = { classes: CLASSES, order: ORDER, byLapTime: false, grouped: true };

  it("opens each class with its header, then its rows, in a card of its own", () => {
    const { cards, items } = layoutField({ ...base, bands: true, labels: false });
    expect(cards.map((c) => c.classId)).toEqual([1, 2]);
    expect(items[0]).toMatchObject({ kind: "band", classId: 1, y: 0 });
    expect(rows(items).slice(0, 7).map((r) => r.carIdx)).toEqual(CLASSES[0].order);
  });

  it("stacks the cards with a gap, each exactly as tall as what it holds", () => {
    const { cards, totalHeight } = layoutField({ ...base, bands: true, labels: true });
    const first = CLASS_BAND_H + LABEL_ROW_H + 7 * ROW_H + 2 * CARD_BORDER;
    expect(cards[0]).toMatchObject({ top: 0, height: first });
    expect(cards[1].top).toBe(first + CARD_GAP);
    expect(totalHeight).toBe(cards[1].top + cards[1].height);
  });

  it("measures `top` from the field and `y` from the card", () => {
    const { cards, items } = layoutField({ ...base, bands: true, labels: false });
    for (const it of items) {
      const card = cards.find((c) => c.key === it.cardKey)!;
      expect(it.top).toBe(card.top + CARD_BORDER + it.y);
    }
  });

  it("puts the label row under the header when labels are on", () => {
    const { items } = layoutField({ ...base, bands: true, labels: true });
    expect(items[1]).toMatchObject({ kind: "labels", y: CLASS_BAND_H });
    expect(rows(items)[0].y).toBe(CLASS_BAND_H + LABEL_ROW_H);
  });

  it("counts each group in threes and alternates its zebra from the top", () => {
    const gt3 = rows(layoutField({ ...base, bands: false, labels: false }).items).slice(0, 7);
    expect(gt3.map((r) => r.divider)).toEqual([false, false, false, true, false, false, true]);
    expect(gt3.map((r) => r.zebra)).toEqual([false, true, false, true, false, true, false]);
    // A new group starts its count again.
    const gt4 = rows(layoutField({ ...base, bands: false, labels: false }).items).slice(7);
    expect(gt4.map((r) => r.divider)).toEqual([false, false]);
  });

  it("ranks by lap time within each class in a timesheet", () => {
    const { items } = layoutField({ ...base, byLapTime: true, bands: true, labels: false });
    const gt4 = rows(items).filter((r) => r.classId === 2);
    expect(gt4.map((r) => [r.carIdx, r.rank])).toEqual([
      [20, 1],
      [21, 2],
    ]);
  });

  it("skips a class with nobody in it", () => {
    const { cards } = layoutField({
      ...base,
      classes: [...CLASSES, { carClassId: 3, order: [] }],
      bands: true,
      labels: false,
    });
    expect(cards).toHaveLength(2);
  });
});

describe("layoutField — flat", () => {
  it("is one card in overall order, with no header", () => {
    const { cards, items } = layoutField({
      classes: CLASSES,
      order: ORDER,
      byLapTime: false,
      grouped: false,
      bands: true,
      labels: false,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0].classId).toBeNull();
    expect(items.some((i) => i.kind === "band")).toBe(false);
    expect(rows(items).map((r) => r.carIdx)).toEqual(ORDER);
    // Each row still knows its class, for the colour of its position block.
    expect(rows(items).find((r) => r.carIdx === 20)?.classId).toBe(2);
  });
});

describe("itemHeight", () => {
  it("is the height each kind of item draws at", () => {
    const { items } = layoutField({
      classes: CLASSES,
      order: ORDER,
      byLapTime: false,
      grouped: true,
      bands: true,
      labels: true,
    });
    expect(itemHeight(items[0])).toBe(CLASS_BAND_H);
    expect(itemHeight(items[1])).toBe(LABEL_ROW_H);
    expect(itemHeight(items[2])).toBe(ROW_H);
  });
});
