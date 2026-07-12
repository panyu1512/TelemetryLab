import { Crosshair, Layers, List } from "lucide-react";
import { useSessionStore } from "../../stores/useSessionStore";
import { useStandingsMeta } from "../../stores/useStandingsStore";
import { useStandingsUiStore } from "../../stores/useStandingsUiStore";
import { lapTime } from "../../lib/format";

/** Pick a representative flag colour from the active session flags. */
function flagColor(flags: string[]): string | null {
  if (flags.includes("red")) return "var(--color-danger)";
  if (flags.some((f) => f.startsWith("yellow") || f.includes("caution")))
    return "var(--color-warning)";
  if (flags.includes("checkered") || flags.includes("white")) return "#ffffff";
  if (flags.includes("green")) return "var(--color-accent)";
  return null;
}

function fmtRemain(seconds: number | null, laps: number | null): string {
  if (laps != null) return `${laps} laps left`;
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The screen's title/control bar: what session this is, the flag state, the
 * field-wide fastest lap, and the view controls (class vs flat grouping,
 * follow-player). Reads only low-frequency stores, so it is cheap.
 */
export function StandingsHeader() {
  const session = useSessionStore((s) => s.session);
  const meta = useStandingsMeta();
  const grouping = useStandingsUiStore((s) => s.grouping);
  const setGrouping = useStandingsUiStore((s) => s.setGrouping);
  const followPlayer = useStandingsUiStore((s) => s.followPlayer);
  const toggleFollowPlayer = useStandingsUiStore((s) => s.toggleFollowPlayer);

  const flags = session?.flags ?? [];
  const fc = flagColor(flags);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        {fc && (
          <span
            className="size-2.5 rounded-full"
            style={{ background: fc, boxShadow: `0 0 8px ${fc}` }}
          />
        )}
        <span className="text-sm font-semibold tracking-tight text-text">
          {session?.sessionType || "Session"}
        </span>
        <span className="text-xs text-faint">
          {session?.track.name ?? "—"}
          {session?.track.config ? ` · ${session.track.config}` : ""}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span title="Session remaining">
          {fmtRemain(
            session?.sessionTimeRemain ?? null,
            session?.sessionLapsRemain ?? null
          )}
        </span>
        {session?.sof ? <span>SOF {session.sof.toLocaleString()}</span> : null}
        {meta.overallBestLap != null && (
          <span
            className="tnum"
            style={{ color: "var(--color-sector-purple)" }}
            title="Fastest lap in the field"
          >
            ⚡ {lapTime(meta.overallBestLap)}
          </span>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <SegBtn
          active={grouping === "class"}
          onClick={() => setGrouping("class")}
          title="Group by class"
        >
          <Layers className="size-3.5" />
        </SegBtn>
        <SegBtn
          active={grouping === "overall"}
          onClick={() => setGrouping("overall")}
          title="Flat overall order"
        >
          <List className="size-3.5" />
        </SegBtn>
        <span className="mx-1 h-5 w-px bg-border" />
        <SegBtn
          active={followPlayer}
          onClick={toggleFollowPlayer}
          title="Follow the player's row"
        >
          <Crosshair className="size-3.5" />
        </SegBtn>
      </div>
    </div>
  );
}

function SegBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={`grid size-7 place-items-center rounded-ctl transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted hover:bg-surface-2 hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
