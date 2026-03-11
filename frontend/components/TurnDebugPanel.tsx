"use client";

import React from "react";

import type { PersistedTurnDebug } from "../lib/lesson_thread_store";

type TurnDebugPanelProps = {
  debug?: PersistedTurnDebug;
  turnId: string;
};

export function TurnDebugPanel({ debug, turnId }: TurnDebugPanelProps) {
  if (!debug) {
    return null;
  }

  return (
    <details className="turn-debug" data-testid={`turn-debug-${turnId}`}>
      <summary className="turn-debug__summary">Debug</summary>
      <pre className="turn-debug__payload">{JSON.stringify(debug, null, 2)}</pre>
    </details>
  );
}
