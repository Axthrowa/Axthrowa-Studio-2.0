/**
 * AxBoT — günlük (B5)
 * Developed by AxthrowA
 *
 * Denetim B5: 92 `console.*` çağrısı zaman damgasız ve seviyesizdi; panel
 * kabuğu çıktıyı `axbot.log` dosyasına yazıyor. İki sorun:
 *   1) Sorun ne zaman oldu bilinmiyordu (zaman damgası yok).
 *   2) SIZINTI: hata nesneleri (ör. axios hatası) olduğu gibi basıldığında
 *      istek yapılandırması da basılır — `Authorization: Bearer <token>`,
 *      `?key=<API anahtarı>`, Discord webhook adresi günlük dosyasına
 *      düşebiliyordu. Günlük dosyası destek için paylaşılan ilk şeydir.
 *
 * Çözüm: tüm `console` çağrıları tek noktada biçimlenir (her argüman
 * `util.format` ile metne çevrilir — iç içe nesneler dahil) ve bilinen sır
 * desenleri maskelenir. 92 çağrının tek tek değiştirilmesi gerekmez.
 */
import util from 'node:util';

const MASKE = '••••';

/** Bilinen sır desenleri. Sıra önemli: özelden genele. */
const DESENLER: Array<[RegExp, string]> = [
  // Discord webhook: .../webhooks/<id>/<token>
  [/(discord(?:app)?\.com\/api\/webhooks\/)\d+\/[A-Za-z0-9_\-]+/gi, `$1${MASKE}`],
  // Authorization başlıkları
  [/(Bearer\s+)[A-Za-z0-9._~+\/\-=]{8,}/gi, `$1${MASKE}`],
  [/(OAuth\s+)[A-Za-z0-9._~+\/\-=]{8,}/g, `$1${MASKE}`],
  [/(oauth:)[A-Za-z0-9]{8,}/gi, `$1${MASKE}`],
  // Adreslerdeki anahtar parametreleri (YouTube ?key=, access_token=…)
  [/([?&](?:key|access_token|refresh_token|client_secret|token)=)[^&\s"']+/gi, `$1${MASKE}`],
  // JSON / nesne yazımında sır alanları: "token": "abc…", apiKey: 'abc…'
  [
    /((?:["']?)(?:[a-z_]*token|[a-z_]*secret|password|api[_-]?key|webhook)(?:["']?)\s*[:=]\s*["']?)(?!••••)[^"'\s,}]{6,}/gi,
    `$1${MASKE}`
  ],
  // Şifreli kasa değerleri — sır değil ama gürültü
  [/(dpapi:v1:)[A-Za-z0-9+\/=]{12,}/g, `$1${MASKE}`]
];

/** Metindeki bilinen sırları maskeler. */
export function sirlariMaskele(metin: string): string {
  let s = String(metin ?? '');
  for (const [desen, yerine] of DESENLER) s = s.replace(desen, yerine);
  return s;
}

type Seviye = 'log' | 'info' | 'warn' | 'error' | 'debug';
const ETIKET: Record<Seviye, string> = { log: 'BİLGİ', info: 'BİLGİ', warn: 'UYARI', error: 'HATA', debug: 'AYIKLA' };

let kuruldu = false;

/** Tüm `console` çağrılarını zaman damgalı, seviyeli ve maskeli yapar. */
export function gunlukKur(): void {
  if (kuruldu) return;
  kuruldu = true;
  for (const seviye of Object.keys(ETIKET) as Seviye[]) {
    const asil = console[seviye].bind(console);
    console[seviye] = (...argumanlar: unknown[]) => {
      let metin: string;
      try {
        metin = sirlariMaskele(util.format(...argumanlar));
      } catch {
        metin = '[günlük biçimlenemedi]';
      }
      asil(`${new Date().toISOString()} ${ETIKET[seviye]} ${metin}`);
    };
  }
}

/** Hata nesnesinden kısa, tek satır metin (yığın izi yok, sırlar maskeli). */
export function hataMetni(e: unknown): string {
  let ham: string;
  if (e instanceof Error) ham = e.message;
  else if (typeof e === 'string') ham = e;
  else {
    try {
      ham = util.inspect(e, { depth: 1, breakLength: Infinity });
    } catch {
      ham = String(e);
    }
  }
  return sirlariMaskele(ham).replace(/\s+/g, ' ').trim().slice(0, 300);
}

const sonUyarilar = new Map<string, { an: number; bastirilan: number }>();

/**
 * B4: aynı `anahtar` için en fazla `aralikMs` içinde BİR uyarı yazar.
 *
 * Denetimde 40'tan fazla boş `catch {}` vardı; puan/bağış kaydı, çekiliş
 * ayarı, subathon durumu gibi yazımlar başarısız olunca hiçbir iz
 * kalmıyordu. Bir kısmı sohbet mesajı başına çalışıyor (AutoMod, ayar
 * okuma, sohbet aktarımı): bozuk tek bir ayar günlüğü dakikada binlerce
 * satırla doldurmasın diye seyreltilir. Bastırılan tekrar sayısı bir
 * sonraki uyarıda yazılır — hata sessiz kalmaz.
 */
export function seyrekUyar(anahtar: string, mesaj: string, hata?: unknown, aralikMs = 60_000): boolean {
  const an = Date.now();
  const kayit = sonUyarilar.get(anahtar);
  if (kayit && an - kayit.an < aralikMs) {
    kayit.bastirilan++;
    return false;
  }
  if (sonUyarilar.size > 500) sonUyarilar.clear(); // anahtarlar sabit; yine de sınırsız büyümesin
  const ek = kayit?.bastirilan ? ` (son uyarıdan beri ${kayit.bastirilan} tekrar)` : '';
  sonUyarilar.set(anahtar, { an, bastirilan: 0 });
  console.warn(hata === undefined ? `${mesaj}${ek}` : `${mesaj}: ${hataMetni(hata)}${ek}`);
  return true;
}
