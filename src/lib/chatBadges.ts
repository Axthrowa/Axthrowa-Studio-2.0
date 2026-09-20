/**
 * Sohbet rozetleri (moderatör, abone, VIP, üye, doğrulanmış…).
 *
 * Rozetler her zaman **simge** olarak çizilir:
 *  - Twitch: kendi CDN'indeki gerçek rozet görselleri. `badges.twitch.tv`
 *    CORS başlığı göndermediği için küme uygulamanın kendi sunucusundan
 *    (`/api/twitch/badges`) geçirilir.
 *  - Kick: abone rozetleri kanalın kendi görselleri (kanal uç noktasından),
 *    mod/VIP/OG gibi sabit rozetler için platform biçimli SVG simge.
 *  - YouTube: üyelik rozetleri kanalın kendi görseli, sistem rozetleri SVG simge.
 */
import { API_BASE } from "./api";
import { BadgeIcon, KICK_ICONS, TWITCH_FALLBACK_ICONS, YOUTUBE_ICONS } from "./badgeIcons";

export type ChatBadge = {
  label: string;
  /** Rozet görseli (varsa öncelikli) */
  url?: string;
  /** Görsel yoksa — ya da yüklenemezse — çizilecek SVG simge */
  icon?: BadgeIcon;
};

/* ---------------------------------------------------------------- Twitch */

type TwitchBadgeSets = Record<string, Record<string, { url: string; title: string }>>;

const twitchCache = new Map<string, TwitchBadgeSets>();
const twitchPending = new Map<string, Promise<TwitchBadgeSets>>();

function parseTwitchDisplay(json: unknown): TwitchBadgeSets {
  const out: TwitchBadgeSets = {};
  const sets = (json as { badge_sets?: Record<string, unknown> })?.badge_sets;
  if (!sets || typeof sets !== "object") return out;
  for (const [setId, set] of Object.entries(sets)) {
    const versions = (set as { versions?: Record<string, unknown> })?.versions;
    if (!versions) continue;
    const bucket: Record<string, { url: string; title: string }> = {};
    for (const [version, v] of Object.entries(versions)) {
      const vv = v as Record<string, unknown>;
      const url = String(vv.image_url_2x || vv.image_url_1x || "");
      if (!url) continue;
      bucket[version] = { url, title: String(vv.title || setId) };
    }
    out[setId] = bucket;
  }
  return out;
}

/** `global` veya kanal oda kimliği için rozet kümesini indirir (bir kez). */
export function loadTwitchBadges(scope: string): Promise<TwitchBadgeSets> {
  const cached = twitchCache.get(scope);
  if (cached) return Promise.resolve(cached);
  const inflight = twitchPending.get(scope);
  if (inflight) return inflight;

  const p = fetch(`${API_BASE}/api/twitch/badges?scope=${encodeURIComponent(scope)}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((j) => {
      const sets = parseTwitchDisplay(j);
      twitchCache.set(scope, sets);
      return sets;
    })
    .catch(() => {
      // Ağ yoksa boş küme önbelleğe alınır; yedek simgeye düşeriz.
      const empty: TwitchBadgeSets = {};
      twitchCache.set(scope, empty);
      return empty;
    })
    .finally(() => {
      twitchPending.delete(scope);
    });

  twitchPending.set(scope, p);
  return p;
}

const GENERIC_ICON: BadgeIcon = {
  path: "M12 2 4 5.2v6c0 5 3.4 9.6 8 10.8 4.6-1.2 8-5.8 8-10.8v-6L12 2z",
  color: "#8a8f9c",
  label: "Rozet",
  filled: true,
};

/**
 * IRC `badges` etiketini (`moderator/1,subscriber/12`) rozetlere çevirir.
 * Küme henüz inmediyse simge yedeğine düşer — mesaj beklemez.
 */
export function twitchBadges(badgesTag: string | undefined, roomId?: string): ChatBadge[] {
  if (!badgesTag) return [];
  const channel = roomId ? twitchCache.get(roomId) : undefined;
  const global = twitchCache.get("global");

  const out: ChatBadge[] = [];
  for (const entry of badgesTag.split(",")) {
    const slash = entry.indexOf("/");
    if (slash <= 0) continue;
    const set = entry.slice(0, slash);
    const version = entry.slice(slash + 1);
    const hit = channel?.[set]?.[version] || global?.[set]?.[version];
    const icon = TWITCH_FALLBACK_ICONS[set] || GENERIC_ICON;
    if (hit) {
      // Görsel 404 verirse simgeye düşebilmek için ikisini birlikte taşı
      out.push({ label: hit.title, url: hit.url, icon });
    } else {
      out.push({ label: TWITCH_FALLBACK_ICONS[set]?.label || set, icon });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ Kick */

export type KickSubBadge = { months: number; url: string };

/** Kanalın kendi abone rozetleri — Kick kanal uç noktasından gelir. */
let kickSubBadges: KickSubBadge[] = [];

export function setKickSubBadges(raw: unknown) {
  if (!Array.isArray(raw)) {
    kickSubBadges = [];
    return;
  }
  kickSubBadges = raw
    .map((b) => {
      const o = (b ?? {}) as Record<string, unknown>;
      return { months: Number(o.months), url: String(o.url ?? "") };
    })
    .filter((b) => Number.isFinite(b.months) && b.url)
    .sort((a, b) => a.months - b.months);
}

/** Aboneliğin süresine uyan en yüksek rozeti seç (Kick'in kendi kuralı). */
function kickSubBadgeFor(months: number): string | undefined {
  let hit: string | undefined;
  for (const b of kickSubBadges) {
    if (b.months <= months) hit = b.url;
    else break;
  }
  return hit ?? kickSubBadges[0]?.url;
}

/** Kick `sender.identity.badges` dizisini rozetlere çevirir. */
export function kickBadges(raw: unknown): ChatBadge[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatBadge[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const type = String(b.type ?? "").toLowerCase();
    const icon = KICK_ICONS[type];
    const count = Number(b.count);
    const base = String(b.text ?? icon?.label ?? type);
    if (!base) continue;
    const label = Number.isFinite(count) && count > 0 ? `${base} (${count})` : base;

    // Abone rozetinde kanalın kendi görseli varsa onu kullan
    if (type === "subscriber") {
      const url = kickSubBadgeFor(Number.isFinite(count) ? count : 0);
      if (url) {
        out.push({ label, url, icon: icon || GENERIC_ICON });
        continue;
      }
    }
    out.push({ label, icon: icon || GENERIC_ICON });
  }
  return out;
}

/* --------------------------------------------------------------- YouTube */

/** Sunucudan gelen YouTube rozetlerini doğrular. */
export function youtubeBadges(raw: unknown): ChatBadge[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatBadge[] = [];
  for (const item of raw) {
    // Eski biçim: düz etiket dizisi
    if (typeof item === "string") {
      if (item) out.push({ label: item, icon: GENERIC_ICON });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;
    const url = typeof b.url === "string" && b.url ? b.url : undefined;
    const iconType = typeof b.icon === "string" ? b.icon.toLowerCase() : "";
    const known = YOUTUBE_ICONS[iconType];
    const label = String(b.label || known?.label || iconType || "");
    if (!url && !label) continue;
    const icon = known || GENERIC_ICON;
    out.push(url ? { label, url, icon } : { label, icon });
  }
  return out;
}
