"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";

import { AudioPlayer } from "./AudioPlayer";
import { AvatarProvider } from "./AvatarProvider";
import { ManagedAvatarSession } from "./ManagedAvatarSession";
import { type LessonConversationTurn } from "./LessonThreadPanels";
import { type LatencyMetrics } from "./LatencyMonitor";
import { TurnDebugPanel } from "./TurnDebugPanel";
import { DashboardLayout } from "./layout";
import {
  resolveAvatarMode,
  resolveAvatarProvider,
  resolveAvatarProviderId,
} from "./avatar_registry";
import { BrowserAudioCapture, type CapturedAudioChunk } from "../lib/audio_capture";
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
  OPENAI_REALTIME_PROVIDER,
  normalizeRuntimeSelection,
  type RuntimeSelection,
} from "../lib/runtime_options";
import { readAvatarProviderPreference } from "../lib/avatar_preference";
import { resolveAvatarPersona } from "../lib/avatar_persona";
import {
  createSessionMetrics,
  hydrateSessionMetrics,
  seedSessionMetricsFromLatency,
  type SessionMetricSnapshot,
  toLatencyMetrics,
} from "../lib/session_metrics";
import {
  DEFAULT_SESSION_PREFERENCES,
  readSessionPreferences,
} from "../lib/session_preferences";
import { createOpenAIRealtimeTransport } from "../lib/openai_realtime_transport";
import { createSessionSocketTransport } from "../lib/session_socket";
import {
  buildLessonStateFromCatalog,
  resolveLessonCatalogItem,
  resolveLessonResumeQuestion,
  type LessonState,
} from "../lib/lesson_catalog";

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
  onTranscriptUpdate?: (text: string) => void;
  studentProfile?: {
    avatarLabel?: string;
    avatarPersona?: string;
    pacing?: string;
    preference?: string;
  };
  audioChunks?: CapturedAudioChunk[];
  ttsModel?: string;
  ttsProvider?: string;
};

export type TutorTurnResult = {
  turnId?: string;
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
    type: "2d" | "3d" | "video";
    providerId?: string;
    model_url?: string;
  };
};

export type PlaybackMetricReport = {
  turnId: string;
  name: "first_viseme" | "audio_done";
  tsMs: number;
};

export type SessionTransport = {
  connect: () => Promise<"connected" | "failed">;
  getSessionId?: () => string;
  runTurn: (request: TutorTurnRequest) => Promise<TutorTurnResult>;
  reportMetric?: (event: PlaybackMetricReport) => Promise<void>;
  transcribeAudio?: (request: TutorTurnRequest) => Promise<string>;
  interrupt: () => Promise<void>;
  reset: () => Promise<void>;
  switchSession?: (sessionId: string, thread?: PersistedLessonThread) => Promise<void>;
};

type TutorSessionProps = {
  initialAvatarProviderId?: string;
  transport?: SessionTransport;
};

type TurnSource = "text" | "mic";

export function createConfiguredTransport(): SessionTransport {
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
    async transcribeAudio(request) {
      const socketTranscribe = socketTransport.transcribeAudio;
      const realtimeTranscribe = openaiRealtimeTransport.transcribeAudio;

      if (socketTranscribe) {
        try {
          return await socketTranscribe(request);
        } catch (error) {
          if (
            request.llmProvider === OPENAI_REALTIME_PROVIDER
            && request.ttsProvider === OPENAI_REALTIME_PROVIDER
            && realtimeTranscribe
          ) {
            return realtimeTranscribe(request);
          }
          throw error;
        }
      }
      if (
        request.llmProvider === OPENAI_REALTIME_PROVIDER
        && request.ttsProvider === OPENAI_REALTIME_PROVIDER
        && realtimeTranscribe
      ) {
        return realtimeTranscribe(request);
      }
      return request.studentText;
    },
    async reportMetric(event) {
      await socketTransport.reportMetric?.(event);
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

function describeMicTurnFailure(audioChunks: CapturedAudioChunk[]) {
  const hasCapturedAudio = audioChunks.some((chunk) => Boolean(chunk.bytesBase64));
  return hasCapturedAudio ? "Voice captured, but transcription failed." : "Voice turn failed before transcription.";
}

function resolveTransportKind(runtimeSelection: RuntimeSelection): PersistedTurnDebug["transport"] {
  return runtimeSelection.llmProvider === "openai-realtime" && runtimeSelection.ttsProvider === "openai-realtime"
    ? "openai-realtime"
    : "session-socket";
}

export function TutorSession({ initialAvatarProviderId, transport }: TutorSessionProps) {
  const { authReady, firebaseEnabled, user } = useFirebaseAuth();
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
  const [lessonState, setLessonState] = useState<LessonState | null>(null);
  const [timestamps, setTimestamps] = useState<WordTimestamp[]>([]);
  const [avatarNowMs, setAvatarNowMs] = useState(0);
  const [error, setError] = useState("");
  const [lessonSessionId, setLessonSessionId] = useState(() => normalizeLessonSessionId(generateLessonSessionId()));
  const [micActive, setMicActive] = useState(false);
  const [avatarProviderId, setAvatarProviderId] = useState(() => resolveAvatarProvider(initialAvatarProviderId).id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [recentLessons, setRecentLessons] = useState<PersistedLessonSummary[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [sessionDefaults, setSessionDefaults] = useState(DEFAULT_SESSION_PREFERENCES);
  const [requestedLessonId] = useState<number | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const rawLessonId = new URLSearchParams(window.location.search).get("lesson");
    const parsedLessonId = rawLessonId ? Number.parseInt(rawLessonId, 10) : Number.NaN;
    return Number.isFinite(parsedLessonId) ? parsedLessonId : null;
  });
  const [requestedResumeLessonId] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const resumeLessonId = new URLSearchParams(window.location.search).get("resume");
    return resumeLessonId?.trim() ? resumeLessonId : null;
  });
  const metricsRef = useRef(createSessionMetrics());
  const runtimeReady = storageReady;
  const micInputBlocked = sessionState === "thinking" || sessionState === "listening" || playbackState === "speaking";
  const pendingRestoreThreadRef = useRef<PersistedLessonThread | null>(null);
  const previousPlaybackStateRef = useRef<PlaybackState>("idle");
  const activeTurnIdRef = useRef(0);
  const selectedAvatar = resolveAvatarProvider(avatarProviderId);
  const isManagedAvatar = selectedAvatar.kind === "managed";
  const avatarConfig = selectedAvatar.config;
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const promptInputRef = useRef<HTMLInputElement>(null);
  const chatViewportRef = useRef<HTMLDivElement>(null);
  const micHoldRef = useRef(false);
  const micStartingRef = useRef(false);
  const micActiveRef = useRef(false);

  function resolvePreferredAvatarProviderId(fallbackId?: string) {
    const preferredAvatarId = readAvatarProviderPreference();
    return resolveAvatarProvider(preferredAvatarId ?? fallbackId ?? initialAvatarProviderId).id;
  }

  useEffect(() => {
    setAvatarProviderId((currentId) => {
      const preferredAvatarId = resolvePreferredAvatarProviderId(currentId);
      return preferredAvatarId === currentId ? currentId : preferredAvatarId;
    });
  }, []);

  useEffect(() => {
    if (isManagedAvatar) {
      setConnectionState("managed");
      return;
    }

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
  }, [authReady, firebaseEnabled, isManagedAvatar, lessonSessionId, sessionTransport, storageReady, user]);

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

      const persistedPreferences = readSessionPreferences();
      setSessionDefaults(persistedPreferences);
      setSubject(persistedPreferences.subject);
      setGradeBand(persistedPreferences.gradeBand);
      setLlmModel(persistedPreferences.llmModel);
      setLlmProvider(persistedPreferences.llmProvider);
      setPreference(persistedPreferences.preference);
      setTtsModel(persistedPreferences.ttsModel);
      setTtsProvider(persistedPreferences.ttsProvider);

      const resumeThread = requestedResumeLessonId ? await refreshArchivedLessonThread(requestedResumeLessonId) : null;
      const persistedThread = resumeThread ?? hydratedStore.activeThread ?? readPersistedLessonThread();
      if (persistedThread) {
        const normalizedThread = withNormalizedThreadSessionId(persistedThread);
        applyThread(normalizedThread);
        setLessonSessionId(normalizedThread.sessionId);
        pendingRestoreThreadRef.current = normalizedThread;
      } else if (requestedLessonId !== null) {
        const requestedLesson = resolveLessonCatalogItem(requestedLessonId);
        const requestedLessonState = buildLessonStateFromCatalog(requestedLessonId);
        if (requestedLesson && requestedLessonState) {
          setLessonState(requestedLessonState);
          setGradeBand(requestedLesson.grade);
          setSubject("math");
          setStudentPrompt("");
          setTranscript("");
          setTutorText("");
        }
      }
      setRecentLessons(hydratedStore.archive.map(({ thread: _thread, ...summary }) => summary));
      setStorageReady(true);
    };

    void restoreThreadStore();

    return () => {
      cancelled = true;
    };
  }, [authReady, requestedLessonId, requestedResumeLessonId, user?.uid]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    void persistActiveLessonThread(buildCurrentThread());
  }, [avatarProviderId, conversation, gradeBand, lessonSessionId, lessonState, llmModel, llmProvider, preference, storageReady, studentPrompt, subject, transcript, ttsModel, ttsProvider, tutorText]);

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
        firstTimestampMs: result.timestamps[0]?.startMs ?? null,
        lastTimestampMs: result.timestamps.at(-1)?.endMs ?? null,
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

  function syncTurnDebugLatency(turnId: number) {
    const nextLatency = toLatencyMetrics(metricsRef.current);
    setConversation((current) => current.map((turn) => {
      if (turn.id !== `${turnId}` || !turn.debug) {
        return turn;
      }

      return {
        ...turn,
        debug: {
          ...turn.debug,
          latency: nextLatency,
        },
      };
    }));
  }

  function appendFailedMicTurn(
    audioChunks: CapturedAudioChunk[],
    runtimeSelection: RuntimeSelection,
    transcriptText: string,
    errorMessage: string,
    startedAt: string
  ) {
    const nextTurnId = activeTurnIdRef.current + 1;
    activeTurnIdRef.current = nextTurnId;
    const normalizedTranscript = transcriptText.trim() || "Voice input failed";
    const normalizedError = errorMessage.trim() || "Could not transcribe microphone input";
    setConversation((current) => [
      ...current,
      {
        debug: {
          audio: summarizeAudioChunks(audioChunks),
          latency: {
            llmFirstTokenToTtsFirstAudioMs: 0,
            speechEndToSttFinalMs: 0,
            sttFinalToLlmFirstTokenMs: 0,
          },
          request: {
            gradeBand,
            llmModel: runtimeSelection.llmModel,
            llmProvider: runtimeSelection.llmProvider,
            preference,
            source: "mic",
            studentTextLength: normalizedTranscript.length,
            subject,
            ttsModel: runtimeSelection.ttsModel,
            ttsProvider: runtimeSelection.ttsProvider,
          },
          response: {
            audioSegmentCount: 0,
            firstTimestampMs: null,
            lastTimestampMs: null,
            state: "failed",
            timestampCount: 0,
            transcriptLength: normalizedTranscript.length,
            tutorTextLength: normalizedError.length,
          },
          sessionId: normalizeLessonSessionId(lessonSessionId),
          startedAt,
          transport: resolveTransportKind(runtimeSelection),
        },
        id: `${nextTurnId}`,
        transcript: normalizedTranscript,
        tutorText: normalizedError,
      },
    ]);
  }

  function closeHistoryDrawer() {
    if (typeof document === "undefined") {
      setHistoryOpen(false);
      return;
    }
    const historyDrawer = document.getElementById("history-drawer");
    const activeElement = document.activeElement;
    if (historyDrawer && activeElement instanceof HTMLElement && historyDrawer.contains(activeElement)) {
      activeElement.blur();
      promptInputRef.current?.focus();
    }
    setHistoryOpen(false);
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
        if (!isManagedAvatar && sessionState !== "thinking" && sessionState !== "listening") {
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
        promptInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isManagedAvatar, sessionState]);

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
      lessonState,
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

    setAvatarProviderId(resolvePreferredAvatarProviderId(thread.avatarProviderId));
    setConversation(thread.conversation);
    activeTurnIdRef.current = resolveNextTurnId(thread.conversation);
    setGradeBand(thread.gradeBand);
    setLessonState(thread.lessonState ?? null);
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
    if (!runtimeReady) {
      return;
    }

    const turnId = activeTurnIdRef.current + 1;
    const submittedPrompt = source === "mic" ? "" : studentPrompt;
    const startedAt = new Date().toISOString();
    const runtimeSelection = normalizeRuntimeSelection({
      llmModel,
      llmProvider,
      ttsModel,
      ttsProvider,
    });
    const avatarPersona = resolveAvatarPersona(avatarProviderId);
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
        studentProfile: {
          ...(preference ? { preference } : {}),
          avatarLabel: avatarPersona.label,
          avatarPersona: avatarPersona.prompt,
        },
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
      setAvatarProviderId((currentId) => {
        if (!result.avatarConfig) {
          return currentId;
        }

        const nextAvatarId = resolveAvatarProviderId(result.avatarConfig);
        return resolveAvatarMode(nextAvatarId) !== resolveAvatarMode(currentId) ? nextAvatarId : currentId;
      });
      const playbackSegments = result.audioSegments?.length
        ? result.audioSegments
        : [
            {
              text: result.tutorText,
              durationMs: result.timestamps.at(-1)?.endMs ?? Math.max(600, result.tutorText.length * 25),
            },
          ];
      playbackSegments.forEach((segment, index) => {
        const shouldDeferCompletion = Boolean(segment.audioBase64);
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
            const frontendTsMs = performance.now();
            metricsRef.current.mark({ name: "first_viseme", tsMs: frontendTsMs });
            setLatency(toLatencyMetrics(metricsRef.current));
            syncTurnDebugLatency(turnId);
            if (result.turnId) {
              void sessionTransport.reportMetric?.({
                turnId: result.turnId,
                name: "first_viseme",
                tsMs: Date.now(),
              });
            }
          },
          onPlaybackComplete: () => {
            if (activeTurnIdRef.current !== turnId || index !== playbackSegments.length - 1) {
              return;
            }
            const frontendTsMs = performance.now();
            metricsRef.current.mark({ name: "audio_done", tsMs: frontendTsMs });
            setLatency(toLatencyMetrics(metricsRef.current));
            syncTurnDebugLatency(turnId);
            if (result.turnId) {
              void sessionTransport.reportMetric?.({
                turnId: result.turnId,
                name: "audio_done",
                tsMs: Date.now(),
              });
            }
            setSessionState("idle");
          },
        });
      });
    } catch (caughtError) {
      if (activeTurnIdRef.current !== turnId) {
        return;
      }
      if (source === "mic") {
        const failedTranscript = describeMicTurnFailure(audioChunks);
        setStudentPrompt(failedTranscript);
        setTranscript(failedTranscript);
        setTutorText("");
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
    closeHistoryDrawer();
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
    closeHistoryDrawer();
    setStudentPrompt(DEFAULT_STUDENT_PROMPT);
    setSubject(sessionDefaults.subject);
    setGradeBand(sessionDefaults.gradeBand);
    setLlmProvider(sessionDefaults.llmProvider);
    setLlmModel(sessionDefaults.llmModel);
    setLessonState(null);
    setPreference(sessionDefaults.preference);
    setTtsProvider(sessionDefaults.ttsProvider);
    setTtsModel(sessionDefaults.ttsModel);
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
    if (!runtimeReady) {
      return;
    }

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
    if (!runtimeReady) {
      return;
    }

    if (micStartingRef.current || !micActiveRef.current) {
      return;
    }

    let chunks: CapturedAudioChunk[] = [];
    const startedAt = new Date().toISOString();
    try {
      chunks = await audioCapture.stop();
      logTutorSessionInfo("mic.stop", {
        audioChunkCount: chunks.length,
        bytesWithPayloadCount: chunks.filter((chunk) => Boolean(chunk.bytesBase64)).length,
        mimeTypes: Array.from(new Set(chunks.map((chunk) => chunk.mimeType).filter(Boolean))),
        totalBytes: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
      });
      micActiveRef.current = false;
      setMicActive(false);
      setError("");
      const runtimeSelection = normalizeRuntimeSelection({
        llmModel,
        llmProvider,
        ttsModel,
        ttsProvider,
      });
      const avatarPersona = resolveAvatarPersona(avatarProviderId);
      setSessionState("thinking");
      setLatency(null);
      setTimestamps([]);
      setTutorText("");
      const transcriptText = await sessionTransport.transcribeAudio?.({
        studentText: "",
        subject,
        gradeBand,
        llmProvider: runtimeSelection.llmProvider,
        llmModel: runtimeSelection.llmModel,
        onTranscriptUpdate: (text) => {
          setStudentPrompt(text);
          setTranscript(text);
        },
        studentProfile: {
          ...(preference ? { preference } : {}),
          avatarLabel: avatarPersona.label,
          avatarPersona: avatarPersona.prompt,
        },
        audioChunks: chunks,
        ttsProvider: runtimeSelection.ttsProvider,
        ttsModel: runtimeSelection.ttsModel,
      });
      if ((transcriptText ?? "").trim()) {
        setStudentPrompt(transcriptText ?? "");
        setTranscript(transcriptText ?? "");
      }
      setSessionState("idle");
    } catch (caughtError) {
      micActiveRef.current = false;
      setMicActive(false);
      setSessionState("idle");
      const runtimeSelection = normalizeRuntimeSelection({
        llmModel,
        llmProvider,
        ttsModel,
        ttsProvider,
      });
      const errorMessage = caughtError instanceof Error ? caughtError.message : "Could not stop microphone";
      appendFailedMicTurn(chunks, runtimeSelection, transcript.trim() || studentPrompt.trim(), errorMessage, startedAt);
      setError(errorMessage);
    }
  }

  function handleMicPressStart(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || micHoldRef.current || micInputBlocked) {
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
    if (event.button !== 0 || micHoldRef.current || micInputBlocked) {
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
    if ((event.key !== " " && event.key !== "Enter") || event.repeat || micHoldRef.current || micInputBlocked) {
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

  const selectedAvatarLabel = selectedAvatar.label;
  const lessonQuestion = resolveLessonResumeQuestion(lessonState);
  const lessonStepCount = lessonState?.program.length ?? 0;
  const showPromptPanel = !isManagedAvatar || lessonState !== null;
  const showComposer = !isManagedAvatar;

  return (
    <DashboardLayout>
      <div className="session-hub" data-testid="tutor-layout">
        <AudioPlayer controller={playbackController} initialVolume={sessionDefaults.audioVolume} variant="hidden" />

        <header className="session-hub__header">
          <div className="session-hub__identity">
            <div className="session-hub__identity-mark">
              AI
            </div>
            <div>
              <h1 className="session-hub__title">AI Tutor</h1>
            </div>
          </div>

          <div className="session-hub__status">
            <span className={`status-dot ${
              connectionState === "connected" || connectionState === "managed" ? "status-dot--online" :
              connectionState === "connecting" ? "status-dot--connecting" :
              "status-dot--offline"
            }`} />
            <span className="connection-status__text">{connectionState}</span>
            <button
              aria-label="New Lesson"
              className="secondary-button"
              onClick={() => void resetLesson()}
              type="button"
            >
              New
            </button>
            <button
              aria-label="Toggle history"
              aria-controls="history-drawer"
              aria-expanded={historyOpen}
              className="secondary-button session-hub__history-button"
              onClick={() => setHistoryOpen((current) => !current)}
              type="button"
            >
              History
            </button>
          </div>
        </header>

        <div className={`session-main ${isManagedAvatar && !lessonState ? "session-main--managed" : ""}`.trim()}>
          <section className="session-panel session-panel--avatar">
            <div className="session-panel__body session-panel__body--avatar">
              {isManagedAvatar ? (
                <ManagedAvatarSession avatar={selectedAvatar} />
              ) : (
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
              )}
              {conversation.length === 0 && !tutorText ? (
                <div className="session-welcome">
                  <div className="session-welcome__title">
                    {lessonState ? lessonState.lessonTitle : "Ready for a new lesson?"}
                  </div>
                  <p className="session-welcome__copy">
                    {lessonState
                      ? `Current task: ${lessonState.currentTask}`
                      : isManagedAvatar
                      ? `Start live session, allow microphone, then talk with ${selectedAvatarLabel}.`
                      : `Ask ${selectedAvatarLabel} for an explanation, example, or guided solve.`}
                  </p>
                  {lessonQuestion ? <p className="session-welcome__question">{lessonQuestion}</p> : null}
                </div>
              ) : null}
            </div>
          </section>

          {showPromptPanel ? (
            <section className="session-panel session-panel--prompt">
              <div className="session-panel__body session-panel__body--prompt">
                {lessonState ? (
                  <div className="lesson-brief" data-testid="lesson-brief">
                    <div className="lesson-brief__header">
                      <div>
                        <div className="lesson-brief__eyebrow">Lesson</div>
                        <div className="session-panel__title">{lessonState.lessonTitle}</div>
                      </div>
                      <div className="lesson-brief__step">
                        Step {Math.min(lessonState.currentStepIndex + 1, lessonStepCount || 1)} of {lessonStepCount || 1}
                      </div>
                    </div>

                    <div className="lesson-brief__task">
                      <div className="lesson-brief__label">Current task</div>
                      <p>{lessonState.currentTask}</p>
                    </div>

                    <div className="lesson-brief__program">
                      {lessonState.program.map((step, index) => (
                        <div
                          className={`lesson-brief__program-step${
                            index === lessonState.currentStepIndex ? " lesson-brief__program-step--active" : ""
                          }`}
                          key={`${lessonState.lessonId}-${step}`}
                        >
                          <span>{index + 1}</span>
                          <p>{step}</p>
                        </div>
                      ))}
                    </div>

                    <div className="lesson-brief__question">
                      <div className="lesson-brief__label">Next question</div>
                      <p>{lessonQuestion}</p>
                    </div>
                  </div>
                ) : null}

                {showComposer ? (
                  <div className="session-composer">
                    <button
                      aria-label={micActive ? "Release to send" : "Hold to talk"}
                      className={`mic-button ${micActive ? "mic-button--live" : ""}`}
                      disabled={!runtimeReady || !micSupported || micInputBlocked}
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

                    <input
                      aria-label="Student prompt"
                      className="session-composer__input"
                      disabled={!runtimeReady}
                      onChange={(event) => setStudentPrompt(event.target.value)}
                      placeholder={lessonQuestion || "Ask a math question..."}
                      ref={promptInputRef}
                      type="text"
                      value={studentPrompt}
                    />

                    <button
                      ref={sendButtonRef}
                      aria-label="Send"
                      className="send-button"
                      disabled={!runtimeReady || sessionState === "thinking" || sessionState === "listening" || !studentPrompt.trim()}
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
                  </div>
                ) : null}

                {showComposer && error ? <p className="composer-stage__error" role="alert">{error}</p> : null}

                {showComposer ? (
                  <p className="composer-stage__hint">
                    Hold mic to talk · Cmd+Enter to send · Esc to interrupt
                  </p>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <aside
          id="history-drawer"
          aria-hidden={!historyOpen}
          className={`history-drawer ${historyOpen ? "history-drawer--open" : ""}`}
          data-testid="history-drawer"
        >
          <div className="history-drawer__backdrop" onClick={() => closeHistoryDrawer()} />
          <div className="history-drawer__panel">
            <div className="history-drawer__header">
              <h2 className="history-drawer__title">History</h2>
              <button
                aria-label="Close history"
                className="icon-button"
                onClick={() => closeHistoryDrawer()}
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
                          closeHistoryDrawer();
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
      </div>
    </DashboardLayout>
  );
}
