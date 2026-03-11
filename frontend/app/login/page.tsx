"use client";

import React from "react";
import Link from "next/link";
import { FIREBASE_AUTH_NOT_CONFIGURED_MESSAGE, useFirebaseAuth } from "../../lib/firebase_auth";

export default function LoginPage() {
  const { authReady, firebaseEnabled, signInWithGoogle, user } = useFirebaseAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const configMessage = authReady && !firebaseEnabled ? FIREBASE_AUTH_NOT_CONFIGURED_MESSAGE : null;
  const googleDisabled = isLoading || !authReady || !firebaseEnabled;

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Sign in error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Google sign-in failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (user) {
      window.location.href = "/dashboard";
    }
  }, [user]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="auth-card__logo">N</div>
          <h1 className="auth-card__title">Welcome back</h1>
          <p className="auth-card__subtitle">Sign in to continue learning</p>
        </div>

        {configMessage || errorMessage ? (
          <p
            role="alert"
            style={{
              margin: "0 0 16px",
              color: "var(--danger, #c64545)",
              fontSize: "0.92rem",
              lineHeight: 1.5,
            }}
          >
            {configMessage ?? errorMessage}
          </p>
        ) : null}

        <button
          className="google-button"
          onClick={handleGoogleSignIn}
          disabled={googleDisabled}
          title={configMessage ?? undefined}
        >
          <svg viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-4.57 0-1.81-1.26-2.97-1.06-4.57z"
              fill="#34A853"
            />
            <path
              d="M5.99 14.59c-.19-.66-.3-1.36-.3-2.09s.11-1.43.3-2.09V7.07H2.29c-.69 1.38-1.09 2.98-1.09 4.93s.4 3.55 1.09 4.93l2.92-2.26-.22-.08z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.29 7.07l3.92 3.01c.87-2.6 3.3-4.5 5.79-4.5z"
              fill="#EA4335"
            />
          </svg>
          {!authReady ? "Loading auth..." : isLoading ? "Signing in..." : "Continue with Google"}
        </button>

        <div className="auth-card__divider">
          <span>or</span>
        </div>

        <form className="auth-card__form">
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
            <input
              type="password"
              placeholder="Password"
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
              type="button"
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
              Sign in
            </button>
          </div>
        </form>

        <div className="auth-card__footer">
          Don't have an account? <Link href="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
