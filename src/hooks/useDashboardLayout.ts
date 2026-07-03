import { useCallback, useEffect, useMemo, useState } from "react";
import type { Layout } from "react-grid-layout";
import {
  DASHBOARDS,
  getDashboard,
  type WidgetDef,
  type WidgetSize,
} from "../dashboards/registry";

const STORAGE_KEY = "telemetrylab.layout.v4";

/** Grid geometry constants — shared with the grid component. */
export const GRID_COLS = 12;
export const GRID_ROW_HEIGHT = 70;
export const GRID_MARGIN = 12;

/** Default footprint (grid units) for each named size. */
const SIZE_FOOTPRINT: Record<WidgetSize, { w: number; h: number }> = {
  sm: { w: 3, h: 2 },
  md: { w: 4, h: 2 },
  lg: { w: 6, h: 2 },
  xl: { w: 12, h: 3 },
};

const MIN_W = 2;
const MIN_H = 2;

interface PersistedLayout {
  active: string;
  /** dashboardId → hidden widget ids */
  hidden: Record<string, string[]>;
  /** dashboardId → react-grid-layout geometry */
  grids: Record<string, Layout[]>;
}

/** A widget resolved from its definition + the user's visibility override. */
export interface ResolvedWidget {
  def: WidgetDef;
  hidden: boolean;
}

function load(): PersistedLayout {
  const fallback: PersistedLayout = {
    active: DASHBOARDS[0].id,
    hidden: {},
    grids: {},
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedLayout>;
    return {
      active: parsed.active ?? fallback.active,
      hidden: parsed.hidden ?? {},
      grids: parsed.grids ?? {},
    };
  } catch {
    return fallback;
  }
}

/**
 * Pack widgets that don't yet have saved geometry left-to-right across the
 * grid, wrapping at GRID_COLS. Used to seed a dashboard's default layout and to
 * place a widget the moment it is turned back on.
 */
function defaultItem(
  def: WidgetDef,
  cursor: { x: number; y: number; rowH: number }
): Layout {
  const { w, h } = def.defaultLayout ?? SIZE_FOOTPRINT[def.defaultSize];
  if (cursor.x + w > GRID_COLS) {
    cursor.x = 0;
    cursor.y += cursor.rowH;
    cursor.rowH = 0;
  }
  const item: Layout = {
    i: def.id,
    x: cursor.x,
    y: cursor.y,
    w,
    h,
    minW: MIN_W,
    minH: MIN_H,
  };
  cursor.x += w;
  cursor.rowH = Math.max(cursor.rowH, h);
  return item;
}

/**
 * Owns the dashboard/overlay layout: which dashboard is active, whether we are
 * in edit mode, each widget's visibility, and the full drag/resize grid
 * geometry. Everything but `editMode` is persisted to localStorage so a layout
 * survives reloads.
 */
export function useDashboardLayout(forcedActive?: string) {
  const [layout, setLayout] = useState<PersistedLayout>(load);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Storage may be unavailable (private mode); layout just won't persist.
    }
  }, [layout]);

  // A single-overlay window pins the active overlay via `forcedActive` and must
  // not persist it (that would hijack the main window's selection).
  const active = forcedActive ?? layout.active;
  const dashboard = getDashboard(active);

  const setActive = useCallback(
    (id: string) => {
      if (forcedActive) return;
      setLayout((l) => ({ ...l, active: id }));
    },
    [forcedActive]
  );

  const hiddenIds = useMemo(
    () => new Set(layout.hidden[active] ?? []),
    [layout.hidden, active]
  );

  /** All widgets with their visibility — drives the overlay manager. */
  const widgets: ResolvedWidget[] = useMemo(
    () => dashboard.widgets.map((def) => ({ def, hidden: hiddenIds.has(def.id) })),
    [dashboard, hiddenIds]
  );

  const visibleWidgets = useMemo(
    () => dashboard.widgets.filter((def) => !hiddenIds.has(def.id)),
    [dashboard, hiddenIds]
  );

  /**
   * The react-grid-layout array for the visible widgets: saved geometry where
   * we have it, freshly packed defaults for anything new (just-shown widgets or
   * a dashboard that has never been arranged).
   */
  const gridLayout: Layout[] = useMemo(() => {
    const saved = new Map((layout.grids[active] ?? []).map((it) => [it.i, it]));
    const cursor = { x: 0, y: 0, rowH: 0 };
    return visibleWidgets.map((def) => {
      const existing = saved.get(def.id);
      if (existing) return { ...existing, minW: MIN_W, minH: MIN_H };
      return defaultItem(def, cursor);
    });
  }, [layout.grids, active, visibleWidgets]);

  /** Persist a new geometry coming from a drag/resize. */
  const onLayoutChange = useCallback(
    (next: Layout[]) => {
      setLayout((l) => {
        const prev = l.grids[active];
        // Skip no-op churn (RGL fires this on mount with identical data).
        if (prev && JSON.stringify(prev) === JSON.stringify(next)) return l;
        return { ...l, grids: { ...l.grids, [active]: next } };
      });
    },
    [active]
  );

  const toggleWidget = useCallback(
    (widgetId: string) => {
      setLayout((l) => {
        const current = l.hidden[active] ?? [];
        const next = current.includes(widgetId)
          ? current.filter((id) => id !== widgetId)
          : [...current, widgetId];
        return { ...l, hidden: { ...l.hidden, [active]: next } };
      });
    },
    [active]
  );

  /** Drop all overrides for the active dashboard (visibility + geometry). */
  const resetDashboard = useCallback(() => {
    setLayout((l) => {
      const grids = { ...l.grids };
      const hidden = { ...l.hidden };
      delete grids[active];
      delete hidden[active];
      return { ...l, grids, hidden };
    });
  }, [active]);

  return {
    dashboards: DASHBOARDS,
    active,
    setActive,
    dashboard,
    widgets,
    visibleWidgets,
    gridLayout,
    onLayoutChange,
    editMode,
    toggleEditMode: () => setEditMode((e) => !e),
    toggleWidget,
    resetDashboard,
  };
}

export type DashboardLayout = ReturnType<typeof useDashboardLayout>;
