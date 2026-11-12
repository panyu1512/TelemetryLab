import type { ReactNode } from "react";

/**
 * Lays its children out at `1 / scale` of the box and draws them `scale`
 * times larger, so the content fills the box exactly at any scale: a 125 %
 * Standings keeps its columns and simply reads bigger. A transform rather
 * than CSS `zoom`, because `zoom` changes what the grid measures as its width
 * and the widget grid reflows against the wrong size.
 *
 * At 1 it renders the children untouched — no wrapper, no new stacking
 * context — so a window nobody rescaled is exactly what it was before.
 */
export function ScaledFrame({
  scale,
  children,
}: {
  scale: number;
  children: ReactNode;
}) {
  if (!(scale > 0) || scale === 1) return <>{children}</>;
  const pct = `${100 / scale}%`;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        className="absolute left-0 top-0 flex origin-top-left flex-col"
        style={{ width: pct, height: pct, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
