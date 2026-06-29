"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__logo">N</div>
          <h1 className="auth-card__title">Welcome back</h1>
          <p className="auth-card__subtitle">Continue your local tutor session.</p>
        </div>

        <button className="google-button" onClick={() => router.push("/dashboard")}>
          Continue to dashboard
        </button>

        <div className="auth-card__divider">
          <span>or</span>
        </div>

        <form
          className="auth-card__form"
          onSubmit={(event) => {
            event.preventDefault();
            router.push("/dashboard");
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <input
              type="email"
              placeholder="Email address"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                background: "var(--bg)",
                fontSize: "0.95rem",
              }}
            />
            <button
              type="submit"
              className="primary-button"
              style={{
                width: "100%",
                padding: "14px",
                background: "linear-gradient(135deg, var(--accent), var(--secondary))",
                color: "white",
                border: "none",
                borderRadius: "10px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Enter
            </button>
          </div>
        </form>

        <div className="auth-card__footer">
          New here? <Link href="/signup">Set up learner profile</Link>
        </div>
      </div>
    </div>
  );
}
