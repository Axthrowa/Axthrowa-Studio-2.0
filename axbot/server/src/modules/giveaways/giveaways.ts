import { db } from '../../db/index.js';
import { randomInt, randomUUID as uuidv4 } from 'crypto';
import { eventBus } from '../../core/event-bus.js';
import { ChatMessagePayload } from '../../core/event-bus.js';
import { cuzdanAdi, economy } from '../economy/economy.js';
import { hataMetni } from '../../core/logger.js';

export interface GiveawayWinner {
  /** Tüm kazananlar virgülle (eski istemciler tek ad bekliyordu; tek kazananda aynı) */
  winner: string;
  winners: string[];
  platform: string;
  totalTickets: number;
  participantsCount: number;
  /** Çark animasyonu için katılımcı adları (en çok 40) */
  adaylar: string[];
}

/** Katılımın kapandığı an (ms); süre yoksa null. */
export function katilimBitisi(g: { created_at?: number; duration_minutes?: number }): number | null {
  const dk = Number(g?.duration_minutes) || 0;
  return dk > 0 && Number(g?.created_at) ? Number(g.created_at) + dk * 60_000 : null;
}

/** 0–1 arası kriptografik rastgele: Math.random öngörülebilir, çekilişte adil sayılmaz. */
export function adilRastgele(): number {
  return randomInt(2 ** 47) / 2 ** 47;
}

/** Katılım kelimesi: küçük harf, baştaki/sondaki boşluksuz; boşsa varsayılan. */
export function kelimeyiDuzenle(k: unknown): string {
  return String(k ?? '').trim().toLocaleLowerCase('tr-TR').slice(0, 40) || '!katil';
}

/** Çekiliş açılınca sohbete giden duyuru: nasıl katılınacağı ve geçerli kurallar. */
export function baslangicDuyurusu(g: { title: string; keyword: string; duration_minutes?: number; winner_count?: number; sub_bonus_multiplier?: number; cost_points?: number; sub_only?: number; min_watch_minutes?: number }): string {
  const kurallar = [
    Number(g.duration_minutes) > 0 ? `${g.duration_minutes} dk` : '',
    Number(g.winner_count) > 1 ? `${g.winner_count} kazanan` : '',
    g.sub_only ? 'yalnız abone' : Number(g.sub_bonus_multiplier) > 1 ? `abonelere ${g.sub_bonus_multiplier}x bilet` : '',
    Number(g.cost_points) > 0 ? `${g.cost_points} puan` : '',
    Number(g.min_watch_minutes) > 0 ? `en az ${g.min_watch_minutes} dk izleme` : ''
  ].filter(Boolean);
  return `🎉 ÇEKİLİŞ BAŞLADI: "${g.title}" — katılmak için sohbete ${g.keyword} yaz!${kurallar.length ? ` (${kurallar.join(' · ')})` : ''}`;
}

export function kazananDuyurusu(baslik: string, k: GiveawayWinner): string {
  return `🏆 "${baslik}" çekilişinin kazananı: ${k.winners.map((w) => '@' + w).join(', ')}! (${k.participantsCount} katılımcı, ${k.totalTickets} bilet) 🎉`;
}

/** Bilet ağırlıklı, tekrarsız `adet` kazanan (katılımcıdan fazlası istenirse hepsi). */
export function kazananlariSec<T extends { tickets?: number }>(katilimcilar: T[], adet: number, rastgele = adilRastgele): T[] {
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

/** Kayan isimler için tüm katılımcılardan karışık örnek; eskiden hep ilk katılan 40 kişi görünüyordu. */
export function seritAdaylari(katilimcilar: Array<{ username: string }>, rastgele = adilRastgele, enCok = 200): string[] {
  const k = katilimcilar.map((e) => e.username);
  for (let i = k.length - 1; i > 0; i--) {
    const j = Math.floor(rastgele() * (i + 1));
    [k[i], k[j]] = [k[j], k[i]];
  }
  return k.slice(0, enCok);
}

export class GiveawayEngine {
  getActiveGiveaway(): any | null {
    return db.prepare('SELECT * FROM giveaways WHERE is_active = 1 LIMIT 1').get() || null;
  }

  /** Açık çekilişi kazanansız kapatır; ücretli katılım puanları iade edilir. Kapatılan çekilişi döndürür. */
  iptal(): any | null {
    // Kazanan çekilmeden kapanan ücretli çekilişin katılım puanları iade edilir (eskiden kayboluyordu)
    const onceki = this.getActiveGiveaway();
    const katilanlar = onceki && Number(onceki.cost_points) > 0
      ? (db.prepare('SELECT username, platform FROM giveaway_entries WHERE giveaway_id = ?').all(onceki.id) as Array<{ username: string; platform: string }>)
      : [];
    // Tek işlemde: kapatma başarısız olursa iade de geri alınır, ikinci iptal iki kez ödemez
    economy.topluOde(
      katilanlar.map((k) => ({ kullanici: cuzdanAdi(k.platform, k.username), puan: Number(onceki.cost_points) })),
      () => db.prepare('UPDATE giveaways SET is_active = 0, closed_at = ? WHERE is_active = 1').run(Date.now())
    );
    return onceki;
  }

  /** Çekiliş + ek ayarlar (süre, kazanan sayısı, katılım şartları); panel ve `!cekilis` komutu ortak. */
  baslat(o: { title: string; keyword?: string; subBonusMultiplier?: number; costPoints?: number; durationMinutes?: number; winnerCount?: number; maxEntries?: number; subOnly?: boolean; minWatchMinutes?: number }): { giveaway: any; uyari?: string } {
    // Varsayılan eşit şans: abone bonusu yalnız yayıncı isterse verilir
    const created = this.createGiveaway(o.title, kelimeyiDuzenle(o.keyword), o.subBonusMultiplier ?? 1, o.costPoints ?? 0);
    let uyari: string | undefined;
    if (created?.id) {
      try {
        db.prepare('UPDATE giveaways SET duration_minutes=?, winner_count=?, max_entries=?, follower_only=?, sub_only=?, min_watch_minutes=? WHERE id=?')
          // "Yalnız takipçi" yok: Kick sohbet iletisi takip durumunu taşımaz, doğrulanamazdı (sütun 0 kalır)
          .run(o.durationMinutes ?? 10, o.winnerCount ?? 1, o.maxEntries ?? 0, 0, o.subOnly ? 1 : 0, o.minWatchMinutes ?? 0, created.id);
      } catch (e) {
        // Eskiden sessizdi: süre, kazanan sayısı ve katılım şartları kaybolur,
        // çekiliş varsayılanlarla açılırdı — yayıncı fark etmezdi.
        uyari = 'Çekiliş açıldı ama ek ayarlar (süre, kazanan sayısı, katılım şartları) kaydedilemedi.';
        console.error('[Çekiliş] Ek ayarlar yazılamadı:', hataMetni(e));
      }
    }
    return { giveaway: this.getActiveGiveaway(), uyari };
  }

  /** Açık çekilişin ayarlarını değiştirir; puan bedeli değişmez (katılanlar eski bedeli ödedi). */
  guncelle(o: { title?: string; keyword?: string; subBonusMultiplier?: number; durationMinutes?: number; winnerCount?: number; maxEntries?: number; subOnly?: boolean; minWatchMinutes?: number }): any | null {
    const a = this.getActiveGiveaway();
    if (!a) return null;
    const sayi = (v: unknown, onceki: number, enAz: number) => (Number.isFinite(Number(v)) && v !== undefined ? Math.max(enAz, Number(v)) : onceki);
    db.prepare('UPDATE giveaways SET title=?, keyword=?, sub_bonus_multiplier=?, duration_minutes=?, winner_count=?, max_entries=?, sub_only=?, min_watch_minutes=? WHERE id=?').run(
      String(o.title ?? a.title).trim().slice(0, 120) || a.title,
      o.keyword === undefined ? a.keyword : kelimeyiDuzenle(o.keyword),
      sayi(o.subBonusMultiplier, a.sub_bonus_multiplier, 1),
      sayi(o.durationMinutes, a.duration_minutes, 0),
      sayi(o.winnerCount, a.winner_count, 1),
      sayi(o.maxEntries, a.max_entries, 0),
      o.subOnly === undefined ? a.sub_only : o.subOnly ? 1 : 0,
      sayi(o.minWatchMinutes, a.min_watch_minutes, 0),
      a.id
    );
    return this.getActiveGiveaway();
  }

  /** Mesaj açık çekilişin özel katılım kelimesi mi? `!katil`/`!join` komut hattından geçer. */
  ozelKelimeMi(metin: string): boolean {
    const a = this.getActiveGiveaway();
    if (!a) return false;
    const k = String(a.keyword || '');
    return k !== '!katil' && k !== '!join' && kelimeyiDuzenle(metin) === k;
  }

  createGiveaway(title: string, keyword: string = '!katil', subBonusMultiplier: number = 1, costPoints: number = 0): any {
    this.iptal();

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

    // Yayıncı ve bot kendi çekilişine katılamaz
    if (message.user.isBroadcaster || message.user.isSelf) {
      return `@${message.user.displayName}, yayıncı ve bot çekilişe katılamaz.`;
    }

    const username = message.user.username.toLowerCase();
    // Aynı ad başka platformda başka kişidir: biri katılınca diğerini engellemesin
    const existing = db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ? AND username = ? AND platform = ?').get(active.id, username, message.platform);
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
      economy.removePoints(cuzdanAdi(message.platform, message.user.username), active.cost_points);
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

    eventBus.emit('cekilis_katilim', { username });
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
      participantsCount: entries.length,
      adaylar: seritAdaylari(entries)
    };
  }

  /** Kazanan gelmediyse: son çekilişin katılımcıları arasından, daha önce kazananlar hariç yeniden çeker. */
  yenidenCek(): (GiveawayWinner & { baslik: string }) | null {
    const son = db.prepare('SELECT * FROM giveaways WHERE is_active = 0 AND winner IS NOT NULL ORDER BY closed_at DESC LIMIT 1').get() as any;
    if (!son) return null;
    const elenenler = [...String(son.elenen_kazananlar || '').split(','), ...String(son.winner).split(',')].map((x) => x.trim()).filter(Boolean);
    const entries = db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id = ?').all(son.id) as any[];
    const kalan = entries.filter((e) => !elenenler.includes(e.username));
    if (!kalan.length) return null;
    const secilenler = kazananlariSec(kalan, Number(son.winner_count) || 1);
    const adlar = secilenler.map((s) => s.username);
    db.prepare('UPDATE giveaways SET winner = ?, winner_platform = ?, elenen_kazananlar = ? WHERE id = ?').run(adlar.join(', '), secilenler[0].platform, elenenler.join(','), son.id);
    return {
      baslik: son.title,
      winner: adlar.join(', '),
      winners: adlar,
      platform: secilenler[0].platform,
      totalTickets: kalan.reduce((t, e) => t + Math.max(1, Number(e.tickets) || 1), 0),
      participantsCount: kalan.length,
      adaylar: seritAdaylari(kalan)
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
