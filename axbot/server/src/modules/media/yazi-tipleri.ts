/**
 * WID-5: yüklenen yazı tipleri. Dosya bot veritabanında (BLOB) durur: Studio yedeği veritabanını kopyaladığı
 * için yazı tipleri yedekle birlikte taşınır, ayrı klasör gerekmez. Katmanlar `/api/fonts.css`'i yükler;
 * aile adı yüklerken verilen addır, widget ayarında `"Ad", system-ui, sans-serif` olarak saklanır.
 */
import crypto from 'node:crypto';
import { db } from '../../db/index.js';

export const YAZI_MAKS_BOYUT = 5 * 1024 * 1024;
export const YAZI_MAKS_ADET = 40;

const BICIM: Record<string, { mime: string; format: string }> = {
  ttf: { mime: 'font/ttf', format: 'truetype' },
  otf: { mime: 'font/otf', format: 'opentype' },
  woff: { mime: 'font/woff', format: 'woff' },
  woff2: { mime: 'font/woff2', format: 'woff2' }
};

/** İçerik imzasından biçim (uzantıya güvenilmez) */
export function yaziBicimi(b: Uint8Array): keyof typeof BICIM | null {
  if (b.length < 12) return null;
  const imza = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (imza === 'wOFF') return 'woff';
  if (imza === 'wOF2') return 'woff2';
  if (imza === 'OTTO') return 'otf';
  if ((b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) || imza === 'true') return 'ttf';
  return null;
}

/** Aile adı: CSS'e tırnak içinde yazılır, bu yüzden yalnız harf, rakam, boşluk, - ve _ */
export function yaziAdi(ham: string): string {
  return String(ham || '')
    .trim()
    .replace(/\.(ttf|otf|woff2?)$/i, '')
    .replace(/[^\p{L}\p{N} _-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
}

export interface YaziTipi {
  id: string;
  ad: string;
  bicim: string;
  boyut: number;
  olusturma: number;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS yazi_tipleri (
    id        TEXT PRIMARY KEY,
    ad        TEXT NOT NULL UNIQUE,
    bicim     TEXT NOT NULL,
    veri      BLOB NOT NULL,
    boyut     INTEGER NOT NULL,
    olusturma INTEGER NOT NULL
  );
`);

export const yaziTipleri = {
  listele(): YaziTipi[] {
    return db.prepare('SELECT id, ad, bicim, boyut, olusturma FROM yazi_tipleri ORDER BY ad').all() as unknown as YaziTipi[];
  },

  ekle(adHam: string, base64: string): { ok: true; oge: YaziTipi } | { ok: false; hata: string } {
    const bayt = Buffer.from(String(base64 || '').replace(/^data:[^,]*,/, ''), 'base64');
    if (bayt.length > YAZI_MAKS_BOYUT) return { ok: false, hata: `Yazı tipi dosyası en çok ${YAZI_MAKS_BOYUT / 1024 / 1024} MB olabilir.` };
    const bicim = yaziBicimi(bayt);
    if (!bicim) return { ok: false, hata: 'Desteklenmeyen dosya. TTF, OTF, WOFF ya da WOFF2 yükleyin.' };
    const ad = yaziAdi(adHam);
    if (!ad) return { ok: false, hata: 'Yazı tipine bir ad verin.' };
    const adet = (db.prepare('SELECT COUNT(*) AS n FROM yazi_tipleri').get() as any).n as number;
    const ayni = db.prepare('SELECT id FROM yazi_tipleri WHERE ad = ?').get(ad) as any;
    if (!ayni && adet >= YAZI_MAKS_ADET) return { ok: false, hata: `En çok ${YAZI_MAKS_ADET} yazı tipi yüklenebilir.` };
    // Aynı ad yeniden yüklenirse dosya değişir, ayarlardaki ad geçerli kalır
    const oge: YaziTipi = { id: ayni?.id ?? crypto.randomUUID(), ad, bicim, boyut: bayt.length, olusturma: Date.now() };
    db.prepare('INSERT OR REPLACE INTO yazi_tipleri (id, ad, bicim, veri, boyut, olusturma) VALUES (?, ?, ?, ?, ?, ?)').run(oge.id, ad, bicim, bayt, bayt.length, oge.olusturma);
    return { ok: true, oge };
  },

  sil(id: string): boolean {
    return Number(db.prepare('DELETE FROM yazi_tipleri WHERE id = ?').run(String(id)).changes) > 0;
  },

  dosya(id: string): { veri: Buffer; mime: string } | null {
    const r = db.prepare('SELECT bicim, veri FROM yazi_tipleri WHERE id = ?').get(String(id)) as any;
    return r && BICIM[r.bicim] ? { veri: Buffer.from(r.veri), mime: BICIM[r.bicim].mime } : null;
  },

  /** Her yüklenen yazı tipi için @font-face; adres sürümlü, dosya değişince önbellek tutmaz */
  css(): string {
    return this.listele()
      .map((y) => `@font-face{font-family:"${y.ad}";src:url("/api/fonts/${y.id}/dosya?v=${y.olusturma}") format("${BICIM[y.bicim]?.format ?? 'truetype'}");font-display:swap}`)
      .join('\n');
  }
};
