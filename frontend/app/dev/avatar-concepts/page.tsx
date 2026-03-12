"use client";

import React, { useEffect, useRef, useState } from "react";
import { resolveSvgAvatar } from "../../../lib/avatar_svg_registry";
import type { AvatarVisualState } from "../../../lib/avatar_contract";

const STATES: AvatarVisualState[] = ["idle", "listening", "thinking", "speaking", "fading"];
const AVATAR_IDS = ["sage", "albert", "nova", "dex"] as const;

export default function AvatarConceptsPage() {
  const [state, setState] = useState<AvatarVisualState>("idle");
  const [mouthOpen, setMouthOpen] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (state !== "speaking") {
      setMouthOpen(0);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let tick = 0;
    const animate = () => {
      tick += 0.08;
      const nextValue = Math.abs(
        Math.sin(tick * 2.2) * 0.58 +
          Math.sin(tick * 5.1) * 0.22 +
          Math.sin(tick * 0.9) * 0.12
      );
      setMouthOpen(Math.min(1, nextValue));
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [state]);

  return (
    <main
      style={{
        background:
          "radial-gradient(circle at top, rgba(62, 214, 200, 0.08), transparent 25%), linear-gradient(180deg, #090b12 0%, #0f1320 100%)",
        color: "#e4e7ec",
        minHeight: "100vh",
        padding: "2rem 1.25rem 3rem",
      }}
    >
      <div style={{ margin: "0 auto", maxWidth: "72rem" }}>
        <div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
          <p style={{ color: "#6b7280", fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.18em", margin: 0, textTransform: "uppercase" }}>
            Nerdy Avatar Review
          </p>
          <h1 style={{ fontSize: "2rem", margin: "0.35rem 0 0.4rem" }}>Sage, Albert, Nova, Dex</h1>
          <p style={{ color: "#9aa3b3", margin: 0 }}>
            Repo-wired `svg-2d` tutors. Same state model as the session runtime.
          </p>
        </div>

        <section
          style={{
            alignItems: "center",
            background: "rgba(15, 19, 32, 0.88)",
            border: "1px solid rgba(80, 95, 130, 0.32)",
            borderRadius: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
            marginBottom: "1.5rem",
            padding: "1rem",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", justifyContent: "center" }}>
            {STATES.map((entry) => (
              <button
                key={entry}
                onClick={() => setState(entry)}
                style={{
                  background: state === entry ? "rgba(62, 214, 200, 0.14)" : "transparent",
                  border: `1px solid ${state === entry ? "rgba(62, 214, 200, 0.5)" : "rgba(74, 85, 120, 0.4)"}`,
                  borderRadius: "999px",
                  color: state === entry ? "#3ed6c8" : "#9aa3b3",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  padding: "0.38rem 0.8rem",
                  textTransform: "capitalize",
                }}
              >
                {entry}
              </button>
            ))}
          </div>

          <label style={{ alignItems: "center", color: "#9aa3b3", display: "flex", gap: "0.8rem", width: "100%" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, minWidth: "4.5rem" }}>mouthOpen</span>
            <input
              max={100}
              min={0}
              onChange={(event) => setMouthOpen(Number(event.target.value) / 100)}
              style={{ accentColor: "#3ed6c8", flex: 1 }}
              type="range"
              value={Math.round(mouthOpen * 100)}
            />
            <span style={{ color: "#3ed6c8", fontFamily: "monospace", fontSize: "0.82rem", minWidth: "2.5rem", textAlign: "right" }}>
              {mouthOpen.toFixed(2)}
            </span>
          </label>
        </section>

        <section
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          }}
        >
          {AVATAR_IDS.map((avatarId) => {
            const avatar = resolveSvgAvatar(avatarId);
            const SvgAvatar = avatar.component;

            return (
              <article
                key={avatarId}
                style={{
                  background: avatar.panel,
                  border: `1px solid ${avatar.border}`,
                  borderRadius: "1rem",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: `${avatar.stage}, radial-gradient(circle at top, ${avatar.halo} 0%, transparent 58%)`,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.8rem",
                    justifyContent: "center",
                    minHeight: "19rem",
                    padding: "1.4rem 1rem",
                  }}
                >
                  <div
                    style={{
                      border: `1px solid ${avatar.border}`,
                      borderRadius: "999px",
                      color: avatar.accent,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      padding: "0.25rem 0.6rem",
                      textTransform: "uppercase",
                    }}
                  >
                    {avatar.childLabel}
                  </div>
                  <SvgAvatar mouthOpen={mouthOpen} size={180} state={state} title={avatar.label} />
                </div>
                <div style={{ padding: "1rem" }}>
                  <h2 style={{ margin: 0 }}>{avatar.label}</h2>
                  <p style={{ color: "#9aa3b3", fontSize: "0.82rem", margin: "0.35rem 0 0" }}>
                    `svg-2d` provider · assetRef `{avatar.assetRef}`
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
