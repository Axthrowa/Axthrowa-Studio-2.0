/**
 * Sol menünün yapısı: yayın akışına göre altı başlık. `botSayfa` verilen sayfalar botun (StreamAxT) o sekmesini
 * gömülü açar; botun aynı konudaki alt sayfaları kendi üst sekmelerinde kalır.
 */
import type { MsgKey } from "../i18n/messages";
import type { NavId } from "./panelLayout";

export type MenuSayfasi = { nav: NavId; botSayfa?: string; adAnahtari?: MsgKey };
export type MenuGrubuId = "hazirlik" | "canli" | "sahne" | "etkilesim" | "bot" | "ayarlar";
export type MenuGrubu = { id: MenuGrubuId; adAnahtari: MsgKey; sayfalar: MenuSayfasi[] };

export const ANA_MENU: MenuGrubu[] = [
  { id: "hazirlik", adAnahtari: "nav.grup.hazirlik", sayfalar: [{ nav: "profile" }] },
  { id: "canli", adAnahtari: "nav.grup.canli", sayfalar: [{ nav: "control" }, { nav: "chat" }] },
  {
    id: "sahne",
    adAnahtari: "nav.grup.sahne",
    sayfalar: [
      { nav: "starting" },
      { nav: "ending" },
      { nav: "brb" },
      { nav: "yayin" },
      { nav: "bot", botSayfa: "overlays", adAnahtari: "nav.overlaylar" },
      { nav: "music" },
      { nav: "sounds" },
    ],
  },
  { id: "etkilesim", adAnahtari: "nav.grup.etkilesim", sayfalar: [{ nav: "bot", botSayfa: "polls" }] },
  { id: "bot", adAnahtari: "nav.bot", sayfalar: [{ nav: "bot", botSayfa: "commands" }] },
  { id: "ayarlar", adAnahtari: "nav.grup.ayarlar", sayfalar: [{ nav: "settings" }, { nav: "hotkeys" }] },
];

/** Bot ekranının sekmeleri. `alt`: botta o sekmenin altındaki sayfalar. Eşleşmeyen sayfa "Tüm ayarlar"da açılır. */
export const BOT_SEKMELERI: { id: string; ad: string; alt: string[] }[] = [
  { id: "commands", ad: "Komutlar", alt: ["commands", "timers", "sesli", "extras"] },
  { id: "games", ad: "Oyunlar", alt: ["games", "trivia"] },
  { id: "economy", ad: "Puanlar", alt: ["economy", "rankings", "donations"] },
  { id: "automod", ad: "Moderasyon", alt: ["automod", "shield"] },
];

const ETKILESIM_SAYFALARI = ["polls", "giveaways", "interaction"];
const OVERLAY_SAYFALARI = ["overlays", "alerts", "pano", "tts"];

/** Açık sayfanın ait olduğu menü başlığı */
export function menuGrubuBul(nav: string, botSayfa?: string): MenuGrubuId {
  if (nav === "bot") {
    if (botSayfa && ETKILESIM_SAYFALARI.includes(botSayfa)) return "etkilesim";
    if (botSayfa && OVERLAY_SAYFALARI.includes(botSayfa)) return "sahne";
    return "bot";
  }
  return ANA_MENU.find((g) => g.sayfalar.some((s) => s.nav === nav))?.id ?? "hazirlik";
}

/** Bot ekranında seçili sekme; alt sayfası bilinmeyen (ör. platforms) `null`: Tüm ayarlar */
export function botSekmesiBul(botSayfa?: string): string | null {
  if (!botSayfa) return BOT_SEKMELERI[0].id;
  return BOT_SEKMELERI.find((s) => s.alt.includes(botSayfa))?.id ?? null;
}

/** Bu sayfa menüdeki bu satır mı? */
export function sayfaAcikMi(s: MenuSayfasi, nav: string, botSayfa?: string): boolean {
  if (s.nav !== nav) return false;
  if (nav !== "bot") return true;
  return menuGrubuBul(nav, s.botSayfa) === menuGrubuBul(nav, botSayfa);
}
