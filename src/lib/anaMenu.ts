/**
 * Sol menünün yapısı: yayın akışına göre yedi başlık (A2). `botSayfa` verilen sayfalar botun (AxBoT) o sekmesini
 * gömülü açar. Eski adresler korunur: Giriş/Mola/Çıkış (`starting`/`brb`/`ending`) tek "Ekranlar" satırına,
 * eskiden "Tüm ayarlar"da açılan bot sayfaları kendi başlığına ya da bot sekmesine düşer.
 */
import type { MsgKey } from "../i18n/messages";
import type { Kip } from "./canliYerlesim";
import type { NavId } from "./panelLayout";

/** Yayın sonrası raporunun bölümleri: menü satırı raporu açıp o bölüme kayar (`#rapor-<bölüm>`) */
export type RaporBolumu = "isaretler" | "sarkilar" | "karsilastirma";
export type MenuSayfasi = { nav: NavId; botSayfa?: string; adAnahtari?: MsgKey; kip?: Kip; bolum?: RaporBolumu };
export type MenuGrubuId = "hazirlik" | "canli" | "sahne" | "etkilesim" | "bot" | "sonrasi" | "ayarlar";
export type MenuGrubu = { id: MenuGrubuId; adAnahtari: MsgKey; sayfalar: MenuSayfasi[] };

/** "Ekranlar" sayfasının iç sekmeleri; satır bu üç adresin hepsinde seçili görünür */
export const EKRANLAR: { id: "starting" | "brb" | "ending"; adAnahtari: MsgKey }[] = [
  { id: "starting", adAnahtari: "nav.starting" },
  { id: "brb", adAnahtari: "nav.brb" },
  { id: "ending", adAnahtari: "nav.ending" },
];
const EKRAN_IDLERI: string[] = EKRANLAR.map((e) => e.id);
export const ekranMi = (nav: string) => EKRAN_IDLERI.includes(nav);

export const ANA_MENU: MenuGrubu[] = [
  {
    id: "hazirlik",
    adAnahtari: "nav.grup.hazirlik",
    // "Kurulum" yalnız ilk kurulum bitene kadar görünür (PanelPage görünür sekmelere ekler)
    sayfalar: [{ nav: "kurulum", adAnahtari: "nav.kurulum" }, { nav: "profile" }, { nav: "bot", botSayfa: "platforms", adAnahtari: "nav.baglantilar" }, { nav: "yayinBilgisi" }],
  },
  { id: "canli", adAnahtari: "nav.grup.canli", sayfalar: [{ nav: "control" }, { nav: "chat" }] },
  {
    id: "sahne",
    adAnahtari: "nav.grup.sahne",
    sayfalar: [
      { nav: "starting", adAnahtari: "nav.ekranlar" },
      { nav: "yayin" },
      { nav: "bot", botSayfa: "overlays", adAnahtari: "nav.overlaylar" },
      { nav: "music" },
      { nav: "sounds" },
    ],
  },
  {
    id: "etkilesim",
    adAnahtari: "nav.grup.etkilesim",
    sayfalar: [
      { nav: "bot", botSayfa: "polls", adAnahtari: "nav.anketler" },
      { nav: "bot", botSayfa: "giveaways", adAnahtari: "nav.cekilisler" },
      { nav: "bot", botSayfa: "interaction", adAnahtari: "nav.tahminKuyruk" },
      { nav: "bot", botSayfa: "songrequest", adAnahtari: "nav.sarkiIstekleri" },
      { nav: "bot", botSayfa: "oduller", adAnahtari: "nav.oduller" },
    ],
  },
  { id: "bot", adAnahtari: "nav.bot", sayfalar: [{ nav: "bot", botSayfa: "commands" }] },
  {
    id: "sonrasi",
    adAnahtari: "nav.grup.sonrasi",
    sayfalar: [
      { nav: "control", kip: "sonrasi", adAnahtari: "nav.rapor" },
      { nav: "control", kip: "sonrasi", bolum: "isaretler", adAnahtari: "nav.isaretler" },
      { nav: "control", kip: "sonrasi", bolum: "sarkilar", adAnahtari: "nav.sarkiListesi" },
      { nav: "control", kip: "sonrasi", bolum: "karsilastirma", adAnahtari: "nav.karsilastirma" },
    ],
  },
  { id: "ayarlar", adAnahtari: "nav.grup.ayarlar", sayfalar: [{ nav: "settings" }, { nav: "hotkeys" }, { nav: "cihazlar" }] },
];

/** Bot ekranının sekmeleri. `alt`: botta o sekmenin altındaki sayfalar. Başka başlığa ait olmayan her bot sayfası bir sekmededir. */
export const BOT_SEKMELERI: { id: string; ad: string; alt: string[] }[] = [
  { id: "commands", ad: "Komutlar", alt: ["commands", "timers", "sesli", "extras", "ai", "integrations"] },
  { id: "games", ad: "Oyunlar", alt: ["games", "trivia"] },
  { id: "economy", ad: "Puanlar", alt: ["economy", "rankings", "donations"] },
  { id: "automod", ad: "Moderasyon", alt: ["automod", "shield"] },
  { id: "otomasyon", ad: "Otomasyon", alt: ["otomasyon"] },
  { id: "settings", ad: "Genel", alt: ["settings", "botadvanced", "dashboard", "kurulum", "multichat"] },
];

/** Botun tam paneli (kendi yan menüsüyle, bütün sayfalar); sekme listesinde en sonda */
export const TUM_AYARLAR = "tum-ayarlar";

const HAZIRLIK_SAYFALARI = ["platforms"];
const ETKILESIM_SAYFALARI = ["polls", "giveaways", "interaction", "songrequest", "oduller"];
/** Sahne menüsündeki "Overlay ve Uyarılar" penceresinin iç sekmeleri */
export const OVERLAY_PENCERESI: { id: string; ad: string }[] = [
  { id: "overlays", ad: "Overlay" },
  { id: "alerts", ad: "Uyarılar" },
  { id: "pano", ad: "Ses panosu" },
  { id: "tts", ad: "Metin okuma" },
];
const OVERLAY_SAYFALARI = OVERLAY_PENCERESI.map((s) => s.id);

/** Açık sayfanın ait olduğu menü başlığı. `kip`: Canlı ekranının o anki kipi (yayın sonrası kendi başlığındadır). */
export function menuGrubuBul(nav: string, botSayfa?: string, kip?: Kip | null): MenuGrubuId {
  if (nav === "bot") {
    if (botSayfa && HAZIRLIK_SAYFALARI.includes(botSayfa)) return "hazirlik";
    if (botSayfa && ETKILESIM_SAYFALARI.includes(botSayfa)) return "etkilesim";
    if (botSayfa && OVERLAY_SAYFALARI.includes(botSayfa)) return "sahne";
    return "bot";
  }
  if (nav === "control") return kip === "sonrasi" ? "sonrasi" : "canli";
  if (ekranMi(nav)) return "sahne";
  return ANA_MENU.find((g) => g.sayfalar.some((s) => s.nav === nav))?.id ?? "hazirlik";
}

/** Bot ekranında seçili sekme; bilinmeyen sayfa ilk sekmede açılır */
export function botSekmesiBul(botSayfa?: string): string {
  if (!botSayfa) return BOT_SEKMELERI[0].id;
  if (botSayfa === TUM_AYARLAR) return TUM_AYARLAR;
  return BOT_SEKMELERI.find((s) => s.alt.includes(botSayfa))?.id ?? BOT_SEKMELERI[0].id;
}

/** Bu sayfa menüdeki bu satır mı? */
export function sayfaAcikMi(s: MenuSayfasi, nav: string, botSayfa?: string, kip?: Kip | null): boolean {
  if (ekranMi(s.nav)) return ekranMi(nav);
  if (s.nav !== nav) return false;
  // Bölüm satırları aynı sayfaya kayar; seçili görünen Rapor satırıdır
  if (nav === "control") return !s.bolum && (s.kip === "sonrasi") === (kip === "sonrasi");
  if (nav !== "bot") return true;
  // Etkileşim ve hazırlık satırlarının her biri ayrı sayfa
  if (s.botSayfa && (ETKILESIM_SAYFALARI.includes(s.botSayfa) || HAZIRLIK_SAYFALARI.includes(s.botSayfa))) return s.botSayfa === botSayfa;
  return menuGrubuBul(nav, s.botSayfa) === menuGrubuBul(nav, botSayfa);
}

/** Satır görünür mü (menüyü düzenle'de gizlenen sekmeler). Ekranlar satırı üç ekrandan biri görünürse görünür. */
export function satirGorunur(s: MenuSayfasi, gorunen: Set<string>): boolean {
  return ekranMi(s.nav) ? EKRAN_IDLERI.some((id) => gorunen.has(id)) : gorunen.has(s.nav);
}

/** Satıra basınca açılacak adres: Ekranlar satırı son açık (yoksa ilk görünen) ekrana gider */
export function satirHedefi(s: MenuSayfasi, gorunen: Set<string>, sonEkran?: string): MenuSayfasi {
  if (!ekranMi(s.nav)) return s;
  const hedef = sonEkran && ekranMi(sonEkran) && gorunen.has(sonEkran) ? sonEkran : EKRAN_IDLERI.find((id) => gorunen.has(id)) ?? "starting";
  return { nav: hedef as NavId };
}
