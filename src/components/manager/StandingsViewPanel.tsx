/**
 * View options for the standings overlay — how the field is grouped, and whether
 * the screen follows the player's row.
 *
 * These used to be segmented buttons on the standings screen's own title bar.
 * The timing screens carry no controls (they are read at a glance while the user
 * is driving), so their settings live here, on the surface built for configuring.
 * Writes to {@link useStandingsUiStore}, which persists and broadcasts over the
 * bus, so an open standings overlay window updates live.
 */

import { Layers, List } from "lucide-react";
import {
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
  const followPlayer = useStandingsUiStore((s) => s.followPlayer);
  const setFollowPlayer = useStandingsUiStore((s) => s.setFollowPlayer);
  const showSessionStrip = useStandingsUiStore((s) => s.showSessionStrip);
  const setShowSessionStrip = useStandingsUiStore((s) => s.setShowSessionStrip);

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

      <label className="flex cursor-pointer items-center gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong">
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-text">
            Follow my row
          </span>
          <span className="block text-[11px] text-faint">
            Keep your car scrolled into view as positions change.
          </span>
        </div>
        <ToggleSwitch checked={followPlayer} onChange={setFollowPlayer} />
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
    </div>
  );
}
