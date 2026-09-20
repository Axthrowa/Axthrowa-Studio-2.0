/** OAuth callback — Twitch / YouTube / Discord → bot paneli + platform teması */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE } from "../../lib/api";
import { completeDiscordOAuthFromHash } from "../../lib/platformAuth/discordAuth";
import { completeTwitchOAuthFromHash } from "../../lib/platformAuth/twitchWrite";
import { completeYoutubeOAuthFromHash } from "../../lib/platformAuth/youtubeWrite";
import { setActivePlatform, type BotPlatform } from "../../lib/platformTheme";
import { saveBotConfig } from "../../lib/smartBot/store";
import { attachTwitchChannel } from "../../auth/startPlatformLogin";

type Platform = "twitch" | "youtube" | "discord";

async function notifyAuthSuccess(platform: string, username: string) {
  const detail = { type: "auth_success", platform, username };
  window.dispatchEvent(new CustomEvent("yya-auth-success", { detail }));
  try {
    await fetch(`${API_BASE}/api/auth/notify-success`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, username }),
    });
  } catch {
    /* */
  }
}

function enableBotForPlatform(platform: BotPlatform) {
  setActivePlatform(platform);
  saveBotConfig((prev) => ({
    ...prev,
    enabled: true,
    replyToKick: platform === "kick" ? true : prev.replyToKick,
    replyToTwitch: platform === "twitch" ? true : prev.replyToTwitch,
    replyToYoutube: platform === "youtube" ? true : prev.replyToYoutube,
  }));
}

export default function OAuthCallbackPage({ platform }: { platform: Platform }) {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [msg, setMsg] = useState("Bağlanıyor…");

  useEffect(() => {
    const run = async () => {
      try {
        const hash = window.location.hash || "";
        const clientId =
          params.get("client_id") ||
          sessionStorage.getItem(`yya.oauth.${platform}.clientId`) ||
          "";
        if (!clientId) throw new Error("Client ID bulunamadı — /login üzerinden tekrar deneyin");

        if (platform === "twitch") {
          const s = await completeTwitchOAuthFromHash(hash, clientId);
          enableBotForPlatform("twitch");
          await attachTwitchChannel(s.login);
          setMsg(`Twitch bağlandı: ${s.login} — bot kanala eklendi`);
          await notifyAuthSuccess("twitch", s.login || "");
        } else if (platform === "youtube") {
          const s = await completeYoutubeOAuthFromHash(hash, clientId);
          enableBotForPlatform("youtube");
          setMsg(`YouTube bağlandı${s.email ? `: ${s.email}` : ""} — bot aktif`);
          await notifyAuthSuccess("youtube", s.email || "");
        } else {
          const s = await completeDiscordOAuthFromHash(hash, clientId);
          enableBotForPlatform("discord");
          setMsg(`Discord bağlandı: ${s.username} — bot aktif`);
          await notifyAuthSuccess("discord", s.username || "");
        }
        window.setTimeout(() => nav("/panel?nav=bot", { replace: true }), 900);
      } catch (e) {
        setMsg(String((e as Error).message || e));
      }
    };
    void run();
  }, [nav, params, platform]);

  const label =
    platform === "twitch" ? "Twitch" : platform === "youtube" ? "YouTube" : "Discord";

  return (
    <div className="grid min-h-screen place-items-center bg-[#0c0d10] text-white">
      <div className="max-w-md rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-center backdrop-blur-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-400/90">
          {label} · Bot bağlantısı
        </p>
        <p className="mt-3 text-[13px] text-white/85">{msg}</p>
      </div>
    </div>
  );
}
