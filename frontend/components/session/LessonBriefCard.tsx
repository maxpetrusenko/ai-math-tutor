"use client";

import React from "react";

import type { LessonState } from "../../lib/lesson_catalog";

type LessonBriefCardProps = {
  lessonQuestion: string;
  lessonState: LessonState;
  supportStyle: string;
};

export function LessonBriefCard({
  lessonQuestion,
  lessonState,
  supportStyle,
}: LessonBriefCardProps) {
  const lessonStepCount = lessonState.program.length;

  return (
    <div className="lesson-brief" data-testid="lesson-brief">
      <div className="lesson-brief__header">
        <div>
          <div className="lesson-brief__eyebrow">Lesson</div>
          <div className="session-panel__title">{lessonState.lessonTitle}</div>
        </div>
        <div className="lesson-brief__step">
          Step {Math.min(lessonState.currentStepIndex + 1, lessonStepCount || 1)} of {lessonStepCount || 1}
        </div>
      </div>

      <div className="lesson-brief__task">
        <div className="lesson-brief__label">Current task</div>
        <p>{lessonState.currentTask}</p>
      </div>

      <div className="lesson-brief__program">
        {lessonState.program.map((step, index) => (
          <div
            className={`lesson-brief__program-step${
              index === lessonState.currentStepIndex ? " lesson-brief__program-step--active" : ""
            }`}
            key={`${lessonState.lessonId}-${step}`}
          >
            <span>{index + 1}</span>
            <p>{step}</p>
          </div>
        ))}
      </div>

      <div className="lesson-brief__question">
        <div className="lesson-brief__label">Next question</div>
        <p>{lessonQuestion}</p>
      </div>

      <div className="lesson-brief__support-grid">
        <div className="lesson-brief__support-card">
          <div className="lesson-brief__label">Tutor approach</div>
          <p>{supportStyle}</p>
        </div>
        <div className="lesson-brief__support-card">
          <div className="lesson-brief__label">Your next move</div>
          <p>{lessonQuestion ? "Answer the next question or hold the mic to talk it through." : "Type a question to keep the lesson moving."}</p>
        </div>
      </div>
    </div>
  );
}
