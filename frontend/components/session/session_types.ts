import type { CapturedAudioChunk } from "../../lib/audio_capture";
import type { AvatarVisualState, WordTimestamp } from "../../lib/avatar_contract";
import type { PersistedLessonThread } from "../../lib/lesson_thread_store";
import type { LatencyMetrics } from "../LatencyMonitor";
import type { SessionMetricSnapshot } from "../../lib/session_metrics";

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

export type TutorSessionProps = {
  initialAvatarProviderId?: string;
  transport?: SessionTransport;
};

export type TurnSource = "text" | "mic";

export type TutorSessionAvatarVisualState = AvatarVisualState;
