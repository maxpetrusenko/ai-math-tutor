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
      let finished = false;
      let started = false;
      const audio = new Audio(
        `data:${snapshot.activeItem.audioMimeType ?? "audio/wav"};base64,${snapshot.activeItem.audioBase64}`
      );
      const finishPlayback = () => {
        if (finished) {
          return;
        }
        finished = true;
        snapshot.activeItem?.onPlaybackComplete?.();
        controller.completeActive(snapshot.activeItem?.id);
      };
      const markPlaybackStarted = () => {
        if (started) {
          return;
        }
        started = true;
        snapshot.activeItem?.onPlaybackStart?.();
      };
      audio.volume = volume;
      audio.onended = finishPlayback;
      audio.onerror = finishPlayback;
      audio.onplaying = markPlaybackStarted;
      audioRef.current = audio;
      spokenItemIdRef.current = snapshot.activeItem.id;
      void audio.play()
        .then(() => {
          markPlaybackStarted();
        })
        .catch(() => {
          audioRef.current = null;
          finishPlayback();
        });

      return () => {
        audio.pause();
        audio.onended = null;
        audio.onerror = null;
        audio.onplaying = null;
        audioRef.current = null;
      };
    }

    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      controller.completeActive(snapshot.activeItem.id);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(snapshot.activeItem.text);
    utterance.volume = volume;
    utterance.onstart = () => {
      snapshot.activeItem?.onPlaybackStart?.();
    };
    utterance.onend = () => {
      snapshot.activeItem?.onPlaybackComplete?.();
      controller.completeActive(snapshot.activeItem?.id);
    };
    utterance.onerror = () => {
      snapshot.activeItem?.onPlaybackComplete?.();
      controller.completeActive(snapshot.activeItem?.id);
    };
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
  }, [controller, snapshot, volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    if (utteranceRef.current) {
      utteranceRef.current.volume = volume;
    }
  }, [volume]);

  if (variant === "hidden") {
    return null;
  }

  const controls = (
    <>
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
