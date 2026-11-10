/**
 * Canlı ekranının "Yayın" bölümündeki panellerin yerleşimi: 12 sütunluk ızgarada konum ve boyut.
 * Saf: sürükleme ve boyutlandırma bu işlevlerden geçer, çakışan panel aşağı itilir.
 */
export type TemelPanelId = "onizleme" | "sahne" | "ses" | "hizli" | "bilgi" | "kontrol";
/** Temel paneller ya da sonradan eklenen `ek:…` paneller */
export type PanelId = TemelPanelId | `ek:${string}`;
export type Kutu = { id: PanelId; x: number; y: number; w: number; h: number };

export const SUTUN = 12;
export const SATIR_PX = 20;
export const BOSLUK_PX = 8;

export const VARSAYILAN_YERLESIM: Kutu[] = [
  { id: "onizleme", x: 0, y: 0, w: 8, h: 13 },
  { id: "sahne", x: 8, y: 0, w: 4, h: 7 },
  { id: "ses", x: 0, y: 13, w: 12, h: 10 },
  { id: "hizli", x: 8, y: 7, w: 4, h: 6 },
];

/** Hazır çalışma alanları. `bilgi` ve `kontrol` yalnız yayın öncesinde görünür, `genisSohbet` sağ sütunu büyütür. */
export const SABLONLAR: { id: string; ad: string; genisSohbet: boolean; kutular: Kutu[] }[] = [
  {
    id: "oncesi",
    ad: "Yayın öncesi",
    genisSohbet: false,
    kutular: [
      { id: "onizleme", x: 0, y: 0, w: 5, h: 10 },
      { id: "ses", x: 5, y: 0, w: 7, h: 10 },
      { id: "bilgi", x: 0, y: 10, w: 6, h: 16 },
      { id: "kontrol", x: 6, y: 10, w: 6, h: 10 },
      { id: "sahne", x: 6, y: 20, w: 6, h: 6 },
      { id: "hizli", x: 0, y: 26, w: 12, h: 4 },
    ],
  },
  {
    id: "canli",
    ad: "Canlı",
    genisSohbet: false,
    kutular: [
      { id: "onizleme", x: 0, y: 0, w: 7, h: 11 },
      { id: "sahne", x: 7, y: 0, w: 5, h: 7 },
      { id: "hizli", x: 7, y: 7, w: 5, h: 4 },
      { id: "ses", x: 0, y: 11, w: 12, h: 10 },
    ],
  },
  {
    id: "sohbet",
    ad: "Sohbet",
    genisSohbet: true,
    kutular: [
      { id: "onizleme", x: 0, y: 0, w: 12, h: 10 },
      { id: "hizli", x: 0, y: 10, w: 12, h: 4 },
      { id: "sahne", x: 0, y: 14, w: 5, h: 10 },
      { id: "ses", x: 5, y: 14, w: 7, h: 10 },
    ],
  },
];

/** Panel bu boydan küçültülemez (sütun, satır) */
const EN_AZ: Record<TemelPanelId, { w: number; h: number }> = {
  onizleme: { w: 3, h: 5 },
  sahne: { w: 3, h: 3 },
  ses: { w: 3, h: 6 },
  hizli: { w: 2, h: 3 },
  bilgi: { w: 3, h: 6 },
  kontrol: { w: 3, h: 5 },
};

const EK_EN_AZ = { w: 3, h: 6 };

export const ekPanelMi = (id: string) => id.startsWith("ek:");

const cakisir = (a: Kutu, b: Kutu) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

function sinirla(k: Kutu): Kutu {
  const en = EN_AZ[k.id as TemelPanelId] ?? EK_EN_AZ;
  const w = Math.min(SUTUN, Math.max(en.w, Math.round(k.w)));
  return {
    id: k.id,
    w,
    h: Math.max(en.h, Math.round(k.h)),
    x: Math.min(SUTUN - w, Math.max(0, Math.round(k.x))),
    y: Math.max(0, Math.round(k.y)),
  };
}

/** Paneli yeni yerine koyar; üstüne gelinen paneller çakışma kalmayana dek aşağı kayar. */
export function yerlestir(liste: Kutu[], id: PanelId, yeni: Omit<Kutu, "id">): Kutu[] {
  const yerlesen = [sinirla({ ...yeni, id })];
  const digerleri = liste.filter((k) => k.id !== id).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const k of digerleri) {
    const kopya = { ...k };
    for (;;) {
      const engel = yerlesen.find((u) => cakisir(kopya, u));
      if (!engel) break;
      kopya.y = engel.y + engel.h;
    }
    yerlesen.push(kopya);
  }
  return liste.map((v) => yerlesen.find((k) => k.id === v.id)!);
}

/** Yeni paneli en alta ekler; zaten varsa liste değişmez. */
export function panelEkle(liste: Kutu[], id: PanelId): Kutu[] {
  if (liste.some((k) => k.id === id)) return liste;
  const y = liste.reduce((en, k) => Math.max(en, k.y + k.h), 0);
  return [...liste, { id, x: 0, y, w: SUTUN, h: 20 }];
}

export const panelKaldir = (liste: Kutu[], id: PanelId): Kutu[] => liste.filter((k) => k.id !== id);

/** Hazır şablona geçerken eklenen paneller kaybolmasın: alta dizilir */
export const eklerleBirlestir = (sablon: Kutu[], mevcut: Kutu[]): Kutu[] =>
  mevcut.filter((k) => ekPanelMi(k.id)).reduce((l, k) => panelEkle(l, k.id), sablon);

/**
 * Canlı ekranının üç kipi: her birinin kendi yerleşimi (ve kendi kaydı) vardır.
 * Yayın öncesinde kontrol listesi ve yayın bilgisi, canlıda önizleme + ses, sonrasında sahne + hızlı işlem öne çıkar.
 */
export type Kip = "oncesi" | "canli" | "sonrasi";

export const KIPLER: { id: Kip; ad: string; kutular: Kutu[] }[] = [
  { id: "oncesi", ad: "Yayın öncesi", kutular: SABLONLAR[0].kutular },
  { id: "canli", ad: "Canlı", kutular: SABLONLAR[1].kutular },
  {
    id: "sonrasi",
    ad: "Yayın sonrası",
    kutular: [
      { id: "onizleme", x: 0, y: 0, w: 8, h: 10 },
      { id: "sahne", x: 8, y: 0, w: 4, h: 7 },
      { id: "hizli", x: 8, y: 7, w: 4, h: 6 },
      { id: "ses", x: 0, y: 10, w: 8, h: 8 },
    ],
  },
];

export const kipKutulari = (kip: Kip): Kutu[] => (KIPLER.find((k) => k.id === kip) ?? KIPLER[1]).kutular;

/** Yayın açıkken Canlı kipi, kapalıyken Yayın öncesi kipi öne çıkar (kullanıcı elle başkasını seçmediyse) */
export const otomatikKip = (yayinda: boolean): Kip => (yayinda ? "canli" : "oncesi");

/** Kayıtlı metni okur; bozuk ya da eksikse `varsayilan` yerleşim döner. */
export function yerlesimOku(ham: string | null, varsayilan: Kutu[] = VARSAYILAN_YERLESIM): Kutu[] {
  if (!ham) return varsayilan;
  try {
    const okunan = JSON.parse(ham) as Kutu[];
    const liste = (Array.isArray(okunan) ? okunan : []).filter((k) => k && (k.id in EN_AZ || (typeof k.id === "string" && ekPanelMi(k.id))) && [k.x, k.y, k.w, k.h].every(Number.isFinite));
    if (!VARSAYILAN_YERLESIM.every((v) => liste.some((k) => k.id === v.id))) return varsayilan;
    let sonuc = liste;
    // Teker teker yerleştirilir: elle bozulmuş kayıtta da çakışma kalmaz
    for (const k of [...liste].reverse()) sonuc = yerlestir(sonuc, k.id, k);
    return sonuc;
  } catch {
    return varsayilan;
  }
}
