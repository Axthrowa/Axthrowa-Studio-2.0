/**
 * Uygulama ortası hata kutusu — Tamam’a basılana kadar kalır.
 * Toast 2 sn’de kaybolur; Failed to fetch gibi hatalar kaçmasın.
 */

import { useSyncExternalStore } from "react";

export type AppAlert = {
  id: string;
  title: string;
  message: string;
  hint?: string;
};

let current: AppAlert | null = null;
const queue: AppAlert[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const f of listeners) f();
}

export function getAppAlert(): AppAlert | null {
  return current;
}

export function subscribeAppAlert(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useAppAlert(): AppAlert | null {
  return useSyncExternalStore(subscribeAppAlert, getAppAlert, getAppAlert);
}

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
      "Kick sohbet hız limiti. BotAxT mesajları sıraya alır; birkaç saniye bekleyin.\n\n" +
      "Yayın sohbetinde /mod BotAxT verin (Botrix’te botrixlive nasıl moderatörse)."
    );
  }
  return t;
}

export function pushAppAlert(input: {
  title?: string;
  message: string;
  hint?: string;
}): void {
  const message = formatAppError(input.message);
  if (!message.trim()) return;
  if (current && current.message === message && current.hint === input.hint) return;
  if (queue.some((q) => q.message === message && q.hint === input.hint)) return;
  const alert: AppAlert = {
    id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: input.title || "Hata",
    message,
    hint: input.hint,
  };
  if (!current) {
    current = alert;
    emit();
    return;
  }
  queue.push(alert);
}

export function dismissAppAlert(): void {
  current = queue.shift() || null;
  emit();
}

