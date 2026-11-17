/**
 * UI-4: Dashboard'un açılışı yayın öncesi kontrol listesi. Her satır bir durum ve tek düğme.
 * Canlı sayılar (izleyici, sohbet, sağlık) burada yok: yalnız Canlı ekranında.
 * Bileşen: components/panel/HazirlikListesi.tsx.
 */

export type HazirlikDurumu = "tamam" | "eksik" | "bilinmiyor";
export type HazirlikHedefi = "obs" | "platformlar" | "bot" | "sahneler" | "katman";

export type HazirlikGirdisi = {
  obsBagli: boolean;
  /** null: bot kapalıyken platform bilgisi okunamaz */
  platformlar: { bagli: string[]; toplam: number } | null;
  bot: "calisiyor" | "kapali" | "yok";
  /** null: OBS bağlı değil, okunamadı */
  sahneler: { giris: boolean; mola: boolean } | null;
  /** null: OBS bağlı değil, okunamadı */
  katman: boolean | null;
};

export type HazirlikSatiri = {
  id: HazirlikHedefi;
  ad: string;
  durum: HazirlikDurumu;
  aciklama: string;
  /** Satırın tek düğmesi; tamamsa da düzenlemeye götürür */
  eylem: string;
};

export function hazirlikSatirlari(g: HazirlikGirdisi): HazirlikSatiri[] {
  const obsYok = "OBS bağlanınca okunur";
  const p = g.platformlar;
  return [
    {
      id: "obs",
      ad: "OBS",
      durum: g.obsBagli ? "tamam" : "eksik",
      aciklama: g.obsBagli ? "WebSocket bağlı" : "WebSocket bağlı değil",
      eylem: g.obsBagli ? "Ayarlar" : "Bağlan",
    },
    {
      id: "bot",
      ad: "Bot",
      durum: g.bot === "calisiyor" ? "tamam" : "eksik",
      aciklama: g.bot === "calisiyor" ? "Çalışıyor" : g.bot === "yok" ? "Kurulu değil" : "Kapalı",
      eylem: g.bot === "calisiyor" ? "Aç" : "Başlat",
    },
    {
      id: "platformlar",
      ad: "Platformlar",
      durum: p === null ? "bilinmiyor" : p.bagli.length ? "tamam" : "eksik",
      aciklama: p === null ? "Bot açılınca okunur" : p.bagli.length ? `Bağlı: ${p.bagli.join(", ")}` : "Hiçbir platform bağlı değil",
      eylem: p?.bagli.length ? "Düzenle" : "Bağla",
    },
    {
      id: "sahneler",
      ad: "Sahneler",
      durum: g.sahneler === null ? "bilinmiyor" : g.sahneler.giris && g.sahneler.mola ? "tamam" : "eksik",
      aciklama:
        g.sahneler === null
          ? obsYok
          : g.sahneler.giris && g.sahneler.mola
            ? "Giriş ve mola sahnesi seçili"
            : `Seçilmemiş: ${[!g.sahneler.giris && "giriş", !g.sahneler.mola && "mola"].filter(Boolean).join(", ")} sahnesi`,
      eylem: g.sahneler?.giris && g.sahneler.mola ? "Düzenle" : "Seç",
    },
    {
      id: "katman",
      ad: "Katmanlar",
      durum: g.katman === null ? "bilinmiyor" : g.katman ? "tamam" : "eksik",
      aciklama: g.katman === null ? obsYok : g.katman ? "Birleşik katman OBS'te" : "Birleşik katman OBS'e eklenmemiş",
      eylem: g.katman ? "Düzenle" : "OBS'e ekle",
    },
  ];
}

/** Liste hazır mı: eksik satır yok (bilinmeyen satır yayını engellemez) */
export const hazirMi = (satirlar: HazirlikSatiri[]) => !satirlar.some((s) => s.durum === "eksik");

/** Bot `/api/status` yanıtındaki bağlı platformların adları */
export function bagliPlatformlar(platforms: unknown): { bagli: string[]; toplam: number } {
  const ADLAR: Record<string, string> = { kick: "Kick", twitch: "Twitch", youtube: "YouTube", tiktok: "TikTok", trovo: "Trovo", discord: "Discord" };
  const p = platforms && typeof platforms === "object" ? (platforms as Record<string, { connected?: boolean } | null>) : {};
  const anahtarlar = Object.keys(p);
  return { bagli: anahtarlar.filter((k) => p[k]?.connected).map((k) => ADLAR[k] ?? k), toplam: anahtarlar.length };
}
