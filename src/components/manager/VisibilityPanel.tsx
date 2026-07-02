import { Eye, EyeOff } from "lucide-react";
import { useOverlayConfigStore } from "../../stores/useOverlayConfigStore";
import { useSessionStore } from "../../stores/useSessionStore";

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
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Hide When
        </p>
        <p className="mb-4 text-xs text-muted">
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
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
          Current Session
        </p>
        {session ? (
          <div className="space-y-1.5 rounded-lg border border-border bg-surface-2 p-3 text-xs">
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
          <div className="rounded-lg border border-border bg-surface-2 px-3 py-4 text-center text-xs text-muted">
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
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5 transition-colors hover:border-border-strong">
      <Checkbox checked={checked} onChange={onChange} />
      <span className="flex-1">
        <span className="flex items-center gap-2">
          <span className="text-xs font-medium text-text">{label}</span>
          {currentlyActive && (
            <span className="rounded bg-warning/15 px-1 py-0.5 text-[9px] uppercase tracking-wide text-warning">
              Active now
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-[11px] text-muted">{description}</span>
      </span>
      {checked ? (
        <EyeOff className="mt-0.5 size-3.5 shrink-0 text-muted" />
      ) : (
        <Eye className="mt-0.5 size-3.5 shrink-0 text-muted/40" />
      )}
    </label>
  );
}

function Checkbox({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={[
        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
        checked
          ? "border-accent bg-accent/20 text-accent"
          : "border-border-strong bg-surface text-transparent",
      ].join(" ")}
    >
      {checked && (
        <svg viewBox="0 0 10 8" className="size-2.5" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
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
      <span className="w-14 shrink-0 text-[10px] uppercase tracking-wide text-muted">
        {label}
      </span>
      <span className="text-text">{value}</span>
    </div>
  );
}

function FlagBadge({ flag }: { flag: string }) {
  return (
    <span className="rounded bg-surface px-1 py-0.5 text-[9px] uppercase tracking-wide text-muted">
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
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        wouldHide
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-accent/20 bg-accent/5 text-accent",
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
