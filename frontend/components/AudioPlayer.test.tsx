import React from "react";
import { act } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { AudioPlayer } from "./AudioPlayer";
import { PlaybackController } from "../lib/playback_controller";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("audio player interrupts queued playback", async () => {
  const speak = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal("speechSynthesis", { speak, cancel });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class SpeechSynthesisUtterance {
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    }
  );

  const controller = new PlaybackController();
  controller.enqueue({ id: "a", text: "hello" });
  controller.enqueue({ id: "b", text: "world" });

  render(<AudioPlayer controller={controller} />);

  expect(speak).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole("button", { name: "Stop audio" }));

  expect(controller.queueLength()).toBe(0);
  expect(screen.getByText("idle")).toBeInTheDocument();
  expect(cancel).toHaveBeenCalled();
  expect(screen.getByLabelText("Volume")).toBeInTheDocument();
});

test("audio player prefers provider audio bytes over speech synthesis", async () => {
  const play = vi.fn().mockResolvedValue(undefined);
  const pause = vi.fn();
  const audioInstance = {
    play,
    pause,
    volume: 1,
  };
  const speak = vi.fn();
  const cancel = vi.fn();

  vi.stubGlobal("speechSynthesis", { speak, cancel });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class SpeechSynthesisUtterance {
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    }
  );
  vi.stubGlobal("Audio", vi.fn(() => audioInstance));

  const controller = new PlaybackController();
  controller.enqueue({
    id: "a",
    text: "hello",
    audioBase64: "YQ==",
    audioMimeType: "audio/wav",
    durationMs: 200,
  });

  render(<AudioPlayer controller={controller} />);

  await act(async () => {
    await Promise.resolve();
  });
  expect(play).toHaveBeenCalledTimes(1);
  expect(speak).not.toHaveBeenCalled();
});

test("audio player speaks the second queued item after the first completes", async () => {
  vi.useFakeTimers();
  const speak = vi.fn();
  const cancel = vi.fn();
  vi.stubGlobal("speechSynthesis", { speak, cancel });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class SpeechSynthesisUtterance {
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    }
  );

  const controller = new PlaybackController();
  render(<AudioPlayer controller={controller} />);

  await act(async () => {
    controller.enqueue({ id: "a", text: "first", durationMs: 10 });
    controller.enqueue({ id: "b", text: "second", durationMs: 10 });
  });

  await act(async () => {
    await Promise.resolve();
  });
  expect(speak).toHaveBeenCalledTimes(1);
  expect(speak.mock.calls[0]?.[0]?.text).toBe("first");

  await act(async () => {
    vi.advanceTimersByTime(11);
    await Promise.resolve();
  });
  expect(speak).toHaveBeenCalledTimes(2);
  expect(speak.mock.calls[1]?.[0]?.text).toBe("second");

  await act(async () => {
    controller.interrupt();
  });
  vi.useRealTimers();
});

test("audio player plays the second provider audio segment after the first completes", async () => {
  vi.useFakeTimers();
  const firstAudio = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    volume: 1,
  };
  const secondAudio = {
    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    volume: 1,
  };
  const AudioMock = vi.fn()
    .mockImplementationOnce(() => firstAudio)
    .mockImplementationOnce(() => secondAudio);

  vi.stubGlobal("Audio", AudioMock);
  vi.stubGlobal("speechSynthesis", { speak: vi.fn(), cancel: vi.fn() });
  vi.stubGlobal(
    "SpeechSynthesisUtterance",
    class SpeechSynthesisUtterance {
      text: string;

      constructor(text: string) {
        this.text = text;
      }
    }
  );

  const controller = new PlaybackController();
  render(<AudioPlayer controller={controller} />);

  await act(async () => {
    controller.enqueue({ id: "a", text: "first", audioBase64: "YQ==", durationMs: 10 });
    controller.enqueue({ id: "b", text: "second", audioBase64: "Yg==", durationMs: 10 });
    await Promise.resolve();
  });

  expect(firstAudio.play).toHaveBeenCalledTimes(1);

  await act(async () => {
    vi.advanceTimersByTime(11);
    await Promise.resolve();
  });

  expect(secondAudio.play).toHaveBeenCalledTimes(1);

  await act(async () => {
    controller.interrupt();
  });
  vi.useRealTimers();
});
