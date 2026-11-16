/**
 * AxBoT — widget ayarı doğrulaması (B2) (saf)
 * Developed by AxthrowA
 *
 * Denetim B2: `POST /api/widgets/:widgetId/settings` gelen HER JSON'u
 * kayıtlı ayarla birleştirip saklıyordu:
 *   • `__proto__` / `constructor` anahtarları süzülmüyordu (prototip
 *     kirletme girişimleri veritabanına ve oradan panele taşınabilirdi),
 *   • boyut/derinlik sınırı yoktu (bozuk bir istemci megabaytlarca veri
 *     yazıp her widget açılışını yavaşlatabilirdi),
 *   • tür denetimi yoktu: sayı olması gereken alana "abc" yazılınca widget
 *     `Number("abc") = NaN` ile bozuk çiziliyordu,
 *   • widget kimliği serbestti (`widget_settings_<her şey>` anahtarı).
 *
 * Şema sunucuda yok (varsayılanlar istemcide), bu yüzden tür denetimi
 * MEVCUT kayıttaki türe göre yapılır: sayı olan alan sayı, mantıksal olan
 * mantıksal kalır. Yeni alanlar serbesttir (widget'lar gelişebilsin).
 */

export const WIDGET_KIMLIGI = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const TEHLIKELI = new Set(['__proto__', 'constructor', 'prototype']);

export const SINIRLAR = {
  /** Toplam JSON boyutu — görsel artık medya kütüphanesinde, 2 MB bol. */
  toplamBayt: 2 * 1024 * 1024,
  derinlik: 8,
  anahtarUzunlugu: 100,
  anahtarSayisi: 2000
};

export type Temizlik =
  | { ok: true; deger: Record<string, unknown>; uyarilar: string[] }
  | { ok: false; hata: string };

function duzNesneMi(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Kayıtlı değerin türüne göre gelen değeri zorlar; olmazsa mevcut kalır. */
function turuKoru(gelen: unknown, mevcut: unknown, yol: string, uyarilar: string[]): unknown {
  if (typeof mevcut === 'number' && typeof gelen !== 'number') {
    const n = typeof gelen === 'string' && gelen.trim() !== '' ? Number(gelen) : NaN;
    if (Number.isFinite(n)) return n;
    uyarilar.push(`"${yol}" sayı olmalı — eski değer (${mevcut}) korundu`);
    return mevcut;
  }
  if (typeof mevcut === 'boolean' && typeof gelen !== 'boolean') {
    if (gelen === 'true' || gelen === 1 || gelen === '1') return true;
    if (gelen === 'false' || gelen === 0 || gelen === '0') return false;
    uyarilar.push(`"${yol}" açık/kapalı olmalı — eski değer korundu`);
    return mevcut;
  }
  return gelen;
}

export function widgetAyariniTemizle(gelen: unknown, mevcut: Record<string, unknown> = {}): Temizlik {
  if (!duzNesneMi(gelen)) return { ok: false, hata: 'Ayar gövdesi bir nesne olmalı.' };

  let bayt = 0;
  try {
    bayt = Buffer.byteLength(JSON.stringify(gelen), 'utf8');
  } catch {
    return { ok: false, hata: 'Ayar JSON olarak yazılamıyor.' };
  }
  if (bayt > SINIRLAR.toplamBayt) {
    return { ok: false, hata: `Ayar çok büyük (${Math.round(bayt / 1024)} KB). Görselleri medya kütüphanesine yükleyin.` };
  }

  const uyarilar: string[] = [];
  let sayac = 0;

  const temizle = (v: unknown, derinlik: number, yol: string): unknown => {
    if (Array.isArray(v)) {
      if (derinlik > SINIRLAR.derinlik) return [];
      return v.map((x, i) => temizle(x, derinlik + 1, `${yol}[${i}]`));
    }
    if (!duzNesneMi(v)) return v;
    if (derinlik > SINIRLAR.derinlik) {
      uyarilar.push(`"${yol}" çok derin — atıldı`);
      return {};
    }
    const cikti: Record<string, unknown> = {};
    for (const [k, deger] of Object.entries(v)) {
      if (TEHLIKELI.has(k)) {
        uyarilar.push(`"${k}" anahtarı güvenlik nedeniyle atıldı`);
        continue;
      }
      if (k.length > SINIRLAR.anahtarUzunlugu) continue;
      if (++sayac > SINIRLAR.anahtarSayisi) break;
      cikti[k] = temizle(deger, derinlik + 1, yol ? `${yol}.${k}` : k);
    }
    return cikti;
  };

  const temiz = temizle(gelen, 0, '') as Record<string, unknown>;
  if (sayac > SINIRLAR.anahtarSayisi) uyarilar.push('Anahtar sayısı sınırı aşıldı — fazlası atıldı');

  // Üst düzey alanlarda tür koruması (widget ayarları düz anahtar/değer)
  for (const [k, v] of Object.entries(temiz)) {
    if (Object.prototype.hasOwnProperty.call(mevcut, k)) temiz[k] = turuKoru(v, mevcut[k], k, uyarilar);
  }

  return { ok: true, deger: temiz, uyarilar };
}
