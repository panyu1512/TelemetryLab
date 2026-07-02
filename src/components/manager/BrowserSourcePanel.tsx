import { useState } from "react";
import { Copy, Check, ExternalLink, RefreshCw } from "lucide-react";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";

interface BrowserSourcePanelProps {
  overlayId: string;
}

export function BrowserSourcePanel({ overlayId }: BrowserSourcePanelProps) {
  const store = useOverlayConfigStore();
  const { globalSettings, activeProfileId, profiles } = store;

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  const profileName = activeProfile?.name ?? "default";

  const baseUrl = `http://127.0.0.1:${globalSettings.httpServerPort}`;
  const overlayUrl = `${baseUrl}/overlay/${overlayId}?profile=${encodeURIComponent(profileName)}&key=${globalSettings.authKey}`;

  return (
    <div className="space-y-6">
      {/* Server status */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          HTTP Server
        </p>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2.5">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="inline-block size-2 rounded-full"
              style={{
                background: globalSettings.httpServerEnabled
                  ? "var(--color-accent)"
                  : "var(--color-muted)",
              }}
            />
            <span className="text-text">
              {globalSettings.httpServerEnabled ? "Running" : "Stopped"} ·{" "}
            </span>
            <span className="font-mono text-muted">
              {baseUrl}
            </span>
          </div>
          <ToggleSwitch
            checked={globalSettings.httpServerEnabled}
            onChange={(v) => store.setGlobalSettings({ httpServerEnabled: v })}
          />
        </div>
        {!globalSettings.httpServerEnabled && (
          <p className="mt-1.5 text-[11px] text-muted">
            Enable the HTTP server in Global Settings to serve browser source
            URLs.
          </p>
        )}
      </section>

      {/* OBS URL */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Browser Source URL
        </p>
        <p className="mb-3 text-xs text-muted">
          Paste this URL into OBS Studio → Sources → Browser Source. The overlay
          renders in isolation and updates in real-time.
        </p>

        <CopyableUrl url={overlayUrl} disabled={!globalSettings.httpServerEnabled} />

        <div className="mt-3 space-y-1.5 text-[11px] text-muted">
          <p>
            • Profile: <code className="text-text">{profileName}</code> —
            switching profiles in this app updates the OBS overlay instantly.
          </p>
          <p>
            • Override settings via query params:{" "}
            <code className="text-text">?opacity=80&saturation=120</code>
          </p>
        </div>
      </section>

      {/* Auth key */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Auth Key
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-md border border-border bg-surface-2 px-3 py-2 font-mono text-xs text-muted">
            {globalSettings.authKey}
          </div>
          <button
            type="button"
            onClick={store.regenerateAuthKey}
            title="Regenerate key"
            className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">
          Regenerating invalidates all existing browser source URLs.
        </p>
      </section>

      {/* Additional overlays quick-list */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          All Overlay URLs
        </p>
        <div className="space-y-1.5">
          {["dashboard", "standings", "relative"].map((id) => {
            const url = `${baseUrl}/overlay/${id}?profile=${encodeURIComponent(profileName)}&key=${globalSettings.authKey}`;
            return (
              <div key={id} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[11px] capitalize text-muted">
                  {id}
                </span>
                <CopyableUrl
                  url={url}
                  compact
                  disabled={!globalSettings.httpServerEnabled}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── CopyableUrl ───────────────────────────────────────────────────────────────

function CopyableUrl({
  url,
  compact = false,
  disabled = false,
}: {
  url: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div
      className={[
        "flex items-center overflow-hidden rounded-md border transition-colors",
        disabled
          ? "border-border bg-surface-2 opacity-50"
          : "border-border bg-surface-2 hover:border-border-strong",
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
          disabled={disabled}
          onClick={copy}
          title="Copy URL"
          className={[
            "grid place-items-center border-r border-border text-muted transition-colors",
            compact ? "h-7 w-7" : "h-9 w-9",
            disabled ? "cursor-not-allowed" : "hover:bg-surface text-muted hover:text-text",
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
          disabled={disabled}
          onClick={() => !disabled && window.open(url, "_blank")}
          title="Open in browser"
          className={[
            "grid place-items-center text-muted transition-colors",
            compact ? "h-7 w-7" : "h-9 w-9",
            disabled ? "cursor-not-allowed" : "hover:bg-surface hover:text-text",
          ].join(" ")}
        >
          <ExternalLink className="size-3" />
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={[
        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
        checked ? "bg-accent" : "bg-surface border border-border-strong",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 size-4 rounded-full bg-bg transition-[left]",
          checked ? "left-[18px]" : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}
