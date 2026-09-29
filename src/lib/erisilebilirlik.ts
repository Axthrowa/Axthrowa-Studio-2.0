/**
 * Erişilebilirlik renkleri (OBS Ayarlar › Erişilebilirlik): önizleme seçim kutusu ve ses ölçeri bölge renkleri.
 * CSS değişkenleriyle uygulanır; tercih bu bilgisayarda yerel depolamada durur (sır değil).
 */
export type ErisimRenkleri = { secim: string; normal: string; uyari: string; hata: string };

export const VARSAYILAN_RENKLER: ErisimRenkleri = { secim: "#ff4040", normal: "#3dd68c", uyari: "#f5d524", hata: "#e5484d" };

/** Hazırlar: renk körlüğü (Okabe-Ito paletinden mavi / turuncu / kırmızımsı turuncu) ve yüksek kontrast */
export const HAZIRLAR: { id: string; ad: string; renkler: ErisimRenkleri }[] = [
  { id: "varsayilan", ad: "Varsayılan", renkler: VARSAYILAN_RENKLER },
  { id: "renk-korlugu", ad: "Renk körlüğüne uygun", renkler: { secim: "#0072b2", normal: "#56b4e9", uyari: "#e69f00", hata: "#d55e00" } },
  { id: "yuksek-kontrast", ad: "Yüksek kontrast", renkler: { secim: "#ffff00", normal: "#00ff00", uyari: "#ffff00", hata: "#ff00ff" } },
];

const ANAHTAR = "yya.erisilebilirlik.v1";
const HEX = /^#[0-9a-f]{6}$/i;

export const CSS_DEGISKENLERI: Record<keyof ErisimRenkleri, string> = {
  secim: "--dt-erisim-secim",
  normal: "--dt-olcer-normal",
  uyari: "--dt-olcer-uyari",
  hata: "--dt-olcer-hata",
};

/** Bozuk/eksik alanlar varsayılana döner */
export function temizle(v: unknown): ErisimRenkleri {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const al = (k: keyof ErisimRenkleri) => (typeof o[k] === "string" && HEX.test(o[k] as string) ? (o[k] as string).toLowerCase() : VARSAYILAN_RENKLER[k]);
  return { secim: al("secim"), normal: al("normal"), uyari: al("uyari"), hata: al("hata") };
}

export function oku(): ErisimRenkleri {
  try {
    return temizle(JSON.parse(localStorage.getItem(ANAHTAR) ?? "{}"));
  } catch {
    return VARSAYILAN_RENKLER;
  }
}

export function yaz(r: ErisimRenkleri) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(temizle(r)));
  } catch {
    /* depolama yoksa yalnız bu oturumda */
  }
}

export function uygula(r: ErisimRenkleri, kok: HTMLElement = document.documentElement) {
  const t = temizle(r);
  for (const k of Object.keys(CSS_DEGISKENLERI) as (keyof ErisimRenkleri)[]) kok.style.setProperty(CSS_DEGISKENLERI[k], t[k]);
}
