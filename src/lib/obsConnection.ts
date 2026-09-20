/**
 * OBS WebSocket bağlantı bilgisinin tek kaynağı.
 *
 * ## Sorun
 * Bağlantı bilgisi üç yerde duruyordu ve birbirinden habersizdi:
 *  - `panel` ayarı — "Bağlantılar" kartının Kaydet'i buraya yazar (adres + şifre)
 *  - ekran ayarlarındaki `obs` dilimi (Giriş/Çıkış/Mola/Chat'e yansır) — eski,
 *    şifresiz bir adres kalmıştı
 *  - `localStorage` yedeği
 * Otomatik bağlanma ve sahne listesi dilimi okuyordu; kart panel ayarını. Sonuç:
 * kart "Bağlı" derken panel yanlış adrese (şifresiz) bağlanmaya çalışıyor, sahne
 * listesi boş kalıyor, sahne kısayollarının hedefi seçilemiyordu.
 *
 * ## Kural
 * Öncelik: `panel` (kullanıcının açıkça Kaydet dediği) → `saved` (yerel yedek) →
 * `slice` (ekran dilimi). Şifre, adresin geldiği kaynaktan alınır; o kaynakta
 * yoksa aynı adresi taşıyan bir başka kaynaktan. Farklı bir adresin şifresi
 * asla karıştırılmaz.
 */

export type ObsCfg = { host: string; port: number; password: string };

type Src = { host?: unknown; port?: unknown; password?: unknown } | null | undefined;

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4455;

const s = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());

export function pickObsConnection(src: { panel?: Src; saved?: Src; slice?: Src }): ObsCfg {
  const ordered = [src.panel, src.saved, src.slice].filter(
    (x): x is NonNullable<Src> => !!x && typeof x === "object"
  );
  const primary = ordered.find((x) => s(x.host)) || null;
  if (!primary) {
    return { host: DEFAULT_HOST, port: DEFAULT_PORT, password: "" };
  }
  const host = s(primary.host);
  const port =
    Number(primary.port) ||
    Number(ordered.find((x) => s(x.host) === host && Number(x.port))?.port) ||
    DEFAULT_PORT;
  const password =
    s(primary.password) ||
    s(ordered.find((x) => s(x.host) === host && s(x.password))?.password) ||
    "";
  return { host, port, password };
}

/** İki bağlantı aynı mı (adres + port + şifre)? Gereksiz yazmayı önler. */
export function sameObsConnection(a: Src, b: ObsCfg): boolean {
  return s(a?.host) === b.host && (Number(a?.port) || 0) === b.port && s(a?.password) === b.password;
}
