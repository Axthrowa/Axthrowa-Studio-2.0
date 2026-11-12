/**
 * Hata metinleri: tanıma (`isErrorLike`) ve insan diline çevirme (`formatAppError`).
 * `pushAppAlert` eskiden ekranın ortasında Tamam'a basılana kadar kalan bir pencere açıyordu;
 * artık hata bildirimi olarak köşeye düşer ve kapatılana kadar durur (lib/bildirimler.ts, A5).
 */

import { bildir } from "./bildirimler";

export function isErrorLike(text: string): boolean {
  const s = String(text || "").trim();
  if (!s) return false;
  const low = s.toLocaleLowerCase("tr");
  if (
    /✓/.test(s) &&
    !/fail|hata|error|başarısız|bağlanamad/.test(low)
  ) {
    return false;
  }
  if (
    /(kaydedildi|gönderildi|kopyalandı|silindi|güncellendi|açıldı|kapatıldı|indirildi|aktif|bağlandı)(?!.*(?:amad|hata|fail|error))/i.test(
      s
    ) &&
    !/fail|hata|error|başarısız|bağlanamad|gönderilemedi|yüklenemedi/.test(low)
  ) {
    return false;
  }
  return /failed to fetch|load failed|networkerror|fetch hatası|http\s*\d|401|403|404|500|hata|error|fail|başarısız|basarisiz|bağlanamad|baglanamad|gönderilemedi|yüklenemedi|kaydedilemedi|silinemedi|zorunlu|gerekli|geçersiz|gecersiz|invalid|denied|timeout|abort|ulaşılamad|erişilemiyor/i.test(
    s
  );
}

export function formatAppError(raw: unknown): string {
  const s =
    raw instanceof Error
      ? raw.message
      : typeof raw === "string"
        ? raw
        : raw && typeof raw === "object" && "message" in raw
          ? String((raw as { message: unknown }).message)
          : String(raw || "Bilinmeyen hata");
  const t = s.trim() || "Bilinmeyen hata";
  const low = t.toLowerCase();
  if (
    low === "failed to fetch" ||
    low.includes("failed to fetch") ||
    low === "load failed" ||
    low.includes("networkerror") ||
    low.includes("fetch hatası")
  ) {
    return (
      "Yerel uygulamaya ulaşılamadı.\n\n" +
      "Tek kopya çalıştırın: cikti\\portable\\Baslat.bat"
    );
  }
  if (low.includes("rate limit") || /\b429\b/.test(t) || low.includes("hız limiti")) {
    return (
      "Kick sohbet hız limiti. Bot mesajları sıraya alır; birkaç saniye bekleyin.\n\n" +
      "Yayın sohbetinde bot hesabınıza /mod verin."
    );
  }
  return t;
}

export function pushAppAlert(input: { title?: string; message: string; hint?: string }): void {
  bildir(input.message, "hata", { baslik: input.title, ipucu: input.hint });
}
