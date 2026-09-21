/**
 * StreamAxT — API yanıtlarından sır temizleme
 * Developed by AxthrowA
 *
 * Denetimde bulundu: `GET /api/platforms` `SELECT * FROM channels` sonucunu
 * olduğu gibi döndürüyordu; yanıt Kick OAuth tokenını ve yenileme tokenını
 * DÜZ METİN taşıyordu. `GET /api/settings` de `kick_client_secret` ve
 * `gemini_api_key` değerlerini veriyordu. Sunucu `cors: '*'` ile tüm ağ
 * arayüzlerinde dinlediği için bu değerler tarayıcı üzerinden okunabiliyordu.
 *
 * Çözüm: sır alanları yanıttan çıkarılır, yerine "ayarlı mı" bilgisi ve son
 * 4 karakterlik bir önizleme konur. Panel bu bilgiyle alanın dolu olduğunu
 * gösterebilir; gerçek değeri hiç almaz.
 */

/** Sır sayılan alan adları (anahtar tam adı veya alt çizgiyle ayrılmış parçası). */
const GIZLI_PARCA = [
  'token',
  'secret',
  'password',
  'passwd',
  'apikey',
  'api_key',
  'refresh_token',
  'access_token',
  'client_secret',
  'credential',
  'private_key'
];

/** Sır GİBİ görünse de gizlenmemesi gereken alanlar. */
const ACIK_KALSIN = new Set([
  'token_expires_at', // yalnız zaman damgası
  'has_token',
  'hasToken',
  'tokenPreview',
  'token_preview'
]);

/** Bir alan adı sır taşıyor mu? */
export function gizliMi(anahtar: string): boolean {
  if (ACIK_KALSIN.has(anahtar)) return false;
  const k = String(anahtar).toLowerCase().replace(/[-\s]/g, '_');
  return GIZLI_PARCA.some((p) => k === p || k.includes(p));
}

/**
 * Değeri maskele: son 4 karakter görünür kalır ki kullanıcı hangi anahtarın
 * kayıtlı olduğunu ayırt edebilsin. Kısa değerler tamamen maskelenir.
 */
export function maskele(deger: unknown): string {
  const s = String(deger ?? '');
  if (!s) return '';
  if (s.length <= 8) return '••••••••';
  return `••••${s.slice(-4)}`;
}

/**
 * Nesneyi/diziyi derin kopyalayıp sır alanlarını temizler.
 * Her gizlenen `x` alanı için `xVar: boolean` ve `xOnizleme: string` eklenir.
 */
export function temizle<T>(veri: T): T {
  if (veri === null || veri === undefined) return veri;
  if (Array.isArray(veri)) return veri.map((x) => temizle(x)) as unknown as T;
  if (typeof veri !== 'object') return veri;
  if (veri instanceof Date) return veri;

  const kaynak = veri as Record<string, unknown>;
  const cikti: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(kaynak)) {
    if (gizliMi(k)) {
      const dolu = v !== null && v !== undefined && String(v) !== '';
      cikti[k] = dolu ? maskele(v) : '';
      cikti[`${k}Var`] = dolu;
      continue;
    }
    cikti[k] = typeof v === 'object' && v !== null ? temizle(v) : v;
  }

  return cikti as unknown as T;
}

/**
 * Panel bir sır alanını "değiştirmeden bırakmak" istediğinde maskelenmiş
 * değeri geri gönderir. Bu değer diske YAZILMAMALIDIR, yoksa gerçek token
 * "••••1234" ile ezilir. Kaydetme uçları her sır alanı için bunu çağırır.
 */
export function maskeDegeriMi(deger: unknown): boolean {
  const s = String(deger ?? '');
  return s.startsWith('••••');
}

/**
 * Kaydetme yardımcısı: gelen değer boş veya maske ise MEVCUT değer korunur.
 * Eskiden panel token alanını boş gönderdiğinde kayıtlı token siliniyordu.
 */
export function yeniSirDegeri(gelen: unknown, mevcut: string | null): string | null {
  if (gelen === undefined || gelen === null) return mevcut;
  const s = String(gelen);
  if (s === '' || maskeDegeriMi(s)) return mevcut;
  return s;
}
