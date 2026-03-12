"use client";

import React from "react";

import { AudioPlayer } from "./AudioPlayer";
import { DashboardLayout } from "./layout";
import { TutorSessionComposer } from "./session/TutorSessionComposer";
import { TutorSessionAvatarStage } from "./session/TutorSessionAvatarStage";
import { TutorSessionHeader } from "./session/TutorSessionHeader";
import { TutorSessionHistoryDrawer } from "./session/TutorSessionHistoryDrawer";
import { createConfiguredTransport } from "./session/configured_transport";
import type {
  PlaybackMetricReport,
  SessionTransport,
  TutorSessionProps,
  TutorTurnRequest,
  TutorTurnResult,
} from "./session/session_types";
import { formatTutorSubject } from "./session/tutor_session_utils";
import { useTutorSessionController } from "./session/useTutorSessionController";

export type {
  PlaybackMetricReport,
  SessionTransport,
  TutorSessionProps,
  TutorTurnRequest,
  TutorTurnResult,
} from "./session/session_types";

export { createConfiguredTransport } from "./session/configured_transport";

export function TutorSession(props: TutorSessionProps) {
  const controller = useTutorSessionController(props);

  return (
    <DashboardLayout>
      <div className="session-hub" data-testid="tutor-layout">
        <AudioPlayer
          controller={controller.playbackController}
          initialVolume={controller.sessionDefaults.audioVolume}
          variant="hidden"
        />

        <TutorSessionHeader
          connectionState={controller.connectionState}
          gradeBand={controller.gradeBand}
          historyOpen={controller.historyOpen}
          lessonTitle={controller.lessonState?.lessonTitle}
          onResetLesson={() => void controller.resetLesson()}
          onToggleHistory={() => controller.setHistoryOpen((current) => !current)}
          selectedAvatarLabel={controller.selectedAvatarLabel}
          selectedAvatarPersona={controller.selectedAvatarPersona}
          sessionSubtitle={controller.sessionSubtitle}
          subjectLabel={formatTutorSubject(controller.subject)}
        />

        <div className={`session-main ${controller.isManagedAvatar && !controller.lessonState ? "session-main--managed" : ""}`.trim()}>
          <TutorSessionAvatarStage
            avatarConfig={controller.avatarConfig}
            avatarId={controller.avatarProviderId}
            avatarNowMs={controller.avatarNowMs}
            avatarState={controller.avatarState}
            energy={controller.playbackState === "speaking" ? 0.8 : controller.avatarState === "fading" ? 0.3 : 0.2}
            isManagedAvatar={controller.isManagedAvatar}
            lessonQuestion={controller.lessonQuestion}
            lessonState={controller.lessonState}
            selectedAvatar={controller.selectedAvatar}
            selectedAvatarLabel={controller.selectedAvatarLabel}
            timestamps={controller.timestamps}
            tutorText={controller.tutorText}
          />

          {controller.showPromptPanel ? (
            <TutorSessionComposer
              error={controller.error}
              lessonQuestion={controller.lessonQuestion}
              lessonState={controller.lessonState}
              micActive={controller.micActive}
              micInputBlocked={controller.micInputBlocked}
              micSupported={controller.micSupported}
              onInputChange={controller.setStudentPrompt}
              onKeyDown={controller.handleMicButtonKeyDown}
              onKeyUp={controller.handleMicButtonKeyUp}
              onMicBlur={controller.handleMicPressEnd}
              onMicMouseDown={controller.handleMicMouseDown}
              onMicMouseUp={controller.handleMicMouseUp}
              onMicPointerCancel={controller.handleMicPressEnd}
              onMicPointerDown={controller.handleMicPressStart}
              onMicPointerUp={controller.handleMicPressEnd}
              onSend={controller.runTextTurn}
              promptInputRef={controller.promptInputRef}
              runtimeReady={controller.runtimeReady}
              studentPrompt={controller.studentPrompt}
              supportStyle={controller.supportStyle}
            />
          ) : null}
        </div>

        <TutorSessionHistoryDrawer
          conversation={controller.conversation}
          historyOpen={controller.historyOpen}
          onClose={controller.closeHistoryDrawer}
          onResumeLesson={(lessonId) => {
            void controller.resumeLesson(lessonId);
            controller.closeHistoryDrawer();
          }}
          recentLessons={controller.recentLessons}
        />
      </div>
    </DashboardLayout>
  );
}
