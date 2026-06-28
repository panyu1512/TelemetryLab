import { useEffect, useState } from "react";
import {
  WS_URL,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
} from "../config";

/** Per-tyre temperatures (carcass, left/middle/right) and pressure. */
export interface TyreData {
  /** Left carcass temperature (°C). */
  tempL: number | null;
  /** Middle carcass temperature (°C). */
  tempM: number | null;
  /** Right carcass temperature (°C). */
  tempR: number | null;
  /** Tyre pressure (kPa) — may be null when iRacing does not expose it live. */
  pressure: number | null;
}

export interface TyreSet {
  lf: TyreData;
  rf: TyreData;
  lr: TyreData;
  rr: TyreData;
}

/** A full telemetry frame as emitted by the bridge when iRacing is active. */
export interface TelemetryData {
  connected: true;

  /** Session clock (seconds). */
  sessionTime: number | null;

  /** Raw speed (m/s) and the km/h conversion. */
  speed: number | null;
  speedKmh: number | null;

  rpm: number | null;
  /** Gear: -1 reverse, 0 neutral, 1..n forward. */
  gear: number | null;
  /** Throttle/brake as 0..1. */
  throttle: number | null;
  brake: number | null;

  /** Steering wheel angle in radians and the degrees conversion. */
  steeringWheelAngle: number | null;
  steeringDeg: number | null;

  /** Fuel in litres and as a 0..1 fraction of the tank. */
  fuelLevel: number | null;
  fuelLevelPct: number | null;

  lapCurrentLapTime: number | null;
  lapBestLapTime: number | null;
  lapLastLapTime: number | null;
  lap: number | null;
  playerCarPosition: number | null;

  /** Lateral / longitudinal acceleration (m/s²). */
  latAccel: number | null;
  lonAccel: number | null;

  onPitRoad: boolean | null;

  airTemp: number | null;
  trackTemp: number | null;

  tyres: TyreSet;
}

/** Message shape when iRacing is not running / not connected. */
interface DisconnectedMessage {
  connected: false;
}

type BridgeMessage = TelemetryData | DisconnectedMessage;

export interface UseTelemetryState {
  /** Latest telemetry frame, or null while no active iRacing session. */
  data: TelemetryData | null;
  /** Whether the WebSocket to the bridge is currently open. */
  connected: boolean;
  /** Whether the bridge reports an active iRacing session. */
  iracingActive: boolean;
}

/**
 * Subscribes to the bridge WebSocket and exposes the live telemetry state.
 *
 * - Reconnects automatically with exponential backoff (1s, 2s, 4s ... 10s max).
 * - `connected` reflects the socket; `iracingActive` reflects the `connected`
 *   flag inside the bridge messages.
 */
export function useTelemetry(url: string = WS_URL): UseTelemetryState {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [connected, setConnected] = useState(false);
  const [iracingActive, setIracingActive] = useState(false);

  useEffect(() => {
    // All connection state lives in the effect closure so it can never get out
    // of sync across renders (the shared-ref version mistook intentional closes
    // for drops and reconnected in a loop).
    let stopped = false;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    // Detach handlers so a socket we close on purpose can't trigger reconnects.
    const detach = (sock: WebSocket) => {
      sock.onopen = null;
      sock.onmessage = null;
      sock.onerror = null;
      sock.onclose = null;
    };

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer) return;
      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** attempt,
        RECONNECT_MAX_MS
      );
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        open();
      }, delay);
    };

    const open = () => {
      if (stopped) return;

      let sock: WebSocket;
      try {
        sock = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      ws = sock;

      sock.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      sock.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as BridgeMessage;
          if (msg.connected) {
            setIracingActive(true);
            setData(msg);
          } else {
            setIracingActive(false);
            setData(null);
          }
        } catch {
          // Ignore malformed frames.
        }
      };

      sock.onerror = () => {
        // A close event always follows; reconnection is handled there.
      };

      sock.onclose = () => {
        // Only react to the *current* socket dropping unexpectedly.
        if (ws !== sock) return;
        ws = null;
        setConnected(false);
        setIracingActive(false);
        scheduleReconnect();
      };
    };

    open();

    return () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        detach(ws);
        ws.close();
        ws = null;
      }
    };
  }, [url]);

  return { data, connected, iracingActive };
}
