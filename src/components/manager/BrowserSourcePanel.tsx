import { useState } from "react";
import { Copy, Check, ExternalLink, Globe } from "lucide-react";
import { DASHBOARDS } from "../../dashboards/registry";
import { appUrl, overlayUrl } from "../../lib/overlayWindows";

interface BrowserSourcePanelProps {
  overlayId: string;
}

/**
 * "See it in the browser" — real, copy-pasteable links.
 *
 * Every overlay can be viewed on its own via `?overlay=<id>`, and the whole app
 * (dock + all overlays) via the bare app URL. These links are built from the
 * address the app is actually served on, so they work in any browser and as an
 * OBS Browser Source whenever that address is reachable (the dev server or a
 * hosted build).
 */
export function BrowserSourcePanel({ overlayId }: BrowserSourcePanelProps) {
  const isHttp =
    typeof window !== "undefined" && window.location.protocol.startsWith("http");

  return (
    <div className="space-y-6">
      {/* This overlay */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          This Overlay
        </p>
        <p className="mb-3 text-xs text-muted">
          Opens just this overlay, full-screen and on its own. Paste it into a
          browser tab or into OBS → Sources → Browser Source.
        </p>
        <CopyableUrl url={overlayUrl(overlayId)} />
      </section>

      {/* Whole app */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Everything
        </p>
        <p className="mb-3 text-xs text-muted">
          The full app — dock plus every overlay — so you can navigate between
          them in the browser.
        </p>
        <CopyableUrl url={appUrl()} />
      </section>

      {/* Per-overlay list */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          All Overlays
        </p>
        <div className="space-y-1.5">
          {DASHBOARDS.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] text-muted">
                {d.label}
              </span>
              <CopyableUrl url={overlayUrl(d.id)} compact />
            </div>
          ))}
        </div>
      </section>

      {/* Context note */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
        <Globe className="mt-0.5 size-3.5 shrink-0" />
        {isHttp ? (
          <span>
            These point at{" "}
            <code className="text-text">{window.location.host}</code> — reachable
            from any browser on this machine (and others on your network if the
            server binds to your LAN address).
          </span>
        ) : (
          <span>
            You're viewing the packaged desktop app, so these links resolve to
            its internal address. To open overlays in a real browser, run the web
            build (the dev server or a hosted deployment) and copy the links from
            there.
          </span>
        )}
      </div>
    </div>
  );
}

// ── CopyableUrl ───────────────────────────────────────────────────────────────

function CopyableUrl({
  url,
  compact = false,
}: {
  url: string;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be blocked (insecure context); ignore and still flash.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={[
        "flex items-center overflow-hidden rounded-md border border-border bg-surface-2 transition-colors hover:border-border-strong",
        compact ? "h-7" : "h-9",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1 overflow-hidden px-2.5">
        <span
          className={[
            "block truncate font-mono text-muted",
            compact ? "text-[10px]" : "text-xs",
          ].join(" ")}
        >
          {url}
        </span>
      </div>
      <div className="flex shrink-0 items-center border-l border-border">
        <button
          type="button"
          onClick={copy}
          title="Copy URL"
          className={[
            "grid place-items-center border-r border-border text-muted transition-colors hover:bg-surface hover:text-text",
            compact ? "h-7 w-7" : "h-9 w-9",
          ].join(" ")}
        >
          {copied ? (
            <Check className="size-3 text-accent" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
        <button
          type="button"
          onClick={() => window.open(url, "_blank", "noopener")}
          title="Open in browser"
          className={[
            "grid place-items-center text-muted transition-colors hover:bg-surface hover:text-text",
            compact ? "h-7 w-7" : "h-9 w-9",
          ].join(" ")}
        >
          <ExternalLink className="size-3" />
        </button>
      </div>
    </div>
  );
}
