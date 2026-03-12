"use client";

import React from "react";

import type { PersistedTurnDebug } from "../lib/lesson_thread_store";

type TurnDebugPanelProps = {
  debug?: PersistedTurnDebug;
  turnId: string;
};

export function TurnDebugPanel({ debug, turnId }: TurnDebugPanelProps) {
  const startedAtLabel = debug?.derivedFromLegacyTurn || !debug?.startedAt
    ? "legacy"
    : new Date(debug.startedAt).toLocaleTimeString();
  const timestampWindow = debug && debug.response.timestampCount > 0
    ? `${debug.response.firstTimestampMs ?? 0} ms -> ${debug.response.lastTimestampMs ?? 0} ms`
    : "none";
  const syncCoverage = !debug
    ? "unavailable"
    : debug.derivedFromLegacyTurn
      ? "legacy fallback"
    : debug.latency?.requiredEventCoverageComplete
      ? "complete"
      : debug.transport === "openai-realtime"
        ? "limited on unified realtime"
        : debug.latency?.missingEvents?.length
          ? `missing ${debug.latency.missingEvents.join(", ")}`
          : "partial";

  return (
    <details className="turn-debug" data-testid={`turn-debug-${turnId}`}>
      <summary
        aria-label={`Turn ${turnId} debug info`}
        className="turn-debug__summary"
        role="button"
      >
        <span className="turn-debug__summary-icon">i</span>
      </summary>
      <div className="turn-debug__card">
        {debug ? (
          <>
            <div className="turn-debug__header">
              <div>
                <div className="turn-debug__eyebrow">Trace</div>
                <div className="turn-debug__trace">{debug.sessionId}</div>
              </div>
              <div className="turn-debug__badges">
                <span className="turn-debug__badge">{debug.transport}</span>
                <span className="turn-debug__badge">{debug.request.source}</span>
                {debug.derivedFromLegacyTurn ? <span className="turn-debug__badge">legacy</span> : null}
              </div>
            </div>

            <section className="turn-debug__section">
              <div className="turn-debug__section-title">Request</div>
              <dl className="turn-debug__grid">
                <div>
                  <dt>Started</dt>
                  <dd>{startedAtLabel}</dd>
                </div>
                <div>
                  <dt>LLM</dt>
                  <dd>{debug.request.llmProvider} · {debug.request.llmModel}</dd>
                </div>
                <div>
                  <dt>TTS</dt>
                  <dd>{debug.request.ttsProvider} · {debug.request.ttsModel}</dd>
                </div>
                <div>
                  <dt>Coverage</dt>
                  <dd>{syncCoverage}</dd>
                </div>
              </dl>
            </section>

            <section className="turn-debug__section">
              <div className="turn-debug__section-title">Output</div>
              <dl className="turn-debug__grid">
                <div>
                  <dt>Timestamps</dt>
                  <dd>{debug.response.timestampCount} · {timestampWindow}</dd>
                </div>
                <div>
                  <dt>Audio segments</dt>
                  <dd>{debug.response.audioSegmentCount}</dd>
                </div>
                <div>
                  <dt>Session logs</dt>
                  <dd>{debug.sessionEvents?.length ?? 0}</dd>
                </div>
                <div className="turn-debug__grid-full">
                  <dt>Latency</dt>
                  <dd>
                    STT {debug.latency?.speechEndToSttFinalMs ?? 0} ·
                    LLM {debug.latency?.sttFinalToLlmFirstTokenMs ?? 0} ·
                    TTS {debug.latency?.llmFirstTokenToTtsFirstAudioMs ?? 0}
                  </dd>
                </div>
              </dl>
            </section>

            <details className="turn-debug__raw">
              <summary className="turn-debug__raw-summary">Raw</summary>
              <pre className="turn-debug__payload">{JSON.stringify(debug, null, 2)}</pre>
            </details>
          </>
        ) : (
          <p className="turn-debug__empty">Debug unavailable for this turn.</p>
        )}
      </div>
    </details>
  );
}
