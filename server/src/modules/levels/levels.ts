/**
 * StreamAxT — seviye / XP sistemi
 * Developed by AxthrowA
 *
 * BotRix'te `Sohbet Botu > Ekstralar > Seviye sistemi` ve `!level` / `!xp`
 * komutları gözlemlendi; sadakat yapılandırmasında liderlik tablosu
 * "Puanlar / Seviyeler / İzleme süresi" arasında seçilebiliyor
 * (BOTRIX_UI_INVENTORY §6.4, §7). Bizde seviye kavramı hiç yoktu —
 * `loyalty_tier` yalnız puana bakan sabit bir etiketti.
 *
 * XP puandan AYRIDIR: puan harcanır, XP harcanmaz. Böylece mağazadan
 * alışveriş yapan izleyici seviyesini kaybetmez.
 */
import { db } from '../../db/index.js';
import { seviyeMaliyeti, seviyeHesapla } from './curve.js';

export { seviyeMaliyeti, seviyeHesapla } from './curve.js';

export interface SeviyeAyarlari {
  aktif: boolean;
  /** Mesaj başına XP. */
  mesajXp: number;
  /** Her `aralikDakika` dakikada izleyene XP. */
  izlemeXp: number;
  aralikDakika: number;
  aboneXp: number;
  hediyeAboneXp: number;
  /** Bağış birimi başına XP. */
  bagisXp: number;
  bagisBirimi: number;
  /** Seviye 1'in maliyeti; sonraki seviyeler `buyume` katıyla artar. */
  tabanXp: number;
  buyume: number;
  maksSeviye: number;
  /** Aynı kullanıcıya bu süre içinde ikinci kez mesaj XP'si verilmez. */
  mesajBeklemeSn: number;
}

export const VARSAYILAN_SEVIYE: SeviyeAyarlari = {
  aktif: true,
  mesajXp: 2,
  izlemeXp: 5,
  aralikDakika: 5,
  aboneXp: 250,
  hediyeAboneXp: 250,
  bagisXp: 50,
  bagisBirimi: 10,
  tabanXp: 100,
  buyume: 1.35,
  maksSeviye: 100,
  mesajBeklemeSn: 30
};

const AYAR_ANAHTARI = 'level_settings';

class SeviyeMotoru {
  /** Mesaj XP bekleme süresi — spam ile seviye kasmayı engeller. */
  private sonMesajXp = new Map<string, number>();

  ayarOku(): SeviyeAyarlari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) return { ...VARSAYILAN_SEVIYE, ...JSON.parse(r.value) };
    } catch {
      /* bozuk JSON */
    }
    return { ...VARSAYILAN_SEVIYE };
  }

  ayarYaz(yeni: Partial<SeviyeAyarlari>): SeviyeAyarlari {
    const birlesik = { ...this.ayarOku(), ...yeni };
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(birlesik));
    return birlesik;
  }

  /** Kullanıcının XP'sini ve türetilen seviyesini döndürür. */
  kullanici(username: string) {
    const ad = String(username || '').replace(/^@/, '');
    const r = db
      .prepare('SELECT username, display_name, xp, level, points FROM economy WHERE LOWER(username) = LOWER(?)')
      .get(ad) as { username?: string; display_name?: string; xp?: number; level?: number; points?: number } | undefined;

    const ayar = this.ayarOku();
    const xp = Number(r?.xp) || 0;
    const h = seviyeHesapla(xp, ayar);
    return {
      username: r?.username || ad,
      displayName: r?.display_name || ad,
      xp,
      puan: Number(r?.points) || 0,
      ...h
    };
  }

  /**
   * XP ekler ve seviye atlandıysa bildirir.
   * `economy.level` sütunu türetilmiş değeri saklar — sorgular hızlı olsun.
   */
  xpEkle(username: string, miktar: number): { seviye: number; atladi: boolean; oncekiSeviye: number } {
    const ad = String(username || '').replace(/^@/, '');
    const m = Math.max(0, Math.round(Number(miktar) || 0));
    if (!ad || !m) {
      const k = this.kullanici(ad);
      return { seviye: k.seviye, atladi: false, oncekiSeviye: k.seviye };
    }

    const ayar = this.ayarOku();
    const once = this.kullanici(ad);

    db.prepare('UPDATE economy SET xp = COALESCE(xp, 0) + ? WHERE LOWER(username) = LOWER(?)').run(m, ad);

    const sonra = seviyeHesapla(once.xp + m, ayar);
    if (sonra.seviye !== once.seviye) {
      db.prepare('UPDATE economy SET level = ? WHERE LOWER(username) = LOWER(?)').run(sonra.seviye, ad);
    }

    return { seviye: sonra.seviye, atladi: sonra.seviye > once.seviye, oncekiSeviye: once.seviye };
  }

  /** Mesaj XP'si — bekleme süresi uygulanır. */
  mesajXp(username: string): { seviye: number; atladi: boolean; oncekiSeviye: number } | null {
    const ayar = this.ayarOku();
    if (!ayar.aktif || ayar.mesajXp <= 0) return null;

    const ad = String(username || '').toLowerCase();
    const simdi = Date.now();
    const son = this.sonMesajXp.get(ad) || 0;
    if (simdi - son < ayar.mesajBeklemeSn * 1000) return null;

    this.sonMesajXp.set(ad, simdi);
    return this.xpEkle(username, ayar.mesajXp);
  }

  /** Liderlik tablosu — seviyeye göre. */
  siralama(limit = 10) {
    const ayar = this.ayarOku();
    const r = db
      .prepare('SELECT username, display_name, xp FROM economy WHERE COALESCE(xp,0) > 0 ORDER BY xp DESC LIMIT ?')
      .all(Math.max(1, Math.min(100, limit))) as Array<{ username: string; display_name?: string; xp?: number }>;
    return r.map((u) => ({
      username: u.username,
      displayName: u.display_name || u.username,
      xp: Number(u.xp) || 0,
      ...seviyeHesapla(Number(u.xp) || 0, ayar)
    }));
  }

  /** Tüm seviyeleri sıfırla (BotRix'te "Sıralamalar > Sıfırla"). */
  sifirla(neyi: 'xp' | 'puan' | 'ikisi' = 'xp'): { etkilenen: number } {
    if (neyi === 'xp' || neyi === 'ikisi') {
      db.prepare('UPDATE economy SET xp = 0, level = 0').run();
    }
    if (neyi === 'puan' || neyi === 'ikisi') {
      db.prepare('UPDATE economy SET points = 0').run();
    }
    const r = db.prepare('SELECT COUNT(*) c FROM economy').get() as { c: number };
    this.sonMesajXp.clear();
    return { etkilenen: r?.c ?? 0 };
  }
}

export const seviyeler = new SeviyeMotoru();
export default seviyeler;
