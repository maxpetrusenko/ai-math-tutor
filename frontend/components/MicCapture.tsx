"use client";

import React from "react";

type MicCaptureProps = {
  active: boolean;
  supported?: boolean;
  error?: string;
  onToggle: () => void;
};

export function MicCapture({ active, supported = true, error = "", onToggle }: MicCaptureProps) {
  const label = !supported ? "unsupported" : error ? "error" : active ? "live" : "ready";

  return (
    <div className="panel">
      <div className="panel__header">
        <h3>Mic</h3>
        <span className={`status-pill ${active ? "status-pill--live" : ""}`}>
          {label}
        </span>
      </div>
      <button
        className="primary-button"
        disabled={!supported}
        onClick={onToggle}
        type="button"
      >
        {active ? "Stop Mic" : "Arm Mic"}
      </button>
      {error ? <p className="error-text">{error}</p> : null}
    </div>
  );
}
