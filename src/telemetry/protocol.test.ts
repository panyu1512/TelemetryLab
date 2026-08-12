import { describe, expect, it } from "vitest";

import type { Equals, Expect, ExpectFalse } from "../lib/typeAssert";
import type {
  BridgeMessage,
  ChannelName,
  PayloadFor,
} from "./protocol";
import { Channel, isChannelName, parseEnvelope, PROTOCOL_VERSION } from "./protocol";
import type {
  BridgeStatus,
  PlayerTelemetry,
  SessionInfo,
  StandingsPayload,
} from "./types";

function frame(obj: unknown): string {
  return JSON.stringify(obj);
}

describe("parseEnvelope", () => {
  it("parses a well-formed telemetry envelope", () => {
    const msg = parseEnvelope(
      frame({
        v: PROTOCOL_VERSION,
        type: Channel.Telemetry,
        ts: 1719936000123,
        seq: 42,
        payload: { speed: 240 },
      }),
    );
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe(Channel.Telemetry);
    expect(msg!.timestamp).toBe(1719936000123);
    expect(msg!.seq).toBe(42);
    expect(msg!.payload).toEqual({ speed: 240 });
  });

  it("normalizes the legacy `timestamp` field name to `timestamp`", () => {
    const msg = parseEnvelope(
      frame({ type: Channel.Session, timestamp: 123, seq: 1, payload: {} }),
    );
    expect(msg!.timestamp).toBe(123);
  });

  it("prefers `ts` over `timestamp` when both are present", () => {
    const msg = parseEnvelope(
      frame({ type: Channel.Bridge, ts: 111, timestamp: 222, seq: 0, payload: {} }),
    );
    expect(msg!.timestamp).toBe(111);
  });

  it("defaults a missing seq to 0 and version to the current one", () => {
    const msg = parseEnvelope(frame({ type: Channel.Standings, payload: {} }));
    expect(msg!.seq).toBe(0);
    expect(msg!.v).toBe(PROTOCOL_VERSION);
  });

  it("returns null for invalid JSON", () => {
    expect(parseEnvelope("{not json")).toBeNull();
    expect(parseEnvelope("")).toBeNull();
  });

  it("returns null when the type is missing or non-string", () => {
    expect(parseEnvelope(frame({ payload: {} }))).toBeNull();
    expect(parseEnvelope(frame({ type: 5, payload: {} }))).toBeNull();
  });

  it("returns null when the payload is absent", () => {
    expect(parseEnvelope(frame({ type: Channel.Telemetry }))).toBeNull();
  });

  it("accepts a null payload (present but null)", () => {
    // `payload: null` is *present*, so it is not the same as an absent payload.
    const msg = parseEnvelope(frame({ type: Channel.Bridge, payload: null }));
    expect(msg).not.toBeNull();
    expect(msg!.payload).toBeNull();
  });

  it("rejects a mismatched protocol version", () => {
    expect(
      parseEnvelope(frame({ v: 999, type: Channel.Telemetry, payload: {} })),
    ).toBeNull();
  });

  it("accepts an envelope that omits the version entirely", () => {
    const msg = parseEnvelope(frame({ type: Channel.Telemetry, payload: {} }));
    expect(msg).not.toBeNull();
  });

  it("falls back to a client timestamp when none is provided", () => {
    const before = Date.now();
    const msg = parseEnvelope(frame({ type: Channel.Session, payload: {} }));
    const after = Date.now();
    expect(msg!.timestamp).toBeGreaterThanOrEqual(before);
    expect(msg!.timestamp).toBeLessThanOrEqual(after);
  });

  it("returns null for a JSON literal that is not an object", () => {
    expect(parseEnvelope("null")).toBeNull();
    expect(parseEnvelope("42")).toBeNull();
  });
});

describe("isChannelName", () => {
  it("accepts every declared channel", () => {
    for (const name of Object.values(Channel)) {
      expect(isChannelName(name)).toBe(true);
    }
  });

  it("rejects a channel the client does not handle", () => {
    expect(isChannelName("weather")).toBe(false);
  });

  it("makes parseEnvelope reject an unknown channel", () => {
    // Previously such a frame was cast into a BridgeMessage that lied about its
    // type; it must not reach the demuxer at all.
    expect(
      parseEnvelope(frame({ type: "weather", seq: 1, payload: {} })),
    ).toBeNull();
  });
});

// ── type-level contracts ─────────────────────────────────────────────────────
// These never run; they fail the build if the protocol's inference regresses.

/** Each channel narrows to exactly its declared payload. */
export type _TelemetryPayload = Expect<
  Equals<Extract<BridgeMessage, { type: "telemetry" }>["payload"], PlayerTelemetry>
>;
export type _SessionPayload = Expect<
  Equals<PayloadFor<"session">, SessionInfo>
>;
export type _StandingsPayload = Expect<
  Equals<PayloadFor<"standings">, StandingsPayload>
>;
export type _BridgePayload = Expect<Equals<PayloadFor<"bridge">, BridgeStatus>>;

/** The union stays exhaustive: its `type` covers every channel, no more. */
export type _TypeCoversChannels = Expect<
  Equals<BridgeMessage["type"], ChannelName>
>;

/** A payload is never assignable to the wrong channel. */
export type _NoCrossChannelPayload = ExpectFalse<
  Equals<PayloadFor<"telemetry">, PayloadFor<"session">>
>;
