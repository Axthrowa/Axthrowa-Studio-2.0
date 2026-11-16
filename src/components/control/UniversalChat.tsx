/**
 * Kontrol Merkezi — Evrensel sohbet ve Etkinlik akışı panelleri.
 *
 * Kaynak: AxBoT'un WebSocket'i (Kick, Twitch, YouTube, Trovo, Discord, TikTok bağdaştırıcıları orada). İki panel
 * tek bir paylaşılan bağlantıyı kullanır; ileti ve olaylar `lib/chat` ile normalleştirilir, tekilleştirilir.
 * Moderasyon düğmeleri yalnız platform yeteneği VE bağlantısı varsa görünür, çift onay ister; eylem AxBoT'un
 * denetimli elle moderasyon ucuna gider (gerçek platform eylemi).
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDownUp, Check, Pause, Pin, Play, RotateCcw, Search, Send, Sparkles } from "lucide-react";
import { ArrowBendUpLeft, ArrowCounterClockwise, Copy, HandHeart, IdentificationCard, Megaphone, Prohibit, PushPin, Sparkle, Timer, Trash } from "@phosphor-icons/react";
import KullaniciKarti from "./KullaniciKarti";
import { nesneMenusu, type MenuOgesi } from "../axthrowa/SagTikMenusu";
import { axbotBase } from "../../lib/axbot";
import { twitchSabitle, twitchSabitleyebilir } from "../../lib/platformAuth/twitchWrite";
import { ACTIVITY_LABEL, CHAT_PLATFORMS, PLATFORM_LABEL, PLATFORM_SHORT, type ActivityEvent, type ChatPlatform, type NormalizedChatMessage } from "../../lib/chat/model";
import { normalizeActivity, normalizeChat } from "../../lib/chat/normalize";
import { addActivity, tesekkurUygula, addChat, CHAT_VIEW_LABEL, CHAT_VIEWS, emptyChat, filterChat, platformCounts, type ChatState, type ChatView } from "../../lib/chat/store";

import { okJson } from "../../lib/api";
// ─── Paylaşılan akış (tek WebSocket, çok abone) ─────────────────────────

type FeedSnapshot = { chat: ChatState; activity: ActivityEvent[]; connected: boolean; base: string | null };

const feed = {
  snap: { chat: emptyChat(), activity: [], connected: false, base: null } as FeedSnapshot,
  listeners: new Set<() => void>(),
  ws: null as WebSocket | null,
  retry: undefined as number | undefined,
  pending: [] as unknown[],
  flushTimer: undefined as number | undefined,
};

function publish(next: Partial<FeedSnapshot>) {
  feed.snap = { ...feed.snap, ...next };
  feed.listeners.forEach((l) => l());
}

/** Yoğun sohbette her iletide yeniden çizim yapılmasın: iletiler 100 ms'lik partilerle işlenir. */
function enqueue(msg: unknown) {
  feed.pending.push(msg);
  if (feed.flushTimer) return;
  feed.flushTimer = window.setTimeout(() => {
    feed.flushTimer = undefined;
    let chat = feed.snap.chat;
    let activity = feed.snap.activity;
    for (const m of feed.pending.splice(0)) {
      const o = m as { type?: string; data?: unknown };
      if (o.type === "chat") {
        const n = normalizeChat(o.data);
        if (n) chat = addChat(chat, n);
      } else if (o.type === "alert") {
        const e = normalizeActivity(m);
        if (e) activity = addActivity(activity, e);
      } else if (o.type === "activity_thanked") {
        const t = m as { id?: unknown; tesekkur?: unknown };
        if (typeof t.id === "string") activity = tesekkurUygula(activity, t.id, t.tesekkur === true);
      }
    }
    publish({ chat, activity });
  }, 100);
}

async function connect() {
  const base = await axbotBase();
  if (!feed.listeners.size) return;
  publish({ base });
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/ws?type=dashboard`);
  feed.ws = ws;
  ws.onopen = () => {
    publish({ connected: true });
    // Ekran sonradan açılınca ya da bağlantı kopup gelince son iletiler görünsün (tekrarlar elenir)
    fetch(`${base}/api/chat/history`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        for (const data of d?.mesajlar || []) enqueue({ type: "chat", data });
      })
      .catch(() => {});
    // Etkinlik akışı geçmişi (U4): panel sonradan açılsa da son olaylar ve teşekkür işaretleri görünür
    fetch(`${base}/api/activity/history`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        for (const o of d?.olaylar || []) {
          enqueue(o);
          if (o?.alert?.id) enqueue({ type: "activity_thanked", id: o.alert.id, tesekkur: o.tesekkur === true });
        }
      })
      .catch(() => {});
  };
  ws.onmessage = (ev) => {
    try {
      enqueue(JSON.parse(String(ev.data)));
    } catch {
      /* ikili ya da bozuk ileti */
    }
  };
  ws.onclose = () => {
    // Sekme değişince kapatılan eski soketin kapanışı geç gelir: yeni bağlantıyı düşürmesin
    if (feed.ws && feed.ws !== ws) return;
    feed.ws = null;
    publish({ connected: false });
    if (feed.listeners.size) feed.retry = window.setTimeout(() => void connect(), 4000);
  };
}

function subscribe(l: () => void) {
  feed.listeners.add(l);
  if (feed.listeners.size === 1 && !feed.ws) void connect();
  return () => {
    feed.listeners.delete(l);
    if (!feed.listeners.size) {
      if (feed.retry) window.clearTimeout(feed.retry);
      feed.ws?.close();
      feed.ws = null;
    }
  };
}

function useFeed(): FeedSnapshot {
  return useSyncExternalStore(subscribe, () => feed.snap);
}

/** Etkinlik satırındaki "Kullanıcı kartı": kart sohbet panelinde açılır */
const KART_OLAYI = "axt:kullanici-karti";
type KartIstegi = { platform: ChatPlatform; username: string };

/** Kişinin son sohbet iletisi; hiç yazmadıysa kart için yalnız kimliği taşıyan bir ileti */
export function kartIletisi(mesajlar: NormalizedChatMessage[], k: KartIstegi): NormalizedChatMessage {
  const ad = k.username.toLocaleLowerCase("tr-TR");
  for (let i = mesajlar.length - 1; i >= 0; i--) {
    const m = mesajlar[i];
    if (m.platform === k.platform && !m.isSystem && (m.username.toLocaleLowerCase("tr-TR") === ad || m.displayName.toLocaleLowerCase("tr-TR") === ad)) return m;
  }
  return {
    key: `kart:${k.platform}:${ad}`, messageId: `yerel-kart-${ad}`, platform: k.platform, channelId: "", userKey: `${k.platform}:${ad}`, userKeySource: "name",
    userId: "", username: k.username, displayName: k.username, badges: [], roles: [], timestamp: Date.now(), message: "",
    isBot: false, isSystem: false, mentionsChannel: false, isQuestion: false, isPaid: false, moderation: "visible",
  };
}

function sendChat(platform: string, message: string): boolean {
  if (!feed.ws || feed.ws.readyState !== WebSocket.OPEN) return false;
  feed.ws.send(JSON.stringify({ action: "send_chat", platform, message }));
  return true;
}

// ─── Platform yetenek ve bağlantı durumu ────────────────────────────────

type Yetenek = { sohbet?: { gonder?: boolean }; moderasyon?: { timeout?: boolean; ban?: boolean; mesajSil?: boolean; sohbetModlari?: boolean } };

function usePlatformState(base: string | null) {
  const [yetenek, setYetenek] = useState<Record<string, Yetenek>>({});
  const [bagli, setBagli] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!base) return;
    let iptal = false;
    const yukle = async () => {
      try {
        const [y, s] = await Promise.all([
          fetch(`${base}/api/platforms/capabilities`, { cache: "no-store" }).then(okJson),
          fetch(`${base}/api/status`, { cache: "no-store" }).then(okJson),
        ]);
        if (iptal) return;
        setYetenek(y?.yetenekler || {});
        const b: Record<string, boolean> = {};
        for (const [k, v] of Object.entries((s?.platforms || {}) as Record<string, { connected?: boolean }>)) b[k] = !!v?.connected;
        setBagli(b);
      } catch {
        /* AxBoT kapalı — düğmeler gizli kalır */
      }
    };
    void yukle();
    const t = window.setInterval(() => void yukle(), 15000);
    return () => {
      iptal = true;
      window.clearInterval(t);
    };
  }, [base]);
  return { yetenek, bagli };
}

const PLATFORM_TONE: Record<ChatPlatform, string> = {
  kick: "bg-lime-500/20 text-lime-200",
  twitch: "bg-violet-500/20 text-violet-200",
  youtube: "bg-red-500/20 text-red-200",
  trovo: "bg-emerald-500/20 text-emerald-200",
  discord: "bg-indigo-500/20 text-indigo-200",
  tiktok: "bg-cyan-500/20 text-cyan-200",
  unknown: "bg-white/10 text-white/70",
};

function PlatformBadge({ p }: { p: ChatPlatform }) {
  return (
    <span className={`shrink-0 rounded px-1 text-[10px] font-black ${PLATFORM_TONE[p]}`} title={PLATFORM_LABEL[p]}>
      {PLATFORM_SHORT[p]}
    </span>
  );
}

function saat(ts: number) {
  return new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

// ─── Evrensel sohbet ─────────────────────────────────────────────────────

/** DOM'da en fazla bu kadar satır: yoğun sohbette arayüz akıcı kalsın (eskiler aramayla bulunur) */
const RENDER_LIMIT = 250;

/** Sohbet yazı boyutu (px) — izleyiciye özel tercih, bu tarayıcıda saklanır. */
const YAZI_BOYUTLARI = [12, 14, 16] as const;
const YAZI_KEY = "studio.chat.fontSize";

const TERS_KEY = "axt.sohbet.tersSira";
function kayitliTers(): boolean {
  try {
    return localStorage.getItem(TERS_KEY) === "1";
  } catch {
    return false;
  }
}

function kayitliYaziBoyutu(): number {
  try {
    const v = Number(localStorage.getItem(YAZI_KEY));
    return (YAZI_BOYUTLARI as readonly number[]).includes(v) ? v : YAZI_BOYUTLARI[0];
  } catch {
    return YAZI_BOYUTLARI[0];
  }
}

export const UniversalChatPanel = memo(function UniversalChatPanel({ onToast }: { onToast: (m: string) => void }) {
  const { chat, connected, base } = useFeed();
  const { yetenek, bagli } = usePlatformState(base);
  const [view, setView] = useState<ChatView>("all");
  const [platforms, setPlatforms] = useState<Set<ChatPlatform>>(new Set());
  const [query, setQuery] = useState("");
  const [showBots, setShowBots] = useState(true);
  const [paused, setPaused] = useState(false);
  const [frozen, setFrozen] = useState<NormalizedChatMessage[] | null>(null);
  const [hedef, setHedef] = useState("all");
  const [yazi, setYazi] = useState("");
  const [armed, setArmed] = useState<string | null>(null);
  const [yaziBoyutu, setYaziBoyutu] = useState(kayitliYaziBoyutu);
  const [ters, setTers] = useState(kayitliTers);
  const [uzerinde, setUzerinde] = useState(false);
  const [kart, setKart] = useState<NormalizedChatMessage | null>(null);
  useEffect(() => {
    try {
      localStorage.setItem(TERS_KEY, ters ? "1" : "0");
    } catch {
      /* depolama kapalıysa yalnız bu oturumda */
    }
  }, [ters]);
  const yaziBoyutuDegistir = () =>
    setYaziBoyutu((onceki) => YAZI_BOYUTLARI[((YAZI_BOYUTLARI as readonly number[]).indexOf(onceki) + 1) % YAZI_BOYUTLARI.length]);
  useEffect(() => {
    try {
      localStorage.setItem(YAZI_KEY, String(yaziBoyutu));
    } catch {
      /* depolama kapalıysa yalnız bu oturumda */
    }
  }, [yaziBoyutu]);
  const listRef = useRef<HTMLDivElement>(null);

  // Fare listedeyken akış durur (okurken kaymasın); elle dondurma ayrıca kalıcıdır
  const durdu = paused || uzerinde;
  const kaynak = durdu && frozen ? frozen : chat.messages;
  const filtered = useMemo(() => filterChat(kaynak, { view, platforms, query, showBots }), [kaynak, view, platforms, query, showBots]);
  const sonlar = filtered.slice(-RENDER_LIMIT);
  const shown = ters ? [...sonlar].reverse() : sonlar;
  const sayac = useMemo(() => platformCounts(chat.messages), [chat.messages]);
  const yeni = durdu && frozen ? chat.messages.length - frozen.length : 0;

  useEffect(() => {
    if (!durdu) listRef.current?.scrollTo({ top: ters ? 0 : listRef.current.scrollHeight });
  }, [shown.length, durdu, ters]);

  const fareGirdi = () => {
    setUzerinde(true);
    setFrozen((f) => f ?? chat.messages);
  };
  const fareCikti = () => {
    setUzerinde(false);
    if (!paused) setFrozen(null);
  };
  const surdur = () => {
    setPaused(false);
    setUzerinde(false);
    setFrozen(null);
  };

  const togglePause = () => {
    if (paused) surdur();
    else {
      setPaused(true);
      setFrozen((f) => f ?? chat.messages);
    }
  };

  const cezaVer = useCallback(
    async (m: NormalizedChatMessage, eylem: "timeout" | "ban" | "delete", sebep: string, saniye = 600) => {
      try {
        const yol = eylem === "delete" ? "delete-message" : eylem;
        const r = await fetch(`${base}/api/moderation/${yol}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: m.platform, username: m.username, messageId: m.messageId, saniye, sebep, actor: "Kontrol Merkezi" }),
        });
        const d = await r.json().catch(() => ({}));
        const ne = eylem === "timeout" ? `${saniye >= 3600 ? `${saniye / 3600} sa` : `${Math.round(saniye / 60)} dk`} zaman aşımı` : eylem === "ban" ? "kalıcı ban" : "mesaj silme";
        onToast(r.ok ? `${m.displayName}: ${ne} uygulandı (${sebep})` : `${m.displayName}: ${d?.hata || `HTTP ${r.status}`}`);
      } catch {
        onToast("AxBoT'a ulaşılamadı");
      }
    },
    [base, onToast]
  );

  const moderate = (m: NormalizedChatMessage, eylem: "timeout" | "ban" | "delete") => {
    const anahtar = `${m.key}:${eylem}`;
    if (armed !== anahtar) {
      setArmed(anahtar);
      window.setTimeout(() => setArmed((a) => (a === anahtar ? null : a)), 4000);
      return;
    }
    setArmed(null);
    void cezaVer(m, eylem, "Kontrol Merkezi");
  };

  // Sabitle (OBS sohbet kutusunun üstü) ve katmanda vurgula (birkaç saniye)
  const katmana = async (m: NormalizedChatMessage, ne: "sabitle" | "vurgula") => {
    try {
      const govde = { id: m.messageId, platform: m.platform, username: m.username, displayName: m.displayName, message: m.message, color: m.color };
      const r = await fetch(`${base}/api/${ne === "sabitle" ? "pinned" : "chat/highlight"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(govde),
      });
      onToast(r.ok ? `${m.displayName}: ${ne === "sabitle" ? "mesaj sabitlendi" : "katmanda vurgulandı"}` : `İşlem yapılamadı (HTTP ${r.status})`);
    } catch {
      onToast("AxBoT'a ulaşılamadı");
    }
  };

  const gonder = () => {
    const t = yazi.trim();
    if (!t) return;
    if (!sendChat(hedef, t)) {
      onToast("Sohbet bağlantısı yok");
      return;
    }
    setYazi("");
  };

  const yaziKutusu = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const ac = (e: Event) => setKart(kartIletisi(chat.messages, (e as CustomEvent<KartIstegi>).detail));
    window.addEventListener(KART_OLAYI, ac);
    return () => window.removeEventListener(KART_OLAYI, ac);
  }, [chat.messages]);

  // Sağ tık / Menü tuşu: tablo A7 — Yanıtla · Sabitle · Katmanda vurgula · Sil · Sustur · Banla · Kullanıcı kartı · Kopyala
  const mesajMenusu = (m: NormalizedChatMessage): MenuOgesi[] => {
    const y = yetenek[m.platform]?.moderasyon;
    const modOk = !m.isBot && !m.isSystem && !!bagli[m.platform] && !m.roles.includes("broadcaster") && !m.roles.includes("moderator");
    const ogeler: MenuOgesi[] = [
      {
        ad: "Yanıtla",
        ikon: ArrowBendUpLeft,
        kapali: m.isSystem || !(gonderilebilir as string[]).includes(m.platform),
        yap: () => {
          setHedef(m.platform);
          setYazi((t) => `@${m.username} ${t.replace(/^@\S+\s*/, "")}`);
          window.setTimeout(() => yaziKutusu.current?.focus(), 0);
        },
      },
      { ad: "Sabitle", ikon: PushPin, kapali: m.isSystem, yap: () => void katmana(m, "sabitle") },
      { ad: "Katmanda vurgula", ikon: Sparkle, kapali: m.isSystem, yap: () => void katmana(m, "vurgula") },
    ];
    // Y9: Twitch sohbetinde herkesin göreceği resmi sabitleme
    if (m.platform === "twitch" && !m.isSystem && !m.messageId.startsWith("yerel-") && twitchSabitleyebilir())
      for (const [ad, sn] of [["Twitch'te sabitle 2 dk", 120], ["Twitch'te sabitle 10 dk", 600], ["Twitch'te sabitle (yayın sonuna dek)", null]] as const)
        ogeler.push({
          ad,
          ikon: PushPin,
          yap: () =>
            void twitchSabitle(m.messageId, sn)
              .then(() => onToast(`${m.displayName}: Twitch'te sabitlendi`))
              .catch((e) => onToast(String((e as Error).message).includes("409") ? "Twitch'te zaten sabit bir mesaj var" : `Sabitlenemedi: ${String((e as Error).message).slice(0, 100)}`)),
        });
    if (modOk && y?.mesajSil && !m.messageId.startsWith("yerel-")) ogeler.push({ ad: "Sil", ikon: Trash, onay: true, ayrac: true, yap: () => void cezaVer(m, "delete", "Kontrol Merkezi") });
    if (modOk && y?.timeout)
      for (const [ad, sn] of [["Sustur 1 dk", 60], ["Sustur 10 dk", 600], ["Sustur 1 sa", 3600]] as const)
        ogeler.push({ ad, ikon: Timer, onay: true, ayrac: ad === "Sustur 1 dk" && !ogeler.some((o) => o.ad === "Sil"), yap: () => void cezaVer(m, "timeout", "Kontrol Merkezi", sn) });
    if (modOk && y?.ban) ogeler.push({ ad: "Banla", ikon: Prohibit, onay: true, yap: () => void cezaVer(m, "ban", "Kontrol Merkezi") });
    ogeler.push(
      { ad: "Kullanıcı kartı", ikon: IdentificationCard, kapali: m.isSystem, ayrac: true, yap: () => setKart(m) },
      { ad: "Kopyala", ikon: Copy, yap: () => void navigator.clipboard?.writeText(m.message).then(() => onToast("İleti kopyalandı")).catch(() => onToast("Panoya yazılamadı")) }
    );
    return ogeler;
  };

  const kartIzni = (k: NormalizedChatMessage) => {
    const y = yetenek[k.platform]?.moderasyon;
    const ok = !k.isBot && !k.isSystem && !!bagli[k.platform] && !k.roles.includes("broadcaster") && !k.roles.includes("moderator");
    return { timeout: ok && !!y?.timeout, ban: ok && !!y?.ban };
  };

  const gonderilebilir = CHAT_PLATFORMS.filter((p) => bagli[p] && yetenek[p]?.sohbet?.gonder);

  if (!base) return <p className="text-xs text-panel-muted">Bağlanıyor…</p>;

  return (
    <div className="flex h-[26rem] flex-col gap-2 text-xs">
      <div className="flex flex-wrap items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} title={connected ? "AxBoT'a bağlı" : "AxBoT'a bağlı değil"} />
        {CHAT_VIEWS.map((v) => (
          <button key={v} type="button" onClick={() => setView(v)} className={`min-h-6 rounded-full border px-2 py-0.5 ${view === v ? "border-white/40 bg-white/15 text-white" : "border-white/10 text-white/70 hover:border-white/30"}`}>
            {CHAT_VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {CHAT_PLATFORMS.filter((p) => sayac[p] || bagli[p]).map((p) => {
          const acik = platforms.size === 0 || platforms.has(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={platforms.has(p)}
              onClick={() => setPlatforms((s) => {
                const n = new Set(s);
                if (n.has(p)) n.delete(p);
                else n.add(p);
                return n;
              })}
              className={`inline-flex min-h-6 items-center gap-1 rounded border px-1.5 py-0.5 ${acik ? "border-white/20" : "border-white/5 opacity-50"}`}
              title={`${PLATFORM_LABEL[p]}${bagli[p] ? " — bağlı" : " — bağlı değil"}`}
            >
              <PlatformBadge p={p} /> {sayac[p] || 0}
            </button>
          );
        })}
        <label className="ml-auto inline-flex items-center gap-1 text-white/70">
          <input type="checkbox" checked={showBots} onChange={(e) => setShowBots(e.target.checked)} /> bot
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 text-panel-muted" />
          <input className="studio-input !py-0.5 !pl-6 w-32 text-xs" placeholder="Ara" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <button type="button" className="min-h-6 rounded px-1 text-[11px] font-bold hover:bg-white/10" onClick={yaziBoyutuDegistir} title={`Yazı boyutu: ${yaziBoyutu} px (değiştirmek için tıkla)`} aria-label="Sohbet yazı boyutu">
          A<span className="text-[10px]">{yaziBoyutu}</span>
        </button>
        <button type="button" className="min-h-6 min-w-6 rounded p-1 hover:bg-white/10" aria-pressed={ters} onClick={() => setTers((t) => !t)} title={ters ? "Sıra: yeni mesajlar üstte" : "Sıra: yeni mesajlar altta"} aria-label="Mesaj sırasını ters çevir">
          <ArrowDownUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="min-h-6 min-w-6 rounded p-1 hover:bg-white/10" onClick={togglePause} title={paused ? "Akışı sürdür" : "Akışı dondur (okumak için)"}>
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col">
      {kart && (
        <KullaniciKarti
          m={kart}
          mesajlar={chat.messages}
          base={base}
          izin={kartIzni(kart)}
          onCeza={(m, eylem, sebep) => cezaVer(m, eylem, sebep)}
          onKapat={() => setKart(null)}
        />
      )}
      <div ref={listRef} onMouseEnter={fareGirdi} onMouseLeave={fareCikti} className="custom-scrollbar min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-lg bg-black/20 p-1.5" style={{ fontSize: yaziBoyutu }} role="log" aria-live="polite">
        {filtered.length > shown.length && <p className="text-center text-[10px] text-panel-muted">{filtered.length - shown.length} eski ileti gizli — aramayla bulunur</p>}
        {shown.length === 0 && <p className="p-2 text-panel-muted">{connected ? "Bu görünümde ileti yok." : "AxBoT çalışmıyor — sohbet için Bot sekmesinden başlatın."}</p>}
        {shown.map((m) => {
          const y = yetenek[m.platform]?.moderasyon;
          const modOk = !m.isBot && !m.isSystem && bagli[m.platform] && !m.roles.includes("broadcaster") && !m.roles.includes("moderator");
          return (
            <div
              key={m.key}
              tabIndex={0}
              onContextMenu={nesneMenusu(() => mesajMenusu(m))}
              aria-label={`${m.displayName}: ${m.message}`}
              className={`group flex items-start gap-1.5 rounded px-1 py-0.5 outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60 ${m.mentionsChannel ? "bg-amber-500/10" : ""} ${m.moderation !== "visible" ? "opacity-60" : ""} ${m.isSystem ? "text-red-300" : ""}`}
            >
              <PlatformBadge p={m.platform} />
              <span className="shrink-0 text-[10px] text-panel-muted">{saat(m.timestamp)}</span>
              <span className="min-w-0 flex-1 break-words">
                <button
                  type="button"
                  className="font-bold hover:underline"
                  style={m.color ? { color: m.color } : undefined}
                  disabled={m.isSystem}
                  onClick={() => setKart(m)}
                  title={`${PLATFORM_LABEL[m.platform]} · ${m.userKeySource === "id" ? m.userKey : "kimliksiz (ad)"} · kullanıcı kartı`}
                >
                  {m.displayName}
                </button>
                {m.shared && <span className="ml-1 rounded bg-violet-500/20 px-1 text-[10px] text-violet-200" title="Twitch ortak sohbet: başka kanaldan">paylaşımlı</span>}
                {m.firstEver ? (
                  <span className="ml-1 rounded bg-emerald-500/20 px-1 text-[10px] text-emerald-200" title="Kanalda ilk kez yazıyor">ilk kez</span>
                ) : m.firstInSession ? (
                  <span className="ml-1 rounded bg-sky-500/20 px-1 text-[10px] text-sky-200" title="Bu oturumdaki ilk mesajı">ilk</span>
                ) : null}
                {m.moderation !== "visible" && <span className="ml-1 rounded bg-red-500/20 px-1 text-[10px] text-red-200">{m.moderation === "blocked" ? "kara liste" : `kalkan · ${m.moderationReason}`}</span>}
                <span className="text-white/85" data-ceviri="yok">: {m.message}</span>
              </span>
              {!m.isSystem && (
                <span className="hidden shrink-0 gap-1 group-focus-within:flex group-hover:flex">
                  <button type="button" className="rounded bg-white/10 p-0.5" title="Sabitle (OBS sohbetinin üstünde)" aria-label={`Sabitle: ${m.displayName}`} onClick={() => void katmana(m, "sabitle")}>
                    <Pin className="h-3 w-3" />
                  </button>
                  <button type="button" className="rounded bg-white/10 p-0.5" title="Katmanda vurgula (15 sn)" aria-label={`Katmanda vurgula: ${m.displayName}`} onClick={() => void katmana(m, "vurgula")}>
                    <Sparkles className="h-3 w-3" />
                  </button>
                </span>
              )}
              {modOk && (y?.timeout || y?.ban || (y?.mesajSil && !m.messageId.startsWith("yerel-"))) && (
                <span className="hidden shrink-0 gap-1 group-focus-within:flex group-hover:flex">
                  {y?.mesajSil && !m.messageId.startsWith("yerel-") && (
                    <button type="button" className={`rounded px-1 text-[10px] ${armed === `${m.key}:delete` ? "bg-red-600 text-white" : "bg-white/10"}`} onClick={() => void moderate(m, "delete")}>
                      {armed === `${m.key}:delete` ? "Emin misin?" : "Sil"}
                    </button>
                  )}
                  {y?.timeout && (
                    <button type="button" className={`rounded px-1 text-[10px] ${armed === `${m.key}:timeout` ? "bg-red-600 text-white" : "bg-white/10"}`} onClick={() => void moderate(m, "timeout")}>
                      {armed === `${m.key}:timeout` ? "Emin misin?" : "10 dk"}
                    </button>
                  )}
                  {y?.ban && (
                    <button type="button" className={`rounded px-1 text-[10px] ${armed === `${m.key}:ban` ? "bg-red-600 text-white" : "bg-white/10"}`} onClick={() => void moderate(m, "ban")}>
                      {armed === `${m.key}:ban` ? "Emin misin?" : "Ban"}
                    </button>
                  )}
                </span>
              )}
            </div>
          );
        })}
        {yeni > 0 && (
          <button type="button" className={`sticky w-full rounded bg-sky-600/80 py-0.5 text-[10px] font-bold ${ters ? "top-0" : "bottom-0"}`} onClick={surdur}>
            {yeni} yeni ileti — sürdür
          </button>
        )}
      </div>
      </div>

      <ChatModes base={base} yetenek={yetenek} bagli={bagli} onToast={onToast} />

      <div className="flex items-center gap-1">
        <select className="studio-input !w-auto max-w-[116px] shrink-0 !py-1 text-xs" value={hedef} onChange={(e) => setHedef(e.target.value)} title="Botun yazacağı platform">
          <option value="all">Tüm platformlar</option>
          {gonderilebilir.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
        <input
          ref={yaziKutusu}
          className="studio-input min-w-0 flex-1 !py-1 text-xs"
          placeholder="Bot olarak yaz…"
          maxLength={450}
          value={yazi}
          onChange={(e) => setYazi(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && gonder()}
        />
        <button type="button" className="studio-btn-ghost !px-2 !py-1" disabled={!connected || !yazi.trim()} onClick={gonder} title="Gönder">
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
});

// ─── Sohbet modları ──────────────────────────────────────────────────────

const MOD_DUGMELERI: { etiket: string; govde: Record<string, unknown> }[] = [
  { etiket: "Yavaş 30 sn", govde: { yavasSn: 30 } },
  { etiket: "Yavaş kapat", govde: { yavasSn: 0 } },
  { etiket: "Takipçi 10 dk", govde: { takipciDk: 10 } },
  { etiket: "Takipçi kapat", govde: { takipciDk: null } },
  { etiket: "Yalnız abone", govde: { abone: true } },
  { etiket: "Abone kapat", govde: { abone: false } },
  { etiket: "Yalnız emote", govde: { emote: true } },
  { etiket: "Emote kapat", govde: { emote: false } },
];

/**
 * Platformun kendi sohbet modları — yalnız API'si olan (bugün Twitch Helix) ve bağlı platformlar için gösterilir.
 * Kick ve YouTube'un resmi API'sinde bu uç yok: o platformlar listede hiç görünmez (desteklenmeyen işlev etkin gösterilmez).
 */
function ChatModes({
  base,
  yetenek,
  bagli,
  onToast,
}: {
  base: string;
  yetenek: Record<string, Yetenek>;
  bagli: Record<string, boolean>;
  onToast: (m: string) => void;
}) {
  const [armed, setArmed] = useState<string | null>(null);
  const platformlar = CHAT_PLATFORMS.filter((p) => bagli[p] && yetenek[p]?.moderasyon?.sohbetModlari);
  if (!platformlar.length) return null;
  const uygula = async (platform: string, etiket: string, govde: Record<string, unknown>) => {
    const anahtar = `${platform}:${etiket}`;
    if (armed !== anahtar) {
      setArmed(anahtar);
      window.setTimeout(() => setArmed((a) => (a === anahtar ? null : a)), 4000);
      return;
    }
    setArmed(null);
    try {
      const r = await fetch(`${base}/api/moderation/chat-mode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ...govde, actor: "Kontrol Merkezi" }),
      });
      const d = await r.json().catch(() => ({}));
      onToast(r.ok ? `${PLATFORM_LABEL[platform as ChatPlatform]}: ${etiket} uygulandı` : `${PLATFORM_LABEL[platform as ChatPlatform]}: ${d?.hata || `HTTP ${r.status}`}`);
    } catch {
      onToast("AxBoT'a ulaşılamadı");
    }
  };
  return (
    <details className="rounded-lg border border-white/10 px-2 py-1">
      <summary className="cursor-pointer text-white/80">Sohbet modları</summary>
      {platformlar.map((p) => (
        <div key={p} className="mt-1 flex flex-wrap items-center gap-1">
          <PlatformBadge p={p} />
          {MOD_DUGMELERI.map((b) => {
            const anahtar = `${p}:${b.etiket}`;
            return (
              <button
                key={b.etiket}
                type="button"
                className={`rounded px-1.5 py-0.5 text-[10px] ${armed === anahtar ? "bg-red-600 text-white" : "bg-white/10 hover:bg-white/20"}`}
                onClick={() => void uygula(p, b.etiket, b.govde)}
              >
                {armed === anahtar ? "Emin misin?" : b.etiket}
              </button>
            );
          })}
        </div>
      ))}
    </details>
  );
}

// ─── Etkinlik akışı ──────────────────────────────────────────────────────

export const ActivityFeedPanel = memo(function ActivityFeedPanel({ onToast }: { onToast: (m: string) => void }) {
  const { activity, connected, base } = useFeed();
  const [tur, setTur] = useState<string>("all");
  const [testGizle, setTestGizle] = useState(false);
  const [bekleyenler, setBekleyenler] = useState(false);
  const turler = useMemo(() => Array.from(new Set(activity.map((e) => e.eventType))), [activity]);
  const list = activity.filter((e) => (tur === "all" || e.eventType === tur) && (!testGizle || !e.isTest) && (!bekleyenler || !e.thanked));

  const tesekkur = async (e: ActivityEvent) => {
    if (!base || !e.alertId) return;
    try {
      const r = await fetch(`${base}/api/activity/thanked`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: e.alertId, tesekkur: !e.thanked }),
      });
      if (!r.ok) onToast(((await r.json().catch(() => ({}))) as { error?: string }).error || `HTTP ${r.status}`);
    } catch {
      onToast("AxBoT'a ulaşılamadı");
    }
  };

  const tekrar = async (e: ActivityEvent) => {
    if (!base || !e.alertId) return;
    try {
      const r = await fetch(`${base}/api/alerts/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "replay", alertId: e.alertId, actor: "Kontrol Merkezi" }),
      });
      const d = await r.json().catch(() => ({}));
      onToast(r.ok ? "Uyarı yeniden oynatılıyor" : d?.error || `HTTP ${r.status}`);
    } catch {
      onToast("AxBoT'a ulaşılamadı");
    }
  };

  // Tablo A7 — Yeniden oynat · Teşekkür edildi · Shoutout · Kullanıcı kartı
  const olayMenusu = (e: ActivityEvent): MenuOgesi[] => {
    const kisi = (CHAT_PLATFORMS as readonly string[]).includes(e.platform) && !!e.user;
    return [
      { ad: "Yeniden oynat", ikon: ArrowCounterClockwise, kapali: !e.alertId, yap: () => void tekrar(e) },
      { ad: e.thanked ? "Teşekkürü geri al" : "Teşekkür edildi", ikon: HandHeart, kapali: !e.alertId, yap: () => void tesekkur(e) },
      {
        ad: "Shoutout",
        ikon: Megaphone,
        kapali: !kisi || e.isTest || !connected,
        yap: () => {
          if (!feed.ws || feed.ws.readyState !== WebSocket.OPEN) return onToast("Sohbet bağlantısı yok");
          feed.ws.send(JSON.stringify({ action: "shoutout", kanal: e.user, platform: e.platform }));
          onToast(`${e.user} için shoutout gönderildi`);
        },
      },
      {
        ad: "Kullanıcı kartı",
        ikon: IdentificationCard,
        kapali: !kisi,
        yap: () => window.dispatchEvent(new CustomEvent<KartIstegi>(KART_OLAYI, { detail: { platform: e.platform as ChatPlatform, username: e.user } })),
      },
    ];
  };

  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center gap-1">
        <span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-red-400"}`} />
        <select className="studio-input !py-0.5 text-xs" value={tur} onChange={(e) => setTur(e.target.value)}>
          <option value="all">Tüm olaylar</option>
          {turler.map((t) => (
            <option key={t} value={t}>
              {ACTIVITY_LABEL[t] || t}
            </option>
          ))}
        </select>
        <label className="ml-auto inline-flex items-center gap-1 text-white/70">
          <input type="checkbox" checked={bekleyenler} onChange={(e) => setBekleyenler(e.target.checked)} /> teşekkür bekleyenler
        </label>
        <label className="inline-flex items-center gap-1 text-white/70">
          <input type="checkbox" checked={testGizle} onChange={(e) => setTestGizle(e.target.checked)} /> testleri gizle
        </label>
      </div>
      <div className="custom-scrollbar max-h-72 space-y-1 overflow-y-auto">
        {list.length === 0 && <p className="text-panel-muted">{connected ? "Bu oturumda olay yok. Takip, abone ve bağışlar geldikçe burada görünür." : "AxBoT çalışmıyor — olaylar için Bot sekmesinden başlatın."}</p>}
        {list.map((e) => (
          <div
            key={e.eventId}
            tabIndex={0}
            onContextMenu={nesneMenusu(() => olayMenusu(e))}
            className={`flex items-center gap-1.5 rounded-lg px-2 py-1 outline-none focus-visible:ring-1 focus-visible:ring-sky-400/60 ${e.thanked ? "bg-white/[0.015] opacity-60" : "bg-white/[0.03]"}`}>
            <PlatformBadge p={e.platform} />
            <span className="min-w-0 flex-1 truncate">
              <b className="text-white">{e.user}</b> <span className="text-white/80">{ACTIVITY_LABEL[e.eventType] || e.eventType}</span>
              {e.amount !== undefined && <span className="ml-1 font-bold text-emerald-300">{e.amount} {e.currency || ""}</span>}
              {e.quantity !== undefined && <span className="ml-1 text-white/80">×{e.quantity}</span>}
              {e.months !== undefined && <span className="ml-1 text-white/70">{e.months}. ay</span>}
              {e.viewers !== undefined && <span className="ml-1 text-white/70">{e.viewers} izleyici</span>}
              {e.message && <span className="ml-1 text-panel-muted">“{e.message}”</span>}
              {e.isTest && <span className="ml-1 rounded bg-cyan-500/20 px-1 text-[10px] text-cyan-200">TEST</span>}
            </span>
            <span className="shrink-0 text-[10px] text-panel-muted">{saat(e.timestamp)}</span>
            {e.alertId && (
              <button
                type="button"
                aria-pressed={!!e.thanked}
                className={`shrink-0 rounded p-1 hover:bg-white/10 ${e.thanked ? "text-emerald-300" : "text-white/50"}`}
                title={e.thanked ? "Teşekkür edildi (geri almak için bas)" : "Teşekkür edildi olarak işaretle"}
                aria-label={`${e.user}: ${e.thanked ? "teşekkür edildi" : "teşekkür edildi olarak işaretle"}`}
                onClick={() => void tesekkur(e)}
              >
                <Check className="h-3 w-3" />
              </button>
            )}
            {e.alertId && (
              <button type="button" className="shrink-0 rounded p-1 hover:bg-white/10" title="Uyarıyı yeniden oynat" aria-label={`${e.user}: uyarıyı yeniden oynat`} onClick={() => void tekrar(e)}>
                <RotateCcw className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
