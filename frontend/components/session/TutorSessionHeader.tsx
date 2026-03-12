"use client";

import React from "react";

type TutorSessionHeaderProps = {
  connectionState: string;
  sessionBrainLabel?: string | null;
  lessonTitle?: string | null;
  onResetLesson: () => void;
  sessionSubtitle: string;
};

export function TutorSessionHeader({
  connectionState,
  lessonTitle,
  onResetLesson,
  sessionBrainLabel,
  sessionSubtitle,
}: TutorSessionHeaderProps) {
  return (
    <header className="session-hub__header">
        <div className="session-hub__identity">
          <div className="session-hub__identity-mark">
          NS
        </div>
        <div className="session-hub__identity-copy">
          <h1 className="session-hub__title">Session</h1>
          <p className="session-hub__subtitle">{sessionSubtitle}</p>
          <div className="session-hub__meta">
            {lessonTitle ? <span className="session-hub__meta-chip">{lessonTitle}</span> : null}
          </div>
        </div>
      </div>

      <div className="session-hub__status">
        <span className={`status-dot ${
          connectionState === "connected" || connectionState === "managed" ? "status-dot--online" :
          connectionState === "connecting" ? "status-dot--connecting" :
          "status-dot--offline"
        }`} />
        <span className="connection-status__text">{connectionState}</span>
        {sessionBrainLabel ? (
          <span
            className="session-hub__status-chip"
            title={sessionBrainLabel}
          >
            {sessionBrainLabel}
          </span>
        ) : null}
        <button
          aria-label="New Lesson"
          className="secondary-button"
          onClick={onResetLesson}
          type="button"
        >
          New
        </button>
      </div>
    </header>
  );
}
