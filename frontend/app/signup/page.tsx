"use client";

import React, { useState } from "react";
import Link from "next/link";
import { FIREBASE_AUTH_NOT_CONFIGURED_MESSAGE, useFirebaseAuth } from "../../lib/firebase_auth";
import { useRouter } from "next/navigation";

type SignupStep = "email" | "birthday" | "complete";

export default function SignupPage() {
  const { authReady, firebaseEnabled, signInWithGoogle, user } = useFirebaseAuth();
  const router = useRouter();
  const [step, setStep] = useState<SignupStep>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const configMessage = authReady && !firebaseEnabled ? FIREBASE_AUTH_NOT_CONFIGURED_MESSAGE : null;
  const googleDisabled = isLoading || !authReady || !firebaseEnabled;

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      await signInWithGoogle();
      setStep("birthday");
    } catch (error) {
      console.error("Sign up error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Google sign-up failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGradeBand = (birthDate: Date): string => {
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1 <= 7 ? "K-2" : age - 1 <= 10 ? "3-5" : age - 1 <= 14 ? "6-8" : "9-12";
    }

    return age <= 7 ? "K-2" : age <= 10 ? "3-5" : age <= 14 ? "6-8" : "9-12";
  };

  const handleBirthdaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!birthday) return;

    const birthDate = new Date(birthday);
    const gradeBand = calculateGradeBand(birthDate);

    // Store grade band in localStorage for onboarding
    localStorage.setItem("nerdy_grade_band", gradeBand);

    setStep("complete");

    // Redirect to dashboard after showing completion
    setTimeout(() => {
      router.push("/dashboard");
    }, 1500);
  };

  // If already logged in, go to birthday step
  React.useEffect(() => {
    if (user && step === "email") {
      setStep("birthday");
    }
  }, [user, step]);

  return (
    <div className="auth-page">
      {step === "email" && (
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__logo">N</div>
            <h1 className="auth-card__title">Create your account</h1>
            <p className="auth-card__subtitle">Start your learning journey today</p>
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
            {!authReady ? "Loading auth..." : isLoading ? "Creating account..." : "Continue with Google"}
          </button>

          <div className="auth-card__divider">
            <span>or</span>
          </div>

          <form className="auth-card__form" onSubmit={(e) => { e.preventDefault(); setStep("birthday"); }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
                placeholder="Create a password"
                required
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
                Continue
              </button>
            </div>
          </form>

          <div className="auth-card__footer">
            Already have an account? <Link href="/login">Sign in</Link>
          </div>
        </div>
      )}

      {step === "birthday" && (
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__logo">🎂</div>
            <h1 className="auth-card__title">When's your birthday?</h1>
            <p className="auth-card__subtitle">
              This helps us customize lessons for your grade level
            </p>
          </div>

          <form onSubmit={handleBirthdaySubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                required
                max={new Date().toISOString().split("T")[0]}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid var(--line)",
                  borderRadius: "10px",
                  background: "var(--bg)",
                  fontSize: "0.95rem",
                }}
              />
              <div
                style={{
                  padding: "16px",
                  background: "var(--bg-subtle)",
                  borderRadius: "10px",
                  fontSize: "0.9rem",
                  color: "var(--ink-dim)",
                }}
              >
                <strong>Grade levels:</strong>
                <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                  <li>K-2 (ages 5-7)</li>
                  <li>3-5 (ages 8-10)</li>
                  <li>6-8 (ages 11-14)</li>
                  <li>9-12 (ages 15-18)</li>
                </ul>
              </div>
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
                Complete Setup
              </button>
            </div>
          </form>
        </div>
      )}

      {step === "complete" && (
        <div className="auth-card" style={{ textAlign: "center" }}>
          <div
            style={{
              width: "80px",
              height: "80px",
              background: "var(--accent-subtle)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              color: "var(--accent)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="auth-card__title">You're all set!</h1>
          <p className="auth-card__subtitle">
            Redirecting you to your dashboard...
          </p>
        </div>
      )}
    </div>
  );
}
