"use client";

import React, { useState } from "react";
import { DashboardLayout } from "../../components/layout";
import { useFirebaseAuth } from "../../lib/firebase_auth";

type SettingsPageProps = {};

export default function SettingsPage() {
  const { signOutUser, user } = useFirebaseAuth();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);

  const handleSignOut = async () => {
    await signOutUser();
    window.location.href = "/";
  };

  return (
    <DashboardLayout>
      <div style={{ padding: 0 }}>
        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "8px" }}>
            Settings
          </h1>
          <p style={{ color: "var(--ink-dim)" }}>
            Customize your learning experience
          </p>
        </div>

        {/* Appearance */}
        <section className="settings-page__section">
          <h2 className="settings-page__section-title">Appearance</h2>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Theme</h3>
              <p>Choose your preferred color scheme</p>
            </div>
            <div className="settings-page__item-control">
              <button
                style={{
                  padding: "8px 16px",
                  background: theme === "light" ? "var(--accent)" : "var(--bg-subtle)",
                  color: theme === "light" ? "white" : "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  marginRight: "8px",
                  cursor: "pointer",
                }}
                onClick={() => setTheme("light")}
              >
                Light
              </button>
              <button
                style={{
                  padding: "8px 16px",
                  background: theme === "dark" ? "var(--accent)" : "var(--bg-subtle)",
                  color: theme === "dark" ? "white" : "var(--ink)",
                  border: "1px solid var(--line)",
                  borderRadius: "8px",
                  cursor: "pointer",
                }}
                onClick={() => setTheme("dark")}
              >
                Dark
              </button>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="settings-page__section">
          <h2 className="settings-page__section-title">Notifications</h2>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Push Notifications</h3>
              <p>Get reminded about your learning schedule</p>
            </div>
            <div
              className={`toggle-switch ${notifications ? "toggle-switch--active" : ""}`}
              onClick={() => setNotifications(!notifications)}
              style={{ cursor: "pointer" }}
            />
          </div>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Email Updates</h3>
              <p>Weekly progress reports and tips</p>
            </div>
            <div
              className={`toggle-switch ${emailUpdates ? "toggle-switch--active" : ""}`}
              onClick={() => setEmailUpdates(!emailUpdates)}
              style={{ cursor: "pointer" }}
            />
          </div>
        </section>

        {/* Sound & Speech */}
        <section className="settings-page__section">
          <h2 className="settings-page__section-title">Sound & Speech</h2>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Sound Effects</h3>
              <p>Play sounds for interactions and achievements</p>
            </div>
            <div
              className={`toggle-switch ${soundEffects ? "toggle-switch--active" : ""}`}
              onClick={() => setSoundEffects(!soundEffects)}
              style={{ cursor: "pointer" }}
            />
          </div>
        </section>

        {/* Account */}
        <section className="settings-page__section">
          <h2 className="settings-page__section-title">Account</h2>

          <div className="settings-page__item">
            <div className="settings-page__item-info">
              <h3>Signed in as</h3>
              <p>{user?.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                padding: "10px 20px",
                background: "transparent",
                color: "var(--danger)",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Sign Out
            </button>
          </div>
        </section>

        {/* Info */}
        <div
          style={{
            padding: "20px",
            background: "var(--bg-subtle)",
            borderRadius: "16px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", margin: 0 }}>
            Nerdy v1.0.0 • Built with ❤️ for learners everywhere
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
