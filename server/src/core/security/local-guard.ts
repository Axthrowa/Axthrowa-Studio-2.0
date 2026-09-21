/**
 * StreamAxT — yerel erişim koruması
 * Developed by AxthrowA
 *
 * Tehdit modeli: StreamAxT tek kullanıcılı, yerel bir araç. Tehlike
 * "internetten saldırgan" değil, kullanıcının ziyaret ettiği herhangi bir
 * web sayfası. Sunucu `cors: { origin: '*' }` ile çalıştığı için
 * `evil.com` üzerindeki bir betik `fetch('http://localhost:3001/api/platforms')`
 * çağrısıyla Kick OAuth tokenını okuyabiliyordu.
 *
 * İki katman:
 *   1) CORS beyaz listesi — yabancı köken yanıtı OKUYAMAZ
 *   2) Yazma koruması    — yabancı köken yan etki OLUŞTURAMAZ (CSRF)
 *
 * CORS tek başına yetmez: basit istekler ön kontrole (preflight) tabi
 * olmadığından tarayıcı yanıtı gizlese bile istek sunucuda ÇALIŞIR.
 * Bu yüzden değiştiren uçlarda Origin başlığı ayrıca doğrulanır.
 */

/** Yerel sayılan ana makine adları. */
const YEREL_HOST = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/** Tarayıcı dışı kabuklar (Tauri, Electron) kendi şemalarını kullanır. */
const OZEL_SEMA = ['tauri:', 'file:'];

/**
 * Köken yerel mi?
 *
 * `undefined` → Origin başlığı yok demektir: aynı köken GET'leri, OBS
 * tarayıcı kaynağı, curl ve sunucu-sunucu istekleri böyle gelir. Tarayıcı
 * çapraz köken isteklerinde Origin'i HER ZAMAN gönderir, dolayısıyla
 * başlığın yokluğu güvenli kabul edilir.
 *
 * `'null'` → sandbox'lı iframe veya `file://`. Kötü niyetli bir sayfa
 * sandbox iframe ile bunu üretebildiği için GÜVENİLMEZ sayılır.
 */
export function yerelKokenMi(origin: string | undefined | null): boolean {
  if (origin === undefined || origin === null || origin === '') return true;
  if (origin === 'null') return false;

  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return false;
  }

  if (OZEL_SEMA.includes(u.protocol)) return true;
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;

  return YEREL_HOST.has(u.hostname);
}

/** Yanıtta kullanılacak `Access-Control-Allow-Origin` değeri (yoksa null). */
export function corsKokeni(origin: string | undefined): string | null {
  if (!origin) return null;
  return yerelKokenMi(origin) ? origin : null;
}

/** Yan etkisi olan HTTP yöntemleri. */
const YAZMA = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function yazmaYontemiMi(method: string): boolean {
  return YAZMA.has(String(method).toUpperCase());
}

/**
 * İstek kabul edilmeli mi? Yalnız yazma isteklerinde köken zorunlu olarak
 * yerel olmalı. Okuma isteklerini CORS zaten engelliyor.
 */
export function istekKabulEdilir(method: string, origin: string | undefined): boolean {
  if (!yazmaYontemiMi(method)) return true;
  return yerelKokenMi(origin);
}

/**
 * Sunucunun bağlanacağı adres. Varsayılan yalnız bu makine; ağdaki başka
 * cihazlardan erişim isteniyorsa kullanıcı `STREAMAXT_HOST=0.0.0.0` diyerek
 * bunu AÇIKÇA seçer. Eskiden host verilmediği için Node tüm arayüzleri
 * dinliyordu ve aynı ağdaki herkes botu yönetebiliyordu.
 */
export function baglanmaAdresi(env: NodeJS.ProcessEnv = process.env): string {
  const secim = (env.STREAMAXT_HOST || '').trim();
  return secim || '127.0.0.1';
}

/** Bağlama adresi yerel dışıysa kullanıcıya uyarı metni döndürür. */
export function baglanmaUyarisi(host: string): string | null {
  if (YEREL_HOST.has(host) && host !== '0.0.0.0') return null;
  return (
    `[UYARI] Sunucu ${host} adresinde dinliyor — aynı agdaki TUM cihazlar ` +
    `StreamAxT'yi yonetebilir. Yalniz bu bilgisayardan erisim icin ` +
    `STREAMAXT_HOST degiskenini kaldirin.`
  );
}
