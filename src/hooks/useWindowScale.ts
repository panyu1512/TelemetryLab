import { useEffect, useState } from "react";

import { subscribe } from "../lib/windowBus";
import { getWindowScale } from "../lib/windowState";

/**
 * This window's content scale (1 = 100 %), live: set from the Layout editor
 * and delivered over the bus, so a scale change applies without reopening.
 */
export function useWindowScale(label: string): number {
  const [scale, setScale] = useState(() => getWindowScale(label));
  useEffect(
    () =>
      subscribe("window:scale", (e) => {
        if (e?.label === label && typeof e.scale === "number" && e.scale > 0) {
          setScale(e.scale);
        }
      }),
    [label]
  );
  return scale;
}
