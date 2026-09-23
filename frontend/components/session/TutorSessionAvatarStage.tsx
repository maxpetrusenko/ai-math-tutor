import React from "react";

import { AvatarProvider } from "../AvatarProvider";
import type { ManagedAvatarSessionHandle, ManagedAvatarSessionSnapshot } from "../ManagedAvatarSession";
import type { AvatarConfig, AvatarSpeechCue, AvatarVisualState, WordTimestamp } from "../../lib/avatar_contract";
import type { LessonState } from "../../lib/lesson_catalog";

// ManagedAvatarSession is the only module that pulls in livekit-client
// (~107 kB gzip). Keep it behind React.lazy so the default local-avatar
// session path never downloads that chunk. React.lazy is used instead of
// next/dynamic because next/dynamic consumes the ref for its own `retry`
// handle and would break the imperative handle in managedSessionRef.
const ManagedAvatarSession = React.lazy(() =>
  import("../ManagedAvatarSession").then((mod) => ({ default: mod.ManagedAvatarSession }))
);

type TutorSessionAvatarStageProps = {
  audioEnergy?: number;
  avatarConfig: AvatarConfig | undefined;
  avatarId: string;
  avatarNowMs: number;
  avatarState: AvatarVisualState;
  energy: number;
  isManagedAvatar: boolean;
  lessonQuestion: string | null;
  lessonState: LessonState | null;
  managedSessionRef?: React.RefObject<ManagedAvatarSessionHandle | null>;
  onManagedSessionStateChange?: (snapshot: ManagedAvatarSessionSnapshot) => void;
  selectedAvatar: {
    id: string;
    kind: "local" | "managed";
    label: string;
    description?: string;
  } & Record<string, unknown>;
  speechCue: AvatarSpeechCue | null;
  timestamps: WordTimestamp[];
  tutorText: string;
};

export function TutorSessionAvatarStage({
  audioEnergy,
  avatarConfig,
  avatarId,
  avatarNowMs,
  avatarState,
  energy,
  isManagedAvatar,
  lessonQuestion,
  lessonState,
  managedSessionRef,
  onManagedSessionStateChange,
  selectedAvatar,
  speechCue,
  timestamps,
  tutorText,
}: TutorSessionAvatarStageProps) {
  const showWelcome =
    !tutorText && (Boolean(lessonState) || Boolean(lessonQuestion));

  return (
    <section
      className={`session-panel session-panel--avatar ${isManagedAvatar ? "session-panel--avatar-managed" : ""}`.trim()}
    >
      <div
        className={`session-panel__body session-panel__body--avatar ${
          isManagedAvatar ? "session-panel__body--avatar-managed" : ""
        }`.trim()}
      >
        {isManagedAvatar ? (
          <React.Suspense
            fallback={<div className="avatar-surface avatar-surface--managed avatar-surface--hero" />}
          >
            <ManagedAvatarSession
              autoStart
              avatar={selectedAvatar}
              microphoneMode="off"
              onStateChange={onManagedSessionStateChange}
              ref={managedSessionRef}
            />
          </React.Suspense>
        ) : (
          <AvatarProvider
            audioEnergy={audioEnergy}
            avatarId={avatarId}
            config={avatarConfig}
            controls={null}
            energy={energy}
            historyToggle={null}
            nowMs={avatarNowMs}
            speechCue={speechCue}
            state={avatarState}
            subtitle={tutorText}
            timestamps={timestamps}
            variant="hero"
          />
        )}
        {showWelcome ? (
          <div className="session-welcome">
            <div className="session-welcome__title">
              {lessonState ? lessonState.lessonTitle : "Ready for a new lesson?"}
            </div>
            <p className="session-welcome__copy">
              {lessonState ? `Current task: ${lessonState.currentTask}` : ""}
            </p>
            {lessonQuestion ? <p className="session-welcome__question">{lessonQuestion}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
