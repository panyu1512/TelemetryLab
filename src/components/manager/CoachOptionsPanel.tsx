/**
 * Options for the coach overlay: the smallest loss worth a tip, how many tips
 * to show, and whether the lap strip and corner list sit under them.
 * Writes to {@link useCoachUiStore}, which persists and broadcasts over the
 * window bus, so an open coach overlay updates live.
 */

import {
  MIN_LOSS_MAX,
  MIN_LOSS_MIN,
  TIP_COUNT_MAX,
  TIP_COUNT_MIN,
} from "../../lib/coaching";
import { useCoachUiStore } from "../../stores/useCoachUiStore";
import { ToggleSwitch } from "../ui/controls";

export function CoachOptionsPanel() {
  const minLoss = useCoachUiStore((s) => s.minLoss);
  const setMinLoss = useCoachUiStore((s) => s.setMinLoss);
  const tipCount = useCoachUiStore((s) => s.tipCount);
  const setTipCount = useCoachUiStore((s) => s.setTipCount);
  const showLapStrip = useCoachUiStore((s) => s.showLapStrip);
  const setShowLapStrip = useCoachUiStore((s) => s.setShowLapStrip);
  const showCorners = useCoachUiStore((s) => s.showCorners);
  const setShowCorners = useCoachUiStore((s) => s.setShowCorners);

  return (
    <div className="space-y-2">
      <RangeRow
        label="Smallest loss worth a tip"
        description="Corners that lost less than this against your reference stay quiet."
        min={MIN_LOSS_MIN}
        max={MIN_LOSS_MAX}
        step={0.01}
        value={minLoss}
        onChange={setMinLoss}
        format={(v) => `${v.toFixed(2)} s`}
      />
      <RangeRow
        label="Tips per lap"
        description="The biggest losses first. One is the least distracting in a race."
        min={TIP_COUNT_MIN}
        max={TIP_COUNT_MAX}
        step={1}
        value={tipCount}
        onChange={setTipCount}
        format={(v) => String(v)}
      />
      <OptionRow
        label="Lap strip"
        description="The lap as one bar, each corner's stretch coloured by what it cost."
        checked={showLapStrip}
        onChange={setShowLapStrip}
      />
      <OptionRow
        label="Corner list"
        description="Every corner's loss or gain against the reference, with its cause."
        checked={showCorners}
        onChange={setShowCorners}
      />
    </div>
  );
}

function RangeRow({
  label,
  description,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  description: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-text">{label}</span>
        <span className="block text-small text-faint">{description}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28"
        aria-label={label}
      />
      <span className="tnum w-12 text-right text-xs font-semibold text-text">{format(value)}</span>
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
        <span className="block text-small text-faint">{description}</span>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} />
    </label>
  );
}
