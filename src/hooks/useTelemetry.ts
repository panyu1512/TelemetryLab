import { useEffect, useRef, useState, useCallback } from "react";
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

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const closedByUs = useRef(false);

  const connect = useCallback(() => {
    // Clean up any previous socket before opening a new one.
    if (wsRef.current) {
      closedByUs.current = true;
      wsRef.current.close();
      wsRef.current = null;
    }
    closedByUs.current = false;

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      attemptRef.current = 0;
      setConnected(true);
    };

    ws.onmessage = (event: MessageEvent) => {
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

    ws.onerror = () => {
      // The close handler will take care of reconnection.
      ws.close();
    };

    ws.onclose = () => {
      setConnected(false);
      setIracingActive(false);
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
      if (!closedByUs.current) {
        scheduleReconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimer.current) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** attemptRef.current,
      RECONNECT_MAX_MS
    );
    attemptRef.current += 1;
    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null;
      connect();
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      closedByUs.current = true;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { data, connected, iracingActive };
}
