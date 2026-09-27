import { useEffect, useMemo, useRef, useState } from "react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsMeta,
} from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { useClassColorOverrides } from "../../stores/useClassColorsStore";
import {
  useDriversByIdx,
  useRanksByLapTime,
  useSessionStore,
} from "../../stores/useSessionStore";
import {
  CARD_BORDER,
  CARD_GAP,
  ROW_H,
  scopeColumnsToSession,
  SURFACE_PAD,
  tableMinWidth,
  TOWER_MIN_SCALE,
  type ColumnVisibility,
} from "./constants";
import { scaleBox, tableScale, unscaled } from "../../lib/tableScale";
import { CLASS_RAMP, resolveClassColor } from "../../lib/classColors";
import { TOWER } from "../../lib/towerPalette";
import { StandingsRow } from "./StandingsRow";
import { itemHeight, useStandingsLayout, type LayoutItem } from "./useStandingsLayout";
import { ClassBand } from "./ClassBand";
import { ColumnLabels } from "./ColumnLabels";
import { TowerBar } from "./TowerBar";
import { TowerLegend } from "./TowerLegend";
import { FlagGlyph } from "./glyphs";

/** Extra pixels rendered above/below the viewport so fast scrolls stay filled. */
const OVERSCAN = 320;

/**
 * The timing tower — the Standings screen, in the look of the 2026-09-27
 * design canvas.
 *
 * Top to bottom: the race-control bar, then one card per class — a header
 * naming the class and carrying its own numbers, an optional label row, and
 * the rows — then, optionally, a legend. The screen is **readouts and rows,
 * and nothing that can be aimed at** (`design.md` § Dense tabular overlays,
 * rule 7): everything configurable, including what the gap column measures to
 * and each class's colour, lives in the Overlay Manager.
 *
 * It paints on its own fixed palette (`lib/towerPalette`) and its own faces,
 * Barlow and Barlow Condensed, rather than the runtime theme's — the tower was
 * designed and contrast-checked as one palette (`design.md` § The timing
 * tower).
 *
 * Rendering budget: only the rows on screen are mounted, each row subscribes
 * to just its own entry, and reorders animate purely via CSS transforms. That
 * keeps 100+ cars at 60 Hz telemetry comfortably inside a 60 fps frame.
 *
 * **Outside a race the screen is a timesheet, not a running order** (see
 * `lib/sessionKind`): practice and qualifying rank by best lap, the position
 * column prints that ranking, and gap, interval and positions gained are
 * dropped rather than left to report distances nobody is racing.
 */
export function StandingsScreen() {
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  const classes = useStandingsClasses();
  const meta = useStandingsMeta();
  const drivers = useDriversByIdx();
  const tyres = useSessionStore((s) => s.session?.tireCompounds);
  const grouping = useStandingsUiStore((s) => s.grouping);
  const followPlayer = useStandingsUiStore((s) => s.followPlayer);
  const columns = useStandingsUiStore((s) => s.columns);
  const showBar = useStandingsUiStore((s) => s.showSessionStrip);
  const showLegend = useStandingsUiStore((s) => s.showLegend);
  const gapReference = useStandingsUiStore((s) => s.gapReference);
  const overrides = useClassColorOverrides();
  const byLapTime = useRanksByLapTime();
  const { cards, items, totalHeight } = useStandingsLayout();
  const classRelative = grouping === "class";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const [viewW, setViewW] = useState(0);

  // Track scroll + viewport size for windowing (rAF-coalesced).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollTop(el.scrollTop));
    };
    const ro = new ResizeObserver(([e]) => {
      setViewH(e.contentRect.height);
      setViewW(e.contentRect.width);
    });
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    setViewH(el.clientHeight);
    setViewW(el.clientWidth);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Which columns this session and this user call for. Not a function of the
  // window: the width decides how large the tower is drawn, never what is in it.
  const isVisible = useMemo<ColumnVisibility>(() => {
    const chosen: ColumnVisibility = (id) => columns[id] !== false;
    return scopeColumnsToSession(chosen, byLapTime);
  }, [columns, byLapTime]);

  // The width the tower wants, and the factor that fits it into the width it
  // has. Everything below — bar, cards, rows, legend — is drawn inside that
  // scale, so the layout tuned at full size is the same layout at half.
  const naturalWidth = tableMinWidth(meta.sectorCount, isVisible);
  const scale = tableScale(viewW, naturalWidth, TOWER_MIN_SCALE);
  /** The width inside the paper, in the tower's own (canvas) px. */
  const innerWidth = Math.max(0, unscaled(viewW, scale) - 2 * SURFACE_PAD);

  const classById = useMemo(
    () => new Map(classes.map((c) => [c.carClassId, c])),
    [classes]
  );

  // Identity colour: the driver's own pick for a class, made in the Manager,
  // else this app's ramp keyed by the class's position in the field — never
  // iRacing's `carClassColor` (see `lib/classColors`).
  const classColorById = useMemo(
    () =>
      new Map(
        classes.map((c, i) => [c.carClassId, resolveClassColor(i, c.shortName, overrides)]),
      ),
    [classes, overrides]
  );

  // Who holds a fastest lap: one car per class, plus the single car whose class
  // best is also the field best. Resolved once here rather than per row.
  const fastestByCar = useMemo(() => {
    const map = new Map<number, "class" | "overall">();
    let bestTime = Infinity;
    let bestCar: number | null = null;
    for (const c of classes) {
      if (c.fastestLapCarIdx == null || c.fastestLap == null) continue;
      map.set(c.fastestLapCarIdx, "class");
      if (c.fastestLap < bestTime) {
        bestTime = c.fastestLap;
        bestCar = c.fastestLapCarIdx;
      }
    }
    if (bestCar != null) map.set(bestCar, "overall");
    return map;
  }, [classes]);

  /** The paper above the first card inside the scroll area. */
  const padTop = showBar ? CARD_GAP : SURFACE_PAD;

  // Window the items to what's near the viewport. The scroll container is
  // outside the scaled box, so its offsets are in window pixels while every
  // item's `top` is in the tower's own; dividing the viewport by the scale puts
  // both in the same units.
  const visibleByCard = useMemo(() => {
    const min = unscaled(scrollTop - OVERSCAN, scale) - padTop;
    const max = unscaled(scrollTop + viewH + OVERSCAN, scale) - padTop;
    const out = new Map<string, LayoutItem[]>();
    for (const it of items) {
      if (it.top + itemHeight(it) < min || it.top > max) continue;
      const list = out.get(it.cardKey) ?? [];
      list.push(it);
      out.set(it.cardKey, list);
    }
    return out;
  }, [items, scrollTop, viewH, scale, padTop]);

  // Follow the player: keep their row roughly centred when it moves, but only
  // when it has drifted far enough that a nudge is warranted.
  const playerTop = useMemo(() => {
    if (meta.playerCarIdx < 0) return null;
    const it = items.find((i) => i.kind === "row" && i.carIdx === meta.playerCarIdx);
    return it ? it.top : null;
  }, [items, meta.playerCarIdx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !followPlayer || playerTop == null) return;
    const desired = Math.max(0, (padTop + playerTop + ROW_H / 2) * scale - viewH / 2);
    if (Math.abs(el.scrollTop - desired) > viewH * 0.3) {
      el.scrollTo({ top: desired, behavior: "smooth" });
    }
  }, [playerTop, followPlayer, viewH, scale, padTop]);

  const isEmpty = items.length === 0;
  const legendAccent = classColorById.values().next().value ?? CLASS_RAMP[0];

  return (
    <div className="overlay-card tower-surface flex h-full flex-col overflow-hidden rounded-card">
      {showBar && (
        <div style={scaleBox(scale)}>
          <div style={{ padding: `${SURFACE_PAD}px ${SURFACE_PAD}px 0` }}>
            <TowerBar width={innerWidth} />
          </div>
        </div>
      )}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
        {isEmpty ? (
          <EmptyState iracingActive={iracingActive} />
        ) : (
          <div style={{ ...scaleBox(scale), minWidth: naturalWidth }}>
            <div
              style={{
                padding: `${padTop}px ${SURFACE_PAD}px ${SURFACE_PAD}px`,
              }}
            >
              <div className="relative" style={{ height: totalHeight }}>
                {cards.map((card) => {
                  const standing = card.classId != null ? classById.get(card.classId) : undefined;
                  const accent =
                    (card.classId != null && classColorById.get(card.classId)) || CLASS_RAMP[0];
                  return (
                    <div
                      key={card.key}
                      className="row-glide absolute inset-x-0 overflow-hidden rounded-[8px] will-change-transform"
                      style={{
                        transform: `translateY(${card.top}px)`,
                        height: card.height,
                        background: TOWER.surface,
                        border: `${CARD_BORDER}px solid ${TOWER.border}`,
                        boxSizing: "border-box",
                      }}
                    >
                      {(visibleByCard.get(card.key) ?? []).map((it) => {
                        if (it.kind === "band") {
                          if (!standing) return null;
                          const holder =
                            standing.fastestLapCarIdx != null
                              ? drivers.get(standing.fastestLapCarIdx)?.userName ?? null
                              : null;
                          return (
                            <div
                              key={it.key}
                              className="absolute inset-x-0"
                              style={{ transform: `translateY(${it.y}px)` }}
                            >
                              <ClassBand
                                standing={standing}
                                color={accent}
                                bestBy={holder}
                                width={innerWidth}
                              />
                            </div>
                          );
                        }
                        if (it.kind === "labels") {
                          return (
                            <div
                              key={it.key}
                              className="absolute inset-x-0"
                              style={{ transform: `translateY(${it.y}px)` }}
                            >
                              <ColumnLabels
                                sectorCount={meta.sectorCount}
                                isVisible={isVisible}
                                gapReference={gapReference}
                              />
                            </div>
                          );
                        }
                        return (
                          <StandingsRow
                            key={it.key}
                            carIdx={it.carIdx}
                            y={it.y}
                            sectorCount={meta.sectorCount}
                            classColor={classColorById.get(it.classId) ?? CLASS_RAMP[0]}
                            zebra={it.zebra}
                            divider={it.divider}
                            classRelative={classRelative}
                            rank={it.rank}
                            isVisible={isVisible}
                            fastest={fastestByCar.get(it.carIdx) ?? null}
                            gapReference={gapReference}
                            tyres={tyres}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      {showLegend && !isEmpty && (
        <div style={scaleBox(scale)}>
          <div style={{ padding: `0 ${SURFACE_PAD}px ${SURFACE_PAD}px` }}>
            <TowerLegend accent={legendAccent} />
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ iracingActive }: { iracingActive: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div
          className="grid size-12 place-items-center rounded-[8px]"
          style={{ background: TOWER.surface, border: `1px solid ${TOWER.border}`, color: TOWER.text3 }}
        >
          <FlagGlyph size={22} />
        </div>
        <h2 className="text-base font-semibold" style={{ color: TOWER.text }}>
          No field yet
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: TOWER.text2 }}>
          {iracingActive
            ? "Waiting for the standings feed…"
            : "Start a session in iRacing (or run the mock bridge) to populate the timing screen."}
        </p>
      </div>
    </div>
  );
}
