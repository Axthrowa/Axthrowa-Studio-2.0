/**
 * Kick + Twitch + YouTube sohbetlerini **tek akışta** toplayan merkez.
 *
 * Tasarım notları
 *  - Her platform kendi bağlantısını yönetir; biri düşerse diğerleri etkilenmez.
 *  - Kanal adları boşsa Giriş ekranındaki sosyal hesaplardan otomatik alınır.
 *  - Tüm yeniden denemeler üstel geri çekilmeli (backoff) — eski sabit 2 sn'lik
 *    döngü ağı ve YouTube'u gereksiz yere zorluyordu.
 */
import { API_BASE, OverlaySettings } from "./api";
import { connectTwitchChat, normalizeTwitchChannel } from "./twitchChat";
import { ChatPart, kickParts, normalizeParts, partsToText, textPart } from "./chatParts";
import { ChatBadge, kickBadges, setKickSubBadges, youtubeBadges } from "./chatBadges";
import { handleSmartBotMessage } from "./smartBot";
import { streamaxtBase } from "./streamaxt";
import { setYoutubeLiveContext } from "./platformAuth/youtubeWrite";

export type Platform = "kick" | "twitch" | "youtube";

export type ChatKind =
  | "chat"
  | "superchat"
  | "membership"
  | "sticker"
  | "sub"
  | "raid"
  | "follow"
  | "bits";

export type ChatMessage = {
  /** platform + kaynak id — yinelenenleri elemek için */
  key: string;
  id: string;
  platform: Platform;
  user: string;
  /** Düz metin karşılığı (emote adları dahil) */
  text: string;
  /** Ekranda çizilen yazı + emote parçaları */
  parts: ChatPart[];
  color: string;
  kind: ChatKind;
  amount?: string | null;
  /** Moderatör / abone / VIP gibi kullanıcı rozetleri */
  badges: ChatBadge[];
  ts: number;
};

export type ConnState = "off" | "connecting" | "live" | "error";

export type PlatformStatus = {
  platform: Platform;
  state: ConnState;
  detail: string;
  channel: string;
};

export type ChatHubHandlers = {
  onMessage: (msg: ChatMessage) => void;
  onStatus: (status: PlatformStatus) => void;
};

export const PLATFORM_COLOR: Record<Platform, string> = {
  kick: "#53FC18",
  twitch: "#9146ff",
  youtube: "#ff0000",
};

export const PLATFORM_LABEL: Record<Platform, string> = {
  kick: "Kick",
  twitch: "Twitch",
  youtube: "YouTube",
};

const MAX_BACKOFF_MS = 30_000;

function backoffMs(attempt: number, base = 1500) {
  const raw = base * 2 ** Math.min(attempt, 5);
  // ±%20 sapma: birden çok istemci aynı anda yeniden bağlanmasın
  const jitter = raw * (0.8 + Math.random() * 0.4);
  return Math.min(MAX_BACKOFF_MS, Math.round(jitter));
}

export function kickSlugFrom(input: string): string {
  const raw = String(input || "").trim().replace(/^@/, "");
  if (!raw) return "";
  const afterHost = raw.includes("kick.com/") ? raw.split("kick.com/").pop() || "" : raw;
  return afterHost.split(/[/?&#]/)[0].trim().toLowerCase();
}

export function youtubeRefFrom(channel: string, videoId: string): string {
  const v = String(videoId || "").trim();
  if (v) return v;
  const c = String(channel || "").trim();
  return c ? c.replace(/^@/, "") : "";
}

export type ResolvedChannels = {
  kick: string;
  twitch: string;
  youtube: string;
  youtubeVideoId: string;
};

/**
 * Chat ekranının kanal alanları boşsa Giriş ekranındaki sosyal hesap
 * kullanıcı adlarını kullanır — kullanıcı aynı bilgiyi iki kez girmesin.
 */
export function resolveChannels(
  chat: OverlaySettings,
  starting?: OverlaySettings | null
): ResolvedChannels {
  const auto = chat.autoDetect !== false;
  const socials = (auto && starting?.socials) || {};
  const pick = (explicit: unknown, socialKey: string) => {
    const direct = String(explicit ?? "").trim();
    if (direct) return direct;
    if (!auto) return "";
    const s = (socials as any)[socialKey];
    return String(s?.handle ?? "").trim();
  };

  return {
    kick: kickSlugFrom(pick(chat.kickSlug, "kick")),
    twitch: normalizeTwitchChannel(pick(chat.twitchChannel, "twitch")),
    youtube: String(pick(chat.youtubeChannel, "youtube") || "").trim(),
    youtubeVideoId: String(chat.youtubeVideoId ?? "").trim(),
  };
}

type Stop = () => void;

/* ------------------------------------------------------------------ Kick */

/** Botun sohbet iletisi → ortak ileti (Kick ayrıştırıcısı yeniden kullanılır). */
export function botKickMesaji(d: any): ChatMessage | null {
  if (d?.platform !== "kick" || !d.user) return null;
  // Bot bunları yok sayıyor; yayında da görünmemeli
  if (d.karaListede || d.kalkanda) return null;
  return parseKickMessage({
    id: d.id,
    content: d.message,
    created_at: d.timestamp ? new Date(d.timestamp).toISOString() : undefined,
    sender: {
      username: d.user.displayName || d.user.username,
      identity: { color: d.user.color, badges: d.user.rawBadges || d.user.badges?.map((type: string) => ({ type })) },
    },
  });
}

/**
 * Kick sohbeti botun (StreamAxT) WebSocket'inden okunur: Kick'in eski Pusher anahtarı 2026 Ekim'de
 * kapandı (kod 4001), yeni bağlantı pazarlığını bot zaten yapıyor. Bot kapalıysa sebep durumda yazar.
 */
function startKick(
  slug: string,
  _presetChatroomId: string | number | null | undefined,
  h: ChatHubHandlers
): Stop {
  let stopped = false;
  let ws: WebSocket | null = null;
  let retry: number | undefined;
  let attempt = 0;

  const status = (state: ConnState, detail: string) =>
    h.onStatus({ platform: "kick", state, detail, channel: slug });

  const durumuDenetle = async (base: string) => {
    try {
      const d = await (await fetch(`${base}/api/status`, { cache: "no-store" })).json();
      const k = d?.platforms?.kick;
      if (!k?.connected) status("error", "Bot Kick'e bağlı değil — Bağlantılar'dan kanalı kaydet");
      else if (String(k.channel || "").toLowerCase() !== slug) status("error", `Bot başka kanalda: ${k.channel}`);
      else status("live", `#${slug}`);
    } catch {
      /* soket kapanınca ayrıca bildirilir */
    }
  };

  const boot = async () => {
    if (stopped) return;
    status("connecting", "bota bağlanıyor");
    // Abone rozeti görselleri kanal bilgisinde gelir; alınamazsa yalnız rozet görseli eksik kalır
    fetch(`${API_BASE}/api/kick/chatroom?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setKickSubBadges(data.subscriberBadges))
      .catch(() => {});
    const base = await streamaxtBase();
    if (stopped) return;
    // Sekme değişince ya da sayfa yeniden açılınca son iletiler geri gelir
    fetch(`${base}/api/chat/history`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (stopped) return;
        for (const m of d?.mesajlar || []) {
          const msg = String(m.channel || "").toLowerCase() === slug ? botKickMesaji(m) : null;
          if (msg) h.onMessage(msg);
        }
      })
      .catch(() => {});

    ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws?type=chatbox`);
    ws.onopen = () => {
      attempt = 0;
      void durumuDenetle(base);
    };
    ws.onmessage = (ev) => {
      let p: any;
      try {
        p = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (p?.type === "platform_statuses") void durumuDenetle(base);
      if (p?.type === "chat" && String(p.data?.channel || "").toLowerCase() === slug) {
        const msg = botKickMesaji(p.data);
        if (msg) h.onMessage(msg);
      }
      if (p?.type === "alert" && p.data?.platform === "kick" && !p.data?.isTest) {
        const msg =
          p.subType === "sub" || p.subType === "gift_sub"
            ? parseKickSubscription(p.data, p.subType === "gift_sub")
            : p.subType === "follow" && !p.data?.anonim
              ? parseKickFollow(p.data)
              : null;
        if (msg) h.onMessage(msg);
      }
    };
    ws.onclose = () => {
      ws = null;
      if (stopped) return;
      status("error", "Bot kapalı — yeniden deneniyor");
      retry = window.setTimeout(boot, backoffMs(attempt++, 3000));
    };
  };

  void boot();

  return () => {
    stopped = true;
    if (retry) window.clearTimeout(retry);
    ws?.close();
  };
}

/** Kick olay gövdesi bazen string, bazen nesne gelir — ikisini de karşıla. */
export function parseKickMessage(raw: unknown): ChatMessage | null {
  let payload: any = raw;
  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object") return null;

  const text = String(
    payload.content ?? payload.message?.content ?? (typeof payload.message === "string" ? payload.message : "") ?? ""
  ).trim();
  if (!text) return null;

  const sender = payload.sender ?? payload.user ?? {};
  const user = String(sender.username ?? payload.username ?? "user");
  const color = String(sender.identity?.color || "") || PLATFORM_COLOR.kick;
  const badges = kickBadges(sender.identity?.badges);
  const id = String(payload.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const tsRaw = Date.parse(String(payload.created_at ?? ""));
  const parts = kickParts(text);

  return {
    key: `kick:${id}`,
    id,
    platform: "kick",
    user,
    text: partsToText(parts),
    parts,
    color,
    kind: "chat",
    badges,
    ts: Number.isFinite(tsRaw) ? tsRaw : Date.now(),
  };
}

function kickPayload(raw: unknown): any | null {
  let payload: any = raw;
  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return payload && typeof payload === "object" ? payload : null;
}

/** Kick abonelik / hediye abonelik */
export function parseKickSubscription(raw: unknown, gifted: boolean): ChatMessage | null {
  const payload = kickPayload(raw);
  if (!payload) return null;
  const user = String(
    payload.username ||
      payload.user?.username ||
      payload.gifter_username ||
      payload.sender?.username ||
      ""
  ).trim();
  if (!user) return null;
  const months = payload.months || payload.subscription?.months;
  const text = gifted
    ? `Hediye abonelik${months ? ` (${months} ay)` : ""}`
    : `Abone oldu${months ? ` (${months} ay)` : ""}`;
  const id = String(payload.id || payload.chatroom_id || `${Date.now()}-${user}`);
  return {
    key: `kick:sub:${id}:${user}`,
    id,
    platform: "kick",
    user,
    text,
    parts: textPart(text),
    color: PLATFORM_COLOR.kick,
    kind: "sub",
    badges: [],
    ts: Date.now(),
  };
}

/** Kick takip — payload biçimleri değişken olabilir */
export function parseKickFollow(raw: unknown): ChatMessage | null {
  const payload = kickPayload(raw);
  if (!payload) return null;
  const candidates = [
    payload.username,
    payload.user?.username,
    payload.follower?.username,
    payload.followers?.[0]?.username,
    payload.recentFollowers?.[0]?.username,
    payload.recent_followers?.[0]?.username,
  ];
  const user = String(candidates.find((x) => x) || "").trim();
  if (!user) return null;
  const id = String(payload.id || `${Date.now()}-${user}`);
  return {
    key: `kick:follow:${id}:${user}`,
    id,
    platform: "kick",
    user,
    text: "Takip etti",
    parts: textPart("Takip etti"),
    color: PLATFORM_COLOR.kick,
    kind: "follow",
    badges: [],
    ts: Date.now(),
  };
}

/* --------------------------------------------------------------- Twitch */

function startTwitch(channel: string, h: ChatHubHandlers): Stop {
  h.onStatus({ platform: "twitch", state: "connecting", detail: "bağlanıyor", channel });
  return connectTwitchChat(channel, {
    onStatus: (state, detail) =>
      h.onStatus({ platform: "twitch", state, detail: detail || "", channel }),
    onMessage: (m) =>
      h.onMessage({
        key: `twitch:${m.id}`,
        id: m.id,
        platform: "twitch",
        user: m.user,
        text: m.text,
        parts: m.parts.length ? m.parts : textPart(m.text),
        color: m.color || PLATFORM_COLOR.twitch,
        kind:
          m.kind === "chat"
            ? "chat"
            : m.kind === "raid"
              ? "raid"
              : m.kind === "bits"
                ? "bits"
                : "sub",
        amount: m.amount || null,
        badges: m.badges,
        ts: m.ts,
      }),
  });
}

/* -------------------------------------------------------------- YouTube */

function startYoutube(ref: string, h: ChatHubHandlers): Stop {
  let stopped = false;
  let timer: number | undefined;
  let videoId = "";
  let continuation = "";
  let failures = 0;

  const status = (state: ConnState, detail: string) =>
    h.onStatus({ platform: "youtube", state, detail, channel: videoId || ref });

  const resolve = async (): Promise<boolean> => {
    status("connecting", "canlı yayın aranıyor");
    try {
      const res = await fetch(`${API_BASE}/api/youtube/live?q=${encodeURIComponent(ref)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json();
      if (!data?.videoId) throw new Error("videoId yok");
      videoId = String(data.videoId);
      continuation = "";
      // Bot yanıtları da bu yayına gitsin: yazma tarafı video kimliğini ilk
      // bulduğu yerde önbelleğe alıp bir daha değiştirmiyordu — yeni yayında
      // yanıtlar bitmiş yayının sohbetine gönderilmeye çalışılıyordu.
      setYoutubeLiveContext(videoId);
      return true;
    } catch (e) {
      status("error", trimErr((e as Error).message));
      return false;
    }
  };

  const poll = async () => {
    if (stopped) return;
    if (!videoId && !(await resolve())) {
      if (stopped) return;
      timer = window.setTimeout(poll, backoffMs(failures++, 5000));
      return;
    }

    let nextMs = 2500;
    try {
      const qs = new URLSearchParams({ video_id: videoId });
      if (continuation) qs.set("continuation", continuation);
      const res = await fetch(`${API_BASE}/api/youtube/chat?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json();

      if (data.continuation) continuation = String(data.continuation);
      nextMs = Number(data.pollMs) || 2500;
      failures = 0;
      status("live", videoId);

      for (const m of Array.isArray(data.messages) ? data.messages : []) {
        const id = String(m.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        const text = String(m.text || "").trim();
        if (!text) continue;
        h.onMessage({
          key: `youtube:${id}`,
          id,
          platform: "youtube",
          user: String(m.user || "user"),
          text,
          parts: normalizeParts(m.parts, text),
          color: String(m.color || PLATFORM_COLOR.youtube),
          kind: (m.kind as ChatKind) || "chat",
          amount: m.amount ?? null,
          badges: youtubeBadges(m.badges),
          ts: Number(m.ts) || Date.now(),
        });
      }
    } catch (e) {
      failures += 1;
      status("error", trimErr((e as Error).message));
      // Üst üste hata → yayın bitmiş olabilir, videoId'yi yeniden çöz
      if (failures >= 3) {
        videoId = "";
        continuation = "";
      }
      nextMs = backoffMs(failures, 3000);
    }

    if (!stopped) timer = window.setTimeout(poll, Math.max(1000, nextMs));
  };

  void poll();

  return () => {
    stopped = true;
    if (timer) window.clearTimeout(timer);
  };
}

function trimErr(msg: string) {
  const s = String(msg || "").trim();
  return s.length > 120 ? `${s.slice(0, 117)}…` : s || "hata";
}

/* ------------------------------------------------------------------ Hub */

export type ChatHubConfig = {
  kick: { enabled: boolean; slug: string; chatroomId?: string | number | null };
  twitch: { enabled: boolean; channel: string };
  youtube: { enabled: boolean; ref: string };
};

export function chatHubConfig(
  chat: OverlaySettings,
  starting?: OverlaySettings | null
): ChatHubConfig {
  const ch = resolveChannels(chat, starting);
  return {
    kick: {
      enabled: chat.enableKick !== false && !!ch.kick,
      slug: ch.kick,
      chatroomId: chat.chatroomId ?? null,
    },
    twitch: { enabled: chat.enableTwitch !== false && !!ch.twitch, channel: ch.twitch },
    youtube: {
      enabled: chat.enableYoutube !== false && !!youtubeRefFrom(ch.youtube, ch.youtubeVideoId),
      ref: youtubeRefFrom(ch.youtube, ch.youtubeVideoId),
    },
  };
}

/** Yapılandırmada gerçekten değişen bir şey var mı — gereksiz yeniden bağlanmayı önler. */
export function configKey(cfg: ChatHubConfig): string {
  return [
    cfg.kick.enabled ? `k:${cfg.kick.slug}:${cfg.kick.chatroomId ?? ""}` : "k:-",
    cfg.twitch.enabled ? `t:${cfg.twitch.channel}` : "t:-",
    cfg.youtube.enabled ? `y:${cfg.youtube.ref}` : "y:-",
  ].join("|");
}

function baglantilariKur(cfg: ChatHubConfig, h: ChatHubHandlers): Stop {
  const stops: Stop[] = [];

  if (cfg.kick.enabled) stops.push(startKick(cfg.kick.slug, cfg.kick.chatroomId, h));
  else h.onStatus({ platform: "kick", state: "off", detail: "kapalı", channel: cfg.kick.slug });

  if (cfg.twitch.enabled) stops.push(startTwitch(cfg.twitch.channel, h));
  else
    h.onStatus({ platform: "twitch", state: "off", detail: "kapalı", channel: cfg.twitch.channel });

  if (cfg.youtube.enabled) stops.push(startYoutube(cfg.youtube.ref, h));
  else h.onStatus({ platform: "youtube", state: "off", detail: "kapalı", channel: cfg.youtube.ref });

  return () => {
    for (const stop of stops) {
      try {
        stop();
      } catch {
        /* */
      }
    }
  };
}

type PaylasilanHub = {
  aboneler: Set<ChatHubHandlers>;
  /** Sonradan katılan abone mevcut durumu hemen görsün. */
  sonDurum: Map<Platform, PlatformStatus>;
  stop: Stop;
};

const paylasilanlar = new Map<string, PaylasilanHub>();

/**
 * Aynı yapılandırma için tek bir bağlantı kümesi kurar, dinleyicilere dağıtır.
 *
 * Panel açıkken hem çıkış jeneriği toplayıcısı hem de Canlı Chat önizlemesi
 * bu işlevi çağırıyordu; her biri kendi Kick Pusher soketini, Twitch IRC
 * bağlantısını ve YouTube yoklamasını kuruyordu. Yani her mesaj iki kez
 * indiriliyor, YouTube kotası iki katına çıkıyordu. Sayaçla paylaşınca
 * çağrı yerleri değişmeden tek bağlantıya iniyor.
 */
export function startChatHub(cfg: ChatHubConfig, h: ChatHubHandlers): Stop {
  const key = configKey(cfg);
  let hub = paylasilanlar.get(key);

  if (!hub) {
    const yeni: PaylasilanHub = {
      aboneler: new Set(),
      sonDurum: new Map(),
      stop: () => {},
    };
    paylasilanlar.set(key, yeni);
    yeni.stop = baglantilariKur(cfg, {
      onStatus: (s) => {
        yeni.sonDurum.set(s.platform, s);
        for (const abone of [...yeni.aboneler]) abone.onStatus(s);
      },
      onMessage: (m) => {
        // Kick sohbeti botun kendisinden geliyor ve komutlara bot yanıt veriyor: burada ikinci kez yanıtlanmaz
        const skipSmart = String(m.platform || "").toLowerCase() === "kick";
        const extras = skipSmart ? [] : handleSmartBotMessage(m);
        for (const abone of [...yeni.aboneler]) {
          abone.onMessage(m);
          for (const x of extras) abone.onMessage(x);
        }
      },
    });
    hub = yeni;
  }

  const mevcut = hub;
  mevcut.aboneler.add(h);
  for (const s of mevcut.sonDurum.values()) h.onStatus(s);

  let birakildi = false;
  return () => {
    if (birakildi) return;
    birakildi = true;
    mevcut.aboneler.delete(h);
    if (mevcut.aboneler.size === 0) {
      paylasilanlar.delete(key);
      try {
        mevcut.stop();
      } catch {
        /* */
      }
    }
  };
}
