import { db } from '../../db/index.js';
import { randomUUID as uuidv4 } from 'crypto';
import { ChatMessagePayload } from '../../core/event-bus.js';
import { economy } from '../economy/economy.js';

export interface GiveawayWinner {
  winner: string;
  platform: string;
  totalTickets: number;
  participantsCount: number;
}

export class GiveawayEngine {
  getActiveGiveaway(): any | null {
    return db.prepare('SELECT * FROM giveaways WHERE is_active = 1 LIMIT 1').get() || null;
  }

  createGiveaway(title: string, keyword: string = '!katil', subBonusMultiplier: number = 2.0, costPoints: number = 0): any {
    // Close any previous active giveaway
    db.prepare('UPDATE giveaways SET is_active = 0, closed_at = ? WHERE is_active = 1').run(Date.now());

    const id = uuidv4();
    db.prepare(`
      INSERT INTO giveaways (id, title, keyword, is_active, sub_bonus_multiplier, cost_points, created_at)
      VALUES (?, ?, ?, 1, ?, ?, ?)
    `).run(id, title, keyword.toLowerCase(), subBonusMultiplier, costPoints, Date.now());

    return this.getActiveGiveaway();
  }

  handleJoin(message: ChatMessagePayload): string {
    const active = this.getActiveGiveaway();
    if (!active) {
      return `@${message.user.displayName}, şu anda aktif bir çekiliş yok.`;
    }

    const username = message.user.username.toLowerCase();
    const existing = db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ? AND username = ?').get(active.id, username);
    if (existing) {
      return `@${message.user.displayName}, zaten bu çekilişe katıldın! 🎟️`;
    }

    if (active.sub_only && !message.user.isSub) {
      return `@${message.user.displayName}, bu çekiliş yalnızca abonelere açık.`;
    }
    if (active.max_entries > 0) {
      const count = (db.prepare('SELECT COUNT(*) as c FROM giveaway_entries WHERE giveaway_id = ?').get(active.id) as any)?.c || 0;
      if (count >= active.max_entries) return `@${message.user.displayName}, çekiliş katılım limiti doldu.`;
    }
    if (active.min_watch_minutes > 0) {
      const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
      if ((user.watch_time_minutes || 0) < active.min_watch_minutes) {
        return `@${message.user.displayName}, katılmak için en az ${active.min_watch_minutes} dk izleme gerekli.`;
      }
    }

    // Check point cost if set
    if (active.cost_points > 0) {
      const user = economy.getUser(message.platform, message.user.username);
      if (user.points < active.cost_points) {
        return `@${message.user.displayName}, çekilişe katılmak için ${active.cost_points} puana ihtiyacın var! (Mevcut: ${user.points})`;
      }
      economy.removePoints(message.user.username, active.cost_points);
    }

    // Calculate tickets (subscriber bonus)
    let tickets = 1;
    if (message.user.isSub) {
      tickets = Math.round(active.sub_bonus_multiplier);
    }

    const entryId = uuidv4();
    db.prepare(`
      INSERT INTO giveaway_entries (id, giveaway_id, username, platform, tickets, entered_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(entryId, active.id, username, message.platform, tickets, Date.now());

    return `🎟️ @${message.user.displayName}, "${active.title}" çekilişine katıldın! (${tickets} bilet)`;
  }

  pickWinner(): GiveawayWinner | null {
    const active = this.getActiveGiveaway();
    if (!active) return null;

    const entries = db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ?').all(active.id) as any[];
    if (!entries || entries.length === 0) return null;

    // Build ticket pool
    const ticketPool: Array<{ username: string; platform: string }> = [];
    for (const entry of entries) {
      for (let i = 0; i < entry.tickets; i++) {
        ticketPool.push({ username: entry.username, platform: entry.platform });
      }
    }

    const randomIndex = Math.floor(Math.random() * ticketPool.length);
    const selected = ticketPool[randomIndex];

    // Close giveaway and record winner
    db.prepare('UPDATE giveaways SET is_active = 0, winner = ?, winner_platform = ?, closed_at = ? WHERE id = ?')
      .run(selected.username, selected.platform, Date.now(), active.id);

    return {
      winner: selected.username,
      platform: selected.platform,
      totalTickets: ticketPool.length,
      participantsCount: entries.length
    };
  }

  getEntries(): any[] {
    const active = this.getActiveGiveaway();
    if (!active) return [];
    return db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entered_at DESC').all(active.id) as any[];
  }
}

export const giveaway = new GiveawayEngine();
export default giveaway;
