/**
 * The TelemetryLab mark (1.30+): the black kitten. `full` is the detailed
 * head with its hornet-yellow rim, for dark chrome (the title bar); `icon` is
 * the reduced favicon form on its yellow plate, for anywhere smaller than
 * ~28 px. Both are files in `public/` rather than inlined paths, so there is
 * one drawing of the cat and every surface points at it — see design.md
 * § The mark.
 *
 * Always decorative: the product name sits beside it wherever it appears.
 */
export function KittenMark({
  variant = "full",
  className = "size-7",
}: {
  variant?: "full" | "icon";
  className?: string;
}) {
  const src = variant === "full" ? "/brand/kitten.svg" : "/favicon.svg";
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      className={["shrink-0 select-none", className].join(" ")}
    />
  );
}
