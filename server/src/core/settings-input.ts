/**
 * StreamAxT — `POST /api/settings` gövde doğrulaması (saf)
 * Developed by AxthrowA
 *
 * Uç her anahtar/değeri olduğu gibi yazıyordu: dizi gövde "0", "1" gibi
 * anahtarlar üretiyor, `null` gövde 500 döndürüyor, nesne değerler
 * "[object Object]" olarak kaydediliyor (ayar sessizce bozuluyordu).
 */

/** Mevcut anahtarlar: `cross_chat_enabled`, `widget_settings_chat-overlay`… */
const ANAHTAR = /^[A-Za-z0-9_.-]{1,80}$/;
/** Widget ayarları JSON metni olarak saklanabiliyor; makul bir üst sınır. */
export const AYAR_DEGER_SINIRI = 100_000;

export type AyarGuncellemesi =
  | { ok: true; degerler: Array<[string, string]> }
  | { ok: false; hata: string };

export function ayarGuncellemesiniCoz(govde: unknown): AyarGuncellemesi {
  if (!govde || typeof govde !== 'object' || Array.isArray(govde)) {
    return { ok: false, hata: 'Gövde anahtar-değer nesnesi olmalı' };
  }
  const degerler: Array<[string, string]> = [];
  for (const [anahtar, deger] of Object.entries(govde as Record<string, unknown>)) {
    if (!ANAHTAR.test(anahtar)) return { ok: false, hata: `Geçersiz ayar anahtarı: ${anahtar.slice(0, 40)}` };
    if (deger === null || deger === undefined) {
      degerler.push([anahtar, '']);
      continue;
    }
    if (typeof deger !== 'string' && typeof deger !== 'number' && typeof deger !== 'boolean') {
      return { ok: false, hata: `${anahtar}: değer metin, sayı ya da doğru/yanlış olmalı` };
    }
    const metin = String(deger);
    if (metin.length > AYAR_DEGER_SINIRI) return { ok: false, hata: `${anahtar}: değer çok uzun` };
    degerler.push([anahtar, metin]);
  }
  return { ok: true, degerler };
}
