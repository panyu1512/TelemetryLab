/**
 * View options for the standings overlay — how the field is grouped, and how
 * many cars of each class it shows.
 *
 * These used to be segmented buttons on the standings screen's own title bar.
 * The timing screens carry no controls (they are read at a glance while the user
 * is driving), so their settings live here, on the surface built for configuring.
 * Writes to {@link useStandingsUiStore}, which persists and broadcasts over the
 * bus, so an open standings overlay window updates live.
 */

import { Layers, List } from "lucide-react";
import {
  STANDINGS_ROWS_MAX,
  STANDINGS_ROWS_MIN,
  useStandingsUiStore,
  type Grouping,
} from "../../stores/useStandingsUiStore";
import { ToggleSwitch } from "../ui/controls";

const GROUPINGS: {
  id: Grouping;
  label: string;
  description: string;
  icon: typeof Layers;
}[] = [
  {
    id: "class",
    label: "By class",
    description: "One group per car class, gap-separated.",
    icon: Layers,
  },
  {
    id: "overall",
    label: "Overall",
    description: "One flat table in overall order.",
    icon: List,
  },
];

export function StandingsViewPanel() {
  const grouping = useStandingsUiStore((s) => s.grouping);
  const setGrouping = useStandingsUiStore((s) => s.setGrouping);
  const showSessionStrip = useStandingsUiStore((s) => s.showSessionStrip);
  const setShowSessionStrip = useStandingsUiStore((s) => s.setShowSessionStrip);
  const showClassBands = useStandingsUiStore((s) => s.showClassBands);
  const setShowClassBands = useStandingsUiStore((s) => s.setShowClassBands);
  const showColumnLabels = useStandingsUiStore((s) => s.showColumnLabels);
  const setShowColumnLabels = useStandingsUiStore(
    (s) => s.setShowColumnLabels
  );
  const showWholeField = useStandingsUiStore((s) => s.showWholeField);
  const setShowWholeField = useStandingsUiStore((s) => s.setShowWholeField);
  const classRows = useStandingsUiStore((s) => s.classRows);
  const setClassRows = useStandingsUiStore((s) => s.setClassRows);
  const otherClassRows = useStandingsUiStore((s) => s.otherClassRows);
  const setOtherClassRows = useStandingsUiStore((s) => s.setOtherClassRows);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {GROUPINGS.map(({ id, label, description, icon: Icon }) => {
          const active = grouping === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setGrouping(id)}
              aria-pressed={active}
              className={[
                "flex items-center gap-2.5 rounded-card border px-3 py-2 text-left transition-colors",
                active
                  ? "border-primary/40 bg-primary/10"
                  : "border-border/60 bg-transparent hover:border-border",
              ].join(" ")}
            >
              <Icon
                className={`size-4 shrink-0 ${active ? "text-primary" : "text-muted"}`}
              />
              <span className="min-w-0">
                <span
                  className={[
                    "block truncate text-xs font-medium",
                    active ? "text-text" : "text-faint",
                  ].join(" ")}
                >
                  {label}
                </span>
                <span className="block truncate text-[11px] text-faint">
                  {description}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <RowCount
        label={grouping === "class" ? "Cars in your class" : "Cars shown"}
        description="The leaders, then the cars around you."
        value={classRows}
        onChange={setClassRows}
        disabled={showWholeField}
      />
      {grouping === "class" && (
        <RowCount
          label="Cars in other classes"
          description="The top of each class you are not in."
          value={otherClassRows}
          onChange={setOtherClassRows}
          disabled={showWholeField}
        />
      )}

      <label className="flex cursor-pointer items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text">
            Whole field
          </span>
          <span className="block text-[11px] text-faint">
            Every car in the session, shrunk to fit the window. Small in a big
            field.
          </span>
        </div>
        <ToggleSwitch checked={showWholeField} onChange={setShowWholeField} />
      </label>

      <label className="flex cursor-pointer items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text">
            Session strip
          </span>
          <span className="block text-[11px] text-faint">
            Lap, time left, incidents, temperatures, SoF and the clock, above
            the field.
          </span>
        </div>
        <ToggleSwitch
          checked={showSessionStrip}
          onChange={setShowSessionStrip}
        />
      </label>

      <label
        className={[
          "flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors",
          grouping === "class"
            ? "cursor-pointer hover:border-border-strong"
            : "cursor-not-allowed opacity-50",
        ].join(" ")}
      >
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text">
            Class bands
          </span>
          <span className="block text-[11px] text-faint">
            {grouping === "class"
              ? "Open each class with its car count, strength of field and fastest lap."
              : "Only available when the field is grouped by class."}
          </span>
        </div>
        <ToggleSwitch
          checked={showClassBands}
          onChange={setShowClassBands}
          disabled={grouping !== "class"}
        />
      </label>

      <label className="flex cursor-pointer items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text">
            Column labels
          </span>
          <span className="block text-[11px] text-faint">
            Name each column once, in the first row. Off once you know them.
          </span>
        </div>
        <ToggleSwitch
          checked={showColumnLabels}
          onChange={setShowColumnLabels}
        />
      </label>
    </div>
  );
}

/** A row-count slider, in the shape of the Relative's "Cars per side". */
function RowCount({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (n: number) => void;
  disabled: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5",
        disabled ? "opacity-50" : "",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-text">{label}</span>
        <span className="block text-[11px] text-faint">{description}</span>
      </div>
      <input
        type="range"
        min={STANDINGS_ROWS_MIN}
        max={STANDINGS_ROWS_MAX}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-28 disabled:cursor-not-allowed"
        aria-label={label}
      />
      <span className="tnum w-6 text-right text-xs font-semibold text-text">
        {value}
      </span>
    </div>
  );
}
