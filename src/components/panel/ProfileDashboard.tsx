/**
 * Profil & Dashboard — Botaxt Modül 1 (SQLite analitik)
 */

import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, Bot, Eraser, MessageCircle, Radio, Users } from "lucide-react";
import { API_BASE, fetchSettings, patchSettings, type OverlaySettings } from "../../lib/api";
import {
  botaxtApi,
  endSession,
  fetchDashboard,
  fmtDuration,
  fmtTs,
  pushMetrics,
  type DashboardSnapshot,
  type EventLog,
  type StreamSession,
} from "../../lib/api/botaxt";
import { getBotConfig, saveBotConfig } from "../../lib/smartBot";
import { useChatHub } from "../../lib/useChatHub";
import ChatFeed from "../chat/ChatFeed";
import { clearPlatformChats, clearResultToast } from "../../lib/clearPlatformChats";

/** Dashboard alt sekmeleri (PanelPage). Bileşen sekme değişse de BAĞLI kalır:
 *  sadakat sayacı, yayın metrikleri ve oturum kapatma arka planda sürmeli. */
export type DashboardBolumu = "genel" | "baglantilar" | "obs" | "gecmis" | "gelismis";

type Props = {
  onToast: (m: string) => void;
  onEndLive?: () => Promise<void> | void;
  streamLive?: boolean;
  /** Hangi bölüm çizilsin; verilmezse hepsi (eski görünüm). */
  bolum?: DashboardBolumu;
};

type KickLiveStatus = {
  live: boolean;
  viewers: number;
  followers: number;
  playbackUrl?: string | null;
  streamTitle?: string | null;
};

function markStreamLive(live: boolean) {
  saveBotConfig((prev) => ({
    ...prev,
    streamStartedAt: live ? Date.now() : null,
  }));
}

/**
 * `<video src>` bu akışı doğrudan oynatabilir mi?
 *
 * Kick'in playback adresi HLS (.m3u8). Chromium/WebView2 HLS'i yerel olarak
 * oynatmaz (yalnız Safari oynatır), bu yüzden önizleme siyah kalıyordu.
 * Oynatamıyorsak Kick'in kendi oynatıcısını (iframe) kullanırız.
 */
export function canPlayDirectly(url: string, probe?: (t: string) => string): boolean {
  if (!/\.m3u8(\?|$)/i.test(url)) return true;
  const can =
    probe ||
    ((t: string) => {
      try {
        return document.createElement("video").canPlayType(t);
      } catch {
        return "";
      }
    });
  return !!(can("application/vnd.apple.mpegurl") || can("application/x-mpegURL"));
}

export default function ProfileDashboard({ onToast, onEndLive, streamLive, bolum }: Props) {
  const goster = (b: DashboardBolumu) => !bolum || bolum === b;
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [botEnabled, setBotEnabled] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [kickSlug, setKickSlug] = useState("");
  const [liveStatus, setLiveStatus] = useState<KickLiveStatus>({
    live: false,
    viewers: 0,
    followers: 0,
  });
  const announcedSession = useRef<string | null>(null);
  const liveSessionId = useRef<string | null>(null);

  const [remoteUser, setRemoteUser] = useState("editor");
  const [remotePass, setRemotePass] = useState("");
  const [chatSettings, setChatSettings] = useState<OverlaySettings>({});
  const [clearingChat, setClearingChat] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const stopPending = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setErr("");
      const [snap, bot, chat] = await Promise.all([
        fetchDashboard(),
        botaxtApi.botSettings().catch(() => ({})),
        botaxtApi.kickChatStatus().catch(() => ({})),
      ]);
      setData(snap);
      const botState = bot as Record<string, unknown>;
      const chatState = chat as { connected?: boolean; username?: string | null };
      setBotEnabled(Number(botState.enabled ?? 1) !== 0);
      setChatConnected(!!chatState.connected);
      setKickSlug(String(chatState.username || getBotConfig().channelName || "").trim());
      // SQLite oturumu ile bot uptime senkronu
      const live = !!snap.active_session;
      const cfg = getBotConfig();
      if (live && !cfg.streamStartedAt) {
        saveBotConfig((prev) => ({
          ...prev,
          streamStartedAt: snap.active_session!.started_at || Date.now(),
        }));
      } else if (!live && cfg.streamStartedAt) {
        saveBotConfig((prev) => ({ ...prev, streamStartedAt: null }));
      }
    } catch (e) {
      setErr(String((e as Error).message || e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setVisibleInterval(() => void refresh(), 3000);
    return () => clearVisibleInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!kickSlug) return;
    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/kick/chatroom?slug=${encodeURIComponent(kickSlug)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const body = (await res.json()) as Partial<KickLiveStatus>;
        setLiveStatus({
          live: !!body.live,
          viewers: Number(body.viewers) || 0,
          followers: Number(body.followers) || 0,
          playbackUrl: body.playbackUrl || null,
          streamTitle: body.streamTitle || null,
        });
      } catch {
        /* Son başarılı canlı ölçümü ekranda kalır. */
      }
    };
    void poll();
    const id = window.setInterval(poll, 10_000);
    return () => window.clearInterval(id);
  }, [kickSlug]);

  useEffect(() => {
    setPreviewEpoch(Date.now());
  }, [liveStatus.live, kickSlug]);

  useEffect(() => {
    void fetchSettings("chat")
      .then(setChatSettings)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/event")
      .then(({ listen }) =>
        listen<{ outputActive?: boolean }>("obs-stream-state", (event) => {
          setPreviewEpoch(Date.now());
          if (event.payload?.outputActive === false && stopPending.current) {
            stopPending.current = false;
            const sid = liveSessionId.current;
            if (sid) {
              void endSession(sid)
                .then(() => {
                  markStreamLive(false);
                  void refresh();
                })
                .catch(() => undefined);
            }
          }
        })
      )
      .then((fn) => {
        unlisten = fn;
      })
      .catch(() => undefined);
    return () => {
      unlisten?.();
    };
  }, [refresh]);

  const { messages, clear } = useChatHub(chatSettings, {
    max: 200,
    hideAfterMs: 0,
  });

  const streamHealthy =
    !!data?.active_session && botEnabled && chatConnected && liveStatus.live;
  const currentViewers = liveStatus.live ? liveStatus.viewers : data?.viewers || 0;
  liveSessionId.current = data?.active_session?.id || null;

  useEffect(() => {
    const sessionId = data?.active_session?.id;
    if (!streamHealthy || !sessionId || announcedSession.current === sessionId) return;
    announcedSession.current = sessionId;
    const text = "BotAxT: Bot, sohbet ve canlı yayın bağlantısı düzgün çalışıyor.";
    onToast(text);
    void patchSettings("chat", {
      _botAnnounce: {
        id: `stream-health-${sessionId}`,
        lines: [text],
        platform: "kick",
        t: Date.now(),
      },
    }).catch(() => undefined);
  }, [data?.active_session?.id, onToast, streamHealthy]);

  // Sadakat izleme tick (API yoksa sessizce geçer)
  useEffect(() => {
    const tick = () => {
      void botaxtApi.loyaltyTick().catch(() => undefined);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Aktif oturumda metrik örnekleri
  useEffect(() => {
    const sid = data?.active_session?.id;
    if (!sid) return;
    const push = () => {
      const cfg = getBotConfig();
      void pushMetrics({
        session_id: sid,
        viewers: currentViewers || Number(cfg.viewerCount) || 0,
        chat_rpm: data?.chat_rpm || 0,
        followers: data.session_followers || 0,
        subs: data.session_subs || 0,
      });
    };
    push();
    const id = window.setInterval(push, 30_000);
    return () => window.clearInterval(id);
  }, [
    currentViewers,
    data?.active_session?.id,
    data?.chat_rpm,
    data?.session_followers,
    data?.session_subs,
  ]);

  const onEnd = async () => {
    if (busy) return;
    // Çıkış ekranı veritabanı oturumuna BAĞLI DEĞİL. Eskiden `active_session`
    // yoksa (yayın OBS'ten başlatıldıysa ya da oturum açılamadıysa) düğme hiç
    // çalışmıyordu: "yayını kapat dediğimde çıkış ekranı gelmiyor".
    const sid = data?.active_session?.id;
    setBusy(true);
    stopPending.current = !!sid;
    try {
      onToast(sid ? "Çıkış ekranı — yayın süre bitince kapanacak" : "Çıkış ekranına geçiliyor");
      setBusy(false);
      void (async () => {
        try {
          await Promise.race([
            Promise.resolve(onEndLive?.()),
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error("timeout")), 8000)
            ),
          ]);
        } catch {
          /* OBS durdurma arka planda sürer */
        }
        await refresh();
      })();
    } catch (e) {
      stopPending.current = false;
      onToast(String((e as Error).message || "Bitirilemedi"));
      setBusy(false);
    }
  };

  if (!goster("genel") && !goster("gecmis") && !goster("gelismis")) return null;

  if (!data && !err) {
    return (
      <div className="px-4 py-3 text-xs text-panel-muted">Dashboard yükleniyor…</div>
    );
  }

  return (
    <div className="mx-4 mb-2 mt-1 space-y-3">
      {err && !data && (
        <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          Dashboard API: {err}{" "}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Yenile
          </button>
        </div>
      )}

      {goster("genel") && (
        <>
          {/* Canlı durum + TEK istatistik ızgarası (eskiden iki ızgara aynı sayıları
              tekrar ediyordu: anlık izleyici ve oturum aboneleri iki kez). */}
          <section className="yya-card space-y-3 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-panel-accent">Canlı durum</p>
                <h2 className="font-display text-base font-semibold text-white">
                  {data?.channel_name || "Yayıncı"}
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    streamHealthy
                      ? "border-panel-accent/40 bg-panel-accent/10 text-panel-accent"
                      : "border-amber-400/30 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {streamHealthy
                    ? "● Her şey düzgün çalışıyor"
                    : data?.active_session
                      ? "● Bağlantı kontrol ediliyor"
                      : "○ Yayın kapalı"}
                </span>
                {/* Düğme her zaman görünür: çıkış ekranına geçiş oturumdan bağımsız. */}
                <button
                  type="button"
                  disabled={busy}
                  className="yya-btn-danger h-8 px-3 text-xs"
                  onClick={() => void onEnd()}
                  title={
                    data?.active_session
                      ? "Yayını bitir: çıkış ekranına geç ve OBS yayınını durdur"
                      : "Çıkış ekranına geç ve OBS yayınını durdur"
                  }
                >
                  Çıkış ekranına geç
                </button>
                <button type="button" className="yya-btn-ghost h-8 px-3 text-xs" onClick={() => void refresh()}>
                  Yenile
                </button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <HealthBadge
                icon={<Bot className="h-4 w-4" />}
                label="Bot"
                ok={botEnabled}
                value={botEnabled ? "Aktif" : "Kapalı"}
              />
              <HealthBadge
                icon={<MessageCircle className="h-4 w-4" />}
                label="Sohbet"
                ok={chatConnected}
                value={chatConnected ? "Bağlı" : "Bağlı değil"}
              />
              <HealthBadge
                icon={<Radio className="h-4 w-4" />}
                label="Kick yayını"
                ok={liveStatus.live}
                value={liveStatus.live ? "Canlı" : "Çevrimdışı"}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Anlık izleyici" value={String(currentViewers)} hint="Kick" />
              <Stat label="Chatte aktif" value={String(data?.active_chatters || 0)} hint="son 5 dakika" />
              <Stat label="Chat hızı" value={`${(data?.chat_rpm || 0).toFixed(1)}/dk`} hint="mesaj / dakika" />
              <Stat
                label="Oturum"
                value={data?.active_session ? "Canlı" : "Kapalı"}
                hint={data?.active_session ? fmtTs(data.active_session.started_at) : "Başlatınca kayıt tutulur"}
              />
              <Stat label="Oturum izleyicisi" value={String(data?.session_viewers || 0)} hint="chatte görülen tekil kişi" />
              <Stat label="Oturum takip" value={String(data?.session_followers || 0)} />
              <Stat label="Oturum abone" value={String(data?.session_subs || 0)} />
              <Stat label="Oturum chat" value={String(data?.session_chat || 0)} />
            </div>
          </section>

      <section className="yya-card overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-border px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Canlı yayın ve sohbet önizlemesi</h3>
            <p className="text-[10px] text-panel-muted">
              {liveStatus.streamTitle || kickSlug || "Kick kanalı"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-panel-accent" />
            <button
              type="button"
              disabled={clearingChat}
              className="yya-btn-ghost inline-flex items-center gap-1.5 text-xs"
              onClick={() => {
                if (clearingChat) return;
                setClearingChat(true);
                void clearPlatformChats({
                  twitchChannel: String(chatSettings.twitchChannel || ""),
                  youtubeChannel: String(chatSettings.youtubeChannel || ""),
                })
                  .then((r) => {
                    clear();
                    onToast(clearResultToast(r));
                  })
                  .catch((e) => onToast(String((e as Error).message || e)))
                  .finally(() => setClearingChat(false));
              }}
            >
              <Eraser className="h-3.5 w-3.5" />
              {clearingChat ? "Temizleniyor…" : "Sohbeti temizle"}
            </button>
          </div>
        </div>
        <div className="grid min-h-[28rem] lg:grid-cols-[1.55fr_1fr]">
          <div className="min-h-[22rem] bg-black lg:min-h-[28rem]">
            {(liveStatus.live || streamLive || !!data?.active_session) && kickSlug ? (
              liveStatus.playbackUrl && canPlayDirectly(liveStatus.playbackUrl) ? (
                <video
                  key={`${kickSlug}-hls-${previewEpoch}`}
                  className="h-full min-h-[22rem] w-full object-contain lg:min-h-[28rem]"
                  src={liveStatus.playbackUrl}
                  autoPlay
                  muted
                  playsInline
                  controls
                />
              ) : (
              <iframe
                // Yayın durumu değişince yeniden yüklenir: yayın başlamadan açılan
                // oynatıcı aksi hâlde "çevrimdışı" ekranında kalıyordu.
                key={`${kickSlug}-${previewEpoch}`}
                title={`${kickSlug} canlı yayın önizlemesi`}
                src={`https://player.kick.com/${encodeURIComponent(kickSlug)}?autoplay=true&muted=true`}
                className="h-full min-h-[22rem] w-full border-0 lg:min-h-[28rem]"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
              )
            ) : (
              <div className="flex h-full min-h-[22rem] flex-col items-center justify-center gap-2 text-center lg:min-h-[28rem]">
                <Radio className="h-10 w-10 text-panel-muted/50" />
                <p className="text-xs text-panel-muted">Yayın başlayınca önizleme burada açılır.</p>
              </div>
            )}
          </div>
          <div className="flex min-h-[18rem] flex-col border-t border-panel-border bg-black lg:border-l lg:border-t-0">
            <div className="border-b border-panel-border px-3 py-2 text-[11px] uppercase tracking-wider text-panel-muted">
              Canlı sohbet · {messages.length} mesaj
            </div>
            <div className="min-h-0 flex-1">
              <div
                className="chat-overlay !h-full !w-full !p-2"
                style={{
                  background: "transparent",
                  ["--chat-size" as never]: "13px",
                  ["--accent" as never]: "#3EEDFE",
                }}
              >
                <ChatFeed
                  messages={messages}
                  showBadge
                  showUserBadges
                  emptyText="Sohbet bekleniyor…"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {err && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {err}
          <p className="mt-1 text-[11px] text-red-200/70">
            Dashboard API yanıt vermiyor. Uygulamayı yeniden başlatıp tekrar deneyin.
          </p>
        </div>
      )}

          {data && (
            <section className="yya-card space-y-3">
              <h3 className="font-display text-sm font-semibold text-white">Son olaylar</h3>
              <EventList events={data.recent_events} />
            </section>
          )}
        </>
      )}

      {goster("gecmis") && data && (
        <>
          <section className="yya-card space-y-3">
            <h3 className="font-display text-sm font-semibold text-white">Yayın geçmişi</h3>
            <SessionList sessions={data.sessions} />
          </section>
          <section className="yya-card space-y-3">
            <h3 className="font-display text-sm font-semibold text-white">
              Önceki yayınlar — izleyici zirvesi
            </h3>
            <SessionSparkline sessions={data.sessions} />
          </section>
        </>
      )}

      {goster("gelismis") && data && (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <Stat label="Sadakat kullanıcısı" value={String(data.loyalty_users)} />
            <Stat label="Komutlar" value={String(data.commands)} />
          </div>
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="yya-card space-y-3">
              <h3 className="font-display text-sm font-semibold text-white">Yerel SQLite</h3>
              <p className="text-xs text-panel-muted">
                Alert / widget seed, smartBot yeniden import, Discord test.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="yya-btn-ghost"
                  onClick={() =>
                    void botaxtApi.seedAlerts().then(() => onToast("Alert tipleri seed"))
                  }
                >
                  Alert seed
                </button>
                <button
                  type="button"
                  className="yya-btn-ghost"
                  onClick={() =>
                    void botaxtApi.seedWidgets().then(() => onToast("Widget seed"))
                  }
                >
                  Widget seed
                </button>
                <button
                  type="button"
                  className="yya-btn-accent"
                  onClick={() =>
                    void botaxtApi.syncSmartbot(true).then(() => {
                      onToast("smartBot → SQLite sync");
                      void refresh();
                    })
                  }
                >
                  Sync smartBot
                </button>
                <button
                  type="button"
                  className="yya-btn-ghost"
                  onClick={() =>
                    void botaxtApi.discordTest().then(async (r) => {
                      onToast(r.ok ? "Discord test gönderildi" : "Discord webhook yok/hata");
                    })
                  }
                >
                  Discord test
                </button>
                <button
                  type="button"
                  className="yya-btn-primary"
                  onClick={() =>
                    void botaxtApi.testAlert({ kind: "follow", user: "TestUser" }).then(() =>
                      onToast("Alert test")
                    )
                  }
                >
                  Test alert
                </button>
              </div>
            </div>
            <div className="yya-card space-y-3">
              <h3 className="font-display text-sm font-semibold text-white">
                Uzak editör (Modül 8)
              </h3>
              <p className="text-xs text-panel-muted">
                Yerel ağ / Tailscale:{" "}
                <code className="text-panel-accent">POST …/remote/login</code>
              </p>
              <p className="text-[11px] text-panel-muted">
                Yalnız Ayarlar'da uzak erişim açıksa kullanılır. İlk yönetici yalnız bu bilgisayardan kurulur; şifre en az 8 karakter. 10 dakikada 8 hatalı girişten sonra o adres beklemeye alınır.
              </p>
              <input
                className="yya-input"
                placeholder="kullanıcı"
                value={remoteUser}
                onChange={(e) => setRemoteUser(e.target.value)}
              />
              <input
                className="yya-input"
                type="password"
                placeholder="şifre (en az 8 karakter)"
                value={remotePass}
                onChange={(e) => setRemotePass(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="yya-btn-primary"
                  onClick={() =>
                    void botaxtApi
                      .remoteSetup(remoteUser.trim(), remotePass)
                      .then(() => onToast("Uzak admin oluşturuldu"))
                      .catch((e) => onToast(String(e.message || e)))
                  }
                >
                  İlk admin kur
                </button>
                <button
                  type="button"
                  className="yya-btn-ghost"
                  onClick={() =>
                    void botaxtApi
                      .remoteLogin(remoteUser.trim(), remotePass)
                      .then((j) => {
                        try {
                          localStorage.setItem(
                            "botaxt.remoteToken",
                            String(j.token || "")
                          );
                        } catch {
                          /* */
                        }
                        onToast("Giriş OK — token kaydedildi");
                      })
                      .catch((e) => onToast(String(e.message || e)))
                  }
                >
                  Giriş test
                </button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function HealthBadge({
  icon,
  label,
  ok,
  value,
}: {
  icon: ReactNode;
  label: string;
  ok: boolean;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-panel-card/70 px-3.5 py-2.5 shadow-panel">
      <span className={ok ? "text-panel-accent" : "text-amber-300"}>{icon}</span>
      <span>
        <span className="block text-[10px] font-bold uppercase tracking-wider text-panel-muted">{label}</span>
        <span className={`text-xs font-bold ${ok ? "text-panel-accent" : "text-amber-200"}`}>
          {value}
        </span>
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-panel-card/70 p-3.5 shadow-panel transition-all duration-150 hover:border-white/[0.14] hover:bg-white/[0.04]">
      <div className="text-[10px] font-bold uppercase tracking-wider text-panel-muted">{label}</div>
      <div className="mt-1.5 font-display text-2xl font-bold tracking-tight text-panel-accent">{value}</div>
      {hint && <div className="mt-1 text-[10px] text-white/50">{hint}</div>}
    </div>
  );
}

function EventList({ events }: { events: EventLog[] }) {
  if (!events.length) {
    return <p className="text-xs text-panel-muted">Henüz olay yok — bot/chat olayları burada birikir.</p>;
  }
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
      {events.map((e) => (
        <li
          key={e.id}
          className="flex items-baseline justify-between gap-2 border-b border-panel-border/40 py-1.5 last:border-0"
        >
          <span className="min-w-0 truncate">
            <span className="mr-2 text-[10px] uppercase text-panel-accent">{e.kind}</span>
            <span className="font-medium text-white/90">{e.user_name}</span>
            {e.message && <span className="text-panel-muted"> · {e.message}</span>}
          </span>
          <span className="shrink-0 text-[10px] text-panel-muted">{fmtTs(e.ts)}</span>
        </li>
      ))}
    </ul>
  );
}

function SessionList({ sessions }: { sessions: StreamSession[] }) {
  if (!sessions.length) {
    return (
      <p className="text-xs text-panel-muted">
        Geçmiş yok. “Yayını başlat” ile SQLite kaydı açılır.
      </p>
    );
  }
  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto text-sm">
      {sessions.map((s) => {
        const live = !s.ended_at;
        const dur =
          s.duration_sec ??
          (live ? Math.floor((Date.now() - s.started_at) / 1000) : null);
        return (
          <li
            key={s.id}
            className="rounded-xl border border-panel-border/50 bg-panel-elevated/40 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-white/90">
                {s.title || "Yayın"} {live && <span className="text-panel-accent">● canlı</span>}
              </span>
              <span className="text-[10px] text-panel-muted">{fmtTs(s.started_at)}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-panel-muted">
              <span>Süre {fmtDuration(dur)}</span>
              <span>Peak {s.peak_viewers}</span>
              <span>+{s.new_followers} takip</span>
              <span>+{s.new_subs} abone</span>
              <span>{s.chat_messages} msg</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Basit SVG sparkline — önceki yayın peak izleyici */
function SessionSparkline({ sessions }: { sessions: StreamSession[] }) {
  const rows = [...sessions].slice(0, 12).reverse();
  if (!rows.length) {
    return <p className="text-xs text-panel-muted">Grafik için en az bir kayıtlı oturum gerekir.</p>;
  }
  const peaks = rows.map((s) => Math.max(0, s.peak_viewers || 0));
  const max = Math.max(1, ...peaks);
  const w = 560;
  const h = 120;
  const pad = 8;
  const step = rows.length > 1 ? (w - pad * 2) / (rows.length - 1) : 0;
  const points = peaks
    .map((v, i) => {
      const x = pad + i * step;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-28 w-full min-w-[280px]" role="img">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-panel-accent"
          points={points}
        />
        {peaks.map((v, i) => {
          const x = pad + i * step;
          const y = h - pad - (v / max) * (h - pad * 2);
          return <circle key={i} cx={x} cy={y} r="3.5" className="fill-panel-accent" />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-panel-muted">
        <span>{fmtTs(rows[0].started_at)}</span>
        <span>max {max}</span>
        <span>{fmtTs(rows[rows.length - 1].started_at)}</span>
      </div>
    </div>
  );
}
