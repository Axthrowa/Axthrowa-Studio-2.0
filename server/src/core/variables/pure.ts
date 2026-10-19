/**
 * StreamAxT — değişken motorunun saf yardımcıları
 * Developed by AxthrowA
 *
 * Veritabanı veya ağ erişimi YOK. Bu sayede test edilebilirler ve
 * `registry.ts` yüklenmeden çalıştırılabilirler.
 */

/** Sayıyı okunur biçimde yaz. */
export function sayi(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Süreyi "2 saat 5 dakika" gibi yazar. */
export function sureMetni(ms: number, gecmis = false): string {
  const t = Math.abs(ms);
  const dk = Math.floor(t / 60000);
  const sa = Math.floor(dk / 60);
  const gun = Math.floor(sa / 24);
  const yil = Math.floor(gun / 365);

  const parcalar: string[] = [];
  if (yil) parcalar.push(`${yil} yıl`);
  if (gun % 365) parcalar.push(`${gun % 365} gün`);
  if (sa % 24) parcalar.push(`${sa % 24} saat`);
  if (dk % 60) parcalar.push(`${dk % 60} dakika`);
  if (!parcalar.length) parcalar.push('birkaç saniye');

  const metin = parcalar.slice(0, 3).join(' ');
  return gecmis ? `${metin} önce` : metin;
}

/** Güvenli matematik: yalnız sayı, operatör ve parantez. */
export function matematik(ifade: string): string {
  const temiz = String(ifade || '').trim();
  if (!temiz) return '0';
  // Değerlendirmeden ÖNCE beyaz liste: harf veya çağrı geçemez.
  if (!/^[\d\s+\-*/%().,]+$/.test(temiz)) return '(math geçersiz)';
  if (temiz.length > 120) return '(math çok uzun)';
  try {
    const sonuc = ifadeHesapla(temiz.replace(/,/g, '.'));
    if (!Number.isFinite(sonuc)) return '(math geçersiz)';
    return sayi(sonuc);
  } catch {
    return '(math geçersiz)';
  }
}

/**
 * Dört işlem, mod, üs (**), parantez ve tekli eksi için özyinelemeli
 * çözümleyici. Eskiden beyaz listeden sonra `Function(...)` ile
 * değerlendiriliyordu; artık hiçbir kod çalıştırılmaz. Hatalı ifadede fırlatır.
 */
export function ifadeHesapla(ifade: string): number {
  const s = ifade.replace(/\s+/g, '');
  let i = 0;
  let derinlik = 0;
  const hata = () => {
    throw new Error('geçersiz ifade');
  };
  const sayiOku = (): number => {
    const m = /^\d+(\.\d+)?|^\.\d+/.exec(s.slice(i));
    if (!m) return hata();
    i += m[0].length;
    return Number(m[0]);
  };
  const birim = (): number => {
    if (s[i] === '-') {
      i++;
      return -birim();
    }
    if (s[i] === '+') {
      i++;
      return birim();
    }
    if (s[i] === '(') {
      if (++derinlik > 20) hata();
      i++;
      const v = toplam();
      if (s[i] !== ')') hata();
      i++;
      derinlik--;
      return v;
    }
    return sayiOku();
  };
  const us = (): number => {
    const taban = birim();
    if (s.startsWith('**', i)) {
      i += 2;
      return Math.pow(taban, us());
    }
    return taban;
  };
  const carpim = (): number => {
    let v = us();
    for (;;) {
      const c = s[i];
      if (c === '*' && s[i + 1] !== '*') {
        i++;
        v *= us();
      } else if (c === '/') {
        i++;
        const b = us();
        if (b === 0) hata();
        v /= b;
      } else if (c === '%') {
        i++;
        const b = us();
        if (b === 0) hata();
        v %= b;
      } else return v;
    }
  };
  const toplam = (): number => {
    let v = carpim();
    for (;;) {
      if (s[i] === '+') {
        i++;
        v += carpim();
      } else if (s[i] === '-') {
        i++;
        v -= carpim();
      } else return v;
    }
  };
  const v = toplam();
  if (i !== s.length) hata();
  return v;
}

/** JSON yolundan değer okur: `profile.coins`, `items[0].name`. */
export function jsonYolu(veri: unknown, yol: string): unknown {
  const parcalar = String(yol || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let o: any = veri;
  for (const p of parcalar) {
    if (o === null || o === undefined) return undefined;
    o = o[p];
  }
  return o;
}

/** Prototip kirletmeye açılan yol parçaları (`__proto__` vb.) — yazma/silmede reddedilir. */
const YASAK_PARCA = new Set(['__proto__', 'prototype', 'constructor']);
/** Sohbetten yazılan JSON değişkeni sınırsız büyümesin */
export const JSON_DEGISKEN_SINIRI = 8000;

function yolParcalari(yol: string): string[] | null {
  const p = String(yol || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  if (!p.length || p.length > 16 || p.some((x) => YASAK_PARCA.has(x))) return null;
  return p;
}

/** Değer JSON olarak ayrıştırılabiliyorsa (sayı, true, {"a":1}) öyle, değilse düz metin saklanır. */
export function jsonDegeri(ham: string): unknown {
  const t = String(ham ?? '');
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

/**
 * `veri` içinde yolu yazar (ara nesneleri oluşturur), yeni kopyayı döner. Geçersiz yol → `null`.
 * `items[0].name` gibi dizi indisleri desteklenir.
 */
export function jsonYoluYaz(veri: unknown, yol: string, deger: unknown): unknown | null {
  const p = yolParcalari(yol);
  if (!p) return null;
  const kok: any = veri && typeof veri === 'object' ? JSON.parse(JSON.stringify(veri)) : {};
  let o: any = kok;
  for (let i = 0; i < p.length - 1; i++) {
    const sonraki = p[i + 1];
    if (o[p[i]] === null || typeof o[p[i]] !== 'object') o[p[i]] = /^\d+$/.test(sonraki) ? [] : {};
    o = o[p[i]];
  }
  o[p[p.length - 1]] = deger;
  return kok;
}

/** Yolu siler, yeni kopyayı döner. Geçersiz yol → `null`; yol yoksa veri aynen döner. */
export function jsonYoluSil(veri: unknown, yol: string): unknown | null {
  const p = yolParcalari(yol);
  if (!p) return null;
  if (!veri || typeof veri !== 'object') return veri;
  const kok: any = JSON.parse(JSON.stringify(veri));
  let o: any = kok;
  for (let i = 0; i < p.length - 1; i++) {
    if (o === null || typeof o !== 'object') return kok;
    o = o[p[i]];
  }
  if (o && typeof o === 'object') {
    if (Array.isArray(o) && /^\d+$/.test(p[p.length - 1])) o.splice(Number(p[p.length - 1]), 1);
    else delete o[p[p.length - 1]];
  }
  return kok;
}

/**
 * `+1`, `-10`, `5` gibi bir ifadeyi ayrıştırır.
 * İşaretli ise göreli (fark), değilse mutlak değerdir.
 */
export function sayacIfadesi(ham: string): { tur: 'fark' | 'mutlak' | 'oku'; deger: number } {
  const t = String(ham || '').trim();
  if (!t) return { tur: 'oku', deger: 0 };
  if (/^[+-]/.test(t)) {
    const n = Number(t);
    return Number.isFinite(n) ? { tur: 'fark', deger: n } : { tur: 'oku', deger: 0 };
  }
  const n = Number(t);
  return Number.isFinite(n) ? { tur: 'mutlak', deger: n } : { tur: 'oku', deger: 0 };
}
