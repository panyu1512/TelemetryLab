/**
 * Live preview — a miniature of the *real* overlay being edited.
 *
 * It renders the actual overlay component (the dashboard's widget grid, or a
 * full-screen Screen) at a natural size and scales it down to fit, so the
 * preview looks and behaves exactly like the live overlay window. Data comes
 * from the manager's stores, which `App` drives with the mock feed — so gauges
 * sweep, standings scroll and fuel updates without iRacing or the bridge.
 *
 * The selected overlay's settings are read straight from the config store, so
 * every edit (theme, saturation, brightness, opacity) is reflected instantly;
 * the same store mutation also propagates to a real open overlay window over the
 * bus, keeping preview and window in sync. The theme is applied to a scoped
 * container (not the document root) via {@link applyTheme}.
 */

import { useEffect, useRef, useState } from "react";
import { getDashboard, type DashboardDef } from "../../dashboards/registry";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { DashboardGrid } from "../layout/DashboardGrid";
import { applyTheme, getTheme } from "../../themes";

interface LivePreviewProps {
  overlayId: string;
}

/** Natural width the overlay is rendered at before being scaled to fit. */
const STAGE_WIDTH = 600;

export function LivePreview({ overlayId }: LivePreviewProps) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance, enabled } = settings;
  const dashboard = getDashboard(overlayId);

  const themeId = appearance.themeId ?? store.globalSettings.themeId;
  const theme = getTheme(themeId);

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
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Live Preview
        </p>
        <span
          className={[
            "rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
            enabled ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
          ].join(" ")}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {/* Checkerboard conveys the transparent overlay compositing over the game. */}
      <div
        className="relative flex-1 overflow-hidden rounded-xl border border-border"
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

      <p className="mt-2 text-[10px] text-muted">
        The real overlay with mock data. Reflects config in real time; open
        windows update instantly.
      </p>
    </div>
  );
}

/** A soft checker pattern drawn behind the (transparent) overlay preview. */
const CHECKER =
  "repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%) 0 0";

/**
 * Renders the real overlay at {@link STAGE_WIDTH} and CSS-scales it to fill the
 * preview box, giving a faithful miniature. Non-interactive (pointer-events off)
 * so the preview can't be dragged.
 */
function PreviewStage({
  overlayId,
  dashboard,
}: {
  overlayId: string;
  dashboard: DashboardDef;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setBox({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = box.w > 0 ? box.w / STAGE_WIDTH : 0;

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0 overflow-hidden">
      {scale > 0 && (
        <div
          style={{
            width: STAGE_WIDTH,
            height: box.h / scale,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <RealOverlay overlayId={overlayId} dashboard={dashboard} />
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
