/**
 * Profil & Dashboard — Bot modülü 1 (SQLite analitik)
 */

import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE, patchSettings } from "../../lib/api";
import {
  botApi,
  fetchDashboard,
  fmtDuration,
  fmtTs,
  pushMetrics,
  type DashboardSnapshot,
  type StreamSession,
} from "../../lib/api/botApi";
import { getBotConfig, saveBotConfig } from "../../lib/sohbetBot";
import { useAxthrowaStore, type KickCanli } from "../../store/useAxthrowaStore";
import { axbotBase } from "../../lib/axbot";
import CihazEslestirme from "./CihazEslestirme";

/** Dashboard alt sekmeleri (PanelPage). Bileşen sekme değişse de BAĞLI kalır:
 *  sadakat sayacı, yayın metrikleri ve oturum kapatma arka planda sürmeli. */
export type DashboardBolumu = "genel" | "baglantilar" | "obs" | "gecmis" | "gelismis";

type Props = {
  onToast: (m: string) => void;

  streamLive?: boolean;
  /** Hangi bölüm çizilsin; verilmezse hepsi (eski görünüm). */
  bolum?: DashboardBolumu;
};

type KickLiveStatus = KickCanli;

/**
 * `<video src>` bu akışı doğrudan oynatabilir mi?
 *
 * Kick'in playback adresi HLS (.m3u8). Chromium/WebView2 `canPlayType` için "maybe" dese de akış
 * hiç başlamıyor (readyState 0, hata da yok) ve önizleme siyah kalıyordu. HLS'te hep Kick'in kendi
 * oynatıcısı (iframe) kullanılır.
 */
export function canPlayDirectly(url: string): boolean {
  return !/\.m3u8(\?|$)/i.test(url);
}

export default function ProfileDashboard({ onToast, streamLive, bolum }: Props) {
  const goster = (b: DashboardBolumu) => !bolum || bolum === b;
  const [data, setData] = useState<DashboardSnapshot | null>(null);
  const [err, setErr] = useState("");
  const [botEnabled, setBotEnabled] = useState(false);
  const [chatConnected, setChatConnected] = useState(false);
  const [kickSlug, setKickSlug] = useState("");
  // Store'da: izleyici ve canlı durumu panelin başka yerlerinden de okunabilsin
  const liveStatus = useAxthrowaStore((s) => s.kick);
  const setLiveStatus = (kick: KickLiveStatus) => useAxthrowaStore.setState({ kick });
  const announcedSession = useRef<string | null>(null);
  const liveSessionId = useRef<string | null>(null);

  const [remoteUser, setRemoteUser] = useState("editor");
  const [remotePass, setRemotePass] = useState("");

  const refresh = useCallback(async () => {
    try {
      setErr("");
      const [snap, bot] = await Promise.all([fetchDashboard(), botApi.botSettings().catch(() => ({}))]);
      setData(snap);
      const botState = bot as Record<string, unknown>;
      setBotEnabled(Number(botState.enabled ?? 1) !== 0);
      let kanal = "";
      let botBagli = false;
      try {
        const d = await (await fetch(`${await axbotBase()}/api/status`, { cache: "no-store" })).json();
        kanal = d?.platforms?.kick?.connected ? String(d.platforms.kick.channel || "") : "";
      } catch {
        /* bot kapalı */
      }
      // Sohbeti bot okuyor: durum da ondan (Rust'un eski Pusher dinleyicisi artık bağlanamıyor)
      botBagli = !!kanal;
      setChatConnected(botBagli);
      setKickSlug(String(kanal || getBotConfig().channelName || "").trim());
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
    const id = setVisibleInterval(() => void refresh(), 10000);
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
    const id = setVisibleInterval(poll, 20_000);
    return () => clearVisibleInterval(id);
  }, [kickSlug]);

  const streamHealthy =
    !!data?.active_session && botEnabled && chatConnected && liveStatus.live;
  const currentViewers = liveStatus.live ? liveStatus.viewers : data?.viewers || 0;
  liveSessionId.current = data?.active_session?.id || null;

  useEffect(() => {
    const sessionId = data?.active_session?.id;
    if (!streamHealthy || !sessionId || announcedSession.current === sessionId) return;
    announcedSession.current = sessionId;
    const text = "Bot, sohbet ve canlı yayın bağlantısı düzgün çalışıyor.";
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
      void botApi.loyaltyTick().catch(() => undefined);
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

  // "genel" artık hazırlık listesi: bu bileşen orada yalnız arka planda çalışır (sayaç, metrik), hata da listede görünür
  if (bolum === "genel" || (!goster("gecmis") && !goster("gelismis"))) return null;

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

      {/* UI-4: "genel" bölümü artık hazırlık listesi (HazirlikListesi); canlı durum, önizleme, sohbet ve olaylar Canlı ekranında */}
      {goster("gecmis") && data && (
        <>
          <section className="studio-card space-y-3">
            <h3 className="font-display text-sm font-semibold text-white">Yayın geçmişi</h3>
            <SessionList sessions={data.sessions} />
          </section>
          <section className="studio-card space-y-3">
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
            <div className="studio-card space-y-3">
              <h3 className="font-display text-sm font-semibold text-white">Yerel SQLite</h3>
              <p className="text-xs text-panel-muted">
                Alert / widget seed, sohbetBot yeniden import, Discord test.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="studio-btn-ghost"
                  onClick={() =>
                    void botApi.seedAlerts().then(() => onToast("Alert tipleri seed"))
                  }
                >
                  Alert seed
                </button>
                <button
                  type="button"
                  className="studio-btn-ghost"
                  onClick={() =>
                    void botApi.seedWidgets().then(() => onToast("Widget seed"))
                  }
                >
                  Widget seed
                </button>
                <button
                  type="button"
                  className="studio-btn-accent"
                  onClick={() =>
                    void botApi.eskiPaneliAktar(true).then(() => {
                      onToast("sohbetBot → SQLite sync");
                      void refresh();
                    })
                  }
                >
                  Sync sohbetBot
                </button>
                <button
                  type="button"
                  className="studio-btn-ghost"
                  onClick={() =>
                    void botApi.discordTest().then(async (r) => {
                      onToast(r.ok ? "Discord test gönderildi" : "Discord webhook yok/hata");
                    })
                  }
                >
                  Discord test
                </button>
                <button
                  type="button"
                  className="studio-btn-primary"
                  onClick={() =>
                    void botApi.testAlert({ kind: "follow", user: "TestUser" }).then(() =>
                      onToast("Alert test")
                    )
                  }
                >
                  Test alert
                </button>
              </div>
            </div>
            <div className="studio-card space-y-3">
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
                className="studio-input"
                placeholder="kullanıcı"
                value={remoteUser}
                onChange={(e) => setRemoteUser(e.target.value)}
              />
              <input
                className="studio-input"
                type="password"
                placeholder="şifre (en az 8 karakter)"
                value={remotePass}
                onChange={(e) => setRemotePass(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="studio-btn-primary"
                  onClick={() =>
                    void botApi
                      .remoteSetup(remoteUser.trim(), remotePass)
                      .then(() => onToast("Uzak admin oluşturuldu"))
                      .catch((e) => onToast(String(e.message || e)))
                  }
                >
                  İlk admin kur
                </button>
                <button
                  type="button"
                  className="studio-btn-ghost"
                  onClick={() =>
                    void botApi
                      .remoteLogin(remoteUser.trim(), remotePass)
                      .then((j) => {
                        try {
                          localStorage.setItem(
                            "studio.bot.remoteToken",
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
            <CihazEslestirme onToast={onToast} />
          </section>
        </>
      )}
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
