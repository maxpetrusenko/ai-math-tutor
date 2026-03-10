export type PlaybackItem = {
  id: string;
  text: string;
  durationMs?: number;
  onStart?: () => void;
  onComplete?: () => void;
};

export type PlaybackState = "idle" | "speaking" | "fading";

export class PlaybackController {
  private queue: PlaybackItem[] = [];
  private listeners = new Set<(state: PlaybackState) => void>();
  private activeTimer: ReturnType<typeof setTimeout> | null = null;

  state: PlaybackState = "idle";

  enqueue(item: PlaybackItem) {
    this.queue.push({
      ...item,
      durationMs: item.durationMs ?? Math.max(300, item.text.length * 18),
    });
    if (this.state === "idle") {
      this.playNext();
    }
  }

  queueLength() {
    return this.queue.length;
  }

  subscribe(listener: (state: PlaybackState) => void) {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  interrupt() {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.state === "speaking") {
      this.state = "fading";
      this.emit();
    }
    this.queue = [];
    this.state = "idle";
    this.emit();
  }

  private playNext() {
    const nextItem = this.queue[0];
    if (!nextItem) {
      this.state = "idle";
      this.emit();
      return;
    }

    this.state = "speaking";
    this.emit();
    nextItem.onStart?.();

    this.activeTimer = setTimeout(() => {
      this.queue.shift();
      nextItem.onComplete?.();
      this.activeTimer = null;
      if (this.queue.length > 0) {
        this.playNext();
        return;
      }
      this.state = "idle";
      this.emit();
    }, nextItem.durationMs);
  }

  private emit() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
