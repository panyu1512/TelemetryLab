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

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
  type WidgetDef,
  type WidgetSize,
} from "../../dashboards/registry";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { useActiveOverlaysStore } from "../../stores/useActiveOverlaysStore";
import { useWidgetSelectionStore } from "../../stores/useWidgetSelectionStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import type { TelemetryData } from "../../hooks/useTelemetry";
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

/**
 * Stand-ins for what's behind a live overlay. Checker shows transparency;
 * the other two approximate on-track scenes (dark cockpit/asphalt and a
 * bright, hazy day) so readability can be judged before going in-sim.
 */
type Backdrop = "checker" | "asphalt" | "daylight";

/*
 * These are raw literals on purpose, and the one place in the app that is
 * exempt from the token rule in `design.md`: they stand in for *the game
 * behind the overlay*, not for app chrome. Theming them would defeat the whole
 * point of the backdrop switcher, which exists to check that a widget stays
 * legible against scenes the design system does not control.
 */
const BACKDROPS: Record<Backdrop, { label: string; css: string }> = {
  checker: { label: "Checker", css: "" },
  asphalt: {
    label: "Asphalt",
    css: "linear-gradient(165deg, #3e434a 0%, #2b2e33 40%, #1a1c1f 100%)",
  },
  daylight: {
    label: "Daylight",
    css: "linear-gradient(180deg, #c3d2e4 0%, #a8b8c6 38%, #7b8577 62%, #565c50 100%)",
  },
};

interface PreviewCanvasProps {
  /** The overlay focused in Single mode (driven by the sidebar selection). */
  overlayId: string;
  /** Focus another overlay (e.g. from a Grid thumbnail). */
  onSelect: (overlayId: string) => void;
}

export function PreviewCanvas({ overlayId, onSelect }: PreviewCanvasProps) {
  const [mode, setMode] = useState<Mode>("single");
  const [zoom, setZoom] = useState<Zoom>("fit");
  const [backdrop, setBackdrop] = useState<Backdrop>("checker");
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
        backdrop={backdrop}
        onBackdrop={setBackdrop}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
        dashboard={dashboard}
      />

      {mode === "single" ? (
        dashboard.widgets.length > 0 ? (
          // Widget dashboards preview as a stack of full-size widget cards —
          // one above the other, like the individual windows they open into —
          // instead of a miniature grid.
          <WidgetStackView
            key={overlayId}
            overlayId={overlayId}
            backdrop={backdrop}
          />
        ) : (
          <SingleView
            key={overlayId}
            overlayId={overlayId}
            zoom={zoom}
            backdrop={backdrop}
          />
        )
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
  backdrop,
  onBackdrop,
  fullscreen,
  onToggleFullscreen,
  dashboard,
}: {
  mode: Mode;
  onMode: (m: Mode) => void;
  zoom: Zoom;
  onZoom: (z: Zoom) => void;
  backdrop: Backdrop;
  onBackdrop: (b: Backdrop) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  dashboard: DashboardDef;
}) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2">
      <p className="mr-1 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
        Preview
      </p>

      {/* Mode toggle */}
      <div className="flex items-center gap-0.5 rounded-ctl border border-border bg-bg p-0.5">
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
            {/* Backdrop: judge readability against different scenes */}
            <div className="flex items-center gap-0.5 rounded-ctl border border-border bg-bg p-0.5">
              {(Object.keys(BACKDROPS) as Backdrop[]).map((b) => (
                <SegBtn
                  key={b}
                  active={backdrop === b}
                  onClick={() => onBackdrop(b)}
                >
                  {BACKDROPS[b].label}
                </SegBtn>
              ))}
            </div>
            {/* Zoom presets (the widget stack sizes itself, so none there) */}
            {dashboard.widgets.length === 0 && (
              <div className="flex items-center gap-0.5 rounded-ctl border border-border bg-bg p-0.5">
                {ZOOM_PRESETS.map((z) => (
                  <SegBtn key={z} active={zoom === z} onClick={() => onZoom(z)}>
                    {z === "fit" ? "Fit" : `${Math.round(z * 100)}%`}
                  </SegBtn>
                ))}
              </div>
            )}
            {dashboard.widgets.length === 0 && (
              <OpenWindowButton overlayId={dashboard.id} label={dashboard.label} />
            )}
          </>
        )}
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={fullscreen ? "Exit fullscreen (Esc)" : "Fullscreen preview"}
          className="grid size-7 place-items-center rounded-ctl border border-border bg-surface-2 text-muted transition-colors hover:border-border-strong hover:text-text"
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
      className="flex items-center gap-1.5 rounded-ctl border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text transition-colors hover:border-border-strong"
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
        "flex items-center gap-1.5 rounded-ctl px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-surface-2 text-text shadow-sm"
          : "text-muted hover:text-text",
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

type Size = { w: number; h: number };

const BASE: Size = { w: OVERLAY_W, h: OVERLAY_H };
/** Never let a runaway measurement blow the stage up unboundedly. */
const MAX_STAGE = 2400;

/**
 * The natural size the overlay needs to show *everything* — its own layout box,
 * grown by however much any internal scroll container (a standings table wider
 * than the window, a screen taller than its frame) overflows. Sizing the stage
 * to this means the overlay's internal scrollbars never engage, so the canvas
 * (via fit/zoom/pan) is the single place the whole overlay is inspected — no
 * hidden, unreachable content.
 */
function neededSize(el: HTMLElement, current: Size): Size {
  let w = el.scrollWidth;
  let h = el.scrollHeight;
  for (const c of el.querySelectorAll<HTMLElement>("*")) {
    const cs = getComputedStyle(c);
    if (cs.overflowX === "auto" || cs.overflowX === "scroll") {
      w = Math.max(w, current.w + (c.scrollWidth - c.clientWidth));
    }
    if (cs.overflowY === "auto" || cs.overflowY === "scroll") {
      h = Math.max(h, current.h + (c.scrollHeight - c.clientHeight));
    }
  }
  return {
    w: Math.min(MAX_STAGE, Math.ceil(w)),
    h: Math.min(MAX_STAGE, Math.ceil(h)),
  };
}

/**
 * Grow-only size state for one overlay. Starts at the default window size and
 * expands (never shrinks) until the overlay's content fits without any internal
 * scrolling. Returns the size and a `grow` callback the stage feeds measurements
 * into.
 */
function useOverlaySize(): [Size, (needed: Size) => void] {
  const [size, setSize] = useState<Size>(BASE);
  const grow = useCallback((needed: Size) => {
    setSize((prev) =>
      needed.w > prev.w + 0.5 || needed.h > prev.h + 0.5
        ? { w: Math.max(prev.w, needed.w), h: Math.max(prev.h, needed.h) }
        : prev
    );
  }, []);
  return [size, grow];
}

function SingleView({
  overlayId,
  zoom,
  backdrop,
}: {
  overlayId: string;
  zoom: Zoom;
  backdrop: Backdrop;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const [size, grow] = useOverlaySize();

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

  // Fit the *whole* overlay (its full measured size, both axes) into the
  // viewport, leaving a margin and never upscaling past 100%. A zoom preset
  // overrides with a fixed scale; anything larger than the viewport is reachable
  // by scrolling/panning the container.
  const fitScale =
    viewport.w > 0
      ? Math.min(1, (viewport.w - 48) / size.w, (viewport.h - 48) / size.h)
      : 0;
  const scale = zoom === "fit" ? Math.max(0.08, fitScale) : zoom;

  return (
    <div
      ref={viewportRef}
      className="min-h-0 flex-1 overflow-auto"
      style={{ background: CANVAS_BG }}
    >
      {/* Backdrop + centering wrapper. `min-h/w-full` centers a small
          overlay; when it's larger than the viewport the wrapper grows to the
          overlay's size so the top-left stays reachable while scrolling. */}
      <div
        className="flex min-h-full min-w-full items-center justify-center p-6"
        style={
          backdrop === "checker"
            ? { background: CHECKER, backgroundSize: "18px 18px" }
            : { background: BACKDROPS[backdrop].css }
        }
      >
        {scale > 0 && (
          <div
            className="shadow-2xl ring-1 ring-white/5"
            style={{ width: size.w * scale, height: size.h * scale }}
          >
            <OverlayStage
              overlayId={overlayId}
              scale={scale}
              size={size}
              onGrow={grow}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── widget stack view ─────────────────────────────────────────────────────────

/**
 * Per-widget preview height, matched to each widget's default footprint so a
 * tall widget (cluster, tyres) previews taller than a compact readout. Far
 * larger than the old in-grid tiles — each card gets the room a real widget
 * window would.
 */
const STACK_HEIGHT: Record<WidgetSize, number> = {
  sm: 200,
  md: 220,
  lg: 260,
  xl: 300,
};

function widgetPreviewHeight(def: WidgetDef): number {
  const h = def.defaultLayout?.h;
  if (h != null) return Math.min(340, Math.max(200, h * 110));
  return STACK_HEIGHT[def.defaultSize];
}

/**
 * The preview for a widget dashboard: every *enabled* widget rendered as its
 * own full-width card, stacked vertically — mirroring how each widget opens in
 * its own window. Cards render the live mock feed, scoped to the overlay's
 * theme + appearance like the single-overlay stage.
 */
function WidgetStackView({
  overlayId,
  backdrop,
}: {
  overlayId: string;
  backdrop: Backdrop;
}) {
  const dashboard = getDashboard(overlayId);
  const store = useOverlayConfigStore();
  const { appearance } = store.getOverlaySettings(overlayId);
  const themeId = appearance.themeId ?? store.globalSettings.themeId;
  const theme = getTheme(themeId);
  const enabledMap = useWidgetSelectionStore((s) => s.enabled);
  const data = useTelemetryStore((s) => s.telemetry);

  const themeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (themeRef.current) applyTheme(theme, true, themeRef.current);
  }, [theme]);

  const enabled = dashboard.widgets.filter((w) => enabledMap[w.id] !== false);
  const disabledCount = dashboard.widgets.length - enabled.length;

  const filter =
    appearance.saturation !== 100 || appearance.brightness !== 100
      ? `saturate(${appearance.saturation}%) brightness(${appearance.brightness}%)`
      : undefined;

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto"
      style={{ background: CANVAS_BG }}
    >
      <div
        className="min-h-full p-6"
        style={
          backdrop === "checker"
            ? { background: CHECKER, backgroundSize: "18px 18px" }
            : { background: BACKDROPS[backdrop].css }
        }
      >
        <div
          ref={themeRef}
          className="mx-auto flex w-full max-w-[560px] flex-col gap-4 transition-[filter,opacity]"
          style={{ filter, opacity: appearance.opacity / 100 }}
        >
          {enabled.map((def) => (
            <WidgetPreviewCard key={def.id} def={def} data={data} />
          ))}
        </div>

        {enabled.length === 0 && (
          <p className="mx-auto max-w-sm pt-10 text-center text-sm text-muted">
            No widgets enabled — turn some on in the config panel to preview
            them here.
          </p>
        )}
        {disabledCount > 0 && (
          <p className="mx-auto max-w-[560px] pt-4 text-center text-[11px] text-faint">
            {disabledCount} disabled widget{disabledCount === 1 ? "" : "s"} not
            shown — enable {disabledCount === 1 ? "it" : "them"} in the config
            panel to preview.
          </p>
        )}
      </div>
    </div>
  );
}

/** One stacked widget card, with the same chrome as a real widget window. */
function WidgetPreviewCard({
  def,
  data,
}: {
  def: WidgetDef;
  data: TelemetryData | null;
}) {
  return (
    <section
      // `timing-surface` here for the same reason rule 7 exists: the preview
      // renders the overlay's one true form. A preview on graphite where the
      // overlay paints near-black is a preview that lies about the thing it is
      // previewing.
      className="overlay-card widget-card timing-surface pointer-events-none flex flex-col overflow-hidden rounded-card border border-border/60 shadow-2xl ring-1 ring-white/5"
      style={{ height: widgetPreviewHeight(def) }}
    >
      {/* Headerless, because the overlay is. The comment above is the reason:
          a preview that carries a name and an icon the real widget does not is
          a preview that lies about the thing it is previewing. The config panel
          beside this canvas is where the widgets are listed by name. */}
      <div
        className="min-h-0 flex-1 overflow-hidden"
        style={{ containerType: "size" }}
      >
        <def.Component data={data} />
      </div>
    </section>
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

  // Fit the whole overlay into the thumbnail (both dimensions) so a wide or
  // tall overlay is shrunk to fit rather than clipped.
  const [size, grow] = useOverlaySize();
  const scale = Math.min(THUMB_W / size.w, THUMB_H / size.h);

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
        "group flex cursor-pointer flex-col overflow-hidden rounded-panel border bg-surface text-left transition-colors",
        selected
          ? "border-primary ring-1 ring-primary/50"
          : "border-border hover:border-border-strong",
      ].join(" ")}
    >
      <div
        className="relative flex w-full items-center justify-center overflow-hidden"
        style={{ height: THUMB_H, background: CANVAS_BG }}
      >
        <div
          className="absolute inset-0"
          style={{ background: CHECKER, backgroundSize: "14px 14px" }}
        />
        <div
          className="relative"
          style={{ width: size.w * scale, height: size.h * scale }}
        >
          <OverlayStage
            overlayId={overlayId}
            scale={scale}
            size={size}
            onGrow={grow}
          />
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <Icon className="size-3.5 shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-text">
          {dashboard.label}
        </span>
        <span
          className={[
            "rounded-ctl px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            enabled ? "bg-accent/15 text-accent" : "bg-surface-2 text-faint",
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
 * Renders one overlay at the given natural `size`, CSS-scaled by `scale`.
 * Measures the content (via {@link neededSize}) and reports any growth up
 * through `onGrow`, so the parent can enlarge the stage until nothing is
 * clipped. Non-interactive (pointer-events off) so it can't be dragged or
 * rearranged, and theme-scoped so it doesn't disturb the app root. A CSS
 * transform on an ancestor doesn't affect the measured layout size, so this is
 * stable across zoom.
 */
function OverlayStage({
  overlayId,
  scale,
  size,
  onGrow,
}: {
  overlayId: string;
  scale: number;
  size: Size;
  onGrow: (needed: Size) => void;
}) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance } = settings;
  const themeId = appearance.themeId ?? store.globalSettings.themeId;
  const theme = getTheme(themeId);

  const themeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (themeRef.current) applyTheme(theme, true, themeRef.current);
  }, [theme]);

  // Measure the content and grow the stage until its internal scrollers fit.
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const recompute = () => onGrow(neededSize(el, size));
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    // Watch the internal scroll containers too, so a change in their content
    // (more rows, wider columns) re-triggers the grow pass.
    for (const c of el.querySelectorAll<HTMLElement>("*")) {
      const cs = getComputedStyle(c);
      if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY)) ro.observe(c);
    }
    recompute();
    return () => ro.disconnect();
  }, [overlayId, size.w, size.h, onGrow]);

  const filter =
    appearance.saturation !== 100 || appearance.brightness !== 100
      ? `saturate(${appearance.saturation}%) brightness(${appearance.brightness}%)`
      : undefined;

  return (
    <div
      ref={themeRef}
      className="pointer-events-none origin-top-left transition-[filter,opacity]"
      style={{
        transform: `scale(${scale})`,
        filter,
        opacity: appearance.opacity / 100,
      }}
    >
      <div ref={contentRef} style={{ width: size.w }}>
        <RealOverlay overlayId={overlayId} height={size.h} />
      </div>
    </div>
  );
}

/** The actual overlay body — a Screen, or the dashboard's widget grid. */
function RealOverlay({
  overlayId,
  height,
}: {
  overlayId: string;
  height: number;
}) {
  const dashboard = getDashboard(overlayId);
  const data = useTelemetryStore((s) => s.telemetry);
  const layout = useDashboardLayout(overlayId);

  if (dashboard.Screen) {
    // Screens fill a window and scroll internally. Give them a frame at the
    // (growing) stage height so their own scrollbars never engage — the parent
    // enlarges `height` until all rows/columns fit.
    //
    // A screen renders identically here and over footage: it has one form, with
    // no chrome and nothing clickable, so the preview cannot drift from the
    // thing it previews.
    const Screen = dashboard.Screen;
    return (
      <div className="w-full overflow-hidden p-2" style={{ height }}>
        <Screen />
      </div>
    );
  }

  // The widget grid is responsive: it scales its rows to fill the stage
  // exactly like a real overlay window fills its bounds, so the preview is
  // true-to-life with no dead space or clipped bottom.
  return (
    <div className="w-full overflow-hidden p-2" style={{ height }}>
      <DashboardGrid layout={layout} data={data} />
    </div>
  );
}
