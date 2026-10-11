import { useEffect, useRef, useState } from "react";
import {
  POSITION_FLASH_MS,
  positionMove,
  type PositionFlash,
} from "../lib/positionFlash";

/**
 * The way this row's printed position last moved, held for
 * {@link POSITION_FLASH_MS} and then cleared — see `lib/positionFlash`.
 *
 * `scope` names what the number is a position *in* (class, overall, or a
 * lap-time rank). Switching it changes every printed number at once without a
 * single car having moved, so a change of scope re-baselines silently instead
 * of flashing the whole table.
 */
export function usePositionFlash(
  position: number | null | undefined,
  scope: string,
): PositionFlash | null {
  const last = useRef({ position, scope });
  const seq = useRef(0);
  const [flash, setFlash] = useState<PositionFlash | null>(null);

  useEffect(() => {
    const before = last.current;
    last.current = { position, scope };
    const move =
      before.scope === scope ? positionMove(before.position, position) : null;
    if (!move) {
      setFlash(null);
      return;
    }
    seq.current += 1;
    setFlash({ move, id: seq.current });
    const id = setTimeout(() => setFlash(null), POSITION_FLASH_MS);
    return () => clearTimeout(id);
  }, [position, scope]);

  return flash;
}
