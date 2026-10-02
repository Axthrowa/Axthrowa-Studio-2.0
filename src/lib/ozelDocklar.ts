/**
 * Özel tarayıcı dock'ları (OBS "Custom Browser Docks"): ad + adres listesi, bu bilgisayarda yerel saklanır.
 * Yalnız http(s) adresleri kabul edilir (javascript:, file:, data: reddedilir).
 */
export type OzelDock = { id: string; ad: string; url: string };

const ANAHTAR = "yya.yayin.ozel-docklar.v1";

export function adresGecerli(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function temizle(v: unknown): OzelDock[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is OzelDock => !!x && typeof x === "object" && typeof x.id === "string" && typeof x.ad === "string" && typeof x.url === "string")
    .filter((x) => x.ad.trim() && adresGecerli(x.url))
    .slice(0, 32)
    .map((x) => ({ id: x.id.slice(0, 40), ad: x.ad.trim().slice(0, 60), url: x.url.trim() }));
}

export function oku(): OzelDock[] {
  try {
    return temizle(JSON.parse(localStorage.getItem(ANAHTAR) ?? "[]"));
  } catch {
    return [];
  }
}

export function yaz(l: OzelDock[]) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(temizle(l)));
  } catch {
    /* yalnız bu oturumda */
  }
}
