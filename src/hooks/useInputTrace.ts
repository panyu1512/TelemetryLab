import { useRef } from "react";
import type { TelemetryData } from "./useTelemetry";

export interface InputSample {
  throttle: number;
  brake: number;
}

function clamp01(v: number | null | undefined): number {
  if (v == null || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

/**
 * Maintain a rolling history of throttle/brake for the input-trace graph.
 *
 * We append one sample per unique `sessionTime` (so React StrictMode's double
 * render doesn't double-count) and keep the last `maxPoints`. Like `usePeak`,
 * the ref is updated during render — it's guarded and deterministic, and the
 * widget already re-renders every telemetry frame.
 */
export function useInputTrace(
  data: TelemetryData | null,
  maxPoints = 300
): InputSample[] {
  const buf = useRef<InputSample[]>([]);
  const lastT = useRef<number | null>(null);

  const t = data?.sessionTime ?? null;
  if (t != null && t !== lastT.current) {
    lastT.current = t;
    buf.current = [
      ...buf.current,
      { throttle: clamp01(data?.throttle), brake: clamp01(data?.brake) },
    ].slice(-maxPoints);
  }

  return buf.current;
}
