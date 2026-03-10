"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";

import { AudioPlayer } from "./AudioPlayer";
import { AvatarProvider } from "./AvatarProvider";
import { LatencyMonitor, type LatencyMetrics } from "./LatencyMonitor";
import { MicCapture } from "./MicCapture";
import { listAvatarProviders, resolveAvatarProvider, resolveAvatarProviderId } from "./avatar_registry";
import { BrowserAudioCapture, type CapturedAudioChunk } from "../lib/audio_capture";
import type { AvatarVisualState, WordTimestamp } from "../lib/avatar_contract";
import { PlaybackController, type PlaybackState } from "../lib/playback_controller";
import { createSessionMetrics } from "../lib/session_metrics";
import { createSessionSocketTransport } from "../lib/session_socket";

export type TutorTurnRequest = {
  studentText: string;
  subject: string;
  gradeBand: string;
  studentProfile?: {
    pacing?: string;
    preference?: string;
  };
  audioChunks?: CapturedAudioChunk[];
};

export type TutorTurnResult = {
  transcript: string;
  tutorText: string;
  state: string;
  latency: LatencyMetrics;
  timestamps: WordTimestamp[];
  avatarConfig?: {
    provider: string;
    type: "2d" | "3d";
    model_url?: string;
  };
};

export type SessionTransport = {
  connect: () => Promise<"connected" | "failed">;
  runTurn: (request: TutorTurnRequest) => Promise<TutorTurnResult>;
  interrupt: () => Promise<void>;
};

type TutorSessionProps = {
  transport?: SessionTransport;
};

export function TutorSession({ transport = createSessionSocketTransport() }: TutorSessionProps) {
  const [playbackController] = useState(() => new PlaybackController());
  const [audioCapture] = useState(() => new BrowserAudioCapture());
  const [micSupported, setMicSupported] = useState(true);
  const [connectionState, setConnectionState] = useState("connecting");
  const [sessionState, setSessionState] = useState("idle");
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [avatarState, setAvatarState] = useState<AvatarVisualState>("idle");
  const [studentPrompt, setStudentPrompt] = useState("I don't understand how to solve for x.");
  const [subject, setSubject] = useState("math");
  const [gradeBand, setGradeBand] = useState("6-8");
  const [preference, setPreference] = useState("");
  const [transcript, setTranscript] = useState("");
  const [tutorText, setTutorText] = useState("");
  const [latency, setLatency] = useState<LatencyMetrics | null>(null);
  const [timestamps, setTimestamps] = useState<WordTimestamp[]>([]);
  const [avatarNowMs, setAvatarNowMs] = useState(0);
  const [error, setError] = useState("");
  const [micActive, setMicActive] = useState(false);
  const [avatarProviderId, setAvatarProviderId] = useState(resolveAvatarProvider().id);
  const metricsRef = useRef(createSessionMetrics());
  const previousPlaybackStateRef = useRef<PlaybackState>("idle");
  const activeTurnIdRef = useRef(0);
  const avatarConfig = resolveAvatarProvider(avatarProviderId).config;
  const avatarOptions = listAvatarProviders();

  useEffect(() => {
    transport
      .connect()
      .then((result) => setConnectionState(result))
      .catch(() => setConnectionState("failed"));
  }, [transport]);

  useEffect(() => playbackController.subscribe(setPlaybackState), [playbackController]);

  useEffect(() => {
    setMicSupported(audioCapture.isSupported());
  }, [audioCapture]);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;

    if (sessionState === "listening" || sessionState === "thinking") {
      setAvatarState(sessionState);
    } else if (playbackState === "speaking") {
      setAvatarState("speaking");
    } else if (previousPlaybackStateRef.current === "speaking" && playbackState === "idle") {
      setAvatarState("fading");
      fadeTimer = setTimeout(() => setAvatarState("idle"), 180);
    } else {
      setAvatarState("idle");
    }

    previousPlaybackStateRef.current = playbackState;

    return () => {
      if (fadeTimer) {
        clearTimeout(fadeTimer);
      }
    };
  }, [playbackState, sessionState]);

  useEffect(() => {
    if (playbackState !== "speaking" || timestamps.length === 0) {
      return;
    }

    const playbackStartedAtMs = performance.now();
    const baseMs = timestamps[0]?.startMs ?? 0;
    let animationFrame = 0;

    const tick = () => {
      setAvatarNowMs(baseMs + (performance.now() - playbackStartedAtMs));
      animationFrame = window.requestAnimationFrame(tick);
    };

    setAvatarNowMs(baseMs);
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [playbackState, timestamps]);

  async function runDemoTurn(audioChunks?: CapturedAudioChunk[]) {
    const turnId = activeTurnIdRef.current + 1;
    activeTurnIdRef.current = turnId;
    setError("");
    setSessionState("thinking");
    setLatency(null);
    metricsRef.current = createSessionMetrics();
    try {
      const result = await transport.runTurn({
        studentText: studentPrompt,
        subject,
        gradeBand,
        studentProfile: preference ? { preference } : undefined,
        audioChunks,
      });
      if (activeTurnIdRef.current !== turnId) {
        return;
      }
      setTranscript(result.transcript);
      setTutorText(result.tutorText);
      setSessionState(result.state);
      setLatency(result.latency);
      setTimestamps(result.timestamps);
      setAvatarProviderId((currentId) => result.avatarConfig ? resolveAvatarProviderId(result.avatarConfig) : currentId);
      metricsRef.current.mark({ name: "tts_first_audio", tsMs: performance.now() });
      const durationMs = result.timestamps.at(-1)?.endMs ?? Math.max(600, result.tutorText.length * 25);
      playbackController.enqueue({
        id: `${Date.now()}`,
        text: result.tutorText,
        durationMs,
        onStart: () => {
          if (activeTurnIdRef.current !== turnId) {
            return;
          }
          metricsRef.current.mark({ name: "first_viseme", tsMs: performance.now() });
        },
        onComplete: () => {
          if (activeTurnIdRef.current !== turnId) {
            return;
          }
          metricsRef.current.mark({ name: "audio_done", tsMs: performance.now() });
          setSessionState("idle");
        },
      });
    } catch (caughtError) {
      if (activeTurnIdRef.current !== turnId) {
        return;
      }
      setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
      setSessionState("failed");
    }
  }

  async function interruptTurn() {
    activeTurnIdRef.current += 1;
    await transport.interrupt();
    playbackController.interrupt();
    await audioCapture.cancel();
    setSessionState("idle");
    setLatency(null);
    setTimestamps([]);
    setAvatarNowMs(0);
    setMicActive(false);
  }

  async function toggleMicCapture() {
    if (!micSupported) {
      setError("Microphone capture is not supported in this browser");
      return;
    }

    if (!micActive) {
      setError("");
      try {
        await audioCapture.start();
        setMicActive(true);
        setSessionState("listening");
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Could not start microphone");
      }
      return;
    }

    try {
      const chunks = await audioCapture.stop();
      setMicActive(false);
      await runDemoTurn(chunks);
    } catch (caughtError) {
      setMicActive(false);
      setError(caughtError instanceof Error ? caughtError.message : "Could not stop microphone");
    }
  }

  return (
    <main className="session-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Live AI Video Tutor</p>
          <h1>Realtime voice tutoring, benchmark first.</h1>
        </div>
        <div className="hero-status">
          <span className={`status-pill ${connectionState === "connected" ? "status-pill--live" : ""}`}>
            {connectionState}
          </span>
          <span className="status-pill">{sessionState}</span>
        </div>
      </section>

      <section className="session-grid">
        <div className="stack">
          <div className="panel">
            <div className="panel__header">
              <h3>Tutor State</h3>
              <span className="status-pill">{sessionState}</span>
            </div>
            <label className="field">
              <span>Student prompt</span>
              <textarea
                aria-label="Student prompt"
                onChange={(event) => setStudentPrompt(event.target.value)}
                rows={4}
                value={studentPrompt}
              />
            </label>
            <div className="field-grid">
              <label className="field">
                <span>Subject</span>
                <select aria-label="Subject" onChange={(event) => setSubject(event.target.value)} value={subject}>
                  <option value="math">Math</option>
                  <option value="science">Science</option>
                  <option value="english">English</option>
                </select>
              </label>
              <label className="field">
                <span>Grade band</span>
                <select
                  aria-label="Grade band"
                  onChange={(event) => setGradeBand(event.target.value)}
                  value={gradeBand}
                >
                  <option value="6-8">6-8</option>
                  <option value="9-10">9-10</option>
                  <option value="11-12">11-12</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Preference note</span>
              <input
                aria-label="Preference note"
                onChange={(event) => setPreference(event.target.value)}
                placeholder="Slow down, use concrete examples..."
                type="text"
                value={preference}
              />
            </label>
            <div className="button-row">
              <button className="primary-button" onClick={() => void runDemoTurn()} type="button">
                Run Demo Turn
              </button>
              <button className="ghost-button" onClick={() => void interruptTurn()} type="button">
                Interrupt
              </button>
            </div>

            {/* Avatar Provider Controls */}
            <div className="panel__header" style={{ marginTop: "1rem" }}>
              <h4>Avatar Provider</h4>
              <div aria-label="Avatar Provider" className="button-row" role="group" style={{ gap: "0.5rem" }}>
                {avatarOptions.map((option) => (
                  <button
                    key={option.id}
                    aria-pressed={avatarProviderId === option.id}
                    className={`ghost-button ${avatarProviderId === option.id ? "primary-button" : ""}`}
                    data-selected={avatarProviderId === option.id ? "true" : "false"}
                    data-testid={`avatar-mode-${option.id}`}
                    onClick={() => setAvatarProviderId(option.id)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </div>

          <MicCapture
            active={micActive}
            error={error}
            onToggle={toggleMicCapture}
            supported={micSupported}
          />
          <LatencyMonitor metrics={latency} />
        </div>

        <div className="stack">
          <AvatarProvider
            config={avatarConfig}
            energy={playbackState === "speaking" ? 0.7 : avatarState === "fading" ? 0.24 : 0.12}
            nowMs={avatarNowMs}
            state={avatarState}
            timestamps={timestamps}
          />
          <AudioPlayer controller={playbackController} />
          <div className="panel transcript-panel">
            <div className="panel__header">
              <h3>Student Transcript</h3>
            </div>
            <p>{transcript || "No transcript yet."}</p>
          </div>
          <div className="panel tutor-panel">
            <div className="panel__header">
              <h3>Tutor Reply</h3>
            </div>
            <p>{tutorText || "Tutor response will stream here."}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
