/**
 * Live preview of the overlay being edited.
 *
 * For the **dashboard** it renders the *real* widget components fed by a ticking
 * mock telemetry frame, so the preview looks and behaves exactly like the live
 * overlay (gauges sweep, traces scroll) without needing iRacing or the bridge.
 * Full-screen overlays (standings/relative/fuel) show a representative sample.
 *
 * It reads the selected overlay's settings straight from the config store, so
 * every edit (theme, saturation, brightness, opacity) is reflected instantly —
 * the same store mutation also propagates to a real open overlay window over the
 * bus, keeping preview and window in sync. The theme is applied to a scoped
 * container (not the document root) via {@link applyTheme}.
 */

import { useEffect, useRef, useState } from "react";
import { getDashboard, type DashboardDef } from "../../dashboards/registry";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { mockPlayerTelemetry } from "../../lib/mockData";
import type { PlayerTelemetry } from "../../telemetry/types";
import { applyTheme, getTheme, type Theme } from "../../themes";

interface LivePreviewProps {
  overlayId: string;
}

/**
 * A mock telemetry frame that advances in real time so the real widgets animate.
 * Only runs while `active` (the dashboard preview) to avoid needless work.
 */
function useMockFrame(active: boolean): PlayerTelemetry | null {
  const [frame, setFrame] = useState<PlayerTelemetry | null>(() =>
    active ? mockPlayerTelemetry(0) : null
  );
  useEffect(() => {
    if (!active) {
      setFrame(null);
      return;
    }
    const start = performance.now();
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      // ~12 fps is plenty for gauges/traces and keeps re-renders cheap.
      if (now - last > 80) {
        setFrame(mockPlayerTelemetry((now - start) / 1000));
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active]);
  return frame;
}

export function LivePreview({ overlayId }: LivePreviewProps) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance, enabled } = settings;
  const dashboard = getDashboard(overlayId);

  const themeId = appearance.themeId ?? store.globalSettings.themeId;
  const theme = getTheme(themeId);

  const isDashboard = dashboard.widgets.length > 0;
  const frame = useMockFrame(isDashboard);

  const surfaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Scope the theme to the preview surface so it doesn't disturb the app root.
    if (surfaceRef.current) applyTheme(theme, true, surfaceRef.current);
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
          ref={surfaceRef}
          className="absolute inset-0 flex flex-col gap-2 overflow-y-auto p-3 transition-[filter,opacity]"
          style={{ filter, opacity: appearance.opacity / 100 }}
        >
          <PreviewHeader theme={theme} label={dashboard.label} />
          {isDashboard ? (
            <DashboardPreview dashboard={dashboard} frame={frame} />
          ) : (
            <OverlaySample overlayId={overlayId} />
          )}
        </div>
      </div>

      <p className="mt-2 text-[10px] text-muted">
        Reflects theme + adjustments in real time. Open windows update instantly.
      </p>
    </div>
  );
}

/** A soft checker pattern using the surface colors, drawn behind the preview. */
const CHECKER =
  "repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%) 0 0";

function PreviewHeader({ theme, label }: { theme: Theme; label: string }) {
  const c = theme.colors;
  return (
    <div
      className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[10px] uppercase tracking-wider backdrop-blur"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: c.muted,
      }}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{ background: c.accent }}
      />
      <span style={{ color: c.text }}>{label}</span>
      <span className="ml-auto">Live</span>
    </div>
  );
}

/**
 * The real dashboard: every widget component rendered with a live mock frame, so
 * the preview matches the actual overlay exactly. Wide widgets span both columns.
 */
function DashboardPreview({
  dashboard,
  frame,
}: {
  dashboard: DashboardDef;
  frame: PlayerTelemetry | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {dashboard.widgets.map((w) => {
        const Body = w.Component;
        const wide = w.defaultSize === "lg" || w.defaultSize === "xl";
        const Icon = w.icon;
        return (
          <div
            key={w.id}
            className={[
              "flex flex-col overflow-hidden rounded-lg border backdrop-blur",
              wide ? "col-span-2" : "",
            ].join(" ")}
            style={{
              background: "var(--color-surface)",
              borderColor: "var(--color-border)",
              height: wide ? 120 : 96,
            }}
          >
            <header className="flex items-center gap-1.5 px-2 pt-1.5">
              <Icon className="size-3 shrink-0 text-muted" strokeWidth={2} />
              <span className="truncate text-[9px] font-medium uppercase tracking-wider text-muted">
                {w.title}
              </span>
            </header>
            <div
              className="min-h-0 flex-1 overflow-hidden p-2"
              style={{ containerType: "size" }}
            >
              <Body data={frame} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Overlay-specific sample content for full-screen overlays (standings/relative/
 * fuel): a mini table or tiles. These aren't widget-based, so the preview
 * demonstrates *appearance* with representative content.
 */
function OverlaySample({ overlayId }: { overlayId: string }) {
  if (overlayId === "standings" || overlayId === "relative") {
    return <TablePreview rows={STANDINGS_ROWS} />;
  }
  if (overlayId === "fuel") {
    return <TilePreview tiles={FUEL_TILES} />;
  }
  return <TilePreview tiles={DASH_TILES} />;
}

function TilePreview({ tiles }: { tiles: { label: string; value: string; unit?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-lg border px-3 py-2 backdrop-blur"
          style={{
            background: "var(--color-surface)",
            borderColor: "var(--color-border)",
          }}
        >
          <div
            className="text-[9px] uppercase tracking-wider"
            style={{ color: "var(--color-muted)" }}
          >
            {t.label}
          </div>
          <div
            className="mt-0.5 font-mono text-lg font-semibold"
            style={{ color: "var(--color-accent)" }}
          >
            {t.value}
            {t.unit && (
              <span
                className="ml-0.5 text-[10px] font-normal"
                style={{ color: "var(--color-text)" }}
              >
                {t.unit}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function TablePreview({ rows }: { rows: { pos: number; name: string; gap: string }[] }) {
  return (
    <div
      className="overflow-hidden rounded-lg border backdrop-blur"
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
      }}
    >
      {rows.map((r, i) => (
        <div
          key={r.pos}
          className="flex items-center gap-2 px-2.5 py-1.5 text-[11px]"
          style={{
            borderTop: i === 0 ? "none" : "1px solid var(--color-border)",
            color: "var(--color-text)",
          }}
        >
          <span
            className="w-5 text-center font-mono"
            style={{ color: i === 1 ? "var(--color-accent)" : "var(--color-muted)" }}
          >
            {r.pos}
          </span>
          <span className="flex-1 truncate">{r.name}</span>
          <span className="font-mono" style={{ color: "var(--color-muted)" }}>
            {r.gap}
          </span>
        </div>
      ))}
    </div>
  );
}

const DASH_TILES = [
  { label: "Speed", value: "212", unit: "km/h" },
  { label: "Gear", value: "6" },
  { label: "Fuel", value: "18.4", unit: "L" },
  { label: "Last Lap", value: "1:42.3" },
];

const FUEL_TILES = [
  { label: "Per Lap", value: "2.61", unit: "L" },
  { label: "To Add", value: "34.2", unit: "L" },
  { label: "Laps Left", value: "13" },
  { label: "Margin", value: "+1.2", unit: "L" },
];

const STANDINGS_ROWS = [
  { pos: 1, name: "M. Verstappen", gap: "—" },
  { pos: 2, name: "You", gap: "+0.42" },
  { pos: 3, name: "L. Hamilton", gap: "+1.08" },
  { pos: 4, name: "C. Leclerc", gap: "+2.55" },
];
