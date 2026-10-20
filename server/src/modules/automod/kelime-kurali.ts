/**
 * StreamAxT — kara liste kelime kuralları ve Zalgo tespiti (saf)
 * Developed by AxthrowA
 *
 * Kara liste eskiden yalnız düz alt metin arıyordu ve `toLowerCase()` Türkçe
 * değildi ("KÜFÜR" tutuyordu ama "küfur" ya da "KUFUR" tutmuyordu). Yaygın
 * botlarda gözlenen (herkese açık belgeler, 2026-10) iki yazım eklendi:
 *  - joker: `test*` → "test", "testing", "testçi" (kelime başından)
 *  - düzenli ifade: `~/desen/bayraklar` (ör. `~/(\d{3}[-.])?\d{3}[-.]\d{4}/`)
 * Düzenli ifadeler kayıtta denetlenir: derlenmeyen ya da iç içe niceleyici
 * içeren (felaket geri izleme — `(a+)+`, `(a*)*`) desenler REDDEDİLİR.
 */
import { trKatla } from '../../core/text.js';

export type KelimeKuraliTuru = 'metin' | 'joker' | 'regex';

export interface KelimeKurali {
  ham: string;
  tur: KelimeKuraliTuru;
  /** `metin` ve `joker` Türkçe katlanmış metinde, `regex` ham metinde aranır. */
  ifade?: RegExp;
  katli?: string;
}

/** Düzenli ifade en çok bu uzunlukta metne uygulanır (zaman sınırı yerine). */
export const REGEX_METIN_SINIRI = 600;
export const REGEX_DESEN_SINIRI = 200;

/**
 * Felaket geri izleme riski: niceleyicili bir grubun kendisi de nicelenmişse
 * (`(a+)+`, `(\w*)*`, `(x|y+){2,}`) desen reddedilir. Kaba ama güvenli.
 */
export function regexGuvenliMi(desen: string): boolean {
  if (!desen || desen.length > REGEX_DESEN_SINIRI) return false;
  // Geri başvuru ve ileri/geri bakışta çok uzun alternatifler — basit tut
  if (/\\[1-9]/.test(desen)) return false;
  return !/\((?:[^()\\]|\\.)*[+*}](?:[^()\\]|\\.)*\)\s*[+*{]/.test(desen);
}

function kacisla(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Tek satırlık kara liste girdisini derler; geçersizse `null`. */
export function kelimeKuraliDerle(girdi: string): KelimeKurali | null {
  const ham = String(girdi ?? '').trim();
  if (!ham) return null;
  const rx = ham.match(/^~\/(.+)\/([a-z]*)$/i);
  if (rx) {
    const [, desen, bayrakHam] = rx;
    if (!regexGuvenliMi(desen)) return null;
    const bayrak = [...new Set(bayrakHam.toLowerCase().replace(/[^imsu]/g, ''))].join('');
    try {
      return { ham, tur: 'regex', ifade: new RegExp(desen, bayrak) };
    } catch {
      return null;
    }
  }
  const katli = trKatla(ham);
  if (!katli) return null;
  if (katli.includes('*')) {
    const govde = katli
      .split('*')
      .map(kacisla)
      .join('[^\\s]*');
    const basta = katli.startsWith('*') ? '' : '(?<![\\p{L}\\p{N}])';
    try {
      return { ham, tur: 'joker', ifade: new RegExp(basta + govde, 'u') };
    } catch {
      return null;
    }
  }
  return { ham, tur: 'metin', katli };
}

/** Bir listeyi derler; geçersizleri ayrı döner (panel kayıtta gösterebilsin). */
export function kelimeListesiDerle(girdiler: unknown): { kurallar: KelimeKurali[]; gecersiz: string[] } {
  const kurallar: KelimeKurali[] = [];
  const gecersiz: string[] = [];
  for (const g of Array.isArray(girdiler) ? girdiler : []) {
    const s = String(g ?? '').trim();
    if (!s) continue;
    const k = kelimeKuraliDerle(s);
    if (k) kurallar.push(k);
    else gecersiz.push(s);
  }
  return { kurallar, gecersiz };
}

/** Mesajda eşleşen ilk kuralın ham metni; yoksa `null`. */
export function kelimeEslesmesi(kurallar: KelimeKurali[], metin: string): string | null {
  const ham = String(metin ?? '');
  if (!ham) return null;
  const katli = trKatla(ham);
  const kirpik = ham.slice(0, REGEX_METIN_SINIRI);
  for (const k of kurallar) {
    if (k.tur === 'metin') {
      if (k.katli && katli.includes(k.katli)) return k.ham;
    } else if (k.tur === 'joker') {
      if (k.ifade?.test(katli)) return k.ham;
    } else if (k.ifade) {
      k.ifade.lastIndex = 0;
      if (k.ifade.test(kirpik)) return k.ham;
    }
  }
  return null;
}

/**
 * Zalgo yazı: harflerin üstüne/altına yığılmış birleşik işaretler. Türkçe
 * metin önceden birleşik karakter kullanır (ç, ğ, ş…); tek harfte 3+ ardışık
 * birleşik işaret ya da işaretlerin harflere oranı yüksekse Zalgo sayılır.
 */
export function zalgoMu(metin: string, ardisikEsik = 3): boolean {
  const s = String(metin ?? '');
  if (!s) return false;
  let ardisik = 0;
  let isaret = 0;
  let harf = 0;
  for (const ch of s) {
    if (/\p{M}/u.test(ch)) {
      isaret++;
      ardisik++;
      if (ardisik >= ardisikEsik) return true;
    } else {
      ardisik = 0;
      if (/\p{L}/u.test(ch)) harf++;
    }
  }
  return harf > 0 && isaret >= 6 && isaret / harf > 0.5;
}
