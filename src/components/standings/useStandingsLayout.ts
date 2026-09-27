import { useMemo } from "react";
import {
  useStandingsBestLapOrder,
  useStandingsClasses,
  useStandingsOrder,
} from "../../stores/useStandingsStore";
import { useRanksByLapTime } from "../../stores/useSessionStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { layoutField, type StandingsLayout } from "./layout";

export {
  itemHeight,
  type LayoutCard,
  type LayoutItem,
  type LayoutRow,
  type StandingsLayout,
} from "./layout";

/**
 * The tower's layout for the current field, grouping and toggles — see
 * `layout.ts` for how it is laid out. Recomputes only when the order, the
 * grouping or a layout toggle changes, never on a timing tick.
 */
export function useStandingsLayout(): StandingsLayout {
  const classes = useStandingsClasses();
  const raceOrder = useStandingsOrder();
  const bestLapOrder = useStandingsBestLapOrder();
  const byLapTime = useRanksByLapTime();
  const grouping = useStandingsUiStore((s) => s.grouping);
  const showClassBands = useStandingsUiStore((s) => s.showClassBands);
  const showColumnLabels = useStandingsUiStore((s) => s.showColumnLabels);

  // In a lap-time session the whole table reads off the best-lap ranking; in a
  // race it reads off the bridge's race order. Both arrays hold their identity
  // between ticks, so this memo still only reruns when the field moves.
  const order = byLapTime ? bestLapOrder : raceOrder;

  return useMemo(
    () =>
      layoutField({
        classes,
        order,
        byLapTime,
        grouped: grouping === "class",
        bands: showClassBands,
        labels: showColumnLabels,
      }),
    [classes, order, byLapTime, grouping, showClassBands, showColumnLabels],
  );
}
