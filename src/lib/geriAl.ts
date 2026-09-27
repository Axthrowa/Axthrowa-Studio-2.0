/**
 * Geri al / yinele yığını (Ctrl+Z / Ctrl+Y). Her düzenleme kendi tersini (API çağrısı) bilir: dönüşüm eski
 * değerlere, kaldırılan öğe aynı dönüşümle geri eklenir, filtre eski ayarlarına… Yığın yalnız bu oturumdadır.
 */

export type Islem = {
  ad: string;
  geri: () => Promise<unknown>;
  ileri: () => Promise<unknown>;
};

export class GeriAlYigini {
  private geriler: Islem[] = [];
  private ileriler: Islem[] = [];
  private dinleyiciler = new Set<() => void>();
  private calisiyor = false;

  constructor(private readonly sinir = 100) {}

  /** Yapılmış bir işlemi kaydeder; yinele yığını temizlenir */
  kaydet(i: Islem) {
    this.geriler.push(i);
    if (this.geriler.length > this.sinir) this.geriler.shift();
    this.ileriler = [];
    this.bildir();
  }

  get geriAdi(): string | null {
    return this.geriler.at(-1)?.ad ?? null;
  }

  get ileriAdi(): string | null {
    return this.ileriler.at(-1)?.ad ?? null;
  }

  /** Son işlemi geri alır; başarısızsa işlem yığında kalır ve hata fırlatılır */
  async geriAl(): Promise<string | null> {
    if (this.calisiyor) return null;
    const i = this.geriler.at(-1);
    if (!i) return null;
    this.calisiyor = true;
    try {
      await i.geri();
      this.geriler.pop();
      this.ileriler.push(i);
      return i.ad;
    } finally {
      this.calisiyor = false;
      this.bildir();
    }
  }

  async yinele(): Promise<string | null> {
    if (this.calisiyor) return null;
    const i = this.ileriler.at(-1);
    if (!i) return null;
    this.calisiyor = true;
    try {
      await i.ileri();
      this.ileriler.pop();
      this.geriler.push(i);
      return i.ad;
    } finally {
      this.calisiyor = false;
      this.bildir();
    }
  }

  temizle() {
    this.geriler = [];
    this.ileriler = [];
    this.bildir();
  }

  abone(f: () => void): () => void {
    this.dinleyiciler.add(f);
    return () => this.dinleyiciler.delete(f);
  }

  private bildir() {
    for (const f of this.dinleyiciler) f();
  }
}
