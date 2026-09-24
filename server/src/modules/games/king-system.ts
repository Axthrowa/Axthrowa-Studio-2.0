import { EventEmitter } from 'events';
import { db } from '../../db/index.js';
import { KingState } from '../../db/schema.js';
import economyService from '../economy/economy.js';
import { hataMetni } from '../../core/logger.js';

export class KingSystemService extends EventEmitter {
  private updateTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startTicker();
  }

  getKingState(): KingState {
    const row = db.prepare("SELECT * FROM king_state WHERE id = 'current'").get() as any;
    if (row) {
      const reign = Math.floor((Date.now() - row.crown_time) / 1000);
      return {
        id: row.id,
        currentKing: row.current_king,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || '',
        pointsBid: row.points_bid,
        crownTime: row.crown_time,
        reignSeconds: reign,
        title: row.title || 'Yayın Hükümdarı',
        history: row.history || '[]'
      };
    }

    return {
      id: 'current',
      currentKing: 'Yayıncı',
      displayName: 'Yayıncı',
      avatarUrl: '',
      pointsBid: 100,
      crownTime: Date.now(),
      reignSeconds: 0,
      title: 'Tahtın Kurucusu',
      history: '[]'
    };
  }

  private startTicker() {
    if (this.updateTimer) clearInterval(this.updateTimer);
    this.updateTimer = setInterval(() => {
      const state = this.getKingState();
      db.prepare("UPDATE king_state SET reign_seconds = ? WHERE id = 'current'").run(state.reignSeconds);
    }, 15000);
  }

  async claimThrone(username: string, displayName: string, pointsBid: number, avatarUrl?: string, title?: string): Promise<{ success: boolean; message: string; state?: KingState }> {
    const current = this.getKingState();

    if (username.toLowerCase() === current.currentKing.toLowerCase()) {
      return {
        success: false,
        message: `👑 Zaten tahtın sahibisiniz! (${current.pointsBid} puan ile tahttasınız)`
      };
    }

    const minRequired = current.pointsBid + 10;
    if (pointsBid < minRequired) {
      return {
        success: false,
        message: `⚠️ Tahtı ele geçirmek için en az ${minRequired} puan basmalısınız! (Mevcut Kral: @${current.displayName} - ${current.pointsBid} Puan)`
      };
    }

    // Check user points
    const userBalance = economyService.getUserPoints(username);
    if (userBalance < pointsBid) {
      return {
        success: false,
        message: `❌ Yetersiz puan! Mevcut puanınız: ${userBalance}, Gereken: ${pointsBid}`
      };
    }

    // Deduct points
    economyService.deductPoints(username, pointsBid);

    // Save previous king to history
    let history: any[] = [];
    try {
      history = JSON.parse(current.history || '[]');
    } catch (e) {
      console.warn('[Kral] Geçmiş kaydı bozuk — boş geçmişle devam:', hataMetni(e));
    }

    history.unshift({
      king: current.currentKing,
      displayName: current.displayName,
      points: current.pointsBid,
      reignedSeconds: current.reignSeconds,
      endedAt: Date.now()
    });
    if (history.length > 10) history = history.slice(0, 10);

    const newTitle = title || 'Yayın Hükümdarı';
    const now = Date.now();

    db.prepare(`
      INSERT INTO king_state (id, current_king, display_name, avatar_url, points_bid, crown_time, reign_seconds, title, history)
      VALUES ('current', ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        current_king = excluded.current_king,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        points_bid = excluded.points_bid,
        crown_time = excluded.crown_time,
        reign_seconds = 0,
        title = excluded.title,
        history = excluded.history
    `).run(username, displayName || username, avatarUrl || '', pointsBid, now, newTitle, JSON.stringify(history));

    const updatedState = this.getKingState();
    this.emit('king_crowned', updatedState);

    return {
      success: true,
      message: `👑 YENİ KRAL! @${displayName || username} ${pointsBid} puan basarak tahtı ele geçirdi!`,
      state: updatedState
    };
  }

  resetThrone(moderator: string = 'Yayıncı'): KingState {
    const now = Date.now();
    db.prepare(`
      UPDATE king_state SET
        current_king = 'Yayıncı',
        display_name = 'Yayıncı',
        points_bid = 100,
        crown_time = ?,
        reign_seconds = 0,
        title = 'Tahtın Kurucusu'
      WHERE id = 'current'
    `).run(now);

    const state = this.getKingState();
    this.emit('king_reset', state);
    return state;
  }
}

export const kingSystemService = new KingSystemService();
export default kingSystemService;
