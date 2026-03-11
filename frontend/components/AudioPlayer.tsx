"use client";

import React from "react";
import { useEffect, useRef, useState } from "react";

import { PlaybackController, type PlaybackSnapshot } from "../lib/playback_controller";

const AUDIO_PLAYER_LOG_PREFIX = "[AudioPlayer]";

function logAudioPlayerInfo(event: string, details: Record<string, unknown>) {
  console.info(AUDIO_PLAYER_LOG_PREFIX, event, details);
}

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
    const activeItem = snapshot.activeItem;
    logAudioPlayerInfo("playback.begin", {
      hasAudioBase64: Boolean(activeItem.audioBase64),
      itemId: activeItem.id,
      queueLength: snapshot.queueLength,
      text: activeItem.text,
      textLength: activeItem.text.length,
    });

    const startSpeechFallback = () => {
      if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
        return false;
      }

      const utterance = new SpeechSynthesisUtterance(activeItem.text);
      utterance.volume = volume;
      utterance.onstart = () => {
        logAudioPlayerInfo("playback.started", {
          itemId: activeItem.id,
          mode: "speech-synthesis-fallback",
          text: activeItem.text,
        });
        activeItem.onPlaybackStart?.();
      };
      utterance.onend = () => {
        logAudioPlayerInfo("playback.complete", {
          itemId: activeItem.id,
          mode: "speech-synthesis-fallback",
          text: activeItem.text,
        });
        activeItem.onPlaybackComplete?.();
        controller.completeActive(activeItem.id);
      };
      utterance.onerror = () => {
        logAudioPlayerInfo("playback.error", {
          itemId: activeItem.id,
          mode: "speech-synthesis-fallback",
          text: activeItem.text,
        });
        activeItem.onPlaybackComplete?.();
        controller.completeActive(activeItem.id);
      };
      utteranceRef.current = utterance;
      logAudioPlayerInfo("playback.fallback", {
        itemId: activeItem.id,
        mode: "speech-synthesis",
        reason: "provider-audio-unavailable",
      });
      window.speechSynthesis.speak(utterance);
      return true;
    };

    if (activeItem.audioBase64 && typeof Audio !== "undefined") {
      let finished = false;
      let started = false;
      const audio = new Audio(
        `data:${activeItem.audioMimeType ?? "audio/wav"};base64,${activeItem.audioBase64}`
      );
      const finishPlayback = () => {
        if (finished) {
          return;
        }
        finished = true;
        logAudioPlayerInfo("playback.complete", {
          itemId: activeItem.id,
          mode: "provider-audio",
          text: activeItem.text,
        });
        activeItem.onPlaybackComplete?.();
        controller.completeActive(activeItem.id);
      };
      const markPlaybackStarted = () => {
        if (started) {
          return;
        }
        started = true;
        logAudioPlayerInfo("playback.started", {
          itemId: activeItem.id,
          mode: "provider-audio",
          text: activeItem.text,
        });
        activeItem.onPlaybackStart?.();
      };
      audio.volume = volume;
      audio.onended = finishPlayback;
      audio.onerror = () => {
        logAudioPlayerInfo("playback.error", {
          itemId: activeItem.id,
          mode: "provider-audio",
          text: activeItem.text,
        });
        audioRef.current = null;
        if (startSpeechFallback()) {
          return;
        }
        finishPlayback();
      };
      audio.onplaying = markPlaybackStarted;
      audioRef.current = audio;
      spokenItemIdRef.current = activeItem.id;
      void audio.play()
        .then(() => {
          markPlaybackStarted();
        })
        .catch(() => {
          audioRef.current = null;
          logAudioPlayerInfo("playback.play_rejected", {
            itemId: activeItem.id,
            mode: "provider-audio",
            text: activeItem.text,
          });
          if (startSpeechFallback()) {
            return;
          }
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
      controller.completeActive(activeItem.id);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(activeItem.text);
    utterance.volume = volume;
    utterance.onstart = () => {
      logAudioPlayerInfo("playback.started", {
        itemId: activeItem.id,
        mode: "speech-synthesis",
        text: activeItem.text,
      });
      activeItem.onPlaybackStart?.();
    };
    utterance.onend = () => {
      logAudioPlayerInfo("playback.complete", {
        itemId: activeItem.id,
        mode: "speech-synthesis",
        text: activeItem.text,
      });
      activeItem.onPlaybackComplete?.();
      controller.completeActive(activeItem.id);
    };
    utterance.onerror = () => {
      logAudioPlayerInfo("playback.error", {
        itemId: activeItem.id,
        mode: "speech-synthesis",
        text: activeItem.text,
      });
      activeItem.onPlaybackComplete?.();
      controller.completeActive(activeItem.id);
    };
    utteranceRef.current = utterance;
    spokenItemIdRef.current = activeItem.id;
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
