import React from "react";
import Link from "next/link";

export default function LandingPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* Navigation */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 24px",
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "linear-gradient(135deg, var(--accent), var(--secondary))",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontWeight: 700,
              fontSize: "18px",
            }}
          >
            N
          </div>
          <span
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "var(--ink)",
            }}
          >
            Nerdy
          </span>
        </Link>

        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          <Link
            href="/login"
            style={{
              color: "var(--ink-dim)",
              textDecoration: "none",
              fontWeight: 500,
              fontSize: "0.95rem",
            }}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            style={{
              padding: "10px 20px",
              background: "linear-gradient(135deg, var(--accent), var(--secondary))",
              color: "white",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: "0.95rem",
            }}
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="landing-hero">
        <div className="landing-hero__badge">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          #1 AI Math Tutor for Kids
        </div>
        <h1 className="landing-hero__title">
          Your Personal AI Math Tutor
        </h1>
        <p className="landing-hero__subtitle">
          Learn math at your own pace with an AI tutor that adapts to your grade level,
          learning style, and interests. Fun, friendly, and always available.
        </p>
        <Link href="/signup" className="landing-hero__cta">
          Start Learning Free
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

        {/* Avatar Preview Placeholder */}
        <div
          style={{
            marginTop: "48px",
            width: "100%",
            maxWidth: "500px",
            height: "280px",
            margin: "48px auto 0",
            background:
              "radial-gradient(circle at 50% 30%, rgba(79, 140, 255, 0.1), transparent 50%), var(--bg-elevated)",
            borderRadius: "24px",
            border: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "50%",
              background: "linear-gradient(180deg, #ffe8d6, #f5c9a8)",
              position: "relative",
            }}
          >
            {/* Simple face */}
            <div
              style={{
                position: "absolute",
                top: "40%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "60%",
                height: "20px",
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  background: "#1A1A2E",
                  borderRadius: "50%",
                }}
              />
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  background: "#1A1A2E",
                  borderRadius: "50%",
                }}
              />
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "25%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "32px",
                height: "16px",
                background: "#1A1A2E",
                borderRadius: "0 0 20px 20px",
              }}
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="feature-grid">
        <div className="feature-card">
          <div className="feature-card__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="feature-card__title">AI-Powered Lessons</h3>
          <p className="feature-card__description">
            Interactive lessons powered by advanced AI that explains concepts clearly
            and adapts to how you learn best.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-card__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="feature-card__title">Grade-Adaptive Learning</h3>
          <p className="feature-card__description">
            From kindergarten to high school, our tutor automatically adjusts to
            your grade level and learning pace.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-card__icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 className="feature-card__title">Fun Avatar Styles</h3>
          <p className="feature-card__description">
            Choose from multiple avatar styles including 2D, 3D, cartoon, and robot.
            Make learning fun with your favorite companion!
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials">
        <h2 className="testimonials__title">What Students Say</h2>
        <div className="testimonials__grid">
          <div className="testimonial-card">
            <p className="testimonial-card__quote">
              "I used to struggle with algebra, but my AI tutor explains everything
              in a way I actually understand. My grades went from C to A!"
            </p>
            <div className="testimonial-card__author">
              <div className="testimonial-card__avatar">S</div>
              <div>
                <div className="testimonial-card__name">Sophie</div>
                <div className="testimonial-card__grade">7th Grade</div>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <p className="testimonial-card__quote">
              "The avatar is so cool! It feels like I have a real study buddy who
              never gets tired of explaining things. Math is actually fun now."
            </p>
            <div className="testimonial-card__author">
              <div className="testimonial-card__avatar">M</div>
              <div>
                <div className="testimonial-card__name">Marcus</div>
                <div className="testimonial-card__grade">5th Grade</div>
              </div>
            </div>
          </div>

          <div className="testimonial-card">
            <p className="testimonial-card__quote">
              "I can ask questions anytime, even late at night before a test. The
              tutor is patient and breaks down hard problems step by step."
            </p>
            <div className="testimonial-card__author">
              <div className="testimonial-card__avatar">E</div>
              <div>
                <div className="testimonial-card__name">Emma</div>
                <div className="testimonial-card__grade">10th Grade</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section
        style={{
          textAlign: "center",
          padding: "80px 20px",
          background: "linear-gradient(135deg, var(--accent-subtle), rgba(255, 140, 66, 0.08))",
        }}
      >
        <h2
          style={{
            fontSize: "clamp(1.8rem, 4vw, 2.5rem)",
            fontWeight: 700,
            marginBottom: "16px",
          }}
        >
          Ready to Love Learning Math?
        </h2>
        <p
          style={{
            color: "var(--ink-dim)",
            fontSize: "1.1rem",
            marginBottom: "32px",
            maxWidth: "500px",
            margin: "0 auto 32px",
          }}
        >
          Join thousands of students who are excelling in math with their AI tutor.
        </p>
        <Link
          href="/signup"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "16px 32px",
            background: "linear-gradient(135deg, var(--accent), var(--secondary))",
            color: "white",
            borderRadius: "12px",
            fontWeight: 600,
            fontSize: "1rem",
            textDecoration: "none",
            boxShadow: "0 4px 20px var(--accent-glow)",
          }}
        >
          Start Learning Free
        </Link>
      </section>

      {/* Footer */}
      <footer
        style={{
          padding: "32px 24px",
          textAlign: "center",
          borderTop: "1px solid var(--line)",
        }}
      >
        <p style={{ color: "var(--ink-dim)", margin: 0 }}>
          © 2025 Nerdy. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
