/**
 * Per-overlay / per-widget windows + browser links + open-window persistence.
 *
 * A single overlay is rendered on its own by loading the app with `?overlay=<id>`
 * and a single telemetry widget with `?widget=<id>` (see `main.tsx`). Those URLs
 * power three things:
 *   - **Separate desktop windows** — on Tauri we spawn a real always-on-top
 *     `WebviewWindow`; in a plain browser we fall back to a new tab.
 *   - **Browser-source links** — copy the URL into OBS (or any browser).
 *   - **The full app link** — the bare origin, for "see everything".
 *
 * We also remember which of these windows are open (in localStorage) so the app
 * can re-open them on the next launch.
 */

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Query-param keys that select a single overlay / widget to render alone. */
export const OVERLAY_PARAM = "overlay";
export const WIDGET_PARAM = "widget";

/** Read a param from a URL `search` and (as a fallback) its `hash`. */
function readParam(
  search: string | undefined,
  hash: string | undefined,
  key: string
): string | null {
  const fromSearch = new URLSearchParams(search ?? "").get(key);
  if (fromSearch && fromSearch.trim()) return fromSearch.trim();

  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw) return null;
  const query = raw.replace(/^[/?]+/, "");
  const fromHash = new URLSearchParams(query).get(key);
  if (fromHash && fromHash.trim()) return fromHash.trim();
  return null;
}

/**
 * Extract the requested overlay id from a URL's `search` and `hash` parts.
 *
 * Pure and side-effect free so it can be unit-tested without a DOM. We accept
 * several shapes because the same deep link has to survive very different
 * hosts — the Tauri `tauri.localhost` webview, a Vite dev server, a static
 * export, and OBS's embedded browser (which is picky about how it forwards a
 * URL):
 *
 *   - `?overlay=dashboard`         — query string (canonical)
 *   - `#overlay=dashboard`         — hash query (survives static hosting)
 *   - `#?overlay=dashboard`        — hash + query
 *   - `#/dashboard` or `#dashboard`— bare hash route (shortest to type)
 */
export function parseOverlayId(
  search: string | undefined,
  hash: string | undefined
): string | null {
  const fromParam = readParam(search, hash, OVERLAY_PARAM);
  if (fromParam) return fromParam;

  // Bare fragment route: `#/dashboard` or `#dashboard` (overlay only).
  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw) return null;
  const bare = raw.replace(/^[/#]+/, "").trim();
  if (bare && !bare.includes("=") && !bare.includes("&")) return bare;
  return null;
}

/** Extract the requested single-widget id (`?widget=<id>`), or null. */
export function parseWidgetId(
  search: string | undefined,
  hash: string | undefined
): string | null {
  return readParam(search, hash, WIDGET_PARAM);
}

/** Read the requested overlay id from the current URL, or `null`. */
export function getOverlayRoute(): string | null {
  if (typeof window === "undefined") return null;
  return parseOverlayId(window.location.search, window.location.hash);
}

/** Read the requested single-widget id from the current URL, or `null`. */
export function getWidgetRoute(): string | null {
  if (typeof window === "undefined") return null;
  return parseWidgetId(window.location.search, window.location.hash);
}

/**
 * True when this window is rendering a single overlay or widget in isolation —
 * i.e. it should paint with a transparent (overlay) background.
 */
export function isSingleView(): boolean {
  return getOverlayRoute() !== null || getWidgetRoute() !== null;
}

/** Absolute URL for the whole app (dock + all overlays). */
export function appUrl(): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}`;
}

/** Absolute URL that renders a single overlay in isolation. */
export function overlayUrl(id: string): string {
  return `${appUrl()}?${OVERLAY_PARAM}=${encodeURIComponent(id)}`;
}

/** Absolute URL that renders a single telemetry widget in isolation. */
export function widgetUrl(id: string): string {
  return `${appUrl()}?${WIDGET_PARAM}=${encodeURIComponent(id)}`;
}

function relativeUrl(param: string, id: string): string {
  return `${window.location.pathname}?${param}=${encodeURIComponent(id)}`;
}

// ── open-window persistence ───────────────────────────────────────────────────

export type WindowKind = "overlay" | "widget";

export interface RememberedWindow {
  kind: WindowKind;
  id: string;
  label: string;
}

const OPEN_WINDOWS_KEY = "telemetrylab.open-windows.v1";

/** The set of overlay/widget windows the user had open, for restore-on-launch. */
export function getRememberedWindows(): RememberedWindow[] {
  try {
    const raw = localStorage.getItem(OPEN_WINDOWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RememberedWindow[];
    return Array.isArray(parsed)
      ? parsed.filter((w) => w && (w.kind === "overlay" || w.kind === "widget") && w.id)
      : [];
  } catch {
    return [];
  }
}

function saveRemembered(list: RememberedWindow[]): void {
  try {
    localStorage.setItem(OPEN_WINDOWS_KEY, JSON.stringify(list));
  } catch {
    // Storage may be unavailable (private mode); restore just won't work.
  }
}

/** Record a window as open (deduped by kind+id). */
export function rememberWindow(w: RememberedWindow): void {
  const list = getRememberedWindows();
  if (list.some((x) => x.kind === w.kind && x.id === w.id)) return;
  saveRemembered([...list, w]);
}

/** Forget a window (called when the user explicitly closes it). */
export function forgetWindow(kind: WindowKind, id: string): void {
  saveRemembered(
    getRememberedWindows().filter((x) => !(x.kind === kind && x.id === id))
  );
}

// ── spawning windows ──────────────────────────────────────────────────────────

async function openWindow(
  kind: WindowKind,
  param: string,
  id: string,
  label: string
): Promise<void> {
  rememberWindow({ kind, id, label });

  if (isTauri) {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const winLabel = `${kind}-${id}`;

      const existing = await WebviewWindow.getByLabel(winLabel);
      if (existing) {
        await existing.setFocus();
        return;
      }

      const win = new WebviewWindow(winLabel, {
        url: relativeUrl(param, id),
        title: `${label} — iRacing Telemetry`,
        width: kind === "widget" ? 320 : 640,
        height: kind === "widget" ? 220 : 420,
        minWidth: kind === "widget" ? 160 : 320,
        minHeight: kind === "widget" ? 120 : 200,
        decorations: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
      });
      win.once("tauri://error", (e) => {
        // eslint-disable-next-line no-console
        console.error(`[overlay] failed to open ${winLabel}:`, e);
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[overlay] WebviewWindow unavailable:", err);
    }
    return;
  }

  // Browser / dev fallback: a new tab pointed at the single-view URL.
  const url = kind === "widget" ? widgetUrl(id) : overlayUrl(id);
  window.open(url, `${kind}-${id}`, "noopener");
}

/** Open a whole overlay in its own always-on-top window (or a browser tab). */
export function openOverlayWindow(id: string, label: string): Promise<void> {
  return openWindow("overlay", OVERLAY_PARAM, id, label);
}

/** Open a single telemetry widget in its own always-on-top window. */
export function openWidgetWindow(id: string, label: string): Promise<void> {
  return openWindow("widget", WIDGET_PARAM, id, label);
}

/**
 * Re-open every window the user had open last session. Call once from the main
 * window on launch (Tauri only). Existing windows are focused, not duplicated.
 */
export async function restoreOpenWindows(): Promise<void> {
  if (!isTauri) return;
  for (const w of getRememberedWindows()) {
    if (w.kind === "widget") await openWidgetWindow(w.id, w.label);
    else await openOverlayWindow(w.id, w.label);
  }
}

/** Close the current single-view window and forget it (user-initiated close). */
export async function closeCurrentWindow(
  kind: WindowKind,
  id: string
): Promise<void> {
  forgetWindow(kind, id);
  if (!isTauri) {
    window.close();
    return;
  }
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch {
    window.close();
  }
}
