"use client";

import React, { useState } from "react";
import Link from "next/link";

import { DashboardLayout } from "../../components/layout";
import { PageHeader } from "../../components/ui/PageHeader";
import { SurfaceCard } from "../../components/ui/SurfaceCard";
import { useFirebaseAuth } from "../../lib/firebase_auth";
import { readSessionPreferences, writeSessionPreferences } from "../../lib/session_preferences";

export default function SettingsPage() {
  const { signOutUser, user } = useFirebaseAuth();
  const [preferences, setPreferences] = useState(() => readSessionPreferences());

  const updatePreferences = (nextPreferences: Partial<typeof preferences>) => {
    const saved = writeSessionPreferences({
      ...preferences,
      ...nextPreferences,
    });
    setPreferences(saved);
  };

  return (
    <DashboardLayout>
      <div className="page-shell">
        <PageHeader
          subtitle="Customize reminders, sound, and language without touching runtime controls."
          title="Settings"
        />

        <SurfaceCard>
          <div className="section-title" style={{ marginBottom: "20px" }}>Preferences</div>

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
            <div className="settings-page__item-control" style={{ minWidth: "180px" }}>
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
          <div className="section-title" style={{ marginBottom: "20px" }}>Learning defaults</div>
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
                <option value="6-8">6-8</option>
                <option value="9-10">9-10</option>
                <option value="11-12">11-12</option>
              </select>
            </label>
          </div>

          <label className="field" style={{ marginTop: "16px" }}>
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
          <div className="section-title" style={{ marginBottom: "16px" }}>Current setup</div>
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
          <div className="section-title" style={{ marginBottom: "20px" }}>Account</div>
          <div className="info-list">
            <div className="info-list__row">
              <div className="info-list__label">Signed in as</div>
              <div className="info-list__value">{user?.email ?? "Guest mode"}</div>
            </div>
          </div>
          <div className="pill-row" style={{ marginTop: "20px" }}>
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
          <div className="section-copy">
            Runtime model defaults and avatar-specific controls live in Models and Avatars. Settings stays focused on the learner.
          </div>
        </SurfaceCard>
      </div>
    </DashboardLayout>
  );
}
