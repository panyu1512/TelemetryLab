/**
 * Fuel & Strategy Calculator (backlog Feature 1).
 *
 * A full-bleed overlay screen that turns the player's raw fuel telemetry into
 * live strategy: how much you're burning, whether it lasts to the flag, when to
 * pit, how much to save, and one or two candidate stint plans. All of the math
 * lives in `lib/fuelStrategy.ts`; the sampling/state lives in
 * `hooks/useFuelStrategy.ts`. This file is purely presentation.
 *
 * **Nothing here can be aimed at** — design.md § Dense tabular overlays rule 7.
 * This screen used to carry three controls: a reserve stepper, a pit-fuel
 * override, and a collapsed "Pit strategies" section you had to click to open.
 * All three are gone. It is read while the driver's hands are busy, so it holds
 * no button, no checkbox and no disclosure; the plans are simply always
 * visible. The two settings those controls fed now sit at their defaults —
 * a 1.0-lap margin, and pit fuel calculated as needed — and if either ever
 * needs to move, rule 7 says its home is the Overlay Manager, not this screen.
 */

import { Fuel, Gauge, Flag, Wrench, TriangleAlert, Check, Radio, Leaf } from "lucide-react";
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

// ── fixed inputs ─────────────────────────────────────────────────────────────

/**
 * Safety margin at the flag, in laps — fuel the strategy refuses to count
 * towards the finish. This is iRacing's own AutoFuel unit and its own default:
 * AutoFuel's "Margin (Laps)" field, which it recommends never dropping below
 * 1.0 in a timed race. Matching the sim's unit matters more than it looks —
 * a driver reading "margin 1.0" here and setting "Margin (Laps) 1.0" in the
 * black box should get the same fuel, not two answers that need reconciling.
 *
 * Was a stepper in this header, and before that a percentage of the tank.
 */
const MARGIN_LAPS = 1;

/** Litres to add per stop. `null` = whatever the plan says is needed. */
const PIT_FUEL: number | null = null;

// ── main screen ──────────────────────────────────────────────────────────────

export function FuelStrategyScreen() {
  const { data, iracingActive } = useTelemetry();
  const session = useSessionStore((s) => s.session);

  const { strategy, sampleCount, outOfFuel } = useFuelStrategy(data, session, {
    marginLaps: MARGIN_LAPS,
    pitFuel: PIT_FUEL,
  });

  const hasFuel = data?.fuelLevel != null;

  return (
    <div className="overlay-card timing-surface flex h-full flex-col overflow-hidden rounded-card border border-border/60">
      <Header
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
          </div>

          <PlansCard strategy={strategy} />
        </div>
      )}
    </div>
  );
}

// ── header ───────────────────────────────────────────────────────────────────

function Header({ track, config }: { track: string | null; config: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-1.5">
      <span className="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-text">
        <Fuel className="size-4 text-muted" />
        Fuel &amp; Strategy
      </span>
      <span className="text-xs text-faint">
        {track ?? "—"}
        {config ? ` · ${config}` : ""}
      </span>

      {/* A readout, not a control — rule 7 allows the first and bans the
          second. It stays because every lap figure below is quoted *after* this
          margin is taken off the tank, and a number you cannot account for is
          a number you end up not trusting. Labelled as AutoFuel labels it, so
          it reads against the sim's own black box rather than beside it. */}
      <span className="ml-auto flex items-baseline gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
        Margin
        <span className="tnum text-xs font-semibold normal-case tracking-normal text-muted">
          {MARGIN_LAPS.toFixed(1)} lap{MARGIN_LAPS === 1 ? "" : "s"}
        </span>
      </span>
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
    <section className="rounded-card border border-border bg-surface-2 p-2.5">
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

      {/* Tank bar, with the margin marked where it falls on the tank. Its
          position moves with the burn now that the margin is priced in laps —
          a thirstier car sets it further up the bar. */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full transition-[width] duration-150"
          style={{ width: `${Math.max(0, Math.min(1, pct)) * 100}%`, background: fill }}
        />
        {reserveFrac > 0 && (
          <div
            className="absolute inset-y-0 w-px bg-danger/70"
            style={{ left: `${reserveFrac * 100}%` }}
            title={`Margin: ${MARGIN_LAPS.toFixed(1)} lap = ${num(strategy.reserve, 1)} L`}
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
      className="flex items-center gap-2.5 rounded-card border px-2.5 py-2"
      style={{ borderColor: `${meta.color}44`, background: `${meta.color}12` }}
    >
      <div
        className="grid size-8 shrink-0 place-items-center rounded-ctl"
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
  const { stintUsed, stintTotal, pitWindow, recommendedPitLap, surplusLaps } =
    strategy;

  const stintProgress =
    stintUsed != null && stintTotal != null && stintTotal > 0
      ? Math.min(1, stintUsed / stintTotal)
      : null;

  return (
    <section className="rounded-card border border-border bg-surface-2 p-2.5">
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

      {surplusLaps != null && (
        <div className="mt-2 text-[11px] text-muted">
          {surplusLaps >= 0 ? (
            <>
              Margin:{" "}
              <span className="tnum text-accent">+{surplusLaps}</span> lap
              {surplusLaps === 1 ? "" : "s"} of fuel over the finish.
            </>
          ) : (
            <>
              Short by{" "}
              <span className="tnum text-danger">{Math.abs(surplusLaps)}</span> lap
              {surplusLaps === -1 ? "" : "s"} at the current burn.
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ── fuel-save card ───────────────────────────────────────────────────────────

function FuelSaveCard({ strategy }: { strategy: FuelStrategy }) {
  const { saveNeededPct, targetPerLap, perLap, finishesOnFuel, status } = strategy;

  // Nothing to coach if we're finishing comfortably or have no burn data.
  if (perLap == null) return null;

  const finishing = finishesOnFuel === true || !saveNeededPct;
  /*
   * A deficit big enough to force a stop is not a saving target. The card used
   * to quote the arithmetic whatever it came to — "Save 61%", which is not a
   * number anybody can drive to, printed directly under a banner reading "Pit
   * stop needed". `status` already separates the two cases: `save` is the one
   * where lifting and coasting can still close the gap.
   */
  const mustPit = !finishing && status === "pit";

  return (
    <section className="rounded-card border border-border bg-surface-2 p-2.5">
      <SectionTitle icon={Leaf}>Fuel save</SectionTitle>
      {mustPit ? (
        <p className="text-xs text-muted">
          Too far short to save — the stop below is required. Saving buys laps
          in the window, not the finish.
        </p>
      ) : finishing ? (
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

/**
 * The candidate stint plans. This used to be collapsed behind a disclosure
 * button, on the grounds that the core read-outs should fit a small overlay
 * without scrolling. That traded a driver's glance for a click, which is the
 * wrong way round on a surface read at speed: the plans are always open now,
 * and a window too short for them scrolls like it always did.
 */
function PlansCard({ strategy }: { strategy: FuelStrategy }) {
  const plans = strategy.plans;
  if (plans.length === 0) return null;

  return (
    <section className="rounded-card border border-border bg-surface-2 px-3 py-2.5">
      <SectionTitle icon={Wrench}>Pit strategies</SectionTitle>
      <div className="flex flex-col gap-2">
        {plans.map((plan, i) => (
          <PlanRow key={plan.stops} plan={plan} primary={i === 0} />
        ))}
      </div>
    </section>
  );
}

function PlanRow({ plan, primary }: { plan: StintPlan; primary: boolean }) {
  return (
    <div
      className={[
        "flex items-center gap-3 rounded-ctl border px-3 py-2",
        primary
          ? "border-primary/30 bg-primary/5"
          : "border-border bg-surface",
      ].join(" ")}
    >
      <span
        className={[
          "rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
          primary ? "bg-primary/15 text-primary" : "bg-surface-2 text-muted",
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
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-primary">
          Best
        </span>
      )}
    </div>
  );
}

// ── alerts / empty state ─────────────────────────────────────────────────────

function OutOfFuelAlert() {
  return (
    <div className="flex items-center gap-2 rounded-card border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
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
        <div className="grid size-12 place-items-center rounded-card border border-border bg-surface-2">
          <Radio className="size-6 text-faint" />
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
      <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-faint">
        {label}
      </span>
    </div>
  );
}

/* `noMargin` went with the disclosure button that was the only caller needing
   it — every section title now sits above its content. */
function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: typeof Flag;
  children: React.ReactNode;
}) {
  return (
    <span className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
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
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-faint">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-text">{children}</div>
    </div>
  );
}

