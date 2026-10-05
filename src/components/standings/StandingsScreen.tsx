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
  scopeColumnsToSession,
  tableMinWidth,
  type ColumnVisibility,
} from "./constants";
import { fitScale, scaleBox, unscaled } from "../../lib/tableScale";
import { CLASS_RAMP, classColorFor } from "../../lib/classColors";
import { StandingsRow } from "./StandingsRow";
import { useStandingsLayout } from "./useStandingsLayout";
import { SessionStrip, STRIP_H } from "../timing/SessionStrip";
import { ClassBand } from "./ClassBand";

/** Paper above the first band/row, inside the scaled box. */
const FIELD_TOP = 6;
/** Paper below the last row, inside the scaled box. */
const FIELD_BOTTOM = 8;
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
 * strip above it, which is a readout the driver cannot interact with (see
 * `design.md` § Dense tabular overlays, rule 7). Everything *configurable* about
 * the screen, the strip included, lives in the Overlay Manager.
 *
 * That also means no column-header band — the labels print inside each class
 * leader's row (`design.md` § Dense tabular overlays, rule 3). Class groups do
 * open with a band, which carries that class's own numbers and nothing
 * clickable; the gap that separates the groups (rule 2) is still doing its job
 * underneath it.
 *
 * **The whole field, always, and no scroll bar.** The surface is scaled to the
 * tighter of its width and its height (`lib/tableScale.fitScale`), so every
 * car in the session is on screen at once and rows and type shrink together as
 * the field grows or the window shortens. It used to fit the width and scroll
 * for the rest, with a "follow my row" option to keep the player in view — on
 * a screen with no controls, that meant the back of a big field was simply
 * never seen.
 *
 * Rendering budget: every row is mounted (there is nothing off screen to
 * window away any more), but each row subscribes to just its own entry, and
 * reorders animate purely via CSS transforms. A tick that moves three cars
 * re-renders three rows, which keeps a 60-car field at 10 Hz well inside a
 * 60 fps frame.
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
  const columns = useStandingsUiStore((s) => s.columns);
  const byLapTime = useRanksByLapTime();
  const showSessionStrip = useStandingsUiStore((s) => s.showSessionStrip);
  const showColumnLabels = useStandingsUiStore((s) => s.showColumnLabels);
  const { items, totalHeight } = useStandingsLayout();
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
    (showSessionStrip ? STRIP_H : 0) + FIELD_TOP + totalHeight + FIELD_BOTTOM;
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

  const isEmpty = items.length === 0;

  return (
    <div
      ref={rootRef}
      className="overlay-card timing-surface flex h-full flex-col overflow-hidden rounded-card border border-border/60"
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
              style={{
                height: totalHeight + FIELD_BOTTOM,
                marginTop: FIELD_TOP,
              }}
            >
              {items.map((it) => {
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
                    classRelative={classRelative}
                    rank={it.rank}
                    isVisible={isVisible}
                    labelled={showColumnLabels && it.leader}
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
