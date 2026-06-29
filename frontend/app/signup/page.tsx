"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SignupStep = "email" | "birthday" | "complete";

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SignupStep>("email");
  const [birthday, setBirthday] = useState("");
  const [email, setEmail] = useState("");

  const calculateGradeBand = (birthDate: Date): string => {
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    const adjustedAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) ? age - 1 : age;
    return adjustedAge <= 7 ? "K-2" : adjustedAge <= 10 ? "3-5" : adjustedAge <= 14 ? "6-8" : "9-12";
  };

  const handleBirthdaySubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!birthday) {
      return;
    }

    localStorage.setItem("nerdy_grade_band", calculateGradeBand(new Date(birthday)));
    setStep("complete");
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  return (
    <div className="auth-page">
      {step === "email" ? (
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__logo">N</div>
            <h1 className="auth-card__title">Create your learner profile</h1>
            <p className="auth-card__subtitle">Saved locally for this tutor session.</p>
          </div>

          <form
            className="auth-card__form"
            onSubmit={(event) => {
              event.preventDefault();
              setStep("birthday");
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
            Already set up? <Link href="/login">Enter app</Link>
          </div>
        </div>
      ) : null}

      {step === "birthday" ? (
        <div className="auth-card">
          <div className="auth-card__header">
            <h1 className="auth-card__title">What grade band fits?</h1>
            <p className="auth-card__subtitle">We use this to tune examples and pacing.</p>
          </div>

          <form className="auth-card__form" onSubmit={handleBirthdaySubmit}>
            <input
              type="date"
              value={birthday}
              onChange={(event) => setBirthday(event.target.value)}
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
            <button className="primary-button" type="submit">
              Start learning
            </button>
          </form>
        </div>
      ) : null}

      {step === "complete" ? (
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="auth-card__logo">N</div>
            <h1 className="auth-card__title">Profile ready</h1>
            <p className="auth-card__subtitle">Opening the tutor dashboard.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
