/**
 * Kick ve YouTube rozet simgeleri.
 *
 * Twitch rozet görsellerini kendi CDN'inden alıyoruz, ama Kick anonim olarak
 * rozet görseli vermiyor ve YouTube'un sistem rozetleri yalnız bir simge adı
 * döndürüyor. Bu yüzden ilgili işaretleri, platformdaki görünümlerine yakın
 * SVG yolları olarak burada tutuyoruz.
 */

export type BadgeIcon = {
  /** 24×24 viewBox içinde SVG yolu */
  path: string;
  /** Rozet zemini / simge rengi */
  color: string;
  label: string;
  /** Zemin dolgulu mu, yoksa yalnız simge mi çizilsin */
  filled?: boolean;
};

const CROWN =
  "M12 4 8.5 9.2 4 6.5l1.6 9.3h12.8L20 6.5l-4.5 2.7zM5.6 18.2h12.8v2H5.6z";
const SWORD_WRENCH =
  "M20.7 5.6a4.5 4.5 0 0 1-5.9 5.9l-7.2 7.2a1.8 1.8 0 1 1-2.5-2.5l7.2-7.2a4.5 4.5 0 0 1 5.9-5.9l-2.8 2.8 2.5 2.5 2.8-2.8z";
const CHECK_SEAL =
  "M12 1.5 14.6 4l3.5-.4 1 3.4 3 1.9-1.6 3.1 1.6 3.1-3 1.9-1 3.4-3.5-.4L12 22.5 9.4 20l-3.5.4-1-3.4-3-1.9L4.5 12 2.9 8.9l3-1.9 1-3.4L10.4 4 12 1.5zm-1 13.6 5.3-5.3-1.4-1.4-3.9 3.9-1.9-1.9-1.4 1.4 3.3 3.3z";
const STAR =
  "M12 2.6 15 9l7 .9-5.1 4.8 1.3 6.9L12 18.2 5.8 21.6l1.3-6.9L2 9.9 9 9l3-6.4z";
const HEART =
  "M12 21s-7.8-4.9-9.4-9.4C1.3 8 3.4 4.5 7 4.5c2 0 3.6 1 5 2.7 1.4-1.7 3-2.7 5-2.7 3.6 0 5.7 3.5 4.4 7.1C19.8 16.1 12 21 12 21z";
const GIFT =
  "M20 8h-2.4a3 3 0 0 0-4.1-4.2L12 4.9l-1.5-1.1A3 3 0 0 0 6.4 8H4v4h1v9h14v-9h1V8zm-6.3-2.7a1.2 1.2 0 1 1 1.6 1.8L13 8V5.9l.7-.6zM8.7 5.3l.6.6V8L7.7 7.1a1.2 1.2 0 0 1 1-1.8zM13 19h-2v-9h2v9z";
const SHIELD =
  "M12 2 4 5.2v6c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8v-6L12 2zm-1 14.5-4-4 1.5-1.5 2.5 2.5 5-5L17.5 10l-6.5 6.5z";
const CLOCK =
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6 4 2.3-1 1.7-5-2.9V6h2v6.6z";
const WRENCH_YT =
  "M21.7 6.3a5.5 5.5 0 0 1-7.4 7.4l-6.6 6.6a2.1 2.1 0 0 1-3-3l6.6-6.6a5.5 5.5 0 0 1 7.4-7.4l-3.4 3.4 3 3 3.4-3.4z";

/** Kick rozet tipleri (küçük harfe indirgenmiş) */
export const KICK_ICONS: Record<string, BadgeIcon> = {
  broadcaster: { path: CROWN, color: "#e91916", label: "Yayıncı", filled: true },
  moderator: { path: SWORD_WRENCH, color: "#00c7ff", label: "Moderatör", filled: true },
  verified: { path: CHECK_SEAL, color: "#1475e1", label: "Doğrulanmış", filled: true },
  vip: { path: STAR, color: "#e9b800", label: "VIP", filled: true },
  og: { path: SHIELD, color: "#00ffb2", label: "OG", filled: true },
  founder: { path: HEART, color: "#ff9d00", label: "Kurucu", filled: true },
  subscriber: { path: STAR, color: "#3EEDFE", label: "Abone", filled: true },
  sub_gifter: { path: GIFT, color: "#3EEDFE", label: "Abonelik hediye eden", filled: true },
  staff: { path: SHIELD, color: "#5b3eb4", label: "Kick ekibi", filled: true },
  trainee: { path: CLOCK, color: "#8a8f9c", label: "Stajyer", filled: true },
};

/** YouTube sistem rozetleri (`icon.iconType` küçük harfle) */
export const YOUTUBE_ICONS: Record<string, BadgeIcon> = {
  owner: { path: CROWN, color: "#ffd600", label: "Kanal sahibi", filled: true },
  moderator: { path: WRENCH_YT, color: "#5e84f1", label: "Moderatör", filled: true },
  verified: { path: CHECK_SEAL, color: "#909090", label: "Doğrulanmış", filled: true },
};

/** Twitch rozet kümesi inmediyse kullanılacak yedek simgeler */
export const TWITCH_FALLBACK_ICONS: Record<string, BadgeIcon> = {
  broadcaster: { path: CROWN, color: "#e91916", label: "Yayıncı", filled: true },
  moderator: { path: SWORD_WRENCH, color: "#00ad03", label: "Moderatör", filled: true },
  vip: { path: HEART, color: "#e005b9", label: "VIP", filled: true },
  subscriber: { path: STAR, color: "#9146ff", label: "Abone", filled: true },
  founder: { path: HEART, color: "#ff7d00", label: "Kurucu", filled: true },
  partner: { path: CHECK_SEAL, color: "#9146ff", label: "Ortak", filled: true },
  staff: { path: SHIELD, color: "#5b3eb4", label: "Twitch ekibi", filled: true },
  turbo: { path: STAR, color: "#59399a", label: "Turbo", filled: true },
  premium: { path: CROWN, color: "#00a0d1", label: "Prime", filled: true },
};
