/**
 * WID-3: internetsiz çalışan hazır uyarı setleri. Her set, uyarı yedeğiyle AYNI paket biçimindedir
 * (`UyariYedegi` + gömülü medya); galeriden seçilince `uyariYedegi.iceAktar` ile uygulanır.
 * Görseller (PNG) ve sesler (WAV) burada koddan üretilir: pakete ikili dosya girmez, dış adres yoktur,
 * ağ kapalıyken de test uyarısı görsel ve sesle oynar. Tasarımlar kendi çizimimizdir.
 */
import zlib from 'node:zlib';
import { YEDEK_SURUMU, type UyariYedegi } from './backup.js';

// ---------------------------------------------------------------- PNG ----

function parca(tur: string, veri: Buffer): Buffer {
  const uz = Buffer.alloc(4);
  uz.writeUInt32BE(veri.length);
  const govde = Buffer.concat([Buffer.from(tur, 'ascii'), veri]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(govde) >>> 0);
  return Buffer.concat([uz, govde, crc]);
}

/** RGBA piksellerden PNG */
export function pngYaz(gen: number, yuk: number, rgba: Uint8Array): Buffer {
  const satirlar = Buffer.alloc((gen * 4 + 1) * yuk);
  for (let y = 0; y < yuk; y++) {
    satirlar[y * (gen * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * gen * 4, gen * 4).copy(satirlar, y * (gen * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(gen, 0);
  ihdr.writeUInt32BE(yuk, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bit, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    parca('IHDR', ihdr),
    parca('IDAT', zlib.deflateSync(satirlar, { level: 9 })),
    parca('IEND', Buffer.alloc(0))
  ]);
}

type Simge = 'kalp' | 'yildiz' | 'elmas' | 'simsek' | 'bayrak';
type Rgb = [number, number, number];

const hex = (h: string): Rgb => [0, 2, 4].map((i) => parseInt(h.slice(1 + i, 3 + i), 16)) as Rgb;
const karistir = (a: Rgb, b: Rgb, t: number): Rgb => a.map((x, i) => x + (b[i] - x) * t) as Rgb;

function cokgenIcinde(x: number, y: number, n: Array<[number, number]>): boolean {
  let ic = false;
  for (let i = 0, j = n.length - 1; i < n.length; j = i++) {
    const [xi, yi] = n[i];
    const [xj, yj] = n[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ic = !ic;
  }
  return ic;
}

const YILDIZ: Array<[number, number]> = Array.from({ length: 10 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 5;
  const r = i % 2 ? 0.24 : 0.58;
  return [Math.cos(a) * r, Math.sin(a) * r + 0.04];
});
const SIMSEK: Array<[number, number]> = [[0.12, -0.6], [-0.32, 0.06], [-0.04, 0.06], [-0.16, 0.6], [0.32, -0.1], [0.04, -0.1], [0.18, -0.6]];
const BAYRAK: Array<[number, number]> = [[-0.36, -0.5], [0.42, -0.34], [-0.26, -0.14], [-0.26, 0.56], [-0.36, 0.56]];

/** Simge içinde mi; koordinatlar rozet yarıçapına göre (-1..1) */
function simgede(s: Simge, x: number, y: number): boolean {
  if (s === 'kalp') {
    const a = x / 0.62;
    const b = -(y - 0.08) / 0.62;
    return (a * a + b * b - 1) ** 3 - a * a * b ** 3 <= 0;
  }
  if (s === 'elmas') return Math.abs(x) / 0.46 + Math.abs(y) / 0.6 <= 1;
  return cokgenIcinde(x, y, s === 'yildiz' ? YILDIZ : s === 'simsek' ? SIMSEK : BAYRAK);
}

/** Yuvarlak rozet: degrade zemin, halka, dış parıltı ve ortada simge (4 alt örnekle yumuşatılmış) */
export function rozet(simge: Simge, renk1: string, renk2: string, simgeRengi: string, boyut = 192): Buffer {
  const [a, b, s] = [hex(renk1), hex(renk2), hex(simgeRengi)];
  const p = new Uint8Array(boyut * boyut * 4);
  const R = 0.8; // rozet yarıçapı (tuvalin yarısına göre); dışı parıltıya kalır
  for (let py = 0; py < boyut; py++) {
    for (let px = 0; px < boyut; px++) {
      let r = 0, g = 0, bl = 0, al = 0;
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const x = ((px + ox) / boyut) * 2 - 1;
        const y = ((py + oy) / boyut) * 2 - 1;
        const d = Math.hypot(x, y);
        let c: Rgb;
        let o: number;
        if (d <= R) {
          const halka = d > R - 0.07;
          if (halka) c = karistir(b, [255, 255, 255], 0.35);
          else if (simgede(simge, x / (R - 0.07), y / (R - 0.07))) c = s;
          else c = karistir(a, b, Math.min(1, Math.max(0, (y + x * 0.4) / 1.6 + 0.5)));
          o = 1;
        } else {
          c = b;
          o = Math.max(0, 1 - (d - R) / 0.2) ** 2 * 0.55;
        }
        r += c[0] * o; g += c[1] * o; bl += c[2] * o; al += o;
      }
      const i = (py * boyut + px) * 4;
      if (al > 0) {
        p[i] = r / al; p[i + 1] = g / al; p[i + 2] = bl / al;
      }
      p[i + 3] = Math.round((al / 4) * 255);
    }
  }
  return pngYaz(boyut, boyut, p);
}

// ---------------------------------------------------------------- WAV ----

type Dalga = 'kare' | 'zil' | 'ucgen';

/** Notalar (Hz, başlangıç sn, süre sn) → 16 bit mono WAV */
export function wavYaz(notalar: Array<[number, number, number]>, dalga: Dalga, ornekleme = 22050): Buffer {
  const sure = Math.max(...notalar.map(([, b, s]) => b + s)) + 0.05;
  const n = Math.ceil(sure * ornekleme);
  const veri = new Float32Array(n);
  for (const [f, bas, uz] of notalar) {
    const i0 = Math.floor(bas * ornekleme);
    const adet = Math.floor(uz * ornekleme);
    for (let k = 0; k < adet && i0 + k < n; k++) {
      const t = k / ornekleme;
      const faz = 2 * Math.PI * f * t;
      const zarf = Math.min(1, t / 0.008) * (dalga === 'zil' ? Math.exp(-t * 4.5) : Math.max(0, 1 - t / uz) ** 1.4);
      const deger =
        dalga === 'kare' ? Math.sign(Math.sin(faz)) * 0.32
        : dalga === 'ucgen' ? (2 / Math.PI) * Math.asin(Math.sin(faz)) * 0.6
        : Math.sin(faz) * 0.55 + Math.sin(faz * 2.76) * 0.18 + Math.sin(faz * 5.4) * 0.07;
      veri[i0 + k] += deger * zarf * 0.5;
    }
  }
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0, 'ascii');
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8, 'ascii');
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(ornekleme, 24);
  b.writeUInt32LE(ornekleme * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36, 'ascii');
  b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, veri[i])) * 32767), 44 + i * 2);
  return b;
}

/** Nota adı → Hz (A4 = 440) */
const nota = (ad: string): number => {
  const m = /^([A-G])(#?)(\d)$/.exec(ad)!;
  const yarim = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1] as 'C'] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12;
  return 440 * 2 ** (yarim / 12);
};
/** Arpej: notalar `aralik` sn arayla, her biri `uz` sn */
const arpej = (adlar: string[], aralik: number, uz: number): Array<[number, number, number]> => adlar.map((a, i) => [nota(a), i * aralik, uz]);

// ---------------------------------------------------------------- setler ----

type Olay = 'follow' | 'sub' | 'gift_sub' | 'tip' | 'kicks' | 'raid' | 'host' | 'milestone';
type SesTuru = 'kisa' | 'parlak' | 'buyuk';

interface SetTanimi {
  id: string;
  ad: string;
  aciklama: string;
  renk1: string;
  renk2: string;
  simgeRengi: string;
  vurgu: string;
  metin: string;
  animasyon: string;
  yaziEfekti: string;
  duzen: string;
  dalga: Dalga;
  sesler: Record<SesTuru, Array<[number, number, number]>>;
}

const OLAYLAR: Record<Olay, { baslik: string; mesaj: string; simge: Simge; ses: SesTuru; sure: number }> = {
  follow: { baslik: 'YENİ TAKİPÇİ!', mesaj: '{user} aileye katıldı!', simge: 'kalp', ses: 'kisa', sure: 5000 },
  sub: { baslik: 'YENİ ABONE!', mesaj: '{user} abone oldu! ({months} ay)', simge: 'yildiz', ses: 'parlak', sure: 7000 },
  gift_sub: { baslik: 'HEDİYE ABONE!', mesaj: '{user} {count} hediye abone gönderdi!', simge: 'yildiz', ses: 'parlak', sure: 7000 },
  tip: { baslik: 'BAĞIŞ GELDİ!', mesaj: '{user} {amount} {currency} gönderdi: "{message}"', simge: 'elmas', ses: 'buyuk', sure: 8000 },
  kicks: { baslik: 'KICKS!', mesaj: '{user} {amount} Kick gönderdi!', simge: 'elmas', ses: 'buyuk', sure: 7000 },
  raid: { baslik: 'BASKIN!', mesaj: '{user} {viewers} izleyiciyle geldi! Hoş geldiniz!', simge: 'simsek', ses: 'buyuk', sure: 8000 },
  host: { baslik: 'HOST!', mesaj: '{user} kanalı host etti ({viewers})', simge: 'simsek', ses: 'kisa', sure: 6000 },
  milestone: { baslik: 'KİLOMETRE TAŞI!', mesaj: '{metin}', simge: 'bayrak', ses: 'parlak', sure: 6000 }
};

const SETLER: SetTanimi[] = [
  {
    id: 'neon-oyun',
    ad: 'Neon Oyun Salonu',
    aciklama: 'Pembe-mor neon rozetler, 8 bit kare dalga sesleri',
    renk1: '#ff2bd6', renk2: '#4c1d95', simgeRengi: '#fdf4ff', vurgu: '#ff2bd6', metin: '#ffffff',
    animasyon: 'zoom', yaziEfekti: 'pulse', duzen: 'stacked', dalga: 'kare',
    sesler: {
      kisa: arpej(['E5', 'B5'], 0.08, 0.14),
      parlak: arpej(['C5', 'E5', 'G5', 'C6'], 0.07, 0.16),
      buyuk: [...arpej(['G4', 'C5', 'E5', 'G5', 'C6'], 0.07, 0.14), [nota('C6'), 0.4, 0.5]]
    }
  },
  {
    id: 'altin-kutlama',
    ad: 'Altın Kutlama',
    aciklama: 'Altın-amber rozetler, çan sesleri',
    renk1: '#fde68a', renk2: '#b45309', simgeRengi: '#78350f', vurgu: '#fbbf24', metin: '#fffbeb',
    animasyon: 'bounce', yaziEfekti: 'shine', duzen: 'stacked', dalga: 'zil',
    sesler: {
      kisa: arpej(['A5', 'E6'], 0.12, 0.9),
      parlak: arpej(['E5', 'G#5', 'B5', 'E6'], 0.11, 1.1),
      buyuk: [...arpej(['C5', 'E5', 'G5', 'C6', 'E6'], 0.1, 1.2), [nota('G6'), 0.55, 1.2]]
    }
  },
  {
    id: 'sakin-gece',
    ad: 'Sakin Gece',
    aciklama: 'Lacivert-turkuaz sade rozetler, yumuşak sesler',
    renk1: '#22d3ee', renk2: '#1e3a8a', simgeRengi: '#ecfeff', vurgu: '#22d3ee', metin: '#e0f2fe',
    animasyon: 'fadeUp', yaziEfekti: 'none', duzen: 'side-by-side', dalga: 'ucgen',
    sesler: {
      kisa: arpej(['G4', 'D5'], 0.15, 0.5),
      parlak: arpej(['D4', 'A4', 'D5', 'F#5'], 0.14, 0.6),
      buyuk: arpej(['C4', 'G4', 'C5', 'E5', 'G5'], 0.13, 0.7)
    }
  }
];

export interface SetOzeti {
  id: string;
  ad: string;
  aciklama: string;
  vurgu: string;
  /** Takipçi rozeti, data: adresi (galeri kartı) */
  onizleme: string;
}

const paketler = new Map<string, UyariYedegi>();

/** Setin uyarı paketi (ilk istekte üretilir, sonra bellekte) */
export function setPaketi(id: string): UyariYedegi | null {
  const set = SETLER.find((s) => s.id === id);
  if (!set) return null;
  const hazir = paketler.get(id);
  if (hazir) return hazir;
  const medya: NonNullable<UyariYedegi['medya']> = [];
  const gomulu = new Map<string, string>();
  const ekle = (anahtar: string, ad: string, veri: Buffer) => {
    if (!gomulu.has(anahtar)) {
      // Paket içi kimlik: içe aktarma bunu kütüphanedeki yeni kimliğe çevirir
      const eskiId = `00000000-0000-4000-8000-${(gomulu.size + 1).toString(16).padStart(12, '0')}`;
      gomulu.set(anahtar, eskiId);
      medya.push({ eskiId, ad, veri: veri.toString('base64') });
    }
    return `/api/media/${gomulu.get(anahtar)}/dosya`;
  };
  const presets = (Object.entries(OLAYLAR) as Array<[Olay, (typeof OLAYLAR)[Olay]]>).map(([olay, o]) => ({
    event_type: olay,
    title_template: o.baslik,
    message_template: o.mesaj,
    image_url: ekle(`g-${o.simge}`, `${set.ad} ${o.simge}.png`, rozet(o.simge, set.renk1, set.renk2, set.simgeRengi)),
    sound_url: ekle(`s-${o.ses}`, `${set.ad} ${o.ses}.wav`, wavYaz(set.sesler[o.ses], set.dalga)),
    duration_ms: o.sure,
    font_family: 'Plus Jakarta Sans',
    text_color: set.metin,
    accent_color: set.vurgu,
    animation: set.animasyon,
    sound_volume: 0.7,
    is_enabled: 1,
    layout_mode: set.duzen,
    text_effect: set.yaziEfekti
  }));
  const paket: UyariYedegi = { surum: YEDEK_SURUMU, olusturma: 0, uygulama: 'AxBoT', presets, varyantlar: [], gelismis: {}, medya };
  paketler.set(id, paket);
  return paket;
}

export function setleriListele(): SetOzeti[] {
  return SETLER.map((s) => ({
    id: s.id,
    ad: s.ad,
    aciklama: s.aciklama,
    vurgu: s.vurgu,
    onizleme: `data:image/png;base64,${rozet('kalp', s.renk1, s.renk2, s.simgeRengi, 96).toString('base64')}`
  }));
}
