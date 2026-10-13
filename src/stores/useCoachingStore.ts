import { create } from "zustand";
import type { CoachingPayload } from "../telemetry/types";

/**
 * The coach's latest analysis (`coaching` channel) — one payload per completed
 * lap, replayed by the bridge to a client that connects mid-session.
 *
 * It holds the last payload as the bridge sent it. Which corners become tips,
 * and above what loss, is decided at render time by `lib/coaching.ts` from the
 * Manager's coach options, so changing those re-renders the open overlay
 * without waiting for another lap.
 */
export interface CoachingState {
  coaching: CoachingPayload | null;
  setCoaching: (payload: CoachingPayload) => void;
  clear: () => void;
}

export const useCoachingStore = create<CoachingState>((set) => ({
  coaching: null,
  setCoaching: (coaching) => set({ coaching }),
  clear: () => set({ coaching: null }),
}));
