/**
 * Canlı ekranının "Yayın" bölümüne eklenebilen paneller: uygulamanın kendi sayfaları ve botun sayfaları.
 * Kimlik yerleşimde saklanır: `ek:<ad>` uygulama sayfası, `ek:bot:<sekme>` botun gömülü sekmesi.
 */
export type EkPanel = { id: string; ad: string };
export type EkPanelGrubu = { ad: string; paneller: EkPanel[] };

const bot = (sekme: string, ad: string): EkPanel => ({ id: `ek:bot:${sekme}`, ad });

export const EK_PANEL_GRUPLARI: EkPanelGrubu[] = [
  {
    ad: "Sahne ve Overlay",
    paneller: [
      bot("overlays", "Tek URL ve widget'lar"),
      bot("alerts", "Uyarılar"),
      bot("pano", "Bot ses panosu"),
      bot("tts", "Metin okuma"),
      { id: "ek:giris", ad: "Giriş ekranı" },
      { id: "ek:cikis", ad: "Çıkış ekranı" },
      { id: "ek:mola", ad: "Mola ekranı" },
      { id: "ek:obs", ad: "OBS Stüdyo" },
      { id: "ek:muzik", ad: "Müzik (Resonance)" },
      { id: "ek:ses", ad: "Ses Paneli" },
    ],
  },
  {
    ad: "Etkileşim",
    paneller: [
      bot("multichat", "Çoklu sohbet"),
      bot("songrequest", "Şarkı istekleri"),
      bot("polls", "Anket"),
      bot("giveaways", "Çekiliş"),
      bot("interaction", "Etkileşim araçları"),
      bot("trivia", "Bilgi yarışması"),
      bot("games", "Oyunlar"),
    ],
  },
  {
    ad: "Bot",
    paneller: [
      bot("commands", "Komutlar"),
      bot("timers", "Zamanlayıcılar"),
      bot("otomasyon", "Otomasyon"),
      bot("sesli", "Sesli komutlar"),
      bot("economy", "Puanlar"),
      bot("rankings", "Sıralama"),
      bot("donations", "Bağışlar"),
      bot("automod", "Moderasyon"),
      bot("shield", "Kalkan"),
      bot("ai", "Yapay zekâ"),
      bot("platforms", "Platformlar"),
      bot("integrations", "Entegrasyonlar"),
      bot("settings", "Bot ayarları"),
      bot("botadvanced", "Gelişmiş bot ayarları"),
    ],
  },
  { ad: "Ayarlar", paneller: [{ id: "ek:kisayol", ad: "Kısayollar" }] },
];

export const ekPanelBul = (id: string): EkPanel | undefined => EK_PANEL_GRUPLARI.flatMap((g) => g.paneller).find((p) => p.id === id);

/** `ek:bot:overlays` → `overlays`; bot sekmesi değilse boş */
export const botSekmesi = (id: string): string | undefined => (id.startsWith("ek:bot:") ? id.slice(7) : undefined);
