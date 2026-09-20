/** Chat bağlantı hub’ı — Kick API · Twitch IRC · YouTube Live Chat */

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../../lib/api";
import { kickPreparePayload } from "../../../lib/kickPrepare";
import { bindBotToKickChannel, postKickJson } from "../../../lib/kickAuth";
import { botaxtApi } from "../../../lib/api/botaxt";
import { openExternal } from "../../../lib/openExternal";
import { resetKickAuthWarn } from "../../../lib/smartBot";
import type { BotConfigV2 } from "../../../lib/smartBot/v2";
import {
  buildTwitchAuthorizeUrl,
  clearTwitchWriteSession,
  twitchRedirectUri,
  twitchWriteStatus,
} from "../../../lib/platformAuth/twitchWrite";
import {
  buildYoutubeAuthorizeUrl,
  clearYoutubeWriteSession,
  youtubeRedirectUri,
  youtubeWriteStatus,
} from "../../../lib/platformAuth/youtubeWrite";
import { Btn, Field, Header } from "./ui";
import StatusDot from "../../ui/StatusDot";
import { startPlatformBotLogin } from "../../../auth/startPlatformLogin";
import { PLATFORM_BRAND, type BotPlatform } from "../../../lib/platformTheme";

type Props = {
  cfg: BotConfigV2;
  patch: (p: Partial<BotConfigV2>) => void;
  onToast: (m: string) => void;
};

type KickHub = {
  connected?: boolean;
  username?: string;
  broadcasterSlug?: string;
  clientId?: string;
  chatListening?: boolean;
  chatUsername?: string;
  chatroomId?: number | null;
};

function StatusPill({ ok }: { ok: boolean; label?: string }) {
  return <StatusDot ok={ok} />;
}

function TipBox({ title, steps }: { title: string; steps: string[] }) {
  return (
    <details className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-white/55">{title}</summary>
      <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-[11px] leading-relaxed text-white/50">
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </details>
  );
}

export default function IntegrationsTab({ cfg, patch, onToast }: Props) {
  const [kick, setKick] = useState<KickHub>({});
  const [kickBusy, setKickBusy] = useState(false);
  const [kickChannel, setKickChannel] = useState(cfg.channelName || "");
  const [twitchSt, setTwitchSt] = useState(twitchWriteStatus());
  const [youtubeSt, setYoutubeSt] = useState(youtubeWriteStatus());
  const [twitchBusy, setTwitchBusy] = useState(false);
  const [ytBusy, setYtBusy] = useState(false);

  const refreshKick = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/kick/hub`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as KickHub;
      setKick(j || {});
      if (j?.broadcasterSlug && !kickChannel) setKickChannel(j.broadcasterSlug);
      else if (j?.username && !kickChannel) setKickChannel(j.username);
    } catch {
      setKick({});
    }
    try {
      const chat = await botaxtApi.kickChatStatus();
      setKick((prev) => ({
        ...prev,
        chatListening: !!chat?.connected,
        chatUsername: chat?.username ? String(chat.username) : prev.chatUsername,
        chatroomId: chat?.chatroomId != null ? Number(chat.chatroomId) : prev.chatroomId,
      }));
    } catch {
      /* */
    }
  }, [kickChannel]);

  const refreshLocal = useCallback(() => {
    setTwitchSt(twitchWriteStatus());
    setYoutubeSt(youtubeWriteStatus());
  }, []);

  useEffect(() => {
    void refreshKick();
    refreshLocal();
    const t = window.setInterval(() => {
      void refreshKick();
      refreshLocal();
    }, 5000);
    return () => window.clearInterval(t);
  }, [refreshKick, refreshLocal]);

  useEffect(() => {
    const onAuth = () => {
      refreshLocal();
      void refreshKick();
    };
    window.addEventListener("yya-auth-success", onAuth);
    return () => window.removeEventListener("yya-auth-success", onAuth);
  }, [refreshKick, refreshLocal]);

  const connectKickApi = async () => {
    const id = (cfg.kickClientId || kick.clientId || "").trim();
    const secret = (cfg.kickClientSecret || "").trim();
    if (!id) {
      onToast("Kick Client ID gerekli");
      return;
    }
    if (!secret) {
      onToast("Kick Client Secret zorunlu");
      return;
    }
    setKickBusy(true);
    try {
      resetKickAuthWarn();
      patch({ kickClientId: id, kickClientSecret: secret });
      const { ok, json, raw } = await postKickJson(
        "/api/kick/prepare",
        kickPreparePayload(id, secret, kickChannel || cfg.channelName)
      );
      const bound = await bindBotToKickChannel(kickChannel || cfg.channelName);
      if (ok) {
        onToast("Kick API kaydedildi — Kick.com çıkışı botu düşürmez.");
        window.setTimeout(() => void refreshKick(), 500);
        window.setTimeout(() => void refreshKick(), 2500);
        return;
      }
      if (bound.ok) {
        onToast(bound.message + " (API doğrulaması atlandı)");
        return;
      }
      onToast(String(json.error || json.message || raw || "Kick API kaydedilemedi"));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Kick API bağlanamadı");
    } finally {
      setKickBusy(false);
    }
  };

  const connectKickChat = async () => {
    const slug = (kickChannel || cfg.channelName || "").trim();
    if (!slug) {
      onToast("Kick kanal adı yazın");
      return;
    }
    setKickBusy(true);
    try {
      const j = await botaxtApi.kickChatConnect(slug);
      patch({ channelName: slug });
      await refreshKick();
      if (j?.connected) onToast(`Kick sohbet dinleniyor: ${slug}`);
      else onToast(String(j?.lastError || "Kick sohbet bağlanıyor…"));
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Kick sohbet bağlanamadı");
    } finally {
      setKickBusy(false);
    }
  };

  const connectTwitch = async () => {
    const id = cfg.twitchClientId.trim();
    if (!id) {
      onToast("Twitch Client ID gerekli");
      return;
    }
    setTwitchBusy(true);
    try {
      sessionStorage.setItem("yya.oauth.twitch.clientId", id);
      const url = buildTwitchAuthorizeUrl(id);
      const result = await openExternal(url);
      if (result === "opened") onToast("Twitch izin penceresi açıldı");
      else if (result === "copied") onToast("Twitch OAuth adresi panoya kopyalandı");
      else onToast("Tarayıcı açılamadı");
    } catch {
      onToast("Twitch OAuth başlatılamadı");
    } finally {
      setTwitchBusy(false);
    }
  };

  const connectYoutube = async () => {
    const id = cfg.youtubeClientId.trim();
    if (!id) {
      onToast("YouTube / Google Client ID gerekli");
      return;
    }
    setYtBusy(true);
    try {
      sessionStorage.setItem("yya.oauth.youtube.clientId", id);
      const url = buildYoutubeAuthorizeUrl(id);
      const result = await openExternal(url);
      if (result === "opened") onToast("Google izin penceresi açıldı");
      else if (result === "copied") onToast("YouTube OAuth adresi panoya kopyalandı");
      else onToast("Tarayıcı açılamadı");
    } catch {
      onToast("YouTube OAuth başlatılamadı");
    } finally {
      setYtBusy(false);
    }
  };

  const kickOk = !!kick.connected;
  const kickChatOk = !!kick.chatListening;
  const twitchOk = !!twitchSt.connected;
  const youtubeOk = !!youtubeSt.connected;

  return (
    <section className="mx-auto max-w-4xl space-y-6">
      <Header
        title="Chat bağlantı hub’ı"
        sub="Botrix modeli: platform OAuth ile giriş → bot o hesabın sohbetine bağlanır"
      />

      <div className="grid gap-2 sm:grid-cols-2">
        {(["kick", "twitch", "youtube", "discord"] as BotPlatform[]).map((id) => {
          const b = PLATFORM_BRAND[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() =>
                void startPlatformBotLogin(id).then((r) => {
                  onToast(r.message);
                  if (r.ok) {
                    window.setTimeout(() => void refreshKick(), 2500);
                    setTwitchSt(twitchWriteStatus());
                    setYoutubeSt(youtubeWriteStatus());
                  }
                })
              }
              className="flex h-10 items-center justify-center rounded-lg text-[13px] font-semibold transition-[filter] hover:brightness-110"
              style={{ background: b.color, color: b.ink }}
            >
              {b.label} ile bağla
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-[#101417] p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/50">Kick</p>
          <p className="mt-2 text-sm font-bold text-white">
            {kickOk ? (kick.username ? `@${kick.username}` : "API bağlı") : "API yok"}
          </p>
          <p className="mt-1 text-xs text-white/50">{kickChatOk ? "Sohbet dinleniyor" : "Sohbet kapalı"}</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#101417] p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/50">Twitch</p>
          <p className="mt-2 text-sm font-bold text-white">
            {twitchOk ? (twitchSt.login ? `@${twitchSt.login}` : "Yazma bağlı") : "Bağlı değil"}
          </p>
          <p className="mt-1 text-xs text-white/50">IRC chat:write</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#101417] p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/50">YouTube</p>
          <p className="mt-2 text-sm font-bold text-white">
            {youtubeOk ? youtubeSt.email || "Yazma bağlı" : "Bağlı değil"}
          </p>
          <p className="mt-1 text-xs text-white/50">Live Chat API</p>
        </div>
      </div>

      {/* KICK */}
      <div className="space-y-4 rounded-2xl border border-teal-400/20 bg-[#0d1214] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-teal-300">Kick</h3>
            <p className="mt-1 text-sm text-white/50">
              Resmi API ile yazma + moderasyon. Sohbet dinleme OAuth sonrası otomatik / manuel bağlanır.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill ok={kickOk} label={kickOk ? "API bağlı" : "API bekliyor"} />
            <StatusPill ok={kickChatOk} label={kickChatOk ? "Dinleniyor" : "Dinlemiyor"} />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Kick Client ID"
            value={cfg.kickClientId}
            onChange={(v) => patch({ kickClientId: v })}
            placeholder="kick.com/settings/developer"
          />
          <Field
            label="Client Secret (zorunlu)"
            value={cfg.kickClientSecret}
            onChange={(v) => patch({ kickClientSecret: v })}
            type="password"
          />
        </div>
        <Field
          label="Kick kanal adı (sohbet dinleme)"
          value={kickChannel}
          onChange={setKickChannel}
          placeholder="ör. kanaladiniz"
        />

        <div className="flex flex-wrap gap-2">
          <Btn disabled={kickBusy} onClick={() => void connectKickApi()}>
            {kickBusy ? "…" : kickOk ? "Kick API yeniden bağla" : "Kick API bağla"}
          </Btn>
          <Btn tone="ghost" disabled={kickBusy} onClick={() => void connectKickChat()}>
            Sohbeti bağla
          </Btn>
          <Btn tone="ghost" onClick={() => void refreshKick()}>
            Yenile
          </Btn>
          {kickOk ? (
            <Btn
              tone="danger"
              onClick={() =>
                void fetch(`${API_BASE}/api/kick/oauth/disconnect`, { method: "POST" }).then(() =>
                  refreshKick()
                )
              }
            >
              API kopar
            </Btn>
          ) : null}
          {kickChatOk ? (
            <Btn
              tone="danger"
              onClick={() =>
                void botaxtApi.kickChatDisconnect().then(() => refreshKick())
              }
            >
              Sohbeti kes
            </Btn>
          ) : null}
        </div>

        <TipBox
          title="Kick nasıl bağlanır?"
          steps={[
            "kick.com → Ayarlar → Developer → uygulama oluştur.",
            `Redirect URI ekle: http://127.0.0.1:8843/api/kick/oauth/callback`,
            "İzinler: chat:write, channel:read, events:subscribe, moderation:ban.",
            "Client ID’yi buraya yapıştır → «Kick API bağla» → tarayıcıda izin ver.",
            "Kanal adını yazıp «Sohbeti bağla» (veya OAuth sonrası otomatik dinleme).",
            "Bot yanıtları için Chat Bot’ta «Kick’e yaz» açık olsun.",
            "Opsiyonel webhook (follow/sub): Developer’da Webhook URL = https://SIZIN-HOST/api/kick/webhook (localhost olmaz).",
          ]}
        />
      </div>

      {/* TWITCH */}
      <div className="space-y-4 rounded-2xl border border-[#9146ff]/35 bg-[#120f18] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-[#c4a0ff]">Twitch</h3>
            <p className="mt-1 text-sm text-white/50">
              Bot yanıtları IRC üzerinden (chat:write). Sohbet okuma panel Chat ayarındaki kanaldan gelir.
            </p>
          </div>
          <StatusPill
            ok={twitchOk}
            label={twitchOk ? `Yazma · @${twitchSt.login || "?"}` : "Yazma yok"}
          />
        </div>

        <Field
          label="Twitch Client ID"
          value={cfg.twitchClientId}
          onChange={(v) => patch({ twitchClientId: v })}
          placeholder="dev.twitch.tv Console"
        />

        <div className="flex flex-wrap gap-2">
          <Btn disabled={twitchBusy} onClick={() => void connectTwitch()}>
            {twitchBusy ? "…" : twitchOk ? "Twitch yeniden bağla" : "Twitch bağla"}
          </Btn>
          <Btn tone="ghost" onClick={refreshLocal}>
            Yenile
          </Btn>
          {twitchOk ? (
            <Btn
              tone="danger"
              onClick={() => {
                clearTwitchWriteSession();
                refreshLocal();
                onToast("Twitch yazma oturumu silindi");
              }}
            >
              Kopar
            </Btn>
          ) : null}
        </div>

        <TipBox
          title="Twitch nasıl bağlanır?"
          steps={[
            "dev.twitch.tv → Console → uygulama oluştur (Category: Chat Bot).",
            `OAuth Redirect URL: ${twitchRedirectUri()}`,
            "Client ID’yi kopyala → buraya yapıştır.",
            "«Twitch bağla» → tarayıcıda bot hesabıyla giriş / izin ver (chat:read chat:write).",
            "Sohbeti dinlemek için ana Panel → Chat ayarlarında Twitch kanal adını aç (anonim IRC okuma).",
            "Botun yazması için bu hub’daki OAuth zorunlu; sadece dinlemek Client ID istemez.",
            "Chat Bot’ta «Twitch’e yaz» işaretli olsun.",
          ]}
        />
      </div>

      {/* YOUTUBE */}
      <div className="space-y-4 rounded-2xl border border-red-500/30 bg-[#160e0e] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-red-300">YouTube</h3>
            <p className="mt-1 text-sm text-white/50">
              Canlı sohbete yazma Google OAuth ile. Dinleme için kanal veya video ID Panel Chat’ten gelir.
            </p>
          </div>
          <StatusPill
            ok={youtubeOk}
            label={youtubeOk ? youtubeSt.email || "Yazma bağlı" : "Yazma yok"}
          />
        </div>

        <Field
          label="Google OAuth Client ID"
          value={cfg.youtubeClientId}
          onChange={(v) => patch({ youtubeClientId: v })}
          placeholder="console.cloud.google.com → OAuth 2.0 Client"
        />

        <div className="flex flex-wrap gap-2">
          <Btn disabled={ytBusy} onClick={() => void connectYoutube()}>
            {ytBusy ? "…" : youtubeOk ? "YouTube yeniden bağla" : "YouTube bağla"}
          </Btn>
          <Btn tone="ghost" onClick={refreshLocal}>
            Yenile
          </Btn>
          {youtubeOk ? (
            <Btn
              tone="danger"
              onClick={() => {
                clearYoutubeWriteSession();
                refreshLocal();
                onToast("YouTube yazma oturumu silindi");
              }}
            >
              Kopar
            </Btn>
          ) : null}
        </div>

        <TipBox
          title="YouTube nasıl bağlanır?"
          steps={[
            "Google Cloud Console → proje oluştur → YouTube Data API v3’ü etkinleştir.",
            "Kimlik bilgileri → OAuth 2.0 İstemci Kimliği (Web uygulaması).",
            `Yetkili yönlendirme URI: ${youtubeRedirectUri()}`,
            "Client ID’yi buraya yapıştır → «YouTube bağla» → Google hesabıyla izin ver.",
            "Scope: youtube.force-ssl (canlı chat mesajı göndermek için).",
            "Sohbeti dinlemek: ana Panel → Chat → YouTube kanal adı veya canlı video ID.",
            "Yayın canlı olmalı; aksi halde liveChatId bulunamaz / yazma başarısız olur.",
            "Chat Bot’ta «YouTube’a yaz» açık olsun.",
          ]}
        />
      </div>

      <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-xs leading-relaxed text-amber-100/75">
        <strong className="font-semibold text-amber-200">Not:</strong> Kick API bağlantısı Chat Bot
        sekmesinden de yapılabilir. Bu hub üç platformu tek yerde toplar. Discord go-live için Settings
        → veya aşağıdaki eski Discord kartını kullanın.
      </div>

      <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-[#101417] p-5">
        <h3 className="font-bold text-white">Discord (OAuth + go-live)</h3>
        <Field
          label="Discord Client ID (Login /oauth/discord)"
          value={cfg.discordClientId || ""}
          onChange={(v) => patch({ discordClientId: v })}
          placeholder="Developer Portal → OAuth2 → Client ID"
        />
        <p className="text-[11px] text-white/50">
          Redirect URI: <code className="text-teal-400/80">http://127.0.0.1:8843/oauth/discord</code>
          {" · "}
          <a href="/login" className="text-teal-400 hover:underline">
            /login
          </a>{" "}
          ekranından «Discord ile giriş»
        </p>
        <Field
          label="Webhook URL"
          value={cfg.discord?.webhookUrl || cfg.discordWebhook || ""}
          onChange={(v) =>
            patch({
              discord: { ...(cfg.discord || { enabled: false, webhookUrl: "", goLiveMessage: "" }), webhookUrl: v },
              discordWebhook: v,
            })
          }
        />
        <Btn
          tone="ghost"
          onClick={async () => {
            const hook = cfg.discord?.webhookUrl || cfg.discordWebhook;
            if (!hook) {
              onToast("Webhook yok");
              return;
            }
            const content = (cfg.discord?.goLiveMessage || "Canlıyız!")
              .replace(/\$\(channel\)/gi, cfg.channelName || "Kanal")
              .replace(/\$\(title\)/gi, cfg.title || "Yayın");
            try {
              await fetch(hook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content }),
              });
              onToast("Discord test gönderildi");
            } catch {
              onToast("Discord gönderilemedi");
            }
          }}
        >
          Discord test
        </Btn>
      </div>
    </section>
  );
}
