/** Lightweight in-memory log buffer for the v0.7.0 debug panel. */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: number;
  level: LogLevel;
  msg: string;
}

const MAX_LOG = 300;
const BUFFER: LogEntry[] = [];
const LISTENERS = new Set<() => void>();

export function pushLog(level: LogLevel, msg: string): void {
  BUFFER.push({ ts: Date.now(), level, msg });
  if (BUFFER.length > MAX_LOG) BUFFER.splice(0, BUFFER.length - MAX_LOG);
  LISTENERS.forEach((fn) => fn());
}

export function getLog(): readonly LogEntry[] {
  return BUFFER;
}

export function clearLog(): void {
  BUFFER.splice(0);
  LISTENERS.forEach((fn) => fn());
}

export function subscribeLog(fn: () => void): () => void {
  LISTENERS.add(fn);
  return () => LISTENERS.delete(fn);
}
