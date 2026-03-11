"use client";

import React from "react";

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
  variant?: "panel" | "inline";
};

const EMPTY_METRICS: LatencyMetrics = {
  speechEndToSttFinalMs: 0,
  sttFinalToLlmFirstTokenMs: 0,
  llmFirstTokenToTtsFirstAudioMs: 0,
  ttsFirstAudioToFirstVisemeMs: null,
  speechEndToFirstVisemeMs: null,
  speechEndToAudioDoneMs: null,
  missingEvents: ["speech_end", "stt_final", "llm_first_token", "tts_first_audio", "first_viseme", "audio_done"],
  requiredEventCoverageComplete: false,
};

export function LatencyMonitor({ metrics, variant = "panel" }: LatencyMonitorProps) {
  const resolved = metrics ?? EMPTY_METRICS;
  const syncCoverage = resolved.requiredEventCoverageComplete
    ? "required events captured"
    : `missing: ${(resolved.missingEvents ?? []).join(", ")}`;

  if (variant === "inline") {
    return (
      <div className="latency-strip" data-testid="latency-strip">
        <span>Latency</span>
        <strong>STT {resolved.speechEndToSttFinalMs} ms</strong>
        <strong>LLM {resolved.sttFinalToLlmFirstTokenMs} ms</strong>
        <strong>TTS {resolved.llmFirstTokenToTtsFirstAudioMs} ms</strong>
        <span>{syncCoverage}</span>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <h3>Latency</h3>
        <span className="status-pill">{resolved.requiredEventCoverageComplete ? "coverage complete" : "coverage partial"}</span>
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
