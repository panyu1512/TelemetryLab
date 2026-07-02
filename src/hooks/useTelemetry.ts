/**
 * Backward-compatible telemetry adapter.
 *
 * v0.3.0 moved the WebSocket onto a multi-channel protocol fed into Zustand
 * stores (see `hooks/useBridge.ts` + `stores/`). This hook is kept as the
 * single-car view the existing dashboard widgets were built against: it selects
 * the player frame from `useTelemetryStore` and the connection flags from
 * `useBridgeStore`, so no widget had to change.
 *
 * New code should prefer selecting from the stores directly (e.g.
 * `useTelemetryStore(s => s.telemetry?.rpm)`), which re-renders only on the
 * fields it reads. The connection itself is owned by `useBridge()`.
 */

import { useBridgeStore } from "../stores/useBridgeStore";
import { useTelemetryStore } from "../stores/useTelemetryStore";
import type { PlayerTelemetry } from "../telemetry/types";

// Re-export the telemetry types under their historical names/location so
// existing imports (`import type { TelemetryData } from ".../useTelemetry"`)
// keep resolving.
export type { PlayerTelemetry, TyreData, TyreSet } from "../telemetry/types";

/** @deprecated Use {@link PlayerTelemetry}. Kept for existing widget imports. */
export type TelemetryData = PlayerTelemetry;

export interface UseTelemetryState {
  /** Latest player telemetry frame, or null when no active session. */
  data: PlayerTelemetry | null;
  /** WebSocket to the bridge is open. */
  connected: boolean;
  /** Bridge reports an active iRacing session. */
  iracingActive: boolean;
}

/**
 * Read the current player telemetry + connection flags from the stores.
 *
 * Note: this no longer opens the socket — `useBridge()` (called once in `App`)
 * does. This hook is purely a selector.
 */
export function useTelemetry(): UseTelemetryState {
  const data = useTelemetryStore((s) => s.telemetry);
  const connected = useBridgeStore((s) => s.socketConnected);
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  return { data, connected, iracingActive };
}
