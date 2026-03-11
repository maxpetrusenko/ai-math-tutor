"use client";

import React from "react";

import type { PersistedLessonSummary, PersistedTurnDebug } from "../lib/lesson_thread_store";

export type LessonConversationTurn = {
  debug?: PersistedTurnDebug;
  id: string;
  transcript: string;
  tutorText: string;
};

function resolveConversationKey(turn: LessonConversationTurn, index: number): string {
  return `${turn.id}-${index}`;
}

type LessonThreadPanelsProps = {
  conversation: LessonConversationTurn[];
  recentLessons: PersistedLessonSummary[];
  onResumeLesson: (lessonId: string) => void;
};

export function LessonThreadPanels({
  conversation,
  recentLessons,
  onResumeLesson,
}: LessonThreadPanelsProps) {
  return (
    <div className="panel">
      <div className="panel__header">
        <h3>History</h3>
      </div>
      <div className="history-panel">
        <section className="history-panel__section">
          <div className="history-panel__section-header">
            <h4>Conversation ({conversation.length})</h4>
          </div>
          {conversation.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__text">Conversation history will appear here</p>
            </div>
          ) : (
            <div className="conversation-history" data-testid="conversation-history-panel">
              {conversation.map((turn, index) => (
                <div key={resolveConversationKey(turn, index)} className="conversation-turn">
                  <div className="conversation-turn__header">
                    <span className="conversation-turn__number">Turn {index + 1}</span>
                  </div>
                  <div className="conversation-turn__student">
                    <div className="conversation-turn__student-label">You said</div>
                    <p>{turn.transcript}</p>
                  </div>
                  <div className="conversation-turn__tutor">
                    <div className="conversation-turn__tutor-label">Tutor replied</div>
                    <p>{turn.tutorText}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="history-panel__section">
          <div className="history-panel__section-header">
            <h4>Previous lessons ({recentLessons.length})</h4>
          </div>
          {recentLessons.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__text">Previous lessons will appear after you start a new one</p>
            </div>
          ) : (
            <div className="stack">
              {recentLessons.map((lesson) => (
                <button
                  key={lesson.id}
                  className="ghost-button"
                  data-testid={`resume-lesson-${lesson.id}`}
                  onClick={() => onResumeLesson(lesson.id)}
                  style={{ alignItems: "flex-start", display: "flex", flexDirection: "column", textAlign: "left" }}
                  type="button"
                >
                  <strong>{lesson.title}</strong>
                  <span>{lesson.subject} · {lesson.gradeBand}</span>
                  <span>{lesson.turnCount} turn{lesson.turnCount === 1 ? "" : "s"}</span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
