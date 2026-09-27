/**
 * Sohbet ve etkinlik deposu (saf): sınırlı halka tampon, tekilleştirme, oturumda ilk kez yazanlar, görünüm
 * kipleri ve arama. React bileşeni yalnız bu fonksiyonları çağırır.
 */
import type { ActivityEvent, ChatPlatform, NormalizedChatMessage } from "./model";

export const CHAT_CAP = 1500;
export const ACTIVITY_CAP = 300;

export type ChatState = {
  messages: NormalizedChatMessage[];
  keys: Set<string>;
  seenUsers: Set<string>;
};

export function emptyChat(): ChatState {
  return { messages: [], keys: new Set(), seenUsers: new Set() };
}

/** İletiyi ekler. Aynı `platform:messageId` ikinci kez gelirse (yeniden bağlanma, çift yayın) yok sayılır. */
export function addChat(state: ChatState, m: NormalizedChatMessage, cap = CHAT_CAP): ChatState {
  if (state.keys.has(m.key)) return state;
  const first = !m.isBot && !m.isSystem && !state.seenUsers.has(m.userKey);
  const next = { ...m, firstInSession: first };
  const messages = state.messages.length >= cap ? [...state.messages.slice(state.messages.length - cap + 1), next] : [...state.messages, next];
  const keys = new Set(state.keys);
  keys.add(m.key);
  // Anahtar kümesi sınırsız büyümesin: tampondan düşenler de bir süre hatırlanır, sonra budanır
  if (keys.size > cap * 4) {
    keys.clear();
    for (const x of messages) keys.add(x.key);
  }
  const seenUsers = first ? new Set(state.seenUsers).add(m.userKey) : state.seenUsers;
  return { messages, keys, seenUsers };
}

export const CHAT_VIEWS = ["all", "mentions", "questions", "first", "members", "paid", "moderation"] as const;
export type ChatView = (typeof CHAT_VIEWS)[number];

export const CHAT_VIEW_LABEL: Record<ChatView, string> = {
  all: "Tümü",
  mentions: "Bahsetmeler",
  questions: "Sorular",
  first: "İlk kez yazanlar",
  members: "Abone / üye",
  paid: "Ücretli",
  moderation: "Moderasyon",
};

export type ChatFilter = {
  view: ChatView;
  /** boşsa tüm platformlar */
  platforms: ReadonlySet<ChatPlatform>;
  query: string;
  showBots: boolean;
};

export function matchesView(m: NormalizedChatMessage, view: ChatView): boolean {
  switch (view) {
    case "all":
      return true;
    case "mentions":
      return m.mentionsChannel;
    case "questions":
      return m.isQuestion && !m.isBot && !m.isSystem;
    case "first":
      return m.firstInSession === true;
    case "members":
      return m.roles.includes("subscriber") || m.roles.includes("vip");
    case "paid":
      return m.isPaid;
    case "moderation":
      return m.moderation !== "visible" || m.isSystem;
  }
}

export function filterChat(list: NormalizedChatMessage[], f: ChatFilter): NormalizedChatMessage[] {
  const q = f.query.trim().toLocaleLowerCase("tr");
  return list.filter(
    (m) =>
      (f.platforms.size === 0 || f.platforms.has(m.platform)) &&
      (f.showBots || !m.isBot || f.view === "moderation") &&
      matchesView(m, f.view) &&
      (!q ||
        m.message.toLocaleLowerCase("tr").includes(q) ||
        m.displayName.toLocaleLowerCase("tr").includes(q) ||
        m.username.toLocaleLowerCase("tr").includes(q))
  );
}

export function platformCounts(list: NormalizedChatMessage[]): Partial<Record<ChatPlatform, number>> {
  const c: Partial<Record<ChatPlatform, number>> = {};
  for (const m of list) c[m.platform] = (c[m.platform] || 0) + 1;
  return c;
}

/** Etkinlik ekleme: olay kimliğine göre idempotent, en yeni başta, sınırlı. */
export function addActivity(list: ActivityEvent[], e: ActivityEvent, cap = ACTIVITY_CAP): ActivityEvent[] {
  if (list.some((x) => x.eventId === e.eventId)) return list;
  return [e, ...list].slice(0, cap);
}
