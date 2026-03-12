import type { CapturedAudioChunk } from "../../lib/audio_capture";
import type { PersistedLessonThread, PersistedTurnDebug } from "../../lib/lesson_thread_store";
import type { RuntimeSelection } from "../../lib/runtime_options";
import type { LessonConversationTurn } from "../LessonThreadPanels";

export function normalizeLessonSessionId(sessionId: string | null | undefined): string {
  const normalized = typeof sessionId === "string" ? sessionId.trim() : "";
  if (normalized && normalized !== "undefined" && normalized !== "null") {
    return normalized;
  }

  return crypto.randomUUID?.() ?? `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function withNormalizedThreadSessionId(thread: PersistedLessonThread): PersistedLessonThread {
  return {
    ...thread,
    sessionId: normalizeLessonSessionId(thread.sessionId),
  };
}

export function resolveThreadStudentPrompt(thread: PersistedLessonThread): string {
  if (thread.studentPrompt.trim()) {
    return thread.studentPrompt;
  }

  const latestTranscript = thread.conversation.at(-1)?.transcript ?? thread.transcript;
  return latestTranscript.trim();
}

export function resolveNextTurnId(conversation: LessonConversationTurn[]): number {
  const numericIds = conversation
    .map((turn) => Number.parseInt(turn.id, 10))
    .filter((value) => Number.isFinite(value));
  if (numericIds.length > 0) {
    return Math.max(...numericIds) + 1;
  }

  return conversation.length;
}

export function resolveConversationKey(turn: LessonConversationTurn, index: number): string {
  return `${turn.id}-${index}`;
}

export function formatTutorSubject(subject: string) {
  return subject.charAt(0).toUpperCase() + subject.slice(1);
}

export function summarizeAudioChunks(audioChunks: CapturedAudioChunk[]) {
  return {
    chunkCount: audioChunks.length,
    mimeTypes: Array.from(new Set(audioChunks
      .map((chunk) => chunk.mimeType)
      .filter((mimeType): mimeType is string => Boolean(mimeType)))),
    totalBytes: audioChunks.reduce((sum, chunk) => sum + chunk.size, 0),
    withPayloadCount: audioChunks.filter((chunk) => Boolean(chunk.bytesBase64)).length,
  };
}

export function describeMicTurnFailure(audioChunks: CapturedAudioChunk[]) {
  const hasCapturedAudio = audioChunks.some((chunk) => Boolean(chunk.bytesBase64));
  return hasCapturedAudio ? "Voice captured, but transcription failed." : "Voice turn failed before transcription.";
}

export function resolveTransportKind(runtimeSelection: RuntimeSelection): PersistedTurnDebug["transport"] {
  return runtimeSelection.llmProvider === "openai-realtime" && runtimeSelection.ttsProvider === "openai-realtime"
    ? "openai-realtime"
    : "session-socket";
}
