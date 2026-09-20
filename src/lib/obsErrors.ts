/**
 * OBS WebSocket hatalarını kullanıcının anlayacağı dile çevirir.
 *
 * obs-websocket kütüphanesi hatayı İngilizce ve protokol diliyle veriyor
 * ("Your payload's data is missing an 'authentication' string…"). Panelde bu
 * metni ham göstermek, yayıncıya ne yapması gerektiğini söylemiyordu —
 * oysa neredeyse her durumda tek bir somut adım var.
 */

export type ObsHata = {
  /** Kırmızı şeritte görünecek kısa açıklama */
  metin: string;
  /** Ne yapılacağı */
  ipucu: string;
};

const VARSAYILAN_IPUCU =
  "OBS'in açık olduğundan emin olup Bağlan'a bas. Araçlar → WebSocket Sunucu Ayarları'ndan sunucunun açık olduğunu kontrol et.";

/**
 * @param sebep kütüphaneden gelen ham hata metni
 * @param port bağlanılmaya çalışılan port — yanlış port tanısında kullanılır
 */
export function obsHatasiniCevir(sebep: string, port?: number): ObsHata {
  const h = String(sebep || "").toLowerCase();

  // Şifre alanı boş bırakılmış ama OBS kimlik doğrulama istiyor.
  if (h.includes("missing an 'authentication'") || h.includes("authentication is required")) {
    return {
      metin: "OBS şifre istiyor ama şifre alanı boş.",
      ipucu:
        "OBS'te Araçlar → WebSocket Sunucu Ayarları → Bağlantı Bilgilerini Göster'den şifreyi kopyalayıp ŞİFRE alanına yapıştır ve Kaydet'e bas.",
    };
  }

  // Şifre var ama yanlış.
  if (h.includes("authentication failed") || h.includes("4009")) {
    return {
      metin: "OBS şifresi yanlış.",
      ipucu:
        "OBS'te Araçlar → WebSocket Sunucu Ayarları → Bağlantı Bilgilerini Göster'deki şifreyle birebir aynı olmalı. Kopyalarken baştaki/sondaki boşluğa dikkat et.",
    };
  }

  if (h.includes("econnrefused") || h.includes("connection refused")) {
    return {
      metin: "OBS yanıt vermiyor — bağlantı reddedildi.",
      ipucu: `OBS kapalı olabilir ya da WebSocket sunucusu kapalı olabilir. OBS'i aç, Araçlar → WebSocket Sunucu Ayarları'ndan "WebSocket sunucusunu etkinleştir"i işaretle. Port ${port ?? 4455} olmalı.`,
    };
  }

  if (h.includes("etimedout") || h.includes("timed out") || h.includes("timeout")) {
    return {
      metin: "OBS'e ulaşılamadı — zaman aşımı.",
      ipucu:
        "IP adresi doğru mu kontrol et. OBS başka bir bilgisayardaysa güvenlik duvarının porta izin vermesi gerekiyor.",
    };
  }

  if (h.includes("enotfound") || h.includes("getaddrinfo")) {
    return {
      metin: "IP adresi çözümlenemedi.",
      ipucu: "IP alanına geçerli bir adres yaz — aynı bilgisayardaysa 127.0.0.1 kullan.",
    };
  }

  // Yanlış porta bağlanınca WebSocket el sıkışması bu şekilde düşüyor.
  if (h.includes("subprotocol") || h.includes("unexpected server response") || h.includes("invalid frame")) {
    return {
      metin: "Bağlanılan port OBS WebSocket değil.",
      ipucu: `Port ${port ?? 4455} OBS'in WebSocket portuyla aynı olmalı. OBS'te Araçlar → WebSocket Sunucu Ayarları'ndan portu kontrol et.`,
    };
  }

  // Tanımadığımız hata: ham metni saklamak yerine gösteriyoruz ama
  // kullanıcıya yine de bir adım veriyoruz.
  return { metin: `OBS bağlantısı kesildi: ${sebep}`, ipucu: VARSAYILAN_IPUCU };
}
