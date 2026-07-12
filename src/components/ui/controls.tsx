/**
 * Shared control primitives — the single source of truth for interactive
 * elements across the Overlay Manager (toggles, checkboxes, buttons, inputs,
 * segmented controls, section labels, cards).
 *
 * Design language:
 *   - controls sit on `surface-2` cards with 6 px radii and 1 px borders
 *   - the interactive color is `primary` (blue) — status greens/reds/yellows
 *     are reserved for telemetry meaning, never for chrome
 *   - text follows the three-step scale: text (white) / muted / faint
 */

import type { ReactNode } from "react";

/* ── ToggleSwitch ─────────────────────────────────────────────────────────── */

export function ToggleSwitch({
  checked,
  onChange,
  size = "md",
  title,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
  title?: string;
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
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={[
        "relative shrink-0 rounded-full transition-colors duration-150",
        dims.track,
        checked
          ? "bg-primary"
          : "border border-border-strong bg-surface hover:border-faint",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 rounded-full bg-white shadow-sm transition-[left] duration-150",
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
        "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
        checked
          ? "border-primary bg-primary text-white"
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

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary-dim border border-transparent",
  secondary:
    "border border-border bg-surface-2 text-text hover:border-border-strong hover:bg-surface",
  ghost: "border border-transparent text-muted hover:bg-surface-2 hover:text-text",
  danger:
    "border border-border bg-surface-2 text-text hover:border-danger/50 hover:text-danger",
};

export function Button({
  variant = "secondary",
  icon,
  children,
  disabled,
  title,
  onClick,
}: {
  variant?: ButtonVariant;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={[
        "flex items-center gap-1.5 rounded-ctl px-3 py-1.5 text-xs font-medium transition-colors",
        disabled
          ? "cursor-not-allowed border border-border bg-surface-2 text-faint"
          : BUTTON_VARIANT[variant],
      ].join(" ")}
    >
      {icon}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  title,
  active = false,
  danger = false,
  size = "md",
  onClick,
}: {
  icon: ReactNode;
  title: string;
  active?: boolean;
  danger?: boolean;
  size?: "sm" | "md";
  onClick: () => void;
}) {
  let tone: string;
  if (active) {
    tone = "bg-primary/15 text-primary hover:bg-primary/25";
  } else if (danger) {
    tone = "text-muted hover:bg-danger/15 hover:text-danger";
  } else {
    tone = "text-muted hover:bg-surface-2 hover:text-text";
  }
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={[
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
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-bg p-0.5">
      {children}
    </div>
  );
}

export function SegmentedButton({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={[
        "flex items-center gap-1.5 rounded-ctl px-2 py-1 text-[11px] font-medium transition-colors",
        active
          ? "bg-surface-2 text-text shadow-sm"
          : "text-muted hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/* ── Typography helpers ───────────────────────────────────────────────────── */

/** Small uppercase section label — the standard group heading everywhere. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
      {children}
    </p>
  );
}

/* ── Inputs ───────────────────────────────────────────────────────────────── */

export function TextInput({
  value,
  placeholder,
  onChange,
  className = "w-52",
}: {
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={[
        "rounded-ctl border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors placeholder:text-faint hover:border-border-strong focus:border-primary",
        className,
      ].join(" ")}
    />
  );
}

export function SelectInput({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-ctl border border-border bg-bg px-2.5 py-1.5 text-xs text-text outline-none transition-colors hover:border-border-strong focus:border-primary"
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
