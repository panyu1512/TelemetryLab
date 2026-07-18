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

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Topics carried over the bus. Kept as a closed union for safety. */
export type BusTopic =
  | "config:changed"
  | "window:lock"
  | "windows:changed"
  | "standings-ui:changed"
  | "relative-ui:changed";

/** Unique id for this window, used to ignore our own echoed messages. */
const ORIGIN = Math.random().toString(36).slice(2);

type Handler = (payload: unknown) => void;

const handlers = new Map<BusTopic, Set<Handler>>();

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
      payload?: unknown;
    };
    if (!topic || origin === ORIGIN) return;
    dispatch(topic, payload);
  });
  return channel;
}

// ── Tauri transport ───────────────────────────────────────────────────────────

const tauriListening = new Set<BusTopic>();

function ensureTauriListener(topic: BusTopic): void {
  if (!isTauri || tauriListening.has(topic)) return;
  tauriListening.add(topic);
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen<{ origin: string; payload: unknown }>(`bus://${topic}`, (event) => {
      if (event.payload?.origin === ORIGIN) return;
      dispatch(topic, event.payload?.payload);
    });
  });
}

// ── dispatch ──────────────────────────────────────────────────────────────────

function dispatch(topic: BusTopic, payload: unknown): void {
  const set = handlers.get(topic);
  if (!set) return;
  for (const h of set) {
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
export function broadcast(topic: BusTopic, payload: unknown): void {
  getChannel()?.postMessage({ topic, origin: ORIGIN, payload });
  if (isTauri) {
    import("@tauri-apps/api/event").then(({ emit }) => {
      emit(`bus://${topic}`, { origin: ORIGIN, payload });
    });
  }
}

/** Subscribe to a topic. Returns an unsubscribe function. */
export function subscribe(topic: BusTopic, handler: Handler): () => void {
  let set = handlers.get(topic);
  if (!set) {
    set = new Set();
    handlers.set(topic, set);
  }
  set.add(handler);

  // Make sure the underlying transports are wired up for this topic.
  getChannel();
  ensureTauriListener(topic);

  return () => {
    handlers.get(topic)?.delete(handler);
  };
}
