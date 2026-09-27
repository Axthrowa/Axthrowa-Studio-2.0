/**
 * Eklenti yöneticisi istemcisi (`/api/eklentiler…`). Tarama/kurulum/sınama/etkinleştirme yalnız bu bilgisayardan
 * yapılır; etkinleştirme sonraki motor başlatmada geçerli olur (çalışan süreçten yerel kod güvenle boşaltılamaz).
 */
import { API_BASE } from "../api";

/** Arayüz durumu (istem §51) + motorun kendi yönettiği birinci taraf modüller */
export type EklentiDurumu =
  | "COMPATIBLE"
  | "LIKELY_COMPATIBLE"
  | "TEST_REQUIRED"
  | "MISSING_DEPENDENCY"
  | "OBS_VERSION_MISMATCH"
  | "ARCHITECTURE_MISMATCH"
  | "UNSUPPORTED"
  | "QUARANTINED"
  | "BLOCKED"
  | "ENGINE_MANAGED";

export type KonumTuru = "yonetilen" | "obsKurulum" | "programData" | "ozel";
export type KayitliTur = { id: string; tur: string; ad: string };
export type Yoklama = {
  sonuc: string;
  apiSurumu: number;
  turler: KayitliTur[];
  ad: string;
  aciklama: string;
  yazar: string;
  sureMs: number;
  cikisKodu: number | null;
  ayrinti: string;
  libobs: string;
  zaman: number;
};

export type Eklenti = {
  id: string;
  ad: string;
  surum: string | null;
  satici: string | null;
  konum: KonumTuru;
  dll: string;
  veri: string | null;
  sha256: string;
  boyut: number;
  mimari: string;
  imza: string;
  imzalayan: string | null;
  gerekliLibobs: string | null;
  bagimliliklar: string[];
  eksikBagimliliklar: string[];
  onYuz: boolean;
  qt: boolean;
  tarayici: boolean;
  birinciTaraf: boolean;
  turler: KayitliTur[];
  durum: string;
  nedenler: string[];
  oneri: string;
  yoklama: Yoklama | null;
  etkin: boolean;
  acikOnay: boolean;
  sonTestSurumu: string | null;
  sonYukleme: { zaman: number; sonuc: string; kod: number } | null;
  cokmeler: { zaman: number; asama: string; kod: number | null }[];
  karantina: string | null;
  eklendi: number;
  oncekiSurumler: { surum: string | null; yol: string; zaman: number }[];
  obsEtkin: boolean | null;
  diller: string[];
  motorNotu: string | null;
  arayuz: EklentiDurumu;
  etiket: string;
  yuklenecek: boolean;
  oturumdaYuklu: boolean;
  beklemede: string | null;
};

export type Cokme = {
  zaman: number;
  supheli: string | null;
  asama: "yukleme" | "calisma";
  cikisKodu: number | null;
  yuklu: string[];
  gozlendi: boolean;
  cozuldu: boolean;
};

export type Konum = { yol: string; tur: KonumTuru; etkin: boolean; eklendi: number };

export type EklentiListesi = {
  eklentiler: Eklenti[];
  konumlar: Konum[];
  bilinenKonumlar: { tur: KonumTuru; yol: string; var: boolean }[];
  obsModulDosyasi: boolean;
  yonetilenKlasor: string;
  sonCokme: Cokme | null;
  bekleyenCokme: Cokme | null;
  motorCalisiyor: boolean;
  guvenliKip: boolean;
  obsSurumu: string | null;
  defterYeniSurum: boolean;
};

/** Tarama/inceleme adayı: kayıt alanları + ek bilgiler (ya da çözümleme hatası) */
export type Aday = Partial<Eklenti> & {
  id?: string;
  modul?: string;
  hata?: string;
  kayitli?: boolean;
  obsYoneticisinde?: { etkin: boolean; kaynaklar: string[]; ciktilar: string[]; kodlayicilar: string[]; servisler: string[] } | null;
  yardimcilar?: string[];
  veriVar?: boolean;
  guncelleme?: { eskiSurum: string | null; konum: KonumTuru } | null;
};

export type TaramaSonucu = {
  adaylar: Aday[];
  sayilar: {
    taranan: number;
    yardimciKitaplik: number;
    obsEklentisi: number;
    birinciTaraf: number;
    ucuncuTaraf: number;
    obsYoneticisindekiModul: number;
    durumlar: Record<string, number>;
  };
};

export type PaketIncelemesi = {
  kimlik: string;
  adaylar: Aday[];
  kurulumProgramlari: string[];
  betikler: string[];
  digerKitaplik: number;
  dosyaSayisi: number;
  uyarilar: { kurulumProgrami: string | null; betik: string | null };
};

export class EklentiHatasi extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${yol}`, {
    cache: "no-store",
    method: govde === undefined ? "GET" : "POST",
    headers: govde === undefined ? undefined : { "Content-Type": "application/json" },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  const metin = await r.text();
  if (!r.ok) throw new EklentiHatasi(metin || `HTTP ${r.status}`, r.status);
  return (metin ? JSON.parse(metin) : {}) as T;
}

export const eklentiApi = {
  liste: () => istek<EklentiListesi>("/api/eklentiler"),
  tara: () => istek<TaramaSonucu>("/api/eklentiler/tara", { izin: true }),
  iceAktar: (dll: string[]) => istek<{ eklenen: { id: string; durum: string }[]; hatalar: { dll: string; hata: string }[] }>("/api/eklentiler/ice-aktar", { dll }),
  paketIncele: (yol: string) => istek<PaketIncelemesi>("/api/eklentiler/paket/incele", { yol }),
  paketKur: (kimlik: string, moduller: string[], etkinlestir: boolean) =>
    istek<{ kurulan: { id: string; durum: string; guncelleme: boolean }[]; hatalar: { modul: string; hata: string }[]; yenidenBaslat: boolean }>(
      "/api/eklentiler/paket/kur",
      { kimlik, moduller, etkinlestir }
    ),
  paketVazgec: (kimlik: string) => istek<{ ok: boolean }>("/api/eklentiler/paket/vazgec", { kimlik }),
  etkin: (id: string, etkin: boolean, acikOnay = false) =>
    istek<{ eklenti: { id: string; etkin: boolean; yuklenecek: boolean }; not: string | null }>("/api/eklentiler/etkin", { id, etkin, acikOnay }),
  /** Eklentinin kodunu ayrı süreçte çalıştırır — yalnız kullanıcı onayladıktan sonra çağrılır. */
  sina: (id: string) => istek<{ yoklama: Yoklama; eklenti: Eklenti }>("/api/eklentiler/sina", { id, onay: true }),
  karantina: (id: string, eylem: "al" | "cikar", neden = "") => istek<{ eklenti: Eklenti }>("/api/eklentiler/karantina", { id, eylem, neden }),
  kaldir: (id: string) => istek<{ ok: boolean; yedek: { yol: string } | null; not: string | null }>("/api/eklentiler/kaldir", { id, onay: true }),
  geriAl: (id: string) => istek<{ eklenti: Eklenti }>("/api/eklentiler/geri-al", { id }),
  konum: (eylem: "ekle" | "kaldir" | "etkin", yol: string, etkin = true) => istek<{ konumlar: Konum[] }>("/api/eklentiler/konum", { eylem, yol, etkin }),
  gunluk: (id: string) => istek<{ id: string; satirlar: string[] }>(`/api/eklentiler/gunluk?id=${encodeURIComponent(id)}`),
};

export type Ton = "iyi" | "uyari" | "hata" | "notr";

/** Durumun kısa etiketi, tonu ve kullanıcı için tek cümle açıklaması */
export const DURUM_BILGISI: Record<EklentiDurumu, { etiket: string; ton: Ton; aciklama: string }> = {
  COMPATIBLE: { etiket: "Uyumlu", ton: "iyi", aciklama: "Yalıtılmış süreçte ya da motorda yüklendi ve türlerini kaydetti." },
  LIKELY_COMPATIBLE: { etiket: "Muhtemelen uyumlu", ton: "notr", aciklama: "Dosya denetimleri geçti; henüz yüklenerek sınanmadı." },
  TEST_REQUIRED: { etiket: "Sınama gerekli", ton: "uyari", aciklama: "OBS ön yüzüne bağlı ya da eski sürüm için derlenmiş; sınayın ve açık onay verin." },
  MISSING_DEPENDENCY: { etiket: "Bağımlılık eksik", ton: "hata", aciklama: "Gerektirdiği bir kitaplık bu bilgisayarda yok." },
  OBS_VERSION_MISMATCH: { etiket: "OBS sürümü uyuşmuyor", ton: "hata", aciklama: "Daha yeni bir OBS için derlenmiş; libobs yüklemeyi reddeder." },
  ARCHITECTURE_MISMATCH: { etiket: "Mimari uyuşmuyor", ton: "hata", aciklama: "64 bit (x64) değil." },
  UNSUPPORTED: { etiket: "Desteklenmiyor", ton: "hata", aciklama: "OBS eklentisi değil ya da bu ortamda çalışmayı reddetti." },
  QUARANTINED: { etiket: "Karantinada", ton: "hata", aciklama: "Yüklenmez; yeniden sınayıp karantinadan çıkarabilirsiniz." },
  BLOCKED: { etiket: "Engellendi", ton: "hata", aciklama: "Yoklamada çöktü ya da dosya imzadan sonra değişmiş." },
  ENGINE_MANAGED: { etiket: "Motor yönetir", ton: "notr", aciklama: "OBS ile gelen bu modülü motor kendisi yükler ya da bilerek yüklemez." },
};

export const KONUM_ADI: Record<KonumTuru, string> = {
  yonetilen: "Bu uygulama",
  obsKurulum: "OBS kurulumu",
  programData: "ProgramData",
  ozel: "Özel klasör",
};

/** Windows çıkış kodu → "0xC0000005" (NTSTATUS işaretsiz gösterilir) */
export function kodMetni(k: number | null | undefined): string {
  if (k === null || k === undefined) return "";
  return `0x${(k >>> 0).toString(16).toUpperCase().padStart(8, "0")}`;
}

/** Çökme isteminin başlığı: "The previous session may have crashed while loading: X" karşılığı */
export function cokmeMetni(c: Cokme): string {
  const kod = c.cikisKodu !== null ? ` (${kodMetni(c.cikisKodu)})` : "";
  return c.supheli
    ? `Önceki oturum şu eklentiyi yüklerken çökmüş olabilir: ${c.supheli}${kod}`
    : `Önceki oturum üçüncü taraf eklentilerle çalışırken beklenmedik şekilde kapandı${kod}`;
}

/** Durum sayıları (sekme rozetleri için) */
export function durumSayilari(liste: Pick<Eklenti, "arayuz">[]): Record<EklentiDurumu, number> {
  const s = Object.fromEntries(Object.keys(DURUM_BILGISI).map((k) => [k, 0])) as Record<EklentiDurumu, number>;
  for (const e of liste) s[e.arayuz] = (s[e.arayuz] ?? 0) + 1;
  return s;
}

/** Etkinleştirmenin açık onay isteyip istemediği (ön yüze bağlı / uyumluluk kipi) */
export function acikOnayGerekli(e: Pick<Eklenti, "arayuz" | "acikOnay">): boolean {
  return e.arayuz === "TEST_REQUIRED" && !e.acikOnay;
}

/** Etkinleştirilebilir mi; değilse nedeni */
export function etkinlestirilebilir(e: Pick<Eklenti, "arayuz" | "karantina" | "motorNotu">): { olur: boolean; neden?: string } {
  if (e.motorNotu) return { olur: false, neden: e.motorNotu };
  if (e.karantina) return { olur: false, neden: `Karantinada: ${e.karantina}` };
  if (["COMPATIBLE", "LIKELY_COMPATIBLE", "TEST_REQUIRED"].includes(e.arayuz)) return { olur: true };
  return { olur: false, neden: DURUM_BILGISI[e.arayuz].aciklama };
}

export function boyutMetni(b: number): string {
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  if (b >= 1024) return `${Math.round(b / 1024)} KB`;
  return `${b} B`;
}
