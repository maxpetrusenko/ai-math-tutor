import type React from "react";

import type { CapturedAudioChunk } from "../../lib/audio_capture";
import {
  clearPersistedLessonThreadRemote,
  generateLessonSessionId,
  persistArchivedLessonThread,
  refreshArchivedLessonThread,
  type PersistedLessonSummary,
  type PersistedLessonThread,
  type PersistedTurnDebug,
} from "../../lib/lesson_thread_store";
import type { PlaybackController } from "../../lib/playback_controller";
import { normalizeRuntimeSelection, type RuntimeSelection } from "../../lib/runtime_options";
import { resolveAvatarPersona } from "../../lib/avatar_persona";
import { createSessionMetrics, hydrateSessionMetrics, seedSessionMetricsFromLatency, toLatencyMetrics } from "../../lib/session_metrics";
import type { LessonState } from "../../lib/lesson_catalog";
import type { LatencyMetrics } from "../LatencyMonitor";
import type { LessonConversationTurn } from "../LessonThreadPanels";
import { resolveAvatarMode, resolveAvatarProviderId } from "../avatar_registry";
import type { SessionTransport, TurnSource, TutorTurnResult } from "./session_types";
import { createTutorSessionMicActions } from "./tutor_session_mic_actions";
import { normalizeLessonSessionId, resolveTransportKind, summarizeAudioChunks, withNormalizedThreadSessionId } from "./tutor_session_utils";

function buildTransportDebug(input: {
  audioChunks: CapturedAudioChunk[];
  gradeBand: string;
  lessonSessionId: string;
  preference: string;
  result: TutorTurnResult;
  runtimeSelection: RuntimeSelection;
  source: TurnSource;
  startedAt: string;
  studentTextLength: number;
  subject: string;
}): PersistedTurnDebug {
  const { audioChunks, gradeBand, lessonSessionId, preference, result, runtimeSelection, source, startedAt, studentTextLength, subject } = input;

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

type TutorSessionActionDeps = {
  activeTurnIdRef: React.MutableRefObject<number>;
  audioCapture: import("../../lib/audio_capture").BrowserAudioCapture;
  avatarProviderId: string;
  closeHistoryDrawer: () => void;
  buildCurrentThread: () => PersistedLessonThread;
  applyThread: (thread: PersistedLessonThread) => void;
  gradeBand: string;
  lessonSessionId: string;
  llmModel: string;
  llmProvider: string;
  metricsRef: React.MutableRefObject<ReturnType<typeof createSessionMetrics>>;
  micActiveRef: React.MutableRefObject<boolean>;
  micHoldRef: React.MutableRefObject<boolean>;
  micInputBlocked: boolean;
  micStartingRef: React.MutableRefObject<boolean>;
  micSupported: boolean;
  playbackController: PlaybackController;
  preference: string;
  runtimeReady: boolean;
  sessionDefaults: {
    gradeBand: string;
    llmModel: string;
    llmProvider: string;
    preference: string;
    subject: string;
    ttsModel: string;
    ttsProvider: string;
  };
  sessionTransport: SessionTransport;
  studentPrompt: string;
  subject: string;
  transcript: string;
  ttsModel: string;
  ttsProvider: string;
  syncRuntimeSelection: (nextSelection?: Partial<RuntimeSelection>) => RuntimeSelection;
  setAvatarNowMs: React.Dispatch<React.SetStateAction<number>>;
  setAvatarProviderId: React.Dispatch<React.SetStateAction<string>>;
  setConversation: React.Dispatch<React.SetStateAction<LessonConversationTurn[]>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setGradeBand: React.Dispatch<React.SetStateAction<string>>;
  setHistoryOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setLatency: React.Dispatch<React.SetStateAction<LatencyMetrics | null>>;
  setLessonSessionId: React.Dispatch<React.SetStateAction<string>>;
  setLessonState: React.Dispatch<React.SetStateAction<LessonState | null>>;
  setLlmModel: React.Dispatch<React.SetStateAction<string>>;
  setLlmProvider: React.Dispatch<React.SetStateAction<string>>;
  setMicActive: React.Dispatch<React.SetStateAction<boolean>>;
  setPreference: React.Dispatch<React.SetStateAction<string>>;
  setRecentLessons: React.Dispatch<React.SetStateAction<PersistedLessonSummary[]>>;
  setSessionState: React.Dispatch<React.SetStateAction<string>>;
  setStudentPrompt: React.Dispatch<React.SetStateAction<string>>;
  setSubject: React.Dispatch<React.SetStateAction<string>>;
  setTimestamps: React.Dispatch<React.SetStateAction<TutorTurnResult["timestamps"]>>;
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  setTtsModel: React.Dispatch<React.SetStateAction<string>>;
  setTtsProvider: React.Dispatch<React.SetStateAction<string>>;
  setTutorText: React.Dispatch<React.SetStateAction<string>>;
};

export function createTutorSessionActions(deps: TutorSessionActionDeps) {
  const syncTurnDebugLatency = (turnId: number) => {
    const nextLatency = toLatencyMetrics(deps.metricsRef.current);
    deps.setConversation((current) => current.map((turn) => {
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
  };

  const runDemoTurn = async (audioChunks: CapturedAudioChunk[] = [], source: TurnSource = "text") => {
    if (!deps.runtimeReady) {
      return;
    }

    const turnId = deps.activeTurnIdRef.current + 1;
    const submittedPrompt = source === "mic" ? "" : deps.studentPrompt;
    const startedAt = new Date().toISOString();
    const runtimeSelection = normalizeRuntimeSelection({
      llmModel: deps.llmModel,
      llmProvider: deps.llmProvider,
      ttsModel: deps.ttsModel,
      ttsProvider: deps.ttsProvider,
    });
    const avatarPersona = resolveAvatarPersona(deps.avatarProviderId);
    deps.activeTurnIdRef.current = turnId;
    deps.setError("");
    deps.setSessionState("thinking");
    deps.setLatency(null);
    deps.metricsRef.current = createSessionMetrics();

    if (
      runtimeSelection.llmProvider !== deps.llmProvider
      || runtimeSelection.llmModel !== deps.llmModel
      || runtimeSelection.ttsProvider !== deps.ttsProvider
      || runtimeSelection.ttsModel !== deps.ttsModel
    ) {
      deps.syncRuntimeSelection(runtimeSelection);
    }

    try {
      const result = await deps.sessionTransport.runTurn({
        studentText: submittedPrompt,
        subject: deps.subject,
        gradeBand: deps.gradeBand,
        llmModel: runtimeSelection.llmModel,
        llmProvider: runtimeSelection.llmProvider,
        onTranscriptFinal:
          source === "mic"
            ? (text) => {
                if (deps.activeTurnIdRef.current !== turnId) {
                  return;
                }
                deps.setStudentPrompt(text);
                deps.setTranscript(text);
              }
            : undefined,
        studentProfile: {
          ...(deps.preference ? { preference: deps.preference } : {}),
          avatarLabel: avatarPersona.label,
          avatarPersona: avatarPersona.prompt,
        },
        audioChunks,
        ttsModel: runtimeSelection.ttsModel,
        ttsProvider: runtimeSelection.ttsProvider,
      });

      if (deps.activeTurnIdRef.current !== turnId) {
        return;
      }

      deps.setTranscript(result.transcript);
      deps.setTutorText(result.tutorText);
      if (source === "text") {
        deps.setStudentPrompt("");
      } else if (result.transcript.trim()) {
        deps.setStudentPrompt(result.transcript);
      }
      deps.setConversation((current) => [
        ...current,
        {
          debug: buildTransportDebug({
            audioChunks,
            gradeBand: deps.gradeBand,
            lessonSessionId: deps.lessonSessionId,
            preference: deps.preference,
            result,
            runtimeSelection,
            source,
            startedAt,
            studentTextLength: submittedPrompt.length,
            subject: deps.subject,
          }),
          id: `${turnId}`,
          transcript: result.transcript,
          tutorText: result.tutorText,
        },
      ]);
      deps.setSessionState(result.state);
      deps.metricsRef.current = result.metricEvents
        ? hydrateSessionMetrics(result.metricEvents)
        : seedSessionMetricsFromLatency(result.latency);
      deps.setLatency(toLatencyMetrics(deps.metricsRef.current));
      deps.setTimestamps(result.timestamps);
      deps.setAvatarProviderId((currentId) => {
        if (!result.avatarConfig) {
          return currentId;
        }

        const nextAvatarId = resolveAvatarProviderId(result.avatarConfig);
        return resolveAvatarMode(nextAvatarId) !== resolveAvatarMode(currentId) ? nextAvatarId : currentId;
      });

      const playbackSegments = result.audioSegments?.length
        ? result.audioSegments
        : [{ text: result.tutorText, durationMs: result.timestamps.at(-1)?.endMs ?? Math.max(600, result.tutorText.length * 25) }];

      playbackSegments.forEach((segment, index) => {
        deps.playbackController.enqueue({
          id: `${turnId}-${index}-${Date.now()}`,
          text: segment.text,
          audioBase64: segment.audioBase64,
          audioMimeType: segment.audioMimeType,
          deferCompletion: Boolean(segment.audioBase64),
          durationMs: segment.durationMs ?? Math.max(300, segment.text.length * 18),
          onPlaybackStart: () => {
            if (deps.activeTurnIdRef.current !== turnId || index !== 0) {
              return;
            }
            deps.metricsRef.current.mark({ name: "first_viseme", tsMs: performance.now() });
            deps.setLatency(toLatencyMetrics(deps.metricsRef.current));
            syncTurnDebugLatency(turnId);
            if (result.turnId) {
              void deps.sessionTransport.reportMetric?.({ turnId: result.turnId, name: "first_viseme", tsMs: Date.now() });
            }
          },
          onPlaybackComplete: () => {
            if (deps.activeTurnIdRef.current !== turnId || index !== playbackSegments.length - 1) {
              return;
            }
            deps.metricsRef.current.mark({ name: "audio_done", tsMs: performance.now() });
            deps.setLatency(toLatencyMetrics(deps.metricsRef.current));
            syncTurnDebugLatency(turnId);
            if (result.turnId) {
              void deps.sessionTransport.reportMetric?.({ turnId: result.turnId, name: "audio_done", tsMs: Date.now() });
            }
            deps.setSessionState("idle");
          },
        });
      });
    } catch (caughtError) {
      if (deps.activeTurnIdRef.current !== turnId) {
        return;
      }
      deps.setError(caughtError instanceof Error ? caughtError.message : "Unknown error");
      deps.setSessionState("failed");
    }
  };

  const micActions = createTutorSessionMicActions({
    activeTurnIdRef: deps.activeTurnIdRef,
    audioCapture: deps.audioCapture,
    avatarProviderId: deps.avatarProviderId,
    gradeBand: deps.gradeBand,
    lessonSessionId: deps.lessonSessionId,
    llmModel: deps.llmModel,
    llmProvider: deps.llmProvider,
    micActiveRef: deps.micActiveRef,
    micHoldRef: deps.micHoldRef,
    micInputBlocked: deps.micInputBlocked,
    micStartingRef: deps.micStartingRef,
    micSupported: deps.micSupported,
    preference: deps.preference,
    runtimeReady: deps.runtimeReady,
    sessionTransport: deps.sessionTransport,
    studentPrompt: deps.studentPrompt,
    subject: deps.subject,
    transcript: deps.transcript,
    ttsModel: deps.ttsModel,
    ttsProvider: deps.ttsProvider,
    setConversation: deps.setConversation,
    setError: deps.setError,
    setLatency: deps.setLatency,
    setMicActive: deps.setMicActive,
    setSessionState: deps.setSessionState,
    setStudentPrompt: deps.setStudentPrompt,
    setTimestamps: deps.setTimestamps,
    setTranscript: deps.setTranscript,
    setTutorText: deps.setTutorText,
  });

  return {
    ...micActions,
    async interruptTurn() {
      deps.activeTurnIdRef.current += 1;
      await deps.sessionTransport.interrupt();
      deps.playbackController.interrupt();
      await deps.audioCapture.cancel();
      deps.micHoldRef.current = false;
      deps.micStartingRef.current = false;
      deps.micActiveRef.current = false;
      deps.setSessionState("idle");
      deps.setLatency(null);
      deps.setTimestamps([]);
      deps.setAvatarNowMs(0);
      deps.setMicActive(false);
      deps.closeHistoryDrawer();
    },
    async resetLesson() {
      deps.setRecentLessons(await persistArchivedLessonThread(deps.buildCurrentThread()));
      const nextSessionId = normalizeLessonSessionId(generateLessonSessionId());
      deps.activeTurnIdRef.current += 1;
      if (deps.sessionTransport.switchSession) {
        await deps.sessionTransport.switchSession(nextSessionId);
      } else {
        await deps.sessionTransport.reset();
      }
      deps.playbackController.interrupt();
      await deps.audioCapture.cancel();
      deps.micHoldRef.current = false;
      deps.micStartingRef.current = false;
      deps.micActiveRef.current = false;
      deps.setLessonSessionId(nextSessionId);
      deps.setSessionState("idle");
      deps.setTranscript("");
      deps.setTutorText("");
      deps.setConversation([]);
      deps.setLatency(null);
      deps.setTimestamps([]);
      deps.setAvatarNowMs(0);
      deps.setError("");
      deps.setMicActive(false);
      deps.closeHistoryDrawer();
      deps.setStudentPrompt("");
      deps.setSubject(deps.sessionDefaults.subject);
      deps.setGradeBand(deps.sessionDefaults.gradeBand);
      deps.setLlmProvider(deps.sessionDefaults.llmProvider);
      deps.setLlmModel(deps.sessionDefaults.llmModel);
      deps.setLessonState(null);
      deps.setPreference(deps.sessionDefaults.preference);
      deps.setTtsProvider(deps.sessionDefaults.ttsProvider);
      deps.setTtsModel(deps.sessionDefaults.ttsModel);
      await clearPersistedLessonThreadRemote();
    },
    async resumeLesson(lessonId: string) {
      const archivedThread = await refreshArchivedLessonThread(lessonId);
      if (!archivedThread) {
        return;
      }
      const normalizedThread = withNormalizedThreadSessionId(archivedThread);

      deps.activeTurnIdRef.current += 1;
      if (deps.sessionTransport.switchSession) {
        await deps.sessionTransport.switchSession(normalizedThread.sessionId, normalizedThread);
      } else {
        await deps.sessionTransport.reset();
      }
      deps.playbackController.interrupt();
      await deps.audioCapture.cancel();
      deps.micHoldRef.current = false;
      deps.micStartingRef.current = false;
      deps.micActiveRef.current = false;
      deps.setLessonSessionId(normalizedThread.sessionId);
      deps.setSessionState("idle");
      deps.setLatency(null);
      deps.setTimestamps([]);
      deps.setAvatarNowMs(0);
      deps.setError("");
      deps.setMicActive(false);
      deps.setHistoryOpen(false);
      deps.applyThread(normalizedThread);
    },
    runDemoTurn,
  };
}
