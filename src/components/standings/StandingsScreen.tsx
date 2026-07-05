import { useEffect, useMemo, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import {
  useStandingsClasses,
  useStandingsMeta,
} from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import {
  CLASS_HEADER_H,
  COL_HEADER_H,
  ROW_H,
  tableMinWidth,
  type ColumnVisibility,
} from "./constants";
import { ColumnHeader } from "./ColumnHeader";
import { ClassHeader } from "./ClassHeader";
import { StandingsHeader } from "./StandingsHeader";
import { StandingsRow } from "./StandingsRow";
import { useStandingsLayout } from "./useStandingsLayout";

/** Extra pixels rendered above/below the viewport so fast scrolls stay filled. */
const OVERSCAN = 320;

/**
 * The v0.4 standings / timing screen.
 *
 * Composition:
 *   StandingsHeader  — session + view controls (low-frequency store reads)
 *   ColumnHeader     — sticky column labels
 *   virtualized body — class headers + rows, absolutely positioned by offset
 *
 * Rendering budget: the body only mounts the items on screen (windowed by
 * scroll offset), each row subscribes to just its own entry, and reorders
 * animate purely via CSS transforms. That keeps 100+ cars at 60 Hz telemetry
 * comfortably inside a 60 fps frame.
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

  // Derive the visibility predicate from the column map so its identity changes
  // when columns change — that re-renders the (memoized) header and rows.
  const isVisible = useMemo<ColumnVisibility>(
    () => (id) => columns[id] !== false,
    [columns]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);

  // Track scroll + viewport size for windowing (rAF-coalesced).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setScrollTop(el.scrollTop));
    };
    const ro = new ResizeObserver(([e]) => setViewH(e.contentRect.height));
    el.addEventListener("scroll", onScroll, { passive: true });
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  const classById = useMemo(
    () => new Map(classes.map((c) => [c.carClassId, c])),
    [classes]
  );

  // Window the item list to what's near the viewport.
  const visible = useMemo(() => {
    const min = scrollTop - OVERSCAN;
    const max = scrollTop + viewH + OVERSCAN;
    return items.filter((it) => {
      const h = it.type === "class-header" ? CLASS_HEADER_H : ROW_H;
      return it.top + h >= min && it.top <= max;
    });
  }, [items, scrollTop, viewH]);

  // Follow the player: keep their row roughly centered when it moves, but only
  // when it has drifted far enough that a nudge is warranted (avoids fighting).
  const playerTop = useMemo(() => {
    if (meta.playerCarIdx < 0) return null;
    const it = items.find(
      (i) => i.type === "row" && i.carIdx === meta.playerCarIdx
    );
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
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-transparent bg-surface">
      <StandingsHeader />
      <div ref={scrollRef} className="relative flex-1 overflow-auto">
        {isEmpty ? (
          <EmptyState iracingActive={iracingActive} />
        ) : (
          <div style={{ minWidth: tableMinWidth(meta.sectorCount, isVisible) }}>
            <ColumnHeader sectorCount={meta.sectorCount} isVisible={isVisible} />
            <div
              className="relative"
              style={{ height: totalHeight + 8, marginTop: 2 }}
            >
              {visible.map((it) => {
                if (it.type === "class-header") {
                  const group = classById.get(it.classId);
                  return group ? (
                    <ClassHeader key={it.key} group={group} top={it.top} />
                  ) : null;
                }
                // Zebra by index within the (already ordered) visible set is
                // unstable during reorders; derive it from the offset instead.
                const zebra = Math.round((it.top - COL_HEADER_H) / ROW_H) % 2 === 1;
                return (
                  <StandingsRow
                    key={it.key}
                    carIdx={it.carIdx}
                    top={it.top}
                    sectorCount={meta.sectorCount}
                    classColor={classById.get(it.classId)?.color ?? "#666"}
                    zebra={zebra}
                    classRelative={classRelative}
                    isVisible={isVisible}
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
        <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface-2">
          <Flag className="size-6 text-muted" />
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
