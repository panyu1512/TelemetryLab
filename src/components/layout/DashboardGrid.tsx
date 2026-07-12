import { useEffect, useMemo, useRef, useState } from "react";
import GridLayout from "react-grid-layout";
import { Eye, Sparkles } from "lucide-react";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import {
  GRID_COLS,
  GRID_ROW_HEIGHT,
  GRID_MARGIN,
  type DashboardLayout,
} from "../../hooks/useDashboardLayout";
import type { TelemetryData } from "../../hooks/useTelemetry";
import { Widget, WIDGET_DRAG_HANDLE, WIDGET_NO_DRAG } from "./Widget";

interface DashboardGridProps {
  layout: DashboardLayout;
  data: TelemetryData | null;
  /**
   * Let the grid grow to its natural content height (at the default row
   * height) instead of scaling rows to fill its parent.
   */
  autoHeight?: boolean;
}

/** Rows never collapse below this, however small the window gets. */
const MIN_ROW_HEIGHT = 34;

export function DashboardGrid({ layout, data, autoHeight = false }: DashboardGridProps) {
  const {
    dashboard,
    visibleWidgets,
    gridLayout,
    onLayoutChange,
    toggleWidget,
  } = layout;

  // Measure our own size and feed it to react-grid-layout. The bundled
  // WidthProvider HOC fails to report a width inside this flex/overflow layout,
  // which collapses colWidth and breaks horizontal positioning + resizing.
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const width = size.width;

  // Scale rows so the arrangement fills the window vertically — the dashboard
  // is responsive to its window instead of overflowing into a scrollbar, and
  // the widgets' container-query typography scales with it.
  const totalRows = useMemo(
    () => Math.max(2, ...gridLayout.map((it) => it.y + it.h)),
    [gridLayout]
  );
  const rowHeight =
    autoHeight || size.height <= 0
      ? GRID_ROW_HEIGHT
      : Math.max(
          MIN_ROW_HEIGHT,
          (size.height - GRID_MARGIN * (totalRows + 1)) / totalRows
        );

  const byId = useMemo(
    () => new Map(visibleWidgets.map((d) => [d.id, d])),
    [visibleWidgets]
  );

  let content: React.ReactNode;

  if (dashboard.available && dashboard.Screen) {
    // Full-bleed screen (e.g. the standings timing table): replaces the grid.
    const Screen = dashboard.Screen;
    content = <Screen />;
  } else if (!dashboard.available) {
    content = (
      <Placeholder
        title={`${dashboard.label} is on the roadmap`}
        body={`This screen ships in ${dashboard.milestone ?? "a future release"}. The layout and overlay it lives in are ready today.`}
        icon={<Sparkles className="size-6 text-primary" />}
      />
    );
  } else if (visibleWidgets.length === 0) {
    content = (
      <Placeholder
        title="No widgets visible"
        body="Turn some widgets back on from the Overlay Manager."
        icon={<Eye className="size-6 text-muted" />}
      />
    );
  } else if (width > 0) {
    content = (
      <GridLayout
        width={width}
        layout={gridLayout}
        cols={GRID_COLS}
        rowHeight={rowHeight}
        margin={[GRID_MARGIN, GRID_MARGIN]}
        containerPadding={[0, 0]}
        isDraggable
        isResizable
        draggableHandle={`.${WIDGET_DRAG_HANDLE}`}
        draggableCancel={`.${WIDGET_NO_DRAG}`}
        resizeHandles={["se"]}
        onLayoutChange={onLayoutChange}
        compactType="vertical"
      >
        {gridLayout.map((item) => {
          const def = byId.get(item.i);
          if (!def) return null;
          return (
            <div key={item.i}>
              <Widget def={def} data={data} onHide={() => toggleWidget(def.id)} />
            </div>
          );
        })}
      </GridLayout>
    );
  }

  return (
    <div ref={wrapRef} className={autoHeight ? "w-full" : "h-full"}>
      {content}
    </div>
  );
}

function Placeholder({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-card border border-border bg-surface">
          {icon}
        </div>
        <h2 className="text-base font-semibold text-text">{title}</h2>
        <p className="text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </div>
  );
}
