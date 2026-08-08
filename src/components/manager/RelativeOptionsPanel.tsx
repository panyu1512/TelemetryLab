/**
 * Options for the relative overlay — car brand icons and driver country flags.
 * Writes to {@link useRelativeUiStore}, which persists and broadcasts over the
 * window bus, so an open relative overlay window updates live.
 */

import {
  RELATIVE_WINDOW_MAX,
  RELATIVE_WINDOW_MIN,
  useRelativeUiStore,
} from "../../stores/useRelativeUiStore";
import { ToggleSwitch } from "../ui/controls";

export function RelativeOptionsPanel() {
  const showBrand = useRelativeUiStore((s) => s.showBrand);
  const showCountry = useRelativeUiStore((s) => s.showCountry);
  const windowSize = useRelativeUiStore((s) => s.windowSize);
  const setShowBrand = useRelativeUiStore((s) => s.setShowBrand);
  const setShowCountry = useRelativeUiStore((s) => s.setShowCountry);
  const setWindowSize = useRelativeUiStore((s) => s.setWindowSize);
  const showSessionStrip = useRelativeUiStore((s) => s.showSessionStrip);
  const setShowSessionStrip = useRelativeUiStore((s) => s.setShowSessionStrip);
  const showColumnLabels = useRelativeUiStore((s) => s.showColumnLabels);
  const setShowColumnLabels = useRelativeUiStore((s) => s.setShowColumnLabels);

  return (
    <div className="space-y-2">
      <OptionRow
        label="Car brand"
        description="Show the manufacturer icon next to each driver."
        checked={showBrand}
        onChange={setShowBrand}
      />
      <OptionRow
        label="Country flag"
        description="Show each driver's country flag."
        checked={showCountry}
        onChange={setShowCountry}
      />
      <OptionRow
        label="Session strip"
        description="Lap, time left, incidents, temperatures, SoF and the clock, above the field."
        checked={showSessionStrip}
        onChange={setShowSessionStrip}
      />
      <OptionRow
        label="Column labels"
        description="Name each column once, in the first row. Off once you know them."
        checked={showColumnLabels}
        onChange={setShowColumnLabels}
      />

      <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text">
            Cars per side
          </span>
          <span className="block text-[11px] text-faint">
            How many cars to show ahead and behind you.
          </span>
        </div>
        <input
          type="range"
          min={RELATIVE_WINDOW_MIN}
          max={RELATIVE_WINDOW_MAX}
          step={1}
          value={windowSize}
          onChange={(e) => setWindowSize(Number(e.target.value))}
          className="w-28"
        />
        <span className="tnum w-6 text-right text-xs font-semibold text-text">
          {windowSize}
        </span>
      </div>
    </div>
  );
}

function OptionRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong">
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-text">{label}</span>
        <span className="block text-[11px] text-faint">{description}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </label>
  );
}
