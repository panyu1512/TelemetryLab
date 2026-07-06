/**
 * Preview Canvas — a proper workspace for inspecting overlays, not a strip of
 * tiny thumbnails.
 *
 * It fills the space beside the config panel and renders the *real* overlay
 * components driven by the manager's mock feed (see `App`), so every gauge,
 * table and strategy read-out is populated and animating without iRacing or the
 * bridge. Two modes:
 *
 *   - **Single** — one overlay at (or near) its real window size, with zoom
 *     presets (50/75/100 %/Fit). When the overlay is larger than the viewport
 *     it can be panned/scrolled, so the whole thing is always inspectable.
 *   - **Grid** — thumbnails of every overlay for quick navigation; clicking one
 *     focuses it in Single mode.
 *
 * A fullscreen toggle blows the canvas up to the whole window for a close look
 * that matches the real overlay proportions. Each overlay is rendered with its
 * own theme + appearance, scoped to its stage (not the document root), and
 * borderless (the `.overlay-preview` wrapper strips the card chrome) so the
 * preview matches how the real always-on-top window paints over the game.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Maximize2,
  Minimize2,
  LayoutGrid,
  Square,
  AppWindow,
} from "lucide-react";
import {
  DASHBOARDS,
  getDashboard,
  type DashboardDef,
} from "../../dashboards/registry";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { useActiveOverlaysStore } from "../../stores/useActiveOverlaysStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import { useDashboardLayout } from "../../hooks/useDashboardLayout";
import { DashboardGrid } from "../layout/DashboardGrid";
import { applyTheme, getTheme } from "../../themes";

/**
 * The overlay's natural render size — matches the default spawned overlay
 * window (see `overlayWindows.ts`), so 100% zoom is true-to-life.
 */
const OVERLAY_W = 640;
const OVERLAY_H = 420;

type Mode = "single" | "grid";
/** A zoom preset: a fixed scale, or "fit" (computed from the viewport). */
type Zoom = 0.5 | 0.75 | 1 | "fit";

const ZOOM_PRESETS: Zoom[] = [0.5, 0.75, 1, "fit"];

interface PreviewCanvasProps {
  /** The overlay focused in Single mode (driven by the sidebar selection). */
  overlayId: string;
  /** Focus another overlay (e.g. from a Grid thumbnail). */
  onSelect: (overlayId: string) => void;
}

export function PreviewCanvas({ overlayId, onSelect }: PreviewCanvasProps) {
  const [mode, setMode] = useState<Mode>("single");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [fullscreen, setFullscreen] = useState(false);

  const dashboard = getDashboard(overlayId);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return (
    <div
      className={[
        "overlay-preview flex min-h-0 flex-col bg-bg",
        fullscreen ? "fixed inset-0 z-50" : "h-full",
      ].join(" ")}
    >
      <CanvasToolbar
        mode={mode}
        onMode={setMode}
        zoom={zoom}
        onZoom={setZoom}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
        dashboard={dashboard}
      />

      {mode === "single" ? (
        <SingleView key={overlayId} overlayId={overlayId} zoom={zoom} />
      ) : (
        <GridView
          selectedId={overlayId}
          onSelect={(id) => {
            onSelect(id);
            setMode("single");
          }}
        />
      )}
    </div>
  );
}

// ── toolbar ───────────────────────────────────────────────────────────────────

function CanvasToolbar({
  mode,
  onMode,
  zoom,
  onZoom,
  fullscreen,
  onToggleFullscreen,
  dashboard,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  dashboard: DashboardDef;
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
      <p className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
        Preview
      </p>

      {/* Mode toggle */}
      <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
        <SegBtn active={mode === "single"} onClick={() => onMode("single")}>
          <Square className="size-3.5" />
          Single
        </SegBtn>
        <SegBtn active={mode === "grid"} onClick={() => onMode("grid")}>
          <LayoutGrid className="size-3.5" />
          Grid
        </SegBtn>
      </div>

      {mode === "single" && (
        <span className="hidden truncate text-xs font-medium text-text sm:block">
          {dashboard.label}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        {mode === "single" && (
          <>
            {/* Zoom presets */}
            <div className="flex items-center rounded-lg border border-border bg-surface-2 p-0.5">
              {ZOOM_PRESETS.map((z) => (
                <SegBtn key={z} active={zoom === z} onClick={() => onZoom(z)}>
                  {z === "fit" ? "Fit" : `${Math.round(z * 100)}%`}
                </SegBtn>
              ))}
            </div>
            {dashboard.widgets.length === 0 && (
              <OpenWindowButton overlayId={dashboard.id} label={dashboard.label} />
            )}
          </>
        )}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen preview"}
          className="grid size-7 place-items-center rounded-lg border border-border bg-surface-2 text-muted transition-colors hover:border-border-strong hover:text-text"
        >
          {fullscreen ? (
            <Minimize2 className="size-3.5" />
          ) : (
            <Maximize2 className="size-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}

/** Opens the *real* always-on-top overlay window at its true dimensions. */
function OpenWindowButton({
  overlayId,
  label,
}: {
  overlayId: string;
  label: string;
}) {
  const isOpen = useActiveOverlaysStore((s) => s.isOverlayOpen(overlayId));
  const openOverlay = useActiveOverlaysStore((s) => s.openOverlay);
  const closeOverlay = useActiveOverlaysStore((s) => s.closeOverlay);

  return (
    <button
      type="button"
      onClick={() =>
        isOpen ? closeOverlay(overlayId) : openOverlay(overlayId, label)
      }
      title={
        isOpen
          ? "Close the detached overlay window"
          : "Open a detached window at the real overlay size"
      }
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text transition-colors hover:border-border-strong"
    >
      <AppWindow className="size-3.5" />
      {isOpen ? "Close window" : "Detach"}
    </button>
  );
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-accent text-bg"
          : "text-muted hover:bg-surface hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ── single view ────────────────────────────────────────────────────────────────

/** A checker + dark backdrop that stands in for the game behind the overlay. */
const CANVAS_BG = "#0d0d0d";
const CHECKER =
  "repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 0 0";

function SingleView({ overlayId, zoom }: { overlayId: string; zoom: Zoom }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () =>
      setViewport({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // "Fit" leaves a small margin so the overlay never touches the edges.
  const fitScale =
    viewport.w > 0
      ? Math.min((viewport.w - 48) / OVERLAY_W, (viewport.h - 48) / OVERLAY_H)
      : 0;
  const scale = zoom === "fit" ? Math.max(0.2, fitScale) : zoom;

  return (
    <div
      ref={viewportRef}
      className="min-h-0 flex-1 overflow-auto"
      style={{ background: CANVAS_BG }}
    >
      {/* Grid backdrop + centering wrapper. `min-h/w-full` centers a small
          overlay; when it's larger than the viewport the wrapper grows to the
          overlay's size so the top-left stays reachable while scrolling. */}
      <div
        className="flex min-h-full min-w-full items-center justify-center p-6"
        style={{ background: CHECKER, backgroundSize: "18px 18px" }}
      >
        {scale > 0 && (
          <div
            className="shadow-2xl ring-1 ring-white/5"
            style={{ width: OVERLAY_W * scale, height: OVERLAY_H * scale }}
          >
            <OverlayStage overlayId={overlayId} scale={scale} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── grid view ──────────────────────────────────────────────────────────────────

const THUMB_W = 260;
const THUMB_H = Math.round((THUMB_W * OVERLAY_H) / OVERLAY_W);

function GridView({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
        {DASHBOARDS.map((d) => (
          <Thumbnail
            key={d.id}
            overlayId={d.id}
            selected={d.id === selectedId}
            onSelect={() => onSelect(d.id)}
          />
        ))}
      </div>
    </div>
  );
}

function Thumbnail({
  overlayId,
  selected,
  onSelect,
}: {
  overlayId: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const dashboard = getDashboard(overlayId);
  const Icon = dashboard.icon;
  const enabled = useOverlayConfigStore(
    (s) => s.getOverlaySettings(overlayId).enabled
  );
  const scale = THUMB_W / OVERLAY_W;

  // A div (not a <button>): overlays render their own <button>s (Standings /
  // Relative headers), and a button can't legally nest buttons.
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      title={`Preview ${dashboard.label}`}
      className={[
        "group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface text-left transition-colors",
        selected
          ? "border-accent ring-1 ring-accent"
          : "border-border hover:border-border-strong",
      ].join(" ")}
    >
      <div
        className="relative w-full overflow-hidden"
        style={{ height: THUMB_H, background: CANVAS_BG }}
      >
        <div style={{ background: CHECKER, backgroundSize: "14px 14px" }}>
          <OverlayStage overlayId={overlayId} scale={scale} />
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
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
          {enabled ? "On" : "Off"}
        </span>
      </div>
    </div>
  );
}

// ── overlay stage (shared) ───────────────────────────────────────────────────

/**
 * Renders one overlay at its natural {@link OVERLAY_W}×{@link OVERLAY_H} size and
 * CSS-scales it by `scale`. Non-interactive (pointer-events off) so it can't be
 * dragged or rearranged, and theme-scoped to this element so it doesn't disturb
 * the app root. The parent reserves the scaled footprint.
 */
function OverlayStage({
  overlayId,
  scale,
}: {
  overlayId: string;
  scale: number;
}) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance } = settings;
  const themeId = appearance.themeId ?? store.globalSettings.themeId;
  const theme = getTheme(themeId);

  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (stageRef.current) applyTheme(theme, true, stageRef.current);
  }, [theme]);

  const filter =
    appearance.saturation !== 100 || appearance.brightness !== 100
      ? `saturate(${appearance.saturation}%) brightness(${appearance.brightness}%)`
      : undefined;

  return (
    <div
      ref={stageRef}
      className="pointer-events-none origin-top-left transition-[filter,opacity]"
      style={{
        width: OVERLAY_W,
        height: OVERLAY_H,
        transform: `scale(${scale})`,
        filter,
        opacity: appearance.opacity / 100,
      }}
    >
      <RealOverlay overlayId={overlayId} />
    </div>
  );
}

/** The actual overlay body — a Screen, or the dashboard's widget grid. */
function RealOverlay({ overlayId }: { overlayId: string }) {
  const dashboard = getDashboard(overlayId);
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
