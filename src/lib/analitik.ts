/**
 * Anonim kullanım analitiği (PostHog). Üç koşulla çalışır: masaüstü uygulaması (Tauri), derlemede
 * `VITE_POSTHOG_KEY` verilmiş, kullanıcı Ayarlar › Gizlilik'ten izin vermiş (varsayılan kapalı).
 *
 * Gönderilen: yalnız olay adı ve ürün verisi (ör. eylem kimliği `scene.switch`, sekme `music`). Gönderilmeyen:
 * sahne/kaynak adları, sohbet, kanal adı, adres ve başlık bilgileri; kişi profili oluşturulmaz, oturum kaydı,
 * otomatik tıklama ve sayfa görüntüleme kapalı. IP için PostHog projesinde "Discard client IP data" açılmalı.
 * Kütüphane izin verilene dek yüklenmez (açılış hızını etkilemez).
 *
 *   olay("obs_connected");  olay("eylem_calisti", { eylem: "scene.switch" });
 */
import { isTauri } from "@tauri-apps/api/core";
import type { PostHog } from "posthog-js";

const ANAHTAR = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
// AB sunucusu: veriler AB'de kalır (KVKK/GDPR)
const SUNUCU = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) || "https://eu.i.posthog.com";
const IZIN = "axthrowa.analitik";
/** URL, sayfa başlığı ve yönlendiren gibi otomatik özellikler: hiçbiri gerekmiyor */
const ATILAN = /^\$(current_url|host|pathname|referrer|referring_domain|initial_|title|raw_user_agent)/;

let ph: PostHog | null = null;
let yukleniyor: Promise<void> | null = null;

export const analitikKullanilabilir = () => isTauri() && !!ANAHTAR;

export function analitikIzniVar(): boolean {
  try {
    return localStorage.getItem(IZIN) === "1";
  } catch {
    return false;
  }
}

/** Açılışta (main.tsx) ve izin verilince. İzin yoksa hiçbir şey yüklemez. */
export function analitikBaslat(): Promise<void> {
  if (!analitikKullanilabilir() || !analitikIzniVar()) return Promise.resolve();
  if (ph) {
    ph.opt_in_capturing();
    return Promise.resolve();
  }
  yukleniyor ??= import("posthog-js")
    .then(({ default: posthog }) => {
      posthog.init(ANAHTAR!, {
        api_host: SUNUCU,
        person_profiles: "never",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        rageclick: false,
        capture_dead_clicks: false,
        capture_heatmaps: false,
        capture_performance: false,
        capture_exceptions: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_web_experiments: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        save_referrer: false,
        persistence: "localStorage",
        before_send: (olay) => {
          if (!olay) return null;
          for (const ad of Object.keys(olay.properties)) if (ATILAN.test(ad)) delete olay.properties[ad];
          return olay;
        },
      });
      ph = posthog;
    })
    .catch(() => {
      yukleniyor = null;
    });
  return yukleniyor;
}

export function analitikIzniVer(acik: boolean): void {
  try {
    localStorage.setItem(IZIN, acik ? "1" : "0");
  } catch {
    /* gizli pencere: yalnız bu oturum */
  }
  if (acik) void analitikBaslat();
  else ph?.opt_out_capturing();
}

/** Olay gönderir; analitik kapalıysa hiçbir şey yapmaz */
export function olay(ad: string, ozellik?: Record<string, string | number | boolean>): void {
  if (ph && analitikIzniVar()) ph.capture(ad, ozellik);
}
