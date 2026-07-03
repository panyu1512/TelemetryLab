import { useState } from "react";
import { RefreshCw, Info } from "lucide-react";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { THEMES } from "../../themes";

export function GlobalSettingsPanel() {
  const store = useOverlayConfigStore();
  const { globalSettings } = store;

  return (
    <div className="space-y-6">
      {/* Appearance */}
      <section>
        <SectionLabel>Appearance</SectionLabel>
        <SettingsGroup>
          <LabeledField
            label="Global Theme"
            hint="Default color theme for every overlay. Individual overlays can override this in their Appearance tab."
          >
            <SelectInput
              value={globalSettings.themeId}
              options={THEMES.map((t) => ({ value: t.id, label: t.name }))}
              onChange={(v) => store.setGlobalTheme(v)}
            />
          </LabeledField>
        </SettingsGroup>
      </section>

      {/* Bridge connection */}
      <section>
        <SectionLabel>Telemetry Bridge</SectionLabel>
        <SettingsGroup>
          <LabeledField
            label="Bridge Endpoint"
            hint="WebSocket URL for the Python telemetry bridge."
          >
            <TextInput
              value={globalSettings.bridgeEndpoint}
              placeholder="ws://127.0.0.1:8765"
              onChange={(v) =>
                store.setGlobalSettings({ bridgeEndpoint: v })
              }
            />
          </LabeledField>

          <LabeledField
            label="Mock Data"
            hint="Drive the overlays with built-in synthetic telemetry when iRacing isn't connected — for offline dev, demos and screenshots."
          >
            <ToggleRow
              checked={globalSettings.mockDataEnabled}
              label={globalSettings.mockDataEnabled ? "On" : "Off"}
              onChange={(v) =>
                store.setGlobalSettings({ mockDataEnabled: v })
              }
            />
          </LabeledField>
        </SettingsGroup>
      </section>

      {/* HTTP server */}
      <section>
        <SectionLabel>HTTP Server (Browser Sources)</SectionLabel>
        <SettingsGroup>
          <LabeledField
            label="HTTP Server"
            hint="Serves overlay HTML pages for OBS browser sources."
          >
            <ToggleRow
              checked={globalSettings.httpServerEnabled}
              label={
                globalSettings.httpServerEnabled
                  ? "Enabled"
                  : "Disabled"
              }
              onChange={(v) =>
                store.setGlobalSettings({ httpServerEnabled: v })
              }
            />
          </LabeledField>

          <LabeledField
            label="Port"
            hint="Port for the local HTTP server (default 9999)."
          >
            <NumberInput
              value={globalSettings.httpServerPort}
              min={1024}
              max={65535}
              onChange={(v) =>
                store.setGlobalSettings({ httpServerPort: v })
              }
            />
          </LabeledField>

          <LabeledField
            label="Browser Sources"
            hint="Allow external tools (OBS) to access overlay endpoints."
          >
            <ToggleRow
              checked={globalSettings.browserSourcesEnabled}
              label={
                globalSettings.browserSourcesEnabled
                  ? "Enabled"
                  : "Disabled"
              }
              onChange={(v) =>
                store.setGlobalSettings({ browserSourcesEnabled: v })
              }
            />
          </LabeledField>
        </SettingsGroup>
      </section>

      {/* Auth key */}
      <section>
        <SectionLabel>Security</SectionLabel>
        <SettingsGroup>
          <LabeledField
            label="Auth Key"
            hint="Token appended to browser source URLs (?key=…). Regenerating invalidates all existing URLs."
          >
            <AuthKeyField />
          </LabeledField>
        </SettingsGroup>
      </section>

      {/* Debug */}
      <section>
        <SectionLabel>Debug</SectionLabel>
        <SettingsGroup>
          <LabeledField
            label="Log Level"
            hint="Controls verbosity of the telemetry bridge log output."
          >
            <SelectInput
              value={globalSettings.logLevel}
              options={[
                { value: "debug", label: "Debug (verbose)" },
                { value: "info", label: "Info (default)" },
                { value: "warn", label: "Warn" },
                { value: "error", label: "Error only" },
              ]}
              onChange={(v) =>
                store.setGlobalSettings({
                  logLevel: v as typeof globalSettings.logLevel,
                })
              }
            />
          </LabeledField>
        </SettingsGroup>
      </section>

      {/* Config info */}
      <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs text-muted">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Settings are saved automatically to localStorage and restored on next
          launch. Use profile export/import to back up your configuration.
        </span>
      </div>
    </div>
  );
}

// ── layout helpers ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </p>
  );
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {children}
    </div>
  );
}

function LabeledField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 bg-surface-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-text">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ── input primitives ──────────────────────────────────────────────────────────

function TextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-52 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text outline-none transition-colors placeholder:text-muted focus:border-accent"
    />
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-24 rounded-md border border-border bg-surface px-2.5 py-1 text-right text-xs text-text outline-none transition-colors focus:border-accent"
    />
  );
}

function SelectInput({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-text outline-none transition-colors focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} />
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

function AuthKeyField() {
  const [revealed, setRevealed] = useState(false);
  const store = useOverlayConfigStore();
  const key = store.globalSettings.authKey;

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-44 overflow-hidden rounded-md border border-border bg-surface px-2.5 py-1 text-xs">
        <span className="block truncate font-mono text-muted">
          {revealed ? key : "••••••••••••••••"}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] text-muted transition-colors hover:text-text"
      >
        {revealed ? "Hide" : "Show"}
      </button>
      <button
        type="button"
        onClick={store.regenerateAuthKey}
        title="Regenerate"
        className="grid size-[26px] place-items-center rounded-md border border-border bg-surface-2 text-muted transition-colors hover:text-text"
      >
        <RefreshCw className="size-3" />
      </button>
    </div>
  );
}
