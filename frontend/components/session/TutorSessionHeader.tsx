"use client";

import React from "react";

type TutorSessionHeaderProps = {
  connectionState: string;
  gradeBand: string;
  historyOpen: boolean;
  lessonTitle?: string | null;
  onResetLesson: () => void;
  onToggleHistory: () => void;
  selectedAvatarLabel: string;
  selectedAvatarPersona: string;
  sessionSubtitle: string;
  subjectLabel: string;
};

export function TutorSessionHeader({
  connectionState,
  gradeBand,
  historyOpen,
  lessonTitle,
  onResetLesson,
  onToggleHistory,
  selectedAvatarLabel,
  selectedAvatarPersona,
  sessionSubtitle,
  subjectLabel,
}: TutorSessionHeaderProps) {
  return (
    <header className="session-hub__header">
      <div className="session-hub__identity">
        <div className="session-hub__identity-mark">
          AI
        </div>
        <div>
          <h1 className="session-hub__title">AI Tutor</h1>
          <p className="session-hub__subtitle">{sessionSubtitle}</p>
          <div className="session-hub__meta">
            <span className="session-hub__meta-chip">{selectedAvatarLabel}</span>
            <span className="session-hub__meta-chip">{selectedAvatarPersona}</span>
            <span className="session-hub__meta-chip">{subjectLabel}</span>
            <span className="session-hub__meta-chip">Grade {gradeBand}</span>
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
        <button
          aria-label="New Lesson"
          className="secondary-button"
          onClick={onResetLesson}
          type="button"
        >
          New
        </button>
        <button
          aria-controls="history-drawer"
          aria-expanded={historyOpen}
          aria-label="Toggle history"
          className="secondary-button session-hub__history-button"
          onClick={onToggleHistory}
          type="button"
        >
          History
        </button>
      </div>
    </header>
  );
}
