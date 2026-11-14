/**
 * Y13 canlı altyazı: mikrofon karelerini konuşma parçalarına böler. Konuşma sürerken her `araSn`de ara sonuç
 * (o ana dek söylenenin tamamı) ister; sessizlik `sessizMs`i geçince ya da parça `enUzunSn`e varınca kesinleştirir.
 * shortcut: eşik sabit bir RMS değeri (ses etkinliği modeli yok); gürültülü odada eşik ayardan yükseltilir.
 */
export type BolutAyar = { ornekHizi: number; esik: number; sessizMs: number; araSn: number; enUzunSn: number; onSesMs: number };
export type Istek = { ses: Float32Array; kesin: boolean };

export const VARSAYILAN: BolutAyar = { ornekHizi: 16_000, esik: 0.012, sessizMs: 700, araSn: 1, enUzunSn: 8, onSesMs: 300 };

export function rms(k: Float32Array): number {
  let t = 0;
  for (let i = 0; i < k.length; i++) t += k[i] * k[i];
  return k.length ? Math.sqrt(t / k.length) : 0;
}

function birlestir(parcalar: Float32Array[]): Float32Array {
  const out = new Float32Array(parcalar.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parcalar) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export class Bolutleyici {
  private parcalar: Float32Array[] = [];
  private uzunluk = 0;
  private onSes: Float32Array[] = [];
  private onSesUzunluk = 0;
  private sessiz = 0;
  private sonAra = 0;
  private konusuyor = false;

  constructor(private a: BolutAyar = VARSAYILAN) {}

  /** Bir kare ekler; ara ya da kesin sonuç gerekiyorsa isteği döndürür */
  besle(kare: Float32Array): Istek | null {
    const ses = rms(kare) >= this.a.esik;
    if (!this.konusuyor) {
      // Konuşma başlamadan kısa bir ön ses tut: ilk hece kesilmesin
      this.onSes.push(kare);
      this.onSesUzunluk += kare.length;
      while (this.onSesUzunluk - this.onSes[0].length >= (this.a.onSesMs / 1000) * this.a.ornekHizi) this.onSesUzunluk -= this.onSes.shift()!.length;
      if (!ses) return null;
      this.konusuyor = true;
      this.parcalar = this.onSes;
      this.uzunluk = this.onSesUzunluk;
      this.onSes = [];
      this.onSesUzunluk = 0;
      this.sessiz = 0;
      this.sonAra = this.uzunluk;
      return null;
    }
    this.parcalar.push(kare);
    this.uzunluk += kare.length;
    this.sessiz = ses ? 0 : this.sessiz + kare.length;
    const hz = this.a.ornekHizi;
    if (this.sessiz >= (this.a.sessizMs / 1000) * hz || this.uzunluk >= this.a.enUzunSn * hz) return this.kesinlestir();
    if (this.uzunluk - this.sonAra >= this.a.araSn * hz) {
      this.sonAra = this.uzunluk;
      return { ses: birlestir(this.parcalar), kesin: false };
    }
    return null;
  }

  /** Durdurulurken yarım kalan konuşmayı kesinleştirir */
  bitir(): Istek | null {
    return this.konusuyor ? this.kesinlestir() : null;
  }

  private kesinlestir(): Istek {
    const ses = birlestir(this.parcalar);
    this.parcalar = [];
    this.uzunluk = 0;
    this.sessiz = 0;
    this.konusuyor = false;
    return { ses, kesin: true };
  }
}
