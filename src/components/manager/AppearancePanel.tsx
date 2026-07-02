import { THEMES, getTheme } from "../../themes";
import {
  useOverlayConfigStore,
  type OverlayAppearance,
  DEFAULT_APPEARANCE,
} from "../../stores/useOverlayConfigStore";

interface AppearancePanelProps {
  overlayId: string;
}

export function AppearancePanel({ overlayId }: AppearancePanelProps) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance } = settings;
  const globalThemeId = store.globalSettings.themeId;

  const effectiveThemeId = appearance.themeId ?? globalThemeId;
  const effectiveTheme = getTheme(effectiveThemeId);

  return (
    <div className="space-y-6">
      {/* Theme picker */}
      <section>
        <SectionLabel>Color Theme</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map((t) => {
            const isActive = effectiveThemeId === t.id;
            const isGlobalInherited = !appearance.themeId && t.id === globalThemeId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  store.setOverlayTheme(
                    overlayId,
                    t.id === globalThemeId && !appearance.themeId
                      ? null
                      : t.id
                  )
                }
                className={[
                  "relative flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface-2 hover:border-border-strong",
                ].join(" ")}
              >
                {/* Color swatch */}
                <span
                  className="size-7 shrink-0 rounded-md border border-white/10"
                  style={{
                    background: `linear-gradient(135deg, ${t.colors.bg} 40%, ${t.colors.accent} 100%)`,
                  }}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-text">
                    {t.name}
                  </span>
                  <span className="block truncate text-[10px] text-muted">
                    {t.description}
                  </span>
                </span>
                {isGlobalInherited && (
                  <span className="ml-auto shrink-0 rounded bg-surface px-1 text-[9px] uppercase tracking-wide text-muted">
                    global
                  </span>
                )}
                {isActive && !isGlobalInherited && appearance.themeId && (
                  <span
                    className="absolute right-2 top-2 size-2 rounded-full"
                    style={{ background: effectiveTheme.colors.accent }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {appearance.themeId && (
          <button
            type="button"
            onClick={() => store.setOverlayTheme(overlayId, null)}
            className="mt-2 text-[11px] text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Reset to global theme ({getTheme(globalThemeId).name})
          </button>
        )}
      </section>

      {/* Appearance sliders */}
      <section className="space-y-4">
        <SectionLabel>Adjustments</SectionLabel>

        <SliderRow
          label="Saturation"
          value={appearance.saturation}
          min={0}
          max={200}
          defaultValue={DEFAULT_APPEARANCE.saturation}
          unit="%"
          onChange={(v) => store.setOverlaySaturation(overlayId, v)}
          accentColor={effectiveTheme.colors.accent}
        />
        <SliderRow
          label="Brightness"
          value={appearance.brightness}
          min={0}
          max={200}
          defaultValue={DEFAULT_APPEARANCE.brightness}
          unit="%"
          onChange={(v) => store.setOverlayBrightness(overlayId, v)}
          accentColor={effectiveTheme.colors.accent}
        />
        <SliderRow
          label="Opacity"
          value={appearance.opacity}
          min={0}
          max={100}
          defaultValue={DEFAULT_APPEARANCE.opacity}
          unit="%"
          onChange={(v) => store.setOverlayOpacity(overlayId, v)}
          accentColor={effectiveTheme.colors.accent}
        />

        {isModified(appearance) && (
          <button
            type="button"
            onClick={() => {
              store.setOverlaySaturation(overlayId, DEFAULT_APPEARANCE.saturation);
              store.setOverlayBrightness(overlayId, DEFAULT_APPEARANCE.brightness);
              store.setOverlayOpacity(overlayId, DEFAULT_APPEARANCE.opacity);
            }}
            className="text-[11px] text-muted underline-offset-2 hover:text-text hover:underline"
          >
            Reset adjustments to defaults
          </button>
        )}
      </section>

      {/* Live preview swatch */}
      <section>
        <SectionLabel>Preview</SectionLabel>
        <div
          className="overflow-hidden rounded-lg border border-border"
          style={{
            filter: `saturate(${appearance.saturation}%) brightness(${appearance.brightness}%)`,
            opacity: appearance.opacity / 100,
          }}
        >
          <PreviewCard theme={effectiveTheme} />
        </div>
        <p className="mt-1.5 text-[10px] text-muted">
          Preview shows the combined effect of theme + adjustments.
        </p>
      </section>
    </div>
  );
}

function isModified(a: OverlayAppearance): boolean {
  return (
    a.saturation !== DEFAULT_APPEARANCE.saturation ||
    a.brightness !== DEFAULT_APPEARANCE.brightness ||
    a.opacity !== DEFAULT_APPEARANCE.opacity
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </p>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  defaultValue,
  unit,
  onChange,
  accentColor,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  unit: string;
  onChange: (v: number) => void;
  accentColor: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text">{label}</span>
        <div className="flex items-center gap-2">
          {value !== defaultValue && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="text-[10px] text-muted hover:text-text"
              title="Reset"
            >
              ↺
            </button>
          )}
          <span className="w-10 text-right text-xs tabular-nums text-muted">
            {value}
            {unit}
          </span>
        </div>
      </div>
      <div className="relative h-1.5 rounded-full bg-surface-2">
        {/* Filled track */}
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-[width]"
          style={{ width: `${pct}%`, background: accentColor }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        {/* Thumb */}
        <div
          className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct}%` }}
        >
          <div
            className="size-3 rounded-full border-2 border-bg shadow"
            style={{ background: accentColor }}
          />
        </div>
      </div>
    </div>
  );
}

import type { Theme } from "../../themes";

function PreviewCard({ theme }: { theme: Theme }) {
  const c = theme.colors;
  return (
    <div
      className="p-3 text-xs"
      style={{
        background: c.surface,
        color: c.text,
        fontFamily: "ui-monospace, monospace",
      }}
    >
      <div
        className="mb-2 flex items-center gap-2 border-b pb-2 text-[10px] uppercase tracking-wider"
        style={{ borderColor: c.border, color: c.muted }}
      >
        <span
          className="inline-block size-1.5 rounded-full"
          style={{ background: c.accent }}
        />
        {theme.name} · Live
      </div>
      <div className="flex gap-4">
        <StatPreview label="SPEED" value="212" unit="km/h" accent={c.accent} text={c.text} muted={c.muted} />
        <StatPreview label="GEAR" value="6" unit="" accent={c.accent} text={c.text} muted={c.muted} />
        <StatPreview label="FUEL" value="18.4" unit="L" accent={c.accent} text={c.text} muted={c.muted} />
        <StatPreview label="LAP" value="1:42.3" unit="" accent={c.accent} text={c.text} muted={c.muted} />
      </div>
    </div>
  );
}

function StatPreview({
  label,
  value,
  unit,
  accent,
  text,
  muted,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
  text: string;
  muted: string;
}) {
  return (
    <div>
      <div className="text-[9px] uppercase tracking-wider" style={{ color: muted }}>
        {label}
      </div>
      <div className="text-sm font-semibold" style={{ color: accent }}>
        {value}
        {unit && (
          <span className="ml-0.5 text-[10px] font-normal" style={{ color: text }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
