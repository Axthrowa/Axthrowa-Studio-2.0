/**
 * Alert Queue Engine — art arda gelen uyarıları sırayla oynatır.
 * Overlay / önizleme / widget ortak kullanır.
 */

export type QueuedAlert<T> = T & { __qid: string };

export type AlertQueueHooks<T> = {
  onPlay: (item: T) => void | Promise<void>;
  /** ms — mevcut alert süresi */
  getDurationMs: (item: T) => number;
  onIdle?: () => void;
};

export class AlertQueueEngine<T> {
  private queue: QueuedAlert<T>[] = [];
  private busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private hooks: AlertQueueHooks<T>;
  private max = 24;

  constructor(hooks: AlertQueueHooks<T>) {
    this.hooks = hooks;
  }

  get length() {
    return this.queue.length;
  }

  get isBusy() {
    return this.busy;
  }

  enqueue(item: T) {
    const qid = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.queue.push({ ...item, __qid: qid });
    while (this.queue.length > this.max) this.queue.shift();
    void this.pump();
  }

  clear() {
    this.queue = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.busy = false;
  }

  private async pump() {
    if (this.busy || this.queue.length === 0) {
      if (!this.busy && this.queue.length === 0) this.hooks.onIdle?.();
      return;
    }
    this.busy = true;
    const next = this.queue.shift()!;
    try {
      await this.hooks.onPlay(next);
    } catch {
      /* oynatma hatası — yine de süre say */
    }
    const ms = Math.max(1500, this.hooks.getDurationMs(next));
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.busy = false;
      this.timer = null;
      void this.pump();
    }, ms);
  }
}
