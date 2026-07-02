import { useEffect, useRef, useState } from "react";
import { Download, Trash2, Activity } from "lucide-react";
import { useBridgeStore } from "../../stores/useBridgeStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { useTelemetryStore } from "../../stores/useTelemetryStore";
import {
  type LogEntry,
  type LogLevel,
  getLog,
  clearLog,
  subscribeLog,
} from "../../lib/debugLog";

function useLogs() {
  const [, tick] = useState(0);
  useEffect(() => subscribeLog(() => tick((n) => n + 1)), []);
  return [...getLog()];
}

export function DebugPanel() {
  const logEndRef = useRef<HTMLDivElement>(null);
  const logs = useLogs();
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);

  const { socketConnected, iracingActive, protocolVersion } = useBridgeStore();

  // Session summary
  const session = useSessionStore((s) => s.session);

  // Telemetry snapshot
  const telemetry = useTelemetryStore((s) => s.telemetry);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const filtered = filter === "all"
    ? logs
    : logs.filter((l) => l.level === filter);

  const exportLogs = () => {
    const text = logs
      .map((l) => `[${new Date(l.ts).toISOString()}] [${l.level.toUpperCase()}] ${l.msg}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `telemetrylab-debug-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Connection status */}
      <section>
        <SectionLabel>Connection</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          <StatusTile
            label="Bridge WS"
            value={socketConnected ? "Connected" : "Disconnected"}
            ok={socketConnected}
          />
          <StatusTile
            label="iRacing"
            value={iracingActive ? "Active" : "Inactive"}
            ok={iracingActive}
          />
          <StatusTile
            label="Protocol"
            value={protocolVersion != null ? `v${protocolVersion}` : "—"}
            ok={protocolVersion != null}
          />
        </div>
      </section>

      {/* Session snapshot */}
      <section>
        <SectionLabel>Session Snapshot</SectionLabel>
        {session ? (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs">
            <KV k="Type" v={session.sessionType} />
            <KV k="State" v={session.sessionStateLabel} />
            <KV k="Track" v={`${session.track.name} – ${session.track.config}`} />
            <KV k="Drivers" v={String(session.drivers.length)} />
            <KV k="Classes" v={String(session.classes.length)} />
            <KV k="SOF" v={session.sof > 0 ? String(session.sof) : "—"} />
            {session.flags.length > 0 && (
              <KV k="Flags" v={session.flags.join(", ")} />
            )}
          </div>
        ) : (
          <EmptyState msg="No active session." />
        )}
      </section>

      {/* Telemetry snapshot */}
      {telemetry && (
        <section>
          <SectionLabel>Telemetry (last frame)</SectionLabel>
          <div className="grid grid-cols-4 gap-x-4 gap-y-1 rounded-lg border border-border bg-surface-2 px-3 py-2.5 text-xs">
            <KV k="Speed" v={`${telemetry.speedKmh ?? "—"} km/h`} />
            <KV k="RPM" v={String(Math.round(telemetry.rpm ?? 0))} />
            <KV k="Gear" v={String(telemetry.gear ?? "—")} />
            <KV k="Throttle" v={`${Math.round((telemetry.throttle ?? 0) * 100)}%`} />
            <KV k="Brake" v={`${Math.round((telemetry.brake ?? 0) * 100)}%`} />
            <KV k="Fuel" v={`${(telemetry.fuelLevel ?? 0).toFixed(1)} L`} />
            <KV k="Lap" v={String(telemetry.lap ?? "—")} />
            <KV k="Pos" v={String(telemetry.playerCarPosition ?? "—")} />
          </div>
        </section>
      )}

      {/* Log viewer */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center gap-2">
          <SectionLabelInline>Logs</SectionLabelInline>
          <span className="text-[10px] text-muted">({logs.length} entries)</span>

          <div className="ml-auto flex items-center gap-1">
            {(["all", "debug", "info", "warn", "error"] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => setFilter(lv)}
                className={[
                  "rounded px-2 py-0.5 text-[10px] uppercase transition-colors",
                  filter === lv
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:text-text",
                ].join(" ")}
              >
                {lv}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 border-l border-border pl-2">
            <button
              type="button"
              onClick={() => setAutoScroll((a) => !a)}
              title={autoScroll ? "Disable auto-scroll" : "Enable auto-scroll"}
              className={[
                "grid size-6 place-items-center rounded text-muted transition-colors hover:text-text",
                autoScroll && "bg-accent/10 text-accent",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Activity className="size-3" />
            </button>
            <button
              type="button"
              onClick={clearLog}
              title="Clear logs"
              className="grid size-6 place-items-center rounded text-muted transition-colors hover:text-text"
            >
              <Trash2 className="size-3" />
            </button>
            <button
              type="button"
              onClick={exportLogs}
              title="Export logs"
              className="grid size-6 place-items-center rounded text-muted transition-colors hover:text-text"
            >
              <Download className="size-3" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border bg-bg font-mono">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted">
              No log entries yet. Bridge messages will appear here.
            </div>
          ) : (
            <div className="p-2 text-[11px] leading-5">
              {filtered.map((l, i) => (
                <LogLine key={i} entry={l} />
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      </section>
    </div>
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

function SectionLabelInline({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
      {children}
    </span>
  );
}

function StatusTile({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className="inline-block size-1.5 rounded-full"
          style={{ background: ok ? "var(--color-accent)" : "var(--color-muted)" }}
        />
        <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
      </div>
      <span
        className="text-xs font-medium"
        style={{ color: ok ? "var(--color-text)" : "var(--color-muted)" }}
      >
        {value}
      </span>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-muted">
        {k}
      </span>
      <span className="truncate text-text">{v}</span>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-4 text-center text-xs text-muted">
      {msg}
    </div>
  );
}

const LEVEL_COLOR: Record<LogEntry["level"], string> = {
  debug: "var(--color-muted)",
  info: "var(--color-text)",
  warn: "var(--color-warning)",
  error: "var(--color-danger)",
};

function LogLine({ entry }: { entry: LogEntry }) {
  const time = new Date(entry.ts).toTimeString().slice(0, 8);
  return (
    <div className="flex gap-2">
      <span className="shrink-0 text-muted">{time}</span>
      <span
        className="w-9 shrink-0 uppercase"
        style={{ color: LEVEL_COLOR[entry.level] }}
      >
        {entry.level.slice(0, 4)}
      </span>
      <span style={{ color: LEVEL_COLOR[entry.level] }}>{entry.msg}</span>
    </div>
  );
}
