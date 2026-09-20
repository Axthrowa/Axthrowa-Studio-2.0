/**
 * Botaxt Studio paneli — enterprise sidebar shell + mevcut sekme içeriği.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../lib/api";
import { bindBotToKickChannel, kickAuthBody, postKickJson } from "../../lib/kickAuth";
import { botaxtApi } from "../../lib/api/botaxt";
import { openExternal } from "../../lib/openExternal";
import {
  hydrateBotConfigFromServer,
  resetKickAuthWarn,
  saveBotConfig,
  subscribeBotConfig,
} from "../../lib/smartBot";
import { emitWidgetEvent } from "../../lib/smartBot/events";
import type { BotConfigV2 } from "../../lib/smartBot/v2";
import IntegrationsTab from "./botTabs/IntegrationsTab";
import InteractionTab from "./botTabs/InteractionTab";
import { ProfileTab, SubusersTab, ReferralsTab } from "./botTabs/ProfileTab";
import { Btn, Field, Header, Stat } from "./botTabs/ui";
import StatusDot from "../ui/StatusDot";
import StudioShell, { type StudioNavId } from "../studio/StudioShell";
import StudioAlertsPanel from "../studio/StudioAlertsPanel";
import StudioWidgetsPanel from "../studio/StudioWidgetsPanel";
import BotPanel from "../studio/BotPanel";
import { setRustKickChatActive } from "../../lib/rustKickGate";
import StudioLoyaltyPanel from "../studio/StudioLoyaltyPanel";
import StudioMinigamesPanel from "../studio/StudioMinigamesPanel";
import StudioShopPanel from "../studio/StudioShopPanel";
import StudioModerationPanel from "../studio/StudioModerationPanel";
import StudioUpdaterPanel from "../studio/StudioUpdaterPanel";

type SettingsSub =
  | "general"
  | "profile"
  | "kick"
  | "interact"
  | "subusers"
  | "referrals"
  | "moderation"
  | "updates";

type Props = { onToast: (msg: string) => void };

export default function SmartBotPanel({ onToast }: Props) {
  const [cfg, setCfg] = useState<BotConfigV2 | null>(null);
  const [nav, setNav] = useState<StudioNavId>("dashboard");
  const [settingsSub, setSettingsSub] = useState<SettingsSub>("general");
  const [kickStatus, setKickStatus] = useState<{
    connected?: boolean;
    username?: string;
    sendAs?: string;
    broadcasterSlug?: string;
  }>({});
  const [kickChat, setKickChat] = useState<{
    connected?: boolean;
    connecting?: boolean;
    username?: string | null;
    chatroomId?: number | null;
    lastError?: string | null;
  }>({});
  const [kickUserInput, setKickUserInput] = useState("");
  const [kickBusy, setKickBusy] = useState(false);
  const [botSession, setBotSession] = useState<{
    ready?: boolean;
    connected?: boolean;
    username?: string;
    hasCookies?: boolean;
    hasXsrf?: boolean;
    chatroomId?: number;
  }>({});

  useEffect(() => {
    void hydrateBotConfigFromServer().then(setCfg);
    return subscribeBotConfig(setCfg);
  }, []);

  // Tepsi "Ayarlar" / ?nav=settings|dashboard
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const n = q.get("nav");
      if (n === "settings") {
        setNav("settings");
        setSettingsSub("general");
      } else if (
        n === "dashboard" ||
        n === "alerts" ||
        n === "widgets" ||
        n === "chatbot" ||
        n === "loyalty" ||
        n === "shop" ||
        n === "minigames" ||
        n === "integrations" ||
        n === "profile" ||
        n === "subusers"
      ) {
        setNav(n);
      }
      if (q.get("remote") === "1") {
        setNav("dashboard");
      }
    } catch {
      /* */
    }
  }, []);

  const refreshKick = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/kick/oauth/status`);
      const j = await r.json();
      setKickStatus(j || {});
    } catch {
      setKickStatus({});
    }
  }, []);

  const refreshBotSession = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/kick/bot-session/status`);
      const j = await r.json();
      setBotSession(j || {});
    } catch {
      setBotSession({});
    }
  }, []);

  useEffect(() => {
    if (nav === "chatbot" || nav === "integrations" || settingsSub === "kick") {
      void refreshKick();
    }
  }, [nav, settingsSub, refreshKick]);

  useEffect(() => {
    setRustKickChatActive(!!kickChat.connected || !!kickChat.connecting);
  }, [kickChat.connected, kickChat.connecting]);

  useEffect(() => {
    void refreshBotSession();
    const t = window.setInterval(() => void refreshBotSession(), 10000);
    return () => window.clearInterval(t);
  }, [refreshBotSession]);

  const openKickBotLogin = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_kick_login_in_browser");
      onToast(
        "Özel Edge açıldı — o pencerede bot hesabıyla giriş yapın, sonra «Çerezleri Yakala»"
      );
      window.setTimeout(() => void refreshBotSession(), 2500);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : e && typeof e === "object" && "message" in e
              ? String((e as { message: unknown }).message)
              : "Kick giriş penceresi açılamadı";
      onToast(msg || "Kick giriş penceresi açılamadı");
    }
  };

  const harvestKickCookies = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      // Önce Edge CDP (WebView şart değil)
      let j = (await invoke("import_kick_session_from_browser")) as Record<string, unknown>;
      if (!j?.ready) {
        try {
          j = (await invoke("harvest_kick_bot_cookies")) as Record<string, unknown>;
        } catch {
          /* CDP sonucu yeterli değilse WebView dene */
        }
      }
      setBotSession((j?.status as Record<string, unknown>) || j || {});
      await refreshBotSession();
      if (j?.ready || (j?.status as { ready?: boolean } | undefined)?.ready) {
        onToast("Kick bot oturumu yakalandı ✓");
        // Kanal sohbeti bağlı değilse bağla
        const slug = (kickUserInput || cfg?.channelName || "").trim();
        if (slug && !kickChat.connected) {
          try {
            await botaxtApi.kickChatConnect(slug);
            await refreshKickChat();
          } catch {
            /* sohbet ayrı adım */
          }
        }
      } else {
        onToast(
          String(
            j?.error ||
              j?.chatError ||
              "Henüz hazır değil — özel Edge’de girişi bitirip tekrar «Çerezleri Yakala»"
          )
        );
      }
    } catch (e) {
      onToast(
        String(
          (e as Error).message ||
            e ||
            "Oturum alınamadı — önce «Kick Botuna Giriş Yap» ile Edge’i açın"
        )
      );
    }
  };

  const testKickBotSend = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/kick/bot-session/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "BotAxT bağlandı ✓" }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || j?.message || `HTTP ${r.status}`);
      onToast("Test mesajı gönderildi");
    } catch (e) {
      onToast(String((e as Error).message || e));
    }
  };

  const refreshKickChat = useCallback(async () => {
    try {
      const j = await botaxtApi.kickChatStatus();
      setKickChat(j || {});
      if (j?.username) {
        setKickUserInput((prev) => prev || String(j.username));
      }
    } catch {
      setKickChat({});
    }
  }, []);

  useEffect(() => {
    void refreshKick();
    void refreshKickChat();
    void botaxtApi.syncSmartbot(true).catch(() => {
      /* SQLite sync opsiyonel */
    });
  }, [refreshKick, refreshKickChat]);

  useEffect(() => {
    if (!cfg) return;
    void botaxtApi
      .putBotSettings({
        enabled: cfg.enabled !== false,
        reply_to_kick: cfg.replyToKick !== false,
        bot_name: cfg.botName || "BotAxT",
      })
      .catch(() => {
        /* */
      });
  }, [cfg?.enabled, cfg?.replyToKick, cfg?.botName]);

  useEffect(() => {
    const onAuth = () => void refreshKick();
    window.addEventListener("yya-auth-success", onAuth);
    return () => window.removeEventListener("yya-auth-success", onAuth);
  }, [refreshKick]);

  useEffect(() => {
    if (nav === "dashboard" || nav === "chatbot" || settingsSub === "kick") {
      void refreshKickChat();
      const t = window.setInterval(() => {
        void refreshKickChat();
      }, 4000);
      return () => window.clearInterval(t);
    }
  }, [nav, settingsSub, refreshKickChat]);

  const patch = useCallback((p: Partial<BotConfigV2>) => {
    setCfg(saveBotConfig((prev) => ({ ...prev, ...p })));
    const body: Record<string, unknown> = {};
    if (typeof p.enabled === "boolean") body.enabled = p.enabled;
    if (typeof p.replyToKick === "boolean") body.reply_to_kick = p.replyToKick;
    if (typeof p.replyToTwitch === "boolean") body.reply_to_twitch = p.replyToTwitch;
    if (typeof p.replyToYoutube === "boolean") body.reply_to_youtube = p.replyToYoutube;
    if (typeof p.replyToOverlay === "boolean") body.reply_to_overlay = p.replyToOverlay;
    if (Object.keys(body).length) {
      void botaxtApi.putBotSettings(body).catch(() => {
        /* Rust bot_settings opsiyonel */
      });
    }
  }, []);

  useEffect(() => {
    if (cfg?.channelName && !kickUserInput) {
      setKickUserInput(cfg.channelName);
    }
  }, [cfg?.channelName, kickUserInput]);

  const connectKickChat = async () => {
    const username = kickUserInput.trim() || cfg?.channelName?.trim() || "";
    if (!username) {
      onToast("Kick kullanıcı adı girin");
      return;
    }
    setKickBusy(true);
    try {
      const j = await botaxtApi.kickChatConnect(username);
      setKickChat(j || {});
      if (j?.username) setKickUserInput(String(j.username));
      patch({ channelName: username });
      if (j?.connected) onToast(`Kick chat bağlı: ${username}`);
      else if (j?.lastError) onToast(`Kick: ${j.lastError}`);
      else onToast("Kick bağlantısı başlatıldı…");
      window.setTimeout(() => void refreshKickChat(), 1500);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Kick bağlanamadı");
    } finally {
      setKickBusy(false);
    }
  };

  const disconnectKickChat = async () => {
    setKickBusy(true);
    try {
      await botaxtApi.kickChatDisconnect();
      setKickChat({ connected: false, username: null });
      onToast("Kick chat bağlantısı kesildi");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Koparma başarısız");
    } finally {
      setKickBusy(false);
    }
  };

  const connectKick = async () => {
    if (!cfg) return;
    const id = (cfg.kickClientId || "").trim();
    const secret = (cfg.kickClientSecret || "").trim();
    if (!id) {
      onToast("Kick Client ID gerekli (Developer UUID)");
      return;
    }
    if (!secret) {
      onToast("Kick Client Secret zorunlu");
      return;
    }
    patch({ kickClientId: id, kickClientSecret: secret });
    try {
      resetKickAuthWarn();
      const { ok, json, raw } = await postKickJson(
        "/api/kick/prepare",
        kickAuthBody(id, secret, kickUserInput || cfg.channelName)
      );
      const bound = await bindBotToKickChannel(kickUserInput || cfg.channelName);
      if (ok) {
        onToast("Kick API kaydedildi — bot kanala bağlandı.");
        void refreshKick();
        return;
      }
      if (bound.ok || botSession.ready || botSession.connected) {
        onToast(
          "Kick bilgileri yerelde kaydedildi. API doğrulaması atlandı — çerez oturumu ile bot çalışır."
        );
        return;
      }
      onToast(String(json.error || json.message || raw || "Kick API kaydedilemedi"));
    } catch {
      const bound = await bindBotToKickChannel(kickUserInput || cfg.channelName);
      if (bound.ok || botSession.ready) {
        onToast("Kick API yanıt vermedi; çerez oturumu ile bot çalışmaya devam eder.");
        return;
      }
      onToast("Kick API kaydedilemedi");
    }
  };

  const authorizeKickAccount = async () => {
    if (!cfg) return;
    const id = (cfg.kickClientId || "").trim();
    const secret = (cfg.kickClientSecret || "").trim();
    if (!id || !secret) {
      onToast("Önce Client ID ve Secret yazın");
      return;
    }
    try {
      resetKickAuthWarn();
      const r = await fetch(`${API_BASE}/api/kick/oauth/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kickAuthBody(id, secret, kickUserInput || cfg.channelName)
        ),
      });
      const raw = await r.text();
      let j: Record<string, unknown> = {};
      try {
        j = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        j = { error: raw };
      }
      if (!r.ok || !j?.url) {
        onToast(String(j?.error || j?.message || raw || "OAuth URL yok"));
        return;
      }
      const url = String(j.url);
      const result = await openExternal(url);
      if (result === "opened")
        onToast("Kick izin penceresi açıldı — bir kez izin verin; tarayıcıda kalmanıza gerek yok.");
      else if (result === "copied") onToast("Adres panoya kopyalandı — tarayıcıya yapıştırın");
      else onToast("Tarayıcı açılamadı");
    } catch {
      onToast("Kick OAuth başlatılamadı");
    }
  };

  const cmdCount = useMemo(() => cfg?.commands.length || 0, [cfg]);

  if (!cfg) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-panel-muted">
        Bot yükleniyor…
      </div>
    );
  }

  return (
    <StudioShell
      active={nav}
      onNavigate={(id) => {
        setNav(id);
        if (id === "settings") setSettingsSub("general");
      }}
      footer={
        <div className="space-y-1 text-[10px] text-panel-muted">
          <p>
            Bot:{" "}
            <span className={cfg.enabled ? "text-panel-accent" : "text-panel-muted"}>
              {cfg.enabled ? "açık" : "kapalı"}
            </span>
          </p>
          <p>
            Kick:{" "}
            {kickChat.connected
              ? kickChat.username || "bağlı"
              : kickChat.connecting
                ? "bağlanıyor…"
                : "bağlı değil"}
          </p>
        </div>
      }
    >
      {nav === "dashboard" && (
        <div className="space-y-8">
        <section className="mx-auto max-w-6xl space-y-4">
          <Header title="Stüdyo özeti" sub="Oturum ve hızlı aksiyonlar · bot için Chatbot sekmesi" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Bot" value={cfg.enabled ? "Açık" : "Kapalı"} />
            <Stat label="Komut" value={String(cmdCount)} />
            <Stat label="Yayın" value={cfg.streamStartedAt ? "Canlı" : "Kapalı"} />
            <Stat
              label="Kick"
              value={
                kickChat.connected
                  ? kickChat.username || "bağlı"
                  : kickChat.connecting
                    ? "…"
                    : "kapalı"
              }
            />
          </div>
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/[0.06] px-4 py-3 text-[13px] text-emerald-100/90">
            Kick bot girişi, !oy / !sr / !katil ve canlı konsol için{" "}
            <button
              type="button"
              className="font-semibold text-emerald-300 underline-offset-2 hover:underline"
              onClick={() => setNav("chatbot")}
            >
              Chatbot
            </button>{" "}
            sekmesine geçin.
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Bot adı" value={cfg.botName} onChange={(v) => patch({ botName: v })} />
            <Field
              label="Kanal"
              value={cfg.channelName}
              onChange={(v) => patch({ channelName: v })}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-panel-muted">
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
              />
              Bot açık
            </label>
            <label className="flex items-center gap-2 text-xs text-panel-muted">
              <input
                type="checkbox"
                checked={cfg.replyToKick}
                onChange={(e) => patch({ replyToKick: e.target.checked })}
              />
              Kick’e yaz
            </label>
            <label className="flex items-center gap-2 text-xs text-panel-muted">
              <input
                type="checkbox"
                checked={cfg.replyToOverlay}
                onChange={(e) => patch({ replyToOverlay: e.target.checked })}
              />
              Overlay’e yaz
            </label>
            <p className="text-[11px] text-panel-muted">
              Yayın: sağ üst <span className="font-semibold text-white/75">MASTER YAYIN KONTROL</span>
            </p>
            <Btn
              onClick={() => {
                void emitWidgetEvent({
                  kind: "test",
                  user: cfg.channelName || "Test",
                  message: "Alert test!",
                });
                onToast("Test alert");
              }}
            >
              Test alert
            </Btn>
          </div>
          {cfg.streamStartedAt ? (
            <p className="text-xs text-panel-accent">
              Canlı · uptime komutları ve canlı-only komutlar aktif
            </p>
          ) : null}
        </section>
        </div>
      )}

      {nav === "alerts" && <StudioAlertsPanel onToast={onToast} />}
      {nav === "widgets" && <StudioWidgetsPanel onToast={onToast} />}
      {nav === "chatbot" && (
        <BotPanel
          onToast={onToast}
          kickChatConnected={!!kickChat.connected}
          kickChatConnecting={!!kickChat.connecting}
          kickOauthConnected={!!kickStatus.connected}
          kickOauthUsername={String(kickStatus.username || "")}
          kickClientId={cfg?.kickClientId || ""}
          kickClientSecret={cfg?.kickClientSecret || ""}
          onKickClientChange={(clientId, clientSecret) =>
            patch({ kickClientId: clientId, kickClientSecret: clientSecret })
          }
          botSessionReady={!!(botSession.ready || botSession.connected)}
          channelName={kickUserInput || cfg?.channelName || ""}
          onKickChatChange={() => void refreshKickChat()}
          onKickOauthChange={() => void refreshKick()}
          onOpenWidgets={() => setNav("widgets")}
        />
      )}
      {nav === "loyalty" && <StudioLoyaltyPanel onToast={onToast} />}
      {nav === "shop" && <StudioShopPanel onToast={onToast} />}
      {nav === "integrations" && (
        <IntegrationsTab cfg={cfg} patch={patch} onToast={onToast} />
      )}
      {nav === "minigames" && <StudioMinigamesPanel onToast={onToast} />}
      {nav === "profile" && <ProfileTab cfg={cfg} patch={patch} onToast={onToast} />}
      {nav === "subusers" && <SubusersTab cfg={cfg} patch={patch} onToast={onToast} />}

      {nav === "settings" && (
        <section className="mx-auto max-w-3xl space-y-4">
          <Header title="Settings" sub="Profil, Kick yazma, moderasyon ve alt kullanıcı." />
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["general", "Genel"],
                ["profile", "Profil"],
                ["kick", "Kick"],
                ["moderation", "Moderasyon"],
                ["updates", "Güncelleme"],
                ["interact", "Etkileşim"],
                ["subusers", "Alt kullanıcı"],
                ["referrals", "Referans"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSettingsSub(id)}
                className={
                  settingsSub === id
                    ? "yya-pill bg-panel-soft text-panel-accent"
                    : "yya-pill text-panel-muted hover:text-white"
                }
              >
                {label}
              </button>
            ))}
          </div>

          {settingsSub === "general" && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Bot adı"
                  value={cfg.botName}
                  onChange={(v) => patch({ botName: v })}
                />
                <Field
                  label="Kanal"
                  value={cfg.channelName}
                  onChange={(v) => patch({ channelName: v })}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-panel-muted">
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) => patch({ enabled: e.target.checked })}
                />
                Bot açık
              </label>
            </div>
          )}
          {settingsSub === "profile" && (
            <ProfileTab cfg={cfg} patch={patch} onToast={onToast} />
          )}
          {settingsSub === "moderation" && (
            <StudioModerationPanel onToast={onToast} />
          )}
          {settingsSub === "updates" && (
            <StudioUpdaterPanel onToast={onToast} />
          )}
          {settingsSub === "interact" && (
            <InteractionTab cfg={cfg} patch={patch} onToast={onToast} />
          )}
          {settingsSub === "subusers" && (
            <SubusersTab cfg={cfg} patch={patch} onToast={onToast} />
          )}
          {settingsSub === "referrals" && (
            <ReferralsTab cfg={cfg} patch={patch} onToast={onToast} />
          )}
          {settingsSub === "kick" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <Header
                  title="Kick API (OAuth) — tüm bot"
                  sub="Yazma · moderasyon · kanal · events · Redirect: http://127.0.0.1:8843/api/kick/oauth/callback · scopes: chat:write channel:read events:subscribe moderation:ban"
                />
                <Field
                  label="Client ID"
                  value={cfg.kickClientId}
                  onChange={(v) => patch({ kickClientId: v })}
                />
                <Field
                  label="Client Secret (zorunlu)"
                  value={cfg.kickClientSecret}
                  onChange={(v) => patch({ kickClientSecret: v })}
                />
                <div className="rounded-xl border border-panel-border/70 bg-panel-elevated/60 px-3 py-2">
                  <StatusDot ok={!!kickStatus.connected} />
                </div>
                <p className="text-[11px] leading-relaxed text-panel-muted">
                  Botrix modeli: tek bot hesabı (BotAxT) + yayın sohbetinde{" "}
                  <code className="font-mono">/mod BotAxT</code>. Client ID + Secret kaydı Kick.com
                  oturumuna bağlı değildir. Siteden çıksanız da bot çalışır. Kick sohbet API’si ~1
                  mesaj/sn; hız limiti modal çıkarmaz, kuyruk bekler.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={() => void connectKick()}>Kick API kaydet</Btn>
                  <Btn tone="ghost" onClick={() => void authorizeKickAccount()}>
                    Kick hesabı (bir kez)
                  </Btn>
                  <Btn tone="ghost" onClick={() => void refreshKick()}>
                    Yenile
                  </Btn>
                  <Btn
                    tone="danger"
                    onClick={() =>
                      void fetch(`${API_BASE}/api/kick/oauth/disconnect`, {
                        method: "POST",
                      }).then(() => refreshKick())
                    }
                  >
                    Kopar
                  </Btn>
                </div>
              </div>

              <div className="space-y-4 border-t border-panel-border/50 pt-4">
                <Header
                  title="Kick sohbet (Pusher)"
                  sub="Botun dinleyeceği Kick kanalı — WebSocket"
                />
                {kickChat.connected ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm font-medium text-emerald-300">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Bağlı — {kickChat.username || "—"}
                      {kickChat.chatroomId != null ? (
                        <span className="text-xs font-normal text-emerald-400/80">
                          · room {kickChat.chatroomId}
                        </span>
                      ) : null}
                    </span>
                    <Btn tone="danger" disabled={kickBusy} onClick={() => void disconnectKickChat()}>
                      Bağlantıyı Kes
                    </Btn>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Field
                      label="Kick Kullanıcı Adı"
                      value={kickUserInput}
                      onChange={setKickUserInput}
                      placeholder="ör. kanaladiniz"
                    />
                    {kickChat.connecting ? (
                      <p className="text-xs text-amber-300/90">Bağlanıyor…</p>
                    ) : null}
                    {kickChat.lastError ? (
                      <p className="text-xs text-red-300/90">{kickChat.lastError}</p>
                    ) : null}
                    <Btn disabled={kickBusy} onClick={() => void connectKickChat()}>
                      {kickBusy ? "Bağlanıyor…" : "Sohbeti bağla"}
                    </Btn>
                  </div>
                )}
              </div>

              <details className="space-y-3 border-t border-panel-border/50 pt-4">
                <summary className="cursor-pointer text-sm font-semibold text-panel-muted">
                  Eski cookie oturumu (kullanılmıyor)
                </summary>
                <p className="text-[11px] text-panel-muted">
                  Mesaj gönderimi yalnızca Kick API ile yapılır.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Btn onClick={() => void openKickBotLogin()}>Edge’de Kick’i aç</Btn>
                  <Btn tone="ghost" onClick={() => void harvestKickCookies()}>
                    Cookie al
                  </Btn>
                  <Btn
                    tone="danger"
                    onClick={() =>
                      void fetch(`${API_BASE}/api/kick/bot-session/disconnect`, {
                        method: "POST",
                      }).then(() => refreshBotSession())
                    }
                  >
                    Cookie sil
                  </Btn>
                </div>
              </details>
            </div>
          )}
        </section>
      )}
    </StudioShell>
  );
}
