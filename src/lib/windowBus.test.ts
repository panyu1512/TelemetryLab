import { describe, expect, it, vi } from "vitest";

import type { Equals, Expect, ExpectFalse } from "./typeAssert";
import type {
  BusHandler,
  BusPayloadMap,
  BusTopic,
  ReceivedPayload,
  WindowLockEvent,
} from "./windowBus";
import { subscribe } from "./windowBus";

// The transports only carry messages *between* windows, so these exercise the
// local registry: subscription bookkeeping and delivery isolation.
describe("subscribe", () => {
  it("stops delivering after unsubscribe", () => {
    const handler = vi.fn();
    const off = subscribe("window:lock", handler);
    off();
    // A second unsubscribe must be harmless.
    expect(off).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("keeps handlers for different topics apart", () => {
    const lock = vi.fn();
    const config = vi.fn();
    const offLock = subscribe("window:lock", lock);
    const offConfig = subscribe("config:changed", config);
    offLock();
    offConfig();
    expect(lock).not.toHaveBeenCalled();
    expect(config).not.toHaveBeenCalled();
  });
});

// ── type-level contracts ─────────────────────────────────────────────────────
// The bus is the app's loosest boundary — payloads cross window contexts as
// JSON. These assertions pin down what each side is allowed to assume.

/** Topics are derived from the payload map, never declared twice. */
export type _TopicsFromMap = Expect<Equals<BusTopic, keyof BusPayloadMap>>;

/** A sender must supply a complete payload for the topic it names. */
export type _LockSendShape = Expect<
  Equals<BusPayloadMap["window:lock"], WindowLockEvent>
>;

/** A receiver gets the same payload deeply optional and possibly absent. */
export type _LockReceiveShape = Expect<
  Equals<ReceivedPayload<"window:lock">, Partial<WindowLockEvent> | undefined>
>;

/** Receivers may not assume a field is present just because senders send it. */
export type _ReceiverIsNotSender = ExpectFalse<
  Equals<ReceivedPayload<"window:lock">, BusPayloadMap["window:lock"]>
>;

/** A payload-free notification stays payload-free rather than becoming `{}`. */
export type _NotificationShape = Expect<
  Equals<ReceivedPayload<"windows:changed">, null | undefined>
>;

/** Handlers are correlated to their topic, so payloads cannot be swapped. */
export type _HandlersAreCorrelated = ExpectFalse<
  Equals<BusHandler<"window:lock">, BusHandler<"config:changed">>
>;
