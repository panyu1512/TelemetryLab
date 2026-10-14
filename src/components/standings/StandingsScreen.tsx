import { useEffect, useMemo, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsMeta,
} from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import {
  useRanksByLapTime,
  useSessionKind,
} from "../../stores/useSessionStore";
import { SessionKind } from "../../lib/sessionKind";
import {
  CLASS_BAND_H,
  CLASS_EDGE_WIDTH,
  CLASS_GAP,
  SKIP_H,
  scopeColumnsToSession,
  tableMinWidth,
  type ColumnVisibility,
} from "./constants";
import { fitScale, scaleBox, unscaled } from "../../lib/tableScale";
import { CLASS_RAMP, classColorFor } from "../../lib/classColors";
import { StandingsRow } from "./StandingsRow";
import { useStandingsLayout, type LayoutBlock } from "./useStandingsLayout";
import { SESSION_HEADER_H, SessionStrip } from "../timing/SessionStrip";
import { ClassBand } from "./ClassBand";

/**
 * Clear space between the session header and the first class block, inside
 * the scaled box — the same gap that separates one class block from the next,
 * so over live footage the header and every class read as separate panels
 * with the game showing between them.
 */
const HEADER_GAP = CLASS_GAP;
/**
 * Window pixels held back from the fit. `zoom` lays the box out at fractional
 * sizes and the browser rounds each row on its own, so a fit computed to the
 * exact pixel can overshoot by one and clip the last row's bottom edge.
 */
const FIT_SLACK = 2;

/**
 * The v0.4 standings / timing screen.
 *
 * The screen is **rows and a readout, and nothing else**: no title bar, no
 * controls, nothing that can be aimed at. It is read at a glance while the user
 * is driving, so every pixel goes to the field — including the optional session
 * header above it, which is a readout the driver cannot interact with (see
 * `design.md` § Dense tabular overlays, rule 7). Everything *configurable* about
 * the screen, the header included, lives in the Overlay Manager.
 *
 * That also means no column-header band — the labels print inside each class
 * leader's row (`design.md` § Dense tabular overlays, rule 3). Class groups do
 * open with a band, which carries that class's own numbers and nothing
 * clickable; the gap that separates the groups (rule 2) is still doing its job
 * underneath it.
 *
 * **A set number of rows, drawn as large as the window allows** — the
 * Relative's model. Each class group is capped (`lib/standingsWindow`): the
 * player's class shows its leaders plus the cars around the player, other
 * classes their top runners, with a marker where the order skips. The row
 * counts are set in the Overlay Manager, so the window only decides how large
 * the rows are drawn, never which cars are on them. Fitting the whole grid
 * instead — still available as "Whole field" — drew a 40-car field at a third
 * of its size in an overlay-sized window: every car, and none of them
 * readable at speed.
 *
 * Either way there is no scroll bar: the surface is scaled to the tighter of
 * its width and its height (`lib/tableScale.fitScale`), never above full size,
 * so with the rows capped it is the Relative's width-driven scale for any
 * window tall enough to hold them, and shrinks rather than clipping when it is
 * not.
 *
 * Rendering budget: every shown row is mounted, but each row subscribes to
 * just its own entry, and reorders animate purely via CSS transforms. A tick
 * that moves three cars re-renders three rows, which keeps even a 60-car whole
 * field at 10 Hz well inside a 60 fps frame.
 *
 * **Outside a race the screen is a timesheet, not a running order** (see
 * `lib/sessionKind`). Practice and qualifying rank by best lap, so the rows are
 * ordered here rather than by the bridge, the position column prints that
 * ranking, and the columns that describe a race — gap, interval, positions
 * gained — are dropped rather than left to report distances nobody is racing.
 * No new chrome announces the switch: the session header already names the
 * session, and a timesheet whose fastest-lap cell is always its first row says
 * what it is without a label.
 */
export function StandingsScreen() {
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  const classes = useStandingsClasses();
  const meta = useStandingsMeta();
  const grouping = useStandingsUiStore((s) => s.grouping);
  const columns = useStandingsUiStore((s) => s.columns);
  const byLapTime = useRanksByLapTime();
  const showSessionStrip = useStandingsUiStore((s) => s.showSessionStrip);
  const qualifying = useSessionKind() === SessionKind.Qualify;
  const { items, blocks, runs, totalHeight } = useStandingsLayout();
  const fieldTop = showSessionStrip ? HEADER_GAP : 0;

  // In qualifying, a row that mounts after the screen's first paint is a car
  // *arriving* on the board — its driver has just set a first time — and plays
  // the arrival effect. Rows already on the board when the overlay opens just
  // appear.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
  }, []);
  const classRelative = grouping === "class";

  // The box the whole surface has to fit in, strip included.
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewW, setViewW] = useState(0);
  const [viewH, setViewH] = useState(0);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setViewW(e.contentRect.width);
      setViewH(e.contentRect.height);
    });
    ro.observe(el);
    setViewW(el.clientWidth);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Derived from the column map, whose identity changes when the columns do —
  // that is what re-renders the memoized labels and rows.
  //
  // Which columns this session and this user call for. Not a function of the
  // window any more: the window decides how large the table is drawn, never
  // what is in it.
  const isVisible = useMemo<ColumnVisibility>(() => {
    const chosen: ColumnVisibility = (id) => columns[id] !== false;
    return scopeColumnsToSession(chosen, byLapTime);
  }, [columns, byLapTime]);

  // The size the surface wants — every column at full width, every row at full
  // height, strip on top — and the one factor that fits it into the window it
  // has. Everything below is drawn inside that scale, so the layout tuned at
  // full size is the same layout at a quarter.
  const naturalWidth = tableMinWidth(meta.sectorCount, isVisible);
  const naturalHeight =
    (showSessionStrip ? SESSION_HEADER_H : 0) + fieldTop + totalHeight;
  const scale = fitScale(
    viewW,
    naturalWidth,
    viewH > FIT_SLACK ? viewH - FIT_SLACK : viewH,
    naturalHeight
  );
  /** Lengths inside the scaled box, for anything that reasons about width. */
  const innerWidth = unscaled(viewW, scale);

  const classById = useMemo(
    () => new Map(classes.map((c) => [c.carClassId, c])),
    [classes]
  );

  // Identity colour comes from this app's ramp, keyed by the class's position
  // in the field's own order, rather than from iRacing's `carClassColor` — see
  // `lib/classColors` for why the sim's palette had to go.
  const classColorById = useMemo(
    () => new Map(classes.map((c, i) => [c.carClassId, classColorFor(i)])),
    [classes]
  );
  // Class colour is information only when there is more than one class. In a
  // single-class session the bar keeps its width — nothing moves — and draws
  // in nothing; the band's bar falls back to the neutral hairline tone.
  const multiClass = classes.length > 1;

  // Who holds a fastest lap: one car per class, plus the single car whose class
  // best is also the field best. This drives the surface's only filled cell
  // (`design.md` § Dense tabular overlays, rule 5), so it is resolved once here
  // rather than being re-derived per row.
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

  // An empty qualifying board is not a missing feed: nobody has set a time
  // yet, and the board stays empty until someone does.
  const isEmpty = items.length === 0 && !qualifying;

  return (
    <div
      ref={rootRef}
      className="overlay-card timing-surface timing-blocks font-timing flex h-full flex-col overflow-hidden rounded-card"
    >
      {/*
        The strip scales with the field — it is part of the same surface, and a
        full-size readout over a half-size table reads as two overlays stacked.
        It is told the width it has to draw *in*, not the window's, so it keeps
        its fields at exactly the sizes this scaling exists to keep them at.
      */}
      {showSessionStrip && (
        <div style={scaleBox(scale)}>
          <SessionStrip width={innerWidth} />
        </div>
      )}
      {/* `overflow-hidden`, not `auto`: the fit above guarantees the field is
          inside the window, and a scroll bar on a screen nobody can aim at is
          a control that cannot be used. */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {isEmpty ? (
          <EmptyState iracingActive={iracingActive} />
        ) : (
          <div style={{ ...scaleBox(scale), minWidth: naturalWidth }}>
            <div
              className="relative"
              style={{ height: totalHeight, marginTop: fieldTop }}
            >
              {/* One panel of paper per class band and per class's rows,
                  with the gaps between panels left clear (see `LayoutBlock`).
                  Everything in a panel is drawn inside it, at offsets from
                  its top, so its edge and corners clip the class bar and the
                  rows as well as the paper. */}
              {blocks.map((b) => (
                <div
                  key={b.key}
                  className="timing-paper timing-block row-glide absolute inset-x-0 overflow-hidden will-change-transform"
                  style={{
                    height: b.height,
                    transform: `translateY(${b.top}px)`,
                  }}
                >
                  {/* The class bar, once per run of same-class rows, so the
                      colour has no joins to seam at (see `LayoutRun`). The
                      rows do not draw it. Never a fill: class colour is the
                      bar and nothing else. */}
                  {inBlock(runs, b).map((r) => {
                    const color = classColorById.get(r.classId);
                    if (!color) return null;
                    return (
                      <div
                        key={r.key}
                        aria-hidden
                        className="row-glide absolute inset-x-0 will-change-transform"
                        style={{
                          height: r.height,
                          transform: `translateY(${r.top - b.top}px)`,
                          borderLeftWidth: CLASS_EDGE_WIDTH,
                          borderLeftStyle: "solid",
                          borderLeftColor: multiClass ? color : "transparent",
                        }}
                      />
                    );
                  })}
                  {inBlock(items, b).map((it) => {
                    const top = it.top - b.top;
                    if (it.kind === "skip") {
                      return (
                        <SkipMarker
                          key={it.key}
                          top={top}
                          color="var(--color-faint)"
                        />
                      );
                    }
                    if (it.kind === "band") {
                      const standing = classById.get(it.classId);
                      if (!standing) return null;
                      return (
                        <div
                          key={it.key}
                          className="row-glide absolute inset-x-0 will-change-transform"
                          style={{
                            height: CLASS_BAND_H,
                            transform: `translateY(${top}px)`,
                          }}
                        >
                          <ClassBand
                            standing={standing}
                            color={
                              multiClass
                                ? classColorById.get(it.classId) ?? CLASS_RAMP[0]
                                : "var(--color-border-strong)"
                            }
                            fastestIsOverall={
                              standing.fastestLapCarIdx != null &&
                              fastestByCar.get(standing.fastestLapCarIdx) ===
                                "overall"
                            }
                            width={innerWidth}
                          />
                        </div>
                      );
                    }
                    return (
                      <StandingsRow
                        key={it.key}
                        carIdx={it.carIdx}
                        top={top}
                        sectorCount={meta.sectorCount}
                        classRelative={classRelative}
                        rank={it.rank}
                        isVisible={isVisible}
                        leader={it.leader}
                        labelled={it.labelled}
                        fastest={fastestByCar.get(it.carIdx) ?? null}
                        arriving={qualifying && mounted.current}
                        qualifying={qualifying}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** The layout entries that start inside block `b` (blocks never overlap). */
function inBlock<T extends { top: number }>(entries: readonly T[], b: LayoutBlock): T[] {
  return entries.filter((e) => e.top >= b.top && e.top < b.top + b.height);
}

/**
 * Where a capped group skips cars: a short dotted rule in the faint grey, set
 * against the position column so it reads as "places missing here" in the
 * rank block, not as a divider across the timing data.
 */
function SkipMarker({ top, color }: { top: number; color: string }) {
  return (
    <div
      aria-hidden
      className="row-glide absolute inset-x-0 flex items-center will-change-transform"
      style={{
        height: SKIP_H,
        transform: `translateY(${top}px)`,
        // Row padding plus the class edge, so the dots sit under the
        // position column rather than under the edge.
        paddingLeft: `calc(4px + ${CLASS_EDGE_WIDTH})`,
      }}
    >
      <div className="flex w-[2.1rem] justify-center gap-[3px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-[2px] rounded-full"
            style={{ background: color }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ iracingActive }: { iracingActive: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-10 place-items-center rounded-card border border-border bg-surface-2">
          <Flag className="size-5 text-faint" />
        </div>
        <h2 className="text-sm font-semibold text-text">No field yet</h2>
        <p className="text-sm leading-relaxed text-muted">
          {iracingActive
            ? "Waiting for the standings feed…"
            : "Start a session in iRacing (or run the mock bridge) to populate the timing screen."}
        </p>
      </div>
    </div>
  );
}
