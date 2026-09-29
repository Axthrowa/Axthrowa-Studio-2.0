/**
 * Yerel yayın çekirdeği istemcisi (`/api/motor…`). Çekirdek ayrı bir süreçtir (libobs); panel yalnız bu uçlar
 * üzerinden yönetir. Yayın anahtarları hiçbir yanıtta yer almaz.
 */
import { API_BASE } from "../api";
import type { Cokme } from "./eklentiler";
import type { OzellikTanimi } from "../ozellikFormu";

export type MotorKaynakTuru =
  | "renk"
  | "yazi"
  | "gorsel"
  | "medya"
  | "tarayici"
  | "ekran"
  | "pencere"
  | "oyun"
  | "kamera"
  | "mikrofon"
  | "masaustu"
  | "uygulama_sesi"
  | "eklenti"
  | "obs" | "slayt";
export type MotorCikisDurumu = "hazir" | "baglaniyor" | "canli" | "yeniden_baglaniyor" | "durduruluyor" | "durduruldu" | "basarisiz";

export type MotorOgeKaydi = { tuval: string; konum: [number, number]; sinir?: [number, number] | null; gorunur: boolean };
export type MotorFiltreKaydi = { id: string; tur: string; ad: string; etkin: boolean; ayarlar?: Record<string, unknown> };
export type MotorSesKaydi = { ses: number; sessiz: boolean; denge: number; mono: boolean; senkron_ms: number; izleme: number };
export type MotorKaynak = {
  id: string;
  tur: MotorKaynakTuru;
  obs_turu: string;
  ad: string;
  izler: number;
  /** Yalnız eski (v1) kayıtlarda */
  ogeler?: MotorOgeKaydi[];
  ayarlar?: Record<string, unknown>;
  /** Tür bu motorda kayıtlı değil (ör. eklenti kaldırıldı); ayarlar korunuyor */
  eksik?: boolean;
  filtreler?: MotorFiltreKaydi[];
  ses?: MotorSesKaydi;
};
export type MotorHedef = {
  id: string;
  ad: string;
  platform: string;
  etkin: boolean;
  anahtarVar: boolean;
  tuval: string | null;
  /** Motorun 0 tabanlı izi (arayüzde +1) */
  iz: number | null;
  /** Hedefe özel bit hızı (yoksa tuvalinki) */
  bitHizi?: number | null;
  durum: MotorCikisDurumu;
  kod: number | null;
  yonlendiricideCanli: boolean;
};
export type MotorCikisIstatistigi = {
  id: string;
  tur: "rtmp" | "kayit" | "tekrar";
  durum: MotorCikisDurumu;
  etkin: boolean;
  bayt: number;
  kare: number;
  dusen_kare: number;
  son_hata?: string;
};
export type MotorDurumu = {
  calisiyor: boolean;
  exeVar: boolean;
  bilgi: { libobs?: string; video_kodlayicilari?: { id: string; ad: string; kodek: string; donanim: boolean }[] } | null;
  dikey: boolean;
  fps: number;
  tuvaller: { id: string; genislik: number; yukseklik: number; ana: boolean }[] | null;
  profil?: { id: string; ad: string };
  /** Kurulu video kodlayıcıları (kodlama paylaşımı tanısı) */
  kodlayicilar?: string[];
  istatistik: { fps: number; ortalama_kare_ms: number; toplam_kare: number; geciken_kare: number; cikislar: MotorCikisIstatistigi[] } | null;
  kaynaklar: MotorKaynak[];
  hedefler: MotorHedef[];
  kayit: { durum: MotorCikisDurumu; son: string | null; duraklatildi?: boolean; ayriKodlayici?: boolean };
  tekrar: { durum: MotorCikisDurumu; sureSn: number; son: string | null; dikey?: MotorCikisDurumu | null };
  sanalKamera?: { durum: MotorCikisDurumu };
  kayitKlasoru: string;
  sonCikisKodu: number | null;
  /** Önceki oturum üçüncü taraf eklentiyle çöktü; karar verilmeden motor başlatılmaz */
  cokme: Cokme | null;
  /** Bu oturumda yüklenen üçüncü taraf eklentiler ve kaydettikleri türler */
  eklentiler: MotorEklentiSonucu[];
  guvenliKip: boolean;
  /** Profildeki tuval taban boyutları */
  tuvalBoyutlari?: Record<"ana" | "dikey", [number, number]>;
  video?: MotorVideoAyari;
  /** Windows performans sayaçlarından 3D motor kullanımı (%); ölçüm yoksa null */
  gpu?: { sistem: number; motor: number | null } | null;
};
export type MotorVideoAyari = {
  taban: [number, number];
  cikis: [number, number];
  dikey_taban: [number, number];
  olcek_filtresi: "bilinear" | "bicubic" | "lanczos" | "area";
  renk_bicimi: "nv12" | "i420" | "i444" | "p010" | "i010" | "bgra";
  renk_uzayi: "601" | "709" | "srgb" | "2100pq" | "2100hlg";
  renk_araligi: "kismi" | "tam";
};
export type MotorSesAyari = { ornekleme: 44100 | 48000; hoparlor: "mono" | "stereo" | "2.1" | "4.0" | "4.1" | "5.1" | "7.1" };
export type MotorAgAyari = {
  bagla_ip: string;
  ip_ailesi: "IPv4+IPv6" | "IPv4" | "IPv6";
  yeni_soket_dongusu: boolean;
  dusuk_gecikme: boolean;
  dinamik_bit_hizi: boolean;
  yeniden_baglan: boolean;
  deneme_gecikmesi_sn: number;
  en_cok_deneme: number;
};
export type MotorOgeGecisi = { tur: string; sure_ms: number; ayarlar?: Record<string, unknown> };
export type MotorEklentiSonucu = {
  id: string;
  sonuc: string;
  kod: number;
  apiSurumu: number;
  turler: { id: string; tur: string; ad: string }[];
  ad: string;
};
export type MotorSahneOgesi = {
  oge: string;
  kaynak: string;
  ad?: string;
  /** Panel türü; iç içe sahnede "sahne", grupta "grup" */
  tur?: MotorKaynakTuru | "sahne" | "grup";
  obsTuru?: string;
  konum: [number, number];
  olcek: [number, number];
  sinir: [number, number] | null;
  gorunur: boolean;
  aci?: number;
  /** OBS_ALIGN_* bitleri: sol 1, sağ 2, üst 4, alt 8 */
  hizalama?: number;
  sinir_turu?: number;
  sinir_hizalama?: number;
  /** sol, üst, sağ, alt */
  kirp?: [number, number, number, number];
  kilit?: boolean;
  olcek_filtresi?: number;
  karistirma?: number;
  /** 0 varsayılan, 1 sRGB kapalı */
  karistirma_yontemi?: number;
  /** [kip 0–8, alan sırası 0 üst / 1 alt] */
  deinterlace?: [number, number];
  /** Kaynağın kendi boyutu (dönüşümsüz) */
  genislik?: number;
  yukseklik?: number;
  grup?: boolean;
  /** Grup içindeyse grup öğesinin kimliği */
  ust?: string;
  /** hazir | bekliyor (boyutu 0: pencere/oyun bulunamadı, aygıt yok…) */
  durum?: "hazir" | "bekliyor";
  /** Fare/klavye etkileşimi alır (tarayıcı kaynağı vb.) */
  etkilesim?: boolean;
  gosterGecisi?: MotorOgeGecisi | null;
  gizleGecisi?: MotorOgeGecisi | null;
  ses?: boolean;
  filtre?: number;
};
export type MotorEksikOge = { kaynak: string; ad: string; tur: string; obsTuru: string; eksik: true };
export type MotorSahneYaniti = { tuval: string; sahne: string; genislik: number; yukseklik: number; ogeler: MotorSahneOgesi[]; eksikler: MotorEksikOge[] };
export type MotorGecis = { tur: string; sure_ms: number; ayarlar?: Record<string, unknown> };
export type MotorSahneOzeti = { id: string; ad: string; tuval: string; ogeSayisi: number; gecis: MotorGecis | null; etkinTuval: boolean };
export type MotorSahneler = {
  calisiyor: boolean;
  koleksiyon?: { id: string; ad: string };
  sahneler: MotorSahneOzeti[];
  program: Record<string, string>;
  studyo: Record<string, string | null>;
  gecisler: Record<string, MotorGecis>;
  gecisTurleri: { id: string; ad: string }[] | null;
  dikey?: boolean;
};
export type MotorSesKanali = {
  id: string;
  ad: string;
  tur?: MotorKaynakTuru;
  obsTuru?: string;
  ses: number;
  sessiz: boolean;
  denge: number;
  mono: boolean;
  senkron_ms: number;
  izleme: number;
  izler: number;
  medya: { durum: string; sure_ms: number; zaman_ms: number } | null;
  filtre?: number;
  sahnede?: boolean;
  etkin?: boolean;
  goruntu?: boolean;
};
export type MotorCiftSes = { uygulama: string; uygulamaAdi: string; masaustu: string; masaustuAdi: string; izler: number[] };
export type MotorIzlemeAygiti = { ad: string; id: string };
export type MotorSesDurumu = {
  kaynaklar: MotorSesKanali[];
  izlemeAygitlari: MotorIzlemeAygiti[] | null;
  izlemeSecili: MotorIzlemeAygiti | null;
  izAdlari: string[];
  ciftSes: MotorCiftSes[];
};
export type MotorFiltre = { id: string; tur: string; ad: string; etkin: boolean; eksik?: boolean };
export type MotorFiltreTuru = { id: string; ad: string; ses: boolean; video: boolean };
export type MotorKoleksiyonOzeti = { id: string; ad: string; sahne: number | null; kaynak: number | null; degistirilme: number | null; etkin: boolean };
export type MotorSeviye = { id: string; tepe: [number, number]; ortalama: [number, number] };
export type MotorDonusumAlanlari = Partial<{
  konum: [number, number];
  olcek: [number, number];
  sinir: [number, number];
  sinir_turu: number;
  sinir_hizalama: number;
  hizalama: number;
  aci: number;
  kirp: [number, number, number, number];
  kilit: boolean;
  gorunur: boolean;
  olcek_filtresi: number;
  karistirma: number;
  karistirma_yontemi: number;
}>;
export type MotorOgeIslemi = {
  eylem: "sira" | "kaldir" | "donustur" | "ekle" | "grupla" | "grubu-coz" | "gruba-ekle" | "gruptan-cikar" | "grup-adlandir";
  oge?: string;
  yon?: "yukari" | "asagi" | "en_ust" | "en_alt";
  konum_sira?: number;
  donusum?: MotorDonusumAlanlari;
  sahne?: string;
  kaynak?: string;
  ogeler?: string[];
  grup?: string;
  ad?: string;
};
export type MotorHedefAtamasi = { tuval: string; iz: number; bit_hizi?: number | null };
export type MotorProfil = {
  surum: number;
  ad: string;
  fps: number;
  cikis: {
    kip: "basit" | "gelismis" | "uzman";
    kodlayici: string;
    bit_hizi_ana: number;
    bit_hizi_dikey: number;
    anahtar_kare_sn: number;
    ses_bit_hizi: number;
    uzman?: Record<string, Record<string, unknown>>;
  };
  kayit: { bicim: string; izler: number[]; klasor?: string | null; ayri_kodlayici: boolean; bolme_dk: number; bolme_mb: number };
  tekrar_dikey: boolean;
  tekrar_sn: number;
  iz_adlari: string[];
  hedefler: Record<string, MotorHedefAtamasi>;
  izleme_aygiti?: { id: string; ad: string } | null;
  video: MotorVideoAyari;
  ses: MotorSesAyari;
  ag: MotorAgAyari;
};
export type MotorProfilYaniti = {
  id: string;
  profil: MotorProfil;
  calisiyor: boolean;
  videoKodlayicilari: { id: string; ad: string; kodek: string; donanim: boolean }[] | null;
  kayitBicimleri: { ad: string; uzanti?: string; aciklama?: string }[] | null;
  etkinCikis: boolean;
};

export type MotorKoleksiyonIslemi = {
  eylem: "yeni" | "cogalt" | "adlandir" | "gec" | "sil" | "yedekle" | "ice-aktar" | "obs-listesi" | "obs-ice-aktar";
  id?: string;
  ad?: string;
  veri?: unknown;
  dosya?: string;
};
export type MotorSecenek = { ad: string; deger: string | number };

export class MotorHatasi extends Error {
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
  if (!r.ok) throw new MotorHatasi(metin || `HTTP ${r.status}`, r.status);
  return (metin ? JSON.parse(metin) : {}) as T;
}

export type ObsWebsocketDurumu = {
  etkin: boolean;
  port: number;
  yayinDenetimi: boolean;
  calisanPort: number | null;
  parolaVar: boolean;
  surum: string;
  istekSayisi: number;
};

/** obs-websocket 5.x uyumlu uzaktan denetim sunucusu (Stream Deck, Touch Portal, Streamer.bot…) */
export const obsWebsocketApi = {
  durum: () => istek<ObsWebsocketDurumu>("/api/obs-websocket"),
  ayarla: (g: { etkin?: boolean; port?: number; yayin_denetimi?: boolean; parola_yenile?: boolean }) =>
    istek<{ ok: boolean; calisanPort: number | null }>("/api/obs-websocket", g),
  parola: () => istek<{ parola: string }>("/api/obs-websocket/parola", {}),
};

export const motorApi = {
  durum: () => istek<MotorDurumu>("/api/motor"),
  baslat: (dikey: boolean, fps: 30 | 60, ek: { cokme_karari?: "normal" | "guvenli" | "devre-disi"; guvenli_kip?: boolean } = {}) =>
    istek<{ ok: boolean; eksikKaynaklar: string[]; eklentiler?: MotorEklentiSonucu[]; guvenliKip?: boolean }>("/api/motor/baslat", { dikey, fps, ...ek }),
  durdur: () => istek<{ ok: boolean }>("/api/motor/durdur", { confirm: true }),
  kaynakEkle: (tur: MotorKaynakTuru, deger: string, ad: string, tuvaller: string[], sahne?: string) =>
    istek<MotorKaynak>("/api/motor/kaynak", sahne ? { tur, deger, ad, sahne } : { tur, deger, ad, tuvaller }),
  kaynakSil: (id: string) => istek<{ ok: boolean }>("/api/motor/kaynak/sil", { id }),
  kaynakIzler: (id: string, maske: number) => istek<{ ok: boolean }>("/api/motor/kaynak/izler", { id, maske }),
  kaynakOzellikleri: (id: string) => istek<OzellikTanimi>(`/api/motor/kaynak/ozellikler?id=${encodeURIComponent(id)}`),
  kaynakGuncelle: (id: string, ayarlar: Record<string, unknown>) => istek<{ ok: boolean }>("/api/motor/kaynak/guncelle", { id, ayarlar }),
  secenekler: (tur: MotorKaynakTuru) => istek<{ secenekler: MotorSecenek[] }>(`/api/motor/secenekler?tur=${tur}`).then((r) => r.secenekler),
  sahne: (tuval: string) => istek<{ ogeler: MotorSahneOgesi[] }>(`/api/motor/sahne?tuval=${tuval}`).then((r) => r.ogeler),
  oge: (oge: string, eylem: "sira" | "kaldir" | "donustur", ek: { yon?: string; konum?: [number, number]; sinir?: [number, number]; gorunur?: boolean } = {}) =>
    istek<{ ok: boolean }>("/api/motor/oge", { oge, eylem, ...ek }),
  /** Bir sahnenin öğeleri (motor sırası: alttan üste; grup çocukları grubun ardından) */
  sahneDetay: (sahne: string) => istek<MotorSahneYaniti>(`/api/motor/sahne?sahne=${encodeURIComponent(sahne)}`),
  ogeIslem: (govde: MotorOgeIslemi) => istek<{ ok: boolean; oge?: string }>("/api/motor/oge", govde),
  /** Öğe gösterme (goster=true) ya da gizleme geçişi; null = kaldır */
  ogeGecis: (oge: string, goster: boolean, gecis: MotorOgeGecisi | null) =>
    istek<{ ok: boolean }>("/api/motor/oge", { oge, eylem: "gecis", goster, gecis }),
  /** Etkileşim penceresi: `ac` kaynağın tek başına görüntüsünü (`etkilesim-<kaynak>` tuvali) hazırlar */
  multiview: (tuval: string, eylem: "ac" | "kapat") => istek<MultiviewDuzeni>("/api/motor/multiview", { tuval, eylem }),
  etkilesimAc: (kaynak: string) => istek<{ tuval: string; genislik: number; yukseklik: number }>("/api/motor/etkilesim", { kaynak, eylem: "ac" }),
  etkilesimKapat: (kaynak: string) => istek<{ ok: boolean }>("/api/motor/etkilesim", { kaynak, eylem: "kapat" }),
  etkilesimOlayi: (kaynak: string, olay: Record<string, unknown>) => istek<{ ok: boolean }>("/api/motor/etkilesim", { kaynak, eylem: "olay", olay }),
  sahneler: () => istek<MotorSahneler>("/api/motor/sahneler"),
  sahneIslem: (govde: { eylem: "olustur" | "adlandir" | "sil" | "cogalt" | "sirala" | "gecis"; id?: string; ad?: string; tuval?: string; sira?: string[]; gecis?: MotorGecis | null }) =>
    istek<{ id?: string }>("/api/motor/sahne-islem", govde),
  program: (sahne: string, gecis = true, sure_ms?: number) => istek<{ ok: boolean }>("/api/motor/program", { sahne, gecis, sure_ms }),
  gecis: (tuval: string) =>
    istek<{ tuval: string; bilgi: { tur: string; sure_ms: number; program: string | null }; turler: { id: string; ad: string }[] }>(`/api/motor/gecis?tuval=${tuval}`),
  gecisAyarla: (tuval: string, tur: string, sure_ms?: number) => istek<{ ok: boolean }>("/api/motor/gecis", { tuval, tur, sure_ms }),
  gecisOzellikleri: (tuval: string) => istek<OzellikTanimi>(`/api/motor/gecis/ozellikler?tuval=${tuval}`),
  gecisGuncelle: (tuval: string, ayarlar: Record<string, unknown>) => istek<{ ok: boolean }>("/api/motor/gecis/guncelle", { tuval, ayarlar }),
  studyo: (tuval: string, eylem: "ac" | "kapat" | "onizleme" | "gecis", ek: { sahne?: string; sure_ms?: number; takas?: boolean } = {}) =>
    istek<{ onizleme?: string | null; program?: string | null }>("/api/motor/studyo", { tuval, eylem, ...ek }),
  studyoTbar: (tuval: string, konum: number, birak: boolean) =>
    istek<{ etkin: boolean; program: string | null }>("/api/motor/studyo", { tuval, eylem: "tbar", konum, birak }),
  kaynakIslem: (id: string, eylem: "adlandir" | "cogalt" | "deinterlace", ek: { ad?: string; oge?: string; kip?: number; alan?: number } = {}) =>
    istek<{ id?: string; oge?: string }>("/api/motor/kaynak-islem", { id, eylem, ...ek }),
  ses: () => istek<MotorSesDurumu>("/api/motor/ses"),
  sesAyarla: (id: string, eylem: "ses" | "sessiz" | "denge" | "mono" | "senkron" | "izleme" | "izler", deger: number | boolean) =>
    istek<{ ok: boolean }>("/api/motor/ses", { id, eylem, deger }),
  izlemeAygiti: (id: string, ad: string) => istek<{ ok: boolean }>("/api/motor/izleme-aygiti", { id, ad }),
  ciftSes: (uygulama: string, masaustu: string, karar: "ikisini-tut" | "masaustunu-kapat") =>
    istek<{ ok: boolean }>("/api/motor/cift-ses", { uygulama, masaustu, karar }),
  filtreTurleri: () => istek<{ turler: MotorFiltreTuru[] }>("/api/motor/filtre-turleri").then((r) => r.turler),
  filtreler: (kaynak: string) => istek<{ filtreler: MotorFiltre[]; eksikler: MotorFiltre[] }>(`/api/motor/filtreler?kaynak=${encodeURIComponent(kaynak)}`),
  filtre: (govde: {
    eylem: "ekle" | "sil" | "sira" | "etkin" | "adlandir" | "guncelle" | "yapistir";
    id?: string;
    kaynak?: string;
    kaynaktan?: string;
    tur?: string;
    ad?: string;
    ayarlar?: Record<string, unknown>;
    yon?: string;
    acik?: boolean;
  }) => istek<{ ok: boolean; id?: string; eklenen?: number; atlanan?: number }>("/api/motor/filtre", govde),
  ekranGoruntusu: (tuval = "ana", kaynak?: string) =>
    istek<{ ok: boolean; yol: string; genislik: number; yukseklik: number }>("/api/motor/ekran-goruntusu", { tuval, kaynak }),
  remux: () => istek<RemuxDurumu>("/api/motor/remux"),
  remuxEkle: (dosyalar: string[], bicim: "mp4" | "mov" | "mkv") => istek<{ ok: boolean; eklenen: number }>("/api/motor/remux", { dosyalar, bicim }),
  remuxIptal: () => istek<{ ok: boolean }>("/api/motor/remux/iptal", {}),
  remuxTemizle: () => istek<{ ok: boolean }>("/api/motor/remux/temizle", {}),
  klasorAc: (tur: "kayit" | "gunluk" | "ayarlar") => istek<{ ok: boolean; yol: string }>("/api/motor/klasor-ac", { tur }),
  gunluk: (satir = 400) => istek<{ satirlar: string[]; gizlenen: number }>(`/api/motor/gunluk?satir=${satir}`),
  filtreOzellikleri: (id: string) => istek<OzellikTanimi>(`/api/motor/filtre/ozellikler?id=${encodeURIComponent(id)}`),
  medya: (id: string, eylem: "oynat" | "duraklat" | "yeniden" | "durdur") => istek<{ ok: boolean }>("/api/motor/medya", { id, eylem }),
  koleksiyonlar: () => istek<{ etkin: string; liste: MotorKoleksiyonOzeti[] }>("/api/motor/koleksiyonlar"),
  koleksiyon: (govde: MotorKoleksiyonIslemi) =>
    istek<{
      id?: string;
      etkin?: string;
      yedek?: string;
      dosyalar?: { dosya: string; boyut: number }[];
      kaynak?: number;
      sahne?: number;
      grup?: number;
      filtre?: number;
      notlar?: string[];
    }>("/api/motor/koleksiyon", govde),
  koleksiyonDisaAktarUrl: (id: string) => `${API_BASE}/api/motor/koleksiyon/disa-aktar?id=${encodeURIComponent(id)}`,
  profiller: () => istek<{ etkin: string; liste: { id: string; ad: string; etkin: boolean }[] }>("/api/motor/profiller"),
  profil: () => istek<MotorProfilYaniti>("/api/motor/profil"),
  /** Kısmi güncelleme: yalnız değişen alanlar; null = varsayılana dön. `id` verilirse (etkin değilse) yalnız o profil dosyası */
  profilGuncelle: (degisim: Record<string, unknown>, id?: string) =>
    istek<{ profil: MotorProfil; bekleyen: boolean }>("/api/motor/profil", { eylem: "guncelle", degisim, id }),
  profilIslem: (govde: { eylem: "yeni" | "cogalt" | "adlandir" | "gec" | "sil" | "ice-aktar"; id?: string; ad?: string; veri?: unknown }) =>
    istek<{ id?: string; etkin?: string; motorYenidenBasladi?: boolean; yedek?: string }>("/api/motor/profil", govde),
  profilDisaAktarUrl: (id: string) => `${API_BASE}/api/motor/profil/disa-aktar?id=${encodeURIComponent(id)}`,
  kodlayiciOzellikleri: (tur: string) => istek<OzellikTanimi>(`/api/motor/kodlayici-ozellikleri?tur=${encodeURIComponent(tur)}`),
  hedef: (id: string, eylem: "baslat" | "durdur", tuval?: string, iz?: number) => istek<{ ok: boolean }>("/api/motor/hedef", { id, eylem, tuval, iz }),
  golive: (eylem: "baslat" | "durdur") =>
    istek<{ sonuc: Record<string, { ok: boolean; hata?: string }> }>("/api/motor/golive", { eylem, confirm: eylem === "durdur" }),
  kayit: (eylem: "baslat" | "durdur" | "duraklat" | "surdur" | "bol") => istek<{ ok: boolean; yol?: string; duraklatildi?: boolean }>("/api/motor/kayit", { eylem }),
  sanalKamera: (eylem: "baslat" | "durdur", tuval = "ana") => istek<{ ok: boolean; acik: boolean }>("/api/motor/sanal-kamera", { eylem, tuval }),
  tekrar: (eylem: "ac" | "kapat" | "kaydet", sure_sn?: number) => istek<{ ok: boolean; yol?: string }>("/api/motor/tekrar", { eylem, sure_sn }),
  /** Son önizleme karesi; kare henüz hazır değilse `null` (sunucu 204). */
  onizleme: async (tuval: string, genislik = 480): Promise<Blob | null> => {
    const r = await fetch(`${API_BASE}/api/motor/onizleme?tuval=${encodeURIComponent(tuval)}&genislik=${genislik}`, { cache: "no-store" });
    if (r.status === 204) return null;
    if (!r.ok) throw new MotorHatasi(await r.text(), r.status);
    return r.blob();
  },
};

export type KaynakTuruTanimi = {
  tur: MotorKaynakTuru;
  ad: string;
  deger: "renk" | "yazi" | "dosya" | "klasor" | "secim" | "yok";
  yakalar?: string;
  /** Ses taşır: iz maskesi anlamlı */
  ses?: boolean;
};

export const KAYNAK_TURLERI: KaynakTuruTanimi[] = [
  { tur: "renk", ad: "Renk", deger: "renk" },
  { tur: "yazi", ad: "Yazı", deger: "yazi" },
  { tur: "gorsel", ad: "Görsel dosyası", deger: "dosya" },
  { tur: "medya", ad: "Medya dosyası", deger: "dosya", ses: true },
  { tur: "slayt", ad: "Görsel slayt gösterisi", deger: "klasor" },
  { tur: "tarayici", ad: "Tarayıcı", deger: "yazi", ses: true },
  { tur: "ekran", ad: "Ekran yakalama", deger: "secim", yakalar: "seçilen ekranı" },
  { tur: "pencere", ad: "Pencere yakalama", deger: "secim", yakalar: "seçilen pencereyi" },
  { tur: "oyun", ad: "Oyun yakalama", deger: "yok", yakalar: "tam ekran oyunu" },
  { tur: "kamera", ad: "Kamera", deger: "secim", yakalar: "seçilen kamerayı" },
  { tur: "mikrofon", ad: "Mikrofon", deger: "secim", yakalar: "seçilen mikrofonu", ses: true },
  { tur: "masaustu", ad: "Masaüstü sesi", deger: "secim", yakalar: "seçilen hoparlör sesini", ses: true },
  { tur: "uygulama_sesi", ad: "Uygulama sesi", deger: "secim", yakalar: "seçilen uygulamanın sesini", ses: true },
];

/** Bu oturumda yüklenmiş eklentilerin kaynak türleri ("Kaynak ekle" menüsü için) */
export function eklentiKaynakTurleri(sonuclar: MotorEklentiSonucu[] | undefined): { id: string; ad: string; eklenti: string }[] {
  return (sonuclar ?? [])
    .filter((s) => s.sonuc === "yuklendi")
    .flatMap((s) => s.turler.filter((t) => t.tur === "kaynak").map((t) => ({ id: t.id, ad: t.ad || t.id, eklenti: s.ad || s.id })));
}

export const CIKIS_DURUM_ETIKETI: Record<MotorCikisDurumu, string> = {
  hazir: "Hazır",
  baglaniyor: "Bağlanıyor",
  canli: "Canlı",
  yeniden_baglaniyor: "Yeniden bağlanıyor",
  durduruluyor: "Durduruluyor",
  durduruldu: "Durdu",
  basarisiz: "Başarısız",
};

const ETKIN_DURUMLAR: MotorCikisDurumu[] = ["baglaniyor", "canli", "yeniden_baglaniyor", "durduruluyor"];

export function cikisEtkin(d: MotorCikisDurumu): boolean {
  return ETKIN_DURUMLAR.includes(d);
}

/** Hedef başlatılabilir mi (arayüz düğmesi); neden metni döner. */
export function hedefBaslatilabilir(h: MotorHedef, calisiyor: boolean): { olur: boolean; neden?: string } {
  if (!calisiyor) return { olur: false, neden: "Motor çalışmıyor" };
  if (!h.anahtarVar) return { olur: false, neden: "Yayın anahtarı yok (Hedefler panelinden ekleyin)" };
  if (h.yonlendiricideCanli) return { olur: false, neden: "Bu hedef çoklu yayın yönlendiricisinde canlı" };
  if (cikisEtkin(h.durum)) return { olur: false, neden: "Zaten yayında" };
  return { olur: true };
}

/** 6 izlik maskede tek izi aç/kapat (iz 1–6). En az bir iz açık kalır. */
export function izDegistir(maske: number, iz: number): number {
  const bit = 1 << (iz - 1);
  const yeni = maske ^ bit;
  return yeni === 0 ? maske : yeni & 0x3f;
}

/** OBS deinterlace kipleri (libobs `enum obs_deinterlace_mode` sırası) */
export const DEINTERLACE_KIPLERI: { kip: number; ad: string }[] = [
  { kip: 0, ad: "Kapalı" },
  { kip: 1, ad: "At (Discard)" },
  { kip: 2, ad: "Retro" },
  { kip: 3, ad: "Karıştır (Blend)" },
  { kip: 4, ad: "Karıştır 2x" },
  { kip: 5, ad: "Doğrusal" },
  { kip: 6, ad: "Doğrusal 2x" },
  { kip: 7, ad: "Yadif" },
  { kip: 8, ad: "Yadif 2x" },
];

export type RemuxIsi = {
  girdi: string;
  cikti: string;
  durum: "bekliyor" | "suruyor" | "tamam" | "hata" | "iptal";
  ilerleme: number;
  hata?: string;
  sonuc?: { video: number; ses: number; atlanan_akis: number; paket: number; erken_bitti: boolean };
};
export type RemuxDurumu = { isler: RemuxIsi[]; calisiyor: boolean; kayitKlasoru: string; kayitlar: { yol: string; boyut: number }[] };

export type MultiviewHucresi = { tur: "onizleme" | "program" | "sahne"; sahne?: string; ad?: string; kutu: [number, number, number, number] };
export type MultiviewDuzeni = { tuval: string; genislik: number; yukseklik: number; hucreler: MultiviewHucresi[] };
