/**
 * Wire protocol — the TypeScript counterpart of `bridge/telemetrylab/protocol.py`.
 *
 * Every WebSocket message is a versioned, channel-tagged envelope. The client
 * routes by `type` into the matching Zustand store. `seq` (per-channel) lets us
 * detect dropped/reordered frames; `v` guards against a bridge speaking a
 * protocol we don't understand.
 */

import type {
  BridgeStatus,
  PlayerTelemetry,
  SessionInfo,
  StandingsPayload,
} from "./types";

export const PROTOCOL_VERSION = 1;

export const Channel = {
  Telemetry: "telemetry",
  Session: "session",
  Standings: "standings",
  Bridge: "bridge",
} as const;

export type ChannelName = (typeof Channel)[keyof typeof Channel];

/** The generic envelope wrapping every payload. */
export interface Envelope<T = unknown> {
  /** Protocol version. */
  v: number;
  type: string;
  /** Server wall-clock time, ms since epoch. */
  timestamp: number;
  /** Per-channel monotonic sequence number. */
  seq: number;
  payload: T;
}

/**
 * Discriminated union of the channels we handle. The bridge sends `ts`; older
 * spec drafts called it `timestamp`, so we accept either on the wire (see
 * `parseEnvelope`) and normalize to `timestamp` here.
 */
export type BridgeMessage =
  | (Envelope<PlayerTelemetry> & { type: typeof Channel.Telemetry })
  | (Envelope<SessionInfo> & { type: typeof Channel.Session })
  | (Envelope<StandingsPayload> & { type: typeof Channel.Standings })
  | (Envelope<BridgeStatus> & { type: typeof Channel.Bridge });

interface RawEnvelope {
  v?: number;
  type?: string;
  ts?: number;
  timestamp?: number;
  seq?: number;
  payload?: unknown;
}

/**
 * Parse and validate a raw WebSocket frame into a typed envelope, or return
 * null for anything malformed / from an unknown protocol version. Normalizes
 * the timestamp field name (`ts` on the wire → `timestamp` in the app).
 */
export function parseEnvelope(raw: string): BridgeMessage | null {
  let msg: RawEnvelope;
  try {
    msg = JSON.parse(raw) as RawEnvelope;
  } catch {
    return null;
  }
  if (!msg || typeof msg.type !== "string" || msg.payload === undefined) {
    return null;
  }
  if (msg.v !== undefined && msg.v !== PROTOCOL_VERSION) {
    return null;
  }
  return {
    v: msg.v ?? PROTOCOL_VERSION,
    type: msg.type,
    timestamp: msg.ts ?? msg.timestamp ?? Date.now(),
    seq: msg.seq ?? 0,
    payload: msg.payload,
  } as BridgeMessage;
}
