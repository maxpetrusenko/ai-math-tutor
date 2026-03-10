import { afterEach, vi } from "vitest";

import { arrayBufferToBase64, BrowserAudioCapture } from "./audio_capture";

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = [];

  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = "inactive";

  constructor(public stream: MediaStream) {
    FakeMediaRecorder.instances.push(this);
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.onstop?.();
  }
}

afterEach(() => {
  FakeMediaRecorder.instances = [];
  vi.unstubAllGlobals();
});


test("array buffer converts to base64 for websocket transport", () => {
  const bytes = new Uint8Array([97, 98, 99]).buffer;

  expect(arrayBufferToBase64(bytes)).toBe("YWJj");
});

test("browser audio capture reports unsupported environments", () => {
  vi.stubGlobal("window", undefined);

  expect(new BrowserAudioCapture().isSupported()).toBe(false);
});

test("browser audio capture streams chunks and encodes bytes on stop", async () => {
  const stopTrack = vi.fn();
  const fakeStream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;

  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(fakeStream),
    },
  });
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder as unknown as typeof MediaRecorder);

  const capture = new BrowserAudioCapture();
  await capture.start();

  const recorder = FakeMediaRecorder.instances[0];
  recorder.ondataavailable?.({
    data: {
      arrayBuffer: async () => new Uint8Array([97, 98, 99]).buffer,
      size: 3,
    } as Blob,
  });

  await expect(capture.stop()).resolves.toEqual([{ sequence: 1, size: 3, bytesBase64: "YWJj" }]);
  expect(stopTrack).toHaveBeenCalled();
});

test("cancel stops the active recorder and resets the stream", async () => {
  const stopTrack = vi.fn();
  const fakeStream = {
    getTracks: () => [{ stop: stopTrack }],
  } as unknown as MediaStream;

  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue(fakeStream),
    },
  });
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder as unknown as typeof MediaRecorder);

  const capture = new BrowserAudioCapture();
  await capture.start();

  const recorder = FakeMediaRecorder.instances[0];
  await capture.cancel();

  expect(recorder.state).toBe("inactive");
  expect(stopTrack).toHaveBeenCalled();
  await expect(capture.stop()).resolves.toEqual([]);
});
