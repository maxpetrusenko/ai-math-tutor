"use client";

import React, { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import type { AvatarProviderOption } from "./avatar_registry";
import { createLiveKitAvatarSession } from "../lib/livekit_avatar_session";

type ManagedAvatarSessionProps = {
  avatar: AvatarProviderOption;
};

type ConnectionState = "idle" | "connecting" | "connected" | "error";

function statusLabel(connectionState: ConnectionState) {
  switch (connectionState) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Live";
    case "error":
      return "Setup needed";
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

export function ManagedAvatarSession({ avatar }: ManagedAvatarSessionProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("");
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const audioHostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  async function disconnectRoom() {
    if (roomRef.current) {
      roomRef.current.disconnect();
      roomRef.current = null;
    }
    if (videoHostRef.current) {
      videoHostRef.current.innerHTML = "";
    }
    if (audioHostRef.current) {
      audioHostRef.current.innerHTML = "";
    }
    setConnectionState("idle");
    setRoomName("");
    setHasVideoTrack(false);
  }

  function attachTrack(track: Track) {
    if (track.kind === Track.Kind.Video && videoHostRef.current) {
      videoHostRef.current.innerHTML = "";
      const element = track.attach();
      element.setAttribute("playsinline", "true");
      element.className = "managed-avatar-session__media";
      videoHostRef.current.appendChild(element);
      setHasVideoTrack(true);
      return;
    }

    if (track.kind === Track.Kind.Audio && audioHostRef.current) {
      const element = track.attach();
      element.autoplay = true;
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

    try {
      const bootstrap = await createLiveKitAvatarSession(avatar.id, "Student");
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachTrack(track);
      });

      room.on(RoomEvent.Disconnected, () => {
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

      await room.localParticipant.setMicrophoneEnabled(true);
      setConnectionState("connected");
    } catch (sessionError) {
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setConnectionState("error");
      setHasVideoTrack(false);
      setError(sessionError instanceof Error ? sessionError.message : "Could not connect the managed avatar.");
    }
  }

  const errorItems = splitErrorDetails(error);
  const showPlaceholder = !hasVideoTrack;
  const currentStatusLabel = statusLabel(connectionState);

  return (
    <div className="managed-avatar-session" data-testid="managed-avatar-session">
      <div className="managed-avatar-session__stage" ref={videoHostRef}>
        <div className="managed-avatar-session__topbar">
          <div className="managed-avatar-session__chip">{avatar.label}</div>
          <div className={`managed-avatar-session__badge managed-avatar-session__badge--${connectionState}`}>
            {currentStatusLabel}
          </div>
        </div>
        {showPlaceholder ? (
          <div className="managed-avatar-session__placeholder">
            <div className="managed-avatar-session__placeholder-copy">
              <h3>{avatar.label}</h3>
              <p>{avatar.description ?? "Remote avatar published through LiveKit."}</p>
            </div>
          </div>
        ) : null}
      </div>
      <div className="managed-avatar-session__rail">
        <div className="managed-avatar-session__actions">
          <button
            className="secondary-button"
            disabled={connectionState === "connecting"}
            onClick={() => void startSession()}
            type="button"
          >
            {connectionState === "connected" ? "Reconnect Live" : connectionState === "connecting" ? "Connecting..." : "Start Live Session"}
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
        <div className="managed-avatar-session__facts">
          <div className="managed-avatar-session__meta">
            <span className="managed-avatar-session__meta-label">Status</span>
            <span>{currentStatusLabel}</span>
          </div>
          {roomName ? (
            <div className="managed-avatar-session__meta">
              <span className="managed-avatar-session__meta-label">Room</span>
              <span>{roomName}</span>
            </div>
          ) : (
            <div className="managed-avatar-session__meta">
              <span className="managed-avatar-session__meta-label">Flow</span>
              <span>Start, allow mic, talk</span>
            </div>
          )}
        </div>
      </div>
      {errorItems.length > 0 ? (
        <div className="managed-avatar-session__error-card" role="alert">
          <div className="managed-avatar-session__error-title">Managed avatar not ready</div>
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
