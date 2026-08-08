import { useEffect, useMemo, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsMeta,
} from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import {
  ROW_H,
  fitColumns,
  tableMinWidth,
  type ColumnVisibility,
} from "./constants";
import { StandingsRow } from "./StandingsRow";
import { useStandingsLayout } from "./useStandingsLayout";

/** Extra pixels rendered above/below the viewport so fast scrolls stay filled. */
const OVERSCAN = 320;

/**
 * The v0.4 standings / timing screen.
 *
 * The screen is **rows and nothing else**: no title bar, no session strip, no
 * controls. It is read at a glance while the user is driving, so every pixel
 * goes to the field. Everything configurable about it lives in the Overlay
 * Manager, which is the surface built for configuring.
 *
 * That also means no column-header band — the labels print inside each class
 * leader's row (`design.md` § Dense tabular overlays, rule 3) — and no class
 * band: classes are separated by a gap plus a tone shift (rule 2).
 *
 * Rendering budget: the body only mounts the rows on screen (windowed by scroll
 * offset), each row subscribes to just its own entry, and reorders animate
 * purely via CSS transforms. That keeps 100+ cars at 60 Hz telemetry comfortably
 * inside a 60 fps frame.
 */
export function StandingsScreen() {
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  const classes = useStandingsClasses();
  const meta = useStandingsMeta();
  const grouping = useStandingsUiStore((s) => s.grouping);
  const followPlayer = useStandingsUiStore((s) => s.followPlayer);
  const columns = useStandingsUiStore((s) => s.columns);
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

  // Derive the visibility predicate from the column map (identity changes when
  // columns change — that re-renders the memoized header and rows), then narrow
  // it to what actually fits the window so the table adapts instead of always
  // growing a horizontal scrollbar.
  const isVisible = useMemo<ColumnVisibility>(() => {
    const chosen: ColumnVisibility = (id) => columns[id] !== false;
    return fitColumns(viewW, meta.sectorCount, chosen);
  }, [columns, viewW, meta.sectorCount]);

  const classById = useMemo(
    () => new Map(classes.map((c) => [c.carClassId, c])),
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
  const visible = useMemo(() => {
    const min = scrollTop - OVERSCAN;
    const max = scrollTop + viewH + OVERSCAN;
    return items.filter((it) => it.top + ROW_H >= min && it.top <= max);
  }, [items, scrollTop, viewH]);

  // Follow the player: keep their row roughly centered when it moves, but only
  // when it has drifted far enough that a nudge is warranted (avoids fighting).
  const playerTop = useMemo(() => {
    if (meta.playerCarIdx < 0) return null;
    const it = items.find((i) => i.carIdx === meta.playerCarIdx);
    return it ? it.top : null;
  }, [items, meta.playerCarIdx]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !followPlayer || playerTop == null) return;
    const desired = Math.max(0, playerTop - viewH / 2 + ROW_H / 2);
    if (Math.abs(el.scrollTop - desired) > viewH * 0.3) {
      el.scrollTo({ top: desired, behavior: "smooth" });
    }
  }, [playerTop, followPlayer, viewH]);

  const isEmpty = items.length === 0;

  return (
    <div className="overlay-card flex h-full flex-col overflow-hidden rounded-card border border-border/60 bg-surface">
      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        {isEmpty ? (
          <EmptyState iracingActive={iracingActive} />
        ) : (
          <div style={{ minWidth: tableMinWidth(meta.sectorCount, isVisible) }}>
            <div
              className="relative"
              style={{ height: totalHeight + 8, marginTop: 6 }}
            >
              {visible.map((it) => {
                return (
                  <StandingsRow
                    key={it.key}
                    carIdx={it.carIdx}
                    top={it.top}
                    sectorCount={meta.sectorCount}
                    classColor={classById.get(it.classId)?.color ?? "#666"}
                    zebra={it.zebra}
                    classRelative={classRelative}
                    isVisible={isVisible}
                    labelled={it.leader}
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
