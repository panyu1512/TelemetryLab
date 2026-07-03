import { useEffect } from "react";
import { BridgeConnection } from "../telemetry/connection";
import { MockFeed } from "../telemetry/mockFeed";
import { useBridgeStore } from "../stores/useBridgeStore";
import { useOverlayConfigStore } from "../stores/useOverlayConfigStore";

/**
 * Owns the telemetry source for the app's lifetime and mirrors it into the
 * stores. Call this **once**, high in the tree (e.g. `App`). Everything else
 * reads the data from the individual stores — no prop-drilling, no second
 * socket.
 *
 * The source is either the live {@link BridgeConnection} (a WebSocket to the
 * Python bridge) or, when the user turns on **Mock Data** in Global Settings,
 * the client-side {@link MockFeed}. Both share the same `start()` / `stop()`
 * shape so we can hot-swap between them when the toggle changes.
 */

/** Minimal shape shared by the real bridge and the mock feed. */
interface TelemetrySource {
  start(): void;
  stop(): void;
}

// Module-level singleton with a ref count so React 18 StrictMode's
// double-invoke (and any incidental double-mount) can't open two sockets.
let source: TelemetrySource | null = null;
let refCount = 0;
let usingMock = false;

function buildSource(mock: boolean): void {
  usingMock = mock;
  source = mock ? new MockFeed() : new BridgeConnection();
  source.start();
}

export interface BridgeConnectionStatus {
  /** WebSocket to the bridge is open (or mock feed is running). */
  socketConnected: boolean;
  /** Bridge reports a live iRacing session (always true under mock data). */
  iracingActive: boolean;
}

export function useBridge(): BridgeConnectionStatus {
  const socketConnected = useBridgeStore((s) => s.socketConnected);
  const iracingActive = useBridgeStore((s) => s.iracingActive);
  const mockEnabled = useOverlayConfigStore(
    (s) => s.globalSettings.mockDataEnabled
  );

  useEffect(() => {
    if (refCount === 0) buildSource(mockEnabled);
    refCount += 1;

    return () => {
      refCount -= 1;
      if (refCount === 0 && source) {
        source.stop();
        source = null;
      }
    };
    // Intentionally start once; the toggle is handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hot-swap the source when the Mock Data toggle flips at runtime.
  useEffect(() => {
    if (refCount === 0 || !source || mockEnabled === usingMock) return;
    source.stop();
    buildSource(mockEnabled);
  }, [mockEnabled]);

  return { socketConnected, iracingActive };
}
