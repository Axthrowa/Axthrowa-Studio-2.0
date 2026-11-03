/**
 * AxBoT — Bil Bakalım soru bankası kalite denetimi ve onarımı (saf; testli)
 * Developed by AxthrowA
 *
 * Bankanın büyük kısmı şablonla üretilmişti ve çoğu bozuktu:
 *  • Anlamsız sorular: "… bilgisi #72: hangisi doğrudur? → Yanlış B72 / Doğru
 *    bilgi 72", "Bir oyuncu 6 sayı attıysa hangi spor? → Dart yalnız …",
 *    "… toplam golü (sadece bu veri) kaçtır? → Diğer 1 …"
 *  • Yer tutucu çeldiriciler cevabı ele veriyordu: "'Dermis' ne demek? →
 *    Bir spor kuralı / Bir müzik notası", "Rize hangi bölgede? → Sahra / Kutup"
 *  • Yazım sorularında bozuk şıklar: "herkezx", "HERKEZ"/"herkez" kopyası
 *
 * Onarım (soru metnine ve doğru cevaba dokunmaz, yalnız çeldiricileri değiştirir):
 *  • Sayısal cevap → yakın sayılar
 *  • Yazım sorusu "doğru yazım hangisi" → doğru sözcüğün yanlış yazımları
 *    ("herkes" → "herkez", "her kes"…); "yanlış yazım hangisi" → doğru yazılmış
 *    başka sözcükler
 *  • Diğerleri → AYNI soru kalıbının (aynı kategori + aynı soru sonu, ör.
 *    "hangi coğrafi bölgededir") diğer doğru cevapları
 * Kesin yer tutucusu onarılamayan soru atılır. Yalnız "bankada çok sık geçen"
 * çeldiriciler (ör. "Mars") onarılabiliyorsa değiştirilir, onarılamıyorsa
 * soru OLDUĞU GİBİ kalır (sağlam soruları silmemek için).
 */

export interface Soru {
  id?: string;
  category: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
}

const HARF = ['A', 'B', 'C', 'D'] as const;
const norm = (s: unknown) => String(s ?? '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
const secenekler = (q: Soru) => [q.optionA, q.optionB, q.optionC, q.optionD];
const SAYI = /^-?\d+$/;

/** Tamamen anlamsız (onarılamaz) şablon soruları */
const COP_SORU = [/bilgisi #\d+/i, /^bir oyuncu \d+ sayı attıysa/i, /\(sadece bu veri\)/i];
const COP_SECENEK = [/^yanlış [a-d]\d+$/i, /^doğru bilgi \d+$/i];

/** Anlamsız doldurma: onarılamazsa soru atılır */
const ANLAMSIZ = [
  /^(sayı adı|renk adı|hayır \(yanlış\)|bilinmeyen isim|anonim|kurgusal kahraman|plaka kodu|pi sayısı|atom numarası|diğer \d+)$/,
  /^sadece (kimya|spor|hava durumu|plaka kodu|yemek tarifi)$/,
  /^bir (spor kuralı|müzik notası|coğrafya terimi|coğrafya tanımı|kimya formülü|müzik makamı)$/
];

/** Yer tutucu çeldiriciler: kalıp havuzu varsa değiştirilir (bağlamda makul olabilir, ör. "Bir gezegen") */
const YER_TUTUCU = [
  /^bir (spor kuralı|nehir|gezegen|dağ|dağ adı|yemek|dans|müzik notası|müzik makamı|coğrafya terimi|coğrafya tanımı|kimya formülü)$/,
  /^(sayı adı|renk adı|hayır \(yanlış\)|bilinmeyen isim|anonim|kurgusal kahraman|plaka kodu|pi sayısı|atom numarası|kimya denklemi|osmanlı fermanı|harita projeksiyonu|taş balta|feodal tımar|mars üssü|kuantum bilgisayar|ışınlanma|yüzme tur sayısı)$/,
  /^sadece /,
  / yalnız$/,
  /\(veya benzeri\)$/,
  /^diğer \d+$/
];

export function copSoruMu(q: Soru): boolean {
  return COP_SORU.some((r) => r.test(q.question)) || secenekler(q).some((s) => COP_SECENEK.some((r) => r.test(norm(s))));
}

export function anlamsizMi(secenek: string): boolean {
  const n = norm(secenek);
  return ANLAMSIZ.some((r) => r.test(n));
}

export function yerTutucuMu(secenek: string): boolean {
  const n = norm(secenek);
  return YER_TUTUCU.some((r) => r.test(n));
}

/** Soru kalıbı: kategori + tırnaklar atılmış sorunun son 3 sözcüğü */
export function kalip(q: Soru): string {
  const govde = norm(q.question)
    .replace(/['‘’"“”][^'‘’"“”]*['‘’"“”]/g, ' ')
    .replace(/[?.!:,;()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return `${q.category}|${govde.slice(-3).join(' ')}`;
}

/** Dört işlem: "38 + 30 = ?" → 68 (çözülemezse null) */
export function islemSonucu(soru: string): number | null {
  const m = String(soru).match(/^\s*(-?\d+)\s*([+\-−×x*÷/:])\s*(-?\d+)\s*=\s*\?\s*$/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[3]);
  switch (m[2]) {
    case '+':
      return a + b;
    case '-':
    case '−':
      return a - b;
    case '×':
    case 'x':
    case '*':
      return a * b;
    default:
      return b !== 0 && a % b === 0 ? a / b : null;
  }
}

/** Deterministik sözde rastgele (aynı soru her çalıştırmada aynı onarımı alsın) */
function tohum(metin: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < metin.length; i++) h = Math.imul(h ^ metin.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function karistir<T>(dizi: T[], r: () => number): T[] {
  const a = [...dizi];
  for (let j = a.length - 1; j > 0; j--) {
    const k = Math.floor(r() * (j + 1));
    [a[j], a[k]] = [a[k], a[j]];
  }
  return a;
}

/** Sayısal cevaba yakın, makul çeldiriciler */
export function yakinSayilar(dogru: number): string[] {
  const fark = Math.max(1, Math.round(Math.abs(dogru) * 0.1));
  const adaylar = [dogru + 1, dogru - 1, dogru + 2, dogru - 2, dogru + fark, dogru - fark, dogru + 10, dogru * 2];
  return [...new Set(adaylar.filter((n) => n !== dogru && (dogru < 0 || n >= 0)).map(String))];
}

/** Doğru yazılmış sözcüğün sık yapılan yanlış yazımları */
export function yanlisYazimlar(dogru: string): string[] {
  const w = String(dogru).trim();
  const kucuk = w.toLocaleLowerCase('tr-TR');
  const out = new Set<string>();
  const harfDegis: Array<[string, string]> = [['s', 'z'], ['z', 's'], ['ı', 'i'], ['i', 'ı'], ['ğ', 'g'], ['ş', 's'], ['ç', 'c'], ['ö', 'o'], ['ü', 'u'], ['k', 'ğ'], ['t', 'd'], ['d', 't']];
  for (const [a, b] of harfDegis) {
    const i = kucuk.lastIndexOf(a);
    if (i >= 0) out.add(kucuk.slice(0, i) + b + kucuk.slice(i + 1));
  }
  if (!kucuk.includes(' ') && kucuk.length >= 6) out.add(`${kucuk.slice(0, Math.floor(kucuk.length / 2))} ${kucuk.slice(Math.floor(kucuk.length / 2))}`);
  if (kucuk.includes(' ')) out.add(kucuk.replace(/ /g, ''));
  if (kucuk.length >= 4) {
    const m = Math.floor(kucuk.length / 2);
    out.add(kucuk.slice(0, m - 1) + kucuk[m] + kucuk[m - 1] + kucuk.slice(m + 1)); // komşu harf yer değişimi
    out.add(kucuk.slice(0, m) + kucuk[m] + kucuk.slice(m)); // harf ikilemesi
  }
  out.delete(kucuk);
  return [...out].filter((x) => x && x !== kucuk);
}

export interface KaliteSonucu {
  /** Değişen sorular (yeni hâliyle) */
  onarilan: Soru[];
  /** Atılması gerekenler */
  atilacak: Soru[];
  rapor: { cop: number; onarildi: number; islemDuzeltildi: number; yapisalAtildi: number; onarilamadi: number };
}

/** Bütün bankayı denetler (havuzlar banka genelinden kurulur). */
export function bankayiDenetle(banka: Soru[]): KaliteSonucu {
  const rapor = { cop: 0, onarildi: 0, islemDuzeltildi: 0, yapisalAtildi: 0, onarilamadi: 0 };
  const onarilan: Soru[] = [];
  const atilacak: Soru[] = [];

  // Kalıp başına doğru cevap havuzu, doğru yazımlar ve banka genelinde sık çeldiriciler
  const havuz = new Map<string, Set<string>>();
  const dogruYazimlar = new Set<string>();
  const ceSay = new Map<string, number>();
  for (const q of banka) {
    const i = HARF.indexOf(q.correctOption as any);
    if (i < 0 || copSoruMu(q)) continue;
    const dogru = String(secenekler(q)[i] ?? '').trim();
    const k = kalip(q);
    if (!havuz.has(k)) havuz.set(k, new Set());
    havuz.get(k)!.add(dogru);
    if (q.category === 'Yazım Yanlışları' && !/yanlış/i.test(q.question) && dogru && !yerTutucuMu(dogru)) dogruYazimlar.add(dogru);
    secenekler(q).forEach((s, j) => {
      if (j !== i) ceSay.set(norm(s), (ceSay.get(norm(s)) || 0) + 1);
    });
  }
  const sik = new Set([...ceSay.entries()].filter(([s, n]) => n >= 40 && !SAYI.test(s)).map(([s]) => s));

  for (const q of banka) {
    if (copSoruMu(q)) {
      rapor.cop++;
      atilacak.push(q);
      continue;
    }
    // "Moğolistan yalnız" → "Moğolistan": şablonun eklediği " yalnız" eki atılır
    const s = secenekler(q).map((x) => String(x ?? '').trim());
    let degisti = false;
    s.forEach((x, j) => {
      const y = x.replace(/\s+yalnız$/i, '').trim();
      if (y && y !== x && !s.some((z, k) => k !== j && norm(z) === norm(y))) {
        s[j] = y;
        degisti = true;
      }
    });
    let dogru = HARF.indexOf(q.correctOption as any);

    // 1) Dört işlem: doğru cevabı hesapla
    const sonuc = islemSonucu(q.question);
    if (sonuc !== null && dogru >= 0 && Number(s[dogru]) !== sonuc) {
      const bulunan = s.findIndex((x) => Number(x) === sonuc);
      if (bulunan >= 0) dogru = bulunan;
      else s[dogru] = String(sonuc);
      degisti = true;
      rapor.islemDuzeltildi++;
    }
    if (dogru < 0) {
      rapor.yapisalAtildi++;
      atilacak.push(q);
      continue;
    }

    // 2) Kötü çeldiriciler: kesin (yer tutucu, "x" eki, büyük-küçük kopya) ve zayıf (bankada çok sık)
    const kesin = s.map((x, j) => {
      if (j === dogru) return false;
      const n = norm(x);
      if (!n || yerTutucuMu(x)) return true;
      if (/x$/.test(n) && s.some((y, k) => k !== j && norm(y) === n.slice(0, -1))) return true;
      return s.some((y, k) => k !== j && (k < j || k === dogru) && norm(y) === n);
    });
    const zayif = s.map((x, j) => j !== dogru && !kesin[j] && sik.has(norm(x)));

    if (kesin.some(Boolean) || zayif.some(Boolean)) {
      const dogruMetin = s[dogru];
      const yazim = q.category === 'Yazım Yanlışları';
      let adaylar: string[];
      if (SAYI.test(dogruMetin.trim())) adaylar = yakinSayilar(Number(dogruMetin));
      else if (yazim && !/yanlış/i.test(q.question)) adaylar = yanlisYazimlar(dogruMetin);
      else if (yazim) adaylar = [...dogruYazimlar];
      else adaylar = [...(havuz.get(kalip(q)) || [])];
      const r = tohum(q.question);
      const kalan = karistir(
        adaylar.filter((a) => a && !yerTutucuMu(a) && !s.some((x, j) => !kesin[j] && !zayif[j] && norm(x) === norm(a))),
        r
      );
      // Önce kesin kötüler doldurulur. Yetmezse: anlamsız/bozuk şık kaldıysa soru
      // atılır; yalnız bağlamda makul olabilecek yer tutucu kaldıysa soru korunur.
      let yetmedi = false;
      for (let j = 0; j < 4; j++) {
        if (!kesin[j]) continue;
        const yeni = kalan.shift();
        if (yeni !== undefined) {
          s[j] = yeni;
          degisti = true;
          continue;
        }
        const n = norm(s[j]);
        const bozuk = !n || anlamsizMi(s[j]) || s.some((y, k) => k !== j && norm(y) === n) || (/x$/.test(n) && s.some((y, k) => k !== j && norm(y) === n.slice(0, -1)));
        if (bozuk) yetmedi = true;
      }
      if (yetmedi) {
        rapor.onarilamadi++;
        atilacak.push(q);
        continue;
      }
      // Zayıflar: aday varsa değiştir, yoksa olduğu gibi kalsın
      for (let j = 0; j < 4; j++) {
        if (!zayif[j]) continue;
        const yeni = kalan.shift();
        if (yeni !== undefined) {
          s[j] = yeni;
          degisti = true;
        }
      }
      if (degisti) rapor.onarildi++;
    }

    // 3) Son yapısal denetim: 4 dolu ve farklı şık
    const n = s.map(norm);
    if (n.some((x) => !x) || new Set(n).size < 4) {
      rapor.yapisalAtildi++;
      atilacak.push(q);
      continue;
    }
    if (degisti) {
      onarilan.push({ ...q, optionA: s[0], optionB: s[1], optionC: s[2], optionD: s[3], correctOption: HARF[dogru] });
    }
  }
  return { onarilan, atilacak, rapor };
}
