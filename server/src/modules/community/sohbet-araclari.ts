/**
 * StreamAxT — küçük sohbet araçları: !lurk, !hatirlat, skor tablosu
 * Developed by AxthrowA
 */
import { db } from '../../db/index.js';

/** "10dk", "90sn", "2sa", "1s30dk", "45" (dakika) → saniye; geçersizse 0 */
export function sureCoz(metin: string): number {
  const t = String(metin || '').trim().toLocaleLowerCase('tr-TR');
  if (/^\d{1,4}$/.test(t)) return Number(t) * 60;
  const re = /(\d{1,4})\s*(saniye|saat|sa|sn|s|dakika|dk|d|m|h)/g;
  let toplam = 0;
  let eslesen = '';
  for (let m; (m = re.exec(t)); ) {
    const n = Number(m[1]);
    toplam += /^(sn|saniye|s)$/.test(m[2]) ? n : /^(dk|dakika|d|m)$/.test(m[2]) ? n * 60 : n * 3600;
    eslesen += m[0];
  }
  return eslesen.replace(/\s/g, '') === t.replace(/\s/g, '') ? toplam : 0;
}

/** 1500 sn → "25 dk", 3700 → "1 sa 1 dk" */
export function kisaSure(sn: number): string {
  const s = Math.max(0, Math.round(sn));
  if (s < 60) return `${s} sn`;
  const sa = Math.floor(s / 3600);
  const dk = Math.round((s % 3600) / 60);
  return sa ? `${sa} sa${dk ? ` ${dk} dk` : ''}` : `${dk} dk`;
}

// ── !lurk ─────────────────────────────────────────────────────────────────────
const lurkler = new Map<string, number>();

export function lurkBasla(kullanici: string, simdi = Date.now()): void {
  lurkler.set(kullanici.toLowerCase(), simdi);
  if (lurkler.size > 2000) lurkler.delete(lurkler.keys().next().value as string);
}

/** Lurk'ten dönüş: kaç saniye arka plandaydı (lurk değilse null) */
export function lurkBitir(kullanici: string, simdi = Date.now()): number | null {
  const k = kullanici.toLowerCase();
  const bas = lurkler.get(k);
  if (bas === undefined) return null;
  lurkler.delete(k);
  return Math.round((simdi - bas) / 1000);
}

// ── !hatirlat ────────────────────────────────────────────────────────────────
export const HATIRLATMA_KISI_BASI = 3;
export const HATIRLATMA_EN_UZUN_SN = 12 * 3600;
const hatirlatmalar = new Map<string, Set<NodeJS.Timeout>>();

/** Hatırlatıcı kurar; süre dolunca `gonder` çağrılır. Hata metni ya da null döner. */
export function hatirlatmaKur(kullanici: string, sn: number, gonder: () => void): string | null {
  if (sn < 10) return 'süre en az 10 saniye olmalı';
  if (sn > HATIRLATMA_EN_UZUN_SN) return 'en çok 12 saat sonrası için hatırlatabilirim';
  const k = kullanici.toLowerCase();
  const kume = hatirlatmalar.get(k) || new Set();
  if (kume.size >= HATIRLATMA_KISI_BASI) return `aynı anda en çok ${HATIRLATMA_KISI_BASI} hatırlatman olabilir`;
  const t = setTimeout(() => {
    kume.delete(t);
    if (!kume.size) hatirlatmalar.delete(k);
    gonder();
  }, sn * 1000);
  t.unref?.();
  kume.add(t);
  hatirlatmalar.set(k, kume);
  return null;
}

// ── Skor tablosu ─────────────────────────────────────────────────────────────
export interface SkorTablosu {
  baslik: string;
  takimlar: Array<{ ad: string; renk: string; skor: number }>;
}

export const VARSAYILAN_SKOR: SkorTablosu = {
  baslik: 'SKOR',
  takimlar: [
    { ad: 'Takım 1', renk: '#3b82f6', skor: 0 },
    { ad: 'Takım 2', renk: '#ef4444', skor: 0 }
  ]
};

export function skorOku(): SkorTablosu {
  try {
    const r = db.prepare("SELECT value FROM bot_settings WHERE key = 'skor_tablosu'").get() as { value?: string } | undefined;
    const j = r?.value ? JSON.parse(r.value) : null;
    if (j && Array.isArray(j.takimlar) && j.takimlar.length >= 2) return j;
  } catch {
    /* bozuk kayıt: varsayılan */
  }
  return structuredClone(VARSAYILAN_SKOR);
}

/** Gelen tabloyu doğrular (2-6 takım, adlar kısa, skor tamsayı) ve kaydeder */
export function skorYaz(g: Partial<SkorTablosu>): SkorTablosu {
  const eski = skorOku();
  const takimlar = (Array.isArray(g.takimlar) ? g.takimlar : eski.takimlar).slice(0, 6).map((t, i) => ({
    ad: String(t?.ad ?? `Takım ${i + 1}`).trim().slice(0, 30) || `Takım ${i + 1}`,
    renk: /^#[0-9a-f]{6}$/i.test(String(t?.renk)) ? String(t.renk) : VARSAYILAN_SKOR.takimlar[i % 2].renk,
    skor: Math.max(-999999, Math.min(999999, Math.trunc(Number(t?.skor) || 0)))
  }));
  if (takimlar.length < 2) return eski;
  const yeni: SkorTablosu = { baslik: String(g.baslik ?? eski.baslik).trim().slice(0, 40) || 'SKOR', takimlar };
  db.prepare("INSERT INTO bot_settings (key, value) VALUES ('skor_tablosu', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(yeni));
  return yeni;
}

/** "!skor mavi +2" / "!skor 1 -1" / "!skor 2 =5": takımı ad başı ya da sıra numarasıyla bulur */
export function skorKomutu(t: SkorTablosu, hedef: string, islem: string): SkorTablosu | null {
  const no = Number(hedef);
  const k = hedef.toLocaleLowerCase('tr-TR');
  const i = Number.isInteger(no) && no >= 1 && no <= t.takimlar.length ? no - 1 : t.takimlar.findIndex((x) => x.ad.toLocaleLowerCase('tr-TR').startsWith(k));
  const m = /^([+=-])?(\d{1,6})$/.exec(islem || '+1');
  if (i < 0 || !m) return null;
  const n = Number(m[2]);
  const takimlar = t.takimlar.map((x, j) => (j !== i ? x : { ...x, skor: m[1] === '=' ? n : m[1] === '-' ? x.skor - n : x.skor + n }));
  return { ...t, takimlar };
}

export function skorMetni(t: SkorTablosu): string {
  return `🏆 ${t.baslik}: ` + t.takimlar.map((x) => `${x.ad} ${x.skor}`).join(' — ');
}
