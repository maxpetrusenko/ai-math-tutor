"use client";

import React from "react";
import { DashboardLayout } from "../../components/layout";
import {
  RUNTIME_OPTIONS,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
  DEFAULT_TTS_PROVIDER,
  DEFAULT_TTS_MODEL,
} from "../../lib/runtime_options";

export default function ModelsPage() {
  const llmProviders = Object.keys(RUNTIME_OPTIONS.llm);
  const ttsProviders = Object.keys(RUNTIME_OPTIONS.tts);

  return (
    <DashboardLayout>
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>
            Model Settings
          </h1>
          <p style={{ color: "var(--ink-dim)" }}>
            Configure the AI models used for tutoring
          </p>
        </div>

        {/* LLM Settings */}
        <section className="models-page__section">
          <h2 className="models-page__section-title">Language Model (LLM)</h2>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginBottom: "20px" }}>
            The AI model that generates responses and explains concepts
          </p>

          <div className="models-page__field">
            <label>Provider</label>
            <select defaultValue={DEFAULT_LLM_PROVIDER}>
              {llmProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            <p className="models-page__description">
              Choose the AI provider for generating responses
            </p>
          </div>

          <div className="models-page__field">
            <label>Model</label>
            <select defaultValue={DEFAULT_LLM_MODEL}>
              {RUNTIME_OPTIONS.llm[DEFAULT_LLM_PROVIDER]?.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
            <p className="models-page__description">
              Specific model to use for generating responses
            </p>
          </div>
        </section>

        {/* TTS Settings */}
        <section className="models-page__section">
          <h2 className="models-page__section-title">Text-to-Speech (TTS)</h2>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginBottom: "20px" }}>
            The voice model that speaks the tutor's responses
          </p>

          <div className="models-page__field">
            <label>Provider</label>
            <select defaultValue={DEFAULT_TTS_PROVIDER}>
              {ttsProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
            <p className="models-page__description">
              Choose the voice provider for speech synthesis
            </p>
          </div>

          <div className="models-page__field">
            <label>Model</label>
            <select defaultValue={DEFAULT_TTS_MODEL}>
              {RUNTIME_OPTIONS.tts[DEFAULT_TTS_PROVIDER]?.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
            <p className="models-page__description">
              Specific voice model to use for speech
            </p>
          </div>
        </section>

        {/* Info Card */}
        <div
          style={{
            padding: "20px",
            background: "var(--accent-subtle)",
            border: "1px solid " + "var(--accent)",
            borderRadius: "16px",
          }}
        >
          <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "8px", color: "var(--accent)" }}>
            💡 Pro tip
          </h3>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", lineHeight: 1.5, margin: 0 }}>
            Different models offer different strengths. Some are faster for real-time conversations,
            while others provide more detailed explanations. Experiment to find what works best for you!
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
