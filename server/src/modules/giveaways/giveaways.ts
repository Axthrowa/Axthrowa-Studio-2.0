import { db } from '../../db/index.js';
import { randomUUID as uuidv4 } from 'crypto';
import { ChatMessagePayload } from '../../core/event-bus.js';
import { economy } from '../economy/economy.js';

export interface GiveawayWinner {
  /** Tüm kazananlar virgülle (eski istemciler tek ad bekliyordu; tek kazananda aynı) */
  winner: string;
  winners: string[];
  platform: string;
  totalTickets: number;
  participantsCount: number;
}

/** Katılımın kapandığı an (ms); süre yoksa null. */
export function katilimBitisi(g: { created_at?: number; duration_minutes?: number }): number | null {
  const dk = Number(g?.duration_minutes) || 0;
  return dk > 0 && Number(g?.created_at) ? Number(g.created_at) + dk * 60_000 : null;
}

/** Bilet ağırlıklı, tekrarsız `adet` kazanan (katılımcıdan fazlası istenirse hepsi). */
export function kazananlariSec<T extends { tickets?: number }>(katilimcilar: T[], adet: number, rastgele = Math.random): T[] {
  const havuz = katilimcilar.map((k) => ({ k, b: Math.max(1, Number(k.tickets) || 1) }));
  const sonuc: T[] = [];
  const n = Math.min(Math.max(1, Math.floor(adet)), havuz.length);
  while (sonuc.length < n) {
    const toplam = havuz.reduce((t, x) => t + x.b, 0);
    let r = rastgele() * toplam;
    const i = Math.max(0, havuz.findIndex((x) => (r -= x.b) < 0));
    sonuc.push(havuz[i].k);
    havuz.splice(i, 1);
  }
  return sonuc;
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

    // Katılım süresi (dk): dolunca yeni katılım alınmaz; çekiliş açık kalır ki kazanan çekilebilsin.
    // Eskiden ayar kaydediliyor ama hiç okunmuyordu — saatler sonra da katılınabiliyordu.
    const bitis = katilimBitisi(active);
    if (bitis && Date.now() > bitis) {
      return `@${message.user.displayName}, "${active.title}" çekilişinin katılım süresi doldu.`;
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
    // En az 1 bilet: çarpan 0–0.49 iken abone 0 bilet alıyor, yalnız abonelere açık çekilişte
    // havuz boş kalıp çekiliş hata veriyordu.
    let tickets = 1;
    if (message.user.isSub) {
      tickets = Math.max(1, Math.round(Number(active.sub_bonus_multiplier) || 1));
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

    // "Kazanan sayısı" kadar FARKLI kişi, bilet ağırlıklı (eskiden ayar okunmuyordu: hep 1 kazanan)
    const secilenler = kazananlariSec(entries, Number(active.winner_count) || 1);
    const toplamBilet = entries.reduce((t, e) => t + Math.max(1, Number(e.tickets) || 1), 0);
    const adlar = secilenler.map((s) => s.username);

    // Close giveaway and record winner
    db.prepare('UPDATE giveaways SET is_active = 0, winner = ?, winner_platform = ?, closed_at = ? WHERE id = ?')
      .run(adlar.join(', '), secilenler[0].platform, Date.now(), active.id);

    return {
      winner: adlar.join(', '),
      winners: adlar,
      platform: secilenler[0].platform,
      totalTickets: toplamBilet,
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
