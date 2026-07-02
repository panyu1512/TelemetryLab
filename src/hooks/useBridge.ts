import { useEffect } from "react";
import { BridgeConnection } from "../telemetry/connection";
import { useBridgeStore } from "../stores/useBridgeStore";

/**
 * Owns the bridge WebSocket for the app's lifetime and mirrors it into the
 * stores. Call this **once**, high in the tree (e.g. `App`). Everything else
 * reads the data from the individual stores — no prop-drilling, no second
 * socket.
 */

// Module-level singleton with a ref count so React 18 StrictMode's
// double-invoke (and any incidental double-mount) can't open two sockets.
let connection: BridgeConnection | null = null;
let refCount = 0;

export interface BridgeConnectionStatus {
  /** WebSocket to the bridge is open. */
  socketConnected: boolean;
  /** Bridge reports a live iRacing session. */
  iracingActive: boolean;
}

export function useBridge(): BridgeConnectionStatus {
  const socketConnected = useBridgeStore((s) => s.socketConnected);
  const iracingActive = useBridgeStore((s) => s.iracingActive);

  useEffect(() => {
    if (refCount === 0) {
      connection = new BridgeConnection();
      connection.start();
    }
    refCount += 1;

    return () => {
      refCount -= 1;
      if (refCount === 0 && connection) {
        connection.stop();
        connection = null;
      }
    };
  }, []);

  return { socketConnected, iracingActive };
}
