import {
  CARD_BORDER,
  CARD_GAP,
  CLASS_BAND_H,
  DIVIDER_EVERY,
  LABEL_ROW_H,
  ROW_H,
} from "./constants";

/**
 * Flatten the grouped field into class cards and absolutely-positioned items.
 *
 * The tower draws each class as a card — its header, an optional label row,
 * then its rows — stacked with a gap between cards. Every item gets two
 * offsets: `top`, from the top of the whole field (what windowing and the
 * follow-my-row scroll measure against), and `y`, from the top of its own card
 * (what it is drawn at, since rows live inside their card so the card's rounded
 * corners clip them).
 *
 * Rows are placed with `translateY` and a CSS transition, so when the order
 * changes a row *glides* to its new slot — the animated position swap, for
 * free — and only the rows on screen are mounted.
 *
 * This depends only on **order + grouping**, never on per-row data, so it
 * recomputes when cars change places — not every 10 Hz tick. What follows from
 * a row's *place* rather than its telemetry — its zebra phase, whether the
 * hairline that counts the field in threes sits above it — is resolved here for
 * the same reason.
 */

/** A class card (or the one card of a flat table). */
export interface LayoutCard {
  key: string;
  top: number;
  height: number;
  /** The class it holds, or null for the flat overall table. */
  classId: number | null;
}

interface Placed {
  key: string;
  /** From the top of the field. */
  top: number;
  /** From the top of the card's inner box. */
  y: number;
  cardKey: string;
}

/** One field row. */
export interface LayoutRow extends Placed {
  kind: "row";
  carIdx: number;
  classId: number;
  /** Odd rows of a group sit a step darker. */
  zebra: boolean;
  /** The hairline after every third row, drawn at the top of this one. */
  divider: boolean;
  /**
   * The rank to print in the position column, or null to use the car's own
   * `position` from iRacing. Set only in a lap-time session, where the rows
   * were ordered here — see `lib/sessionKind`.
   */
  rank: number | null;
}

/** The header that opens a class card. */
export interface LayoutBand extends Placed {
  kind: "band";
  classId: number;
}

/** The optional column-label row under a header. */
export interface LayoutLabels extends Placed {
  kind: "labels";
}

export type LayoutItem = LayoutRow | LayoutBand | LayoutLabels;

export interface StandingsLayout {
  cards: LayoutCard[];
  items: LayoutItem[];
  totalHeight: number;
}

/** Height of the thing an item draws — for windowing. */
export function itemHeight(it: LayoutItem): number {
  return it.kind === "band" ? CLASS_BAND_H : it.kind === "labels" ? LABEL_ROW_H : ROW_H;
}

export interface LayoutInput {
  classes: { carClassId: number; order: number[] }[];
  order: number[];
  byLapTime: boolean;
  grouped: boolean;
  bands: boolean;
  labels: boolean;
}

/** Lay the field out. Pure — `useStandingsLayout` feeds it from the stores. */
export function layoutField({
  classes,
  order,
  byLapTime,
  grouped,
  bands,
  labels,
}: LayoutInput): StandingsLayout {
  const cards: LayoutCard[] = [];
  const items: LayoutItem[] = [];
  let top = 0;

  const classOf = new Map<number, number>();
  for (const c of classes) for (const idx of c.order) classOf.set(idx, c.carClassId);

  const addCard = (
    key: string,
    classId: number | null,
    members: readonly number[],
    withBand: boolean,
  ) => {
    if (members.length === 0) return;
    if (cards.length > 0) top += CARD_GAP;
    const cardTop = top;
    const inner = cardTop + CARD_BORDER;
    let y = 0;
    if (withBand && classId != null) {
      items.push({ kind: "band", key: `band-${classId}`, top: inner + y, y, cardKey: key, classId });
      y += CLASS_BAND_H;
    }
    if (labels) {
      items.push({ kind: "labels", key: `labels-${key}`, top: inner + y, y, cardKey: key });
      y += LABEL_ROW_H;
    }
    members.forEach((carIdx, i) => {
      items.push({
        kind: "row",
        key: `row-${carIdx}`,
        top: inner + y,
        y,
        cardKey: key,
        carIdx,
        classId: classOf.get(carIdx) ?? classId ?? -1,
        zebra: i % 2 === 1,
        divider: i > 0 && i % DIVIDER_EVERY === 0,
        rank: byLapTime ? i + 1 : null,
      });
      y += ROW_H;
    });
    const height = y + 2 * CARD_BORDER;
    cards.push({ key, top: cardTop, height, classId });
    top = cardTop + height;
  };

  if (!grouped || classes.length === 0) {
    // One flat table in overall order. No header: a flat table has one group,
    // and a header over the whole field would be naming something the reader
    // can already see.
    addCard("field", null, order, false);
  } else {
    // Grouped by class. The bridge's per-class `order` is a race order, so a
    // lap-time session rebuilds each group by filtering the best-lap ranking
    // down to that class's members — one ranking behind both views.
    for (const c of classes) {
      const members = byLapTime
        ? order.filter((idx) => classOf.get(idx) === c.carClassId)
        : c.order;
      addCard(`class-${c.carClassId}`, c.carClassId, members, bands);
    }
  }
  return { cards, items, totalHeight: top };
}
