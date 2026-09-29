/**
 * Sahne öğe ağacı ve önizleme geometrisi — saf yardımcılar (test edilir).
 *
 * Motor öğeleri alttan üste verir; grup çocukları grubun hemen ardından gelir (`ust` alanıyla). Kaynaklar paneli
 * OBS'teki gibi üstten alta gösterir. Önizleme etkileşimi (seç, sürükle, köşeden boyutlandır, yapış) öğenin tuval
 * koordinatlarındaki kutusuyla çalışır; kutu OBS'in dönüşüm kurallarından hesaplanır: hizalama noktası = konum,
 * boyut = sınır kutusu (varsa) ya da (kaynak − kırpma) × ölçek, döndürme konum etrafında.
 */
import type { MotorSahneOgesi } from "./api/motor";

export type AgacDugumu = { oge: MotorSahneOgesi; cocuklar: MotorSahneOgesi[] };

/** Motor sırasından üstten alta ağaç (grup çocukları da üstten alta) */
export function sahneAgaci(ogeler: MotorSahneOgesi[]): AgacDugumu[] {
  const kok: AgacDugumu[] = [];
  for (const o of ogeler) {
    if (o.ust) {
      const g = kok.find((d) => d.oge.oge === o.ust);
      if (g) g.cocuklar.unshift(o);
    } else {
      kok.unshift({ oge: o, cocuklar: [] });
    }
  }
  return kok;
}

/** Görünen düz liste: kök öğeler üstten alta; açık grupların çocukları girintili */
export function duzListe(agac: AgacDugumu[], acikGruplar: ReadonlySet<string>): { oge: MotorSahneOgesi; derinlik: 0 | 1 }[] {
  const v: { oge: MotorSahneOgesi; derinlik: 0 | 1 }[] = [];
  for (const d of agac) {
    v.push({ oge: d.oge, derinlik: 0 });
    if (d.oge.grup && acikGruplar.has(d.oge.oge)) for (const c of d.cocuklar) v.push({ oge: c, derinlik: 1 });
  }
  return v;
}

/** Kök düzeyindeki bir öğenin motor listesindeki (alttan) sırası — `oge.sira` `konum_sira` için */
export function altanSira(agac: AgacDugumu[], oge: string): number {
  const i = agac.findIndex((d) => d.oge.oge === oge);
  return i < 0 ? -1 : agac.length - 1 - i;
}

// ─── Geometri ──────────────────────────────────────────────────────────────

export type Kutu = {
  /** Döndürülmemiş kutunun sol üstü */
  x: number;
  y: number;
  g: number;
  h: number;
  /** Derece; döndürme merkezi konum (hizalama noktası) */
  aci: number;
  ox: number;
  oy: number;
};

const SOL = 1;
const SAG = 2;
const UST = 4;
const ALT = 8;

/** Hizalama noktasının kutu içindeki yeri (sol üstten) */
export function hizalamaOfseti(hizalama: number, g: number, h: number): [number, number] {
  const x = hizalama & SOL ? 0 : hizalama & SAG ? g : g / 2;
  const y = hizalama & UST ? 0 : hizalama & ALT ? h : h / 2;
  return [x, y];
}

/** Kırpma sonrası kaynak boyutu */
export function kirpikBoyut(o: MotorSahneOgesi): [number, number] {
  const k = o.kirp ?? [0, 0, 0, 0];
  return [Math.max(0, (o.genislik ?? 0) - k[0] - k[2]), Math.max(0, (o.yukseklik ?? 0) - k[1] - k[3])];
}

/** Öğenin tuval koordinatlarında kutusu; boyutu bilinmiyorsa (0) `null` */
export function ogeKutusu(o: MotorSahneOgesi): Kutu | null {
  let g: number;
  let h: number;
  if ((o.sinir_turu ?? (o.sinir ? 2 : 0)) !== 0 && o.sinir) {
    [g, h] = o.sinir;
  } else {
    const [kg, kh] = kirpikBoyut(o);
    g = kg * Math.abs(o.olcek[0]);
    h = kh * Math.abs(o.olcek[1]);
  }
  if (!(g > 0 && h > 0)) return null;
  const [dx, dy] = hizalamaOfseti(o.hizalama ?? 5, g, h);
  return { x: o.konum[0] - dx, y: o.konum[1] - dy, g, h, aci: o.aci ?? 0, ox: o.konum[0], oy: o.konum[1] };
}

/** Nokta kutunun içinde mi (döndürme hesaba katılır) */
export function noktaKutuda(k: Kutu, px: number, py: number): boolean {
  let x = px;
  let y = py;
  if (k.aci) {
    const r = (-k.aci * Math.PI) / 180;
    const dx = px - k.ox;
    const dy = py - k.oy;
    x = k.ox + dx * Math.cos(r) - dy * Math.sin(r);
    y = k.oy + dx * Math.sin(r) + dy * Math.cos(r);
  }
  return x >= k.x && x <= k.x + k.g && y >= k.y && y <= k.y + k.h;
}

/** Noktadaki en üst (görünür, kilitsiz öncelikli değil — OBS gibi kilitli de seçilir) kök öğe */
export function noktadakiOge(agac: AgacDugumu[], px: number, py: number): MotorSahneOgesi | null {
  for (const d of agac) {
    if (!d.oge.gorunur) continue;
    const k = ogeKutusu(d.oge);
    if (k && noktaKutuda(k, px, py)) return d.oge;
  }
  return null;
}

/**
 * Taşınan kutuyu tuval kenarlarına ve merkezine yapıştırır (OBS'in varsayılan yapışması gibi, eşik tuval
 * genişliğinin ~%1'i). Dönüş: yeni konum (hizalama noktası).
 */
export function yapistir(konum: [number, number], k: Kutu, tuval: [number, number], esik = tuval[0] * 0.01): [number, number] {
  if (k.aci % 360 !== 0) return konum;
  const dx = konum[0] - k.ox;
  const dy = konum[1] - k.oy;
  const x = k.x + dx;
  const y = k.y + dy;
  const hedef = (bas: number, boy: number, tuv: number): number => {
    const adaylar = [
      [bas, 0],
      [bas + boy, tuv],
      [bas + boy / 2, tuv / 2],
    ];
    let en = 0;
    let fark = esik;
    for (const [a, t] of adaylar) {
      if (Math.abs(a - t) < fark) {
        fark = Math.abs(a - t);
        en = t - a;
      }
    }
    return en;
  };
  return [konum[0] + hedef(x, k.g, tuval[0]), konum[1] + hedef(y, k.h, tuval[1])];
}

export type Kose = "su" | "sau" | "sa" | "saa" | "a" | "sola" | "sol" | "solu";
/** Köşe/kenar tutamaçları: sol üst, üst, sağ üst, sağ, sağ alt, alt, sol alt, sol */
export const TUTAMACLAR: { ad: Kose; x: 0 | 0.5 | 1; y: 0 | 0.5 | 1; imlec: string }[] = [
  { ad: "solu", x: 0, y: 0, imlec: "nwse-resize" },
  { ad: "su", x: 0.5, y: 0, imlec: "ns-resize" },
  { ad: "sau", x: 1, y: 0, imlec: "nesw-resize" },
  { ad: "sa", x: 1, y: 0.5, imlec: "ew-resize" },
  { ad: "saa", x: 1, y: 1, imlec: "nwse-resize" },
  { ad: "a", x: 0.5, y: 1, imlec: "ns-resize" },
  { ad: "sola", x: 0, y: 1, imlec: "nesw-resize" },
  { ad: "sol", x: 0, y: 0.5, imlec: "ew-resize" },
];

/**
 * Tutamaçla boyutlandırma (döndürülmemiş öğe): karşı köşe/kenar sabit kalır. Köşede oran korunur (Shift ile
 * serbest — OBS gibi), kenarda tek eksen. Sınırlı öğede sınır kutusu, sınırsızda ölçek değişir. Dönüş: yeni alanlar.
 */
export function boyutlandir(
  o: MotorSahneOgesi,
  k: Kutu,
  tutamac: { x: number; y: number },
  nokta: [number, number],
  serbest: boolean
): { konum: [number, number]; olcek?: [number, number]; sinir?: [number, number] } {
  const ax = tutamac.x === 0.5 ? null : k.x + (1 - tutamac.x) * k.g;
  const ay = tutamac.y === 0.5 ? null : k.y + (1 - tutamac.y) * k.h;
  let g = ax === null ? k.g : Math.max(2, Math.abs(nokta[0] - ax));
  let h = ay === null ? k.h : Math.max(2, Math.abs(nokta[1] - ay));
  if (ax !== null && ay !== null && !serbest) {
    const oran = Math.max(g / k.g, h / k.h);
    g = k.g * oran;
    h = k.h * oran;
  }
  // Yeni kutunun sol üstü: sabit kenar tarafına göre
  const x = ax === null ? k.x + (k.g - g) / 2 : tutamac.x === 0 ? ax - g : ax;
  const y = ay === null ? k.y + (k.h - h) / 2 : tutamac.y === 0 ? ay - h : ay;
  const [dx, dy] = hizalamaOfseti(o.hizalama ?? 5, g, h);
  const konum: [number, number] = [Math.round(x + dx), Math.round(y + dy)];
  if ((o.sinir_turu ?? 0) !== 0) return { konum, sinir: [Math.round(g), Math.round(h)] };
  const [kg, kh] = kirpikBoyut(o);
  if (!(kg > 0 && kh > 0)) return { konum };
  return { konum, olcek: [+(g / kg).toFixed(4), +(h / kh).toFixed(4)] };
}

/** Alt+sürükle kırpması yapılabilir mi: sınırsız, döndürülmemiş, boyutu bilinen öğe (sınır kutulu öğede kırpma
 * Dönüşüm penceresinden yapılır — OBS'te de sınır kutusu kırpılmış görüntüyü yeniden ölçekler) */
export function kirpilabilir(o: MotorSahneOgesi): boolean {
  return (o.sinir_turu ?? (o.sinir ? 2 : 0)) === 0 && !(o.aci ?? 0) && (o.genislik ?? 0) > 0 && (o.yukseklik ?? 0) > 0 && o.olcek[0] > 0 && o.olcek[1] > 0;
}

/**
 * Alt+tutamaç sürüklemesi (OBS): ölçek değişmez, sürüklenen kenar kaynağı kırpar; karşı kenar yerinde kalır.
 * Kırpma kaynak pikselidir (tuval farkı / ölçek), 0'ın altına inmez ve en az 1 px görüntü bırakır.
 * Dönüş: yeni kırpma (sol, üst, sağ, alt) ve kutunun yerinde kalması için hizalama noktası.
 */
export function kirpSurukle(
  o: MotorSahneOgesi,
  k: Kutu,
  tutamac: { x: number; y: number },
  nokta: [number, number]
): { konum: [number, number]; kirp: [number, number, number, number] } {
  const [sx, sy] = o.olcek;
  const [kg, ky] = [o.genislik ?? 0, o.yukseklik ?? 0];
  const [cl, ct, cr, cb] = o.kirp ?? [0, 0, 0, 0];
  let [yl, yt, yr, yb] = [cl, ct, cr, cb];
  if (tutamac.x === 0) yl = Math.min(kg - cr - 1, Math.max(0, cl + (nokta[0] - k.x) / sx));
  if (tutamac.x === 1) yr = Math.min(kg - cl - 1, Math.max(0, cr + (k.x + k.g - nokta[0]) / sx));
  if (tutamac.y === 0) yt = Math.min(ky - cb - 1, Math.max(0, ct + (nokta[1] - k.y) / sy));
  if (tutamac.y === 1) yb = Math.min(ky - ct - 1, Math.max(0, cb + (k.y + k.h - nokta[1]) / sy));
  const kirp: [number, number, number, number] = [Math.round(yl), Math.round(yt), Math.round(yr), Math.round(yb)];
  // Yeni kutu: sol/üst kırpma kutuyu sağa/aşağı iter, sağ/alt kırpma yalnız daraltır
  const x = k.x + (kirp[0] - cl) * sx;
  const y = k.y + (kirp[1] - ct) * sy;
  const g = (kg - kirp[0] - kirp[2]) * sx;
  const h = (ky - kirp[1] - kirp[3]) * sy;
  const [dx, dy] = hizalamaOfseti(o.hizalama ?? 5, g, h);
  return { konum: [Math.round(x + dx), Math.round(y + dy)], kirp };
}

/** Tuvale sığdır / uzat / ortala (OBS "Transform" menüsü) */
export function tuvaleGore(
  o: MotorSahneOgesi,
  tuval: [number, number],
  kip: "sigdir" | "uzat" | "ortala" | "yatay-ortala" | "dikey-ortala"
): { konum?: [number, number]; sinir?: [number, number]; sinir_turu?: number; hizalama?: number; olcek?: [number, number]; sinir_hizalama?: number } {
  if (kip === "sigdir") return { konum: [0, 0], hizalama: 5, sinir: tuval, sinir_turu: 2, sinir_hizalama: 0 };
  if (kip === "uzat") return { konum: [0, 0], hizalama: 5, sinir: tuval, sinir_turu: 1, sinir_hizalama: 0 };
  const k = ogeKutusu(o);
  if (!k) return {};
  const [dx, dy] = hizalamaOfseti(o.hizalama ?? 5, k.g, k.h);
  const x = kip === "dikey-ortala" ? k.x : (tuval[0] - k.g) / 2;
  const y = kip === "yatay-ortala" ? k.y : (tuval[1] - k.h) / 2;
  return { konum: [Math.round(x + dx), Math.round(y + dy)] };
}

/** Kutunun merkezinin tuvaldeki yeri (döndürme hesaba katılır) */
export function kutuMerkezi(k: Kutu): [number, number] {
  const vx = k.x + k.g / 2 - k.ox;
  const vy = k.y + k.h / 2 - k.oy;
  const r = (k.aci * Math.PI) / 180;
  return [k.ox + vx * Math.cos(r) - vy * Math.sin(r), k.oy + vx * Math.sin(r) + vy * Math.cos(r)];
}

/**
 * Döndürme tutamacı (OBS 30+): öğe kutusunun MERKEZİ etrafında döner. libobs döndürmeyi hizalama noktası (konum)
 * etrafında yaptığı için konum telafi edilir: yeni konum = O + (R(a0) − R(a1))·v, v = merkez − O (döndürülmemiş).
 * `p`: imlecin tuval noktası; tutamaç kutunun üstünde olduğundan açı +90°. `adim` verilirse açı ona yuvarlanır.
 */
export function merkezdenDondur(k: Kutu, p: [number, number], adim?: number): { konum: [number, number]; aci: number } {
  const [cx, cy] = kutuMerkezi(k);
  let aci = (Math.atan2(p[1] - cy, p[0] - cx) * 180) / Math.PI + 90;
  if (adim) aci = Math.round(aci / adim) * adim;
  aci = ((aci % 360) + 360) % 360;
  const vx = k.x + k.g / 2 - k.ox;
  const vy = k.y + k.h / 2 - k.oy;
  const d = (a: number) => {
    const r = (a * Math.PI) / 180;
    return [vx * Math.cos(r) - vy * Math.sin(r), vx * Math.sin(r) + vy * Math.cos(r)];
  };
  const [x0, y0] = d(k.aci);
  const [x1, y1] = d(aci);
  return { konum: [k.ox + x0 - x1, k.oy + y0 - y1], aci };
}
