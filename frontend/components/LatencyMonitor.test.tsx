import React from "react";
import { render, screen } from "@testing-library/react";

import { LatencyMonitor } from "./LatencyMonitor";

test("renders benchmark sync closure metrics when available", () => {
  render(
    <LatencyMonitor
      metrics={{
        speechEndToSttFinalMs: 120,
        sttFinalToLlmFirstTokenMs: 90,
        llmFirstTokenToTtsFirstAudioMs: 140,
        ttsFirstAudioToFirstVisemeMs: 35,
        speechEndToFirstVisemeMs: 385,
        speechEndToAudioDoneMs: 1120,
        missingEvents: [],
        requiredEventCoverageComplete: true,
      }}
    />
  );

  expect(screen.getByText("coverage complete")).toBeInTheDocument();
  expect(screen.getByText("tts → viseme")).toBeInTheDocument();
  expect(screen.getByText("35 ms")).toBeInTheDocument();
  expect(screen.getByText("required events captured")).toBeInTheDocument();
});

test("shows pending sync metrics when required events are missing", () => {
  render(
    <LatencyMonitor
      metrics={{
        speechEndToSttFinalMs: 120,
        sttFinalToLlmFirstTokenMs: 90,
        llmFirstTokenToTtsFirstAudioMs: 140,
        ttsFirstAudioToFirstVisemeMs: null,
        speechEndToFirstVisemeMs: null,
        speechEndToAudioDoneMs: null,
        missingEvents: ["first_viseme", "audio_done"],
        requiredEventCoverageComplete: false,
      }}
    />
  );

  expect(screen.getByText("coverage partial")).toBeInTheDocument();
  expect(screen.getAllByText("pending").length).toBe(3);
  expect(screen.getByText("missing: first_viseme, audio_done")).toBeInTheDocument();
});

test("hides the inline strip until a turn produces latency metrics", () => {
  const { container } = render(
    <LatencyMonitor
      metrics={null}
      transport="openai-realtime"
      variant="inline"
    />
  );

  expect(container).toBeEmptyDOMElement();
});
