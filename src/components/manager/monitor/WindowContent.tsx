import { memo, useEffect, useRef } from "react";

import { getWidget } from "../../../dashboards/registry";
import { appearanceStyle, effectiveThemeId } from "../../../lib/overlayVisibility";
import { useOverlayConfigStore } from "../../../stores/useOverlayConfigStore";
import { useTelemetryStore } from "../../../stores/useTelemetryStore";
import { applyTheme, getTheme } from "../../../themes";
import { RealOverlay, WidgetPreviewCard } from "../PreviewCanvas";
import type { LayoutTarget } from "./targets";

/**
 * What a window really shows, drawn at its real size in CSS px and scaled
 * onto the editor canvas: the same overlay / widget components the preview
 * and the windows render, with the overlay's own theme and appearance scoped
 * to this box. Never interactive — the box around it takes the pointer.
 */
export const WindowContent = memo(function WindowContent({
  target,
  width,
  height,
  scale,
}: {
  target: LayoutTarget;
  /** Layout size in CSS px (before `scale`). */
  width: number;
  height: number;
  /** Canvas scale: canvas px per CSS px. */
  scale: number;
}) {
  const store = useOverlayConfigStore();
  const { appearance } = store.getOverlaySettings(target.configId);
  const theme = getTheme(effectiveThemeId(appearance, store.globalSettings.themeId));
  const themeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (themeRef.current) applyTheme(theme, true, themeRef.current);
  }, [theme]);

  return (
    <div
      ref={themeRef}
      className="pointer-events-none absolute left-0 top-0 origin-top-left"
      style={{
        width,
        height,
        transform: `scale(${scale})`,
        ...appearanceStyle(appearance),
      }}
    >
      {target.kind === "overlay" ? (
        <RealOverlay overlayId={target.id} height={height} />
      ) : (
        <WidgetBody id={target.id} height={height} />
      )}
    </div>
  );
});

function WidgetBody({ id, height }: { id: string; height: number }) {
  const def = getWidget(id);
  const data = useTelemetryStore((s) => s.telemetry);
  if (!def) return null;
  return <WidgetPreviewCard def={def} data={data} height={height} />;
}
