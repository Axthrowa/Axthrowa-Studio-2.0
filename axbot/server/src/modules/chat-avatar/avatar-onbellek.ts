/**
 * Sohbet avatarları: Kick ve Twitch sohbet mesajı avatar taşımaz, adı verilen kullanıcının
 * resmi platform API'sinden bulunur. Yoğun sohbette platformu boğmamak için sonuç saklanır,
 * aynı kullanıcı için tek istek atılır ve aynı anda en çok 3 istek gider.
 * Developed by AxthrowA
 */
const OK_SURE = 6 * 60 * 60_000;
const YOK_SURE = 30 * 60_000;
const ESZAMANLI = 3;

export function avatarIstegiGecerli(platform: string, ad: string): boolean {
  return (platform === 'kick' || platform === 'twitch') && /^[A-Za-z0-9_-]{1,40}$/.test(ad);
}

type Bulucu = (platform: string, ad: string) => Promise<string | null | undefined>;

export class AvatarOnbellek {
  private kayit = new Map<string, { url: string | null; bitis: number }>();
  private suren = new Map<string, Promise<string | null>>();
  private calisan = 0;
  private bekleyen: Array<() => void> = [];

  constructor(
    private bul: Bulucu,
    private simdi: () => number = Date.now,
    private enCok = 3000
  ) {}

  getir(platform: string, ad: string): Promise<string | null> {
    const anahtar = `${platform}:${ad.toLowerCase()}`;
    const var_ = this.kayit.get(anahtar);
    if (var_ && var_.bitis > this.simdi()) return Promise.resolve(var_.url);
    const suren = this.suren.get(anahtar);
    if (suren) return suren;
    const is = this.sor(platform, ad, anahtar).finally(() => this.suren.delete(anahtar));
    this.suren.set(anahtar, is);
    return is;
  }

  private async sor(platform: string, ad: string, anahtar: string): Promise<string | null> {
    if (this.calisan >= ESZAMANLI) await new Promise<void>((r) => this.bekleyen.push(r));
    this.calisan++;
    let url: string | null = null;
    try {
      const bulunan = await this.bul(platform, ad);
      if (typeof bulunan === 'string' && bulunan.startsWith('https://')) url = bulunan;
    } catch {
      /* platform yanıt vermedi: harf gösterilir, bir süre sonra yeniden denenir */
    } finally {
      this.calisan--;
      this.bekleyen.shift()?.();
    }
    this.kayit.delete(anahtar);
    this.kayit.set(anahtar, { url, bitis: this.simdi() + (url ? OK_SURE : YOK_SURE) });
    if (this.kayit.size > this.enCok) this.kayit.delete(this.kayit.keys().next().value!);
    return url;
  }
}
