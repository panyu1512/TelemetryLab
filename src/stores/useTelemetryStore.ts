import { create } from "zustand";
import type { PlayerTelemetry } from "../telemetry/types";

/**
 * High-frequency (~60 Hz) player telemetry.
 *
 * This intentionally holds a single mutable-by-replacement frame. Consumers
 * that only need one field should select it precisely, e.g.
 * `useTelemetryStore(s => s.telemetry?.rpm)`, so React bails out of renders when
 * that field is unchanged between frames.
 */
export interface TelemetryState {
  telemetry: PlayerTelemetry | null;
  /** Envelope seq of the last applied frame (drop-detection / debugging). */
  seq: number;
  setTelemetry: (frame: PlayerTelemetry, seq: number) => void;
  clear: () => void;
}

export const useTelemetryStore = create<TelemetryState>((set) => ({
  telemetry: null,
  seq: -1,
  setTelemetry: (telemetry, seq) => set({ telemetry, seq }),
  clear: () => set({ telemetry: null, seq: -1 }),
}));
