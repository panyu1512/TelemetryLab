/**
 * BridgeConnection — the single WebSocket owner.
 *
 * One socket, multiplexed into channels, fanned out to the Zustand stores. This
 * is the only place that touches the socket: it reconnects with exponential
 * backoff and demultiplexes each envelope to the matching store by writing
 * through `getState()` (no React subscription here — the stores notify
 * components).
 *
 * Resilience is per-channel: if the socket drops we mark it disconnected and
 * clear the ephemeral telemetry frame, but the last-known session/standings
 * remain so the UI degrades gracefully (stale, not blank) until data resumes.
 */

import { RECONNECT_BASE_MS, RECONNECT_MAX_MS, WS_URL } from "../config";
import { pushLog } from "../lib/debugLog";
import { useBridgeStore } from "../stores/useBridgeStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useStandingsStore } from "../stores/useStandingsStore";
import { useTelemetryStore } from "../stores/useTelemetryStore";
import { Channel, parseEnvelope } from "./protocol";

export class BridgeConnection {
  private ws: WebSocket | null = null;
  private stopped = false;
  private attempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly url: string = WS_URL) {}

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.detach(this.ws);
      this.ws.close();
      this.ws = null;
    }
    useBridgeStore.getState().setSocketConnected(false);
  }

  // --- socket lifecycle ---------------------------------------------------
  private detach(sock: WebSocket): void {
    sock.onopen = null;
    sock.onmessage = null;
    sock.onerror = null;
    sock.onclose = null;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const delay = Math.min(
      RECONNECT_BASE_MS * 2 ** this.attempt,
      RECONNECT_MAX_MS
    );
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private open(): void {
    if (this.stopped) return;

    let sock: WebSocket;
    try {
      sock = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = sock;

    sock.onopen = () => {
      this.attempt = 0;
      useBridgeStore.getState().setSocketConnected(true);
      pushLog("info", `Bridge WebSocket connected: ${this.url}`);
    };

    sock.onmessage = (event: MessageEvent) => {
      this.dispatch(event.data as string);
    };

    sock.onerror = () => {
      // A close event always follows; reconnection is handled there.
    };

    sock.onclose = () => {
      if (this.ws !== sock) return; // ignore a socket we already replaced
      this.ws = null;
      const bridge = useBridgeStore.getState();
      bridge.setSocketConnected(false);
      bridge.setIracingActive(false);
      useTelemetryStore.getState().clear();
      pushLog("warn", "Bridge WebSocket disconnected — reconnecting…");
      this.scheduleReconnect();
    };
  }

  // --- channel demux ------------------------------------------------------
  private dispatch(raw: string): void {
    const msg = parseEnvelope(raw);
    if (!msg) return;

    useBridgeStore.getState().setProtocolVersion(msg.v);

    switch (msg.type) {
      case Channel.Telemetry:
        useTelemetryStore
          .getState()
          .setTelemetry(msg.payload, msg.seq);
        break;
      case Channel.Session:
        useSessionStore.getState().setSession(msg.payload);
        break;
      case Channel.Standings:
        useStandingsStore
          .getState()
          .setStandings(msg.payload, msg.seq);
        break;
      case Channel.Bridge: {
        const status = msg.payload;
        const wasActive = useBridgeStore.getState().iracingActive;
        useBridgeStore.getState().setIracingActive(status.iracingActive);
        if (status.iracingActive && !wasActive) {
          pushLog("info", "iRacing session started.");
        } else if (!status.iracingActive && wasActive) {
          pushLog("info", "iRacing session ended.");
        }
        if (!status.iracingActive) {
          // iRacing went away: telemetry is dead, standings are stale.
          useTelemetryStore.getState().clear();
          useStandingsStore.getState().clear();
        }
        break;
      }
    }
  }
}
