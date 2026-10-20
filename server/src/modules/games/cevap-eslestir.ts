/**
 * StreamAxT — sohbet cevabı eşleştirme (saf)
 * Developed by AxthrowA
 *
 * Kullanıcı bildirdi: "Bilgi yarışmasında cevap sohbete yazılınca bot
 * algılamıyor." Asıl sebep Kick sohbetinin hiç okunamamasıydı (bkz.
 * platforms/kick-realtime-protokol.ts), ama eşleştirmenin kendisinde de
 * gerçek hatalar vardı:
 *  - `toLowerCase()` Türkçe değil: "İstanbul" → "i̇stanbul" (noktalı i + birleşik
 *    nokta), "KIRMIZI" → "kirmizi"; seçenek/cevap metniyle tutmuyordu.
 *  - "A)", "a.", "cevap b", "C şıkkı!", "@bot d" gibi doğal yazımlar reddediliyordu.
 *  - Kısa cevaplar (ör. "au") kelimenin İÇİNDE aranıyordu: "aura" yazan da kazanıyordu.
 *  - ASCII tutulan bulmaca kelimeleri ("yayin") Türkçe yazılınca ("yayın") tutmuyordu.
 */
import { trKatla } from '../../core/text.js';

export type Sik = 'A' | 'B' | 'C' | 'D';

/** Karşılaştırma biçimi: Türkçe katlama, emote/etiket/noktalama temizliği, tek boşluk. */
export function cevapBicimi(metin: string): string {
  return trKatla(
    String(metin ?? '')
      .replace(/\[emote:\d+:[^\]]*\]/g, ' ') // Kick emote'u
      .replace(/<a?:\w+:\d+>/g, ' ') // Discord emojisi
      .replace(/(^|\s)@[\w.]+/g, ' ') // @etiket
  )
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const SIK_HARFLERI: Record<string, Sik> = { a: 'A', b: 'B', c: 'C', d: 'D', '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
/** Şıktan önce gelebilen sözcükler: "cevap b", "cevabım c", "bence d", "şık a". */
const ON_SOZCUKLER = new Set(['cevap', 'cevabim', 'cevabi', 'cvp', 'bence', 'sik', 'secenek', 'yanit', 'yanitim']);
/** Şıktan sonra gelebilen sözcükler: "a şıkkı", "b seçeneği", "c olmalı". */
const SON_SOZCUKLER = new Set(['sikki', 'sik', 'secenegi', 'secenek', 'olmali', 'olsun', 'kesin', 'bence', 'diyorum', 'cevap']);

/**
 * Sohbet mesajından şık çıkarır. Önce harf/rakam (yalnız başına ya da
 * yukarıdaki kalıplarla), sonra seçenek metni (tam kelime; birden çok seçenek
 * tutarsa en uzunu, eşitse belirsiz → null).
 */
export function sikCoz(metin: string, secenekler?: Partial<Record<Sik, string>>): Sik | null {
  const ham = String(metin ?? '').trim();
  const b = cevapBicimi(ham);
  if (!b) return null;
  const kelimeler = b.split(' ');

  // 0) Mesaj bir seçeneğin metniyle BİREBİR aynıysa o kazanır ("4 İşlem"de
  //    seçenek "4" iken "4" yazan D değil o seçeneği kastediyor)
  if (secenekler) {
    const tam = (['A', 'B', 'C', 'D'] as Sik[]).filter((s) => cevapBicimi(secenekler[s] || '') === b);
    if (tam.length === 1) return tam[0];
  }

  // 1) Harf / rakam
  const ilk = kelimeler[0];
  if (SIK_HARFLERI[ilk]) {
    if (kelimeler.length === 1) return SIK_HARFLERI[ilk];
    // "a şıkkı", "b olmalı" … ya da noktalama ile ayrılmış "A) Ankara", "c. seçenek", "d - bence"
    if (SON_SOZCUKLER.has(kelimeler[1])) return SIK_HARFLERI[ilk];
    const ayrac = ham.replace(/^@[\w.]+\s*/, '').match(/^[a-dA-D1-4]\s*[).:\-!,]/);
    if (ayrac) return SIK_HARFLERI[ilk];
    // "a ankara" gibi şık + seçenek metni
    if (secenekler) {
      const sik = SIK_HARFLERI[ilk];
      const metni = cevapBicimi(secenekler[sik] || '');
      if (metni && kelimeler.slice(1).join(' ') === metni) return sik;
    }
    // Eski davranış: "a " ile başlayan kısa mesaj (en çok 3 kelime) şık sayılır
    if (kelimeler.length <= 3 && /^[a-dA-D1-4]\s/.test(ham.replace(/^@[\w.]+\s*/, ''))) return SIK_HARFLERI[ilk];
  }
  if (kelimeler.length >= 2 && ON_SOZCUKLER.has(kelimeler[0]) && SIK_HARFLERI[kelimeler[1]] && kelimeler.length <= 3) {
    return SIK_HARFLERI[kelimeler[1]];
  }

  // 2) Seçenek metni
  if (!secenekler) return null;
  const aranan = ` ${b} `;
  const tutanlar: Array<{ sik: Sik; metin: string }> = [];
  for (const sik of ['A', 'B', 'C', 'D'] as Sik[]) {
    const s = cevapBicimi(secenekler[sik] || '');
    if (!s) continue;
    if (b === s || (s.length > 3 && aranan.includes(` ${s} `)) || b.replace(/ /g, '') === s.replace(/ /g, '')) {
      tutanlar.push({ sik, metin: s });
    }
  }
  // İç içe seçenekler ("Ankara" / "Ankara ve İzmir"): kapsanan kısa olan elenir.
  // Birbirinden bağımsız iki seçenek birden yazılmışsa belirsizdir → oy sayılmaz.
  const kalan = tutanlar.filter(
    (t) => !tutanlar.some((u) => u !== t && u.metin.length > t.metin.length && ` ${u.metin} `.includes(` ${t.metin} `))
  );
  return kalan.length === 1 ? kalan[0].sik : null;
}

/**
 * Serbest cevaplı soru (ör. `!trivia` mini oyunu): mesaj kabul edilen
 * cevaplardan birini TAM KELİME olarak içeriyor mu? Boşluksuz yazım da kabul
 * ("los santos" = "lossantos").
 */
export function serbestCevapDogruMu(metin: string, cevaplar: string[]): boolean {
  const b = cevapBicimi(metin);
  if (!b) return false;
  const aranan = ` ${b} `;
  const bitisik = b.replace(/ /g, '');
  return cevaplar.some((c) => {
    const k = cevapBicimi(c);
    if (!k) return false;
    return aranan.includes(` ${k} `) || bitisik === k.replace(/ /g, '');
  });
}

/** Kelime bulmacası: mesajın kendisi ya da ilk kelimesi hedef kelime mi? */
export function kelimeTuttuMu(metin: string, hedef: string): boolean {
  const b = cevapBicimi(metin);
  const h = cevapBicimi(hedef);
  if (!b || !h) return false;
  return b === h || b.split(' ')[0] === h;
}
