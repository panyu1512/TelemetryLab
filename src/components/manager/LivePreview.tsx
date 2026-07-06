/**
 * Live preview — miniatures of the *real* overlays, all at once.
 *
 * {@link LivePreviewStack} renders one preview per entry in `DASHBOARDS`,
 * stacked vertically and centered in the manager's preview column. Each one
 * ({@link LivePreviewCard}) mounts the actual overlay component (the dashboard's
 * widget grid, or a full-screen Screen) so the preview looks and behaves exactly
 * like the live overlay window. Data comes from the manager's stores, which
 * `App` drives with the mock feed — so every gauge sweeps, standings scroll and
 * fuel updates at the same time, without iRacing or the bridge.
 *
 * Each overlay's settings are read straight from the config store, so every edit
 * (theme, saturation, brightness, opacity) is reflected instantly; the same
 * store mutation also propagates to a real open overlay window over the bus,
 * keeping preview and window in sync. The theme is applied to a scoped container
 * (not the document root) via {@link applyTheme}.
 *
 * Two scroll levels: the preview column scrolls the whole stack (owned by the
 * manager), and each preview {@link PreviewStage} scrolls internally — the real
 * overlay is scaled to fit the preview's width down to a readable minimum, then
 * any remaining height is reached by scrolling rather than shrinking further.
 */

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";
import {
  DASHBOARDS,
  getDashboard,
  type DashboardDef,
} from "../../dashboards/registry";
import {
  useOverlayConfigStore,
  type OverlayAppearance,
} from "../../stores/useOverlayConfigStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { DashboardGrid } from "../layout/DashboardGrid";
import { applyTheme, getTheme, type Theme } from "../../themes";

/** Natural width the overlay is rendered at before being scaled to fit. */
const STAGE_WIDTH = 600;
/** Natural height the overlay is rendered at; the stage scrolls past the box. */
const STAGE_HEIGHT = 460;
/** Don't shrink a preview below this — keep it readable, scroll instead. */
const MIN_SCALE = 0.45;
/** Height of each preview box in the stacked column. */
const CARD_HEIGHT = 184;

/**
 * Every overlay's live preview, stacked vertically and centered. Meant to live
 * inside a column that owns the outer (whole-stack) scroll.
 */
export function LivePreviewStack() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Live Preview
        </p>
        <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-accent">
          mock data
        </span>
      </div>

      {DASHBOARDS.map((d) => (
        <LivePreviewCard key={d.id} overlayId={d.id} />
      ))}

      <p className="text-[10px] leading-relaxed text-muted">
        Every overlay with mock data, live. Reflects config in real time; open
        windows update instantly. Scroll a preview to see the rest of a tall
        overlay.
      </p>
    </div>
  );
}

interface LivePreviewCardProps {
  overlayId: string;
}

/** A single overlay's preview: a titled, scrollable miniature. */
function LivePreviewCard({ overlayId }: LivePreviewCardProps) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance, enabled } = settings;
  const dashboard = getDashboard(overlayId);
  const Icon = dashboard.icon;

  const themeId = appearance.themeId ?? store.globalSettings.themeId;
  const theme = getTheme(themeId);

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full">
      <div className="mb-1.5 flex items-center gap-1.5">
        <Icon className="size-3.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">
          {dashboard.label}
        </span>
        <span
          className={[
            "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
            enabled ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
          ].join(" ")}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
        <button
          type="button"
          onClick={() => setExpanded(true)}
          title="Expand preview"
          className="grid size-5 shrink-0 place-items-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Maximize2 className="size-3" />
        </button>
      </div>

      <div className="relative" style={{ height: CARD_HEIGHT }}>
        <PreviewSurface
          overlayId={overlayId}
          dashboard={dashboard}
          theme={theme}
          appearance={appearance}
        />
      </div>

      {expanded && (
        <ExpandedPreview
          overlayId={overlayId}
          dashboard={dashboard}
          theme={theme}
          appearance={appearance}
          onClose={() => setExpanded(false)}
        />
      )}
    </div>
  );
}

interface SurfaceProps {
  overlayId: string;
  dashboard: DashboardDef;
  theme: Theme;
  appearance: OverlayAppearance;
}

/** The framed, theme-scoped preview surface (checkerboard + scaled overlay). */
function PreviewSurface({ overlayId, dashboard, theme, appearance }: SurfaceProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scope the theme to the preview surface so it doesn't disturb the app root.
    if (stageRef.current) applyTheme(theme, true, stageRef.current);
  }, [theme]);

  const filter =
    appearance.saturation !== 100 || appearance.brightness !== 100
      ? `saturate(${appearance.saturation}%) brightness(${appearance.brightness}%)`
      : undefined;

  return (
    <div
      className="absolute inset-0 overflow-hidden rounded-xl border border-border"
      style={{ background: CHECKER, backgroundSize: "16px 16px" }}
    >
      <div
        ref={stageRef}
        className="absolute inset-0 transition-[filter,opacity]"
        style={{ filter, opacity: appearance.opacity / 100 }}
      >
        <PreviewStage overlayId={overlayId} dashboard={dashboard} />
      </div>
    </div>
  );
}

/** A large, focused preview modal for a closer look at the overlay. */
function ExpandedPreview({
  overlayId,
  dashboard,
  theme,
  appearance,
  onClose,
}: SurfaceProps & { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg/85 p-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="mb-3 flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Live Preview · {dashboard.label}
        </p>
        <button
          type="button"
          onClick={onClose}
          title="Close (Esc)"
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:border-border-strong"
        >
          <X className="size-3.5" />
          Close
        </button>
      </div>
      {/* Stop propagation so clicking the preview itself doesn't close it. */}
      <div
        className="relative mx-auto min-h-0 w-full max-w-5xl flex-1"
        onClick={(e) => e.stopPropagation()}
      >
        <PreviewSurface
          overlayId={overlayId}
          dashboard={dashboard}
          theme={theme}
          appearance={appearance}
        />
      </div>
    </div>
  );
}

/** A soft checker pattern drawn behind the (transparent) overlay preview. */
const CHECKER =
  "repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%) 0 0";

/**
 * Renders the real overlay at {@link STAGE_WIDTH} × {@link STAGE_HEIGHT} and
 * CSS-scales it to fill the preview box's width, giving a faithful miniature.
 * The scale is clamped to {@link MIN_SCALE} so a narrow column doesn't shrink
 * the overlay into illegibility; whatever height that leaves beyond the box is
 * reached by scrolling this container vertically.
 *
 * The scaled content is `pointer-events: none` (so the preview can't be dragged
 * or its widgets rearranged), while the scroll container keeps pointer events —
 * a wheel over the preview scrolls it, but clicks never reach the live grid.
 */
function PreviewStage({
  overlayId,
  dashboard,
}: {
  overlayId: string;
  dashboard: DashboardDef;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBoxW(el.clientWidth));
    ro.observe(el);
    setBoxW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const scale =
    boxW > 0 ? Math.min(1, Math.max(MIN_SCALE, boxW / STAGE_WIDTH)) : 0;

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 overflow-x-hidden overflow-y-auto"
    >
      {scale > 0 && (
        // Reserve the scaled footprint so the container has something to scroll.
        <div
          style={{ width: STAGE_WIDTH * scale, height: STAGE_HEIGHT * scale }}
        >
          <div
            className="pointer-events-none origin-top-left"
            style={{
              width: STAGE_WIDTH,
              height: STAGE_HEIGHT,
              transform: `scale(${scale})`,
            }}
          >
            <RealOverlay overlayId={overlayId} dashboard={dashboard} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The actual overlay body — a Screen, or the dashboard's widget grid. */
function RealOverlay({
  overlayId,
  dashboard,
}: {
  overlayId: string;
  dashboard: DashboardDef;
}) {
  const data = useTelemetryStore((s) => s.telemetry);
  const layout = useDashboardLayout(overlayId);

  if (dashboard.Screen) {
    const Screen = dashboard.Screen;
    return (
      <div className="h-full w-full overflow-hidden p-2">
        <Screen />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden p-2">
      <DashboardGrid layout={layout} data={data} />
    </div>
  );
}
