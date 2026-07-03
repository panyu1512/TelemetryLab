/**
 * Per-overlay windows + browser links.
 *
 * A single overlay can be rendered on its own by loading the app with an
 * `?overlay=<id>` query param (see `main.tsx` → `OverlayWindow`). That same URL
 * powers three things:
 *   - **Separate desktop windows** — on Tauri we spawn a real always-on-top
 *     `WebviewWindow` per overlay; in a plain browser we fall back to a new tab.
 *   - **Browser-source links** — copy the URL into OBS (or any browser) to view
 *     one overlay in isolation.
 *   - **The full app link** — the bare origin, for "see everything in the
 *     browser".
 */

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Query-param key that selects a single overlay to render in isolation. */
export const OVERLAY_PARAM = "overlay";

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
  // 1. Canonical query string: ?overlay=<id>
  const fromSearch = new URLSearchParams(search ?? "").get(OVERLAY_PARAM);
  if (fromSearch && fromSearch.trim()) return fromSearch.trim();

  // 2. Anything after the '#'. Support both `#overlay=<id>` (a query living in
  //    the fragment) and a bare `#/<id>` / `#<id>` route.
  const raw = (hash ?? "").replace(/^#/, "");
  if (!raw) return null;

  const query = raw.replace(/^[/?]+/, "");
  const fromHashQuery = new URLSearchParams(query).get(OVERLAY_PARAM);
  if (fromHashQuery && fromHashQuery.trim()) return fromHashQuery.trim();

  // 3. Bare fragment route: `#/dashboard` or `#dashboard`. Ignore fragments
  //    that carry key=value pairs (handled above) so we never treat a stray
  //    query as an id.
  const bare = raw.replace(/^[/#]+/, "").trim();
  if (bare && !bare.includes("=") && !bare.includes("&")) return bare;

  return null;
}

/** Read the requested overlay id from the current URL, or `null`. */
export function getOverlayRoute(): string | null {
  if (typeof window === "undefined") return null;
  return parseOverlayId(window.location.search, window.location.hash);
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

/** Relative URL (path + query) — used when spawning a Tauri child window. */
function overlayRelativeUrl(id: string): string {
  return `${window.location.pathname}?${OVERLAY_PARAM}=${encodeURIComponent(id)}`;
}

/**
 * Open an overlay in its own window. On the desktop build this creates (or
 * focuses) a dedicated always-on-top Tauri window; in a browser it opens the
 * single-overlay URL in a new tab/window.
 */
export async function openOverlayWindow(
  id: string,
  label: string
): Promise<void> {
  if (isTauri) {
    try {
      const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
      const winLabel = `overlay-${id}`;

      const existing = await WebviewWindow.getByLabel(winLabel);
      if (existing) {
        await existing.setFocus();
        return;
      }

      const win = new WebviewWindow(winLabel, {
        url: overlayRelativeUrl(id),
        title: `${label} — iRacing Telemetry`,
        width: 640,
        height: 420,
        minWidth: 320,
        minHeight: 200,
        decorations: false,
        transparent: true,
        alwaysOnTop: true,
        resizable: true,
      });
      win.once("tauri://error", (e) => {
        // eslint-disable-next-line no-console
        console.error(`[overlay] failed to open window for ${id}:`, e);
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[overlay] WebviewWindow unavailable:", err);
    }
    return;
  }

  // Browser / dev fallback: a new tab pointed at the single-overlay URL.
  window.open(overlayUrl(id), `overlay-${id}`, "noopener,width=640,height=420");
}
