"use client";

import React from "react";

export type LatencyMetrics = {
  speechEndToSttFinalMs: number;
  sttFinalToLlmFirstTokenMs: number;
  llmFirstTokenToTtsFirstAudioMs: number;
};

type LatencyMonitorProps = {
  metrics: LatencyMetrics | null;
};

const EMPTY_METRICS: LatencyMetrics = {
  speechEndToSttFinalMs: 0,
  sttFinalToLlmFirstTokenMs: 0,
  llmFirstTokenToTtsFirstAudioMs: 0
};

export function LatencyMonitor({ metrics }: LatencyMonitorProps) {
  const resolved = metrics ?? EMPTY_METRICS;

  return (
    <div className="panel">
      <div className="panel__header">
        <h3>Latency</h3>
        <span className="status-pill">wave 0+</span>
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
      </div>
    </div>
  );
}
