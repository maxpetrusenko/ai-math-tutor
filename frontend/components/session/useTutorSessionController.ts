"use client";

import type React from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import type { LessonConversationTurn } from "../LessonThreadPanels";
import type { LatencyMetrics } from "../LatencyMonitor";
import { resolveAvatarMode, resolveAvatarProvider } from "../avatar_registry";
import { BrowserAudioCapture } from "../../lib/audio_capture";
import type { AudioEnergySample, AvatarSpeechCue, AvatarVisualState, WordTimestamp } from "../../lib/avatar_contract";
import { sampleAudioEnergy } from "../../lib/audio_energy";
import { resolveCompatibleRuntimeSelectionForAvatar } from "../../lib/avatar_runtime_compatibility";
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
const AVATAR_FRAME_INTERVAL_MS = 1000 / 30;

type AvatarPlaybackClock = {
  baseMs: number;
  startedAtMs: number;
};

export function useTutorSessionController({ initialAvatarProviderId, transport }: TutorSessionProps) {
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
  const [audioEnergySamples, setAudioEnergySamples] = useState<AudioEnergySample[]>([]);
  const [avatarSpeechCue, setAvatarSpeechCue] = useState<AvatarSpeechCue | null>(null);
  const [avatarNowMs, setAvatarNowMs] = useState(0);
  const [avatarPlaybackClock, setAvatarPlaybackClock] = useState<AvatarPlaybackClock | null>(null);
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

  const metricsRef = useRef<ReturnType<typeof createSessionMetrics>>(null!);
  if (metricsRef.current === null) {
    metricsRef.current = createSessionMetrics();
  }
  const promptInputRef = useRef<HTMLInputElement>(null);
  const runtimeReady = storageReady;
  const micInputBlocked = sessionState === "thinking" || sessionState === "listening" || playbackState === "speaking";
  const pendingRestoreThreadRef = useRef<PersistedLessonThread | null>(null);
  const previousAvatarPlaybackActiveRef = useRef(false);
  const activeTurnIdRef = useRef(0);
  const micHoldRef = useRef(false);
  const micStartingRef = useRef(false);
  const micActiveRef = useRef(false);
  const selectedAvatar = resolveAvatarProvider(avatarProviderId);
  const isManagedAvatar = selectedAvatar.kind === "managed";
  const avatarConfig = selectedAvatar.config;

  const resolvePreferredAvatarProviderId = useCallback((fallbackId?: string) => {
    const preferredAvatarId = readAvatarProviderPreference();
    return resolveAvatarProvider(preferredAvatarId ?? fallbackId ?? initialAvatarProviderId).id;
  }, [initialAvatarProviderId]);

  const buildCurrentThread = useCallback((): PersistedLessonThread => {
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
  }, [avatarProviderId, conversation, gradeBand, lessonSessionId, lessonState, llmModel, llmProvider, preference, studentPrompt, subject, transcript, ttsModel, ttsProvider, tutorText]);

  const applyThread = useCallback((thread: PersistedLessonThread) => {
    const preferredAvatarProviderId = resolvePreferredAvatarProviderId(thread.avatarProviderId);
    const runtimeSelection = resolveCompatibleRuntimeSelectionForAvatar(preferredAvatarProviderId, normalizeRuntimeSelection({
      llmModel: thread.llmModel,
      llmProvider: thread.llmProvider,
      ttsModel: thread.ttsModel,
      ttsProvider: thread.ttsProvider,
    })).selection;

    setAvatarProviderId(preferredAvatarProviderId);
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
  }, [resolvePreferredAvatarProviderId]);

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

  const syncRuntimeSelection = useCallback((nextSelection: Partial<RuntimeSelection> = {}) => {
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
  }, [llmModel, llmProvider, ttsModel, ttsProvider]);

  function startAvatarPlayback(baseMs: number) {
    setAvatarNowMs(baseMs);
    setAvatarPlaybackClock({ baseMs, startedAtMs: performance.now() });
  }

  function stopAvatarPlayback(resetTimeline: boolean) {
    setAvatarPlaybackClock(null);
    if (resetTimeline) {
      setAvatarNowMs(0);
    }
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
    setAvatarSpeechCue,
    setAudioEnergySamples,
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
    startAvatarPlayback,
    stopAvatarPlayback,
  });

  useLayoutEffect(() => {
    setAvatarProviderId((currentId) => {
      const preferredAvatarId = resolvePreferredAvatarProviderId(currentId);
      return preferredAvatarId === currentId ? currentId : preferredAvatarId;
    });
  }, [resolvePreferredAvatarProviderId]);

  useEffect(() => {
    if (!storageReady) {
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
          setConnectionState(isManagedAvatar && result === "connected" ? "managed" : result);
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
  }, [isManagedAvatar, lessonSessionId, sessionTransport, storageReady]);

  useEffect(() => playbackController.subscribe((snapshot) => setPlaybackState(snapshot.state)), [playbackController]);
  useEffect(() => {
    setMicSupported(audioCapture.isSupported());
  }, [audioCapture]);
  useEffect(() => {
    micActiveRef.current = micActive;
  }, [micActive]);

  useEffect(() => {
    let cancelled = false;

    const restoreThreadStore = async () => {
      const hydratedStore = await hydrateLessonThreadStore();
      if (cancelled) {
        return;
      }

      const persistedPreferences = readSessionPreferences();
      const preferredAvatarProviderId = resolvePreferredAvatarProviderId();
      const compatibleDefaults = resolveCompatibleRuntimeSelectionForAvatar(preferredAvatarProviderId, persistedPreferences).selection;
      setSessionDefaults({
        ...persistedPreferences,
        ...compatibleDefaults,
      });
      setAvatarProviderId(preferredAvatarProviderId);
      setSubject(persistedPreferences.subject);
      setGradeBand(persistedPreferences.gradeBand);
      setLlmModel(compatibleDefaults.llmModel);
      setLlmProvider(compatibleDefaults.llmProvider);
      setPreference(persistedPreferences.preference);
      setTtsModel(compatibleDefaults.ttsModel);
      setTtsProvider(compatibleDefaults.ttsProvider);

      const resumeThread = requestedResumeLessonId ? await refreshArchivedLessonThread(requestedResumeLessonId) : null;
      if (cancelled) {
        return;
      }
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
  }, [applyThread, requestedLessonId, requestedResumeLessonId, resolvePreferredAvatarProviderId]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    void persistActiveLessonThread(buildCurrentThread());
  }, [buildCurrentThread, storageReady]);

  useEffect(() => {
    const compatibleSelection = resolveCompatibleRuntimeSelectionForAvatar(avatarProviderId, {
      llmModel,
      llmProvider,
      ttsModel,
      ttsProvider,
    }).selection;
    if (
      compatibleSelection.llmProvider === llmProvider
      && compatibleSelection.llmModel === llmModel
      && compatibleSelection.ttsProvider === ttsProvider
      && compatibleSelection.ttsModel === ttsModel
    ) {
      return;
    }

    syncRuntimeSelection(compatibleSelection);
  }, [avatarProviderId, llmModel, llmProvider, syncRuntimeSelection, ttsModel, ttsProvider]);

  useEffect(() => {
    let fadeTimer: ReturnType<typeof setTimeout> | null = null;
    const avatarPlaybackActive = avatarPlaybackClock !== null;

    if (sessionState === "listening" || sessionState === "thinking") {
      setAvatarState(sessionState);
    } else if (avatarPlaybackActive) {
      setAvatarState("speaking");
    } else if (previousAvatarPlaybackActiveRef.current) {
      setAvatarState("fading");
      fadeTimer = setTimeout(() => setAvatarState("idle"), 180);
    } else {
      setAvatarState("idle");
    }

    previousAvatarPlaybackActiveRef.current = avatarPlaybackActive;

    return () => {
      if (fadeTimer) {
        clearTimeout(fadeTimer);
      }
    };
  }, [avatarPlaybackClock, sessionState]);

  useEffect(() => {
    if (!avatarPlaybackClock) {
      return;
    }

    const { baseMs, startedAtMs } = avatarPlaybackClock;
    let animationFrame = 0;
    let nextUpdateAtMs = startedAtMs + AVATAR_FRAME_INTERVAL_MS;

    const tick = (frameAtMs: number) => {
      if (frameAtMs >= nextUpdateAtMs) {
        setAvatarNowMs(baseMs + (frameAtMs - startedAtMs));
        nextUpdateAtMs = frameAtMs + AVATAR_FRAME_INTERVAL_MS;
      }
      animationFrame = window.requestAnimationFrame(tick);
    };

    setAvatarNowMs(baseMs);
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [avatarPlaybackClock]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        if (sessionState !== "thinking" && sessionState !== "listening") {
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
  const showPromptPanel = true;
  const sessionSubtitle = lessonState
    ? "Continue the current lesson from the next step."
    : isManagedAvatar
      ? "Open ended live session. Talk, practice, and follow the thread naturally."
      : "Open ended session for questions, drills, and follow ups.";
  const supportStyle = preference.trim() || "Balanced guidance";
  const avatarAudioEnergy = sampleAudioEnergy(audioEnergySamples, avatarNowMs);

  return {
    ...actions,
    avatarConfig,
    avatarAudioEnergy,
    avatarNowMs,
    avatarProviderId,
    avatarSpeechCue,
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
    llmModel,
    llmProvider,
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
    showPromptPanel,
    studentPrompt,
    subject,
    supportStyle,
    syncRuntimeSelection,
    timestamps,
    ttsModel,
    ttsProvider,
    tutorText,
  };
}
