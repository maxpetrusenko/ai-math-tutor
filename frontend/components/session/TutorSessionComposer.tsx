import React from "react";

import type { LessonState } from "../../lib/lesson_catalog";
import { LessonBriefCard } from "./LessonBriefCard";

type TutorSessionComposerProps = {
  error: string;
  lessonQuestion: string | null;
  lessonState: LessonState | null;
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
  onSend: () => void;
  promptInputRef: React.RefObject<HTMLInputElement | null>;
  runtimeReady: boolean;
  studentPrompt: string;
  supportStyle: string;
};

export function TutorSessionComposer({
  error,
  lessonQuestion,
  lessonState,
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
  onSend,
  promptInputRef,
  runtimeReady,
  studentPrompt,
  supportStyle,
}: TutorSessionComposerProps) {
  return (
    <section className="session-panel session-panel--prompt">
      <div className="session-panel__body session-panel__body--prompt">
        {lessonState ? (
          <LessonBriefCard
            lessonQuestion={lessonQuestion ?? ""}
            lessonState={lessonState}
            supportStyle={supportStyle}
          />
        ) : null}

        <div className="session-composer">
          <button
            aria-label={micActive ? "Release to send" : "Hold to talk"}
            className={`mic-button ${micActive ? "mic-button--live" : ""}`}
            disabled={!runtimeReady || !micSupported || micInputBlocked}
            onBlur={onMicBlur}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onLostPointerCapture={onMicPointerCancel}
            onMouseDown={onMicMouseDown}
            onMouseUp={onMicMouseUp}
            onPointerCancel={onMicPointerCancel}
            onPointerDown={onMicPointerDown}
            onPointerUp={onMicPointerUp}
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
        </div>

        {error ? <p className="composer-stage__error" role="alert">{error}</p> : null}
        <p className="composer-stage__hint">
          Hold mic to talk · Cmd+Enter to send · Esc to interrupt
        </p>
      </div>
    </section>
  );
}
