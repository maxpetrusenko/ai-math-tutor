import { createSessionMetrics, snapshotSessionMetrics, toLatencyMetrics } from "./session_metrics";
import type { SessionTransport, TutorTurnRequest, TutorTurnResult } from "../components/TutorSession";
import { getCurrentFirebaseIdToken } from "./firebase_auth";
import { getFirebaseAuthClient } from "./firebase_client";
import type { PersistedLessonThread } from "./lesson_thread_store";

const REALTIME_SOCKET_URL = "wss://api.openai.com/v1/realtime";
const REALTIME_API_TIMEOUT_MS = 20_000;
const REALTIME_TOKEN_MINT_TIMEOUT_MS = 25_000;
const REALTIME_SAMPLE_RATE = 24_000;
const REALTIME_TRANSCRIPTION_MODEL = "gpt-4o-transcribe";
const REALTIME_VOICE = "marin";

type TransportDeps = {
  apiUrl?: string;
  fetchImpl?: typeof fetch;
  WebSocketImpl?: typeof WebSocket;
};

type MintClientSecretOptions = {
  model?: string;
  sessionType?: "realtime" | "transcription";
};

type RealtimeTurnPhase = "input" | "response";

type ActiveTurn = {
  audioBase64Chunks: string[];
  audioDone: boolean;
  expectsAudio: boolean;
  metrics: ReturnType<typeof createSessionMetrics>;
  onTranscriptFinal?: (text: string) => void;
  phase: RealtimeTurnPhase;
  reject: (error: Error) => void;
  resolve: (result: TutorTurnResult) => void;
  responseDone: boolean;
  timeoutId: ReturnType<typeof setTimeout> | null;
  transcript: string;
  tutorText: string;
};

function generateSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeSessionId(sessionId: string | null | undefined): string {
  const normalized = typeof sessionId === "string" ? sessionId.trim() : "";
  if (normalized && normalized !== "undefined" && normalized !== "null") {
    return normalized;
  }
  return generateSessionId();
}

function resolveRealtimeApiUrl() {
  if (typeof process !== "undefined" && process.env.NODE_ENV === "test") {
    return "";
  }

  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_LESSON_API_URL) {
    return process.env.NEXT_PUBLIC_LESSON_API_URL.replace(/\/lessons$/, "/realtime/client-secret");
  }

  const baseWsUrl =
    typeof process !== "undefined" && process.env.NEXT_PUBLIC_SESSION_WS_URL
      ? process.env.NEXT_PUBLIC_SESSION_WS_URL
      : "ws://localhost:8000/ws/session";

  try {
    const url = new URL(baseWsUrl);
    url.protocol = url.protocol === "wss:" ? "https:" : "http:";
    url.pathname = "/api/realtime/client-secret";
    url.search = "";
    return url.toString();
  } catch {
    return "";
  }
}

function buildRealtimeInstructions(request: TutorTurnRequest) {
  const avatarLabel = request.studentProfile?.avatarLabel?.trim();
  const avatarPersona = request.studentProfile?.avatarPersona?.trim();
  const preference = request.studentProfile?.preference?.trim();
  const pacing = request.studentProfile?.pacing?.trim();
  return [
    "You are Nerdy's live tutor.",
    `Subject: ${request.subject}.`,
    `Grade band: ${request.gradeBand}.`,
    "Teach Socratically, keep responses concise, and end with a short next-step question when appropriate.",
    avatarPersona ? `${avatarLabel ?? "Avatar"} persona: ${avatarPersona}.` : "",
    preference ? `Student preference: ${preference}.` : "",
    pacing ? `Student pacing: ${pacing}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function isRealtimeRequest(request: TutorTurnRequest) {
  return request.llmProvider === "openai-realtime" && request.ttsProvider === "openai-realtime";
}

function isAudioTurn(request: TutorTurnRequest) {
  return (request.audioChunks ?? []).some((chunk) => Boolean(chunk.bytesBase64));
}

function buildRealtimeResponseSession(request: TutorTurnRequest) {
  return {
    type: "realtime",
    instructions: buildRealtimeInstructions(request),
    output_modalities: ["audio"],
    audio: {
      input: {
        format: { type: "audio/pcm", rate: REALTIME_SAMPLE_RATE },
        transcription: { language: "en", model: REALTIME_TRANSCRIPTION_MODEL },
        turn_detection: null,
      },
      output: {
        format: { type: "audio/pcm", rate: REALTIME_SAMPLE_RATE },
        voice: REALTIME_VOICE,
      },
    },
  };
}

function buildRealtimeTranscriptionSession() {
  return {
    type: "transcription",
    audio: {
      input: {
        format: { type: "audio/pcm", rate: REALTIME_SAMPLE_RATE },
        transcription: {
          language: "en",
          model: REALTIME_TRANSCRIPTION_MODEL,
        },
        turn_detection: null,
      },
    },
  };
}

function joinBase64PcmChunks(chunks: string[]) {
  const bytes = chunks.flatMap((chunk) => Array.from(base64ToUint8Array(chunk)));
  return new Uint8Array(bytes);
}

function pcm16ToWavBase64(pcmBytes: Uint8Array, sampleRate: number) {
  const wavBytes = new Uint8Array(44 + pcmBytes.length);
  const view = new DataView(wavBytes.buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmBytes.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcmBytes.length, true);
  wavBytes.set(pcmBytes, 44);

  let binary = "";
  for (const byte of wavBytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function capturedChunksToPcmBase64Chunks(chunks: NonNullable<TutorTurnRequest["audioChunks"]>) {
  const populatedChunks = chunks.filter((chunk) => chunk.bytesBase64);
  if (populatedChunks.length === 0) {
    return [];
  }

  const mimeType = populatedChunks[0]?.mimeType ?? "audio/webm;codecs=opus";
  const blob = new Blob(
    populatedChunks.map((chunk) => base64ToUint8Array(chunk.bytesBase64 as string)),
    { type: mimeType }
  );
  const audioBuffer = await decodeAndResample(blob, REALTIME_SAMPLE_RATE);
  const pcmBytes = audioBufferToPcm16(audioBuffer);
  const encodedChunks: string[] = [];
  const chunkByteSize = 4_800;
  for (let offset = 0; offset < pcmBytes.length; offset += chunkByteSize) {
    const slice = pcmBytes.slice(offset, offset + chunkByteSize);
    let binary = "";
    for (const byte of slice) {
      binary += String.fromCharCode(byte);
    }
    encodedChunks.push(btoa(binary));
  }
  return encodedChunks;
}

async function requestAudioAsPcmBase64Chunks(request: TutorTurnRequest) {
  return capturedChunksToPcmBase64Chunks(request.audioChunks ?? []);
}

async function decodeAndResample(blob: Blob, sampleRate: number) {
  const inputBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  try {
    const decoded = await audioContext.decodeAudioData(inputBuffer.slice(0));
    if (decoded.sampleRate === sampleRate) {
      return mixToMono(decoded);
    }

    const offlineContext = new OfflineAudioContext(
      1,
      Math.max(1, Math.ceil(decoded.duration * sampleRate)),
      sampleRate
    );
    const source = offlineContext.createBufferSource();
    source.buffer = decoded;
    source.connect(offlineContext.destination);
    source.start(0);
    const rendered = await offlineContext.startRendering();
    return mixToMono(rendered);
  } finally {
    await audioContext.close();
  }
}

function mixToMono(audioBuffer: AudioBuffer) {
  if (audioBuffer.numberOfChannels === 1) {
    return audioBuffer;
  }

  const offlineContext = new OfflineAudioContext(1, audioBuffer.length, audioBuffer.sampleRate);
  const monoBuffer = offlineContext.createBuffer(1, audioBuffer.length, audioBuffer.sampleRate);
  const monoChannel = monoBuffer.getChannelData(0);
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let index = 0; index < channelData.length; index += 1) {
      monoChannel[index] += channelData[index] / audioBuffer.numberOfChannels;
    }
  }
  return monoBuffer;
}

function audioBufferToPcm16(audioBuffer: AudioBuffer) {
  const channelData = audioBuffer.getChannelData(0);
  const pcm = new Uint8Array(channelData.length * 2);
  const view = new DataView(pcm.buffer);
  for (let index = 0; index < channelData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return pcm;
}

export function createOpenAIRealtimeTransport(deps: TransportDeps = {}): SessionTransport {
  const apiUrl = deps.apiUrl ?? resolveRealtimeApiUrl();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const WebSocketImpl = deps.WebSocketImpl ?? WebSocket;
  let currentSessionId = normalizeSessionId(generateSessionId());
  let socket: WebSocket | null = null;
  let socketModel = "";
  let seededHistorySessionId = "";
  let conversationHistory: Array<{ transcript: string; tutorText: string }> = [];
  let activeTurn: ActiveTurn | null = null;

  const closeSocket = () => {
    if (socket) {
      socket.onopen = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.onmessage = null;
      try {
        socket.close();
      } catch {
        // ignore close failures
      }
    }
    socket = null;
    socketModel = "";
  };

  const finalizeTurn = () => {
    if (!activeTurn) {
      return;
    }
    if (activeTurn.timeoutId) {
      clearTimeout(activeTurn.timeoutId);
    }
    const resolvedTurn = activeTurn;
    const wavBase64 = pcm16ToWavBase64(joinBase64PcmChunks(resolvedTurn.audioBase64Chunks), REALTIME_SAMPLE_RATE);
    resolvedTurn.resolve({
      transcript: resolvedTurn.transcript,
      tutorText: resolvedTurn.tutorText.trim(),
      state: "speaking",
      latency: toLatencyMetrics(resolvedTurn.metrics),
      metricEvents: snapshotSessionMetrics(resolvedTurn.metrics),
      timestamps: [],
      audioSegments: resolvedTurn.audioBase64Chunks.length > 0
        ? [{
            text: resolvedTurn.tutorText.trim(),
            audioBase64: wavBase64,
            audioMimeType: "audio/wav",
          }]
        : undefined,
    });
    conversationHistory.push({
      transcript: resolvedTurn.transcript,
      tutorText: resolvedTurn.tutorText.trim(),
    });
    activeTurn = null;
  };

  const failActiveTurn = (message: string) => {
    if (!activeTurn) {
      return;
    }
    if (activeTurn.timeoutId) {
      clearTimeout(activeTurn.timeoutId);
    }
    activeTurn.reject(new Error(message));
    activeTurn = null;
  };

  const maybeFinalizeTurn = () => {
    if (!activeTurn) {
      return;
    }
    if (activeTurn.responseDone && (!activeTurn.expectsAudio || activeTurn.audioDone)) {
      finalizeTurn();
    }
  };

  const handleMessage = (event: MessageEvent<string>) => {
    const payload = JSON.parse(event.data) as Record<string, unknown>;
    if (payload.type === "error") {
      const message = String((payload.error as Record<string, unknown> | undefined)?.message ?? payload.message ?? "Realtime error");
      failActiveTurn(message);
      return;
    }
    if (!activeTurn) {
      return;
    }

    if (payload.type === "conversation.item.input_audio_transcription.completed") {
      const transcript = typeof payload.transcript === "string" ? payload.transcript : String(payload.transcript ?? "");
      activeTurn.transcript = transcript;
      activeTurn.onTranscriptFinal?.(transcript);
      activeTurn.metrics.mark({ name: "stt_final", tsMs: performance.now() });
      return;
    }

    if (payload.type === "response.text.delta" || payload.type === "response.output_text.delta") {
      const textDelta = String(payload.delta ?? "");
      if (textDelta) {
        activeTurn.tutorText += textDelta;
        activeTurn.metrics.mark({ name: "llm_first_token", tsMs: performance.now() });
      }
      return;
    }

    if (payload.type === "response.audio_transcript.delta" || payload.type === "response.output_audio_transcript.delta") {
      const textDelta = String(payload.delta ?? "");
      if (textDelta) {
        activeTurn.tutorText += textDelta;
        activeTurn.metrics.mark({ name: "llm_first_token", tsMs: performance.now() });
      }
      return;
    }

    if (payload.type === "response.audio.delta" || payload.type === "response.output_audio.delta") {
      const delta = String(payload.delta ?? "");
      if (delta) {
        activeTurn.audioBase64Chunks.push(delta);
        activeTurn.metrics.mark({ name: "tts_first_audio", tsMs: performance.now() });
      }
      return;
    }

    if (payload.type === "response.audio.done" || payload.type === "response.output_audio.done") {
      activeTurn.audioDone = true;
      maybeFinalizeTurn();
      return;
    }

    if (payload.type === "response.done") {
      activeTurn.responseDone = true;
      maybeFinalizeTurn();
    }
  };

  const sendEvent = (payload: Record<string, unknown>) => {
    if (!socket || socket.readyState !== WebSocketImpl.OPEN) {
      throw new Error("Realtime socket is not connected");
    }
    socket.send(JSON.stringify(payload));
  };

  const replayHistory = () => {
    if (seededHistorySessionId === currentSessionId) {
      return;
    }
    for (const turn of conversationHistory) {
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: turn.transcript }],
        },
      });
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: turn.tutorText }],
        },
      });
    }
    seededHistorySessionId = currentSessionId;
  };

  const mintClientSecret = async (request: TutorTurnRequest, options: MintClientSecretOptions = {}) => {
    if (!apiUrl) {
      throw new Error("Realtime token endpoint is not configured");
    }
    const requestedModel = options.model ?? request.llmModel ?? "gpt-realtime-mini";
    const idToken = await getCurrentFirebaseIdToken();
    if (!idToken && getFirebaseAuthClient()) {
      throw new Error("Firebase sign-in required");
    }
    let response: Response;
    try {
      response = await fetchImpl(apiUrl, {
        method: "POST",
        credentials: "include",
        signal:
          typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
            ? AbortSignal.timeout(REALTIME_TOKEN_MINT_TIMEOUT_MS)
            : undefined,
        headers: {
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instructions: buildRealtimeInstructions(request),
          model: requestedModel,
          session_type: options.sessionType,
          voice: REALTIME_VOICE,
        }),
      });
    } catch (error) {
      throw new Error(describeRealtimeTokenMintFailure(error));
    }
    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      const detail = parseRealtimeErrorDetail(responseText);
      throw new Error(detail ? `Realtime token request failed: ${detail}` : `Realtime token request failed with status ${response.status}`);
    }
    const payload = await response.json() as { client_secret?: { value?: string }; value?: string };
    const secret = payload.client_secret?.value ?? payload.value;
    if (!secret) {
      throw new Error("Realtime token response was missing client_secret");
    }
    return secret;
  };

  const ensureSocket = async (request: TutorTurnRequest) => {
    const requestedModel = request.llmModel || "gpt-realtime-mini";
    if (socket?.readyState === WebSocketImpl.OPEN && socketModel === requestedModel) {
      return socket;
    }

    closeSocket();
    const clientSecret = await mintClientSecret(request);
    const ws = new WebSocketImpl(`${REALTIME_SOCKET_URL}?model=${encodeURIComponent(requestedModel)}`, [
      "realtime",
      `openai-insecure-api-key.${clientSecret}`,
    ]);

    return new Promise<WebSocket>((resolve, reject) => {
      ws.onopen = () => {
        socket = ws;
        socketModel = requestedModel;
        ws.onmessage = handleMessage;
        ws.onclose = () => {
          failActiveTurn("Realtime socket closed");
          closeSocket();
        };
        ws.onerror = () => {
          failActiveTurn("Realtime socket failed");
          closeSocket();
        };
        sendEvent({
          type: "session.update",
          session: buildRealtimeResponseSession(request),
        });
        replayHistory();
        resolve(ws);
      };
      ws.onerror = () => reject(new Error("Realtime socket failed"));
    });
  };

  return {
    async connect() {
      return "connected";
    },
    getSessionId() {
      return normalizeSessionId(currentSessionId);
    },
    async runTurn(request) {
      if (typeof window === "undefined") {
        return {
          transcript: request.studentText,
          tutorText: "Realtime response",
          state: "speaking",
          latency: {
            speechEndToSttFinalMs: 0,
            sttFinalToLlmFirstTokenMs: 0,
            llmFirstTokenToTtsFirstAudioMs: 0,
          },
          timestamps: [],
        };
      }

      if (!isRealtimeRequest(request)) {
        throw new Error("OpenAI Realtime transport received a non-realtime request");
      }
      if (activeTurn) {
        throw new Error("A tutor turn is already in progress");
      }

      await ensureSocket(request);

      return new Promise<TutorTurnResult>(async (resolve, reject) => {
        const metrics = createSessionMetrics();
        metrics.mark({ name: "speech_end", tsMs: performance.now() });
        const turn = {
          audioBase64Chunks: [],
          audioDone: false,
          expectsAudio: true,
          metrics,
          onTranscriptFinal: request.onTranscriptFinal,
          phase: isAudioTurn(request) ? "input" : "response",
          reject,
          resolve,
          responseDone: false,
          timeoutId: null,
          transcript: request.studentText,
          tutorText: "",
        } as ActiveTurn;
        turn.timeoutId = setTimeout(() => {
          failActiveTurn(`OpenAI Realtime turn timed out during ${turn.phase === "input" ? "audio input" : "response generation"}`);
        }, REALTIME_API_TIMEOUT_MS);
        activeTurn = turn;

        try {
          if (isAudioTurn(request)) {
            const pcmChunks = await requestAudioAsPcmBase64Chunks(request);
            for (const chunk of pcmChunks) {
              sendEvent({ type: "input_audio_buffer.append", audio: chunk });
            }
            sendEvent({ type: "input_audio_buffer.commit" });
          } else {
            turn.metrics.mark({ name: "stt_final", tsMs: performance.now() });
            sendEvent({
              type: "conversation.item.create",
              item: {
                type: "message",
                role: "user",
                content: [{ type: "input_text", text: request.studentText }],
              },
            });
          }

          turn.phase = "response";
          sendEvent({
            type: "response.create",
            response: {
              output_modalities: ["audio"],
            },
          });
        } catch (error) {
          failActiveTurn(error instanceof Error ? error.message : "Could not start OpenAI Realtime turn");
        }
      });
    },
    async transcribeAudio(request) {
      if (typeof window === "undefined") {
        return request.studentText;
      }
      if (!isRealtimeRequest(request) || !isAudioTurn(request)) {
        return request.studentText;
      }

      const requestedModel = REALTIME_TRANSCRIPTION_MODEL;
      const clientSecret = await mintClientSecret(request, {
        model: requestedModel,
        sessionType: "transcription",
      });
      const pcmChunks = await requestAudioAsPcmBase64Chunks(request);
      if (pcmChunks.length === 0) {
        return request.studentText;
      }

      return new Promise<string>((resolve, reject) => {
        let settled = false;
        let transcript = "";
        const ws = new WebSocketImpl(REALTIME_SOCKET_URL, [
          "realtime",
          `openai-insecure-api-key.${clientSecret}`,
        ]);
        const timeoutId = setTimeout(() => {
          if (settled) {
            return;
          }
          settled = true;
          try {
            ws.close();
          } catch {
            // ignore close failures
          }
          reject(new Error("OpenAI Realtime transcription timed out before a final transcript arrived"));
        }, REALTIME_API_TIMEOUT_MS);

        const finish = (result: string) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutId);
          try {
            ws.close();
          } catch {
            // ignore close failures
          }
          resolve(result);
        };

        const fail = (message: string) => {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timeoutId);
          try {
            ws.close();
          } catch {
            // ignore close failures
          }
          reject(new Error(message));
        };

        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: "session.update",
            session: buildRealtimeTranscriptionSession(),
          }));
          for (const chunk of pcmChunks) {
            ws.send(JSON.stringify({ type: "input_audio_buffer.append", audio: chunk }));
          }
          ws.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
        };
        ws.onmessage = (event) => {
          const payload = JSON.parse(event.data) as Record<string, unknown>;
          if (payload.type === "error") {
            const message = String((payload.error as Record<string, unknown> | undefined)?.message ?? payload.message ?? "Realtime transcription error");
            fail(message);
            return;
          }
          if (payload.type === "conversation.item.input_audio_transcription.delta") {
            const delta = typeof payload.delta === "string" ? payload.delta : "";
            if (!delta) {
              return;
            }
            transcript += delta;
            request.onTranscriptUpdate?.(transcript);
            return;
          }
          if (payload.type === "conversation.item.input_audio_transcription.completed") {
            const completedTranscript =
              typeof payload.transcript === "string" && payload.transcript.trim()
                ? payload.transcript
                : transcript;
            request.onTranscriptUpdate?.(completedTranscript);
            request.onTranscriptFinal?.(completedTranscript);
            finish(completedTranscript);
          }
        };
        ws.onerror = () => fail("Realtime transcription socket failed");
        ws.onclose = () => {
          if (!settled) {
            fail("Realtime transcription socket closed before a final transcript arrived");
          }
        };
      });
    },
    async interrupt() {
      if (!socket || socket.readyState !== WebSocketImpl.OPEN) {
        return;
      }
      sendEvent({ type: "response.cancel" });
      sendEvent({ type: "input_audio_buffer.clear" });
      failActiveTurn("Tutor turn interrupted");
    },
    async reset() {
      conversationHistory = [];
      seededHistorySessionId = "";
      currentSessionId = normalizeSessionId(generateSessionId());
      closeSocket();
    },
    async switchSession(sessionId, thread) {
      currentSessionId = normalizeSessionId(sessionId);
      conversationHistory = thread
        ? thread.conversation.map((turn) => ({ transcript: turn.transcript, tutorText: turn.tutorText }))
        : [];
      seededHistorySessionId = "";
      closeSocket();
    },
  };
}

function parseRealtimeErrorDetail(responseText: string) {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return "";
  }
  try {
    const payload = JSON.parse(trimmed) as { detail?: unknown; error?: { message?: unknown } };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail.trim();
    }
    if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
      return payload.error.message.trim();
    }
  } catch {
    // response was not JSON
  }
  return trimmed;
}

function describeRealtimeTokenMintFailure(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  const normalizedMessage = message.toLowerCase();
  const errorName = error instanceof Error ? error.name.toLowerCase() : "";

  if (errorName === "aborterror" || normalizedMessage.includes("timed out") || normalizedMessage.includes("aborted")) {
    return "Realtime token mint timed out before the backend responded";
  }

  return "Realtime token mint failed before the backend returned a response. Check the local backend server, CORS config, and server logs.";
}
