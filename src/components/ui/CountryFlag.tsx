import { alpha2 } from "../../lib/countries";

/**
 * A driver's country flag (bundled SVG sprite via flag-icons — renders
 * identically on every OS, unlike emoji flags which Windows draws as plain
 * letters) with an optional alpha-3 code alongside. Unknown or missing codes
 * degrade gracefully: code-only, or nothing at all.
 */
export function CountryFlag({
  code,
  name,
  showCode = false,
}: {
  /** ISO alpha-3 code from the driver flair, e.g. "ESP". May be "". */
  code: string;
  /** Country display name for the tooltip. */
  name?: string;
  /** Render the alpha-3 code text next to the flag. */
  showCode?: boolean;
}) {
  if (!code) return null;
  const a2 = alpha2(code);
  const title = name || code;
  return (
    <span
      className="inline-flex min-w-0 shrink-0 items-center gap-1"
      title={title}
    >
      {a2 && (
        <span
          className={`fi fi-${a2} rounded-[2px]`}
          style={{ fontSize: 11, lineHeight: 1 }}
          aria-label={title}
        />
      )}
      {(showCode || !a2) && (
        <span className="text-[9px] font-semibold uppercase tracking-wide text-muted">
          {code}
        </span>
      )}
    </span>
  );
}
