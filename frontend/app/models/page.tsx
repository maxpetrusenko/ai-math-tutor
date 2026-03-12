"use client";

import React, { useState } from "react";
import Link from "next/link";

import { DashboardLayout } from "../../components/layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import {
  applyRuntimeProviderChange,
  RUNTIME_OPTIONS,
  normalizeRuntimeSelection,
  UPCOMING_PROVIDER_INTEGRATIONS,
} from "../../lib/runtime_options";
import { readSessionPreferences, writeSessionPreferences } from "../../lib/session_preferences";

const LLM_PROVIDER_CHOICES = [
  {
    description: "Fast, clear step by step explanations for everyday tutoring.",
    id: "gemini",
    note: "Best default",
    title: "Fast explainer",
  },
  {
    description: "Alternative reasoning path when you want a different tutoring style.",
    id: "minimax",
    note: "Backup brain",
    title: "Alternative reasoning",
  },
  {
    description: "Balanced text tutoring with broad coverage across subjects.",
    id: "openai",
    note: "Generalist",
    title: "Balanced generalist",
  },
  {
    description: "Keep the same realtime provider handling the live conversation stack.",
    id: "openai-realtime",
    note: "Live stack",
    title: "Live stack",
  },
] as const;

const TTS_PROVIDER_CHOICES = [
  {
    description: "Expressive voice with low-latency playback for guided lessons.",
    id: "cartesia",
    note: "Best default",
    title: "Studio voice",
  },
  {
    description: "Secondary voice option for broader provider coverage.",
    id: "minimax",
    note: "Backup voice",
    title: "Alternative voice",
  },
  {
    description: "Tightest fit when you stay fully inside the realtime stack.",
    id: "openai-realtime",
    note: "Live stack",
    title: "Realtime voice",
  },
] as const;

export default function ModelsPage() {
  const [selection, setSelection] = useState(() => readSessionPreferences());

  const syncSelection = (nextSelection: Partial<typeof selection>) => {
    const normalized = normalizeRuntimeSelection({
      llmModel: selection.llmModel,
      llmProvider: selection.llmProvider,
      ttsModel: selection.ttsModel,
      ttsProvider: selection.ttsProvider,
      ...nextSelection,
    });
    const nextPreferences = writeSessionPreferences({
      ...selection,
      ...normalized,
    });
    setSelection(nextPreferences);
  };

  return (
    <DashboardLayout>
      <div className="page-shell">
        <PageHeader
          subtitle="Choose the tutor brain and voice used when a new session starts."
          title="AI Models"
        />

        <SurfaceCard className="models-page__section">
          <div className="section-title">Language model</div>
          <p className="section-copy" style={{ marginTop: "8px", marginBottom: "20px" }}>
            Reasoning, explanations, and pacing for the tutor.
          </p>
          <div className="provider-choice-grid">
            {LLM_PROVIDER_CHOICES.map((provider) => (
              <button
                aria-label={provider.title}
                aria-pressed={selection.llmProvider === provider.id}
                className={`provider-choice-card${
                  selection.llmProvider === provider.id ? " provider-choice-card--active" : ""
                }`}
                key={provider.id}
                onClick={() => syncSelection(applyRuntimeProviderChange(selection, "llm", provider.id))}
                type="button"
              >
                <div className="provider-choice-card__eyebrow">{provider.note}</div>
                <div className="provider-choice-card__title">{provider.title}</div>
                <div className="provider-choice-card__copy">{provider.description}</div>
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Model</span>
              <select
                aria-label="Default LLM model"
                onChange={(event) => syncSelection({ llmModel: event.target.value })}
                value={selection.llmModel}
              >
                {RUNTIME_OPTIONS.llm[selection.llmProvider as keyof typeof RUNTIME_OPTIONS.llm].map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row-card models-page__note-card">
            <div className="row-card__icon">LLM</div>
            <div className="row-card__content">
              <div className="row-card__title">Why this brain</div>
              <div className="row-card__copy">
                {LLM_PROVIDER_CHOICES.find((provider) => provider.id === selection.llmProvider)?.description ?? "Tutor reasoning default."}
              </div>
              <div className="row-card__meta">
                Active default: {selection.llmProvider} · {selection.llmModel}
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="models-page__section">
          <div className="section-title">Tutor voice</div>
          <p className="section-copy" style={{ marginTop: "8px", marginBottom: "20px" }}>
            Speech synthesis and playback defaults for your current tutor.
          </p>
          <div className="provider-choice-grid provider-choice-grid--compact">
            {TTS_PROVIDER_CHOICES.map((provider) => (
              <button
                aria-label={provider.title}
                aria-pressed={selection.ttsProvider === provider.id}
                className={`provider-choice-card${
                  selection.ttsProvider === provider.id ? " provider-choice-card--active" : ""
                }`}
                key={provider.id}
                onClick={() => syncSelection(applyRuntimeProviderChange(selection, "tts", provider.id))}
                type="button"
              >
                <div className="provider-choice-card__eyebrow">{provider.note}</div>
                <div className="provider-choice-card__title">{provider.title}</div>
                <div className="provider-choice-card__copy">{provider.description}</div>
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Model</span>
              <select
                aria-label="Default TTS model"
                onChange={(event) => syncSelection({ ttsModel: event.target.value })}
                value={selection.ttsModel}
              >
                {RUNTIME_OPTIONS.tts[selection.ttsProvider as keyof typeof RUNTIME_OPTIONS.tts].map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row-card models-page__note-card">
            <div className="row-card__icon">TTS</div>
            <div className="row-card__content">
              <div className="row-card__title">Why this voice</div>
              <div className="row-card__copy">
                {TTS_PROVIDER_CHOICES.find((provider) => provider.id === selection.ttsProvider)?.description ?? "Tutor voice default."}
              </div>
              <div className="row-card__meta">
                Active default: {selection.ttsProvider} · {selection.ttsModel}
              </div>
            </div>
          </div>
        </SurfaceCard>

        <div className="field-grid">
          <SurfaceCard className="surface-card--soft">
            <div className="section-title">Current defaults</div>
            <div className="info-list" style={{ marginTop: "14px" }}>
              <div className="info-list__row">
                <div className="info-list__label">LLM</div>
                <div className="info-list__value">{selection.llmProvider} · {selection.llmModel}</div>
              </div>
              <div className="info-list__row">
                <div className="info-list__label">Voice</div>
                <div className="info-list__value">{selection.ttsProvider} · {selection.ttsModel}</div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard>
            <div className="section-title">Provider roadmap</div>
            <div className="section-stack" style={{ marginTop: "14px" }}>
              {UPCOMING_PROVIDER_INTEGRATIONS.map((provider) => (
                <div className="row-card" key={provider.id}>
                  <div className="row-card__content">
                    <div className="row-card__title">{provider.label}</div>
                    <div className="row-card__copy">{provider.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </SurfaceCard>
        </div>

        <div>
          <Link className="primary-button" href="/session">
            Return to session
          </Link>
        </div>
      </div>
    </DashboardLayout>
  );
}
