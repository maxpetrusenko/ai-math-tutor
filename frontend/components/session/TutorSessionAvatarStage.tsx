import React from "react";

import { AvatarProvider } from "../AvatarProvider";
import { ManagedAvatarSession, type ManagedAvatarSessionHandle, type ManagedAvatarSessionSnapshot } from "../ManagedAvatarSession";
import type { AvatarConfig, AvatarSpeechCue, AvatarVisualState, WordTimestamp } from "../../lib/avatar_contract";
import type { LessonState } from "../../lib/lesson_catalog";

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
          <ManagedAvatarSession
            autoStart
            avatar={selectedAvatar}
            microphoneMode="off"
            onStateChange={onManagedSessionStateChange}
            ref={managedSessionRef}
          />
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
