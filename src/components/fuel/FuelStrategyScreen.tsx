/**
 * Fuel & Strategy Calculator (backlog Feature 1).
 *
 * A full-bleed overlay screen that turns the player's raw fuel telemetry into
 * live strategy: how much you're burning, whether it lasts to the flag, when to
 * pit, how much to save, and one or two candidate stint plans. All of the math
 * lives in `lib/fuelStrategy.ts`; the sampling/state lives in
 * `hooks/useFuelStrategy.ts`. This file is purely presentation + the small set
 * of user controls (safety reserve and a manual pit-fuel override).
 */

import { useState } from "react";
import {
  Fuel,
  Gauge,
  Flag,
  Wrench,
  TriangleAlert,
  Check,
  ChevronDown,
  Minus,
  Plus,
  Droplet,
  Radio,
  Leaf,
} from "lucide-react";
import { useTelemetry } from "../../hooks/useTelemetry";
import { useSessionStore } from "../../stores/useSessionStore";
import { useFuelStrategy } from "../../hooks/useFuelStrategy";
import type { FuelStatus, FuelStrategy, StintPlan } from "../../lib/fuelStrategy";
import { num } from "../../lib/format";

// ── status metadata ──────────────────────────────────────────────────────────

interface StatusMeta {
  label: string;
  color: string;
  Icon: typeof Check;
}

function statusMeta(status: FuelStatus): StatusMeta {
  switch (status) {
    case "finish":
      return { label: "Finish on fuel", color: "var(--color-accent)", Icon: Check };
    case "save":
      return { label: "Save to finish", color: "var(--color-warning)", Icon: Leaf };
    case "pit":
      return { label: "Pit stop needed", color: "var(--color-warning)", Icon: Wrench };
    case "empty":
      return { label: "Out of fuel", color: "var(--color-danger)", Icon: TriangleAlert };
    default:
      return { label: "Calibrating…", color: "var(--color-muted)", Icon: Gauge };
  }
}

// ── main screen ──────────────────────────────────────────────────────────────

export function FuelStrategyScreen() {
  const { data, iracingActive } = useTelemetry();
  const session = useSessionStore((s) => s.session);

  // User controls.
  const [reservePct, setReservePct] = useState(5); // %
  const [pitFuel, setPitFuel] = useState<number | null>(null); // litres, null = auto
  // Collapsed by default so the core read-outs fit an overlay without scrolling.
  const [showAlternates, setShowAlternates] = useState(false);

  const { strategy, sampleCount, outOfFuel } = useFuelStrategy(data, session, {
    reservePct: reservePct / 100,
    pitFuel,
  });

  const hasFuel = data?.fuelLevel != null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <Header
        reservePct={reservePct}
        onReserveChange={setReservePct}
        track={session?.track.name ?? null}
        config={session?.track.config ?? null}
      />

      {!hasFuel ? (
        <EmptyState iracingActive={iracingActive} />
      ) : (
        // `@container` lets the layout switch to two columns based on the
        // overlay's *own* width (not the viewport), so the core read-outs fit a
        // small always-on-top window without scrolling while you drive.
        <div className="@container flex flex-1 flex-col gap-2 overflow-auto p-2">
          {(outOfFuel || strategy.status === "empty") && <OutOfFuelAlert />}

          <PredictionRow strategy={strategy} sampleCount={sampleCount} />

          <div className="grid grid-cols-1 gap-2 @[460px]:grid-cols-2">
            <FuelBar strategy={strategy} />
            <StrategyCard strategy={strategy} />
            <FuelSaveCard strategy={strategy} />
            <PitFuelControl
              pitFuel={pitFuel}
              capacity={strategy.tankCapacity}
              onChange={setPitFuel}
            />
          </div>

          <PlansCard
            strategy={strategy}
            open={showAlternates}
            onToggle={() => setShowAlternates((o) => !o)}
          />
        </div>
      )}
    </div>
  );
}

// ── header ───────────────────────────────────────────────────────────────────

function Header({
  reservePct,
  onReserveChange,
  track,
  config,
}: {
  reservePct: number;
  onReserveChange: (v: number) => void;
  track: string | null;
  config: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-1.5">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-text">
        <Fuel className="size-4 text-accent" />
        Fuel &amp; Strategy
      </span>
      <span className="text-xs text-muted">
        {track ?? "—"}
        {config ? ` · ${config}` : ""}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted">Reserve</span>
        <Stepper
          value={`${reservePct}%`}
          onDec={() => onReserveChange(Math.max(0, reservePct - 1))}
          onInc={() => onReserveChange(Math.min(20, reservePct + 1))}
          decDisabled={reservePct <= 0}
          incDisabled={reservePct >= 20}
        />
      </div>
    </div>
  );
}

// ── fuel bar ─────────────────────────────────────────────────────────────────

function FuelBar({ strategy }: { strategy: FuelStrategy }) {
  const pct = strategy.fuelPct ?? 0;
  const reserveFrac =
    strategy.tankCapacity && strategy.reserve
      ? strategy.reserve / strategy.tankCapacity
      : 0;

  const low = pct < 0.15;
  const fill = low ? "var(--color-danger)" : "var(--color-accent)";

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-2.5">
      <div className="mb-2 flex items-end justify-between">
        <Metric
          label="In tank"
          value={num(strategy.fuelLevel, 1)}
          unit="L"
          color={low ? "var(--color-danger)" : undefined}
        />
        <Metric
          label="Consumption"
          value={strategy.perLap == null ? "—" : strategy.perLap.toFixed(2)}
          unit="L/lap"
          align="end"
        />
      </div>

      {/* Tank bar with a reserve marker. */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: fill }}
        />
        {reserveFrac > 0 && (
          <div
            className="absolute inset-y-0 w-px bg-danger/70"
            style={{ left: `${reserveFrac * 100}%` }}
            title={`Reserve: ${num(strategy.reserve, 1)} L`}
          />
        )}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span className="tnum">
          {strategy.fuelPct == null ? "—" : Math.round(strategy.fuelPct * 100)}%
        </span>
        <span className="tnum">
          {strategy.tankCapacity == null
            ? "capacity —"
            : `tank ${num(strategy.tankCapacity, 0)} L`}
        </span>
      </div>
    </section>
  );
}

// ── prediction row ───────────────────────────────────────────────────────────

function PredictionRow({
  strategy,
  sampleCount,
}: {
  strategy: FuelStrategy;
  sampleCount: number;
}) {
  const meta = statusMeta(strategy.status);

  const lapsLeftFuel =
    strategy.lapsOfFuelSafe == null ? "—" : strategy.lapsOfFuelSafe.toFixed(1);
  const lapsToFinish =
    strategy.lapsToFinish == null ? "—" : String(strategy.lapsToFinish);

  return (
    <section
      className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2"
      style={{ borderColor: `${meta.color}44`, background: `${meta.color}12` }}
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-lg"
        style={{ background: `${meta.color}22`, color: meta.color }}
      >
        <meta.Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold leading-tight" style={{ color: meta.color }}>
          {meta.label}
        </div>
        <div className="truncate text-[11px] text-muted">
          {sampleCount === 0
            ? "Estimating — complete a lap for live data."
            : `${sampleCount} lap${sampleCount === 1 ? "" : "s"} sampled`}
        </div>
      </div>
      <div className="flex shrink-0 gap-3">
        <Metric label="Fuel laps" value={lapsLeftFuel} align="end" />
        <Metric label="To flag" value={lapsToFinish} unit="laps" align="end" />
      </div>
    </section>
  );
}

// ── strategy card (stint + pit window) ───────────────────────────────────────

function StrategyCard({ strategy }: { strategy: FuelStrategy }) {
  const { stintUsed, stintTotal, pitWindow, recommendedPitLap, marginLaps } = strategy;

  const stintProgress =
    stintUsed != null && stintTotal != null && stintTotal > 0
      ? Math.min(1, stintUsed / stintTotal)
      : null;

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-2.5">
      <SectionTitle icon={Flag}>Current stint</SectionTitle>

      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-text">
          {stintUsed == null || stintTotal == null ? (
            "—"
          ) : (
            <>
              Lap <span className="tnum font-semibold">{stintUsed}</span> of ~
              <span className="tnum font-semibold">{Math.round(stintTotal)}</span>
            </>
          )}
        </span>
        <span className="tnum text-xs text-muted">
          {stintProgress == null ? "" : `${Math.round(stintProgress * 100)}%`}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${(stintProgress ?? 0) * 100}%` }}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <KeyValue label="Next pit window">
          {pitWindow == null ? (
            "—"
          ) : pitWindow[0] === pitWindow[1] ? (
            <span className="tnum">Lap {pitWindow[1]}</span>
          ) : (
            <span className="tnum">
              Lap {pitWindow[0]}–{pitWindow[1]}
            </span>
          )}
        </KeyValue>
        <KeyValue label="Recommended pit">
          <span className="tnum">
            {recommendedPitLap == null ? "—" : `Lap ${recommendedPitLap}`}
          </span>
        </KeyValue>
      </div>

      {marginLaps != null && (
        <div className="mt-2 text-[11px] text-muted">
          {marginLaps >= 0 ? (
            <>
              Margin:{" "}
              <span className="tnum text-accent">+{marginLaps}</span> lap
              {marginLaps === 1 ? "" : "s"} of fuel over the finish.
            </>
          ) : (
            <>
              Short by{" "}
              <span className="tnum text-danger">{Math.abs(marginLaps)}</span> lap
              {marginLaps === -1 ? "" : "s"} at the current burn.
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ── fuel-save card ───────────────────────────────────────────────────────────

function FuelSaveCard({ strategy }: { strategy: FuelStrategy }) {
  const { saveNeededPct, targetPerLap, perLap, finishesOnFuel } = strategy;

  // Nothing to coach if we're finishing comfortably or have no burn data.
  if (perLap == null) return null;

  const finishing = finishesOnFuel === true || !saveNeededPct;

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-2.5">
      <SectionTitle icon={Leaf}>Fuel save</SectionTitle>
      {finishing ? (
        <p className="text-xs text-muted">
          No lift-and-coast needed — you're on target to finish on the current
          burn.
        </p>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-warning">
              Save {Math.round((saveNeededPct ?? 0) * 100)}%
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              Lift &amp; coast to reach the flag without an extra stop.
            </p>
          </div>
          <div className="text-right">
            <div className="tnum text-sm text-text">
              {targetPerLap == null ? "—" : targetPerLap.toFixed(2)}{" "}
              <span className="text-[11px] text-muted">L/lap</span>
            </div>
            <div className="tnum text-[11px] text-muted">
              now {perLap.toFixed(2)} L/lap
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── plans card ───────────────────────────────────────────────────────────────

function PlansCard({
  strategy,
  open,
  onToggle,
}: {
  strategy: FuelStrategy;
  open: boolean;
  onToggle: () => void;
}) {
  const plans = strategy.plans;
  if (plans.length === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <SectionTitle icon={Wrench} noMargin>
          Pit strategies
        </SectionTitle>
        <ChevronDown
          className={`ml-auto size-4 text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="flex flex-col gap-2 px-3 pb-3">
          {plans.map((plan, i) => (
            <PlanRow key={plan.stops} plan={plan} primary={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function PlanRow({ plan, primary }: { plan: StintPlan; primary: boolean }) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-md border px-3 py-2",
        primary
          ? "border-accent/30 bg-accent/5"
          : "border-border bg-surface",
      ].join(" ")}
    >
      <span
        className={[
          "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          primary ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted",
        ].join(" ")}
      >
        {plan.label}
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-text">
        {plan.stops === 0 ? (
          "Run to the flag — no stop required."
        ) : (
          <>
            Pit{" "}
            {plan.pitLaps
              .map((l, i) => `Lap ${l} (+${plan.addFuel[i]}L)`)
              .join(" · ")}
          </>
        )}
      </span>
      {primary && (
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-accent">
          Best
        </span>
      )}
    </div>
  );
}

// ── manual pit-fuel override ─────────────────────────────────────────────────

function PitFuelControl({
  pitFuel,
  capacity,
  onChange,
}: {
  pitFuel: number | null;
  capacity: number | null;
  onChange: (v: number | null) => void;
}) {
  const max = capacity ? Math.round(capacity) : 100;
  const step = 5;
  const current = pitFuel ?? Math.min(max, 40);

  return (
    <section className="rounded-lg border border-border bg-surface-2 p-2.5">
      <div className="flex items-center justify-between">
        <SectionTitle icon={Droplet} noMargin>
          Pit fuel
        </SectionTitle>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={pitFuel == null}
            onChange={(e) => onChange(e.target.checked ? null : current)}
            className="accent-[var(--color-accent)]"
          />
          Auto (fill as needed)
        </label>
      </div>
      {pitFuel != null && (
        <div className="mt-2 flex items-center gap-3">
          <Stepper
            value={`${pitFuel} L`}
            onDec={() => onChange(Math.max(0, pitFuel - step))}
            onInc={() => onChange(Math.min(max, pitFuel + step))}
            decDisabled={pitFuel <= 0}
            incDisabled={pitFuel >= max}
          />
          <span className="text-[11px] text-muted">
            Plans above assume this fixed fill per stop.
          </span>
        </div>
      )}
    </section>
  );
}

// ── alerts / empty state ─────────────────────────────────────────────────────

function OutOfFuelAlert() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      <TriangleAlert className="size-4 shrink-0" />
      <span>
        <span className="font-semibold">Out of fuel.</span> Pit immediately — the
        calculator will re-learn your burn after refuelling.
      </span>
    </div>
  );
}

function EmptyState({ iracingActive }: { iracingActive: boolean }) {
  return (
    <div className="grid h-full place-items-center">
      <div className="flex max-w-sm flex-col items-center gap-3 text-center">
        <div className="grid size-12 place-items-center rounded-xl border border-border bg-surface-2">
          <Radio className="size-6 text-muted" />
        </div>
        <h2 className="text-base font-semibold text-text">No fuel data</h2>
        <p className="text-sm leading-relaxed text-muted">
          {iracingActive
            ? "Waiting for the telemetry feed…"
            : "Start a session in iRacing (or run the mock bridge) to see fuel strategy."}
        </p>
      </div>
    </div>
  );
}

// ── little shared bits ───────────────────────────────────────────────────────

function Metric({
  label,
  value,
  unit,
  align = "start",
  color,
}: {
  label: string;
  value: string;
  unit?: string;
  align?: "start" | "end";
  color?: string;
}) {
  return (
    <div className={`flex flex-col ${align === "end" ? "items-end" : "items-start"}`}>
      <div className="flex items-baseline gap-1">
        <span className="tnum text-base font-semibold leading-none" style={{ color: color ?? "var(--color-text)" }}>
          {value}
        </span>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
      <span className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
        {label}
      </span>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
  noMargin,
}: {
  icon: typeof Flag;
  children: React.ReactNode;
  noMargin?: boolean;
}) {
  return (
    <span
      className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted ${
        noMargin ? "" : "mb-2"
      }`}
    >
      <Icon className="size-3.5" />
      {children}
    </span>
  );
}

function KeyValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-text">{children}</div>
    </div>
  );
}

function Stepper({
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
}: {
  value: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onDec}
        disabled={decDisabled}
        className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-30"
      >
        <Minus className="size-3" />
      </button>
      <span className="tnum min-w-[3rem] text-center text-xs font-medium text-text">
        {value}
      </span>
      <button
        type="button"
        onClick={onInc}
        disabled={incDisabled}
        className="grid size-6 place-items-center rounded text-muted transition-colors hover:bg-surface hover:text-text disabled:opacity-30"
      >
        <Plus className="size-3" />
      </button>
    </div>
  );
}
