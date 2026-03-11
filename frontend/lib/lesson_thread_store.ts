import {
  archiveRemoteLessonThread,
  clearRemoteActiveLessonThread,
  fetchArchivedLessonThread,
  fetchLessonStore,
  saveActiveLessonThread,
} from "./lesson_thread_api";
import {
  archiveFirebaseLessonThread,
  clearFirebaseActiveLessonThread,
  fetchFirebaseArchivedLessonThread,
  fetchFirebaseLessonStore,
  saveFirebaseActiveLessonThread,
} from "./firebase_lessons";
import {
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_TTS_MODEL,
  DEFAULT_TTS_PROVIDER,
} from "./runtime_options";

export type PersistedConversationTurn = {
  debug?: PersistedTurnDebug;
  id: string;
  transcript: string;
  tutorText: string;
};

export type PersistedTurnDebug = {
  audio?: {
    chunkCount: number;
    mimeTypes: string[];
    totalBytes: number;
    withPayloadCount: number;
  };
  derivedFromLegacyTurn?: boolean;
  latency?: {
    llmFirstTokenToTtsFirstAudioMs: number;
    speechEndToSttFinalMs: number;
    speechEndToAudioDoneMs?: number | null;
    speechEndToFirstVisemeMs?: number | null;
    sttFinalToLlmFirstTokenMs: number;
    ttsFirstAudioToFirstVisemeMs?: number | null;
    missingEvents?: string[];
    requiredEventCoverageComplete?: boolean;
  };
  request: {
    gradeBand: string;
    llmModel: string;
    llmProvider: string;
    preference: string;
    source: "mic" | "text";
    studentTextLength: number;
    subject: string;
    ttsModel: string;
    ttsProvider: string;
  };
  response: {
    audioSegmentCount: number;
    firstTimestampMs?: number | null;
    lastTimestampMs?: number | null;
    state: string;
    timestampCount: number;
    transcriptLength: number;
    tutorTextLength: number;
  };
  sessionId: string;
  startedAt: string;
  transport: "openai-realtime" | "session-socket";
};

export type PersistedLessonThread = {
  avatarProviderId: string;
  conversation: PersistedConversationTurn[];
  gradeBand: string;
  llmModel: string;
  llmProvider: string;
  preference: string;
  sessionId: string;
  studentPrompt: string;
  subject: string;
  ttsModel: string;
  ttsProvider: string;
  transcript: string;
  tutorText: string;
  version: 1;
};

export type PersistedLessonSummary = {
  gradeBand: string;
  id: string;
  subject: string;
  title: string;
  turnCount: number;
  updatedAt: string;
};

export type PersistedLessonArchiveEntry = PersistedLessonSummary & {
  thread: PersistedLessonThread;
};

export type PersistedLessonThreadStore = {
  activeThread: PersistedLessonThread | null;
  archive: PersistedLessonArchiveEntry[];
  version: 2;
};

const LESSON_THREAD_STORAGE_KEY = "nerdy.lesson-thread.v2";
const LEGACY_LESSON_THREAD_STORAGE_KEY = "nerdy.lesson-thread.v1";
const MAX_ARCHIVED_THREADS = 8;

export function generateLessonSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPersistedLessonThread(value: unknown): value is PersistedLessonThread {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedLessonThread>;
  return (
    candidate.version === 1 &&
    typeof candidate.avatarProviderId === "string" &&
    typeof candidate.gradeBand === "string" &&
    typeof candidate.llmModel === "string" &&
    typeof candidate.llmProvider === "string" &&
    typeof candidate.preference === "string" &&
    typeof candidate.sessionId === "string" &&
    typeof candidate.studentPrompt === "string" &&
    typeof candidate.subject === "string" &&
    typeof candidate.ttsModel === "string" &&
    typeof candidate.ttsProvider === "string" &&
    typeof candidate.transcript === "string" &&
    typeof candidate.tutorText === "string" &&
    Array.isArray(candidate.conversation)
  );
}

function isPersistedLessonThreadStore(value: unknown): value is PersistedLessonThreadStore {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<PersistedLessonThreadStore>;
  return candidate.version === 2 && Array.isArray(candidate.archive) && "activeThread" in candidate;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

function emptyStore(): PersistedLessonThreadStore {
  return {
    activeThread: null,
    archive: [],
    version: 2,
  };
}

function resolvePersistedTransport(thread: Partial<PersistedLessonThread>): PersistedTurnDebug["transport"] {
  return thread.llmProvider === "openai-realtime" && thread.ttsProvider === "openai-realtime"
    ? "openai-realtime"
    : "session-socket";
}

function synthesizeLegacyTurnDebug(
  thread: Partial<PersistedLessonThread>,
  turn: PersistedConversationTurn
): PersistedTurnDebug {
  return {
    audio: {
      chunkCount: 0,
      mimeTypes: [],
      totalBytes: 0,
      withPayloadCount: 0,
    },
    derivedFromLegacyTurn: true,
    latency: {
      llmFirstTokenToTtsFirstAudioMs: 0,
      speechEndToSttFinalMs: 0,
      sttFinalToLlmFirstTokenMs: 0,
    },
    request: {
      gradeBand: typeof thread.gradeBand === "string" ? thread.gradeBand : "6-8",
      llmModel: typeof thread.llmModel === "string" ? thread.llmModel : DEFAULT_LLM_MODEL,
      llmProvider: typeof thread.llmProvider === "string" ? thread.llmProvider : DEFAULT_LLM_PROVIDER,
      preference: typeof thread.preference === "string" ? thread.preference : "",
      source: "text",
      studentTextLength: turn.transcript.length,
      subject: typeof thread.subject === "string" ? thread.subject : "math",
      ttsModel: typeof thread.ttsModel === "string" ? thread.ttsModel : DEFAULT_TTS_MODEL,
      ttsProvider: typeof thread.ttsProvider === "string" ? thread.ttsProvider : DEFAULT_TTS_PROVIDER,
    },
    response: {
      audioSegmentCount: 0,
      firstTimestampMs: null,
      lastTimestampMs: null,
      state: "restored",
      timestampCount: 0,
      transcriptLength: turn.transcript.length,
      tutorTextLength: turn.tutorText.length,
    },
    sessionId: typeof thread.sessionId === "string" ? thread.sessionId : generateLessonSessionId(),
    startedAt: "",
    transport: resolvePersistedTransport(thread),
  };
}

function normalizeConversation(
  thread: Partial<PersistedLessonThread>
): PersistedConversationTurn[] {
  if (!Array.isArray(thread.conversation)) {
    return [];
  }

  return thread.conversation.map((turn) => ({
    ...turn,
    debug: turn.debug ?? synthesizeLegacyTurnDebug(thread, turn),
  }));
}

function normalizeThread(thread: Partial<PersistedLessonThread>): PersistedLessonThread {
  return {
    avatarProviderId: typeof thread.avatarProviderId === "string" ? thread.avatarProviderId : "human-css-2d",
    conversation: normalizeConversation(thread),
    gradeBand: typeof thread.gradeBand === "string" ? thread.gradeBand : "6-8",
    llmModel: typeof thread.llmModel === "string" ? thread.llmModel : DEFAULT_LLM_MODEL,
    llmProvider: typeof thread.llmProvider === "string" ? thread.llmProvider : DEFAULT_LLM_PROVIDER,
    preference: typeof thread.preference === "string" ? thread.preference : "",
    sessionId: typeof thread.sessionId === "string" ? thread.sessionId : generateLessonSessionId(),
    studentPrompt: typeof thread.studentPrompt === "string" ? thread.studentPrompt : "",
    subject: typeof thread.subject === "string" ? thread.subject : "math",
    transcript: typeof thread.transcript === "string" ? thread.transcript : "",
    ttsModel: typeof thread.ttsModel === "string" ? thread.ttsModel : DEFAULT_TTS_MODEL,
    ttsProvider: typeof thread.ttsProvider === "string" ? thread.ttsProvider : DEFAULT_TTS_PROVIDER,
    tutorText: typeof thread.tutorText === "string" ? thread.tutorText : "",
    version: 1,
  };
}

function normalizeStore(store: PersistedLessonThreadStore): PersistedLessonThreadStore {
  return {
    activeThread: store.activeThread ? normalizeThread(store.activeThread) : null,
    archive: store.archive.map((entry) => ({
      ...entry,
      thread: normalizeThread(entry.thread),
    })),
    version: 2,
  };
}

function buildLessonTitle(thread: PersistedLessonThread): string {
  const firstTurn = thread.conversation[0]?.transcript || thread.transcript || thread.studentPrompt;
  const trimmed = firstTurn.trim();
  if (!trimmed) {
    return "Untitled lesson";
  }

  return trimmed.length > 48 ? `${trimmed.slice(0, 48).trimEnd()}...` : trimmed;
}

function hasLessonContent(thread: PersistedLessonThread): boolean {
  return Boolean(thread.conversation.length || thread.transcript || thread.tutorText);
}

function writeStore(store: PersistedLessonThreadStore) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(LESSON_THREAD_STORAGE_KEY, JSON.stringify(store));
  storage.removeItem(LEGACY_LESSON_THREAD_STORAGE_KEY);
}

function readStore(): PersistedLessonThreadStore {
  const storage = getStorage();
  if (!storage) {
    return emptyStore();
  }

  const rawValue = storage.getItem(LESSON_THREAD_STORAGE_KEY);
  if (rawValue) {
    try {
      const parsed = JSON.parse(rawValue) as unknown;
      if (isPersistedLessonThreadStore(parsed)) {
        return normalizeStore(parsed);
      }
    } catch {
      return emptyStore();
    }
  }

  const legacyValue = storage.getItem(LEGACY_LESSON_THREAD_STORAGE_KEY);
  if (!legacyValue) {
    return emptyStore();
  }

  try {
    const parsed = JSON.parse(legacyValue) as unknown;
    if (parsed && typeof parsed === "object") {
      const candidate = parsed as Partial<PersistedLessonThread>;
      if (
        candidate.version === 1 &&
        typeof candidate.avatarProviderId === "string" &&
        typeof candidate.gradeBand === "string" &&
        typeof candidate.llmModel === "string" &&
        typeof candidate.llmProvider === "string" &&
        typeof candidate.preference === "string" &&
        typeof candidate.studentPrompt === "string" &&
        typeof candidate.subject === "string" &&
        typeof candidate.ttsModel === "string" &&
        typeof candidate.ttsProvider === "string" &&
        typeof candidate.transcript === "string" &&
        typeof candidate.tutorText === "string" &&
        Array.isArray(candidate.conversation)
      ) {
        return {
          activeThread: {
            avatarProviderId: candidate.avatarProviderId,
            conversation: candidate.conversation as PersistedConversationTurn[],
            gradeBand: candidate.gradeBand,
            llmModel: typeof candidate.llmModel === "string" ? candidate.llmModel : DEFAULT_LLM_MODEL,
            llmProvider: typeof candidate.llmProvider === "string" ? candidate.llmProvider : DEFAULT_LLM_PROVIDER,
            preference: candidate.preference,
            sessionId: typeof candidate.sessionId === "string" ? candidate.sessionId : generateLessonSessionId(),
            studentPrompt: candidate.studentPrompt,
            subject: candidate.subject,
            ttsModel: typeof candidate.ttsModel === "string" ? candidate.ttsModel : DEFAULT_TTS_MODEL,
            ttsProvider: typeof candidate.ttsProvider === "string" ? candidate.ttsProvider : DEFAULT_TTS_PROVIDER,
            transcript: candidate.transcript,
            tutorText: candidate.tutorText,
            version: 1,
          },
          archive: [],
          version: 2,
        };
      }
    }
    if (isPersistedLessonThread(parsed)) {
      return {
        activeThread: parsed,
        archive: [],
        version: 2,
      };
    }
  } catch {
    return emptyStore();
  }

  return emptyStore();
}

function buildArchiveEntry(thread: PersistedLessonThread): PersistedLessonArchiveEntry {
  return {
    gradeBand: thread.gradeBand,
    id: `lesson-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subject: thread.subject,
    thread,
    title: buildLessonTitle(thread),
    turnCount: thread.conversation.length,
    updatedAt: new Date().toISOString(),
  };
}

export function listArchivedLessonThreads(): PersistedLessonSummary[] {
  return readStore().archive.map(({ thread: _thread, ...summary }) => summary);
}

export function readArchivedLessonThread(id: string): PersistedLessonThread | null {
  return readStore().archive.find((entry) => entry.id === id)?.thread ?? null;
}

export function readPersistedLessonThread(): PersistedLessonThread | null {
  return readStore().activeThread;
}

export function writePersistedLessonThread(thread: PersistedLessonThread) {
  const store = readStore();
  store.activeThread = thread;
  writeStore(store);
}

export function archivePersistedLessonThread(thread: PersistedLessonThread) {
  if (!hasLessonContent(thread)) {
    return listArchivedLessonThreads();
  }

  const store = readStore();
  const nextEntry = buildArchiveEntry(thread);
  store.archive = [nextEntry, ...store.archive].slice(0, MAX_ARCHIVED_THREADS);
  writeStore(store);
  return store.archive.map(({ thread: _thread, ...summary }) => summary);
}

export function clearPersistedLessonThread() {
  const store = readStore();
  store.activeThread = null;
  writeStore(store);
}

export async function hydrateLessonThreadStore() {
  const firebaseStore = await fetchFirebaseLessonStore().catch(() => null);
  if (firebaseStore && isPersistedLessonThreadStore(firebaseStore)) {
    writeStore(firebaseStore);
    return firebaseStore;
  }

  const remoteStore = await fetchLessonStore();
  if (remoteStore && isPersistedLessonThreadStore(remoteStore)) {
    writeStore(remoteStore);
    return remoteStore;
  }

  return readStore();
}

export async function persistActiveLessonThread(thread: PersistedLessonThread) {
  writePersistedLessonThread(thread);
  const localStore = readStore();
  const firebaseStore = await saveFirebaseActiveLessonThread(thread, localStore).catch(() => null);
  if (firebaseStore && isPersistedLessonThreadStore(firebaseStore)) {
    writeStore(firebaseStore);
    return;
  }

  const remoteStore = await saveActiveLessonThread(thread);
  if (remoteStore && isPersistedLessonThreadStore(remoteStore)) {
    writeStore(remoteStore);
  }
}

export async function persistArchivedLessonThread(thread: PersistedLessonThread) {
  const store = readStore();
  const nextEntry = buildArchiveEntry(thread);
  store.archive = [nextEntry, ...store.archive].slice(0, MAX_ARCHIVED_THREADS);
  writeStore(store);

  const firebaseStore = await archiveFirebaseLessonThread(nextEntry, store).catch(() => null);
  if (firebaseStore && isPersistedLessonThreadStore(firebaseStore)) {
    writeStore(firebaseStore);
    return firebaseStore.archive.map(({ thread: _thread, ...summary }) => summary);
  }

  const remoteStore = await archiveRemoteLessonThread(nextEntry);
  if (remoteStore && isPersistedLessonThreadStore(remoteStore)) {
    writeStore(remoteStore);
    return remoteStore.archive.map(({ thread: _thread, ...summary }) => summary);
  }

  return store.archive.map(({ thread: _thread, ...summary }) => summary);
}

export async function clearPersistedLessonThreadRemote() {
  clearPersistedLessonThread();
  const localStore = readStore();
  const firebaseStore = await clearFirebaseActiveLessonThread(localStore).catch(() => null);
  if (firebaseStore && isPersistedLessonThreadStore(firebaseStore)) {
    writeStore(firebaseStore);
    return;
  }

  const remoteStore = await clearRemoteActiveLessonThread();
  if (remoteStore && isPersistedLessonThreadStore(remoteStore)) {
    writeStore(remoteStore);
  }
}

export async function refreshArchivedLessonThread(id: string) {
  const firebaseThread = await fetchFirebaseArchivedLessonThread(id).catch(() => null);
  if (firebaseThread) {
    const store = readStore();
    const entryIndex = store.archive.findIndex((entry) => entry.id === id);
    if (entryIndex >= 0) {
      store.archive[entryIndex] = {
        ...store.archive[entryIndex],
        thread: firebaseThread,
      };
      writeStore(store);
    }

    return firebaseThread;
  }

  const thread = await fetchArchivedLessonThread(id);
  if (!thread) {
    return readArchivedLessonThread(id);
  }

  const store = readStore();
  const entryIndex = store.archive.findIndex((entry) => entry.id === id);
  if (entryIndex >= 0) {
    store.archive[entryIndex] = {
      ...store.archive[entryIndex],
      thread,
    };
    writeStore(store);
  }

  return thread;
}
