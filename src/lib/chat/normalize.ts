/**
 * StreamAxT WebSocket yüklerini (`{type:"chat", data}`, `{type:"alert", subType, data, alert}`) normalleştirir.
 * Bozuk / eksik yük çökmez: `null` döner ya da güvenli varsayılan kullanılır. Ham yük saklanmaz (bellek).
 */
import { CHAT_PLATFORMS, type ActivityEvent, type ChatPlatform, type ChatRole, type NormalizedChatMessage } from "./model";

const BOT_ID = "streamaxt_bot";
const SYSTEM_ID = "streamaxt_system";
const MAX_MESSAGE = 2000;

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});
const str = (v: unknown, max = 200): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "").slice(0, max);
const num = (v: unknown): number | undefined => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function toPlatform(v: unknown): ChatPlatform {
  const p = str(v, 20).toLowerCase();
  return (CHAT_PLATFORMS as readonly string[]).includes(p) ? (p as ChatPlatform) : "unknown";
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `@kanal` ya da kelime sınırında kanal adı geçiyor mu (büyük/küçük harf duyarsız) */
export function mentions(message: string, name: string): boolean {
  const n = name.trim().replace(/^@/, "");
  if (n.length < 2) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}_])@?${escapeRe(n)}($|[^\\p{L}\\p{N}_])`, "iu").test(message);
}

export function isQuestion(message: string): boolean {
  const t = message.trim();
  return t.length >= 4 && /\?\s*$|\?\s/.test(t);
}

let yedekSayac = 0;

export function normalizeChat(data: unknown): NormalizedChatMessage | null {
  const d = obj(data);
  const user = obj(d.user);
  const message = str(d.message, MAX_MESSAGE);
  const username = str(user.username, 60).trim();
  if (!message && !username) return null;

  const platform = toPlatform(d.platform);
  const userId = str(user.id, 80).trim();
  const timestamp = num(d.timestamp) ?? Date.now();
  // Platform ileti kimliği vermediyse: aynı içerik aynı anda iki kez gelirse ikisi de görünsün diye sayaç eklenir
  const messageId = str(d.id, 120).trim() || `yerel-${timestamp}-${++yedekSayac}`;
  const roles: ChatRole[] = [];
  if (user.isBroadcaster === true) roles.push("broadcaster");
  if (user.isMod === true) roles.push("moderator");
  if (user.isVip === true) roles.push("vip");
  if (user.isSub === true) roles.push("subscriber");
  const channelId = str(d.channel, 80);
  const kalkan = str(d.kalkanda, 20);

  return {
    key: `${platform}:${messageId}`,
    messageId,
    platform,
    channelId,
    userKey: userId ? `${platform}:${userId}` : `${platform}:ad:${username.toLowerCase()}`,
    userKeySource: userId ? "id" : "name",
    userId,
    username,
    displayName: str(user.displayName, 80).trim() || username,
    avatar: str(user.avatarUrl, 500) || undefined,
    color: /^#[0-9a-f]{3,8}$/i.test(str(user.color, 20)) ? str(user.color, 20) : undefined,
    badges: Array.isArray(user.badges) ? user.badges.map((b) => str(b, 40)).filter(Boolean).slice(0, 12) : [],
    roles,
    timestamp,
    message,
    isBot: userId === BOT_ID,
    isSystem: userId === SYSTEM_ID,
    mentionsChannel: channelId ? mentions(message, channelId) : false,
    isQuestion: isQuestion(message),
    isPaid: num(d.amount) !== undefined,
    amount: num(d.amount),
    currency: str(d.currency, 10) || undefined,
    moderation: d.karaListede === true ? "blocked" : kalkan ? "shielded" : "visible",
    moderationReason: d.karaListede === true ? "kara liste" : kalkan || undefined,
  };
}

/** `{type:"alert"}` iletisinden etkinlik. StreamAxT uyarı kimliği varsa olay kimliği odur (idempotent). */
export function normalizeActivity(msg: unknown): ActivityEvent | null {
  const m = obj(msg);
  if (m.type !== "alert") return null;
  const d = obj(m.data);
  const a = obj(m.alert);
  const eventType = str(m.subType, 30) || str(a.eventType ?? a.event_type, 30);
  if (!eventType) return null;
  const user = str(d.displayName, 80) || str(d.username, 80) || str(obj(a.variables).user, 80) || "?";
  const timestamp = num(d.timestamp) ?? Date.now();
  const alertId = str(a.id, 120) || undefined;
  const platform = toPlatform(d.platform);
  return {
    eventId: alertId || `${platform}:${eventType}:${user.toLowerCase()}:${timestamp}`,
    platform,
    eventType,
    user,
    timestamp,
    amount: num(d.amount),
    currency: str(d.currency, 10) || undefined,
    quantity: num(d.count ?? d.quantity ?? d.giftCount),
    months: num(d.months),
    viewers: num(d.viewers),
    message: str(d.message, 300) || undefined,
    isTest: d.isTest === true || a.isTest === true,
    alertId,
  };
}
