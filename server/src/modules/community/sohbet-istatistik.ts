/**
 * StreamAxT — sohbet istatistikleri: kelime bulutu, emote/kelime sayacı, en çok yazanlar
 * Developed by AxthrowA
 *
 * Yayın oturumu boyunca bellekte tutulur (bot yeniden başlayınca ya da `!chatstats sifirla`
 * ile sıfırlanır). Bellek sınırlı: en çok SOZCUK_SINIRI farklı sözcük, KISI_SINIRI kişi.
 */

export const SOZCUK_SINIRI = 5000;
export const KISI_SINIRI = 5000;

/** Bulutta anlamsız kalan bağlaç/zamir ve sohbet dolguları */
const DOLGU = new Set(
  (
    've ile de da ki bu şu o bir ben sen biz siz onlar mi mı mu mü ne niye neden nasıl için gibi çok daha en ama fakat ' +
    'evet hayır yok var olur oldu ol değil hep her şey bi şimdi sonra önce kadar diye ya yani tamam ok okey abi aga ' +
    'the a an and or of to in is it you i me my we he she they that this for on with be are was at as not no yes lol'
  ).split(/\s+/)
);

/** Mesajı sayılabilir sözcüklere böler: küçük harf (Türkçe), noktalama atılır, link/komut sayılmaz */
export function sozcukler(metin: string): string[] {
  if (!metin || /^[!/]/.test(metin.trim())) return [];
  return metin
    .replace(/https?:\/\/\S+/gi, ' ')
    .split(/\s+/)
    .map((s) => s.replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, ''))
    .filter((s) => s.length >= 2 && s.length <= 30);
}

export class SohbetIstatistik {
  baslangic = Date.now();
  mesajSayisi = 0;
  /** Büyük/küçük harfe duyarlı (emote adları: KEKW ≠ kekw) */
  private ham = new Map<string, number>();
  private kisiler = new Map<string, { ad: string; sayi: number }>();
  private saatler = new Array<number>(24).fill(0);

  ekle(kullanici: string, gorunenAd: string, metin: string, zaman = Date.now()): void {
    this.mesajSayisi++;
    this.saatler[new Date(zaman).getHours()]++;
    const k = kullanici.toLowerCase();
    const kayit = this.kisiler.get(k);
    if (kayit) kayit.sayi++;
    else if (this.kisiler.size < KISI_SINIRI) this.kisiler.set(k, { ad: gorunenAd || kullanici, sayi: 1 });
    // Aynı mesajda tekrar eden sözcük (emote seli) bir kez sayılır
    for (const s of new Set(sozcukler(metin))) {
      const n = this.ham.get(s);
      if (n !== undefined) this.ham.set(s, n + 1);
      else if (this.ham.size < SOZCUK_SINIRI) this.ham.set(s, 1);
    }
  }

  /** `!emotecount KEKW`: önce birebir, yoksa harf duyarsız toplam */
  say(sozcuk: string): number {
    const birebir = this.ham.get(sozcuk);
    if (birebir) return birebir;
    const k = sozcuk.toLocaleLowerCase('tr-TR');
    let t = 0;
    for (const [s, n] of this.ham) if (s.toLocaleLowerCase('tr-TR') === k) t += n;
    return t;
  }

  /** Kelime bulutu: dolgular atılır, harf duyarsız birleştirilir */
  bulut(adet = 60): Array<{ sozcuk: string; sayi: number }> {
    const birlesik = new Map<string, { sozcuk: string; sayi: number }>();
    for (const [s, n] of this.ham) {
      const k = s.toLocaleLowerCase('tr-TR');
      if (DOLGU.has(k) || /^\d+$/.test(k)) continue;
      const v = birlesik.get(k);
      if (v) v.sayi += n;
      else birlesik.set(k, { sozcuk: s, sayi: n });
    }
    return [...birlesik.values()].sort((a, b) => b.sayi - a.sayi).slice(0, adet);
  }

  enCokYazanlar(adet = 5): Array<{ ad: string; sayi: number }> {
    return [...this.kisiler.values()].sort((a, b) => b.sayi - a.sayi).slice(0, adet);
  }

  ozet() {
    const enYogunSaat = this.saatler.indexOf(Math.max(...this.saatler));
    return {
      baslangic: this.baslangic,
      mesajSayisi: this.mesajSayisi,
      kisiSayisi: this.kisiler.size,
      enCokYazanlar: this.enCokYazanlar(10),
      saatler: [...this.saatler],
      enYogunSaat: this.mesajSayisi ? enYogunSaat : null,
      bulut: this.bulut(60)
    };
  }

  sifirla(): void {
    this.baslangic = Date.now();
    this.mesajSayisi = 0;
    this.ham.clear();
    this.kisiler.clear();
    this.saatler.fill(0);
  }
}

export const sohbetIstatistik = new SohbetIstatistik();
