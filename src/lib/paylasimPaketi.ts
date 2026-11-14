/**
 * U14 paket paylaşımı: sahne ekranları (giriş/çıkış/mola/sohbet görünümü), overlay widget düzeni ve deste tek JSON
 * dosyada. Sırlar dosyaya hiç girmez: destek paketiyle (`src-tauri/src/destek.rs`) aynı alan adı kuralı, belirteç
 * görünümlü uzun dizgiler ve rtmp adresleri ayıklanır. İçe aktarmada önce "neler değişecek" listesi gösterilir.
 */
import { parseDeck, type DeckConfig } from "./deck";

export const PAKET_TURU = "axthrowa-studio-paketi";
export const PAKET_SURUMU = 1;
export const PAKET_EKRANLARI = ["starting", "ending", "brb", "chat"] as const;
export type PaketEkrani = (typeof PAKET_EKRANLARI)[number];

const EKRAN_ADI: Record<PaketEkrani, string> = { starting: "Giriş ekranı", ending: "Çıkış ekranı", brb: "Mola ekranı", chat: "Sohbet ekranı" };

export type PaketWidget = { kind: string; name: string; enabled: boolean; sort_order: number; config: Record<string, unknown> };
export type Paket = {
  tur: typeof PAKET_TURU;
  surum: number;
  olusturma: string;
  ekranlar: Partial<Record<PaketEkrani, Record<string, unknown>>>;
  widgetlar: PaketWidget[];
  deste: DeckConfig | null;
};

const GIZLI_PARCALAR = [
  "password", "passwd", "parola", "sifre", "şifre", "token", "secret", "apikey", "api_key", "streamkey",
  "stream_key", "anahtar", "cookie", "session", "credential", "webhook", "authorization", "bearer", "private",
];

/** Rust `destek::gizli_alan_mi` ile aynı kural */
export function gizliAlanMi(ad: string): boolean {
  const k = ad.toLowerCase();
  if (GIZLI_PARCALAR.some((p) => k.includes(p))) return true;
  return (k === "key" || k.endsWith("key") || k.endsWith("keys")) && !k.endsWith("hotkey") && !k.endsWith("hotkeys");
}

function gizliDegerMi(s: string): boolean {
  if (/rtmps?:\/\//i.test(s)) return true;
  // Belirteç görünümlü: boşluksuz, ≥32 karakter, harf ve rakam karışık (görsel/veri adresleri hariç)
  if (s.startsWith("data:") || /^https?:\/\//i.test(s)) return false;
  return s.length >= 32 && /^[A-Za-z0-9\-_.=/+]+$/.test(s) && /\d/.test(s) && /[A-Za-z]/.test(s);
}

/** Sır taşıyabilecek alanları atar; atılan yolları döner */
export function sirlariAyikla(v: unknown, yol = "", atilan: string[] = []): { temiz: unknown; atilan: string[] } {
  if (Array.isArray(v)) return { temiz: v.map((x, i) => sirlariAyikla(x, `${yol}[${i}]`, atilan).temiz), atilan };
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      const alt = yol ? `${yol}.${k}` : k;
      // Sır adlı alanın açık/kapalı ya da sayı değeri sır olamaz (ör. showSessionCount)
      const ilkel = typeof x === "boolean" || typeof x === "number" || x === null;
      if ((gizliAlanMi(k) && !ilkel) || (typeof x === "string" && gizliDegerMi(x))) {
        atilan.push(alt);
        continue;
      }
      out[k] = sirlariAyikla(x, alt, atilan).temiz;
    }
    return { temiz: out, atilan };
  }
  return { temiz: v, atilan };
}

type WidgetSatiri = { kind?: unknown; name?: unknown; enabled?: unknown; sort_order?: unknown; config?: unknown; config_json?: unknown };

function widgetCevir(w: WidgetSatiri): PaketWidget | null {
  if (typeof w.kind !== "string" || !w.kind) return null;
  let config = w.config && typeof w.config === "object" ? (w.config as Record<string, unknown>) : {};
  if (!w.config && typeof w.config_json === "string") {
    try {
      config = JSON.parse(w.config_json) as Record<string, unknown>;
    } catch {
      config = {};
    }
  }
  return { kind: w.kind, name: typeof w.name === "string" ? w.name : w.kind, enabled: w.enabled !== false && w.enabled !== 0, sort_order: Number(w.sort_order) || 0, config };
}

/** Ekran ayarlarında bu bilgisayara özgü olanlar (OBS bağlantısı) paylaşılmaz, içe aktarılınca da ezilmez */
const YEREL_EKRAN_ALANLARI = ["obs"];
const ekranAyari = (v: unknown) =>
  v && typeof v === "object" ? Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([k]) => !YEREL_EKRAN_ALANLARI.includes(k))) : null;

export function paketOlustur(girdi: { ekranlar: Partial<Record<PaketEkrani, unknown>>; widgetlar: WidgetSatiri[]; deste: unknown }): { paket: Paket; atilan: string[] } {
  const ham = {
    ekranlar: Object.fromEntries(PAKET_EKRANLARI.filter((e) => girdi.ekranlar[e]).map((e) => [e, ekranAyari(girdi.ekranlar[e])])),
    widgetlar: girdi.widgetlar.map(widgetCevir).filter((w): w is PaketWidget => !!w),
    deste: girdi.deste ? parseDeck(girdi.deste) : null,
  };
  const { temiz, atilan } = sirlariAyikla(ham);
  const t = temiz as Omit<Paket, "tur" | "surum" | "olusturma">;
  return { paket: { tur: PAKET_TURU, surum: PAKET_SURUMU, olusturma: new Date().toISOString(), ...t, deste: t.deste ? parseDeck(t.deste) : null }, atilan };
}

/** Dosyayı doğrular; yabancı/bozuk dosyada açıklayıcı hata. İçe aktarırken de sır ayıklanır (elle düzenlenmiş dosya). */
export function paketOku(metin: string): Paket {
  let v: Partial<Paket>;
  try {
    v = JSON.parse(metin) as Partial<Paket>;
  } catch {
    throw new Error("Dosya JSON değil");
  }
  if (v?.tur !== PAKET_TURU) throw new Error("Bu dosya bir AxthrowA Studio paketi değil");
  if (typeof v.surum !== "number" || v.surum > PAKET_SURUMU) throw new Error("Paket bu sürümden yeni; önce Studio'yu güncelleyin");
  const { paket } = paketOlustur({
    ekranlar: v.ekranlar && typeof v.ekranlar === "object" ? v.ekranlar : {},
    widgetlar: Array.isArray(v.widgetlar) ? v.widgetlar : [],
    deste: v.deste ?? null,
  });
  return { ...paket, olusturma: typeof v.olusturma === "string" ? v.olusturma : paket.olusturma };
}

const anahtar = (w: { kind: string; name: string }) => `${w.kind}\u0000${w.name}`;

type MevcutWidget = { id: string; kind: string; name?: string; config?: unknown };
/** Mevcut widget'la tür+ad eşleşirse (ayarı farklıysa) güncellenir, yoksa eklenir */
export function widgetEslesmesi(paket: PaketWidget[], mevcut: MevcutWidget[]): { guncelle: { id: string; w: PaketWidget }[]; ekle: PaketWidget[] } {
  const m = new Map(mevcut.map((x) => [anahtar({ kind: x.kind, name: x.name ?? x.kind }), x]));
  const guncelle: { id: string; w: PaketWidget }[] = [];
  const ekle: PaketWidget[] = [];
  for (const w of paket) {
    const x = m.get(anahtar(w));
    if (!x) ekle.push(w);
    // Mevcut ayarın sırları pakette yok; karşılaştırma onları saymaz
    else if (JSON.stringify(sirlariAyikla(x.config ?? {}).temiz) !== JSON.stringify(w.config)) guncelle.push({ id: x.id, w });
  }
  return { guncelle, ekle };
}

/** İçe aktarma önizlemesi: kullanıcıya okunur "neler değişecek" satırları */
export function degisiklikler(paket: Paket, mevcut: { ekranlar: Partial<Record<PaketEkrani, Record<string, unknown>>>; widgetlar: MevcutWidget[]; deste: DeckConfig | null }): string[] {
  const out: string[] = [];
  for (const e of PAKET_EKRANLARI) {
    const yeni = paket.ekranlar[e];
    if (!yeni) continue;
    const eski = mevcut.ekranlar[e] ?? {};
    const farkli = Object.keys(yeni).filter((k) => JSON.stringify(yeni[k]) !== JSON.stringify(eski[k])).length;
    if (farkli) out.push(`${EKRAN_ADI[e]}: ${farkli} ayar değişecek`);
  }
  const { guncelle, ekle } = widgetEslesmesi(paket.widgetlar, mevcut.widgetlar);
  if (guncelle.length) out.push(`${guncelle.length} widget güncellenecek (${guncelle.map((g) => g.w.name).join(", ")})`);
  if (ekle.length) out.push(`${ekle.length} widget eklenecek (${ekle.map((w) => w.name).join(", ")})`);
  if (paket.deste && JSON.stringify(paket.deste.pages) !== JSON.stringify(mevcut.deste?.pages)) {
    const dugme = paket.deste.pages.reduce((n, p) => n + p.buttons.length, 0);
    const eskiDugme = mevcut.deste?.pages.reduce((n, p) => n + p.buttons.length, 0) ?? 0;
    out.push(`Deste değiştirilecek: ${paket.deste.pages.length} sayfa, ${dugme} düğme (şu an ${eskiDugme} düğme)`);
  }
  return out;
}
