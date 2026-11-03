/**
 * AxBoT — Topluluk Bahisleri (tahminler)
 * Developed by AxthrowA
 *
 * BotRix'te `/panel/interaction > Topluluk Bahisleri` (BETA V2) ve
 * `!bet` komut ailesi gözlemlendi; bizde komut `!tahmin`
 * (BOTRIX_UI_INVENTORY §11, §13.1). Bizde hiç yoktu.
 *
 * Kurallar:
 *   - Bahis puanla yapılır; puan bahis anında TAHSİL EDİLİR
 *   - Kazananlar havuzu kendi paylarına göre bölüşür
 *   - İptal edilirse herkesin puanı İADE edilir
 *   - Kimse kazanamazsa (kazanan seçeneğe bahis yoksa) herkese iade
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';
import { degisinceBildir, durumYayinci } from '../../core/state-push.js';
import { economy } from '../economy/economy.js';
import { seyrekUyar } from '../../core/logger.js';

export * from './prediction-math.js';
import { odulDagit, secenekBul, type Tahmin, type TahminBahsi } from './prediction-math.js';

class TahminMotoru {
  constructor() {
    db.exec(`
      CREATE TABLE IF NOT EXISTS predictions (
        id            TEXT PRIMARY KEY,
        baslik        TEXT NOT NULL,
        secenekler    TEXT NOT NULL,
        durum         TEXT NOT NULL DEFAULT 'acik',
        kazanan_index INTEGER,
        acilis        INTEGER NOT NULL,
        kapanis       INTEGER,
        kilit_ani     INTEGER
      );
      CREATE TABLE IF NOT EXISTS prediction_bets (
        prediction_id  TEXT NOT NULL,
        kullanici      TEXT NOT NULL,
        gorunen_ad     TEXT NOT NULL,
        secenek_index  INTEGER NOT NULL,
        puan           INTEGER NOT NULL,
        PRIMARY KEY (prediction_id, kullanici)
      );
    `);
  }

  private satirdan(r: any): Tahmin {
    return {
      id: r.id,
      baslik: r.baslik,
      secenekler: JSON.parse(r.secenekler || '[]'),
      durum: r.durum,
      kazananIndex: r.kazanan_index ?? null,
      acilis: r.acilis,
      kapanis: r.kapanis ?? null,
      kilitAni: r.kilit_ani ?? null
    };
  }

  aktif(): Tahmin | null {
    const r = db
      .prepare("SELECT * FROM predictions WHERE durum IN ('acik','kilitli') ORDER BY acilis DESC LIMIT 1")
      .get() as any;
    return r ? this.satirdan(r) : null;
  }

  bahisler(id: string): TahminBahsi[] {
    const r = db.prepare('SELECT * FROM prediction_bets WHERE prediction_id = ?').all(String(id)) as any[];
    return r.map((b) => ({
      kullanici: b.kullanici,
      gorunenAd: b.gorunen_ad,
      secenekIndex: b.secenek_index,
      puan: b.puan
    }));
  }

  /** Aktif tahmin + havuz özeti. */
  durum() {
    const t = this.aktif();
    if (!t) return { tahmin: null, havuz: 0, secenekToplam: [] as number[], bahisSayisi: 0 };
    const b = this.bahisler(t.id);
    const secenekToplam = t.secenekler.map((_, i) =>
      b.filter((x) => x.secenekIndex === i).reduce((s, x) => s + x.puan, 0)
    );
    return {
      tahmin: t,
      havuz: b.reduce((s, x) => s + x.puan, 0),
      secenekToplam,
      bahisSayisi: b.length
    };
  }

  olustur(baslik: string, secenekler: string[], kilitDakika = 0): Tahmin | { hata: string } {
    if (this.aktif()) return { hata: 'Zaten açık bir tahmin var. Önce onu sonuçlandırın.' };
    const temiz = (secenekler || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 6);
    if (temiz.length < 2) return { hata: 'En az iki seçenek gerekli.' };

    const t: Tahmin = {
      id: crypto.randomUUID(),
      baslik: String(baslik || 'Tahmin').slice(0, 120),
      secenekler: temiz,
      durum: 'acik',
      kazananIndex: null,
      acilis: Date.now(),
      kapanis: null,
      kilitAni: kilitDakika > 0 ? Date.now() + kilitDakika * 60000 : null
    };

    db.prepare(
      'INSERT INTO predictions (id, baslik, secenekler, durum, acilis, kilit_ani) VALUES (?,?,?,?,?,?)'
    ).run(t.id, t.baslik, JSON.stringify(t.secenekler), t.durum, t.acilis, t.kilitAni);
    return t;
  }

  /** Bahis koyar. Puan ANINDA tahsil edilir. */
  bahisKoy(
    kullanici: string,
    gorunenAd: string,
    secenekGirdi: string,
    puan: number
  ): { ok: true; secenek: string; puan: number } | { ok: false; hata: string } {
    const t = this.aktif();
    if (!t) return { ok: false, hata: 'Açık bir tahmin yok.' };
    if (t.durum !== 'acik') return { ok: false, hata: 'Bahisler kapandı.' };
    if (t.kilitAni && Date.now() > t.kilitAni) {
      this.kilitle();
      return { ok: false, hata: 'Bahis süresi doldu.' };
    }

    const idx = secenekBul(t.secenekler, secenekGirdi);
    if (idx < 0) return { ok: false, hata: `Seçenekler: ${t.secenekler.join(' / ')}` };

    const miktar = Math.floor(Number(puan) || 0);
    if (miktar <= 0) return { ok: false, hata: 'Geçerli bir puan girin.' };

    const bakiye = economy.getUserPoints(kullanici);
    if (bakiye < miktar) return { ok: false, hata: `Yetersiz puan (bakiye: ${bakiye}).` };

    const mevcut = db
      .prepare('SELECT secenek_index FROM prediction_bets WHERE prediction_id = ? AND kullanici = ?')
      .get(t.id, kullanici.toLowerCase()) as { secenek_index?: number } | undefined;
    if (mevcut && mevcut.secenek_index !== idx) {
      return { ok: false, hata: 'Seçeneğini değiştiremezsin, yalnız artırabilirsin.' };
    }

    economy.addPoints(kullanici, -miktar);
    db.prepare(
      `INSERT INTO prediction_bets (prediction_id, kullanici, gorunen_ad, secenek_index, puan)
       VALUES (?,?,?,?,?)
       ON CONFLICT(prediction_id, kullanici) DO UPDATE SET puan = puan + excluded.puan`
    ).run(t.id, kullanici.toLowerCase(), gorunenAd || kullanici, idx, miktar);

    return { ok: true, secenek: t.secenekler[idx], puan: miktar };
  }

  kilitle(): Tahmin | null {
    const t = this.aktif();
    if (!t) return null;
    db.prepare("UPDATE predictions SET durum = 'kilitli' WHERE id = ?").run(t.id);
    return { ...t, durum: 'kilitli' };
  }

  /** Sonuçlandırır ve ödülleri dağıtır. */
  sonuclandir(secenekGirdi: string): { ok: true; kazananlar: number; dagitilan: number; secenek: string } | { ok: false; hata: string } {
    const t = this.aktif();
    if (!t) return { ok: false, hata: 'Açık bir tahmin yok.' };

    const idx = secenekBul(t.secenekler, secenekGirdi);
    if (idx < 0) return { ok: false, hata: `Seçenekler: ${t.secenekler.join(' / ')}` };

    const b = this.bahisler(t.id);
    const odul = odulDagit(b, idx);
    try {
      economy.topluOde(
        odul.filter((o) => o.kazanc > 0).map((o) => ({ kullanici: o.kullanici, puan: o.kazanc })),
        () =>
          db.prepare("UPDATE predictions SET durum = 'kapandi', kazanan_index = ?, kapanis = ? WHERE id = ?").run(
            idx,
            Date.now(),
            t.id
          )
      );
    } catch (e) {
      seyrekUyar('tahmin:sonuc', '[Tahmin] Sonuçlandırılamadı, ödeme geri alındı', e);
      return { ok: false, hata: 'Sonuç kaydedilemedi, kimseye ödeme yapılmadı. Tekrar deneyin.' };
    }

    return {
      ok: true,
      kazananlar: odul.length,
      dagitilan: odul.reduce((s, o) => s + o.kazanc, 0),
      secenek: t.secenekler[idx]
    };
  }

  /** İptal — herkesin puanı iade edilir. */
  iptal(): { ok: boolean; iade: number } {
    const t = this.aktif();
    if (!t) return { ok: false, iade: 0 };
    const b = this.bahisler(t.id);
    try {
      economy.topluOde(
        b.map((x) => ({ kullanici: x.kullanici, puan: x.puan })),
        () => db.prepare("UPDATE predictions SET durum = 'iptal', kapanis = ? WHERE id = ?").run(Date.now(), t.id)
      );
    } catch (e) {
      seyrekUyar('tahmin:iptal', '[Tahmin] İptal edilemedi, iade geri alındı', e);
      return { ok: false, iade: 0 };
    }
    return { ok: true, iade: b.reduce((s, x) => s + x.puan, 0) };
  }
}

export const tahminler = new TahminMotoru();

degisinceBildir(
  tahminler,
  ['olustur', 'bahisKoy', 'kilitle', 'sonuclandir', 'iptal'],
  durumYayinci('tahmin_durumu', () => tahminler.durum())
);
export default tahminler;
