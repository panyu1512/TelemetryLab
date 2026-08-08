import { createContext, useContext, type ReactNode } from "react";

/**
 * Which surface a full-bleed screen is being rendered on.
 *
 * - `overlay` — the live form, sitting over game footage. Legibility-first,
 *   no interactive chrome, every pixel spent on data.
 * - `manager` — the Overlay Manager's preview stage, where the same screen is
 *   being *configured*. Interactive affordances (class collapse, solo filter)
 *   belong here and nowhere else.
 *
 * This exists because `design.md` § Dense tabular overlays rule 2 asks the two
 * forms to differ structurally, not just in density: the overlay replaces the
 * interactive class band with a gap plus a tone shift, because a band and a row
 * cost the same 30-odd pixels and only one of them carries lap times.
 *
 * The default is `overlay`, so a screen mounted without a provider takes the
 * quiet form — the manager opts *in* to its own chrome.
 */
export type Surface = "overlay" | "manager";

const SurfaceContext = createContext<Surface>("overlay");

export function SurfaceProvider({
  value,
  children,
}: {
  value: Surface;
  children: ReactNode;
}) {
  return (
    <SurfaceContext.Provider value={value}>{children}</SurfaceContext.Provider>
  );
}

export function useSurface(): Surface {
  return useContext(SurfaceContext);
}
