/**
 * AxBoT — !atla oyunu: fizik ve puan (saf)
 * Developed by AxthrowA
 *
 * İzleyici `!atla [emote]` yazınca karakteri ekranın tepesinden düşer, paraşütü açılır, rüzgârla süzülür ve
 * alttaki hedefe iner. Hedefin ortasına uzaklığa göre 1–100 puan; hedef dışına iniş 0. Karakterler birbirine
 * çarpıp iter, kenarlardan seker. Pixel Plush "drop", Paira Atla ve haliphax/drop-game'deki davranışlardan
 * esinlenildi; kod sıfırdan yazıldı (onlardan alınan satır yok).
 *
 * Birimler: piksel ve saniye, 1080 yükseklikli ekrana göre; `olcek` gerçek ekran yüksekliği / 1080.
 * Fizik sabit adımlıdır (1/120 sn): ekran 30, 60 ya da 144 FPS çizse de iniş noktası aynı olur.
 */

export const ADIM_SN = 1 / 120;

export interface AtlaAyari {
  /** Karakter genişliği (px, 1080p) */
  boyut: number;
  /** Hedef genişliği (px, 1080p) */
  hedefGenislik: number;
  /** Yerçekimi katsayısı (1 = varsayılan) */
  yercekimi: number;
  /** Rüzgâr gücü: 0 = yok, 1 = varsayılan, 3 = fırtına */
  ruzgar: number;
  /** Paraşütlü iniş hızı katsayısı (1 = varsayılan; büyüdükçe hızlı iner) */
  inisHizi: number;
  /** Karakterler birbirine çarpsın */
  carpisma: boolean;
}

export const ATLA_FIZIK_VARSAYILAN: AtlaAyari = { boyut: 72, hedefGenislik: 320, yercekimi: 1, ruzgar: 1, inisHizi: 1, carpisma: true };

export interface Atlayan {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Uçuştaki süre (sn) */
  t: number;
  /** Salınım evresi (her karakterde farklı) */
  evre: number;
  /** Paraşüt açıldı mı */
  parasut: boolean;
  /** Yere indi mi; indiyse puanı */
  indi: boolean;
  puan: number;
  /** Yan yana iniş için yere değdiği yer */
  inisX: number;
}

export interface Dunya {
  W: number;
  H: number;
  olcek: number;
  /** Zemin çizgisi (karakter merkezinin ineceği y) */
  zemin: number;
  /** Hedef merkezi (x) */
  hedefX: number;
  /** Bu tur esen rüzgâr (px/sn, 1080p); eksi sola */
  ruzgar: number;
}

/** Hedefin konumu: kenarlara taşmadan, bir önceki konumdan en az hedef genişliği kadar uzakta. */
export function hedefKonumu(W: number, genislik: number, onceki: number | null, r: () => number = Math.random): number {
  const yari = genislik / 2;
  const sol = yari + 20;
  const sag = Math.max(sol, W - yari - 20);
  for (let i = 0; i < 8; i++) {
    const x = sol + r() * (sag - sol);
    if (onceki === null || Math.abs(x - onceki) >= Math.min(genislik, (sag - sol) / 2)) return x;
  }
  return sol + r() * (sag - sol);
}

/** Tur rüzgârı: −1…1 arası yön × güç × 70 px/sn */
export function turRuzgari(guc: number, r: () => number = Math.random): number {
  return (r() * 2 - 1) * Math.max(0, Math.min(3, guc)) * 70;
}

/** İnişte puan: hedefin ortasına uzaklığa göre 1–100; dışarıda 0. */
export function inisPuani(x: number, hedefX: number, hedefGenislik: number): number {
  const yari = hedefGenislik / 2;
  const d = Math.abs(x - hedefX);
  if (d > yari) return 0;
  return Math.max(1, Math.min(100, Math.round(100 * (1 - d / yari))));
}

export function yeniAtlayan(id: string, d: Dunya, a: AtlaAyari, r: () => number = Math.random): Atlayan {
  const yari = (a.boyut * d.olcek) / 2;
  return {
    id,
    x: yari + r() * Math.max(0, d.W - 2 * yari),
    y: -yari * 2,
    // Uçaktan atlar gibi: biraz yana savrulma, aşağı başlangıç hızı
    vx: (r() * 2 - 1) * 260 * d.olcek,
    vy: 40 * d.olcek,
    t: 0,
    evre: r() * Math.PI * 2,
    parasut: false,
    indi: false,
    puan: 0,
    inisX: 0
  };
}

/**
 * Bir sabit adım. Serbest düşüş → paraşüt açılır (ekranın %16'sında ya da 0,7 sn sonra) → sürüklenme:
 * dikey hız iniş hızına, yatay hız rüzgâr + salınıma yaklaşır. Kenarlarda seker.
 */
export function adim(k: Atlayan, d: Dunya, a: AtlaAyari, dt = ADIM_SN): void {
  if (k.indi) return;
  const o = d.olcek;
  const yari = (a.boyut * o) / 2;
  k.t += dt;
  if (!k.parasut && (k.y > d.H * 0.16 || k.t > 0.7)) k.parasut = true;
  if (!k.parasut) {
    k.vy += 1400 * o * a.yercekimi * dt;
    k.vx *= 1 - 0.4 * dt;
  } else {
    const inis = 135 * o * Math.max(0.3, a.inisHizi) * Math.sqrt(Math.max(0.2, a.yercekimi));
    k.vy += (inis - k.vy) * Math.min(1, 2.6 * dt);
    const hedefVx = d.ruzgar * o + Math.sin(k.t * 1.6 + k.evre) * 55 * o;
    k.vx += (hedefVx - k.vx) * Math.min(1, 0.9 * dt);
  }
  k.x += k.vx * dt;
  k.y += k.vy * dt;
  if (k.x < yari) {
    k.x = yari;
    k.vx = Math.abs(k.vx) * 0.7;
  } else if (k.x > d.W - yari) {
    k.x = d.W - yari;
    k.vx = -Math.abs(k.vx) * 0.7;
  }
  if (k.y >= d.zemin) {
    k.y = d.zemin;
    k.indi = true;
    k.inisX = k.x;
    k.vx = 0;
    k.vy = 0;
    k.puan = inisPuani(k.x, d.hedefX, a.hedefGenislik * o);
  }
}

/** Havadaki karakterler birbirini iter (daire çarpışması, kütleler eşit). İnmiş olanlar etkilenmez. */
export function carpistir(liste: Atlayan[], a: AtlaAyari, olcek: number): void {
  const r = (a.boyut * olcek) / 2;
  const enAz = r * 1.6;
  for (let i = 0; i < liste.length; i++) {
    const p = liste[i];
    if (p.indi) continue;
    for (let j = i + 1; j < liste.length; j++) {
      const q = liste[j];
      if (q.indi) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const uz2 = dx * dx + dy * dy;
      if (uz2 >= enAz * enAz) continue;
      const uz = Math.sqrt(uz2) || 0.01;
      const nx = uz2 ? dx / uz : 1;
      const ny = uz2 ? dy / uz : 0;
      const ort = (enAz - uz) / 2;
      p.x -= nx * ort;
      p.y -= ny * ort;
      q.x += nx * ort;
      q.y += ny * ort;
      // Normal doğrultudaki hız farkı yansır (geri sekme 0,6)
      const g = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
      if (g < 0) {
        const itki = -(1 + 0.6) * g * 0.5;
        p.vx -= itki * nx;
        p.vy -= itki * ny;
        q.vx += itki * nx;
        q.vy += itki * ny;
      }
    }
  }
}

/** `dt` kadar geçen zamanı sabit adımlarla ilerletir; artan zaman döner (bir sonraki karede kullanılır). */
export function ilerlet(liste: Atlayan[], d: Dunya, a: AtlaAyari, dt: number, artan = 0): number {
  // Sekme uzun süre arka planda kalınca tek seferde dakikalarca ilerlemesin
  let kalan = Math.min(0.25, dt) + artan;
  while (kalan >= ADIM_SN) {
    for (const k of liste) adim(k, d, a);
    if (a.carpisma) carpistir(liste, a, d.olcek);
    kalan -= ADIM_SN;
  }
  return kalan;
}

/** Sonuç metni: katmanda karakterin üstünde gösterilir */
export function puanEtiketi(puan: number): string {
  if (puan >= 95) return `🎯 ${puan}`;
  if (puan > 0) return `+${puan}`;
  return 'ıska';
}
