"use client";

export type SessionActivityLogLevel = "info" | "warn" | "error";
export type SessionActivityLogScope = "session-socket" | "managed-avatar" | "tutor-session";

export type SessionActivityLogEntry = {
  event: string;
  id: string;
  level: SessionActivityLogLevel;
  metadata?: Record<string, unknown>;
  scope: SessionActivityLogScope;
  summary: string;
  ts: string;
};

const MAX_SESSION_ACTIVITY_LOG_ENTRIES = 200;
const listeners = new Set<(entries: SessionActivityLogEntry[]) => void>();
let entries: SessionActivityLogEntry[] = [];

function emit() {
  for (const listener of listeners) {
    listener(entries);
  }
}

function nextLogId() {
  return globalThis.crypto?.randomUUID?.() ?? `log-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function appendSessionActivityLog(input: Omit<SessionActivityLogEntry, "id" | "ts"> & { ts?: string }) {
  entries = [
    ...entries,
    {
      ...input,
      id: nextLogId(),
      ts: input.ts ?? new Date().toISOString(),
    },
  ].slice(-MAX_SESSION_ACTIVITY_LOG_ENTRIES);
  emit();
}

export function getSessionActivityLogSnapshot(limit?: number) {
  if (!limit || limit <= 0) {
    return [...entries];
  }

  return entries.slice(-limit);
}

export function subscribeSessionActivityLog(listener: (entries: SessionActivityLogEntry[]) => void) {
  listeners.add(listener);
  listener(entries);
  return () => {
    listeners.delete(listener);
  };
}

export function resetSessionActivityLogForTests() {
  entries = [];
  emit();
}
