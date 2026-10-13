/**
 * StreamAxT — medya kütüphanesi
 * Developed by AxthrowA
 *
 * Denetimde bulundu (CURRENT_SYSTEM_AUDIT §11.6): `client/public` BOŞTU,
 * yükleme ucu yoktu; tüm uyarı görselleri ve sesleri yalnız harici URL ile
 * veriliyordu. Bu da (a) internet kesilince uyarıların bozulması,
 * (b) telifli/dış sitelerin kaybolması, (c) OBS'te yavaş yükleme demekti.
 *
 * BotRix'te yükleme var ve boyut sınırı planla değişiyor
 * (ücretsiz 5 MB, premium 50 MB — BOTRIX_UI_INVENTORY §12). Bizde tek
 * sınır var ve yereldir.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db } from '../../db/index.js';

export * from './validate.js';
import { IZINLI, imzadanTur, guvenliAd, MAKS_BOYUT, MAKS_VIDEO, MAKS_TOPLAM, type MedyaOgesi, type MedyaTuru } from './validate.js';

const KOK = path.resolve(process.cwd(), 'data', 'media');

function klasoruHazirla() {
  if (!fs.existsSync(KOK)) fs.mkdirSync(KOK, { recursive: true });
}

class MedyaKutuphanesi {
  constructor() {
    klasoruHazirla();
    db.exec(`
      CREATE TABLE IF NOT EXISTS media_library (
        id          TEXT PRIMARY KEY,
        ad          TEXT NOT NULL,
        tur         TEXT NOT NULL,
        dosya       TEXT NOT NULL,
        boyut       INTEGER NOT NULL,
        mime        TEXT NOT NULL,
        olusturma   INTEGER NOT NULL
      );
    `);
  }

  private satirdanOge(r: any): MedyaOgesi {
    return {
      id: r.id,
      ad: r.ad,
      tur: r.tur,
      dosya: r.dosya,
      boyut: r.boyut,
      mime: r.mime,
      olusturma: r.olusturma,
      url: `/api/media/${r.id}/dosya`
    };
  }

  listele(tur?: MedyaTuru): MedyaOgesi[] {
    const r = tur
      ? db.prepare('SELECT * FROM media_library WHERE tur = ? ORDER BY olusturma DESC').all(tur)
      : db.prepare('SELECT * FROM media_library ORDER BY olusturma DESC').all();
    return (r as any[]).map((x) => this.satirdanOge(x));
  }

  bul(id: string): MedyaOgesi | null {
    const r = db.prepare('SELECT * FROM media_library WHERE id = ?').get(String(id)) as any;
    return r ? this.satirdanOge(r) : null;
  }

  toplamBoyut(): number {
    const r = db.prepare('SELECT COALESCE(SUM(boyut),0) t FROM media_library').get() as { t: number };
    return Number(r?.t) || 0;
  }

  /** Base64 gövdeden yükler. Doğrulama burada, uçta değil. */
  ekle(ad: string, base64: string): { ok: true; oge: MedyaOgesi } | { ok: false; hata: string } {
    let bayt: Buffer;
    try {
      const temiz = String(base64 || '').replace(/^data:[^;]+;base64,/, '');
      bayt = Buffer.from(temiz, 'base64');
    } catch {
      return { ok: false, hata: 'Dosya çözümlenemedi.' };
    }

    if (!bayt.length) return { ok: false, hata: 'Dosya boş.' };
    // Tür içerikten belirlenmeden önce yalnız en geniş sınır (video); türe özgü sınır aşağıda
    if (bayt.length > MAKS_VIDEO) {
      return { ok: false, hata: `Dosya çok büyük (${Math.round(bayt.length / 1024 / 1024)} MB). Üst sınır video için ${MAKS_VIDEO / 1024 / 1024} MB.` };
    }
    if (this.toplamBoyut() + bayt.length > MAKS_TOPLAM) {
      return { ok: false, hata: 'Medya kütüphanesi dolu. Kullanılmayan dosyaları silin.' };
    }

    // İçerikten tür doğrulaması — istemcinin bildirdiğine GÜVENİLMEZ
    const mime = imzadanTur(bayt);
    if (!mime || !IZINLI[mime]) {
      return { ok: false, hata: 'Desteklenmeyen dosya türü. PNG, JPG, GIF, WEBP, MP3, WAV, OGG, MP4 veya WEBM yükleyin.' };
    }
    if (IZINLI[mime].tur !== 'video' && bayt.length > MAKS_BOYUT) {
      return { ok: false, hata: `Dosya çok büyük (${Math.round(bayt.length / 1024 / 1024)} MB). Üst sınır ${MAKS_BOYUT / 1024 / 1024} MB (video ${MAKS_VIDEO / 1024 / 1024} MB).` };
    }

    klasoruHazirla();
    const id = crypto.randomUUID();
    const dosya = id + IZINLI[mime].uzanti;
    fs.writeFileSync(path.join(KOK, dosya), bayt);

    const kayit = {
      id,
      ad: guvenliAd(ad),
      tur: IZINLI[mime].tur,
      dosya,
      boyut: bayt.length,
      mime,
      olusturma: Date.now()
    };
    db.prepare(
      'INSERT INTO media_library (id, ad, tur, dosya, boyut, mime, olusturma) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(kayit.id, kayit.ad, kayit.tur, kayit.dosya, kayit.boyut, kayit.mime, kayit.olusturma);

    return { ok: true, oge: this.satirdanOge(kayit) };
  }

  sil(id: string): boolean {
    const oge = this.bul(id);
    if (!oge) return false;
    try {
      fs.unlinkSync(path.join(KOK, oge.dosya));
    } catch {
      /* dosya zaten yok */
    }
    db.prepare('DELETE FROM media_library WHERE id = ?').run(String(id));
    return true;
  }

  /** Diskteki tam yol — yalnız sunucu içi kullanım. */
  dosyaYolu(oge: MedyaOgesi): string {
    return path.join(KOK, oge.dosya);
  }
}

export const medya = new MedyaKutuphanesi();
export default medya;
