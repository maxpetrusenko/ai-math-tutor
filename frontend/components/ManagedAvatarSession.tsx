"use client";

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";

import { createLiveKitAvatarSession } from "../lib/livekit_avatar_session";
import { appendSessionActivityLog } from "../lib/session_activity_log";

type ManagedAvatar = {
  id: string;
  label: string;
  description?: string;
};

type ManagedAvatarSessionProps = {
  avatar: ManagedAvatar;
  autoStart?: boolean;
  microphoneMode?: "auto" | "off" | "prime";
  onStateChange?: (snapshot: ManagedAvatarSessionSnapshot) => void;
  variant?: "session" | "preview";
};

type ConnectionState = "idle" | "connecting" | "connected" | "error";

const MANAGED_IDLE_TIMEOUT_MS = 60_000;
const REMOTE_VIDEO_TIMEOUT_MS = 12_000;

export type ManagedAvatarSessionSnapshot = {
  canLeave: boolean;
  canStart: boolean;
  canToggleMic: boolean;
  connectionState: ConnectionState;
  hasVideoTrack: boolean;
  micBusy: boolean;
  micEnabled: boolean;
  micUnavailable: boolean;
  roomName: string;
};

export type ManagedAvatarSessionHandle = {
  beginHoldToTalk: () => void;
  disconnect: () => Promise<void>;
  endHoldToTalk: () => void;
  markActivity: () => void;
  start: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
};

function statusLabel(connectionState: ConnectionState) {
  switch (connectionState) {
    case "connecting":
      return "Connecting";
    case "connected":
      return "Live";
    case "error":
      return "Retry";
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

function appendManagedAvatarLog(
  event: string,
  summary: string,
  metadata?: Record<string, unknown>,
  level: "info" | "warn" | "error" = "info"
) {
  appendSessionActivityLog({
    event,
    level,
    metadata,
    scope: "managed-avatar",
    summary,
  });
}

function remoteVideoTimeoutMessage(avatar: ManagedAvatar) {
  if (avatar.id.startsWith("simli-")) {
    return "Simli did not publish video in time.; The provider may be rate-limited. Retry in about a minute.";
  }

  return "The avatar did not publish video in time.; Retry in a moment.";
}

function placeholderLine(connectionState: ConnectionState, description?: string, roomName?: string) {
  if (connectionState === "connecting") {
    return roomName ? "Room live. Waiting for avatar video." : "Bringing the stage online.";
  }
  if (connectionState === "connected") {
    return "Video live.";
  }
  if (connectionState === "error") {
    return "Live link paused. Start avatar again.";
  }
  return description ?? "Live avatar stage.";
}

export const ManagedAvatarSession = forwardRef<ManagedAvatarSessionHandle, ManagedAvatarSessionProps>(function ManagedAvatarSession({
  avatar,
  autoStart = false,
  microphoneMode = "auto",
  onStateChange,
  variant = "session",
}, ref) {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [error, setError] = useState("");
  const [roomName, setRoomName] = useState("");
  const [hasVideoTrack, setHasVideoTrack] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micUnavailable, setMicUnavailable] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const errorDisconnectRef = useRef(false);
  const idleTimeoutRef = useRef<number | null>(null);
  const remoteVideoTimeoutRef = useRef<number | null>(null);
  const videoFrameRef = useRef<HTMLDivElement>(null);
  const audioHostRef = useRef<HTMLDivElement>(null);
  const autoStartRef = useRef(false);
  const pushToTalkRef = useRef(false);
  const pendingMicPrimeResetRef = useRef(false);
  const isPreview = variant === "preview";

  function clearRemoteVideoTimeout() {
    if (remoteVideoTimeoutRef.current !== null) {
      window.clearTimeout(remoteVideoTimeoutRef.current);
      remoteVideoTimeoutRef.current = null;
    }
  }

  function clearIdleTimeout() {
    if (idleTimeoutRef.current !== null) {
      window.clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
  }

  function canKeepRoomAlive() {
    return !isPreview && roomRef.current !== null;
  }

  function markActivity() {
    if (!canKeepRoomAlive()) {
      clearIdleTimeout();
      return;
    }

    clearIdleTimeout();
    idleTimeoutRef.current = window.setTimeout(() => {
      void disconnectRoom("idle");
    }, MANAGED_IDLE_TIMEOUT_MS);
  }

  function resetStageState(nextConnectionState: ConnectionState = "idle") {
    if (videoFrameRef.current) {
      videoFrameRef.current.innerHTML = "";
    }
    if (audioHostRef.current) {
      audioHostRef.current.innerHTML = "";
    }
    roomRef.current = null;
    pendingMicPrimeResetRef.current = false;
    pushToTalkRef.current = false;
    setConnectionState(nextConnectionState);
    setRoomName("");
    setHasVideoTrack(false);
    setMicEnabled(false);
    setMicUnavailable(false);
    setMicBusy(false);
  }

  async function disconnectRoom(reason: "manual" | "idle" = "manual") {
    clearRemoteVideoTimeout();
    clearIdleTimeout();
    errorDisconnectRef.current = false;
    if (roomRef.current) {
      roomRef.current.disconnect();
    }
    resetStageState("idle");
    if (reason === "idle") {
      setError("Disconnected after 60 seconds of inactivity.");
    }
  }

  async function setRoomMicrophoneEnabled(enabled: boolean, source: "manual" | "push" = "manual") {
    const room = roomRef.current;
    if (!room) {
      return;
    }

    setMicBusy(true);
    try {
      await room.localParticipant.setMicrophoneEnabled(
        enabled,
        enabled
          ? {
              autoGainControl: true,
              echoCancellation: true,
              noiseSuppression: true,
              voiceIsolation: true,
            }
          : undefined,
      );
      setMicEnabled(enabled);
      if (enabled) {
        setMicUnavailable(false);
      }
      if (enabled && source === "push" && !pushToTalkRef.current) {
        await room.localParticipant.setMicrophoneEnabled(false);
        setMicEnabled(false);
      }
      markActivity();
    } catch {
      setMicUnavailable(true);
      setMicEnabled(false);
    } finally {
      setMicBusy(false);
    }
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
      markActivity();
      appendManagedAvatarLog("video.attached", "remote video attached", { avatarId: avatar.id, roomName });
      if (pendingMicPrimeResetRef.current) {
        pendingMicPrimeResetRef.current = false;
        void setRoomMicrophoneEnabled(false);
      }
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
      markActivity();
      appendManagedAvatarLog("audio.attached", "remote audio attached", { avatarId: avatar.id, roomName });
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
      appendManagedAvatarLog("session.start", "managed avatar start requested", { avatarId: avatar.id });
      const bootstrap = await createLiveKitAvatarSession(avatar.id, "Student");
      const room = new Room();
      roomRef.current = room;

      room.on(RoomEvent.TrackSubscribed, (track) => {
        attachTrack(track);
      });

      room.on(RoomEvent.Disconnected, () => {
        clearRemoteVideoTimeout();
        clearIdleTimeout();
        if (errorDisconnectRef.current) {
          errorDisconnectRef.current = false;
          appendManagedAvatarLog("room.disconnected", "room closed after timeout", { avatarId: avatar.id, roomName });
          return;
        }
        appendManagedAvatarLog("room.disconnected", "room disconnected", { avatarId: avatar.id, roomName }, "warn");
        resetStageState("idle");
      });

      await room.connect(bootstrap.url, bootstrap.token);
      setRoomName(bootstrap.room_name);
      markActivity();
      appendManagedAvatarLog("room.connected", "joined managed room", {
        avatarId: avatar.id,
        roomName: bootstrap.room_name,
      });

      for (const participant of room.remoteParticipants.values()) {
        for (const publication of participant.trackPublications.values()) {
          if (publication.track) {
            attachTrack(publication.track);
          }
        }
      }

      if (microphoneMode === "auto" || microphoneMode === "prime") {
        await setRoomMicrophoneEnabled(true);
        pendingMicPrimeResetRef.current = microphoneMode === "prime";
        appendManagedAvatarLog("mic.primed", "microphone primed for room join", {
          avatarId: avatar.id,
          mode: microphoneMode,
          roomName: bootstrap.room_name,
        });
      } else {
        setMicEnabled(false);
      }

      if (videoFrameRef.current?.childElementCount) {
        setConnectionState("connected");
        if (pendingMicPrimeResetRef.current) {
          pendingMicPrimeResetRef.current = false;
          await setRoomMicrophoneEnabled(false);
        }
        return;
      }

      remoteVideoTimeoutRef.current = window.setTimeout(() => {
        if (!roomRef.current) {
          return;
        }
        errorDisconnectRef.current = true;
        roomRef.current.disconnect();
        roomRef.current = null;
        clearIdleTimeout();
        setConnectionState("error");
        setHasVideoTrack(false);
        setError(remoteVideoTimeoutMessage(avatar));
        appendManagedAvatarLog("video.timeout", "remote video did not attach in time", {
          avatarId: avatar.id,
          roomName: bootstrap.room_name,
        }, "error");
      }, REMOTE_VIDEO_TIMEOUT_MS);
    } catch (sessionError) {
      clearRemoteVideoTimeout();
      clearIdleTimeout();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
      setConnectionState("error");
      setHasVideoTrack(false);
      setError(sessionError instanceof Error ? sessionError.message : "Could not connect the managed avatar.");
      appendManagedAvatarLog("session.error", "managed avatar connection failed", {
        avatarId: avatar.id,
        detail: sessionError instanceof Error ? sessionError.message : "unknown error",
      }, "error");
    }
  }

  function handlePushToTalkStart() {
    const canUseMicControls = connectionState === "connected" && !isPreview;
    if (!canUseMicControls || micEnabled || micBusy || pushToTalkRef.current) {
      return;
    }
    pushToTalkRef.current = true;
    markActivity();
    void setRoomMicrophoneEnabled(true, "push");
  }

  function handlePushToTalkEnd() {
    if (!pushToTalkRef.current) {
      pushToTalkRef.current = false;
      return;
    }
    pushToTalkRef.current = false;
    if (micEnabled && !micBusy) {
      void setRoomMicrophoneEnabled(false);
    }
  }

  useEffect(() => {
    return () => {
      clearRemoteVideoTimeout();
      clearIdleTimeout();
      if (roomRef.current) {
        roomRef.current.disconnect();
        roomRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    autoStartRef.current = false;
  }, [avatar.id]);

  useEffect(() => {
    if (!autoStart || autoStartRef.current || connectionState !== "idle") {
      return;
    }
    autoStartRef.current = true;
    void startSession();
  }, [autoStart, connectionState, avatar.id]);

  const canUseMicControls = connectionState === "connected" && !isPreview;
  const snapshot: ManagedAvatarSessionSnapshot = {
    canLeave: connectionState !== "connecting" && connectionState !== "idle",
    canStart: connectionState !== "connecting",
    canToggleMic: canUseMicControls && !micBusy,
    connectionState,
    hasVideoTrack,
    micBusy,
    micEnabled,
    micUnavailable,
    roomName,
  };

  useEffect(() => {
    onStateChange?.({
      canLeave: snapshot.canLeave,
      canStart: snapshot.canStart,
      canToggleMic: snapshot.canToggleMic,
      connectionState: snapshot.connectionState,
      hasVideoTrack: snapshot.hasVideoTrack,
      micBusy: snapshot.micBusy,
      micEnabled: snapshot.micEnabled,
      micUnavailable: snapshot.micUnavailable,
      roomName: snapshot.roomName,
    });
  }, [
    onStateChange,
    snapshot.canLeave,
    snapshot.canStart,
    snapshot.canToggleMic,
    snapshot.connectionState,
    snapshot.hasVideoTrack,
    snapshot.micBusy,
    snapshot.micEnabled,
    snapshot.micUnavailable,
    snapshot.roomName,
  ]);

  useImperativeHandle(ref, () => ({
    beginHoldToTalk() {
      handlePushToTalkStart();
    },
    async disconnect() {
      await disconnectRoom("manual");
    },
    endHoldToTalk() {
      handlePushToTalkEnd();
    },
    markActivity,
    async start() {
      await startSession();
    },
    async toggleMicrophone() {
      if (!canUseMicControls || micBusy) {
        return;
      }
      await setRoomMicrophoneEnabled(!micEnabled);
    },
  }), [canUseMicControls, micBusy, micEnabled]);

  const errorItems = splitErrorDetails(error);
  const showPlaceholder = !hasVideoTrack;
  const currentStatusLabel = statusLabel(connectionState);

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
                <p>{placeholderLine(connectionState, avatar.description, roomName)}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {errorItems.length > 0 ? (
        <div className="managed-avatar-session__error-card" role="alert">
          <div className="managed-avatar-session__error-title">Live link issue</div>
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
});
