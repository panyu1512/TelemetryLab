import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";

import {
  applyDrag,
  fitMonitor,
  minSizeFor,
  toCanvas,
  type DragHandle,
  type Rect,
} from "../../../lib/monitorLayout";
import type { LiveMonitor, MonitorRect } from "../../../lib/windowPlacement";
import { useWindowStore } from "../../../stores/useWindowStore";
import { BACKDROPS, CANVAS_BG, CHECKER, type Backdrop } from "../PreviewCanvas";
import type { LayoutItem, LayoutState } from "./useLayoutState";
import { WindowContent } from "./WindowContent";

const HANDLES: DragHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

const HANDLE_POS: Record<Exclude<DragHandle, "move">, string> = {
  nw: "-left-1 -top-1 cursor-nwse-resize",
  n: "left-1/2 -top-1 -translate-x-1/2 cursor-ns-resize",
  ne: "-right-1 -top-1 cursor-nesw-resize",
  e: "-right-1 top-1/2 -translate-y-1/2 cursor-ew-resize",
  se: "-right-1 -bottom-1 cursor-nwse-resize",
  s: "left-1/2 -bottom-1 -translate-x-1/2 cursor-ns-resize",
  sw: "-left-1 -bottom-1 cursor-nesw-resize",
  w: "-left-1 top-1/2 -translate-y-1/2 cursor-ew-resize",
};

/** Snap step, in logical px (times the monitor's DPI scale). */
const GRID_LOGICAL = 16;

interface Drag {
  label: string;
  handle: DragHandle;
  startX: number;
  startY: number;
  start: Rect;
  last: Rect;
  frame: number | null;
}

/**
 * The monitor, drawn to fit, with every window on it where it really sits.
 * Drag a box to move its window, an edge or corner to resize it; the real
 * window follows every frame and the result is saved on release.
 */
export function MonitorCanvas({
  layout,
  monitor,
  monitorIndex,
  selected,
  onSelect,
  snapOn,
  backdrop,
  showClosed,
}: {
  layout: LayoutState;
  monitor: LiveMonitor;
  monitorIndex: number;
  selected: string | null;
  onSelect: (label: string | null) => void;
  snapOn: boolean;
  backdrop: Backdrop;
  showClosed: boolean;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 800, height: 450 });
  const drag = useRef<Drag | null>(null);
  const locks = useWindowStore((s) => s.locks);
  const isLocked = useWindowStore((s) => s.isLocked);

  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      setBox({ width: el.clientWidth, height: el.clientHeight })
    );
    ro.observe(el);
    setBox({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const screen: MonitorRect = layout.screens[monitorIndex] ?? layout.screens[0];
  const fit = fitMonitor(screen, box, 12);
  const dpi = monitor.scaleFactor || 1;

  const items = layout.items.filter(
    (i) => i.monitorIndex === monitorIndex && (showClosed || i.open)
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, item: LayoutItem, handle: DragHandle) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      onSelect(item.label);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      layout.beginDrag(item.label);
      drag.current = {
        label: item.label,
        handle,
        startX: e.clientX,
        startY: e.clientY,
        start: item.bounds,
        last: item.bounds,
        frame: null,
      };
    },
    [layout, onSelect]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent, item: LayoutItem) => {
      const d = drag.current;
      if (!d || d.label !== item.label) return;
      const dx = (e.clientX - d.startX) / fit.k;
      const dy = (e.clientY - d.startY) / fit.k;
      const next = applyDrag(d.start, d.handle, dx, dy, {
        min: minSizeFor(item.kind, dpi),
        within: screen,
        grid: snapOn && !e.altKey ? Math.round(GRID_LOGICAL * dpi) : undefined,
      });
      d.last = next;
      // One window move per animation frame, however fast the pointer.
      if (d.frame == null) {
        d.frame = requestAnimationFrame(() => {
          if (!drag.current) return;
          drag.current.frame = null;
          layout.setBounds(item.label, drag.current.last, false);
        });
      }
    },
    [fit.k, dpi, screen, snapOn, layout]
  );

  const onPointerUp = useCallback(
    (item: LayoutItem) => {
      const d = drag.current;
      if (!d || d.label !== item.label) return;
      if (d.frame != null) cancelAnimationFrame(d.frame);
      drag.current = null;
      const moved =
        d.last.x !== d.start.x ||
        d.last.y !== d.start.y ||
        d.last.width !== d.start.width ||
        d.last.height !== d.start.height;
      if (moved) layout.setBounds(item.label, d.last, true);
      layout.endDrag(item.label);
    },
    [layout]
  );

  const bg = BACKDROPS[backdrop].css;

  return (
    <div
      ref={boxRef}
      className="relative min-h-0 flex-1 overflow-hidden"
      onPointerDown={() => onSelect(null)}
      style={{ background: CANVAS_BG }}
    >
      {/* The monitor: a bezel around the backdrop, at the screen's aspect. */}
      <div
        className="absolute rounded-[6px] border border-border-strong shadow-float"
        style={{
          left: fit.offsetX - 6,
          top: fit.offsetY - 6,
          width: fit.width + 12,
          height: fit.height + 12,
          background: "#050506",
        }}
      />
      <div
        data-testid="monitor-screen"
        className="absolute overflow-hidden"
        style={{
          left: fit.offsetX,
          top: fit.offsetY,
          width: fit.width,
          height: fit.height,
          background: bg || CHECKER,
          backgroundSize: bg ? undefined : "14px 14px",
          backgroundColor: bg ? undefined : CANVAS_BG,
        }}
      >
        {snapOn && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px)",
              backgroundSize: `${GRID_LOGICAL * dpi * 4 * fit.k}px ${GRID_LOGICAL * dpi * 4 * fit.k}px`,
            }}
          />
        )}

        {items.map((item) => {
          const r = toCanvas(item.bounds, screen, fit);
          const isSel = item.label === selected;
          const locked = locks[item.label] ?? isLocked(item.label);
          // The window lays its content out at size / dpi / scale CSS px.
          const cssW = item.bounds.width / dpi / item.scale;
          const cssH = item.bounds.height / dpi / item.scale;
          const k = fit.k * dpi * item.scale;
          return (
            <div
              key={item.label}
              data-testid={`layout-item-${item.label}`}
              role="button"
              tabIndex={0}
              aria-label={`${item.title} window`}
              aria-pressed={isSel}
              className={[
                "group absolute touch-none select-none outline-none",
                isSel ? "z-20" : "z-10",
                item.open ? "" : isSel ? "opacity-85" : "opacity-50",
              ].join(" ")}
              style={{ left: r.x, top: r.y, width: r.width, height: r.height, cursor: "move" }}
              onPointerDown={(e) => onPointerDown(e, item, "move")}
              onPointerMove={(e) => onPointerMove(e, item)}
              onPointerUp={() => onPointerUp(item)}
              onPointerCancel={() => onPointerUp(item)}
              onKeyDown={(e) => {
                // 1 px, or a grid step with Shift.
                const step = Math.round((e.shiftKey ? GRID_LOGICAL : 1) * dpi);
                const delta: Record<string, [number, number]> = {
                  ArrowLeft: [-step, 0],
                  ArrowRight: [step, 0],
                  ArrowUp: [0, -step],
                  ArrowDown: [0, step],
                };
                const d = delta[e.key];
                if (!d) return;
                e.preventDefault();
                layout.setBounds(
                  item.label,
                  applyDrag(item.bounds, "move", d[0], d[1], {
                    min: minSizeFor(item.kind, dpi),
                    within: screen,
                  })
                );
              }}
            >
              <div className="absolute inset-0 overflow-hidden">
                <WindowContent target={item} width={cssW} height={cssH} scale={k} />
              </div>
              {/* Frame + name tag */}
              <div
                className={[
                  "pointer-events-none absolute inset-0 rounded-[2px] border transition-colors",
                  isSel
                    ? "border-primary shadow-glow"
                    : item.open
                      ? "border-white/15 group-hover:border-primary/60"
                      : "border-dashed border-white/30 group-hover:border-primary/60",
                ].join(" ")}
              />
              <div
                className={[
                  "pointer-events-none absolute left-0 top-0 flex max-w-full -translate-y-full items-center gap-1 truncate rounded-t-[2px] px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                  isSel ? "bg-primary text-on-accent" : "bg-black/70 text-text opacity-0 group-hover:opacity-100",
                ].join(" ")}
              >
                {locked && <Lock className="size-2.5" />}
                <span className="truncate">{item.title}</span>
                {!item.open && <span className="font-normal opacity-70">· closed</span>}
              </div>
              {isSel &&
                HANDLES.map((h) => (
                  <span
                    key={h}
                    data-handle={h}
                    className={[
                      "absolute z-30 size-2.5 rounded-[1px] border border-on-accent bg-primary",
                      HANDLE_POS[h as Exclude<DragHandle, "move">],
                    ].join(" ")}
                    onPointerDown={(e) => onPointerDown(e, item, h)}
                    onPointerMove={(e) => onPointerMove(e, item)}
                    onPointerUp={() => onPointerUp(item)}
                    onPointerCancel={() => onPointerUp(item)}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
