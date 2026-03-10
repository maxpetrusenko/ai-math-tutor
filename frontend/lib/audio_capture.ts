export type CapturedAudioChunk = {
  sequence: number;
  size: number;
  bytesBase64?: string;
};

export class BrowserAudioCapture {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private blobs: Blob[] = [];

  isSupported() {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      typeof MediaRecorder !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
    );
  }

  async start() {
    if (!this.isSupported()) {
      throw new Error("Microphone capture is not supported in this browser");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.blobs = [];
    this.mediaRecorder = new MediaRecorder(this.stream);
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.blobs.push(event.data);
      }
    };
    this.mediaRecorder.start(250);
  }

  async stop() {
    if (!this.mediaRecorder) {
      return [];
    }

    const recorder = this.mediaRecorder;

    return new Promise<CapturedAudioChunk[]>((resolve) => {
      recorder.onstop = async () => {
        const chunks = await Promise.all(
          this.blobs.map(async (blob, index) => ({
            sequence: index + 1,
            size: blob.size || 320,
            bytesBase64: arrayBufferToBase64(await blob.arrayBuffer()),
          }))
        );
        this.reset();
        resolve(chunks.length > 0 ? chunks : [{ sequence: 1, size: 320 }]);
      };
      recorder.stop();
      this.stream?.getTracks().forEach((track) => track.stop());
    });
  }

  async cancel() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.reset();
  }

  private reset() {
    this.mediaRecorder = null;
    this.stream = null;
    this.blobs = [];
  }
}


export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}
