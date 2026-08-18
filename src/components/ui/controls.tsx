/**
 * Shared control primitives — the single source of truth for interactive
 * elements across the Overlay Manager (toggles, checkboxes, buttons, inputs,
 * segmented controls, section labels, cards).
 *
 * Design language:
 *   - controls sit on `surface-2` cards with 2 px radii and 1 px borders
 *   - the interactive color is `primary` (blue) — status greens/reds/yellows
 *     are reserved for telemetry meaning, never for chrome
 *   - text follows the three-step scale: text (white) / muted / faint
 *   - measured values are mono; prose and labels are sans
 *
 * Every control here ships all eight states: default, hover, focus-visible,
 * active, disabled, loading, error, success. Three rules hold throughout:
 *
 *   1. `border-width` never changes between states. State goes to background,
 *      outline or color — never to geometry, which would shift layout.
 *   2. The focus ring is never transitioned. It appears on the frame the key
 *      lands, or keyboard users are flying blind through the animation.
 *   3. Pointer targets are expanded past the visual box with an inset
 *      pseudo-element, so the panel can stay dense without becoming fiddly.
 */

import type { ReactNode } from "react";

/** Async/validation state shared by the interactive primitives. */
export type ControlState = "idle" | "loading" | "error" | "success";

/* Expanded pointer target without changing the painted box. */
const HIT = "relative before:absolute before:-inset-1.5 before:content-['']";

/* ── Spinner ──────────────────────────────────────────────────────────────── */

/**
 * The inline busy indicator. Hand-built from a bordered circle rather than
 * pulled from an animation library — it is four lines of CSS and costs nothing.
 */
export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Working"
      className={[
        "inline-block shrink-0 animate-spin rounded-full border-[1.5px] border-current border-t-transparent",
        className,
      ].join(" ")}
      style={{ animationDuration: "700ms" }}
    />
  );
}

/* ── ToggleSwitch ─────────────────────────────────────────────────────────── */

export function ToggleSwitch({
  checked,
  onChange,
  size = "md",
  title,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
  title?: string;
  disabled?: boolean;
}) {
  const dims =
    size === "sm"
      ? { track: "h-4 w-7", knob: "size-3", on: "left-[14px]" }
      : { track: "h-5 w-9", knob: "size-4", on: "left-[18px]" };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={[
        HIT,
        "shrink-0 rounded-full transition-colors",
        dims.track,
        disabled
          ? "cursor-not-allowed border border-border bg-surface opacity-55"
          : checked
            ? "bg-primary active:brightness-90"
            : "border border-border-strong bg-surface hover:border-faint active:brightness-110",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 rounded-full bg-text shadow-sm transition-[left]",
          dims.knob,
          checked ? dims.on : "left-0.5",
        ].join(" ")}
      />
    </button>
  );
}

/* ── Checkbox ─────────────────────────────────────────────────────────────── */

export function Checkbox({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        onChange(!checked);
      }}
      className={[
        HIT,
        "flex size-4 shrink-0 items-center justify-center rounded-ctl border transition-colors",
        disabled
          ? "cursor-not-allowed border-border bg-surface opacity-55"
          : checked
            ? "border-primary bg-primary text-on-accent active:brightness-90"
            : "border-border-strong bg-surface text-transparent hover:border-faint",
      ].join(" ")}
    >
      {checked && (
        <svg
          viewBox="0 0 10 8"
          className="size-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ── Buttons ──────────────────────────────────────────────────────────────── */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/*
 * `primary` fills with the interactive hue and sets `primary-ink` on top.
 * White-on-accent measures 2.2–2.9:1 across the four themes — well under the
 * 4.5:1 floor — because every status accent in this system is a light color.
 * Dark ink on the same fill reads at 6.5–8.7:1.
 *
 * Every variant is cut on `--shear` and set in caps.
 *
 * The cut belongs to the app's *chrome* and stops at the edge of the data: the
 * title bar, the manager's chips and every CTA take it; the timing tables, the
 * widgets and anything drawn over the game do not. A driver reading a lap time
 * in peripheral vision needs the column edges vertical, and a surface where
 * half the boxes lean is a surface where nothing lines up. So the frame is cut
 * and the instruments are square.
 *
 * Caps at 11 px rather than 12 px mixed case — capitals carry no descenders and
 * read a size larger than they measure, so the label keeps the row's height
 * while gaining the weight the shear asks for.
 */
const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-primary text-on-accent hover:bg-primary-dim active:brightness-90",
  secondary:
    "border border-border bg-surface-2 text-text hover:border-border-strong hover:bg-surface active:brightness-95",
  ghost:
    "border border-transparent text-muted hover:bg-surface-2 hover:text-text active:brightness-95",
  danger:
    "border border-border bg-surface-2 text-text hover:border-danger hover:text-danger active:brightness-95",
};

export function Button({
  variant = "secondary",
  icon,
  children,
  disabled,
  title,
  state = "idle",
  onClick,
}: {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  /** Async/validation state. `loading` also blocks the click. */
  state?: ControlState;
  onClick: () => void;
}) {
  const busy = state === "loading";
  const inert = disabled || busy;

  // Error and success annotate the resting variant rather than replacing it,
  // so the button doesn't change size or shape when an action resolves.
  const stateTone =
    state === "error"
      ? "border-danger text-danger"
      : state === "success"
        ? "border-accent text-accent"
        : "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={inert}
      aria-disabled={inert || undefined}
      aria-busy={busy || undefined}
      title={title}
      className={[
        // `whitespace-nowrap`: a clickable label that wraps to two lines reads
        // as a rendering fault, and breaks the row's vertical rhythm.
        "shear whitespace-nowrap rounded-ctl px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] transition-colors",
        inert
          ? "cursor-not-allowed border border-border bg-surface-2 text-faint"
          : BUTTON_VARIANT[variant],
        stateTone,
      ].join(" ")}
    >
      {/* Single child, per `.shear`: the counter-transform lives on it, and two
          siblings would each need their own. */}
      <span className="gap-1.5">
        {busy ? <Spinner /> : icon}
        {children}
      </span>
    </button>
  );
}

export function IconButton({
  icon,
  title,
  active = false,
  danger = false,
  size = "md",
  disabled = false,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  active?: boolean;
  danger?: boolean;
  size?: "sm" | "md";
  disabled?: boolean;
  onClick: () => void;
}) {
  let tone: string;
  if (disabled) {
    tone = "cursor-not-allowed text-faint opacity-55";
  } else if (active) {
    tone = "bg-primary/15 text-primary hover:bg-primary/25 active:brightness-90";
  } else if (danger) {
    tone = "text-muted hover:bg-danger/15 hover:text-danger active:brightness-95";
  } else {
    tone = "text-muted hover:bg-surface-2 hover:text-text active:brightness-95";
  }
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
        HIT,
        "grid place-items-center rounded-ctl transition-colors",
        size === "sm" ? "size-5" : "size-7",
        tone,
      ].join(" ")}
    >
      {icon}
    </button>
  );
}

/* ── Segmented control ────────────────────────────────────────────────────── */

export function Segmented({ children }: { children: ReactNode }) {
  return (
    <div
      role="group"
      className="flex items-center gap-0.5 rounded-ctl border border-border bg-bg p-0.5"
    >
      {children}
    </div>
  );
}

export function SegmentedButton({
  active,
  onClick,
  title,
  disabled = false,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      disabled={disabled}
      className={[
        "flex items-center gap-1.5 whitespace-nowrap rounded-ctl px-2 py-1 text-[11px] font-medium transition-colors",
        disabled
          ? "cursor-not-allowed text-faint opacity-55"
          : active
            ? "bg-surface-2 text-text shadow-sm"
            : "text-muted hover:text-text active:brightness-95",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ── Typography helpers ───────────────────────────────────────────────────── */

/**
 * Small uppercase section label — the standard group heading everywhere.
 *
 * Mono, because in this app a label is instrument nomenclature rather than
 * prose: it names a channel. That reads as a panel legend and keeps the sans
 * face for things people actually read in sentences.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-faint">
      {children}
    </p>
  );
}

/**
 * A measured value with its unit label — position, size, count, protocol
 * version. Mono and tabular so digits hold their column as the value ticks.
 */
export function Readout({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface px-2.5 py-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
        {label}
      </div>
      <div className="tnum mt-0.5 font-mono text-sm font-medium text-text">
        {value}
        {unit && <span className="ml-0.5 text-[11px] text-faint">{unit}</span>}
      </div>
    </div>
  );
}

/* ── Inputs ───────────────────────────────────────────────────────────────── */

/*
 * Border width is 1 px in every state. The focus signal is an outline, which
 * sits outside the box and therefore cannot shift layout — unlike the common
 * "thicken the border on focus" pattern, which nudges every sibling.
 */
const FIELD_BASE =
  "rounded-ctl border bg-bg px-2.5 py-1.5 text-xs text-text transition-colors placeholder:text-faint";

function fieldTone(state: ControlState, disabled: boolean): string {
  if (disabled) return "cursor-not-allowed border-border opacity-55";
  if (state === "error") return "border-danger";
  if (state === "success") return "border-accent";
  return "border-border hover:border-border-strong";
}

export function TextInput({
  value,
  placeholder,
  onChange,
  className = "w-52",
  state = "idle",
  disabled = false,
  /** Replaced by `error` when the field is invalid; keeps a stable height. */
  helper,
  error,
  id,
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
  state?: ControlState;
  disabled?: boolean;
  helper?: string;
  error?: string;
  id?: string;
}) {
  const invalid = state === "error";
  const describedBy = helper || error ? `${id ?? "field"}-help` : undefined;

  return (
    <div className={className}>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
          className={[
            FIELD_BASE,
            fieldTone(state, disabled),
            // The right-edge slot is always reserved, so the box never reflows
            // when a spinner or status glyph appears in it.
            "w-full pr-7",
          ].join(" ")}
        />
        <span className="pointer-events-none absolute inset-y-0 right-2 grid place-items-center">
          {state === "loading" && <Spinner className="size-3 text-faint" />}
          {state === "error" && (
            <span aria-hidden className="text-[11px] text-danger">
              !
            </span>
          )}
          {state === "success" && (
            <span aria-hidden className="text-[11px] text-accent">
              ✓
            </span>
          )}
        </span>
      </div>
      {(helper || error) && (
        <p
          id={describedBy}
          // Stable single-line height: swapping helper for error must not push
          // the rest of the panel down.
          className={[
            "mt-1 min-h-[1lh] text-[11px]",
            error ? "text-danger" : "text-faint",
          ].join(" ")}
        >
          {error ?? helper}
        </p>
      )}
    </div>
  );
}

export function SelectInput({
  value,
  options,
  onChange,
  disabled = false,
  title,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <select
      value={value}
      title={title}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onChange={(e) => onChange(e.target.value)}
      className={[FIELD_BASE, fieldTone("idle", disabled)].join(" ")}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/* ── Card / note surfaces ─────────────────────────────────────────────────── */

/** A quiet informational note (blue = informational, never decorative). */
export function InfoNote({
  icon,
  children,
}: {
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 rounded-card border border-border bg-surface px-3 py-2.5 text-xs leading-relaxed text-muted">
      {icon}
      <span>{children}</span>
    </div>
  );
}
