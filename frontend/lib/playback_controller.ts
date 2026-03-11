export type PlaybackItem = {
  id: string;
  text: string;
  audioBase64?: string;
  audioMimeType?: string;
  deferCompletion?: boolean;
  durationMs?: number;
  onStart?: () => void;
  onComplete?: () => void;
  onPlaybackStart?: () => void;
  onPlaybackComplete?: () => void;
};

export type PlaybackState = "idle" | "speaking" | "fading";

export type PlaybackSnapshot = {
  activeItem: PlaybackItem | null;
  queueLength: number;
  state: PlaybackState;
};

export class PlaybackController {
  private queue: PlaybackItem[] = [];
  private listeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  private activeTimer: ReturnType<typeof setTimeout> | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private activeItem: PlaybackItem | null = null;

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

  snapshot(): PlaybackSnapshot {
    return {
      activeItem: this.activeItem,
      queueLength: this.queue.length,
      state: this.state,
    };
  }

  subscribe(listener: (snapshot: PlaybackSnapshot) => void) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  interrupt() {
    if (this.activeTimer) {
      clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    if (this.transitionTimer) {
      clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    if (this.state === "speaking") {
      this.state = "fading";
      this.emit();
    }
    this.activeItem = null;
    this.queue = [];
    this.state = "idle";
    this.emit();
  }

  completeActive(itemId?: string) {
    if (!this.activeItem) {
      return;
    }
    if (itemId && this.activeItem.id !== itemId) {
      return;
    }
    this.finishActiveItem();
  }

  private playNext() {
    const nextItem = this.queue[0];
    if (!nextItem) {
      this.activeItem = null;
      this.state = "idle";
      this.emit();
      return;
    }

    this.activeItem = nextItem;
    this.state = "speaking";
    this.emit();
    nextItem.onStart?.();

    if (nextItem.deferCompletion) {
      return;
    }

    this.activeTimer = setTimeout(() => {
      this.activeTimer = null;
      this.finishActiveItem();
    }, nextItem.durationMs);
  }

  private finishActiveItem() {
    const finishedItem = this.activeItem;
    if (!finishedItem) {
      return;
    }

    this.queue.shift();
    finishedItem.onComplete?.();

    if (this.queue.length > 0) {
      this.activeItem = null;
      this.state = "idle";
      this.emit();
      this.transitionTimer = setTimeout(() => {
        this.transitionTimer = null;
        this.playNext();
      }, 0);
      return;
    }

    this.activeItem = null;
    this.state = "idle";
    this.emit();
  }

  private emit() {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
