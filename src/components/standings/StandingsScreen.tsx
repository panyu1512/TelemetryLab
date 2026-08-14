import { useEffect, useMemo, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsMeta,
} from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { useRanksByLapTime } from "../../stores/useSessionStore";
import {
  CLASS_BAND_H,
  firstColumnStop,
  ROW_H,
  scopeColumnsToSession,
  tableMinWidth,
  type ColumnVisibility,
} from "./constants";
import { scaleBox, tableScale, unscaled } from "../../lib/tableScale";
import { CLASS_RAMP, classColorFor } from "../../lib/classColors";
import { StandingsRow } from "./StandingsRow";
import { useStandingsLayout } from "./useStandingsLayout";
import { SessionStrip } from "../timing/SessionStrip";
import { ClassBand } from "./ClassBand";

/** Extra pixels rendered above/below the viewport so fast scrolls stay filled. */
const OVERSCAN = 320;

/**
 * The v0.4 standings / timing screen.
 *
 * The screen is **rows and a readout, and nothing else**: no title bar, no
 * controls, nothing that can be aimed at. It is read at a glance while the user
 * is driving, so every pixel goes to the field — including the optional session
 * strip above it, which is a readout the driver cannot interact with (see
 * `design.md` § Dense tabular overlays, rule 7). Everything *configurable* about
 * the screen, the strip included, lives in the Overlay Manager.
 *
 * That also means no column-header band — the labels print inside each class
 * leader's row (`design.md` § Dense tabular overlays, rule 3). Class groups do
 * open with a band, which carries that class's own numbers and nothing
 * clickable; the gap and tone shift that separate the groups (rule 2) are still
 * doing their job underneath it.
 *
 * Rendering budget: the body only mounts the rows on screen (windowed by scroll
 * offset), each row subscribes to just its own entry, and reorders animate
 * purely via CSS transforms. That keeps 100+ cars at 60 Hz telemetry comfortably
 * inside a 60 fps frame.
 *
 * **Outside a race the screen is a timesheet, not a running order** (see
 * `lib/sessionKind`). Practice and qualifying rank by best lap, so the rows are
 * ordered here rather than by the bridge, the position column prints that
 * ranking, and the columns that describe a race — gap, interval, positions
 * gained — are dropped rather than left to report distances nobody is racing.
 * No new chrome announces the switch: the session strip already names the
 * session, and a timesheet whose fastest-lap cell is always its first row says
 * what it is without a label.
 */
export function StandingsScreen() {
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  const classes = useStandingsClasses();
  const meta = useStandingsMeta();
  const grouping = useStandingsUiStore((s) => s.grouping);
  const followPlayer = useStandingsUiStore((s) => s.followPlayer);
  const columns = useStandingsUiStore((s) => s.columns);
  const byLapTime = useRanksByLapTime();
  const showSessionStrip = useStandingsUiStore((s) => s.showSessionStrip);
  const showColumnLabels = useStandingsUiStore((s) => s.showColumnLabels);
  const { items, totalHeight } = useStandingsLayout();
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

  // Derived from the column map, whose identity changes when the columns do —
  // that is what re-renders the memoized labels and rows.
  //
  // Which columns this session and this user call for. Not a function of the
  // window any more: the width decides how large the table is drawn, never what
  // is in it.
  const isVisible = useMemo<ColumnVisibility>(() => {
    const chosen: ColumnVisibility = (id) => columns[id] !== false;
    return scopeColumnsToSession(chosen, byLapTime);
  }, [columns, byLapTime]);

  // The width the table wants, and the factor that fits it into the width it
  // has. Everything below — rows, type, gaps, the strip — is drawn inside that
  // scale, so the layout tuned at full size is the same layout at half.
  const naturalWidth = tableMinWidth(meta.sectorCount, isVisible);
  const scale = tableScale(viewW, naturalWidth);
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

  // Window the row list to what's near the viewport.
  //
  // The scroll container is outside the scaled box, so its `scrollTop` and
  // height are in window pixels while every item's `top` is in the table's own.
  // Dividing the viewport by the scale puts both in the same units — without
  // it, a scaled-down table stops mounting rows before the bottom of the
  // window, because it is looking for them at the wrong offsets.
  const visible = useMemo(() => {
    const min = unscaled(scrollTop - OVERSCAN, scale);
    const max = unscaled(scrollTop + viewH + OVERSCAN, scale);
    return items.filter((it) => {
      const h = it.kind === "band" ? CLASS_BAND_H : ROW_H;
      return it.top + h >= min && it.top <= max;
    });
  }, [items, scrollTop, viewH, scale]);

  // Follow the player: keep their row roughly centered when it moves, but only
  // when it has drifted far enough that a nudge is warranted (avoids fighting).
  const playerTop = useMemo(() => {
    if (meta.playerCarIdx < 0) return null;
    const it = items.find(
      (i) => i.kind === "row" && i.carIdx === meta.playerCarIdx
    );
    return it ? it.top : null;
  }, [items, meta.playerCarIdx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !followPlayer || playerTop == null) return;
    // `scrollTop` is in window pixels; the player's row offset is in the
    // table's, so it is scaled on the way out.
    const desired = Math.max(0, (playerTop + ROW_H / 2) * scale - viewH / 2);
    if (Math.abs(el.scrollTop - desired) > viewH * 0.3) {
      el.scrollTo({ top: desired, behavior: "smooth" });
    }
  }, [playerTop, followPlayer, viewH, scale]);

  const isEmpty = items.length === 0;

  return (
    <div className="overlay-card timing-surface flex h-full flex-col overflow-hidden rounded-card border border-border/60">
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
      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        {isEmpty ? (
          <EmptyState iracingActive={iracingActive} />
        ) : (
          <div style={{ ...scaleBox(scale), minWidth: naturalWidth }}>
            <div
              className="relative"
              style={{ height: totalHeight + 8, marginTop: 6 }}
            >
              {visible.map((it) => {
                if (it.kind === "band") {
                  const standing = classById.get(it.classId);
                  if (!standing) return null;
                  return (
                    <div
                      key={it.key}
                      className="row-glide absolute inset-x-0 will-change-transform"
                      style={{
                        height: CLASS_BAND_H,
                        transform: `translateY(${it.top}px)`,
                      }}
                    >
                      <ClassBand
                        standing={standing}
                        color={classColorById.get(it.classId) ?? CLASS_RAMP[0]}
                        fillStop={firstColumnStop(meta.sectorCount, isVisible)}
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
                    top={it.top}
                    sectorCount={meta.sectorCount}
                    classColor={classColorById.get(it.classId) ?? CLASS_RAMP[0]}
                    zebra={it.zebra}
                    classRelative={classRelative}
                    rank={it.rank}
                    isVisible={isVisible}
                    labelled={showColumnLabels && it.leader}
                    tone={it.tone}
                    fastest={fastestByCar.get(it.carIdx) ?? null}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ iracingActive }: { iracingActive: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-card border border-border bg-surface-2">
          <Flag className="size-6 text-faint" />
        </div>
        <h2 className="text-base font-semibold text-text">No field yet</h2>
        <p className="text-sm leading-relaxed text-muted">
          {iracingActive
            ? "Waiting for the standings feed…"
            : "Start a session in iRacing (or run the mock bridge) to populate the timing screen."}
        </p>
      </div>
    </div>
  );
}
