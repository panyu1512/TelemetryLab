import { RotateCcw } from "lucide-react";
import { THEMES, getTheme } from "../../themes";
import {
  useOverlayConfigStore,
  type OverlayAppearance,
  DEFAULT_APPEARANCE,
} from "../../stores/useOverlayConfigStore";
import { SectionLabel } from "../ui/controls";

interface AppearancePanelProps {
  overlayId: string;
}

export function AppearancePanel({ overlayId }: AppearancePanelProps) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { appearance } = settings;
  const globalThemeId = store.globalSettings.themeId;

  const effectiveThemeId = appearance.themeId ?? globalThemeId;

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
                  "relative flex items-center gap-3 rounded-card border px-3 py-2.5 text-left transition-colors",
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border bg-surface hover:border-border-strong",
                ].join(" ")}
              >
                {/* Palette swatch: base surface + the three signal hues. */}
                <span
                  className="flex size-8 shrink-0 flex-col justify-end gap-1 overflow-hidden rounded-ctl border border-white/10 p-1"
                  style={{ background: t.colors.bg }}
                >
                  <span className="flex gap-0.5">
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: t.colors.primary }}
                    />
                    <span
                      className="h-1 flex-1 rounded-full"
                      style={{ background: t.colors.accent }}
                    />
                  </span>
                  <span
                    className="h-1.5 rounded-sm"
                    style={{ background: t.colors.surface2 }}
                  />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-text">
                    {t.name}
                  </span>
                  <span className="block truncate text-[10px] text-faint">
                    {t.description}
                  </span>
                </span>
                {isGlobalInherited && (
                  <span className="ml-auto shrink-0 rounded-full bg-surface-2 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-faint">
                    Global
                  </span>
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
        />
        <SliderRow
          label="Brightness"
          value={appearance.brightness}
          min={0}
          max={200}
          defaultValue={DEFAULT_APPEARANCE.brightness}
          unit="%"
          onChange={(v) => store.setOverlayBrightness(overlayId, v)}
        />
        <SliderRow
          label="Opacity"
          value={appearance.opacity}
          min={0}
          max={100}
          defaultValue={DEFAULT_APPEARANCE.opacity}
          unit="%"
          onChange={(v) => store.setOverlayOpacity(overlayId, v)}
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

function SliderRow({
  label,
  value,
  min,
  max,
  defaultValue,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text">{label}</span>
        <div className="flex items-center gap-2">
          {value !== defaultValue && (
            <button
              type="button"
              onClick={() => onChange(defaultValue)}
              className="grid size-4 place-items-center text-faint hover:text-text"
              title="Reset"
            >
              <RotateCcw className="size-3" />
            </button>
          )}
          <span className="w-10 text-right text-xs tabular-nums text-muted">
            {value}
            {unit}
          </span>
        </div>
      </div>
      {/* A plain native slider: the browser draws a proper filled track + a
          clearly-visible handle, themed via `accent-color`. */}
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: "var(--color-primary)" }}
        className="h-1.5 w-full cursor-pointer"
      />
    </div>
  );
}
