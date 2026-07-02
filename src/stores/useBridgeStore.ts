import { create } from "zustand";

/**
 * Connection status, separated from the data channels so status changes don't
 * churn the (much larger) session/standings/telemetry state and vice-versa.
 *
 * - `socketConnected`: the WebSocket to the bridge is open.
 * - `iracingActive`: the bridge reports a live iRacing session (from the
 *   `bridge` channel). When false, the other stores hold the last-known (stale)
 *   world; the UI can dim/badge accordingly rather than blanking out.
 */
export interface BridgeState {
  socketConnected: boolean;
  iracingActive: boolean;
  protocolVersion: number | null;
  setSocketConnected: (connected: boolean) => void;
  setIracingActive: (active: boolean) => void;
  setProtocolVersion: (v: number) => void;
}

export const useBridgeStore = create<BridgeState>((set) => ({
  socketConnected: false,
  iracingActive: false,
  protocolVersion: null,
  setSocketConnected: (socketConnected) =>
    set((s) =>
      s.socketConnected === socketConnected
        ? s
        : { socketConnected, iracingActive: socketConnected && s.iracingActive }
    ),
  setIracingActive: (iracingActive) =>
    set((s) => (s.iracingActive === iracingActive ? s : { iracingActive })),
  setProtocolVersion: (protocolVersion) => set({ protocolVersion }),
}));
