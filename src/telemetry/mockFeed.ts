/**
 * MockFeed — drives the Zustand stores from the client-side mock generators
 * (see `lib/mockData.ts`) instead of a real WebSocket.
 *
 * It exposes the same `start()` / `stop()` surface as {@link BridgeConnection}
 * so `useBridge` can swap between them transparently. When running it reports
 * the socket as "connected" and iRacing as "active", pushes a high-frequency
 * telemetry frame plus lower-frequency session/standings updates, and clears
 * everything on stop.
 */

import { pushLog } from "../lib/debugLog";
import {
  MOCK_START_OFFSET_S,
  MOCK_TIME_SCALE,
  mockPlayerTelemetry,
  mockSession,
  mockStandings,
} from "../lib/mockData";
import { useBridgeStore } from "../stores/useBridgeStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useStandingsStore } from "../stores/useStandingsStore";
import { useTelemetryStore } from "../stores/useTelemetryStore";

const TELEMETRY_HZ = 30;
const STANDINGS_HZ = 5;
const SESSION_MS = 1000;

export class MockFeed {
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private standingsTimer: ReturnType<typeof setInterval> | null = null;
  private sessionTimer: ReturnType<typeof setInterval> | null = null;
  private start_ = 0;
  private seq = 0;

  start(): void {
    if (this.telemetryTimer) return;
    this.start_ = Date.now();
    this.seq = 0;

    const bridge = useBridgeStore.getState();
    bridge.setProtocolVersion(1);
    bridge.setSocketConnected(true);
    bridge.setIracingActive(true);
    pushLog("info", "Mock data mode enabled — synthesizing telemetry offline.");

    // Prime the session/standings once immediately so the UI isn't blank.
    this.pushSession();
    this.pushStandings();

    this.telemetryTimer = setInterval(() => this.pushTelemetry(), 1000 / TELEMETRY_HZ);
    this.standingsTimer = setInterval(() => this.pushStandings(), 1000 / STANDINGS_HZ);
    this.sessionTimer = setInterval(() => this.pushSession(), SESSION_MS);
  }

  stop(): void {
    for (const timer of [this.telemetryTimer, this.standingsTimer, this.sessionTimer]) {
      if (timer) clearInterval(timer);
    }
    this.telemetryTimer = null;
    this.standingsTimer = null;
    this.sessionTimer = null;

    const bridge = useBridgeStore.getState();
    bridge.setIracingActive(false);
    bridge.setSocketConnected(false);
    useTelemetryStore.getState().clear();
    useStandingsStore.getState().clear();
    pushLog("info", "Mock data mode disabled.");
  }

  /**
   * Mock-session time. Two adjustments over the wall clock, both explained
   * where they are declared in `lib/mockData.ts`: the feed opens mid-race
   * rather than on a formation lap, and it runs `MOCK_TIME_SCALE` faster so
   * lap-boundary figures arrive while someone is still looking at the screen.
   */
  private elapsed(): number {
    return (
      MOCK_START_OFFSET_S + ((Date.now() - this.start_) / 1000) * MOCK_TIME_SCALE
    );
  }

  private pushTelemetry(): void {
    useTelemetryStore
      .getState()
      .setTelemetry(mockPlayerTelemetry(this.elapsed()), this.seq++);
  }

  private pushStandings(): void {
    useStandingsStore
      .getState()
      .setStandings(mockStandings(this.elapsed()), this.seq++);
  }

  private pushSession(): void {
    useSessionStore.getState().setSession(mockSession(this.elapsed()));
  }
}
