/**
 * AxBoT — Ses/Video Panosu (Blerp tarzı) saf mantığı
 * Developed by AxthrowA
 *
 * İzleyici sohbetten (`!ses <ad>`) bot puanıyla yayıncının kendi yüklediği ses ve videoları yayında oynatır.
 * Blerp'in gözlenen davranışları (resmi site/blog, 2026-10-05) referans alındı — kodu/varlığı kullanılmadı:
 * ses başına bedel ve bekleme, rastgele "kova" (ağırlıklı seçim), giriş sesi (walk-on), yayıncının
 * engelleme/atlatma denetimi. Bu dosya veritabanına dokunmaz (birim testli).
 */

export type PanoYetki = 'herkes' | 'abone' | 'mod';
export type PanoMedyaTuru = 'audio' | 'video';

export interface PanoOgesi {
  id: string;
  ad: string;
  /** Sohbette yazılan ad (normalize: küçük harf, boşluk → tire) */
  komut: string;
  medyaId: string;
  tur: PanoMedyaTuru;
  /** Ses öğesiyle birlikte gösterilecek görsel/GIF (isteğe bağlı) */
  gorselId: string | null;
  /** 0–100 */
  ses: number;
  /** 0 = ayarlardaki genel sınır */
  maksSureSn: number;
  maliyet: number;
  beklemeSn: number;
  kullaniciBeklemeSn: number;
  yetki: PanoYetki;
  kovaId: string | null;
  /** Kovadaki seçilme ağırlığı (1–100) */
  agirlik: number;
  etkin: boolean;
  sira: number;
}

export interface PanoKovasi {
  id: string;
  ad: string;
  komut: string;
  maliyet: number;
  beklemeSn: number;
  etkin: boolean;
}

export type PanoKonum = 'orta' | 'ust-orta' | 'alt-orta' | 'ust-sol' | 'ust-sag' | 'alt-sol' | 'alt-sag';

export interface PanoAyarlari {
  etkin: boolean;
  /** İki istek arası en az süre (tüm izleyiciler) */
  genelBeklemeSn: number;
  /** Kuyrukta bekleyebilecek en çok istek */
  kuyrukSiniri: number;
  /** Tek oynatmanın üst sınırı (öğe daha kısa sınır koyabilir) */
  maksSureSn: number;
  /** Mod ve yayıncı bedel ödemez */
  modlarUcretsiz: boolean;
  girisSesleri: boolean;
  gorunum: { konum: PanoKonum; genislikYuzde: number; adGoster: boolean };
}

export const VARSAYILAN_AYARLAR: PanoAyarlari = {
  etkin: true,
  genelBeklemeSn: 5,
  kuyrukSiniri: 10,
  maksSureSn: 15,
  modlarUcretsiz: true,
  girisSesleri: true,
  gorunum: { konum: 'orta', genislikYuzde: 40, adGoster: true }
};

const KONUMLAR: PanoKonum[] = ['orta', 'ust-orta', 'alt-orta', 'ust-sol', 'ust-sag', 'alt-sol', 'alt-sag'];

const sinirla = (x: unknown, alt: number, ust: number, v: number) => {
  const n = Number(x);
  return Number.isFinite(n) ? Math.min(ust, Math.max(alt, Math.round(n))) : v;
};

/** Gelen ayarları doğrular; eksik/bozuk alan varsayılana döner */
export function ayarlariDuzelt(g: any): PanoAyarlari {
  const v = VARSAYILAN_AYARLAR;
  const gr = g?.gorunum ?? {};
  return {
    etkin: g?.etkin === undefined ? v.etkin : !!g.etkin,
    genelBeklemeSn: sinirla(g?.genelBeklemeSn, 0, 3600, v.genelBeklemeSn),
    kuyrukSiniri: sinirla(g?.kuyrukSiniri, 1, 100, v.kuyrukSiniri),
    maksSureSn: sinirla(g?.maksSureSn, 1, 120, v.maksSureSn),
    modlarUcretsiz: g?.modlarUcretsiz === undefined ? v.modlarUcretsiz : !!g.modlarUcretsiz,
    girisSesleri: g?.girisSesleri === undefined ? v.girisSesleri : !!g.girisSesleri,
    gorunum: {
      konum: KONUMLAR.includes(gr.konum) ? gr.konum : v.gorunum.konum,
      genislikYuzde: sinirla(gr.genislikYuzde, 10, 100, v.gorunum.genislikYuzde),
      adGoster: gr.adGoster === undefined ? v.gorunum.adGoster : !!gr.adGoster
    }
  };
}

/** Sohbet adı: küçük harf (Türkçe), boşluklar tire, yalnız harf/rakam/tire; en çok 32 */
export function komutNormalize(s: string): string {
  return String(s ?? '')
    .toLocaleLowerCase('tr-TR')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .slice(0, 32);
}

export type Bulunan = { tur: 'oge'; oge: PanoOgesi } | { tur: 'kova'; kova: PanoKovasi } | null;

/** Sohbette yazılan ada göre etkin öğe ya da kova (öğe önceliklidir) */
export function istekBul(ogeler: PanoOgesi[], kovalar: PanoKovasi[], ad: string): Bulunan {
  const k = komutNormalize(ad);
  if (!k) return null;
  const oge = ogeler.find((o) => o.etkin && o.komut === k);
  if (oge) return { tur: 'oge', oge };
  const kova = kovalar.find((x) => x.etkin && x.komut === k);
  return kova ? { tur: 'kova', kova } : null;
}

/** Kovadan ağırlıklı rastgele seçim; `rastgele` [0,1) */
export function kovadanSec(ogeler: PanoOgesi[], kovaId: string, rastgele: () => number = Math.random): PanoOgesi | null {
  const aday = ogeler.filter((o) => o.etkin && o.kovaId === kovaId && o.agirlik > 0);
  const toplam = aday.reduce((t, o) => t + o.agirlik, 0);
  if (!toplam) return null;
  let r = rastgele() * toplam;
  for (const o of aday) {
    r -= o.agirlik;
    if (r < 0) return o;
  }
  return aday[aday.length - 1];
}

export interface Kullanici {
  isMod: boolean;
  isSub: boolean;
  isVip?: boolean;
  isBroadcaster: boolean;
}

export function yetkiVar(yetki: PanoYetki, k: Kullanici): boolean {
  if (k.isBroadcaster || k.isMod) return true;
  if (yetki === 'mod') return false;
  if (yetki === 'abone') return k.isSub || !!k.isVip;
  return true;
}

/** Bekleme denetimi: genel, öğe/kova ve kullanıcı başına. Dönüş: kalan saniye (0 = serbest) ve neden */
export function beklemeKalan(p: {
  simdi: number;
  genelSon: number | undefined;
  hedefSon: number | undefined;
  kullaniciSon: number | undefined;
  genelBeklemeSn: number;
  hedefBeklemeSn: number;
  kullaniciBeklemeSn: number;
}): { kalanSn: number; neden: 'genel' | 'hedef' | 'kullanici' | null } {
  const kalan = (son: number | undefined, sn: number) => (son === undefined || sn <= 0 ? 0 : Math.max(0, Math.ceil((son + sn * 1000 - p.simdi) / 1000)));
  const a = [
    { neden: 'hedef' as const, sn: kalan(p.hedefSon, p.hedefBeklemeSn) },
    { neden: 'kullanici' as const, sn: kalan(p.kullaniciSon, p.kullaniciBeklemeSn) },
    { neden: 'genel' as const, sn: kalan(p.genelSon, p.genelBeklemeSn) }
  ].sort((x, y) => y.sn - x.sn)[0];
  return a.sn > 0 ? { kalanSn: a.sn, neden: a.neden } : { kalanSn: 0, neden: null };
}

/** Öğenin etkin süre sınırı (saniye) */
export function sureSiniri(oge: Pick<PanoOgesi, 'maksSureSn'>, ayar: Pick<PanoAyarlari, 'maksSureSn'>): number {
  return oge.maksSureSn > 0 ? Math.min(oge.maksSureSn, ayar.maksSureSn) : ayar.maksSureSn;
}

/** Bugünün anahtarı (giriş sesi günde bir kez) — yerel saat */
export function gunAnahtari(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
