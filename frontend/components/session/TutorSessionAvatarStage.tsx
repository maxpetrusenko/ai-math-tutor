import React from "react";

import { AvatarProvider } from "../AvatarProvider";
import { ManagedAvatarSession } from "../ManagedAvatarSession";
import type { AvatarConfig, AvatarVisualState, WordTimestamp } from "../../lib/avatar_contract";
import type { LessonState } from "../../lib/lesson_catalog";

type TutorSessionAvatarStageProps = {
  avatarConfig: AvatarConfig | undefined;
  avatarId: string;
  avatarNowMs: number;
  avatarState: AvatarVisualState;
  energy: number;
  isManagedAvatar: boolean;
  lessonQuestion: string | null;
  lessonState: LessonState | null;
  selectedAvatarLabel: string;
  selectedAvatar: {
    id: string;
    kind: "local" | "managed";
    label: string;
    description?: string;
  } & Record<string, unknown>;
  timestamps: WordTimestamp[];
  tutorText: string;
};

export function TutorSessionAvatarStage({
  avatarConfig,
  avatarId,
  avatarNowMs,
  avatarState,
  energy,
  isManagedAvatar,
  lessonQuestion,
  lessonState,
  selectedAvatar,
  selectedAvatarLabel,
  timestamps,
  tutorText,
}: TutorSessionAvatarStageProps) {
  const showWelcome =
    !tutorText && (!isManagedAvatar || Boolean(lessonState) || Boolean(lessonQuestion));

  return (
    <section className="session-panel session-panel--avatar">
      <div className="session-panel__body session-panel__body--avatar">
        {isManagedAvatar ? (
          <ManagedAvatarSession avatar={selectedAvatar} />
        ) : (
          <AvatarProvider
            avatarId={avatarId}
            config={avatarConfig}
            controls={null}
            energy={energy}
            historyToggle={null}
            nowMs={avatarNowMs}
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
              {lessonState
                ? `Current task: ${lessonState.currentTask}`
                : isManagedAvatar
                  ? `Start live session, allow microphone, then talk with ${selectedAvatarLabel}.`
                  : `Ask ${selectedAvatarLabel} for an explanation, example, or guided solve.`}
            </p>
            {lessonQuestion ? <p className="session-welcome__question">{lessonQuestion}</p> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
