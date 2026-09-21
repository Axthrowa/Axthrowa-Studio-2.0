import { db } from '../../db/index.js';
import { eventBus } from '../../core/event-bus.js';

export class TimerManager {
  private chatLineCounters: Map<string, number> = new Map();
  private timerIntervals: Map<string, NodeJS.Timeout> = new Map();
  private messageIndices: Map<string, number> = new Map();

  constructor() {
    // Increment chat lines counter on every incoming chat message
    eventBus.on('chat', (payload) => {
      const current = this.chatLineCounters.get('global') || 0;
      this.chatLineCounters.set('global', current + 1);
    });
  }

  startAll() {
    this.stopAll();
    const rows = db.prepare('SELECT * FROM timers WHERE is_enabled = 1').all() as any[];

    for (const timer of rows) {
      this.startTimer(timer);
    }
  }

  stopAll() {
    for (const interval of this.timerIntervals.values()) {
      clearInterval(interval);
    }
    this.timerIntervals.clear();
  }

  startTimer(timer: any) {
    if (this.timerIntervals.has(timer.id)) {
      clearInterval(this.timerIntervals.get(timer.id)!);
    }

    let messages: string[] = [];
    try {
      messages = JSON.parse(timer.messages);
    } catch {
      messages = [timer.messages];
    }

    if (messages.length === 0) return;

    const intervalMs = Math.max(1, timer.interval_minutes) * 60 * 1000;

    const interval = setInterval(() => {
      const currentLines = this.chatLineCounters.get('global') || 0;
      if (currentLines < timer.min_chat_lines) {
        // Not enough chat activity to warrant sending announcement
        return;
      }

      // Reset chat lines counter
      this.chatLineCounters.set('global', 0);

      // Cycle message index
      let currentIndex = this.messageIndices.get(timer.id) || 0;
      const messageToSend = messages[currentIndex % messages.length];
      this.messageIndices.set(timer.id, (currentIndex + 1) % messages.length);

      // Dispatch announcement to all active platforms
      eventBus.emitBotMessage({
        platform: 'all',
        message: messageToSend
      });

      db.prepare('UPDATE timers SET last_run_at = ? WHERE id = ?').run(Date.now(), timer.id);
    }, intervalMs);

    this.timerIntervals.set(timer.id, interval);
  }

  reload() {
    this.startAll();
  }
}

export const timerManager = new TimerManager();
export default timerManager;
