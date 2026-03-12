"use client";

import React from "react";
import type { PersistedTurnDebug } from "../lib/lesson_thread_store";

export type LatencyMetrics = {
  speechEndToSttFinalMs: number;
  sttFinalToLlmFirstTokenMs: number;
  llmFirstTokenToTtsFirstAudioMs: number;
  ttsFirstAudioToFirstVisemeMs?: number | null;
  speechEndToFirstVisemeMs?: number | null;
  speechEndToAudioDoneMs?: number | null;
  missingEvents?: string[];
  requiredEventCoverageComplete?: boolean;
};

type LatencyMonitorProps = {
  metrics: LatencyMetrics | null;
  transport?: PersistedTurnDebug["transport"];
  variant?: "panel" | "inline";
};

export function LatencyMonitor({
  metrics,
  transport = "session-socket",
  variant = "panel",
}: LatencyMonitorProps) {
  const resolved = metrics ?? {
    speechEndToSttFinalMs: 0,
    sttFinalToLlmFirstTokenMs: 0,
    llmFirstTokenToTtsFirstAudioMs: 0,
    ttsFirstAudioToFirstVisemeMs: null,
    speechEndToFirstVisemeMs: null,
    speechEndToAudioDoneMs: null,
    missingEvents: [],
    requiredEventCoverageComplete: false,
  };
  const syncCoverage = describeSyncCoverage(transport, metrics);
  const transportLabel = transport === "openai-realtime" ? "OpenAI realtime" : "Socket pipeline";
  const statusLabel = metrics
    ? resolved.requiredEventCoverageComplete
      ? "coverage complete"
      : transport === "openai-realtime"
        ? "coverage limited"
        : "coverage partial"
    : "awaiting turn";

  if (variant === "inline") {
    if (!metrics) {
      return null;
    }

    return (
      <div className="latency-strip" data-testid="latency-strip">
        <span>Latency</span>
        <span className="latency-strip__mode">{transportLabel}</span>
        <strong>STT {resolved.speechEndToSttFinalMs} ms</strong>
        <strong>LLM {resolved.sttFinalToLlmFirstTokenMs} ms</strong>
        <strong>TTS {resolved.llmFirstTokenToTtsFirstAudioMs} ms</strong>
        <span className="latency-strip__coverage">{syncCoverage}</span>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <h3>Latency</h3>
        <span className="status-pill">{statusLabel}</span>
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <span>speech → stt</span>
          <strong>{resolved.speechEndToSttFinalMs} ms</strong>
        </div>
        <div className="metric-card">
          <span>stt → llm</span>
          <strong>{resolved.sttFinalToLlmFirstTokenMs} ms</strong>
        </div>
        <div className="metric-card">
          <span>llm → tts</span>
          <strong>{resolved.llmFirstTokenToTtsFirstAudioMs} ms</strong>
        </div>
        <div className="metric-card">
          <span>tts → viseme</span>
          <strong>{formatOptionalMetric(resolved.ttsFirstAudioToFirstVisemeMs)}</strong>
        </div>
        <div className="metric-card">
          <span>speech → viseme</span>
          <strong>{formatOptionalMetric(resolved.speechEndToFirstVisemeMs)}</strong>
        </div>
        <div className="metric-card">
          <span>speech → audio done</span>
          <strong>{formatOptionalMetric(resolved.speechEndToAudioDoneMs)}</strong>
        </div>
      </div>
      <p className="helper-text" style={{ marginTop: "0.75rem" }}>{transportLabel}</p>
      <p className="helper-text" style={{ marginTop: "0.75rem" }}>{syncCoverage}</p>
    </div>
  );
}

function formatOptionalMetric(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "pending";
  }
  return `${value} ms`;
}

function describeSyncCoverage(
  transport: PersistedTurnDebug["transport"],
  metrics: LatencyMetrics | null
) {
  if (!metrics) {
    return transport === "openai-realtime"
      ? "Unified speech path selected; run a turn for token and socket timing"
      : "Run a live turn to populate benchmark timings";
  }

  if (metrics.requiredEventCoverageComplete) {
    return "required events captured";
  }

  if (transport === "openai-realtime") {
    return "Unified realtime path; word timestamps and full sync coverage are limited";
  }

  const missing = metrics.missingEvents ?? [];
  return missing.length > 0 ? `missing: ${missing.join(", ")}` : "coverage partial";
}
