"use client";

import React from "react";
import { useEffect, useState } from "react";

import { PlaybackController } from "../lib/playback_controller";

type AudioPlayerProps = {
  controller: PlaybackController;
};

export function AudioPlayer({ controller }: AudioPlayerProps) {
  const [state, setState] = useState(controller.state);

  useEffect(() => controller.subscribe(setState), [controller]);

  function interrupt() {
    controller.interrupt();
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <h3>Audio</h3>
        <span className="status-pill">{state}</span>
      </div>
      <button className="ghost-button" onClick={interrupt} type="button">
        Interrupt Audio
      </button>
    </div>
  );
}
