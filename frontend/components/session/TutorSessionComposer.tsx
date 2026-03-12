import React from "react";

import type { ManagedAvatarSessionSnapshot } from "../ManagedAvatarSession";
import type { LessonState } from "../../lib/lesson_catalog";
import { LessonBriefCard } from "./LessonBriefCard";

type TutorSessionComposerProps = {
  error: string;
  isManagedAvatar?: boolean;
  lessonQuestion: string | null;
  lessonState: LessonState | null;
  managedSession?: ManagedAvatarSessionSnapshot | null;
  micActive: boolean;
  micInputBlocked: boolean;
  micSupported: boolean;
  onInputChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onKeyUp: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onMicBlur: (event: React.FocusEvent<HTMLButtonElement>) => void;
  onMicMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMicMouseUp: () => void;
  onMicPointerCancel: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onMicPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onMicPointerUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onManagedLeave?: () => void;
  onManagedMicToggle?: () => void;
  onManagedPressEnd?: () => void;
  onManagedPressStart?: () => void;
  onManagedStart?: () => void;
  onSend: () => void;
  promptInputRef: React.RefObject<HTMLInputElement | null>;
  runtimeReady: boolean;
  studentPrompt: string;
  supportStyle: string;
};

export function TutorSessionComposer({
  error,
  isManagedAvatar = false,
  lessonQuestion,
  lessonState,
  managedSession = null,
  micActive,
  micInputBlocked,
  micSupported,
  onInputChange,
  onKeyDown,
  onKeyUp,
  onMicBlur,
  onMicMouseDown,
  onMicMouseUp,
  onMicPointerCancel,
  onMicPointerDown,
  onMicPointerUp,
  onManagedLeave,
  onManagedMicToggle,
  onManagedPressEnd,
  onManagedPressStart,
  onManagedStart,
  onSend,
  promptInputRef,
  runtimeReady,
  studentPrompt,
  supportStyle,
}: TutorSessionComposerProps) {
  const managedPrimaryLabel =
    managedSession?.connectionState === "connected"
      ? "Reconnect"
      : managedSession?.connectionState === "connecting"
        ? "Connecting..."
        : "Start avatar";
  const dockHint = isManagedAvatar
    ? managedSession?.micUnavailable
      ? "Mic unavailable. Reconnect mic permission, then hold to talk. Auto disconnect after 60s idle."
      : "Hold to talk. Send text anytime. Managed rooms auto disconnect after 60 seconds of inactivity."
    : "Hold mic to talk. Cmd+Enter sends text. Esc interrupts.";
  const managedStatus = managedSession?.roomName
    ? `Room ${managedSession.roomName}${managedSession.hasVideoTrack ? "" : " · waiting for video"}`
    : managedSession?.micEnabled
      ? "Mic open"
      : managedSession?.connectionState === "connected"
        ? "Live"
        : "Ready";
  const dockMicActive = isManagedAvatar ? Boolean(managedSession?.micEnabled) : micActive;
  const micButtonDisabled = isManagedAvatar
    ? !managedSession || !managedSession.hasVideoTrack || managedSession.micBusy
    : !runtimeReady || !micSupported || micInputBlocked;

  return (
    <section className="session-panel session-panel--prompt">
      <div className="session-panel__body session-panel__body--prompt">
        <div className="session-composer-dock">
          <div className="session-composer">
            <button
              aria-label={dockMicActive ? "Release to send" : "Hold to talk"}
              className={`mic-button ${dockMicActive ? "mic-button--live" : ""}`}
              disabled={micButtonDisabled}
              onBlur={isManagedAvatar ? undefined : onMicBlur}
              onKeyDown={isManagedAvatar ? undefined : onKeyDown}
              onKeyUp={isManagedAvatar ? undefined : onKeyUp}
              onLostPointerCapture={isManagedAvatar ? undefined : onMicPointerCancel}
              onMouseDown={isManagedAvatar ? onManagedPressStart : onMicMouseDown}
              onMouseUp={isManagedAvatar ? onManagedPressEnd : onMicMouseUp}
              onPointerCancel={isManagedAvatar ? undefined : onMicPointerCancel}
              onPointerDown={isManagedAvatar ? onManagedPressStart : onMicPointerDown}
              onPointerUp={isManagedAvatar ? onManagedPressEnd : onMicPointerUp}
              type="button"
            >
              <svg
                aria-hidden="true"
                className="mic-button__icon"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M12 15.5a3.5 3.5 0 0 0 3.5-3.5V7.5a3.5 3.5 0 1 0-7 0V12a3.5 3.5 0 0 0 3.5 3.5Z" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3M9 20h6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            <input
              aria-label="Student prompt"
              className="session-composer__input"
              disabled={!runtimeReady}
              onChange={(event) => onInputChange(event.target.value)}
              placeholder={lessonQuestion || "Ask a math question..."}
              ref={promptInputRef}
              type="text"
              value={studentPrompt}
            />

            <button
              aria-label="Send"
              className="send-button"
              disabled={!runtimeReady || !studentPrompt.trim() || micInputBlocked}
              onClick={onSend}
              type="button"
            >
              <svg
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>

            {isManagedAvatar ? (
              <div className="session-composer__actions">
                <button
                  className="secondary-button session-composer__pill session-composer__pill--primary"
                  disabled={!managedSession?.canStart}
                  onClick={onManagedStart}
                  type="button"
                >
                  {managedPrimaryLabel}
                </button>
                <button
                  className="secondary-button session-composer__pill"
                  disabled={!managedSession?.canToggleMic}
                  onClick={onManagedMicToggle}
                  type="button"
                >
                  {managedSession?.micEnabled ? "Pause mic" : "Open mic"}
                </button>
                <button
                  className="secondary-button session-composer__pill"
                  disabled={!managedSession?.canLeave}
                  onClick={onManagedLeave}
                  type="button"
                >
                  Leave
                </button>
                <div className="session-composer__meta">{managedStatus}</div>
              </div>
            ) : null}
          </div>
        </div>

        {lessonState ? (
          <LessonBriefCard
            lessonQuestion={lessonQuestion ?? ""}
            lessonState={lessonState}
            supportStyle={supportStyle}
          />
        ) : null}

        {error ? <p className="composer-stage__error" role="alert">{error}</p> : null}
        <p className="composer-stage__hint">
          {dockHint}
        </p>
      </div>
    </section>
  );
}
