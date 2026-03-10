"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";

import { AudioPlayer } from "./AudioPlayer";
import { AvatarProvider } from "./AvatarProvider";
import { AvatarSelector } from "./AvatarSelector";
import { LessonThreadPanels, type LessonConversationTurn } from "./LessonThreadPanels";
import { LatencyMonitor, type LatencyMetrics } from "./LatencyMonitor";
import {
  resolveAvatarMode,
  resolveAvatarProvider,
  resolveAvatarProviderId,
  resolveDefaultAvatarProviderId,
} from "./avatar_registry";
import { BrowserAudioCapture, type CapturedAudioChunk } from "../lib/audio_capture";
import type { AvatarRenderMode } from "../lib/avatar_manifest";
import type { AvatarVisualState, WordTimestamp } from "../lib/avatar_contract";
import { createFixtureTransport } from "../lib/fixture_transport";
import {
  archivePersistedLessonThread,
  clearPersistedLessonThread,
  generateLessonSessionId,
  listArchivedLessonThreads,
  type PersistedLessonThread,
  readPersistedLessonThread,
  readArchivedLessonThread,
  writePersistedLessonThread,
} from "../lib/lesson_thread_store";
import { PlaybackController, type PlaybackState } from "../lib/playback_controller";
import { createSessionMetrics } from "../lib/session_metrics";
import { createSessionSocketTransport } from "../lib/session_socket";

const DEFAULT_STUDENT_PROMPT = "I don't understand how to solve for x.";
const DEFAULT_SUBJECT = "math";
const DEFAULT_GRADE_BAND = "6-8";

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
  audioSegments?: Array<{
    text: string;
    audioBase64?: string;
    audioMimeType?: string;
    durationMs?: number;
  }>;
  avatarConfig?: {
    assetRef?: string;
    provider: string;
    type: "2d" | "3d";
    model_url?: string;
  };
};

export type SessionTransport = {
  connect: () => Promise<"connected" | "failed">;
  getSessionId?: () => string;
  runTurn: (request: TutorTurnRequest) => Promise<TutorTurnResult>;
  interrupt: () => Promise<void>;
  reset: () => Promise<void>;
  switchSession?: (sessionId: string, thread?: PersistedLessonThread) => Promise<void>;
};

type TutorSessionProps = {
  transport?: SessionTransport;
};

function createConfiguredTransport(): SessionTransport {
  if (
    typeof process !== "undefined"
    && process.env.NEXT_PUBLIC_SESSION_TRANSPORT === "fixture"
  ) {
    const searchParams =
      typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search);
    const avatarId = searchParams.get("fixtureAvatar") ?? undefined;
    const scenario = searchParams.get("fixtureScenario");
    return createFixtureTransport({
      avatarId,
      scenarioId: scenario === "science-observation" ? scenario : undefined,
    });
  }

  return createSessionSocketTransport();
}

export function TutorSession({ transport }: TutorSessionProps) {
  const [sessionTransport] = useState(() => transport ?? createConfiguredTransport());
  const [playbackController] = useState(() => new PlaybackController());
  const [audioCapture] = useState(() => new BrowserAudioCapture());
  const [micSupported, setMicSupported] = useState(true);
  const [connectionState, setConnectionState] = useState("connecting");
  const [sessionState, setSessionState] = useState("idle");
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [avatarState, setAvatarState] = useState<AvatarVisualState>("idle");
  const [studentPrompt, setStudentPrompt] = useState(DEFAULT_STUDENT_PROMPT);
  const [subject, setSubject] = useState(DEFAULT_SUBJECT);
  const [gradeBand, setGradeBand] = useState(DEFAULT_GRADE_BAND);
  const [preference, setPreference] = useState("");
  const [transcript, setTranscript] = useState("");
  const [tutorText, setTutorText] = useState("");
  const [conversation, setConversation] = useState<LessonConversationTurn[]>([]);
  const [latency, setLatency] = useState<LatencyMetrics | null>(null);
  const [timestamps, setTimestamps] = useState<WordTimestamp[]>([]);
  const [avatarNowMs, setAvatarNowMs] = useState(0);
  const [error, setError] = useState("");
  const [lessonSessionId, setLessonSessionId] = useState(() => generateLessonSessionId());
  const [micActive, setMicActive] = useState(false);
  const [avatarProviderId, setAvatarProviderId] = useState(resolveAvatarProvider().id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recentLessons, setRecentLessons] = useState(() => listArchivedLessonThreads());
  const [storageReady, setStorageReady] = useState(false);
  const metricsRef = useRef(createSessionMetrics());
  const pendingRestoreThreadRef = useRef<PersistedLessonThread | null>(null);
  const previousPlaybackStateRef = useRef<PlaybackState>("idle");
  const activeTurnIdRef = useRef(0);
  const selectedAvatar = resolveAvatarProvider(avatarProviderId);
  const avatarConfig = selectedAvatar.config;
  const avatarMode = resolveAvatarMode(avatarProviderId);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const micHoldRef = useRef(false);
  const micStartingRef = useRef(false);
  const micActiveRef = useRef(false);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    let cancelled = false;

    const connectTransport = async () => {
      try {
        if (sessionTransport.switchSession) {
          await sessionTransport.switchSession(lessonSessionId, pendingRestoreThreadRef.current ?? undefined);
        }
        pendingRestoreThreadRef.current = null;
        const result = await sessionTransport.connect();
        if (!cancelled) {
          setConnectionState(result);
        }
      } catch {
        if (!cancelled) {
          setConnectionState("failed");
        }
      }
    };

    void connectTransport();

    return () => {
      cancelled = true;
    };
  }, [lessonSessionId, sessionTransport, storageReady]);

  useEffect(() => playbackController.subscribe((snapshot) => setPlaybackState(snapshot.state)), [playbackController]);

  useEffect(() => {
    setMicSupported(audioCapture.isSupported());
  }, [audioCapture]);

  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);

  useEffect(() => {
    const persistedThread = readPersistedLessonThread();
    if (persistedThread) {
      applyThread(persistedThread);
      setLessonSessionId(persistedThread.sessionId);
      pendingRestoreThreadRef.current = persistedThread;
    }
    setRecentLessons(listArchivedLessonThreads());
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    writePersistedLessonThread(buildCurrentThread());
  }, [avatarProviderId, conversation, gradeBand, lessonSessionId, preference, storageReady, studentPrompt, subject, transcript, tutorText]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd/Ctrl + Enter to send
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (sessionState !== "thinking" && sessionState !== "listening") {
          void runDemoTurn([]);
        }
        return;
      }

      // Escape to interrupt
      if (event.key === "Escape" && sessionState !== "idle") {
        event.preventDefault();
        void interruptTurn();
        return;
      }

      // Cmd/Ctrl + K to focus input
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        sendButtonRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sessionState]);

  function buildCurrentThread(): PersistedLessonThread {
    return {
      avatarProviderId,
      conversation,
      gradeBand,
      preference,
      sessionId: lessonSessionId,
      studentPrompt,
      subject,
      transcript,
      tutorText,
      version: 1,
    };
  }

  function applyThread(thread: PersistedLessonThread) {
    setAvatarProviderId(thread.avatarProviderId);
    setConversation(thread.conversation);
    setGradeBand(thread.gradeBand);
    setPreference(thread.preference);
    setStudentPrompt(thread.studentPrompt);
    setSubject(thread.subject);
    setTranscript(thread.transcript);
    setTutorText(thread.tutorText);
  }

  async function runDemoTurn(audioChunks?: CapturedAudioChunk[]) {
    const turnId = activeTurnIdRef.current + 1;
    activeTurnIdRef.current = turnId;
    setError("");
    setSessionState("thinking");
    setLatency(null);
    metricsRef.current = createSessionMetrics();
    try {
      const result = await sessionTransport.runTurn({
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
      setConversation((current) => [
        ...current,
        {
          id: `${turnId}`,
          transcript: result.transcript,
          tutorText: result.tutorText,
        },
      ]);
      setSessionState(result.state);
      setLatency(result.latency);
      setTimestamps(result.timestamps);
      setAvatarProviderId((currentId) => result.avatarConfig ? resolveAvatarProviderId(result.avatarConfig) : currentId);
      metricsRef.current.mark({ name: "tts_first_audio", tsMs: performance.now() });
      const playbackSegments = result.audioSegments?.length
        ? result.audioSegments
        : [
            {
              text: result.tutorText,
              durationMs: result.timestamps.at(-1)?.endMs ?? Math.max(600, result.tutorText.length * 25),
            },
          ];
      playbackSegments.forEach((segment, index) => {
        playbackController.enqueue({
          id: `${turnId}-${index}-${Date.now()}`,
          text: segment.text,
          audioBase64: segment.audioBase64,
          audioMimeType: segment.audioMimeType,
          durationMs: segment.durationMs ?? Math.max(300, segment.text.length * 18),
          onStart: () => {
            if (activeTurnIdRef.current !== turnId || index !== 0) {
              return;
            }
            metricsRef.current.mark({ name: "first_viseme", tsMs: performance.now() });
          },
          onComplete: () => {
            if (activeTurnIdRef.current !== turnId || index !== playbackSegments.length - 1) {
              return;
            }
            metricsRef.current.mark({ name: "audio_done", tsMs: performance.now() });
            setSessionState("idle");
          },
        });
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
    await sessionTransport.interrupt();
    playbackController.interrupt();
    await audioCapture.cancel();
    micHoldRef.current = false;
    micStartingRef.current = false;
    micActiveRef.current = false;
    setSessionState("idle");
    setLatency(null);
    setTimestamps([]);
    setAvatarNowMs(0);
    setMicActive(false);
    setHistoryOpen(false);
  }

  async function resetLesson() {
    setRecentLessons(archivePersistedLessonThread(buildCurrentThread()));
    const nextSessionId = generateLessonSessionId();
    activeTurnIdRef.current += 1;
    if (sessionTransport.switchSession) {
      await sessionTransport.switchSession(nextSessionId);
    } else {
      await sessionTransport.reset();
    }
    playbackController.interrupt();
    await audioCapture.cancel();
    micHoldRef.current = false;
    micStartingRef.current = false;
    micActiveRef.current = false;
    setLessonSessionId(nextSessionId);
    setSessionState("idle");
    setTranscript("");
    setTutorText("");
    setConversation([]);
    setLatency(null);
    setTimestamps([]);
    setAvatarNowMs(0);
    setError("");
    setMicActive(false);
    setHistoryOpen(false);
    setStudentPrompt(DEFAULT_STUDENT_PROMPT);
    setSubject(DEFAULT_SUBJECT);
    setGradeBand(DEFAULT_GRADE_BAND);
    setPreference("");
    clearPersistedLessonThread();
  }

  async function resumeLesson(lessonId: string) {
    const archivedThread = readArchivedLessonThread(lessonId);
    if (!archivedThread) {
      return;
    }

    activeTurnIdRef.current += 1;
    if (sessionTransport.switchSession) {
      await sessionTransport.switchSession(archivedThread.sessionId, archivedThread);
    } else {
      await sessionTransport.reset();
    }
    playbackController.interrupt();
    await audioCapture.cancel();
    micHoldRef.current = false;
    micStartingRef.current = false;
    micActiveRef.current = false;
    setLessonSessionId(archivedThread.sessionId);
    setSessionState("idle");
    setLatency(null);
    setTimestamps([]);
    setAvatarNowMs(0);
    setError("");
    setMicActive(false);
    setHistoryOpen(false);
    applyThread(archivedThread);
  }

  async function startMicCapture() {
    if (!micSupported) {
      setError("Microphone capture is not supported in this browser");
      return;
    }

    if (micStartingRef.current || micActiveRef.current) {
      return;
    }

    setError("");
    micStartingRef.current = true;
    try {
      await audioCapture.start();
      micStartingRef.current = false;
      micActiveRef.current = true;
      setMicActive(true);
      setSessionState("listening");

      if (!micHoldRef.current) {
        await stopMicCapture();
      }
    } catch (caughtError) {
      micStartingRef.current = false;
      micActiveRef.current = false;
      setMicActive(false);
      setSessionState("idle");
      setError(caughtError instanceof Error ? caughtError.message : "Could not start microphone");
    }
  }

  async function stopMicCapture() {
    if (micStartingRef.current || !micActiveRef.current) {
      return;
    }

    try {
      const chunks = await audioCapture.stop();
      micActiveRef.current = false;
      setMicActive(false);
      await runDemoTurn(chunks);
    } catch (caughtError) {
      micActiveRef.current = false;
      setMicActive(false);
      setSessionState("idle");
      setError(caughtError instanceof Error ? caughtError.message : "Could not stop microphone");
    }
  }

  function handleMicPressStart(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || micHoldRef.current || sessionState === "thinking") {
      return;
    }

    event.preventDefault();
    micHoldRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    void startMicCapture();
  }

  function handleMicPressEnd(event?: React.PointerEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>) {
    if (!micHoldRef.current) {
      return;
    }

    micHoldRef.current = false;

    if (event && "pointerId" in event && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    void stopMicCapture();
  }

  function handleMicMouseDown(event: React.MouseEvent<HTMLButtonElement>) {
    if (event.button !== 0 || micHoldRef.current || sessionState === "thinking") {
      return;
    }

    event.preventDefault();
    micHoldRef.current = true;
    void startMicCapture();
  }

  function handleMicMouseUp() {
    if (!micHoldRef.current) {
      return;
    }

    micHoldRef.current = false;
    void stopMicCapture();
  }

  function handleMicButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if ((event.key !== " " && event.key !== "Enter") || event.repeat || micHoldRef.current) {
      return;
    }

    event.preventDefault();
    micHoldRef.current = true;
    void startMicCapture();
  }

  function handleMicButtonKeyUp(event: React.KeyboardEvent<HTMLButtonElement>) {
    if ((event.key !== " " && event.key !== "Enter") || !micHoldRef.current) {
      return;
    }

    event.preventDefault();
    micHoldRef.current = false;
    void stopMicCapture();
  }

  function handleAvatarModeChange(nextMode: AvatarRenderMode) {
    setAvatarProviderId(resolveDefaultAvatarProviderId(nextMode));
  }

  return (
    <main className="session-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Live AI Video Tutor</p>
          <h1>Realtime voice tutoring, benchmark first.</h1>
        </div>
        <div className="hero-status">
          <span className={`status-pill ${
            connectionState === "connected" ? "status-pill--connected" :
            connectionState === "connecting" ? "status-pill--connecting" :
            connectionState === "failed" ? "status-pill--failed" : ""
          }`}>
            {connectionState === "connected" ? "Online" : connectionState}
          </span>
          <span className={`status-pill ${
            sessionState === "thinking" || sessionState === "listening" ? "status-pill--live" :
            sessionState === "failed" ? "status-pill--failed" : ""
          }`}>
            {sessionState}
          </span>
        </div>
      </section>

      <section className="session-grid">
        {/* Left column: Controls */}
        <div className="stack">
          {/* Lesson Configuration */}
          <div className="panel panel--compact">
            <div className="section-group">
              <h4 className="section-title">Lesson Settings</h4>
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
                <span>Learning preference</span>
                <input
                  aria-label="Learning preference"
                  onChange={(event) => setPreference(event.target.value)}
                  placeholder="Slow down, use examples..."
                  type="text"
                  value={preference}
                />
              </label>
            </div>

            {/* Student Input */}
            <div className="section-group">
              <h4 className="section-title">Your Question</h4>
              <label className="field">
                <textarea
                  aria-label="Student prompt"
                  onChange={(event) => setStudentPrompt(event.target.value)}
                  placeholder="Ask a question..."
                  rows={3}
                  value={studentPrompt}
                />
              </label>

              {/* Action Bar */}
              <div className="action-bar">
                <div className="action-bar__primary">
                  <button
                    ref={sendButtonRef}
                    aria-label="Send Text Turn"
                    className="primary-button"
                    disabled={sessionState === "thinking" || sessionState === "listening"}
                    onClick={() => void runDemoTurn([])}
                    type="button"
                  >
                    Send Text Turn
                  </button>
                  <button
                    aria-label={micActive ? "Release to send voice" : "Hold to talk"}
                    className={`primary-button mic-button ${micActive ? "mic-button--live" : ""}`}
                    disabled={!micSupported || sessionState === "thinking"}
                    onBlur={(event) => handleMicPressEnd(event)}
                    onKeyDown={handleMicButtonKeyDown}
                    onKeyUp={handleMicButtonKeyUp}
                    onLostPointerCapture={(event) => handleMicPressEnd(event)}
                    onMouseDown={handleMicMouseDown}
                    onMouseUp={handleMicMouseUp}
                    onPointerCancel={(event) => handleMicPressEnd(event)}
                    onPointerDown={handleMicPressStart}
                    onPointerUp={(event) => handleMicPressEnd(event)}
                    title={micActive ? "Release to send voice" : "Hold to talk"}
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="mic-button__icon"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7.5a3.5 3.5 0 1 0-7 0V12a3.5 3.5 0 0 0 3.5 3.5Z"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                      <path
                        d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3M9 20h6"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                      />
                    </svg>
                  </button>
                </div>
                <div className="action-bar__secondary">
                  <button
                    aria-label="Interrupt"
                    className="secondary-button"
                    disabled={sessionState === "idle"}
                    onClick={() => void interruptTurn()}
                    type="button"
                  >
                    Interrupt
                  </button>
                  <button
                    aria-label="New Lesson"
                    className="ghost-button"
                    onClick={() => void resetLesson()}
                    type="button"
                  >
                    New Lesson
                  </button>
                </div>
                <p className="helper-text action-bar__hint">
                  Text is the primary lesson path. Hold the mic to talk, release to send, Cmd/Ctrl+Enter sends text, Esc interrupts.
                </p>
              </div>
              {error ? <p className="error-text" role="alert">{error}</p> : null}
            </div>
          </div>

          {/* Avatar Selection */}
          <div className="panel panel--compact">
            <div className="panel__header">
              <h3>Avatar</h3>
              <span className="status-pill">{avatarMode.toUpperCase()}</span>
            </div>
            <AvatarSelector
              onAvatarChange={setAvatarProviderId}
              onModeChange={handleAvatarModeChange}
              selectedAvatarId={avatarProviderId}
              selectedMode={avatarMode}
            />
          </div>

          {/* Debug: Latency */}
          <LatencyMonitor metrics={latency} />
        </div>

        {/* Right column: Avatar + Output */}
        <div className="stack">
          <AvatarProvider
            avatarId={avatarProviderId}
            config={avatarConfig}
            controls={<AudioPlayer controller={playbackController} variant="inline" />}
            energy={playbackState === "speaking" ? 0.7 : avatarState === "fading" ? 0.24 : 0.12}
            historyToggle={(
              <button
                aria-expanded={historyOpen}
                aria-label={historyOpen ? "Hide history" : "Show history"}
                className="ghost-button avatar-panel__history-toggle"
                onClick={() => setHistoryOpen((current) => !current)}
                type="button"
              >
                {historyOpen ? "Hide history" : `History ${conversation.length}`}
              </button>
            )}
            nowMs={avatarNowMs}
            state={avatarState}
            subtitle={tutorText}
            timestamps={timestamps}
          />

          {historyOpen ? (
            <LessonThreadPanels
              conversation={conversation}
              onResumeLesson={resumeLesson}
              recentLessons={recentLessons}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
