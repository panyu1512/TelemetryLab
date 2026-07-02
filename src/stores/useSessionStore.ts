import { create } from "zustand";
import { useMemo } from "react";
import type { DriverEntry, SessionInfo } from "../telemetry/types";

/**
 * Low-frequency session state: roster + rules + track + weather + SOF.
 *
 * Updates arrive on change / ~1 Hz, so this store is cheap and can be selected
 * broadly. Row components should still avoid pulling the whole `drivers` array;
 * use {@link useDriver} to subscribe to a single entry.
 */
export interface SessionState {
  session: SessionInfo | null;
  setSession: (session: SessionInfo) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
  clear: () => set({ session: null }),
}));

/** Subscribe to a single driver by carIdx (roster changes are rare/cheap). */
export function useDriver(carIdx: number): DriverEntry | undefined {
  const drivers = useSessionStore((s) => s.session?.drivers);
  return useMemo(
    () => drivers?.find((d) => d.carIdx === carIdx),
    [drivers, carIdx]
  );
}

/** Roster indexed by carIdx, memoized so it only rebuilds when the roster does. */
export function useDriversByIdx(): Map<number, DriverEntry> {
  const drivers = useSessionStore((s) => s.session?.drivers);
  return useMemo(() => {
    const map = new Map<number, DriverEntry>();
    for (const d of drivers ?? []) map.set(d.carIdx, d);
    return map;
  }, [drivers]);
}
