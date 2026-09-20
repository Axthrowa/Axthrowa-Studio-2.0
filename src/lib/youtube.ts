/** YouTube yardımcıları — hem arka plan oynatıcısı hem panel önizlemesi kullanır. */

import { API_BASE } from "./api";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** URL, kısa bağlantı ya da doğrudan kimlikten 11 haneli video kimliği çıkarır. */
export function extractYoutubeId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (host.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      // /embed/<id> ve /shorts/<id>
      const m = url.pathname.match(/\/(embed|shorts|v)\/([\w-]{11})/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}

let apiPromise: Promise<void> | null = null;

/** iframe API'yi bir kez yükler; sonraki çağrılar aynı sözü paylaşır. */
export function loadYtApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    }
    if (window.YT?.Player) resolve();
  });
  return apiPromise;
}

/** sn → 1:23 / 1:02:03 */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`
    : `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Bitiş kartları için **son çare** güvenlik payı (sn).
 *
 * Yalnızca videonun bitiş ekranı bilgisi alınamadığında kullanılır. YouTube'da
 * bir bitiş ekranı öğesi en erken bitişten 20 sn önce başlayabildiği için kör
 * pay bu kadar geniş olmak zorunda. Bilgi alınabildiğinde
 * {@link fetchEndScreenInfo} devreye girer ve video hiç kısalmaz.
 */
export const DEFAULT_END_MARGIN = 20;

/** Bir videonun bitiş ekranı perdesi hakkında bilinenler. */
export type EndScreenInfo = {
  /** Perdenin açıldığı ilk an (sn). Videoda bitiş ekranı yoksa `null`. */
  startSec: number | null;
  /** Sorgu yapılamadı — kör paya dönmek gerekiyor. */
  unknown: boolean;
};

/** Henüz sorulmamış ya da sorulamamış video. */
export const UNKNOWN_END_SCREEN: EndScreenInfo = { startSec: null, unknown: true };

const endScreenCache = new Map<string, EndScreenInfo>();
const endScreenPending = new Map<string, Promise<EndScreenInfo>>();

/**
 * Videonun bitiş ekranı gerçekten var mı, varsa ne zaman açılıyor.
 *
 * Bitiş kartları oynatıcının içinde çizildiği için ne parametreyle kapatılıyor
 * ne de çapraz köken kısıtı yüzünden CSS ile gizlenebiliyor; tek yol o bölgeye
 * girmemek. Sunucu izleme sayfasındaki oynatıcı verisinden perdenin başlangıcını
 * okuyor, böylece koruma "her videodan 20 sn kes" olmaktan çıkıp yalnızca kartı
 * olan videolarda ve tam gerektiği saniyede devreye giriyor.
 *
 * Aynı kimlik için sonuç bellekte tutulur, eş zamanlı çağrılar tek isteği paylaşır.
 */
export function fetchEndScreenInfo(videoId: string): Promise<EndScreenInfo> {
  const id = (videoId || "").trim();
  if (!/^[\w-]{11}$/.test(id)) return Promise.resolve(UNKNOWN_END_SCREEN);

  const hit = endScreenCache.get(id);
  if (hit) return Promise.resolve(hit);
  const inflight = endScreenPending.get(id);
  if (inflight) return inflight;

  const req = fetch(`${API_BASE}/api/youtube/endscreen?video_id=${id}`, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("endscreen sorgusu başarısız");
      return res.json();
    })
    .then((data: { hasEndScreen?: boolean; startSec?: number | null }) => {
      const start = Number(data?.startSec);
      const info: EndScreenInfo = {
        startSec: data?.hasEndScreen && Number.isFinite(start) ? start : null,
        unknown: false,
      };
      endScreenCache.set(id, info);
      return info;
    })
    // Sunucuya ulaşılamadıysa "kart yok" demek riskli: bilinmiyor olarak
    // bırakıp kör paya düşüyoruz. Önbelleğe de yazmıyoruz ki sonra tekrar
    // denenebilsin.
    .catch(() => UNKNOWN_END_SCREEN)
    .finally(() => endScreenPending.delete(id));

  endScreenPending.set(id, req);
  return req;
}

/**
 * YouTube'un bitiş ekranı eklemeye izin verdiği en kısa video (sn).
 * Bundan kısa videolarda kart olamaz, pay ayırmaya gerek yok.
 */
const MIN_ENDSCREEN_DURATION = 25;

/** ENDED durumundaki tam ekran öneri ızgarasından kaçmak için son pay (sn). */
const ENDED_GUARD = 1.15;

/**
 * Bitiş kartları görünmeden önce döngüye girilecek saniye.
 *
 * `endScreen` verildiğinde video **hiç kısalmaz**: kartı olmayan videolar
 * sonuna kadar oynar, kartı olanlar da tam perdenin açıldığı saniyeye kadar.
 * Bilgi yoksa eski kör pay (varsayılan 20 sn) devreye girer.
 *
 * `startAt` bilinçli olarak hesaba katılmıyor: eskiden "döngü noktası
 * başlangıçtan sonra olmalı" koşulu vardı ve kırpma başlangıcı geç bir
 * saniyeye alındığında koruma sessizce kapanıp video sonuna kadar oynuyordu.
 * Başlangıcın döngü noktasından sonra kalması ayrı bir durum — çağıran taraf
 * o zaman başa (0) sarıyor.
 */
export function youtubeLoopPoint(
  duration: number,
  _startAt: number,
  endAt: number,
  endMargin: number,
  endScreen: EndScreenInfo = UNKNOWN_END_SCREEN
): number {
  const dur = Number(duration) || 0;
  if (dur <= 2) return 0;
  const end = Number(endAt) || 0;
  const raw = Number(endMargin);

  // Video bittiğinde YouTube tam ekran öneri ızgarası açıyor; bundan kaçmak
  // her durumda gereken en küçük pay.
  const endedOnly = dur - ENDED_GUARD;
  const withTrim = (v: number) => (end > 0 ? Math.min(end, v) : v);

  // Kısa videoya kart eklenemiyor; koruma kapalıysa da sonuna kadar oynar.
  if (dur < MIN_ENDSCREEN_DURATION || raw < 0) return withTrim(endedOnly);

  // Pay videodan uzun olamaz: en az 1 sn oynayacak yer kalsın.
  const safe = (v: number) => Math.max(1, Math.min(v, endedOnly));

  // Kesin bilgi var: kartı olmayan videoyu hiç kısaltmıyoruz, olanı da
  // yalnızca perdenin açıldığı saniyede döndürüyoruz.
  if (!endScreen.unknown) {
    return withTrim(endScreen.startSec === null ? endedOnly : safe(endScreen.startSec));
  }

  // Bilgi alınamadı (çevrimdışı, istek düştü): ayarlanmamış değer
  // (undefined/null → 0) varsayılana düşsün.
  return withTrim(safe(dur - (raw > 0 ? raw : DEFAULT_END_MARGIN)));
}
