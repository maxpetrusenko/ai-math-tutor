"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";

import type { LessonConversationTurn } from "../LessonThreadPanels";
import type { LatencyMetrics } from "../LatencyMonitor";
import { resolveAvatarMode, resolveAvatarProvider } from "../avatar_registry";
import { BrowserAudioCapture } from "../../lib/audio_capture";
import type { AvatarVisualState, WordTimestamp } from "../../lib/avatar_contract";
import {
  generateLessonSessionId,
  hydrateLessonThreadStore,
  persistActiveLessonThread,
  readPersistedLessonThread,
  refreshArchivedLessonThread,
  type PersistedLessonSummary,
  type PersistedLessonThread,
} from "../../lib/lesson_thread_store";
import { PlaybackController, type PlaybackState } from "../../lib/playback_controller";
import { useFirebaseAuth } from "../../lib/firebase_auth";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_PROVIDER,
  normalizeRuntimeSelection,
  type RuntimeSelection,
} from "../../lib/runtime_options";
import { readAvatarProviderPreference } from "../../lib/avatar_preference";
import { createSessionMetrics } from "../../lib/session_metrics";
import { DEFAULT_SESSION_PREFERENCES, readSessionPreferences } from "../../lib/session_preferences";
import {
  buildLessonStateFromCatalog,
  resolveLessonCatalogItem,
  resolveLessonResumeQuestion,
  type LessonState,
} from "../../lib/lesson_catalog";
import { createConfiguredTransport } from "./configured_transport";
import type { SessionTransport, TutorSessionProps } from "./session_types";
import { createTutorSessionActions } from "./tutor_session_actions";
import {
  normalizeLessonSessionId,
  resolveNextTurnId,
  resolveThreadStudentPrompt,
  withNormalizedThreadSessionId,
} from "./tutor_session_utils";

const DEFAULT_STUDENT_PROMPT = "";
const DEFAULT_SUBJECT = "math";
const DEFAULT_GRADE_BAND = "6-8";

export function useTutorSessionController({ initialAvatarProviderId, transport }: TutorSessionProps) {
  const { authReady, firebaseEnabled, user } = useFirebaseAuth();
  const [sessionTransport] = useState<SessionTransport>(() => transport ?? createConfiguredTransport());
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
  const promptInputRef = useRef<HTMLInputElement>(null);
  const runtimeReady = storageReady;
  const micInputBlocked = sessionState === "thinking" || sessionState === "listening" || playbackState === "speaking";
  const pendingRestoreThreadRef = useRef<PersistedLessonThread | null>(null);
  const previousPlaybackStateRef = useRef<PlaybackState>("idle");
  const activeTurnIdRef = useRef(0);
  const micHoldRef = useRef(false);
  const micStartingRef = useRef(false);
  const micActiveRef = useRef(false);
  const selectedAvatar = resolveAvatarProvider(avatarProviderId);
  const isManagedAvatar = selectedAvatar.kind === "managed";
  const avatarConfig = selectedAvatar.config;

  function resolvePreferredAvatarProviderId(fallbackId?: string) {
    const preferredAvatarId = readAvatarProviderPreference();
    return resolveAvatarProvider(preferredAvatarId ?? fallbackId ?? initialAvatarProviderId).id;
  }

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

  const actions = createTutorSessionActions({
    activeTurnIdRef,
    applyThread,
    audioCapture,
    avatarProviderId,
    buildCurrentThread,
    closeHistoryDrawer,
    gradeBand,
    lessonSessionId,
    llmModel,
    llmProvider,
    metricsRef,
    micActiveRef,
    micHoldRef,
    micInputBlocked,
    micStartingRef,
    micSupported,
    playbackController,
    preference,
    runtimeReady,
    sessionDefaults,
    sessionTransport,
    studentPrompt,
    subject,
    syncRuntimeSelection,
    transcript,
    ttsModel,
    ttsProvider,
    setAvatarNowMs,
    setAvatarProviderId,
    setConversation,
    setError,
    setGradeBand,
    setHistoryOpen,
    setLatency,
    setLessonSessionId,
    setLessonState,
    setLlmModel,
    setLlmProvider,
    setMicActive,
    setPreference,
    setRecentLessons,
    setSessionState,
    setStudentPrompt,
    setSubject,
    setTimestamps,
    setTranscript,
    setTtsModel,
    setTtsProvider,
    setTutorText,
  });

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (!isManagedAvatar && sessionState !== "thinking" && sessionState !== "listening") {
          void actions.runDemoTurn([], "text");
        }
        return;
      }

      if (event.key === "Escape" && sessionState !== "idle") {
        event.preventDefault();
        void actions.interruptTurn();
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        promptInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [actions, isManagedAvatar, sessionState]);

  const selectedAvatarLabel = selectedAvatar.label;
  const selectedAvatarPersona = selectedAvatar.persona ?? "Tutor";
  const lessonQuestion = resolveLessonResumeQuestion(lessonState);
  const showPromptPanel = !isManagedAvatar || lessonState !== null;
  const showComposer = !isManagedAvatar;
  const sessionSubtitle = lessonState
    ? "Continue where you stopped. Your tutor leads with the next question."
    : isManagedAvatar
      ? `Start a live lesson with ${selectedAvatarLabel}.`
      : `Ask ${selectedAvatarLabel} for a guided explanation, worked example, or practice prompt.`;
  const supportStyle = preference.trim() || "Balanced guidance";

  return {
    ...actions,
    avatarConfig,
    avatarNowMs,
    avatarProviderId,
    avatarState,
    closeHistoryDrawer,
    connectionState,
    conversation,
    error,
    gradeBand,
    historyOpen,
    isManagedAvatar,
    latency,
    lessonQuestion,
    lessonState,
    micActive,
    micInputBlocked,
    micSupported,
    playbackController,
    playbackState,
    preference,
    promptInputRef,
    recentLessons,
    runtimeReady,
    runTextTurn: () => void actions.runDemoTurn([], "text"),
    selectedAvatar,
    selectedAvatarLabel,
    selectedAvatarPersona,
    sessionDefaults,
    sessionSubtitle,
    setHistoryOpen,
    setStudentPrompt,
    showComposer,
    showPromptPanel,
    studentPrompt,
    subject,
    supportStyle,
    timestamps,
    tutorText,
  };
}
