/**
 * AxthrowA Studio içinde gömülüyken (?embed=1) Studio'nun renkleri bota uygulanır: Studio çerçeveye
 * `{ tur: 'studio-tema', ... }` gönderir. Değerler yalnız CSS değişkeni olarak yazılır; yine de biçimleri süzülür.
 */

export interface StudioTemasi {
  /** Botun kendi temalarından biri (aynı adlı Studio görünümü) ya da Studio renkleriyle 'studio' */
  tema: string;
  degiskenler: Record<string, string>;
}

const IZINLI = ['--axt-zemin', '--axt-yuzey', '--axt-yuzey-2', '--axt-kenar', '--axt-vurgu', '--axt-metin', '--axt-soluk', '--axt-yaricap-kart', '--axt-yaricap-dugme'] as const;
const RENK = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.\s,%/]+\))$/i;
const OLCU = /^\d{1,2}(\.\d+)?(rem|px)$/;
const TEMA = /^[a-z0-9-]{1,30}$/;

/** Gelen iletiyi doğrular; tanınmayan ileti ya da bozuk değer `null`/atlanır. */
export function studioTemasiCoz(veri: unknown): StudioTemasi | null {
  if (!veri || typeof veri !== 'object') return null;
  const v = veri as { tur?: unknown; tema?: unknown; degiskenler?: unknown };
  if (v.tur !== 'studio-tema' || typeof v.tema !== 'string' || !TEMA.test(v.tema)) return null;
  const degiskenler: Record<string, string> = {};
  const ham = (v.degiskenler && typeof v.degiskenler === 'object' ? v.degiskenler : {}) as Record<string, unknown>;
  for (const ad of IZINLI) {
    const d = typeof ham[ad] === 'string' ? (ham[ad] as string).trim() : '';
    if (d && (ad.startsWith('--axt-yaricap') ? OLCU.test(d) : RENK.test(d))) degiskenler[ad] = d;
  }
  return { tema: v.tema, degiskenler };
}
