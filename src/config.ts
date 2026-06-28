/**
 * Connection configuration for the telemetry bridge.
 *
 * The bridge (Python sidecar `iracing-bridge` or `mock_bridge.py`) exposes a
 * WebSocket server. The host/port are configurable through Vite env vars so the
 * frontend never hardcodes `localhost`:
 *
 *   VITE_WS_HOST=192.168.1.50 VITE_WS_PORT=8765 npm run dev
 */
export const WS_HOST: string = import.meta.env.VITE_WS_HOST ?? "127.0.0.1";
export const WS_PORT: string = import.meta.env.VITE_WS_PORT ?? "8765";

export const WS_URL = `ws://${WS_HOST}:${WS_PORT}`;

/** Reconnect backoff (exponential): 1s, 2s, 4s ... capped at MAX. */
export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 10000;
