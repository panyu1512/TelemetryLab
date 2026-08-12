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

/**
 * The single source of truth mapping each channel to the payload it carries.
 * Adding a channel here (plus an entry in {@link Channel}) is all it takes:
 * {@link BridgeMessage} and {@link PayloadFor} follow automatically, and the
 * `switch` in `BridgeConnection.dispatch` stops compiling until it is handled.
 */
export interface ChannelPayloadMap {
  [Channel.Telemetry]: PlayerTelemetry;
  [Channel.Session]: SessionInfo;
  [Channel.Standings]: StandingsPayload;
  [Channel.Bridge]: BridgeStatus;
}

/** The payload type carried by a given channel. */
export type PayloadFor<K extends ChannelName> = ChannelPayloadMap[K];

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
export type BridgeMessage = {
  [K in ChannelName]: Omit<Envelope<PayloadFor<K>>, "type"> & { type: K };
}[ChannelName];

/** Narrow an arbitrary `type` string to a channel we actually handle. */
export function isChannelName(value: string): value is ChannelName {
  return (Object.values(Channel) as string[]).includes(value);
}

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
  if (!isChannelName(msg.type)) {
    return null;
  }
  return tagged(
    msg.type,
    {
      v: msg.v ?? PROTOCOL_VERSION,
      timestamp: msg.ts ?? msg.timestamp ?? Date.now(),
      seq: msg.seq ?? 0,
    },
    msg.payload,
  );
}

/**
 * The protocol's single trust boundary: pair a *validated* channel with its
 * still-unverified payload. Everything downstream is correlated by `K`, so this
 * is the only assertion in the module — consumers get exhaustive narrowing for
 * free, and a payload can never be attached to the wrong channel by mistake.
 */
function tagged<K extends ChannelName>(
  type: K,
  head: Omit<Envelope, "type" | "payload">,
  payload: unknown,
): Extract<BridgeMessage, { type: K }> {
  return { ...head, type, payload } as Extract<BridgeMessage, { type: K }>;
}
