"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";

import { AudioPlayer } from "./AudioPlayer";
import { AvatarProvider } from "./AvatarProvider";
import { AvatarSelector } from "./AvatarSelector";
import { LessonThreadPanels, type LessonConversationTurn } from "./LessonThreadPanels";
import { LatencyMonitor, type LatencyMetrics } from "./LatencyMonitor";
import { TurnDebugPanel } from "./TurnDebugPanel";
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
  clearPersistedLessonThreadRemote,
  generateLessonSessionId,
  hydrateLessonThreadStore,
  persistActiveLessonThread,
  persistArchivedLessonThread,
  type PersistedTurnDebug,
  type PersistedLessonSummary,
  type PersistedLessonThread,
  readPersistedLessonThread,
  refreshArchivedLessonThread,
} from "../lib/lesson_thread_store";
import { PlaybackController, type PlaybackState } from "../lib/playback_controller";
import { useFirebaseAuth } from "../lib/firebase_auth";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_PROVIDER,
  normalizeRuntimeSelection,
  type RuntimeSelection,
  resolveDefaultLlmModel,
  resolveDefaultTtsModel,
  RUNTIME_OPTIONS,
} from "../lib/runtime_options";
import { writeAvatarProviderPreference } from "../lib/avatar_preference";
import {
  createSessionMetrics,
  hydrateSessionMetrics,
  seedSessionMetricsFromLatency,
  type SessionMetricSnapshot,
  toLatencyMetrics,
} from "../lib/session_metrics";
import { createOpenAIRealtimeTransport } from "../lib/openai_realtime_transport";
import { createSessionSocketTransport } from "../lib/session_socket";

const DEFAULT_STUDENT_PROMPT = "";
const DEFAULT_SUBJECT = "math";
const DEFAULT_GRADE_BAND = "6-8";
const TUTOR_SESSION_LOG_PREFIX = "[TutorSession]";

function logTutorSessionInfo(event: string, details: Record<string, unknown>) {
  console.info(TUTOR_SESSION_LOG_PREFIX, event, details);
}

export type TutorTurnRequest = {
  studentText: string;
  subject: string;
  gradeBand: string;
  llmModel?: string;
  llmProvider?: string;
  onTranscriptFinal?: (text: string) => void;
  studentProfile?: {
    pacing?: string;
    preference?: string;
  };
  audioChunks?: CapturedAudioChunk[];
  ttsModel?: string;
  ttsProvider?: string;
};

export type TutorTurnResult = {
  transcript: string;
  tutorText: string;
  state: string;
  latency: LatencyMetrics;
  metricEvents?: SessionMetricSnapshot;
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
  initialAvatarProviderId?: string;
  transport?: SessionTransport;
};

type TurnSource = "text" | "mic";

function createConfiguredTransport(): SessionTransport {
  const socketTransport = createSessionSocketTransport();
  const openaiRealtimeTransport = createOpenAIRealtimeTransport();

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

  return {
    async connect() {
      return socketTransport.connect();
    },
    getSessionId() {
      return socketTransport.getSessionId?.() ?? openaiRealtimeTransport.getSessionId?.() ?? generateLessonSessionId();
    },
    async runTurn(request) {
      if (request.llmProvider === "openai-realtime" && request.ttsProvider === "openai-realtime") {
        return openaiRealtimeTransport.runTurn(request);
      }
      return socketTransport.runTurn(request);
    },
    async interrupt() {
      await Promise.allSettled([
        socketTransport.interrupt(),
        openaiRealtimeTransport.interrupt(),
      ]);
    },
    async reset() {
      await Promise.allSettled([
        socketTransport.reset(),
        openaiRealtimeTransport.reset(),
      ]);
    },
    async switchSession(sessionId, thread) {
      await Promise.allSettled([
        socketTransport.switchSession?.(sessionId, thread),
        openaiRealtimeTransport.switchSession?.(sessionId, thread),
      ]);
    },
  };
}

function normalizeLessonSessionId(sessionId: string | null | undefined): string {
  const normalized = typeof sessionId === "string" ? sessionId.trim() : "";
  if (normalized && normalized !== "undefined" && normalized !== "null") {
    return normalized;
  }

  return generateLessonSessionId();
}

function withNormalizedThreadSessionId(thread: PersistedLessonThread): PersistedLessonThread {
  return {
    ...thread,
    sessionId: normalizeLessonSessionId(thread.sessionId),
  };
}

function resolveThreadStudentPrompt(thread: PersistedLessonThread): string {
  if (thread.studentPrompt.trim()) {
    return thread.studentPrompt;
  }

  const latestTranscript = thread.conversation.at(-1)?.transcript ?? thread.transcript;
  return latestTranscript.trim();
}

function resolveNextTurnId(conversation: LessonConversationTurn[]): number {
  const numericIds = conversation
    .map((turn) => Number.parseInt(turn.id, 10))
    .filter((value) => Number.isFinite(value));
  if (numericIds.length > 0) {
    return Math.max(...numericIds);
  }

  return conversation.length;
}

function resolveConversationKey(turn: LessonConversationTurn, index: number): string {
  return `${turn.id}-${index}`;
}

function summarizeAudioChunks(audioChunks: CapturedAudioChunk[]) {
  return {
    chunkCount: audioChunks.length,
    mimeTypes: Array.from(new Set(audioChunks
      .map((chunk) => chunk.mimeType)
      .filter((mimeType): mimeType is string => Boolean(mimeType)))),
    totalBytes: audioChunks.reduce((sum, chunk) => sum + chunk.size, 0),
    withPayloadCount: audioChunks.filter((chunk) => Boolean(chunk.bytesBase64)).length,
  };
}

function resolveTransportKind(runtimeSelection: RuntimeSelection): PersistedTurnDebug["transport"] {
  return runtimeSelection.llmProvider === "openai-realtime" && runtimeSelection.ttsProvider === "openai-realtime"
    ? "openai-realtime"
    : "session-socket";
}

export function TutorSession({ initialAvatarProviderId, transport }: TutorSessionProps) {
  const { authReady, firebaseEnabled, signInWithGoogle, signOutUser, user } = useFirebaseAuth();
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
  const [llmProvider, setLlmProvider] = useState(DEFAULT_LLM_PROVIDER);
  const [llmModel, setLlmModel] = useState(DEFAULT_LLM_MODEL);
  const [preference, setPreference] = useState("");
  const [transcript, setTranscript] = useState("");
  const [ttsProvider, setTtsProvider] = useState(DEFAULT_TTS_PROVIDER);
  const [ttsModel, setTtsModel] = useState(DEFAULT_TTS_MODEL);
  const [tutorText, setTutorText] = useState("");
  const [conversation, setConversation] = useState<LessonConversationTurn[]>([]);
  const [latency, setLatency] = useState<LatencyMetrics | null>(null);
  const [timestamps, setTimestamps] = useState<WordTimestamp[]>([]);
  const [avatarNowMs, setAvatarNowMs] = useState(0);
  const [error, setError] = useState("");
  const [lessonSessionId, setLessonSessionId] = useState(() => normalizeLessonSessionId(generateLessonSessionId()));
  const [micActive, setMicActive] = useState(false);
  const [avatarProviderId, setAvatarProviderId] = useState(() => resolveAvatarProvider(initialAvatarProviderId).id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recentLessons, setRecentLessons] = useState<PersistedLessonSummary[]>([]);
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

    if (firebaseEnabled && authReady && !user) {
      setConnectionState("sign in");
      return;
    }

    let cancelled = false;

    const connectTransport = async () => {
      try {
        if (sessionTransport.switchSession) {
          await sessionTransport.switchSession(
            normalizeLessonSessionId(lessonSessionId),
            pendingRestoreThreadRef.current ?? undefined
          );
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
  }, [authReady, firebaseEnabled, lessonSessionId, sessionTransport, storageReady, user]);

  useEffect(() => playbackController.subscribe((snapshot) => setPlaybackState(snapshot.state)), [playbackController]);

  useEffect(() => {
    setMicSupported(audioCapture.isSupported());
  }, [audioCapture]);

  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;

    const restoreThreadStore = async () => {
      const hydratedStore = await hydrateLessonThreadStore();
      if (cancelled) {
        return;
      }

      const persistedThread = hydratedStore.activeThread ?? readPersistedLessonThread();
      if (persistedThread) {
        const normalizedThread = withNormalizedThreadSessionId(persistedThread);
        applyThread(normalizedThread);
        setLessonSessionId(normalizedThread.sessionId);
        pendingRestoreThreadRef.current = normalizedThread;
      }
      setRecentLessons(hydratedStore.archive.map(({ thread: _thread, ...summary }) => summary));
      setStorageReady(true);
    };

    void restoreThreadStore();

    return () => {
      cancelled = true;
    };
  }, [authReady, user?.uid]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    void persistActiveLessonThread(buildCurrentThread());
  }, [avatarProviderId, conversation, gradeBand, lessonSessionId, llmModel, llmProvider, preference, storageReady, studentPrompt, subject, transcript, ttsModel, ttsProvider, tutorText]);

  useEffect(() => {
    writeAvatarProviderPreference(avatarProviderId);
  }, [avatarProviderId]);

  function syncRuntimeSelection(nextSelection: Partial<RuntimeSelection> = {}) {
    const normalized = normalizeRuntimeSelection({
      llmModel,
      llmProvider,
      ttsModel,
      ttsProvider,
      ...nextSelection,
    });
    setLlmProvider(normalized.llmProvider);
    setLlmModel(normalized.llmModel);
    setTtsProvider(normalized.ttsProvider);
    setTtsModel(normalized.ttsModel);
    return normalized;
  }

  function buildTurnDebug(
    source: TurnSource,
    audioChunks: CapturedAudioChunk[],
    runtimeSelection: RuntimeSelection,
    result: TutorTurnResult,
    studentTextLength: number,
    startedAt: string
  ): PersistedTurnDebug {
    return {
      audio: summarizeAudioChunks(audioChunks),
      latency: result.latency,
      request: {
        gradeBand,
        llmModel: runtimeSelection.llmModel,
        llmProvider: runtimeSelection.llmProvider,
        preference,
        source,
        studentTextLength,
        subject,
        ttsModel: runtimeSelection.ttsModel,
        ttsProvider: runtimeSelection.ttsProvider,
      },
      response: {
        audioSegmentCount: result.audioSegments?.length ?? 0,
        state: result.state,
        timestampCount: result.timestamps.length,
        transcriptLength: result.transcript.length,
        tutorTextLength: result.tutorText.length,
      },
      sessionId: normalizeLessonSessionId(lessonSessionId),
      startedAt,
      transport: resolveTransportKind(runtimeSelection),
    };
  }

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
          void runDemoTurn([], "text");
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
    const runtimeSelection = normalizeRuntimeSelection({
      llmModel,
      llmProvider,
      ttsModel,
      ttsProvider,
    });

    return {
      avatarProviderId,
      conversation,
      gradeBand,
      llmModel: runtimeSelection.llmModel,
      llmProvider: runtimeSelection.llmProvider,
      preference,
      sessionId: normalizeLessonSessionId(lessonSessionId),
      studentPrompt,
      subject,
      ttsModel: runtimeSelection.ttsModel,
      ttsProvider: runtimeSelection.ttsProvider,
      transcript,
      tutorText,
      version: 1,
    };
  }

  function applyThread(thread: PersistedLessonThread) {
    const runtimeSelection = normalizeRuntimeSelection({
      llmModel: thread.llmModel,
      llmProvider: thread.llmProvider,
      ttsModel: thread.ttsModel,
      ttsProvider: thread.ttsProvider,
    });

    setAvatarProviderId(thread.avatarProviderId);
    setConversation(thread.conversation);
    activeTurnIdRef.current = resolveNextTurnId(thread.conversation);
    setGradeBand(thread.gradeBand);
    setLlmModel(runtimeSelection.llmModel);
    setLlmProvider(runtimeSelection.llmProvider);
    setPreference(thread.preference);
    setStudentPrompt(resolveThreadStudentPrompt(thread));
    setSubject(thread.subject);
    setTtsModel(runtimeSelection.ttsModel);
    setTtsProvider(runtimeSelection.ttsProvider);
    setTranscript(thread.transcript);
    setTutorText(thread.tutorText);
  }

  async function runDemoTurn(audioChunks: CapturedAudioChunk[] = [], source: TurnSource = "text") {
    const turnId = activeTurnIdRef.current + 1;
    const submittedPrompt = source === "mic" ? "" : studentPrompt;
    const startedAt = new Date().toISOString();
    const runtimeSelection = normalizeRuntimeSelection({
      llmModel,
      llmProvider,
      ttsModel,
      ttsProvider,
    });
    activeTurnIdRef.current = turnId;
    setError("");
    setSessionState("thinking");
    setLatency(null);
    metricsRef.current = createSessionMetrics();
    if (
      runtimeSelection.llmProvider !== llmProvider
      || runtimeSelection.llmModel !== llmModel
      || runtimeSelection.ttsProvider !== ttsProvider
      || runtimeSelection.ttsModel !== ttsModel
    ) {
      syncRuntimeSelection(runtimeSelection);
    }
    if (source === "mic") {
      const audioSummary = summarizeAudioChunks(audioChunks);
      logTutorSessionInfo("turn.mic.submit", {
        audioChunkCount: audioSummary.chunkCount,
        bytesWithPayloadCount: audioSummary.withPayloadCount,
        mimeTypes: audioSummary.mimeTypes,
        totalBytes: audioSummary.totalBytes,
      });
    }
    try {
      const result = await sessionTransport.runTurn({
        studentText: submittedPrompt,
        subject,
        gradeBand,
        llmModel: runtimeSelection.llmModel,
        llmProvider: runtimeSelection.llmProvider,
        onTranscriptFinal:
          source === "mic"
            ? (text) => {
                if (activeTurnIdRef.current !== turnId) {
                  return;
                }
                setStudentPrompt(text);
                setTranscript(text);
              }
            : undefined,
        studentProfile: preference ? { preference } : undefined,
        audioChunks,
        ttsModel: runtimeSelection.ttsModel,
        ttsProvider: runtimeSelection.ttsProvider,
      });
      if (activeTurnIdRef.current !== turnId) {
        return;
      }
      setTranscript(result.transcript);
      setTutorText(result.tutorText);
      if (source === "text") {
        setStudentPrompt("");
      } else if (result.transcript.trim()) {
        setStudentPrompt(result.transcript);
      }
      setConversation((current) => [
        ...current,
        {
          debug: buildTurnDebug(source, audioChunks, runtimeSelection, result, submittedPrompt.length, startedAt),
          id: `${turnId}`,
          transcript: result.transcript,
          tutorText: result.tutorText,
        },
      ]);
      setSessionState(result.state);
      metricsRef.current = result.metricEvents
        ? hydrateSessionMetrics(result.metricEvents)
        : seedSessionMetricsFromLatency(result.latency);
      setLatency(toLatencyMetrics(metricsRef.current));
      setTimestamps(result.timestamps);
      setAvatarProviderId((currentId) => result.avatarConfig ? resolveAvatarProviderId(result.avatarConfig) : currentId);
      const playbackSegments = result.audioSegments?.length
        ? result.audioSegments
        : [
            {
              text: result.tutorText,
              durationMs: result.timestamps.at(-1)?.endMs ?? Math.max(600, result.tutorText.length * 25),
            },
          ];
      playbackSegments.forEach((segment, index) => {
        const shouldDeferCompletion = !segment.audioBase64;
        playbackController.enqueue({
          id: `${turnId}-${index}-${Date.now()}`,
          text: segment.text,
          audioBase64: segment.audioBase64,
          audioMimeType: segment.audioMimeType,
          deferCompletion: shouldDeferCompletion,
          durationMs: segment.durationMs ?? Math.max(300, segment.text.length * 18),
          onPlaybackStart: () => {
            if (activeTurnIdRef.current !== turnId || index !== 0) {
              return;
            }
            metricsRef.current.mark({ name: "first_viseme", tsMs: performance.now() });
            setLatency(toLatencyMetrics(metricsRef.current));
          },
          onPlaybackComplete: () => {
            if (activeTurnIdRef.current !== turnId || index !== playbackSegments.length - 1) {
              return;
            }
            metricsRef.current.mark({ name: "audio_done", tsMs: performance.now() });
            setLatency(toLatencyMetrics(metricsRef.current));
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
    setRecentLessons(await persistArchivedLessonThread(buildCurrentThread()));
    const nextSessionId = normalizeLessonSessionId(generateLessonSessionId());
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
    setLlmProvider(DEFAULT_LLM_PROVIDER);
    setLlmModel(DEFAULT_LLM_MODEL);
    setPreference("");
    setTtsProvider(DEFAULT_TTS_PROVIDER);
    setTtsModel(DEFAULT_TTS_MODEL);
    await clearPersistedLessonThreadRemote();
  }

  async function resumeLesson(lessonId: string) {
    const archivedThread = await refreshArchivedLessonThread(lessonId);
    if (!archivedThread) {
      return;
    }
    const normalizedThread = withNormalizedThreadSessionId(archivedThread);

    activeTurnIdRef.current += 1;
    if (sessionTransport.switchSession) {
      await sessionTransport.switchSession(normalizedThread.sessionId, normalizedThread);
    } else {
      await sessionTransport.reset();
    }
    playbackController.interrupt();
    await audioCapture.cancel();
    micHoldRef.current = false;
    micStartingRef.current = false;
    micActiveRef.current = false;
    setLessonSessionId(normalizedThread.sessionId);
    setSessionState("idle");
    setLatency(null);
    setTimestamps([]);
    setAvatarNowMs(0);
    setError("");
    setMicActive(false);
    setHistoryOpen(false);
    applyThread(normalizedThread);
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
      logTutorSessionInfo("mic.start", { sessionState });
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
      logTutorSessionInfo("mic.stop", {
        audioChunkCount: chunks.length,
        bytesWithPayloadCount: chunks.filter((chunk) => Boolean(chunk.bytesBase64)).length,
        mimeTypes: Array.from(new Set(chunks.map((chunk) => chunk.mimeType).filter(Boolean))),
        totalBytes: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
      });
      micActiveRef.current = false;
      setMicActive(false);
      await runDemoTurn(chunks, "mic");
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
    <main
      className={`tutor-layout ${historyOpen ? "tutor-layout--history-open" : ""}`}
      data-testid="tutor-layout"
    >
      {/* Left Sidebar - Fixed Settings Rail */}
      <aside className="settings-rail">
        <div className="settings-rail__content">
          <div className="settings-rail__brand">
            <p className="eyebrow">AI Tutor</p>
          </div>

          <nav className="settings-rail__nav">
            <div className="settings-section">
              <h4 className="settings-section__title">Lesson</h4>
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
                  <span>Grade</span>
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
                <span>Preference</span>
                <input
                  aria-label="Learning preference"
                  onChange={(event) => setPreference(event.target.value)}
                  placeholder="Slow down, examples..."
                  type="text"
                  value={preference}
                />
              </label>
            </div>

            <div className="settings-section">
              <h4 className="settings-section__title">Avatar</h4>
              <AvatarSelector
                onAvatarChange={setAvatarProviderId}
                onModeChange={handleAvatarModeChange}
                selectedAvatarId={avatarProviderId}
                selectedMode={avatarMode}
              />
            </div>

            <div className="settings-section">
              <h4 className="settings-section__title">Models</h4>
              <div className="field-grid">
                <label className="field">
                  <span>LLM</span>
                  <select
                    aria-label="LLM provider"
                    onChange={(event) => {
                      const nextProvider = event.target.value;
                      syncRuntimeSelection({
                        llmModel: resolveDefaultLlmModel(nextProvider),
                        llmProvider: nextProvider,
                      });
                    }}
                    value={llmProvider}
                  >
                    {Object.keys(RUNTIME_OPTIONS.llm).map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>LLM model</span>
                  <select
                    aria-label="LLM model"
                    onChange={(event) => syncRuntimeSelection({ llmModel: event.target.value })}
                    value={llmModel}
                  >
                    {RUNTIME_OPTIONS.llm[llmProvider as keyof typeof RUNTIME_OPTIONS.llm].map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="field-grid">
                <label className="field">
                  <span>TTS</span>
                  <select
                    aria-label="TTS provider"
                    onChange={(event) => {
                      const nextProvider = event.target.value;
                      syncRuntimeSelection({
                        ttsModel: resolveDefaultTtsModel(nextProvider),
                        ttsProvider: nextProvider,
                      });
                    }}
                    value={ttsProvider}
                  >
                    {Object.keys(RUNTIME_OPTIONS.tts).map((provider) => (
                      <option key={provider} value={provider}>
                        {provider}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>TTS model</span>
                  <select
                    aria-label="TTS model"
                    onChange={(event) => syncRuntimeSelection({ ttsModel: event.target.value })}
                    value={ttsModel}
                  >
                    {RUNTIME_OPTIONS.tts[ttsProvider as keyof typeof RUNTIME_OPTIONS.tts].map((model) => (
                      <option key={model.value} value={model.value}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h4 className="settings-section__title">Controls</h4>
              <div className="rail-actions">
                {playbackState === "speaking" ? (
                  <button
                    aria-label="Interrupt"
                    className="icon-button icon-button--danger"
                    onClick={() => void interruptTurn()}
                    title="Interrupt"
                    type="button"
                  >
                    <svg
                      aria-hidden="true"
                      className="icon-button__icon"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <rect height="10" rx="2.5" width="10" x="7" y="7" />
                    </svg>
                  </button>
                ) : null}
                <button
                  aria-label="New Lesson"
                  className="secondary-button"
                  onClick={() => void resetLesson()}
                  type="button"
                >
                  New
                </button>
              </div>
            </div>
          </nav>

          <div className="settings-rail__footer">
            <AudioPlayer controller={playbackController} variant="hidden" />
            <div className="connection-status" style={{ justifyContent: "space-between", gap: "0.75rem" }}>
              <span className="connection-status__text">
                {!firebaseEnabled
                  ? "local lessons"
                  : !authReady
                    ? "account loading"
                    : user
                      ? user.email ?? "signed in"
                      : "sign in to sync"}
              </span>
              {firebaseEnabled ? (
                user ? (
                  <button className="secondary-button" onClick={() => void signOutUser()} type="button">
                    Sign out
                  </button>
                ) : (
                  <button className="secondary-button" onClick={() => void signInWithGoogle()} type="button">
                    Sign in
                  </button>
                )
              ) : null}
            </div>
            <div className="connection-status">
              <span className={`status-dot ${
                connectionState === "connected" ? "status-dot--online" :
                connectionState === "connecting" ? "status-dot--connecting" :
                "status-dot--offline"
              }`} />
              <span className="connection-status__text">{connectionState}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Center Stage - Avatar Hero */}
      <section className="main-stage">
        <div className="main-stage__content">
          {/* Top Bar */}
          <header className="stage-header">
            <div className="stage-header__left">
              <h1 className="stage-header__title">Math Tutor</h1>
              <p className="stage-header__meta">{subject} · grade {gradeBand}</p>
            </div>
            <div className="stage-header__right">
              <button
                aria-label="Toggle history"
                aria-controls="history-drawer"
                aria-expanded={historyOpen}
                className="icon-button stage-header__history"
                onClick={() => setHistoryOpen((current) => !current)}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="icon-button__icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {conversation.length > 0 && (
                  <span className="stage-header__badge">{conversation.length}</span>
                )}
              </button>
            </div>
          </header>

          {/* Avatar Stage - Hero */}
          <div className="avatar-stage">
            <AvatarProvider
              avatarId={avatarProviderId}
              config={avatarConfig}
              controls={null}
              energy={playbackState === "speaking" ? 0.8 : avatarState === "fading" ? 0.3 : 0.2}
              historyToggle={null}
              nowMs={avatarNowMs}
              state={avatarState}
              subtitle={tutorText}
              timestamps={timestamps}
              variant="hero"
            />
          </div>

          {/* Composer */}
          <div className="composer-stage">
            <div className="composer-stage__input">
              <textarea
                aria-label="Student prompt"
                className="composer-input"
                onChange={(event) => setStudentPrompt(event.target.value)}
                placeholder="Ask anything..."
                rows={1}
                value={studentPrompt}
              />
              <div className="composer-stage__actions">
                <button
                  ref={sendButtonRef}
                  aria-label="Send"
                  className="send-button"
                  disabled={sessionState === "thinking" || sessionState === "listening" || !studentPrompt.trim()}
                  onClick={() => void runDemoTurn([], "text")}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  aria-label={micActive ? "Release to send" : "Hold to talk"}
                  className={`mic-button ${micActive ? "mic-button--live" : ""}`}
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
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="mic-button__icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7.5a3.5 3.5 0 1 0-7 0V12a3.5 3.5 0 0 0 3.5 3.5Z" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3M9 20h6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
            {error && <p className="composer-stage__error" role="alert">{error}</p>}
            <p className="composer-stage__hint">
              Hold mic to talk · Cmd+Enter to send · Esc to interrupt
            </p>
          </div>

          {/* Latency Monitor - Minimal */}
          <div className="stage-footer">
            <LatencyMonitor metrics={latency} variant="inline" />
          </div>
        </div>
      </section>

      {/* Right Drawer - History Slide-over */}
      <aside
        id="history-drawer"
        aria-hidden={!historyOpen}
        className={`history-drawer ${historyOpen ? "history-drawer--open" : ""}`}
        data-testid="history-drawer"
      >
        <div className="history-drawer__backdrop" onClick={() => setHistoryOpen(false)} />
        <div className="history-drawer__panel">
          <div className="history-drawer__header">
            <h2 className="history-drawer__title">History</h2>
            <button
              aria-label="Close history"
              className="icon-button"
              onClick={() => setHistoryOpen(false)}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="icon-button__icon"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          <div className="history-drawer__content">
            <section className="history-section">
              <h3 className="history-section__title">This conversation</h3>
              {conversation.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state__text">Your conversation will appear here</p>
                </div>
              ) : (
                <div className="conversation-list" data-testid="conversation-history-panel">
                  {conversation.map((turn, index) => (
                    <div key={resolveConversationKey(turn, index)} className="conversation-turn">
                      <div className="conversation-turn__header">
                        <span className="conversation-turn__number">{index + 1}</span>
                        <TurnDebugPanel debug={turn.debug} turnId={turn.id} />
                      </div>
                      <div className="conversation-turn__student">
                        <div className="conversation-turn__label">You</div>
                        <p>{turn.transcript}</p>
                      </div>
                      <div className="conversation-turn__tutor">
                        <div className="conversation-turn__label">Tutor</div>
                        <p>{turn.tutorText}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="history-section">
              <h3 className="history-section__title">Previous lessons</h3>
              {recentLessons.length === 0 ? (
                <div className="empty-state">
                  <p className="empty-state__text">Past lessons appear after starting a new one</p>
                </div>
              ) : (
                <div className="lessons-list">
                  {recentLessons.map((lesson) => (
                    <button
                      key={lesson.id}
                      className="lesson-card"
                      data-testid={`resume-lesson-${lesson.id}`}
                      onClick={() => {
                        void resumeLesson(lesson.id);
                        setHistoryOpen(false);
                      }}
                      type="button"
                    >
                      <div className="lesson-card__header">
                        <span className="lesson-card__subject">{lesson.subject}</span>
                        <span className="lesson-card__grade">{lesson.gradeBand}</span>
                      </div>
                      <div className="lesson-card__title">{lesson.title}</div>
                      <div className="lesson-card__meta">{lesson.turnCount} turn{lesson.turnCount === 1 ? "" : "s"}</div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </aside>
    </main>
  );
}
