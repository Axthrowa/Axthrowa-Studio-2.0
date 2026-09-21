/**
 * StreamAxT — değişken motoru tipleri
 * Developed by AxthrowA
 */

export type DegiskenGrubu =
  | 'user'
  | 'channel'
  | 'loyalty'
  | 'counter'
  | 'random'
  | 'web'
  | 'math'
  | 'store'
  | 'json'
  | 'text';

export interface DegiskenKullanici {
  username: string;
  displayName: string;
  userId?: string;
  isBroadcaster?: boolean;
  isMod?: boolean;
  isSub?: boolean;
  isVip?: boolean;
}

export interface DegiskenBaglam {
  /** Komutu çalıştıran kişi. */
  user: DegiskenKullanici;
  platform: string;
  channel: string;
  /** Komut adından sonraki kelimeler. */
  args: string[];
  /** Komut adından sonraki ham metin. */
  rawArgs: string;
  /** Komut adı (sayaç bağlaması için). */
  commandName?: string;
  /**
   * Test kipinde yazan değişkenler (addPoints, setcounter…) ATLANIR.
   * Test uyarıları gerçek puanı değiştirmemeli.
   */
  isTest?: boolean;
  /** Yalnız bu çalıştırmaya ait yerel değişkenler (diske yazılmaz). */
  yerel: Map<string, string>;
}

export type DegiskenIsleyici = (
  ham: string,
  ctx: DegiskenBaglam
) => string | Promise<string>;

export interface DegiskenTanimi {
  ad: string;
  grup: DegiskenGrubu;
  /** Dış ağa çıkıyor mu? Panelde uyarı göstermek için. */
  ag?: boolean;
  /** Kalıcı veri yazıyor mu? Test kipinde atlanır. */
  yazar?: boolean;
  isleyici: DegiskenIsleyici;
  /** Panelde gösterilecek kısa açıklama. */
  aciklama: string;
  /** Örnek kullanım. */
  ornek?: string;
}

/** Çözümleyici sınırları — sonsuz döngü ve kaynak tüketimini engeller. */
export const SINIR = {
  /** İç içe `$(...)` derinliği. */
  derinlik: 3,
  /** Tek çalıştırmada çözülecek maksimum değişken. */
  degisken: 25,
  /** `$(repeat n text)` üst sınırı (BotRix ile aynı). */
  tekrar: 10,
  /** Yerel değişken sayısı (BotRix ile aynı). */
  yerel: 5,
  /** `fetch[...]` zaman aşımı. */
  agMs: 5000,
  /** `fetch[...]` yanıt boyutu. */
  agBayt: 64 * 1024,
  /** Üretilen metnin üst sınırı. */
  ciktiUzunluk: 4000
} as const;
