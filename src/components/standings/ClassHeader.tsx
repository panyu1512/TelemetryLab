import { Filter } from "lucide-react";
import type { ClassStanding } from "../../telemetry/types";
import { useDriver } from "../../stores/useSessionStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { lapTime } from "../../lib/format";
import { CLASS_HEADER_H } from "./constants";
import { CollapseChevron } from "./cells";

/**
 * A class band: colour stripe, class name, SOF, leader, lap count and car
 * count, with collapse + solo-filter controls. Absolutely positioned like the
 * rows so it participates in the same glide/virtualization layout.
 */
export function ClassHeader({
  group,
  top,
}: {
  group: ClassStanding;
  top: number;
}) {
  const collapsed = useStandingsUiStore((s) => !!s.collapsed[group.carClassId]);
  const classFilter = useStandingsUiStore((s) => s.classFilter);
  const toggleCollapsed = useStandingsUiStore((s) => s.toggleCollapsed);
  const setClassFilter = useStandingsUiStore((s) => s.setClassFilter);
  const leader = useDriver(group.leaderCarIdx ?? -1);
  const soloed = classFilter === group.carClassId;

  return (
    <div
      className="absolute inset-x-0 flex items-center gap-2 px-1"
      style={{ height: CLASS_HEADER_H, transform: `translateY(${top}px)` }}
    >
      <button
        type="button"
        onClick={() => toggleCollapsed(group.carClassId)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-surface-2"
        title={collapsed ? "Expand class" : "Collapse class"}
      >
        <span
          className="h-4 w-1 shrink-0 rounded-full"
          style={{ background: group.color }}
        />
        <span
          className="shrink-0 text-[13px] font-bold uppercase tracking-wide"
          style={{ color: group.color }}
        >
          {group.shortName || "Class"}
        </span>
        <span className="shrink-0 rounded-full bg-surface-2 px-1.5 text-[9px] font-medium uppercase text-muted">
          {group.carCount} cars
        </span>
        <span className="shrink-0 text-[10px] text-muted">
          SOF {group.sof.toLocaleString()}
        </span>
        {group.leaderLap != null && (
          <span className="shrink-0 text-[10px] text-muted">
            L{group.leaderLap}
          </span>
        )}
        {leader && (
          <span className="truncate text-[10px] text-muted">
            · {leader.userName}
          </span>
        )}
        {group.fastestLap != null && (
          <span
            className="shrink-0 text-[10px] tnum"
            style={{ color: "var(--color-sector-purple)" }}
            title="Class fastest lap"
          >
            {lapTime(group.fastestLap)}
          </span>
        )}
        <CollapseChevron collapsed={collapsed} />
      </button>

      <button
        type="button"
        onClick={() => setClassFilter(soloed ? null : group.carClassId)}
        aria-pressed={soloed}
        title={soloed ? "Show all classes" : "Show only this class"}
        className={`grid size-6 shrink-0 place-items-center rounded-ctl transition-colors ${
          soloed
            ? "bg-primary/15 text-primary"
            : "text-muted hover:bg-surface-2 hover:text-text"
        }`}
      >
        <Filter className="size-3" />
      </button>
    </div>
  );
}
