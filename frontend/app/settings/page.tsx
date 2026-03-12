"use client";

import React, { useState } from "react";
import Link from "next/link";

import { DashboardLayout } from "../../components/layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { readAvatarProviderPreference } from "../../lib/avatar_preference";
import { DEFAULT_AVATAR_PROVIDER_ID } from "../../lib/avatar_manifest";
import { resolveCompatibleRuntimeSelectionForAvatar } from "../../lib/avatar_runtime_compatibility";
import { clearLessonHistory, exportLearnerSnapshot } from "../../lib/account_snapshot";
import { useFirebaseAuth } from "../../lib/firebase_auth";
import { applyRuntimeProviderChange, RUNTIME_OPTIONS } from "../../lib/runtime_options";
import {
  readSessionPreferences,
  resetSessionPreferences,
  writeSessionPreferences,
} from "../../lib/session_preferences";

export default function SettingsPage() {
  const { signOutUser, user } = useFirebaseAuth();
  const [avatarProviderId] = useState(() => readAvatarProviderPreference() ?? DEFAULT_AVATAR_PROVIDER_ID);
  const [preferences, setPreferences] = useState(() => {
    const stored = readSessionPreferences();
    return {
      ...stored,
      ...resolveCompatibleRuntimeSelectionForAvatar(avatarProviderId, stored).selection,
    };
  });
  const [accountActionStatus, setAccountActionStatus] = useState("");
  const compatibility = resolveCompatibleRuntimeSelectionForAvatar(avatarProviderId, preferences);

  const updatePreferences = (nextPreferences: Partial<typeof preferences>) => {
    const compatibleSelection = resolveCompatibleRuntimeSelectionForAvatar(avatarProviderId, {
      llmModel: nextPreferences.llmModel ?? preferences.llmModel,
      llmProvider: nextPreferences.llmProvider ?? preferences.llmProvider,
      ttsModel: nextPreferences.ttsModel ?? preferences.ttsModel,
      ttsProvider: nextPreferences.ttsProvider ?? preferences.ttsProvider,
    }).selection;
    const saved = writeSessionPreferences({
      ...preferences,
      ...nextPreferences,
      ...compatibleSelection,
    });
    setPreferences(saved);
  };

  const handleExportData = () => {
    const snapshot = exportLearnerSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = `nerdy-learner-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(objectUrl);
    setAccountActionStatus("Learner data exported.");
  };

  const handleClearLessonHistory = async () => {
    await clearLessonHistory();
    setAccountActionStatus("Saved lesson history cleared on this device.");
  };

  const handleResetDefaults = () => {
    const resetPreferences = resetSessionPreferences();
    setPreferences(resetPreferences);
    setAccountActionStatus("Tutor defaults reset.");
  };

  return (
    <DashboardLayout>
      <div className="page-shell">
        <PageHeader
          subtitle="Customize your tutor defaults, session brain, reminders, and language."
          title="Settings"
        />

        <SurfaceCard>
          <div className="section-title section-title--bottom-lg">Preferences</div>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Push notifications</h3>
              <p>Get gentle reminders to come back for practice.</p>
            </div>
            <button
              aria-label="Toggle push notifications"
              className={`settings-toggle${preferences.pushNotifications ? " settings-toggle--active" : ""}`}
              onClick={() => updatePreferences({ pushNotifications: !preferences.pushNotifications })}
              type="button"
            />
          </div>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Sound effects</h3>
              <p>Play celebration sounds and small progress cues.</p>
            </div>
            <button
              aria-label="Toggle sound effects"
              className={`settings-toggle${preferences.soundEffects ? " settings-toggle--active" : ""}`}
              onClick={() => updatePreferences({ soundEffects: !preferences.soundEffects })}
              type="button"
            />
          </div>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Language</h3>
              <p>Choose your preferred interface language.</p>
            </div>
            <div className="settings-page__item-control settings-page__item-control--wide">
              <select
                aria-label="Interface language"
                onChange={(event) => updatePreferences({ interfaceLanguage: event.target.value })}
                value={preferences.interfaceLanguage}
              >
                <option value="en">English</option>
                <option value="es">Espanol</option>
                <option value="fr">Francais</option>
              </select>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="section-title section-title--bottom-lg">Session brain</div>
          <div className="field-grid">
            <label className="field">
              <span>Session brain</span>
              <select
                aria-label="Session LLM provider"
                onChange={(event) => updatePreferences(
                  applyRuntimeProviderChange(
                    {
                      llmModel: preferences.llmModel,
                      llmProvider: preferences.llmProvider,
                      ttsModel: preferences.ttsModel,
                      ttsProvider: preferences.ttsProvider,
                    },
                    "llm",
                    event.target.value,
                  )
                )}
                value={preferences.llmProvider}
              >
                {Object.entries(RUNTIME_OPTIONS.llm)
                  .filter(([provider]) => compatibility.policy.compatibleLlmProviders.includes(provider))
                  .map(([provider, models]) => (
                  <option key={provider} value={provider}>
                    {models[0]?.label ?? provider}
                  </option>
                  ))}
              </select>
            </label>

            <label className="field">
              <span>Brain model</span>
              <select
                aria-label="Session LLM model"
                onChange={(event) => updatePreferences({ llmModel: event.target.value })}
                value={preferences.llmModel}
              >
                {RUNTIME_OPTIONS.llm[preferences.llmProvider as keyof typeof RUNTIME_OPTIONS.llm].map((model) => (
                  <option key={model.value} value={model.value}>
                    {model.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="section-copy section-copy--top-sm">
            Hold mic to talk · Cmd+Enter to send · Esc to interrupt
          </p>
          {compatibility.policy.reason ? (
            <p className="section-copy section-copy--top-sm">{compatibility.policy.reason}</p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard>
          <div className="section-title section-title--bottom-lg">Learning defaults</div>
          <div className="field-grid">
            <label className="field">
              <span>Preferred subject</span>
              <select
                aria-label="Preferred subject"
                onChange={(event) => updatePreferences({ subject: event.target.value })}
                value={preferences.subject}
              >
                <option value="math">Math</option>
                <option value="science">Science</option>
                <option value="english">English</option>
              </select>
            </label>

            <label className="field">
              <span>Grade band</span>
              <select
                aria-label="Preferred grade band"
                onChange={(event) => updatePreferences({ gradeBand: event.target.value })}
                value={preferences.gradeBand}
              >
                <option value="K-2">K-2</option>
                <option value="3-5">3-5</option>
                <option value="6-8">6-8</option>
                <option value="9-12">9-12</option>
              </select>
            </label>
          </div>

          <label className="field field--top-md">
            <span>Study style</span>
            <textarea
              aria-label="Study style preference"
              onChange={(event) => updatePreferences({ preference: event.target.value })}
              placeholder="Examples: more worked examples, slower pacing, ask me to explain my thinking"
              value={preferences.preference}
            />
          </label>
        </SurfaceCard>

        <SurfaceCard className="surface-card--soft">
          <div className="section-title section-title--bottom-md">Current setup</div>
          <div className="info-list">
            <div className="info-list__row">
              <div className="info-list__label">Subject</div>
              <div className="info-list__value">{preferences.subject.charAt(0).toUpperCase() + preferences.subject.slice(1)}</div>
            </div>
            <div className="info-list__row">
              <div className="info-list__label">Grade band</div>
              <div className="info-list__value">{preferences.gradeBand}</div>
            </div>
            <div className="info-list__row">
              <div className="info-list__label">Language</div>
              <div className="info-list__value">
                {preferences.interfaceLanguage === "es"
                  ? "Espanol"
                  : preferences.interfaceLanguage === "fr"
                    ? "Francais"
                    : "English"}
              </div>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard>
          <div className="section-title section-title--bottom-lg">Account</div>
          <div className="info-list">
            <div className="info-list__row">
              <div className="info-list__label">Signed in as</div>
              <div className="info-list__value">{user?.email ?? "Guest mode"}</div>
            </div>
          </div>
          <div className="pill-row pill-row--top-lg">
            <Link className="secondary-button" href="/profile">
              Review profile
            </Link>
            <button
              className="secondary-button"
              onClick={() => void signOutUser().then(() => {
                window.location.href = "/";
              })}
              type="button"
            >
              Sign out
            </button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="surface-card--soft">
          <div className="section-title section-title--bottom-md">Account actions</div>
          <div className="section-copy">
            Export learner data, clear saved lesson history, or reset tutor defaults without leaving Settings.
          </div>
          <div className="pill-row pill-row--top-lg">
            <button className="secondary-button" onClick={handleExportData} type="button">
              Export learner data
            </button>
            <button className="secondary-button" onClick={() => void handleClearLessonHistory()} type="button">
              Clear saved lessons
            </button>
            <button className="secondary-button" onClick={handleResetDefaults} type="button">
              Reset tutor defaults
            </button>
          </div>
          {accountActionStatus ? (
            <p className="section-copy section-copy--top-sm" role="status">{accountActionStatus}</p>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="surface-card--soft">
          <div className="section-copy">
            Avatar-specific controls still live in Avatars. Settings owns the default tutor brain for each session.
          </div>
        </SurfaceCard>
      </div>
    </DashboardLayout>
  );
}
