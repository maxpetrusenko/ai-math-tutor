"use client";

import React from "react";

import type { SessionActivityLogEntry } from "../../lib/session_activity_log";

type TutorSessionLogsDrawerProps = {
  entries: SessionActivityLogEntry[];
  logsOpen: boolean;
  onClose: () => void;
};

function formatLogTime(ts: string) {
  if (!ts) {
    return "now";
  }

  return new Date(ts).toLocaleTimeString();
}

export function TutorSessionLogsDrawer({
  entries,
  logsOpen,
  onClose,
}: TutorSessionLogsDrawerProps) {
  const orderedEntries = [...entries].reverse();

  return (
    <aside
      id="logs-drawer"
      aria-hidden={!logsOpen}
      aria-labelledby="logs-drawer-title"
      aria-modal="true"
      className={`history-drawer ${logsOpen ? "history-drawer--open" : ""}`}
      data-testid="logs-drawer"
      role="dialog"
    >
      <div className="history-drawer__backdrop" onClick={onClose} />
      <div className="history-drawer__panel history-drawer__panel--logs">
        <div className="history-drawer__header">
          <h2 className="history-drawer__title" id="logs-drawer-title">Logs</h2>
          <button
            aria-label="Close logs"
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
          {orderedEntries.length === 0 ? (
            <div className="empty-state">
              <p className="empty-state__text">Session events will appear here</p>
            </div>
          ) : (
            <div className="session-log-list" data-testid="session-log-list">
              {orderedEntries.map((entry) => (
                <details key={entry.id} className="session-log-entry">
                  <summary className="session-log-entry__summary">
                    <span className={`session-log-entry__level session-log-entry__level--${entry.level}`}>{entry.level}</span>
                    <span className="session-log-entry__scope">{entry.scope}</span>
                    <span className="session-log-entry__event">{entry.summary}</span>
                    <span className="session-log-entry__time">{formatLogTime(entry.ts)}</span>
                  </summary>
                  <div className="session-log-entry__details">
                    <div className="session-log-entry__meta">
                      <span>{entry.event}</span>
                      <span>{entry.ts}</span>
                    </div>
                    {entry.metadata ? (
                      <pre className="session-log-entry__payload">{JSON.stringify(entry.metadata, null, 2)}</pre>
                    ) : (
                      <p className="session-log-entry__empty">No extra payload.</p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
