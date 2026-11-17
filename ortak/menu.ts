/**
 * UI-2, UI-3: AxBoT menüsü ve sayfa adları tek yerde. Botun kendi yan menüsü (axbot/client/src/App.tsx) ve
 * Studio'nun bot sekmeleri (src/lib/anaMenu.ts) buradan üretilir; aynı sayfa iki arayüzde aynı adla görünür.
 * Kimlikler adres (`#overlays`) ve gömülü Studio için sabittir, değiştirmeyin.
 */

/** Bot sayfası kimliği → görünen ad */
export const SAYFA_ADLARI = {
  dashboard: "Genel Bakış",
  kurulum: "Hızlı Kurulum",
  multichat: "Çoklu Sohbet",
  overlays: "Overlay Stüdyo",
  alerts: "Uyarılar",
  pano: "Ses / Video Panosu",
  ozelwidget: "Özel Widget",
  tts: "TTS",
  songrequest: "Şarkı İstekleri",
  polls: "Anketler",
  giveaways: "Çekilişler",
  interaction: "Tahmin ve Kuyruk",
  oduller: "Kanal Ödülleri",
  trivia: "Bil Bakalım",
  games: "Chat Oyunları",
  economy: "Sadakat ve Market",
  rankings: "Sıralamalar",
  donations: "Bağış ve JumpScare",
  commands: "Komutlar",
  timers: "Zamanlayıcılar",
  sesli: "Sesli Komutlar",
  otomasyon: "Otomasyon",
  extras: "Klip ve Seviye",
  automod: "Bot Moderasyonu",
  shield: "Kalkan ve Denetim",
  ai: "Yapay Zekâ",
  platforms: "Platformlar",
  integrations: "Discord ve Entegrasyonlar",
  settings: "Genel Ayarlar",
  botadvanced: "Gelişmiş Bot",
} as const satisfies Record<string, string>;

export type BotSayfasi = keyof typeof SAYFA_ADLARI;

export type BotMenuOgesi = {
  id: string;
  ad: string;
  grup: "Yayın sırasında" | "Etkileşim" | "Kurulum ve Ayarlar";
  /** Bu menü satırının altındaki sayfalar (ilk sayfa satıra basınca açılır) */
  alt: BotSayfasi[];
};

/** Botun menüsü: konu başına bir satır, sayfalar alt sekme */
export const BOT_MENUSU: BotMenuOgesi[] = [
  { id: "genel", ad: "Genel Bakış", grup: "Yayın sırasında", alt: ["dashboard", "kurulum"] },
  { id: "sohbet", ad: "Sohbet", grup: "Yayın sırasında", alt: ["multichat"] },
  { id: "obs", ad: "Overlay ve Uyarılar", grup: "Yayın sırasında", alt: ["overlays", "alerts", "pano", "ozelwidget", "tts"] },
  { id: "muzik", ad: "Müzik", grup: "Yayın sırasında", alt: ["songrequest"] },
  { id: "etkinlik", ad: "Anket ve Çekiliş", grup: "Yayın sırasında", alt: ["polls", "giveaways", "interaction", "oduller"] },
  { id: "oyun", ad: "Oyunlar", grup: "Etkileşim", alt: ["trivia", "games"] },
  { id: "ekonomi", ad: "Puan ve Bağış", grup: "Etkileşim", alt: ["economy", "rankings", "donations"] },
  { id: "komut", ad: "Komutlar", grup: "Etkileşim", alt: ["commands", "timers", "otomasyon", "sesli", "extras"] },
  { id: "moderasyon", ad: "Moderasyon", grup: "Kurulum ve Ayarlar", alt: ["automod", "shield"] },
  { id: "yapayzeka", ad: "Yapay Zekâ", grup: "Kurulum ve Ayarlar", alt: ["ai"] },
  { id: "baglanti", ad: "Bağlantılar", grup: "Kurulum ve Ayarlar", alt: ["platforms", "integrations"] },
  { id: "ayarlar", ad: "Ayarlar", grup: "Kurulum ve Ayarlar", alt: ["settings", "botadvanced"] },
];

export const sayfaAdi = (sayfa: string): string => (SAYFA_ADLARI as Record<string, string>)[sayfa] ?? sayfa;

/** Sayfanın menü satırı */
export const menuOgesiBul = (sayfa: string): BotMenuOgesi | undefined => BOT_MENUSU.find((m) => (m.alt as string[]).includes(sayfa));
