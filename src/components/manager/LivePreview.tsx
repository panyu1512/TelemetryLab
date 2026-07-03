/**
 * Live preview — a themed, representative render of the overlay being edited.
 *
 * It reads the *selected* overlay's settings straight from the config store, so
 * every edit (theme, saturation, brightness, opacity) is reflected instantly
 * with no apply/refresh step — the same store mutation also propagates to a real
 * open overlay window over the bus, keeping preview and window in sync.
 *
 * The theme is applied to a scoped container (not the document root) via
 * {@link applyTheme}, so the preview can show a different overlay's theme than
 * the one the main window is currently displaying.
 */

import { useEffect, useRef } from "react";
import { getDashboard } from "../../dashboards/registry";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { applyTheme, getTheme, type Theme } from "../../themes";

interface LivePreviewProps {
  overlayId: string;
}

export function LivePreview({ overlayId }: LivePreviewProps) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance, enabled } = settings;
  const dashboard = getDashboard(overlayId);

  const themeId = appearance.themeId ?? store.globalSettings.themeId;
  const theme = getTheme(themeId);

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
          className="absolute inset-0 flex flex-col gap-2 overflow-hidden p-3 transition-[filter,opacity]"
          style={{ filter, opacity: appearance.opacity / 100 }}
        >
          <PreviewHeader theme={theme} label={dashboard.label} />
          <OverlaySample overlayId={overlayId} />
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
 * Overlay-specific sample content. Full-screen overlays (standings/relative/
 * fuel) get a mini table; the widget dashboard gets a tile grid. All values are
 * static placeholders — the preview demonstrates *appearance*, not live data.
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
