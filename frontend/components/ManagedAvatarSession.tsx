"use client";

import React, { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { createLiveKitAvatarSession } from "../lib/livekit_avatar_session";

type ManagedAvatar = {
  id: string;
  label: string;
  description?: string;
};

type ManagedAvatarSessionProps = {
  avatar: ManagedAvatar;
  autoStart?: boolean;
  microphoneMode?: "auto" | "off";
  variant?: "session" | "preview";
};

type ConnectionState = "idle" | "connecting" | "connected" | "error";
const REMOTE_VIDEO_TIMEOUT_MS = 12000;

function statusLabel(connectionState: ConnectionState) {
  switch (connectionState) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Live";
    case "error":
      return "Issue";
    default:
      return "Ready";
  }
}

function splitErrorDetails(error: string) {
  return error
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function startMediaPlayback(element: HTMLMediaElement) {
  try {
    const playback = element.play();
    if (playback && typeof playback.catch === "function") {
      void playback.catch(() => undefined);
    }
  } catch {
    // Ignore autoplay failures. The track can still render once the browser allows playback.
  }
}

function remoteVideoTimeoutMessage(avatar: ManagedAvatar) {
  if (avatar.id.startsWith("simli-")) {
    return "Simli did not publish video in time.; The provider may be rate-limited. Retry in about a minute.";
  }

  return "The avatar did not publish video in time.; Retry in a moment.";
}

export function ManagedAvatarSession({
  avatar,
  autoStart = false,
  microphoneMode = "auto",
  variant = "session",
}: ManagedAvatarSessionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("");
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const errorDisconnectRef = useRef(false);
  const remoteVideoTimeoutRef = useRef<number | null>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const audioHostRef = useRef<HTMLDivElement>(null);
  const autoStartRef = useRef(false);

  function clearRemoteVideoTimeout() {
    if (remoteVideoTimeoutRef.current !== null) {
      window.clearTimeout(remoteVideoTimeoutRef.current);
      remoteVideoTimeoutRef.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearRemoteVideoTimeout();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    autoStartRef.current = false;
  }, [avatar.id]);

  async function disconnectRoom() {
    clearRemoteVideoTimeout();
    errorDisconnectRef.current = false;
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (videoFrameRef.current) {
      videoFrameRef.current.innerHTML = "";
    }
    if (audioHostRef.current) {
      audioHostRef.current.innerHTML = "";
    }
    setConnectionState("idle");
    setRoomName("");
    setHasVideoTrack(false);
    setMicUnavailable(false);
  }

  function attachTrack(track: Track) {
    if (track.kind === Track.Kind.Video && videoFrameRef.current) {
      clearRemoteVideoTimeout();
      videoFrameRef.current.innerHTML = "";
      const element = track.attach();
      element.setAttribute("playsinline", "true");
      element.className = "managed-avatar-session__media";
      videoFrameRef.current.appendChild(element);
      if (element instanceof HTMLMediaElement) {
        startMediaPlayback(element);
      }
      setHasVideoTrack(true);
      setConnectionState("connected");
      return;
    }

    if (track.kind === Track.Kind.Audio && audioHostRef.current) {
      const element = track.attach();
      element.autoplay = true;
      if (element instanceof HTMLMediaElement) {
        startMediaPlayback(element);
      }
      audioHostRef.current.innerHTML = "";
      audioHostRef.current.appendChild(element);
    }
  }

  async function startSession() {
    if (roomRef.current) {
      await disconnectRoom();
    }

    setError("");
    setConnectionState("connecting");
    setMicUnavailable(false);

    try {
      const bootstrap = await createLiveKitAvatarSession(avatar.id, "Student");
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachTrack(track);
      });

      room.on(RoomEvent.Disconnected, () => {
        clearRemoteVideoTimeout();
        if (errorDisconnectRef.current) {
          errorDisconnectRef.current = false;
          return;
        }
        setConnectionState("idle");
        setHasVideoTrack(false);
      });

      await room.connect(bootstrap.url, bootstrap.token);
      setRoomName(bootstrap.room_name);

      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.track) {
            attachTrack(publication.track);
          }
        }
      }

      if (microphoneMode === "auto") {
        try {
          await room.localParticipant.setMicrophoneEnabled(true);
        } catch {
          setMicUnavailable(true);
        }
      }
      if (videoFrameRef.current?.childElementCount) {
        setConnectionState("connected");
        return;
      }
      remoteVideoTimeoutRef.current = window.setTimeout(() => {
        if (!roomRef.current) {
          return;
        }
        errorDisconnectRef.current = true;
        roomRef.current.disconnect();
        roomRef.current = null;
        setConnectionState("error");
        setHasVideoTrack(false);
        setError(remoteVideoTimeoutMessage(avatar));
      }, REMOTE_VIDEO_TIMEOUT_MS);
    } catch (sessionError) {
      clearRemoteVideoTimeout();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setConnectionState("error");
      setHasVideoTrack(false);
      setError(sessionError instanceof Error ? sessionError.message : "Could not connect the managed avatar.");
    }
  }

  useEffect(() => {
    if (!autoStart || autoStartRef.current || connectionState !== "idle") {
      return;
    }
    autoStartRef.current = true;
    void startSession();
  }, [autoStart, connectionState, avatar.id]);

  const errorItems = splitErrorDetails(error);
  const showPlaceholder = !hasVideoTrack;
  const currentStatusLabel = statusLabel(connectionState);
  const isPreview = variant === "preview";
  const primaryActionLabel =
    connectionState === "connected"
      ? "Reconnect"
      : connectionState === "connecting"
        ? "Connecting..."
        : "Start avatar";
  const railCaption = roomName
    ? `Room ${roomName}`
    : micUnavailable
      ? "Mic off"
      : connectionState === "connected"
        ? "Video live"
        : "Join when ready";

  return (
    <div
      className={`managed-avatar-session managed-avatar-session--${variant}`}
      data-testid="managed-avatar-session"
    >
      <div className="managed-avatar-session__stage">
        <div className="managed-avatar-session__topbar">
          <div className="managed-avatar-session__chip">{avatar.label}</div>
          <div className={`managed-avatar-session__badge managed-avatar-session__badge--${connectionState}`}>
            {currentStatusLabel}
          </div>
        </div>
        <div className="managed-avatar-session__screen">
          <div className="managed-avatar-session__video-frame" ref={videoFrameRef} />
          {showPlaceholder ? (
            <div className="managed-avatar-session__placeholder">
              <div className="managed-avatar-session__placeholder-copy">
                <h3>{avatar.label}</h3>
                <p>{avatar.description ?? "Live avatar stage."}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {!isPreview ? (
        <div className="managed-avatar-session__rail">
          <div className="managed-avatar-session__actions">
            <button
              className="secondary-button"
              disabled={connectionState === "connecting"}
              onClick={() => void startSession()}
              type="button"
            >
              {primaryActionLabel}
            </button>
            <button
              className="secondary-button"
              disabled={connectionState === "connecting" || connectionState === "idle"}
              onClick={() => void disconnectRoom()}
              type="button"
            >
              Leave
            </button>
          </div>
          <div className="managed-avatar-session__facts">{railCaption}</div>
        </div>
      ) : null}
      {micUnavailable && !isPreview ? (
        <div className="managed-avatar-session__hint">Mic stayed off. Reconnect after allowing it.</div>
      ) : null}
      {errorItems.length > 0 ? (
        <div className="managed-avatar-session__error-card" role="alert">
          <div className="managed-avatar-session__error-title">Connection issue</div>
          <ul className="managed-avatar-session__error-list">
            {errorItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div ref={audioHostRef} />
    </div>
  );
}
