import type React from "react";

import type { BrowserAudioCapture, CapturedAudioChunk } from "../../lib/audio_capture";
import { normalizeRuntimeSelection } from "../../lib/runtime_options";
import { resolveAvatarPersona } from "../../lib/avatar_persona";
import type { PersistedTurnDebug } from "../../lib/lesson_thread_store";
import { appendSessionActivityLog, getSessionActivityLogSnapshot } from "../../lib/session_activity_log";
import type { LatencyMetrics } from "../LatencyMonitor";
import type { LessonConversationTurn } from "../LessonThreadPanels";
import type { SessionTransport } from "./session_types";
import { describeMicTurnFailure, normalizeLessonSessionId, resolveTransportKind, summarizeAudioChunks } from "./tutor_session_utils";

const TUTOR_SESSION_LOG_PREFIX = "[TutorSession]";
const NO_SPEECH_DETECTED_MESSAGE = "No speech detected";
const NO_SPEECH_DETECTED_HINT = "No speech detected. Hold the mic a bit longer and try again.";

function logTutorSessionInfo(event: string, details: Record<string, unknown>) {
  console.info(TUTOR_SESSION_LOG_PREFIX, event, details);
  appendSessionActivityLog({
    event,
    level: "info",
    metadata: details,
    scope: "tutor-session",
    summary: event.replaceAll(".", " "),
  });
}

function logTutorSessionWarn(event: string, details: Record<string, unknown>) {
  console.warn(TUTOR_SESSION_LOG_PREFIX, event, details);
  appendSessionActivityLog({
    event,
    level: "warn",
    metadata: details,
    scope: "tutor-session",
    summary: event.replaceAll(".", " "),
  });
}

type TutorSessionMicDeps = {
  audioCapture: BrowserAudioCapture;
  avatarProviderId: string;
  gradeBand: string;
  lessonSessionId: string;
  llmModel: string;
  llmProvider: string;
  micActiveRef: React.MutableRefObject<boolean>;
  micHoldRef: React.MutableRefObject<boolean>;
  micInputBlocked: boolean;
  micStartingRef: React.MutableRefObject<boolean>;
  micSupported: boolean;
  preference: string;
  runtimeReady: boolean;
  sessionTransport: SessionTransport;
  studentPrompt: string;
  subject: string;
  transcript: string;
  ttsModel: string;
  ttsProvider: string;
  activeTurnIdRef: React.MutableRefObject<number>;
  setConversation: React.Dispatch<React.SetStateAction<LessonConversationTurn[]>>;
  setError: React.Dispatch<React.SetStateAction<string>>;
  setLatency: React.Dispatch<React.SetStateAction<LatencyMetrics | null>>;
  setMicActive: React.Dispatch<React.SetStateAction<boolean>>;
  setSessionState: React.Dispatch<React.SetStateAction<string>>;
  setStudentPrompt: React.Dispatch<React.SetStateAction<string>>;
  setTimestamps: React.Dispatch<React.SetStateAction<Array<{ endMs: number; startMs: number; word: string }>>>;
  setTranscript: React.Dispatch<React.SetStateAction<string>>;
  setTutorText: React.Dispatch<React.SetStateAction<string>>;
};

export function createTutorSessionMicActions(deps: TutorSessionMicDeps) {
  const isNoSpeechDetectedError = (message: string) => message.trim() === NO_SPEECH_DETECTED_MESSAGE;
  const appendFailedMicTurn = (
    audioChunks: CapturedAudioChunk[],
    transcriptText: string,
    errorMessage: string,
    startedAt: string
  ) => {
    const runtimeSelection = normalizeRuntimeSelection({
      llmModel: deps.llmModel,
      llmProvider: deps.llmProvider,
      ttsModel: deps.ttsModel,
      ttsProvider: deps.ttsProvider,
    });
    const nextTurnId = deps.activeTurnIdRef.current + 1;
    deps.activeTurnIdRef.current = nextTurnId;
    const normalizedTranscript = transcriptText.trim() || "Voice input failed";
    const normalizedError = errorMessage.trim() || "Could not transcribe microphone input";
    const debug: PersistedTurnDebug = {
      audio: summarizeAudioChunks(audioChunks),
      latency: {
        llmFirstTokenToTtsFirstAudioMs: 0,
        speechEndToSttFinalMs: 0,
        sttFinalToLlmFirstTokenMs: 0,
      },
      request: {
        gradeBand: deps.gradeBand,
        llmModel: runtimeSelection.llmModel,
        llmProvider: runtimeSelection.llmProvider,
        preference: deps.preference,
        source: "mic",
        studentTextLength: normalizedTranscript.length,
        subject: deps.subject,
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
      sessionEvents: getSessionActivityLogSnapshot(24),
      sessionId: normalizeLessonSessionId(deps.lessonSessionId),
      startedAt,
      transport: resolveTransportKind(runtimeSelection),
    };
    deps.setConversation((current) => [...current, { debug, id: `${nextTurnId}`, transcript: normalizedTranscript, tutorText: normalizedError }]);
  };

  const stopMicCapture = async () => {
    if (!deps.runtimeReady || deps.micStartingRef.current || !deps.micActiveRef.current) {
      return;
    }

    let chunks: CapturedAudioChunk[] = [];
    const startedAt = new Date().toISOString();
    try {
      chunks = await deps.audioCapture.stop();
      logTutorSessionInfo("mic.stop", {
        audioChunkCount: chunks.length,
        bytesWithPayloadCount: chunks.filter((chunk) => Boolean(chunk.bytesBase64)).length,
        mimeTypes: Array.from(new Set(chunks.map((chunk) => chunk.mimeType).filter(Boolean))),
        totalBytes: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
      });
      deps.micActiveRef.current = false;
      deps.setMicActive(false);
      deps.setError("");
      const runtimeSelection = normalizeRuntimeSelection({
        llmModel: deps.llmModel,
        llmProvider: deps.llmProvider,
        ttsModel: deps.ttsModel,
        ttsProvider: deps.ttsProvider,
      });
      const avatarPersona = resolveAvatarPersona(deps.avatarProviderId);
      deps.setSessionState("thinking");
      deps.setLatency(null);
      deps.setTimestamps([]);
      deps.setTutorText("");
      const transcriptText = await deps.sessionTransport.transcribeAudio?.({
        studentText: "",
        subject: deps.subject,
        gradeBand: deps.gradeBand,
        llmProvider: runtimeSelection.llmProvider,
        llmModel: runtimeSelection.llmModel,
        onTranscriptUpdate: (text) => {
          deps.setStudentPrompt(text);
          deps.setTranscript(text);
        },
        studentProfile: {
          ...(deps.preference ? { preference: deps.preference } : {}),
          avatarLabel: avatarPersona.label,
          avatarPersona: avatarPersona.prompt,
        },
        audioChunks: chunks,
        ttsProvider: runtimeSelection.ttsProvider,
        ttsModel: runtimeSelection.ttsModel,
      });
      if ((transcriptText ?? "").trim()) {
        deps.setStudentPrompt(transcriptText ?? "");
        deps.setTranscript(transcriptText ?? "");
      }
      deps.setSessionState("idle");
    } catch (caughtError) {
      deps.micActiveRef.current = false;
      deps.setMicActive(false);
      deps.setSessionState("idle");
      const errorMessage = caughtError instanceof Error ? caughtError.message : "Could not stop microphone";
      if (isNoSpeechDetectedError(errorMessage)) {
        logTutorSessionWarn("mic.no_speech_detected", {
          audioChunkCount: chunks.length,
          totalBytes: chunks.reduce((sum, chunk) => sum + chunk.size, 0),
        });
        deps.setError(NO_SPEECH_DETECTED_HINT);
        return;
      }
      appendFailedMicTurn(chunks, deps.transcript.trim() || deps.studentPrompt.trim(), errorMessage, startedAt);
      deps.setError(errorMessage);
    }
  };

  const startMicCapture = async () => {
    if (!deps.runtimeReady) {
      return;
    }

    if (!deps.micSupported) {
      deps.setError("Microphone capture is not supported in this browser");
      return;
    }

    if (deps.micStartingRef.current || deps.micActiveRef.current) {
      return;
    }

    deps.setError("");
    deps.micStartingRef.current = true;
    try {
      logTutorSessionInfo("mic.start", { sessionState: "idle" });
      await deps.audioCapture.start();
      deps.micStartingRef.current = false;
      deps.micActiveRef.current = true;
      deps.setMicActive(true);
      deps.setSessionState("listening");

      if (!deps.micHoldRef.current) {
        await stopMicCapture();
      }
    } catch (caughtError) {
      deps.micStartingRef.current = false;
      deps.micActiveRef.current = false;
      deps.setMicActive(false);
      deps.setSessionState("idle");
      deps.setError(caughtError instanceof Error ? caughtError.message : "Could not start microphone");
    }
  };

  return {
    handleMicButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if ((event.key !== " " && event.key !== "Enter") || event.repeat || deps.micHoldRef.current || deps.micInputBlocked) {
        return;
      }

      event.preventDefault();
      deps.micHoldRef.current = true;
      void startMicCapture();
    },
    handleMicButtonKeyUp(event: React.KeyboardEvent<HTMLButtonElement>) {
      if ((event.key !== " " && event.key !== "Enter") || !deps.micHoldRef.current) {
        return;
      }

      event.preventDefault();
      deps.micHoldRef.current = false;
      void stopMicCapture();
    },
    handleMicMouseDown(event: React.MouseEvent<HTMLButtonElement>) {
      if (event.button !== 0 || deps.micHoldRef.current || deps.micInputBlocked) {
        return;
      }

      event.preventDefault();
      deps.micHoldRef.current = true;
      void startMicCapture();
    },
    handleMicMouseUp() {
      if (!deps.micHoldRef.current) {
        return;
      }

      deps.micHoldRef.current = false;
      void stopMicCapture();
    },
    handleMicPressEnd(event?: React.PointerEvent<HTMLButtonElement> | React.FocusEvent<HTMLButtonElement>) {
      if (!deps.micHoldRef.current) {
        return;
      }

      deps.micHoldRef.current = false;

      if (event && "pointerId" in event && event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      void stopMicCapture();
    },
    handleMicPressStart(event: React.PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0 || deps.micHoldRef.current || deps.micInputBlocked) {
        return;
      }

      event.preventDefault();
      deps.micHoldRef.current = true;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      void startMicCapture();
    },
  };
}
