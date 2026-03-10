"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";

import { PlaybackController, type PlaybackSnapshot } from "../lib/playback_controller";

type AudioPlayerProps = {
  controller: PlaybackController;
  variant?: "panel" | "inline" | "hidden";
};

export function AudioPlayer({ controller, variant = "panel" }: AudioPlayerProps) {
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot>(controller.snapshot());
  const [volume, setVolume] = useState(1);
  const spokenItemIdRef = useRef<string | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => controller.subscribe(setSnapshot), [controller]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (snapshot.state !== "speaking" || !snapshot.activeItem) {
      audioRef.current?.pause();
      audioRef.current = null;
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      spokenItemIdRef.current = null;
      return;
    }

    if (spokenItemIdRef.current === snapshot.activeItem.id) {
      return;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    audioRef.current?.pause();
    audioRef.current = null;
    if (snapshot.activeItem.audioBase64 && typeof Audio !== "undefined") {
      const audio = new Audio(
        `data:${snapshot.activeItem.audioMimeType ?? "audio/wav"};base64,${snapshot.activeItem.audioBase64}`
      );
      audio.volume = volume;
      audioRef.current = audio;
      spokenItemIdRef.current = snapshot.activeItem.id;
      void audio.play().catch(() => {
        audioRef.current = null;
      });

      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }

    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(snapshot.activeItem.text);
    utterance.volume = volume;
    utteranceRef.current = utterance;
    spokenItemIdRef.current = snapshot.activeItem.id;
    window.speechSynthesis.speak(utterance);

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      utteranceRef.current = null;
    };
  }, [snapshot, volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (utteranceRef.current) {
      utteranceRef.current.volume = volume;
    }
  }, [volume]);

  function interrupt() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    controller.interrupt();
  }

  if (variant === "hidden") {
    return null;
  }

  const controls = (
    <>
      <button
        aria-label="Stop audio"
        className="secondary-button"
        disabled={snapshot.state === "idle"}
        onClick={interrupt}
        type="button"
      >
        Stop
      </button>
      <label className="audio-toolbar__volume">
        <span>Volume</span>
        <input
          aria-label="Volume"
          max="1"
          min="0"
          onChange={(event) => setVolume(Number(event.target.value))}
          step="0.05"
          type="range"
          value={volume}
        />
      </label>
    </>
  );

  if (variant === "inline") {
    return <div className="audio-toolbar">{controls}</div>;
  }

  return (
    <div className="panel">
      <div className="panel__header">
        <h3>Audio</h3>
        <span className="status-pill">{snapshot.state}</span>
      </div>
      <div className="audio-toolbar audio-toolbar--panel">{controls}</div>
    </div>
  );
}
