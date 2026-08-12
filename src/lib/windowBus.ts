/**
 * Cross-window event bus — the single mechanism the app uses to keep the main
 * window and every popped-out overlay/widget window in sync.
 *
 * Each Tauri `WebviewWindow` runs its own JavaScript context, so an in-memory
 * store (zustand) in one window never reacts to a mutation in another. This bus
 * bridges that gap with a tiny, transport-agnostic pub/sub:
 *
 *   - **Tauri** — global `emit`/`listen` events reach every window in the app.
 *   - **Browser / dev** — a `BroadcastChannel` reaches every same-origin tab.
 *
 * Messages are tagged with a per-window `origin` id. Tauri delivers a window's
 * own `emit` back to itself, so we drop self-originated messages; the sender has
 * already applied the change locally. `BroadcastChannel` never echoes to the
 * sender, so the same filter is harmless there. The net effect: `broadcast()`
 * only ever drives *other* windows, giving clean event-driven propagation with
 * no polling and no feedback loops.
 */

import type { OverlayConfigSnapshot } from "../stores/useOverlayConfigStore";
import type { RelativeUiSnapshot } from "../stores/useRelativeUiStore";
import type { StandingsUiSnapshot } from "../stores/useStandingsUiStore";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Payload carried by the `window:lock` topic. */
export interface WindowLockEvent {
  label: string;
  locked: boolean;
}

/**
 * The bus contract: every topic and the payload it carries. This map is the
 * single source of truth — {@link BusTopic} is derived from its keys, so a new
 * topic cannot be broadcast or subscribed to until it is declared here with a
 * payload type, and changing a payload type immediately fails every send site.
 */
export interface BusPayloadMap {
  "config:changed": OverlayConfigSnapshot;
  "window:lock": WindowLockEvent;
  /** Pure notification — the receiver re-reads persisted window state. */
  "windows:changed": null;
  "standings-ui:changed": StandingsUiSnapshot;
  "relative-ui:changed": RelativeUiSnapshot;
}

/** Topics carried over the bus. Kept as a closed union for safety. */
export type BusTopic = keyof BusPayloadMap;

/**
 * What a *receiver* may assume about a payload.
 *
 * Senders must supply a complete payload, but a receiver cannot: the message
 * crosses a window boundary and may come from a window running older code (or,
 * in the browser transport, another tab entirely). So object payloads arrive
 * deeply optional and possibly absent, which keeps the defensive
 * `?? DEFAULTS` handling in subscribers honest rather than cast away.
 */
export type ReceivedPayload<K extends BusTopic> =
  BusPayloadMap[K] extends object
    ? Partial<BusPayloadMap[K]> | undefined
    : BusPayloadMap[K] | undefined;

/** A subscriber to topic `K`. */
export type BusHandler<K extends BusTopic> = (
  payload: ReceivedPayload<K>,
) => void;

/** Unique id for this window, used to ignore our own echoed messages. */
const ORIGIN = Math.random().toString(36).slice(2);

/**
 * Erased handler shape used for storage only. The registry is heterogeneous
 * (one entry per topic), so the topic↔payload correlation is enforced at the
 * `subscribe`/`dispatch` boundary rather than by the Map's own type.
 */
type ErasedHandler = (payload: never) => void;

const handlers = new Map<BusTopic, Set<ErasedHandler>>();

// ── BroadcastChannel transport (browser / dev) ────────────────────────────────

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  channel =
    typeof BroadcastChannel !== "undefined"
      ? new BroadcastChannel("telemetrylab.bus")
      : null;
  channel?.addEventListener("message", (e: MessageEvent) => {
    const { topic, origin, payload } = (e.data ?? {}) as {
      topic?: BusTopic;
      origin?: string;
      payload?: ReceivedPayload<BusTopic>;
    };
    if (!topic || origin === ORIGIN) return;
    dispatch(topic, payload);
  });
  return channel;
}

// ── Tauri transport ───────────────────────────────────────────────────────────

const tauriListening = new Set<BusTopic>();

function ensureTauriListener<K extends BusTopic>(topic: K): void {
  if (!isTauri || tauriListening.has(topic)) return;
  tauriListening.add(topic);
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<{ origin: string; payload: ReceivedPayload<K> }>(
      `bus://${topic}`,
      (event) => {
        if (event.payload?.origin === ORIGIN) return;
        dispatch(topic, event.payload?.payload);
      },
    );
  });
}

// ── dispatch ──────────────────────────────────────────────────────────────────

function dispatch<K extends BusTopic>(
  topic: K,
  payload: ReceivedPayload<K>,
): void {
  const set = handlers.get(topic);
  if (!set) return;
  for (const h of set as Set<BusHandler<K>>) {
    try {
      h(payload);
    } catch (err) {
      // A misbehaving subscriber must not break delivery to the others.
      // eslint-disable-next-line no-console
      console.error(`[windowBus] handler for "${topic}" threw:`, err);
    }
  }
}

// ── public API ──────────────────────────────────────────────────────────────

/** Send a message to every *other* window. Fire-and-forget. */
export function broadcast<K extends BusTopic>(
  topic: K,
  payload: BusPayloadMap[K],
): void {
  getChannel()?.postMessage({ topic, origin: ORIGIN, payload });
  if (isTauri) {
    import("@tauri-apps/api/event").then(({ emit }) => {
      emit(`bus://${topic}`, { origin: ORIGIN, payload });
    });
  }
}

/** Subscribe to a topic. Returns an unsubscribe function. */
export function subscribe<K extends BusTopic>(
  topic: K,
  handler: BusHandler<K>,
): () => void {
  let set = handlers.get(topic);
  if (!set) {
    set = new Set();
    handlers.set(topic, set);
  }
  set.add(handler as ErasedHandler);

  // Make sure the underlying transports are wired up for this topic.
  getChannel();
  ensureTauriListener(topic);

  return () => {
    handlers.get(topic)?.delete(handler as ErasedHandler);
  };
}
