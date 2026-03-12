import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ManagedAvatarSession } from "./ManagedAvatarSession";

const {
  createLiveKitAvatarSession,
  emitTrackOnConnect,
  emitDisconnect,
  setMicrophoneEnabled,
} = vi.hoisted(() => ({
  createLiveKitAvatarSession: vi.fn(),
  emitTrackOnConnect: vi.fn(),
  emitDisconnect: vi.fn(),
  setMicrophoneEnabled: vi.fn(),
}));

vi.mock("../lib/livekit_avatar_session", () => ({
  createLiveKitAvatarSession,
}));

vi.mock("livekit-client", () => {
  let activeRoom: Room | null = null;
  emitDisconnect.mockImplementation(() => {
    activeRoom?.handlers.get("disconnected")?.();
  });

  class Room {
    handlers = new Map<string, (track?: unknown) => void>();
    remoteParticipants = new Map();
    localParticipant = {
      setMicrophoneEnabled,
    };

    on(event: string, handler: (track?: unknown) => void) {
      this.handlers.set(event, handler);
    }

    async connect() {
      activeRoom = this;
      if (!emitTrackOnConnect()) {
        return;
      }
      const videoElement = document.createElement("video");
      this.handlers.get("trackSubscribed")?.({
        kind: "video",
        attach: () => videoElement,
      });
    }

    disconnect() {
      this.handlers.get("disconnected")?.();
    }
  }

  return {
    Room,
    RoomEvent: {
      Disconnected: "disconnected",
      TrackSubscribed: "trackSubscribed",
    },
    Track: {
      Kind: {
        Audio: "audio",
        Video: "video",
      },
    },
  };
});

beforeEach(() => {
  createLiveKitAvatarSession.mockReset();
  createLiveKitAvatarSession
    .mockResolvedValueOnce({
      room_name: "nerdy-simli-preview",
      token: "test-token",
      url: "wss://example.livekit.cloud",
    })
    .mockResolvedValueOnce({
      room_name: "nerdy-simli-preview-2",
      token: "test-token-2",
      url: "wss://example.livekit.cloud",
    });
  emitTrackOnConnect.mockReturnValue(true);
  emitDisconnect.mockClear();
  setMicrophoneEnabled.mockRejectedValue(new Error("Not supported"));
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

test("keeps the live avatar mounted when microphone startup is unavailable", async () => {
  render(
    <ManagedAvatarSession
      avatar={{
        id: "simli-b97a7777-live",
        label: "Simli Tutor",
        description: "Live avatar preview",
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Start avatar" }));

  await waitFor(() => expect(screen.getAllByText("Live").length).toBeGreaterThan(0));
  await waitFor(() => expect(document.querySelector(".managed-avatar-session__video-frame video")).toBeTruthy());
  expect(document.querySelector(".managed-avatar-session__video-frame > video")).toBeTruthy();

  expect(screen.getByText("Mic unavailable. Use Hold to talk after allowing it.")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("lets the user manually open and pause the mic without dropping the room", async () => {
  setMicrophoneEnabled.mockResolvedValue(undefined);

  render(
    <ManagedAvatarSession
      avatar={{
        id: "simli-b97a7777-live",
        label: "Simli Tutor",
        description: "Live avatar preview",
      }}
      microphoneMode="off"
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Start avatar" }));

  await waitFor(() => expect(screen.getAllByText("Live").length).toBeGreaterThan(0));
  await waitFor(() => expect(document.querySelector(".managed-avatar-session__video-frame video")).toBeTruthy());

  fireEvent.click(screen.getByRole("button", { name: "Open mic" }));
  await waitFor(() => expect(setMicrophoneEnabled).toHaveBeenCalledWith(true, expect.any(Object)));
  expect(screen.getByRole("button", { name: "Pause mic" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Pause mic" }));
  await waitFor(() => expect(setMicrophoneEnabled).toHaveBeenCalledWith(false, undefined));
  expect(screen.getByRole("button", { name: "Open mic" })).toBeInTheDocument();
});

test("surfaces a provider hint when the room connects but no remote video arrives", async () => {
  vi.useFakeTimers();
  emitTrackOnConnect.mockReturnValue(false);

  render(
    <ManagedAvatarSession
      avatar={{
        id: "simli-b97a7777-live",
        label: "Simli Tutor",
        description: "Live avatar preview",
      }}
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Start avatar" }));

  await act(async () => {
    await vi.advanceTimersByTimeAsync(12000);
  });

  expect(screen.getByRole("alert")).toHaveTextContent("Simli did not publish video in time.");
  expect(screen.getByRole("alert")).toHaveTextContent("The provider may be rate-limited. Retry in about a minute.");
  expect(screen.getByText("Issue")).toBeInTheDocument();
});

test("unexpected disconnect resets the room state and allows reconnect", async () => {
  render(
    <ManagedAvatarSession
      avatar={{
        id: "simli-b97a7777-live",
        label: "Simli Tutor",
        description: "Live avatar preview",
      }}
      microphoneMode="off"
    />
  );

  fireEvent.click(screen.getByRole("button", { name: "Start avatar" }));

  await waitFor(() => expect(screen.getAllByText("Live").length).toBeGreaterThan(0));
  await waitFor(() => expect(screen.getByText("Room nerdy-simli-preview")).toBeInTheDocument());

  act(() => {
    emitDisconnect();
  });

  await waitFor(() => expect(screen.getByText("Ready")).toBeInTheDocument());
  expect(screen.getByText("Join when ready")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Start avatar" }));

  await waitFor(() => expect(createLiveKitAvatarSession).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByText("Room nerdy-simli-preview-2")).toBeInTheDocument());
  await waitFor(() => expect(screen.getAllByText("Live").length).toBeGreaterThan(0));
});
