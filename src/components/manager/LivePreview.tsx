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
import { Maximize2, X } from "lucide-react";
import { getDashboard, type DashboardDef } from "../../dashboards/registry";
import {
  useOverlayConfigStore,
  type OverlayAppearance,
} from "../../stores/useOverlayConfigStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { DashboardGrid } from "../layout/DashboardGrid";
import { applyTheme, getTheme, type Theme } from "../../themes";

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

  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
          Live Preview
        </p>
        <div className="flex items-center gap-1.5">
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
            className="grid size-5 place-items-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <Maximize2 className="size-3" />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <PreviewSurface
          overlayId={overlayId}
          dashboard={dashboard}
          theme={theme}
          appearance={appearance}
        />
      </div>

      <p className="mt-2 text-[10px] text-muted">
        The real overlay with mock data. Reflects config in real time; open
        windows update instantly.
      </p>

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
