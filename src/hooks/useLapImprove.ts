import { useEffect, useRef, useState } from "react";
import {
  LAP_IMPROVE_MS,
  lapImproved,
  type LapImprove,
  type LapImproveGrade,
} from "../lib/lapImprove";

/**
 * The row's last best-lap improvement, held for {@link LAP_IMPROVE_MS} and then
 * cleared — see `lib/lapImprove`.
 *
 * `active` gates it to the sessions that read as a board of lap times; outside
 * them the best lap is a footnote to the race order and nothing flashes. The
 * grade is read when the improvement lands, so a lap that took the session
 * best sweeps purple even if someone beats it before the hold ends.
 */
export function useLapImprove(
  bestLap: number | null | undefined,
  grade: LapImproveGrade,
  active: boolean,
): LapImprove | null {
  const last = useRef(bestLap);
  const seq = useRef(0);
  const [improve, setImprove] = useState<LapImprove | null>(null);
  // The grade at the moment of the change, without re-running the effect when
  // only the grade moves.
  const gradeRef = useRef(grade);
  gradeRef.current = grade;

  // The hold's timer lives outside the effect: a later best-lap change that is
  // not an improvement must not cancel the clear of one still on screen.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  useEffect(() => {
    const before = last.current;
    last.current = bestLap;
    if (!active || !lapImproved(before, bestLap)) return;
    seq.current += 1;
    setImprove({ grade: gradeRef.current, id: seq.current });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setImprove(null), LAP_IMPROVE_MS);
  }, [bestLap, active]);

  return improve;
}
