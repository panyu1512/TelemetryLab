import { Eye, EyeOff } from "lucide-react";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { useSessionStore } from "../../stores/useSessionStore";
import { Checkbox, SectionLabel } from "../ui/controls";

interface VisibilityPanelProps {
  overlayId: string;
}

export function VisibilityPanel({ overlayId }: VisibilityPanelProps) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { visibility } = settings;

  const session = useSessionStore((s) => s.session);
  const sessionState = session?.sessionStateLabel ?? null;
  const flags = session?.flags ?? [];

  // Derive current live conditions
  const isReplay = sessionState === "Replay" || flags.includes("replay");
  const isLoneQualify = flags.includes("lone_qualify");

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Hide When</SectionLabel>
        <p className="mb-4 text-xs leading-relaxed text-muted">
          Overlay automatically hides (with a fade transition) when the selected
          conditions are active. Use the override toggle to force-show during
          testing.
        </p>

        <div className="space-y-2">
          <VisibilityRule
            label="Replay screen"
            description="Hides when iRacing enters replay/broadcast mode."
            checked={visibility.hideOnReplay}
            onChange={(v) =>
              store.setOverlayVisibility(overlayId, { hideOnReplay: v })
            }
            currentlyActive={isReplay}
          />
          <VisibilityRule
            label="In the pits"
            description="Hides while your car is on pit road or in the pit stall."
            checked={visibility.hideOnPits}
            onChange={(v) =>
              store.setOverlayVisibility(overlayId, { hideOnPits: v })
            }
            currentlyActive={false}
          />
          <VisibilityRule
            label="Lone qualify / first lap"
            description="Hides during lone-qualifying sessions or the out-lap before racing starts."
            checked={visibility.hideOnLoneQualify}
            onChange={(v) =>
              store.setOverlayVisibility(overlayId, {
                hideOnLoneQualify: v,
              })
            }
            currentlyActive={isLoneQualify}
          />
        </div>
      </section>

      {/* Current session state readout */}
      <section>
        <SectionLabel>Current Session</SectionLabel>
        {session ? (
          <div className="space-y-1.5 rounded-card border border-border bg-surface p-3 text-xs">
            <Row label="State" value={session.sessionStateLabel} />
            <Row label="Type" value={session.sessionType} />
            {flags.length > 0 && (
              <Row
                label="Flags"
                value={
                  <span className="flex flex-wrap gap-1">
                    {flags.map((f) => (
                      <FlagBadge key={f} flag={f} />
                    ))}
                  </span>
                }
              />
            )}
          </div>
        ) : (
          <div className="rounded-card border border-border bg-surface px-3 py-4 text-center text-xs text-faint">
            No active session · start iRacing or the mock bridge.
          </div>
        )}
      </section>

      {/* What would happen */}
      {session && (
        <VisibilityStatus overlayId={overlayId} />
      )}
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────────

function VisibilityRule({
  label,
  description,
  checked,
  onChange,
  currentlyActive,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  currentlyActive: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-card border border-border bg-surface px-3 py-2.5 transition-colors hover:border-border-strong">
      <span className="mt-0.5">
        <Checkbox checked={checked} onChange={onChange} />
      </span>
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium text-text">{label}</span>
          {currentlyActive && (
            <span className="whitespace-nowrap rounded-ctl bg-warning/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-warning">
              Active now
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-faint">
          {description}
        </span>
      </span>
      {/* `faint` is already the floor that clears 4.5:1 — thinning it further
          with an opacity modifier put this icon under 2:1. */}
      {checked ? (
        <EyeOff className="mt-0.5 size-3.5 shrink-0 text-muted" />
      ) : (
        <Eye className="mt-0.5 size-3.5 shrink-0 text-faint" />
      )}
    </label>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-14 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
      <span className="text-muted">{value}</span>
    </div>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  return (
    <span className="whitespace-nowrap rounded-ctl bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
      {flag.replace(/_/g, " ")}
    </span>
  );
}

function VisibilityStatus({ overlayId }: { overlayId: string }) {
  const store = useOverlayConfigStore();
  const settings = store.getOverlaySettings(overlayId);
  const { visibility } = settings;
  const session = useSessionStore((s) => s.session);

  if (!session) return null;

  const isReplay =
    session.sessionStateLabel === "Replay" ||
    session.flags.includes("replay");
  const isLoneQualify = session.flags.includes("lone_qualify");

  const wouldHide =
    (visibility.hideOnReplay && isReplay) ||
    (visibility.hideOnLoneQualify && isLoneQualify);

  return (
    <div
      className={[
        "flex items-center gap-2 rounded-card border px-3 py-2 text-xs font-medium",
        wouldHide
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-accent/25 bg-accent/5 text-accent",
      ].join(" ")}
    >
      <span
        className="inline-block size-1.5 rounded-full"
        style={{
          background: wouldHide ? "var(--color-warning)" : "var(--color-accent)",
        }}
      />
      {wouldHide
        ? "This overlay would be hidden in the current session."
        : "This overlay is visible in the current session."}
    </div>
  );
}
