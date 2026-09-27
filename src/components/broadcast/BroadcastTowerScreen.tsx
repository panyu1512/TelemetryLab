import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  useStandingsClasses,
  useStandingsRow,
} from "../../stores/useStandingsStore";
import { useDriver } from "../../stores/useSessionStore";
import { useClassColorOverrides } from "../../stores/useClassColorsStore";
import { gap as fmtGap } from "../../lib/format";
import { CLASS_RAMP, resolveClassColor } from "../../lib/classColors";
import { rowState } from "../../lib/rowState";
import { scaleBox, tableScale } from "../../lib/tableScale";
import { TOWER, towerInk } from "../../lib/towerPalette";
import { DIVIDER_EVERY } from "../standings/constants";
import { OutGlyph } from "../standings/glyphs";

/**
 * The broadcast tower — the timing tower cut down to what a stream needs:
 * position, name, class colour and gap, in a 300 px column for the left edge
 * of a 1920×1080 overlay.
 *
 * It paints only itself. Around the column the window stays transparent, so an
 * OBS browser source pointed at `?overlay=tower` composites it over the game
 * with nothing else; the column carries its own card so it reads over any
 * footage.
 *
 * Everything else a timing screen shows is deliberately absent. A viewer
 * follows who is where and how far apart — sector splits and tyre ages are the
 * driver's, not the audience's. The two states that change what a gap *means*
 * still show, in the gap cell where the number would be: PIT, and DSQ in the
 * position block. A car that is out keeps its last gap, greyed, behind the OUT
 * glyph.
 */

/** The column's width at full size, in px. */
export const TOWER_WIDTH = 300;
const HEAD_H = 28;
const ROW_H = 36;
const PAD = 8;

export function BroadcastTowerScreen() {
  const classes = useStandingsClasses();
  const overrides = useClassColorOverrides();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Never larger than designed: a wide browser source is a column with the
  // game beside it, which is the whole point.
  const scale = tableScale(width, TOWER_WIDTH + 2 * PAD, 0.4);

  const colors = useMemo(
    () => classes.map((c, i) => resolveClassColor(i, c.shortName, overrides)),
    [classes, overrides],
  );

  return (
    <div ref={ref} className="tower-type h-full w-full overflow-auto">
      {classes.length > 0 && (
        <div style={{ ...scaleBox(scale), width: TOWER_WIDTH + 2 * PAD, padding: PAD }}>
          <div
            className="overflow-hidden rounded-[8px]"
            style={{ background: TOWER.surface, border: `1px solid ${TOWER.border}` }}
          >
            {classes.map((c, ci) => (
              <section key={c.carClassId} aria-label={`${c.shortName} class`}>
                <div
                  className="flex items-center justify-between"
                  style={{
                    height: HEAD_H,
                    padding: "0 10px",
                    background: TOWER.labelRow,
                    borderTop: ci > 0 ? `1px solid ${TOWER.border}` : undefined,
                  }}
                >
                  <span
                    className="tower-cond rounded-[3px] px-2 py-px text-[15px] font-bold tracking-[0.06em]"
                    style={{
                      background: colors[ci] ?? CLASS_RAMP[0],
                      color: towerInk(colors[ci] ?? CLASS_RAMP[0]),
                    }}
                  >
                    {c.shortName || "—"}
                  </span>
                  <span
                    className="text-[11px] font-semibold tracking-[0.1em]"
                    style={{ color: TOWER.text3 }}
                  >
                    GAP
                  </span>
                </div>
                {c.order.map((carIdx, i) => (
                  <TowerRow
                    key={carIdx}
                    carIdx={carIdx}
                    index={i}
                    color={colors[ci] ?? CLASS_RAMP[0]}
                  />
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const TowerRow = memo(function TowerRow({
  carIdx,
  index,
  color,
}: {
  carIdx: number;
  index: number;
  color: string;
}) {
  const row = useStandingsRow(carIdx);
  const driver = useDriver(carIdx);
  const state = rowState(row);
  const isMe = row?.isPlayer === true;
  const leads = row?.isClassLeader === true;
  const gapText = state.dsq
    ? "—"
    : leads
      ? "Leader"
      : fmtGap(row?.gapToClassLeader, row?.classGapIsLaps ?? false);

  return (
    <div
      className="grid items-center"
      style={{
        height: ROW_H,
        boxSizing: "border-box",
        gridTemplateColumns: "34px minmax(0, 1fr) 68px",
        columnGap: 10,
        padding: "0 10px",
        background: isMe ? TOWER.meBg : index % 2 ? TOWER.rowB : TOWER.rowA,
        borderTop: `1px solid ${index > 0 && index % DIVIDER_EVERY === 0 ? TOWER.divider : "transparent"}`,
        boxShadow: isMe ? `inset 0 0 0 1px ${TOWER.meRing}` : undefined,
      }}
    >
      <span
        className="tower-cond flex h-[26px] items-center justify-center rounded-[4px] font-bold leading-none"
        style={
          state.dsq
            ? { background: TOWER.dsq, color: TOWER.onDsq, fontSize: 14, letterSpacing: "0.04em" }
            : { background: color, color: towerInk(color), fontSize: 19 }
        }
      >
        {state.dsq ? "DSQ" : (row?.classPosition ?? row?.position ?? "—")}
      </span>
      <span
        className="tower-cond truncate text-[20px] font-bold uppercase tracking-[0.02em]"
        style={{
          color: state.dimAll ? TOWER.dim : TOWER.text,
          textDecoration: state.dsq ? "line-through" : undefined,
        }}
      >
        {driver?.userName ?? `Car ${carIdx}`}
      </span>
      <span className="flex items-center justify-end gap-[5px]">
        {state.out && (
          <span style={{ color: TOWER.dim }} title="Out — disconnected or towing">
            <OutGlyph />
          </span>
        )}
        {state.pit ? (
          <span
            className="tower-cond flex h-5 items-center rounded-[3px] px-[7px] text-[14px] font-bold leading-none tracking-[0.1em]"
            style={{ background: TOWER.pit, color: TOWER.onPit }}
            title="In the pit lane"
          >
            PIT
          </span>
        ) : (
          <span
            className="text-[16px]"
            style={{
              color: state.dimAll ? TOWER.dim : leads ? TOWER.text : TOWER.text2,
            }}
          >
            {gapText}
          </span>
        )}
      </span>
    </div>
  );
});
