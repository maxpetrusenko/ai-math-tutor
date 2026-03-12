import React from "react";

import type { PersistedLessonSummary } from "../../lib/lesson_thread_store";
import { TurnDebugPanel } from "../TurnDebugPanel";
import type { LessonConversationTurn } from "../LessonThreadPanels";
import { resolveConversationKey } from "./tutor_session_utils";

type TutorSessionHistoryDrawerProps = {
  conversation: LessonConversationTurn[];
  historyOpen: boolean;
  onClose: () => void;
  onResumeLesson: (lessonId: string) => void;
  recentLessons: PersistedLessonSummary[];
};

export function TutorSessionHistoryDrawer({
  conversation,
  historyOpen,
  onClose,
  onResumeLesson,
  recentLessons,
}: TutorSessionHistoryDrawerProps) {
  return (
    <aside
      id="history-drawer"
      aria-hidden={!historyOpen}
      aria-labelledby="history-drawer-title"
      aria-modal="true"
      className={`history-drawer ${historyOpen ? "history-drawer--open" : ""}`}
      data-testid="history-drawer"
      role="dialog"
    >
      <div className="history-drawer__backdrop" onClick={onClose} />
      <div className="history-drawer__panel">
        <div className="history-drawer__header">
          <h2 className="history-drawer__title" id="history-drawer-title">History</h2>
          <button
            aria-label="Close history"
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="icon-button__icon"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="history-drawer__content">
          <section className="history-section">
            <h3 className="history-section__title">This conversation</h3>
            {conversation.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__text">Your conversation will appear here</p>
              </div>
            ) : (
              <div className="conversation-list" data-testid="conversation-history-panel">
                {conversation.map((turn, index) => (
                  <div key={resolveConversationKey(turn, index)} className="conversation-turn">
                    <div className="conversation-turn__header">
                      <span className="conversation-turn__number">{index + 1}</span>
                      <TurnDebugPanel debug={turn.debug} turnId={turn.id} />
                    </div>
                    <div className="conversation-turn__student">
                      <div className="conversation-turn__label">You</div>
                      <p>{turn.transcript}</p>
                    </div>
                    <div className="conversation-turn__tutor">
                      <div className="conversation-turn__label">Tutor</div>
                      <p>{turn.tutorText}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="history-section">
            <h3 className="history-section__title">Previous lessons</h3>
            {recentLessons.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__text">Past lessons appear after starting a new one</p>
              </div>
            ) : (
              <div className="lessons-list">
                {recentLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    className="lesson-card"
                    data-testid={`resume-lesson-${lesson.id}`}
                    onClick={() => onResumeLesson(lesson.id)}
                    type="button"
                  >
                    <div className="lesson-card__header">
                      <span className="lesson-card__subject">{lesson.subject}</span>
                      <span className="lesson-card__grade">{lesson.gradeBand}</span>
                    </div>
                    <div className="lesson-card__title">{lesson.title}</div>
                    <div className="lesson-card__meta">{lesson.turnCount} turn{lesson.turnCount === 1 ? "" : "s"}</div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </aside>
  );
}
