/**
 * AxBoT — topluluk oyunları: oylu susturma, emote piramidi, emote bingo
 * Developed by AxthrowA
 *
 * Saf durum makineleri (zaman parametreyle verilir, test edilebilir). Sohbete
 * yazma ve platform eylemi çağıran tarafta (komut yöneticisi / akış) yapılır.
 * Davranış StreamElements/Nightbot'un herkese açık belgelerindeki tanıma göre
 * yazıldı; kodları kopyalanmadı.
 */

// ─── Oylu susturma (!votekick) ─────────────────────────────────────────────

export interface VotekickAyar {
  /** Gereken oy sayısı (başlatan dahil) */
  esik: number;
  /** Oylamanın açık kaldığı süre */
  pencereMs: number;
  /** Aynı kişiye tekrar oylama açılamayan süre */
  hedefBeklemeMs: number;
}

export const VOTEKICK_VARSAYILAN: VotekickAyar = { esik: 5, pencereMs: 60_000, hedefBeklemeMs: 300_000 };

export type VotekickSonuc =
  | { tur: 'basladi'; hedef: string; oy: number; esik: number }
  | { tur: 'oy'; hedef: string; oy: number; esik: number }
  | { tur: 'tamam'; hedef: string; oy: number }
  | { tur: 'zaten-oy'; hedef: string; oy: number; esik: number }
  | { tur: 'baska-oylama'; hedef: string }
  | { tur: 'bekleme'; hedef: string; kalanMs: number }
  | { tur: 'gecersiz' };

interface AcikOylama {
  hedef: string;
  platform: string;
  oylar: Set<string>;
  bitis: number;
}

export class Votekick {
  private acik: AcikOylama | null = null;
  private sonHedefler = new Map<string, number>();

  constructor(private ayar: () => VotekickAyar = () => VOTEKICK_VARSAYILAN) {}

  /** Süresi biten oylamayı kapatır; kapanan hedef (sonuçsuz) döner. */
  zamanAsimi(simdi: number): string | null {
    if (this.acik && simdi >= this.acik.bitis) {
      const h = this.acik.hedef;
      this.acik = null;
      return h;
    }
    return null;
  }

  durum(): { hedef: string; oy: number; bitis: number } | null {
    return this.acik ? { hedef: this.acik.hedef, oy: this.acik.oylar.size, bitis: this.acik.bitis } : null;
  }

  /**
   * Oy verir (hedef boşsa açık oylamaya). Korumalı hedef (mod, yayıncı, bot,
   * kendisi) çağıran tarafından elenir; burada yalnız ad biçimi denetlenir.
   */
  oyVer(platform: string, oyveren: string, hedefHam: string | undefined, simdi: number): VotekickSonuc {
    this.zamanAsimi(simdi);
    const a = this.ayar();
    const kim = oyveren.toLowerCase();
    const hedef = String(hedefHam || '').replace(/^@+/, '').trim().toLowerCase();

    if (this.acik) {
      if (hedef && hedef !== this.acik.hedef) return { tur: 'baska-oylama', hedef: this.acik.hedef };
      if (this.acik.oylar.has(kim)) return { tur: 'zaten-oy', hedef: this.acik.hedef, oy: this.acik.oylar.size, esik: a.esik };
      this.acik.oylar.add(kim);
      if (this.acik.oylar.size >= a.esik) {
        const r = { tur: 'tamam' as const, hedef: this.acik.hedef, oy: this.acik.oylar.size };
        this.sonHedefler.set(`${this.acik.platform}:${this.acik.hedef}`, simdi);
        this.acik = null;
        return r;
      }
      return { tur: 'oy', hedef: this.acik.hedef, oy: this.acik.oylar.size, esik: a.esik };
    }

    if (!/^[\p{L}\p{N}_.-]{1,40}$/u.test(hedef) || hedef === kim) return { tur: 'gecersiz' };
    const son = this.sonHedefler.get(`${platform}:${hedef}`);
    if (son !== undefined && simdi - son < a.hedefBeklemeMs) {
      return { tur: 'bekleme', hedef, kalanMs: a.hedefBeklemeMs - (simdi - son) };
    }
    this.acik = { hedef, platform, oylar: new Set([kim]), bitis: simdi + a.pencereMs };
    // Eşik 1 ise başlatan oy yeter (sınama/küçük kanal)
    if (a.esik <= 1) {
      this.sonHedefler.set(`${platform}:${hedef}`, simdi);
      this.acik = null;
      return { tur: 'tamam', hedef, oy: 1 };
    }
    return { tur: 'basladi', hedef, oy: 1, esik: a.esik };
  }

  iptal(): string | null {
    const h = this.acik?.hedef ?? null;
    this.acik = null;
    return h;
  }
}

// ─── Emote piramidi ────────────────────────────────────────────────────────

/**
 * Aynı kişinin ardışık mesajları: `E`, `E E`, `E E E`, `E E`, `E` → yükseklik 3.
 * Arada başka biri yazarsa ya da desen bozulursa sıfırlanır.
 */
export class PiramitIzci {
  private kisi = '';
  private oge = '';
  /** Ardışık mesajlardaki emote sayıları, ör. [1, 2, 3, 2] */
  private dizi: number[] = [];

  /** Piramit tamamlanırsa yüksekliği döner, yoksa 0. */
  mesaj(kullanici: string, metin: string, enAz = 3): number {
    const parcalar = metin.trim().split(/\s+/).filter(Boolean);
    const n = parcalar.length > 0 && parcalar.every((p) => p === parcalar[0]) ? parcalar.length : 0;
    const k = kullanici.toLowerCase();
    const yeniden = () => {
      this.kisi = n ? k : '';
      this.oge = n ? parcalar[0] : '';
      this.dizi = n === 1 ? [1] : [];
      return 0;
    };
    if (!n || k !== this.kisi || parcalar[0] !== this.oge || !this.dizi.length) return yeniden();

    const son = this.dizi[this.dizi.length - 1];
    const tepe = Math.max(...this.dizi);
    const yukseliyor = son === tepe;
    if (yukseliyor && n === son + 1) {
      this.dizi.push(n);
      return 0;
    }
    if (n === son - 1 && son >= 2) {
      this.dizi.push(n);
      if (n > 1) return 0;
      this.dizi = [];
      this.kisi = '';
      return tepe >= enAz ? tepe : 0;
    }
    return yeniden();
  }

  sifirla() {
    this.kisi = '';
    this.dizi = [];
  }
}

// ─── Emote bingo ───────────────────────────────────────────────────────────

export interface BingoDurum {
  secenekler: string[];
  gizli: string;
  odul: number;
  basladi: number;
}

export class Bingo {
  private d: BingoDurum | null = null;

  constructor(private rastgele: () => number = Math.random) {}

  acikMi() {
    return this.d !== null;
  }

  durum(): Omit<BingoDurum, 'gizli'> | null {
    if (!this.d) return null;
    const { gizli: _g, ...rest } = this.d;
    return rest;
  }

  baslat(secenekler: string[], odul: number, simdi: number): { ok: true; adet: number } | { ok: false; sebep: string } {
    const temiz = [...new Set(secenekler.map((s) => s.trim()).filter((s) => s && s.length <= 60))].slice(0, 50);
    if (temiz.length < 2) return { ok: false, sebep: 'en az 2 farklı emote gerekli' };
    const gizli = temiz[Math.floor(this.rastgele() * temiz.length) % temiz.length];
    this.d = { secenekler: temiz, gizli, odul: Math.max(0, Math.min(1_000_000, Math.floor(odul) || 0)), basladi: simdi };
    return { ok: true, adet: temiz.length };
  }

  /** Mesajda gizli emote varsa kazanır (oyun kapanır). */
  tahmin(metin: string): { kazandi: true; emote: string; odul: number } | null {
    if (!this.d) return null;
    const parcalar = metin.trim().split(/\s+/);
    if (!parcalar.includes(this.d.gizli)) return null;
    const r = { kazandi: true as const, emote: this.d.gizli, odul: this.d.odul };
    this.d = null;
    return r;
  }

  durdur(): string | null {
    const g = this.d?.gizli ?? null;
    this.d = null;
    return g;
  }
}

/** Kick emote işaretlemesinden görünen ad: `[emote:1:KEKW]` → `KEKW` */
export function emoteAdlari(metin: string): string {
  return metin.replace(/\[emote:\d+:([^\]]+)\]/g, '$1');
}
