"use client";

import React from "react";

import { AudioPlayer } from "./AudioPlayer";
import { DashboardLayout } from "./layout";
import type { ManagedAvatarSessionHandle, ManagedAvatarSessionSnapshot } from "./ManagedAvatarSession";
import { TutorSessionComposer } from "./session/TutorSessionComposer";
import { TutorSessionAvatarStage } from "./session/TutorSessionAvatarStage";
import { TutorSessionHistoryDrawer } from "./session/TutorSessionHistoryDrawer";
import { TutorSessionLogsDrawer } from "./session/TutorSessionLogsDrawer";
import { createConfiguredTransport } from "./session/configured_transport";
import {
  getSessionActivityLogSnapshot,
  subscribeSessionActivityLog,
  type SessionActivityLogEntry,
} from "../lib/session_activity_log";
import type {
  PlaybackMetricReport,
  SessionTransport,
  TutorSessionProps,
  TutorTurnRequest,
  TutorTurnResult,
} from "./session/session_types";
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
  const managedSessionRef = React.useRef<ManagedAvatarSessionHandle | null>(null);
  const [managedSession, setManagedSession] = React.useState<ManagedAvatarSessionSnapshot | null>(null);
  const [logsOpen, setLogsOpen] = React.useState(false);
  const [sessionLogEntries, setSessionLogEntries] = React.useState<SessionActivityLogEntry[]>(() => getSessionActivityLogSnapshot());

  React.useEffect(() => subscribeSessionActivityLog(setSessionLogEntries), []);

  function closeLogsDrawer() {
    if (typeof document === "undefined") {
      setLogsOpen(false);
      return;
    }
    const logsDrawer = document.getElementById("logs-drawer");
    const activeElement = document.activeElement;
    if (logsDrawer && activeElement instanceof HTMLElement && logsDrawer.contains(activeElement)) {
      activeElement.blur();
      controller.promptInputRef.current?.focus();
    }
    setLogsOpen(false);
  }

  function handlePromptChange(value: string) {
    managedSessionRef.current?.markActivity();
    controller.setStudentPrompt(value);
  }

  function handleSend() {
    managedSessionRef.current?.markActivity();
    controller.runTextTurn();
  }

  return (
    <DashboardLayout
      headerContext={{
        title: "Session",
        subtitle: controller.sessionSubtitle,
      }}
      headerActions={(
        <>
          <button
            aria-label="Start new session"
            className="icon-button"
            onClick={() => void controller.resetLesson()}
            type="button"
          >
            <svg aria-hidden="true" className="icon-button__icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            aria-controls="history-drawer"
            aria-expanded={controller.historyOpen}
            aria-label="Open session history"
            className={`icon-button ${controller.historyOpen ? "icon-button--active" : ""}`.trim()}
            onClick={() => {
              setLogsOpen(false);
              controller.setHistoryOpen((current) => !current);
            }}
            type="button"
          >
            <svg aria-hidden="true" className="icon-button__icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12a9 9 0 1 0 3-6.708" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 4v5h5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 7v5l3 3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            aria-controls="logs-drawer"
            aria-expanded={logsOpen}
            aria-label="Open session logs"
            className={`icon-button ${logsOpen ? "icon-button--active" : ""}`.trim()}
            onClick={() => {
              controller.setHistoryOpen(false);
              setLogsOpen((current) => !current);
            }}
            type="button"
          >
            <svg aria-hidden="true" className="icon-button__icon" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </>
      )}
    >
      <div className="session-hub" data-testid="tutor-layout">
        <AudioPlayer
          controller={controller.playbackController}
          initialVolume={controller.sessionDefaults.audioVolume}
          variant="hidden"
        />

        <div className="session-main">
          <TutorSessionAvatarStage
            avatarConfig={controller.avatarConfig}
            avatarId={controller.avatarProviderId}
            avatarNowMs={controller.avatarNowMs}
            avatarState={controller.avatarState}
            energy={controller.playbackState === "speaking" ? 0.8 : controller.avatarState === "fading" ? 0.3 : 0.2}
            isManagedAvatar={controller.isManagedAvatar}
            lessonQuestion={controller.lessonQuestion}
            lessonState={controller.lessonState}
            managedSessionRef={managedSessionRef}
            onManagedSessionStateChange={setManagedSession}
            selectedAvatar={controller.selectedAvatar}
            timestamps={controller.timestamps}
            tutorText={controller.tutorText}
          />
        </div>

        {controller.showPromptPanel ? (
          <TutorSessionComposer
            error={controller.error}
            isManagedAvatar={controller.isManagedAvatar}
            lessonQuestion={controller.lessonQuestion}
            lessonState={controller.lessonState}
            managedSession={managedSession}
            micActive={controller.micActive}
            micInputBlocked={controller.micInputBlocked}
            micSupported={controller.micSupported}
            onInputChange={handlePromptChange}
            onKeyDown={controller.handleMicButtonKeyDown}
            onKeyUp={controller.handleMicButtonKeyUp}
            onManagedLeave={() => {
              managedSessionRef.current?.markActivity();
              void managedSessionRef.current?.disconnect();
            }}
            onManagedMicToggle={() => {
              managedSessionRef.current?.markActivity();
              void managedSessionRef.current?.toggleMicrophone();
            }}
            onManagedPressEnd={() => managedSessionRef.current?.endHoldToTalk()}
            onManagedPressStart={() => managedSessionRef.current?.beginHoldToTalk()}
            onManagedStart={() => {
              managedSessionRef.current?.markActivity();
              void managedSessionRef.current?.start();
            }}
            onMicBlur={controller.handleMicPressEnd}
            onMicMouseDown={controller.handleMicMouseDown}
            onMicMouseUp={controller.handleMicMouseUp}
            onMicPointerCancel={controller.handleMicPressEnd}
            onMicPointerDown={controller.handleMicPressStart}
            onMicPointerUp={controller.handleMicPressEnd}
            onSend={handleSend}
            promptInputRef={controller.promptInputRef}
            runtimeReady={controller.runtimeReady}
            studentPrompt={controller.studentPrompt}
            supportStyle={controller.supportStyle}
          />
        ) : null}

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

        <TutorSessionLogsDrawer
          entries={sessionLogEntries}
          logsOpen={logsOpen}
          onClose={closeLogsDrawer}
        />
      </div>
    </DashboardLayout>
  );
}
