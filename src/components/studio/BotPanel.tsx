import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  LogIn,
  Radio,
  RefreshCw,
  Send,
  Terminal,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { API_BASE } from "../../lib/api";
import { kickPreparePayload } from "../../lib/kickPrepare";
import { bindBotToKickChannel, kickAuthBody, postKickJson } from "../../lib/kickAuth";
import { botaxtApi } from "../../lib/api/botaxt";
import { cn } from "../../lib/cn";
import { MessageFormatter } from "../../lib/emotes/parseEmotes";
import { openExternal } from "../../lib/openExternal";
import { overlaySyncWsUrl } from "../../lib/widgets/useWidgetSync";
import { SettingsRow } from "../ui/SettingsGroup";
import StatusDot from "../ui/StatusDot";
import BotrixTabs, { type BotrixTab, GlowToggle } from "./botChat/BotrixTabs";
import { setActivePlatform } from "../../lib/platformTheme";
import { Link } from "react-router-dom";

type ConsoleLine = { t?: number; kind?: string; platform?: string; user?: string; text?: string };
type KickBotSessionStatus = {
  ready?: boolean;
  connected?: boolean;
  hasCookies?: boolean;
  hasXsrf?: boolean;
  hasBearer?: boolean;
  username?: string;
  chatroomId?: number;
  channelSlug?: string;
  sessionLost?: boolean;
  lostReason?: string;
};
type Props = {
  onToast: (message: string) => void;
  kickChatConnected?: boolean;
  kickChatConnecting?: boolean;
  kickOauthConnected?: boolean;
  kickOauthUsername?: string;
  kickClientId?: string;
  kickClientSecret?: string;
  onKickClientChange?: (clientId: string, clientSecret: string) => void;
  botSessionReady?: boolean;
  channelName?: string;
  onKickChatChange?: () => void;
  onOpenWidgets?: () => void;
  onKickOauthChange?: () => void;
};
type MainTab = BotrixTab | "name" | "console";
type Obj = Record<string, unknown>;

const TABS: { id: MainTab; label: string }[] = [
  { id: "name", label: "Bot" },
  { id: "moderation", label: "Moderasyon" },
  { id: "commands", label: "Komutlar" },
  { id: "timers", label: "Zamanlayıcılar" },
  { id: "extras", label: "Ekstralar" },
  { id: "console", label: "Konsol" },
];

function truthy(v: unknown) {
  return v === true || v === 1 || v === "1";
}
function parseObject(v: unknown): Obj {
  if (v && typeof v === "object") return v as Obj;
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
function invokeError(e: unknown, fallback: string) {
  if (e instanceof Error && e.message.trim()) return e.message;
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const value = e as Obj;
    for (const key of ["message", "error", "msg", "reason"]) {
      if (typeof value[key] === "string" && String(value[key]).trim()) return String(value[key]);
    }
  }
  return fallback;
}

export default function BotPanel({
  onToast,
  kickChatConnected,
  kickChatConnecting,
  kickOauthConnected,
  kickOauthUsername,
  kickClientId = "",
  kickClientSecret = "",
  onKickClientChange,
  channelName,
  onKickChatChange,
  onKickOauthChange,
}: Props) {
  const [tab, setTab] = useState<MainTab>("name");
  const [lines, setLines] = useState<ConsoleLine[]>([]);
  const [wsOk, setWsOk] = useState(false);
  const [settings, setSettings] = useState<Obj>({ enabled: true, bot_name: "BotAxT" });
  const [extras, setExtras] = useState<Obj>({});
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [botSession, setBotSession] = useState<KickBotSessionStatus>({});
  const [sessionLost, setSessionLost] = useState(false);
  const [lostReason, setLostReason] = useState("");
  const [oauthLocal, setOauthLocal] = useState(!!kickOauthConnected);
  const [oauthUser, setOauthUser] = useState(kickOauthUsername || "");
  const [clientIdDraft, setClientIdDraft] = useState(kickClientId);
  const [clientSecretDraft, setClientSecretDraft] = useState(kickClientSecret);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [cookiePaste, setCookiePaste] = useState("");
  const [pasteBusy, setPasteBusy] = useState(false);
  const [testMsg, setTestMsg] = useState("BotAxT test ✓");
  const [testBusy, setTestBusy] = useState(false);
  const [channelInput, setChannelInput] = useState(channelName || "");
  const [chatBusy, setChatBusy] = useState(false);
  const [localChatConnected, setLocalChatConnected] = useState(!!kickChatConnected);
  const [localChatConnecting, setLocalChatConnecting] = useState(!!kickChatConnecting);
  const [botNameDraft, setBotNameDraft] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const connectionRef = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const harvestLock = useRef(false);
  const xsrfRetryAt = useRef(0);

  useEffect(() => {
    setOauthLocal(!!kickOauthConnected);
  }, [kickOauthConnected]);
  useEffect(() => {
    if (oauthLocal) setActivePlatform("kick");
  }, [oauthLocal]);
  useEffect(() => {
    if (kickOauthUsername) setOauthUser(kickOauthUsername);
  }, [kickOauthUsername]);
  useEffect(() => {
    setClientIdDraft(kickClientId);
  }, [kickClientId]);
  useEffect(() => {
    setClientSecretDraft(kickClientSecret);
  }, [kickClientSecret]);

  useEffect(() => {
    setLocalChatConnected(!!kickChatConnected);
  }, [kickChatConnected]);
  useEffect(() => {
    setLocalChatConnecting(!!kickChatConnecting);
  }, [kickChatConnecting]);
  useEffect(() => {
    if (channelName && !channelInput) setChannelInput(channelName);
  }, [channelName, channelInput]);

  const botEnabled = truthy(settings.enabled);
  const botName = String(settings.bot_name || oauthUser || botSession.username || "BotAxT").replace(/^@/, "");
  const cookieReady = Boolean(botSession.ready || botSession.connected || (botSession.hasCookies && botSession.hasBearer));
  const apiReady = oauthLocal || cookieReady || !!kickOauthConnected;
  const chatroomId = Number(botSession.chatroomId) || 0;
  const chatListening = localChatConnected;
  const needsChatroom = apiReady && (!chatListening || chatroomId <= 0);

  useEffect(() => {
    setBotNameDraft(botName);
  }, [botName]);

  const refreshOauth = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/kick/hub`, { cache: "no-store" });
      const j = (await r.json().catch(() => ({}))) as Obj;
      setOauthLocal(!!j.connected || !!j.botReady);
      if (typeof j.username === "string" && j.username) setOauthUser(j.username);
      const slug =
        (typeof j.broadcasterSlug === "string" && j.broadcasterSlug) ||
        (typeof j.username === "string" && j.username) ||
        "";
      if (slug && !channelInput) setChannelInput(slug);
      if (typeof j.clientId === "string" && j.clientId && !clientIdDraft) {
        setClientIdDraft(j.clientId);
      }
      const chat = parseObject(j.chat);
      if (chat.connected) {
        setLocalChatConnected(true);
        if (typeof chat.username === "string" && chat.username) {
          setChannelInput((prev) => prev || chat.username as string);
        }
      }
      onKickOauthChange?.();
    } catch {
      /* optional */
    }
  }, [channelInput, clientIdDraft, onKickOauthChange]);

  const connectKickApi = useCallback(async () => {
    const id = clientIdDraft.trim();
    const secret = clientSecretDraft.trim();
    if (!id) {
      onToast("Kick Developer Client ID gerekli (kick.com → Developer)");
      return;
    }
    if (!secret) {
      onToast("Kick Client Secret zorunlu — Developer uygulamasından kopyalayın");
      return;
    }
    setOauthBusy(true);
    try {
      onKickClientChange?.(id, secret);
      const { ok, json, raw } = await postKickJson(
        "/api/kick/prepare",
        kickPreparePayload(id, secret, channelInput.trim() || channelName)
      );
      const bound = await bindBotToKickChannel(channelInput.trim() || channelName);
      if (ok) {
        setOauthLocal(true);
        if (typeof json.username === "string" && json.username) setOauthUser(json.username);
        onKickOauthChange?.();
        onToast("Kick API kaydedildi — Kick.com’dan çıksanız da token durur, her açılışta yenilenir.");
        window.setTimeout(() => void refreshOauth(), 800);
        return;
      }
      if (bound.ok) {
        onToast(bound.message + " — API doğrulaması atlandı, bot çerez ile çalışır.");
        return;
      }
      onToast(String(json.error || json.message || raw || "Kick API kaydedilemedi"));
      window.setTimeout(() => void refreshOauth(), 800);
    } catch (e) {
      onToast(invokeError(e, "Kick API bağlanamadı"));
    } finally {
      setOauthBusy(false);
    }
  }, [
    clientIdDraft,
    clientSecretDraft,
    channelInput,
    channelName,
    onKickClientChange,
    onKickOauthChange,
    onToast,
    refreshOauth,
  ]);

  const authorizeKickAccount = useCallback(async () => {
    const id = clientIdDraft.trim();
    const secret = clientSecretDraft.trim();
    if (!id || !secret) {
      onToast("Önce Client ID ve Secret yazın");
      return;
    }
    setOauthBusy(true);
    try {
      onKickClientChange?.(id, secret);
      const r = await fetch(`${API_BASE}/api/kick/oauth/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kickAuthBody(id, secret, channelInput.trim() || channelName)
        ),
      });
      const raw = await r.text();
      let j: Obj = {};
      try {
        j = JSON.parse(raw) as Obj;
      } catch {
        j = { error: raw };
      }
      if (!r.ok || !j.url) {
        onToast(String(j.error || j.message || raw || "Kick OAuth başlatılamadı"));
        return;
      }
      const url = String(j.url);
      const result = await openExternal(url);
      if (result === "opened") {
        onToast("Kick izin penceresi açıldı — bir kez izin verin; sonra tarayıcıda kalmanıza gerek yok.");
      } else if (result === "copied") {
        onToast("Tarayıcı engellendi — OAuth adresi panoya kopyalandı");
      } else {
        onToast(`Tarayıcı açılamadı. Adresi elle açın: ${url.slice(0, 80)}…`);
      }
      window.setTimeout(() => void refreshOauth(), 2500);
      window.setTimeout(() => void refreshOauth(), 8000);
      window.setTimeout(() => void refreshOauth(), 20000);
    } catch (e) {
      onToast(invokeError(e, "Kick OAuth başlatılamadı"));
    } finally {
      setOauthBusy(false);
    }
  }, [
    clientIdDraft,
    clientSecretDraft,
    channelInput,
    channelName,
    onKickClientChange,
    onToast,
    refreshOauth,
  ]);

  const disconnectKickApi = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/api/kick/oauth/disconnect`, { method: "POST" });
      setOauthLocal(false);
      setOauthUser("");
      onKickOauthChange?.();
      onToast("Kick API bağlantısı kesildi");
    } catch (e) {
      onToast(invokeError(e, "Koparma başarısız"));
    }
  }, [onKickOauthChange, onToast]);


  const saveBotName = useCallback(async () => {
    const next = botNameDraft.trim().replace(/^@/, "");
    if (!next) {
      onToast("Bot adı boş olamaz");
      return;
    }
    setNameBusy(true);
    try {
      const body = { ...settings, bot_name: next };
      await botaxtApi.putBotSettings({ bot_name: next });
      setSettings((old) => ({ ...old, bot_name: next }));
      onToast(`Bot adı güncellendi: @${next}`);
    } catch (e) {
      onToast(invokeError(e, "Bot adı kaydedilemedi"));
    } finally {
      setNameBusy(false);
    }
  }, [botNameDraft, onToast]);

  const refreshChatStatus = useCallback(async () => {
    try {
      const j = await botaxtApi.kickChatStatus();
      setLocalChatConnected(!!j?.connected);
      setLocalChatConnecting(!!j?.connecting);
      if (j?.username) setChannelInput((prev) => prev || String(j.username));
      if (j?.chatroomId && Number(j.chatroomId) > 0) {
        setBotSession((prev) => ({
          ...prev,
          chatroomId: Number(j.chatroomId),
          channelSlug: String(j.username || prev.channelSlug || ""),
        }));
      }
      onKickChatChange?.();
    } catch {
      /* optional */
    }
  }, [onKickChatChange]);

  const loadSettings = useCallback(async () => {
    try {
      const next = await botaxtApi.botSettings();
      setSettings(next);
      setExtras(parseObject(next.extras_json ?? next.extras));
    } catch (e) {
      onToast(invokeError(e, "Bot ayarları yüklenemedi"));
    }
  }, [onToast]);

  const saveExtras = useCallback(async (next: Obj) => {
    await botaxtApi.putBotSettings({ extras_json: JSON.stringify(next) });
    setExtras(next);
  }, []);

  const toggleMaster = async (value: boolean) => {
    setSettingsBusy(true);
    setSettings((old) => ({ ...old, enabled: value }));
    try {
      await botaxtApi.putBotSettings({ enabled: value });
      onToast(`Chat Bot ${value ? "açıldı" : "kapatıldı"}`);
    } catch (e) {
      onToast(invokeError(e, "Bot durumu kaydedilemedi"));
      void loadSettings();
    } finally {
      setSettingsBusy(false);
    }
  };

  const refreshBotSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/kick/bot-session/status`, { cache: "no-store" });
      const next = (await response.json()) as KickBotSessionStatus;
      setBotSession(next || {});
      const linked =
        !!(next?.ready || next?.connected || next?.hasCookies) ||
        oauthLocal ||
        !!kickOauthConnected;
      if (next?.sessionLost && !linked) {
        setSessionLost(true);
        setLostReason(String(next.lostReason || "Kick oturumu geçersiz"));
      } else if (linked) {
        setSessionLost(false);
        setLostReason("");
      }
      // Çerez var ama XSRF yok → otomatik tamamla (en fazla ~15 sn’de bir)
      if (
        !oauthLocal &&
        !kickOauthConnected &&
        next?.hasCookies &&
        !next?.hasXsrf &&
        !next?.ready
      ) {
        const now = Date.now();
        if (now - xsrfRetryAt.current > 15000) {
          xsrfRetryAt.current = now;
          try {
            const r = await fetch(`${API_BASE}/api/kick/bot-session/refresh-xsrf`, {
              method: "POST",
            });
            if (r.ok) {
              const fixed = (await r.json()) as KickBotSessionStatus;
              setBotSession(fixed || next);
              if (fixed?.ready) {
                onToast("Kick XSRF tamamlandı — bot oturumu hazır ✓");
                void refreshChatStatus();
              }
            }
          } catch {
            /* sonraki poll dener */
          }
        }
      }
    } catch {
      /* poll hatası oturumu silmesin — titreme kaynağı */
    }
  }, [onToast, refreshChatStatus, oauthLocal, kickOauthConnected]);

  const connectChannelChat = useCallback(
    async (slugHint?: string) => {
      const username =
        (slugHint || channelInput || channelName || botSession.channelSlug || "").trim();
      if (!username) {
        onToast("Kick kanal adını girin (yayın yaptığınız kanal)");
        return false;
      }
      setChatBusy(true);
      setLocalChatConnecting(true);
      try {
        const j = await botaxtApi.kickChatConnect(username);
        setLocalChatConnected(!!j?.connected);
        setLocalChatConnecting(!!j?.connecting);
        if (j?.username) setChannelInput(String(j.username));
        await refreshBotSession();
        await refreshChatStatus();
        if (j?.connected) {
          onToast(`Kick sohbet dinleniyor: ${username}`);
          return true;
        }
        if (j?.lastError) {
          onToast(`Kick sohbet: ${j.lastError}`);
          return false;
        }
        onToast("Kick sohbet bağlantısı başlatıldı…");
        window.setTimeout(() => void refreshChatStatus(), 1500);
        return true;
      } catch (e) {
        onToast(invokeError(e, "Kick sohbet bağlanamadı"));
        return false;
      } finally {
        setChatBusy(false);
      }
    },
    [
      botSession.channelSlug,
      channelInput,
      channelName,
      onToast,
      refreshBotSession,
      refreshChatStatus,
    ]
  );

  const applySessionImportResult = useCallback(
    async (result: Obj, okToast: string) => {
      await refreshBotSession();
      await refreshChatStatus();
      const ready = Boolean(result.ready || parseObject(result.status).ready);
      if (!ready) {
        onToast(
          String(
            result.error ||
              "Henüz hazır değil — Edge’de Kick girişini tamamlayıp tekrar deneyin"
          )
        );
        return;
      }
      if (result.chatConnected || result.chatConnecting) {
        setLocalChatConnected(!!result.chatConnected);
        setLocalChatConnecting(!!result.chatConnecting);
        onToast(
          result.browserClosed
            ? "Oturum alındı — Edge kapatıldı, sohbet bağlandı ✓"
            : okToast
        );
        window.setTimeout(() => void refreshChatStatus(), 1200);
        return;
      }
      if (result.needsChannel) {
        onToast("Oturum alındı — aşağıya Kick kanal adını yazıp «Sohbeti bağla»ya basın");
        return;
      }
      const slug = String(
        result.channelSlug || channelInput || channelName || botSession.channelSlug || ""
      ).trim();
      if (slug) {
        onToast("Oturum alındı — sohbet bağlanıyor…");
        await connectChannelChat(slug);
        return;
      }
      onToast("Oturum alındı — Kick kanalını bağlayın");
    },
    [
      botSession.channelSlug,
      channelInput,
      channelName,
      connectChannelChat,
      onToast,
      refreshBotSession,
      refreshChatStatus,
    ]
  );

  const openKickInBrowser = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_kick_login_in_browser");
      onToast(
        "Özel Edge penceresi açıldı — SADECE o pencerede Kick’e giriş yapın (normal Edge değil). Giriş bitince «Oturumu otomatik al»a basın."
      );
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => window.setTimeout(r, 3000));
        await refreshBotSession();
        await refreshChatStatus();
        const r = await fetch(`${API_BASE}/api/kick/bot-session/status`, { cache: "no-store" });
        const j = (await r.json()) as KickBotSessionStatus;
        if (j?.ready || j?.connected) {
          if (!localChatConnected) {
            const slug = String(channelInput || channelName || j.channelSlug || "").trim();
            if (slug) await connectChannelChat(slug);
            else onToast("Oturum hazır — Kick kanal adını girip sohbeti bağlayın");
          } else {
            onToast("Kick bot oturumu hazır ✓");
          }
          break;
        }
      }
    } catch (e) {
      onToast(invokeError(e, "Tarayıcı açılamadı"));
    }
  };

  const importFromEdge = async () => {
    setPasteBusy(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = (await invoke("import_kick_session_from_browser")) as Obj;
      await applySessionImportResult(result, "Edge oturumu alındı — sohbet bağlandı ✓");
    } catch (e) {
      onToast(invokeError(e, "Oturum alınamadı — önce Edge’de Kick’i açın"));
    } finally {
      setPasteBusy(false);
    }
  };

  const ingestCookiePaste = async () => {
    if (!cookiePaste.trim()) return onToast("Cookie satırını yapıştırın");
    setPasteBusy(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = (await invoke("ingest_kick_bot_cookie_header", {
        cookieHeader: cookiePaste.trim(),
      })) as Obj;
      if (result.ready || parseObject(result.status).ready) setCookiePaste("");
      await applySessionImportResult(result, "Kick bot oturumu yapıştırıldı ✓");
    } catch (e) {
      onToast(invokeError(e, "Cookie kaydı başarısız"));
    } finally {
      setPasteBusy(false);
    }
  };
  const openKickBotLogin = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      try { await invoke("close_kick_bot_login"); } catch { /* already closed */ }
      await invoke("open_kick_bot_login");
      onToast("WebView açıldı — giriş tamamlanınca oturumu yakalayın");
      window.setTimeout(() => void refreshBotSession(), 2500);
    } catch (e) {
      onToast(invokeError(e, "Kick giriş penceresi açılamadı"));
    }
  };
  const closeKickBotLogin = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("close_kick_bot_login");
      onToast("Kick giriş penceresi kapatıldı");
    } catch (e) {
      onToast(invokeError(e, "Kick penceresi kapatılamadı"));
    }
  };
  const harvestKickCookies = useCallback(async () => {
    if (harvestLock.current) return;
    harvestLock.current = true;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      // Edge CDP önce — WebView şart değil
      let result = (await invoke("import_kick_session_from_browser")) as Obj;
      if (!(result.ready || parseObject(result.status).ready)) {
        try {
          result = (await invoke("harvest_kick_bot_cookies")) as Obj;
        } catch {
          /* CDP zaten denendi */
        }
      }
      await applySessionImportResult(result, "Kick bot oturumu yakalandı ✓");
    } catch (e) {
      onToast(
        invokeError(
          e,
          "Oturum alınamadı — önce «Edge’de Kick’i aç» ile özel pencereyi başlatın"
        )
      );
    } finally {
      window.setTimeout(() => {
        harvestLock.current = false;
      }, 1200);
    }
  }, [applySessionImportResult, onToast]);
  const sendTestMessage = async () => {
    if (!testMsg.trim()) return;
    setTestBusy(true);
    try {
      if (!apiReady) {
        onToast("Önce Kick API’yi bağlayın");
        return;
      }
      // Sohbet dinleme opsiyonel ama kanal slug’ı broadcaster çözümlemeye yardım eder
      if (!chatListening && channelInput.trim()) {
        await connectChannelChat();
      }
      const response = await fetch(`${API_BASE}/api/kick/chat/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: testMsg.trim(),
          slug: channelInput.trim() || channelName || undefined,
        }),
      });
      const raw = await response.text().catch(() => "");
      let body: Obj = {};
      try {
        body = raw ? (JSON.parse(raw) as Obj) : {};
      } catch {
        body = { error: raw };
      }
      if (!response.ok) {
        const err = String(body.error || body.message || raw || `Gönderilemedi (${response.status})`);
        if (response.status === 429 || /rate limit|hız limiti/i.test(err)) {
          onToast("Kick hız limiti — BotAxT birkaç saniye içinde yeniden dener");
        } else {
          onToast(err);
          if (/bağlı değil|unauthorized|401/i.test(err)) {
            setOauthLocal(false);
            setSessionLost(true);
            setLostReason(err);
          }
        }
      } else {
        const sendAs = String(body.sendAs || "");
        const oauth = String(body.oauthUser || oauthUser || "");
        onToast(
          sendAs === "bot"
            ? "Test mesajı gönderildi ✓ (Kick uygulama botu / BotAxT)"
            : sendAs === "user"
              ? `Test mesajı gönderildi ✓ (@${oauth || "OAuth hesabı"})`
              : "Test mesajı gönderildi ✓ (Kick API)"
        );
        void refreshOauth();
        void refreshChatStatus();
      }
    } catch (e) {
      onToast(invokeError(e, "Test mesajı gönderilemedi"));
    } finally {
      setTestBusy(false);
    }
  };

  const loadConsole = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/botaxt/bot/console`, { cache: "no-store" });
      if (!response.ok) return;
      const body = (await response.json()) as { lines?: ConsoleLine[] };
      setLines(body.lines || []);
    } catch { /* console is optional */ }
  }, []);

  useEffect(() => {
    void loadSettings();
    void loadConsole();
    void refreshBotSession();
    void refreshChatStatus();
    void refreshOauth();
    const timer = window.setInterval(() => {
      void refreshBotSession();
      void refreshChatStatus();
      void refreshOauth();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadConsole, loadSettings, refreshBotSession, refreshChatStatus, refreshOauth]);

  useEffect(() => {
    let closed = false;
    let retry: number | undefined;
    let socket: WebSocket | null = null;
    const connect = () => {
      if (closed) return;
      try { socket = new WebSocket(overlaySyncWsUrl()); } catch { retry = window.setTimeout(connect, 2500); return; }
      socket.onopen = () => setWsOk(true);
      socket.onclose = () => { setWsOk(false); if (!closed) retry = window.setTimeout(connect, 2500); };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as Obj;
          if (message.type === "bot-console" && message.entry) setLines((old) => [...old.slice(-199), message.entry as ConsoleLine]);
          if (message.type === "auth_success" && message.platform === "kick") {
            setOauthLocal(true);
            if (typeof message.username === "string") setOauthUser(message.username);
            setSessionLost(false);
            onToast("Kick API bağlandı ✓");
            void refreshOauth();
            void refreshChatStatus();
          }
          if (message.type === "kick-chat-status") {
            setLocalChatConnected(!!message.connected);
            if (typeof message.username === "string" && message.username) {
              setChannelInput(String(message.username));
            }
            void refreshChatStatus();
          }
          if (message.type === "kick-session-lost") {
            setSessionLost(true);
            setLostReason(String(message.reason || message.message || "Bağlantı koptu"));
          }
        } catch { /* ignore other websocket traffic */ }
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      try { socket?.close(); } catch { /* closed */ }
    };
  }, [onToast, refreshOauth, refreshChatStatus]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [lines]);

  return (
    <section className="mx-auto max-w-6xl overflow-hidden rounded-lg border border-white/[0.05] bg-[#0c0d10]" data-ui="botrix-chat-bot">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.05] px-4 py-3" style={{ boxShadow: "inset 0 -1px 0 color-mix(in srgb, var(--platform-color) 35%, transparent)" }}>
        <div>
          <h2 className="text-[15px] font-semibold text-white/90">Chat Bot</h2>
          <p className="mt-0.5 text-[11px] text-white/50">
            {botEnabled ? (apiReady ? "Aktif" : "Bot açık") : "Bot kapalı"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/70 transition-colors hover:bg-white/[0.08]"
          >
            <LogIn className="h-3 w-3" style={{ color: "var(--platform-color)" }} />
            Platform giriş
          </Link>
          <span className={cn("yya-label", botEnabled ? "text-teal-400" : "text-white/50")} style={botEnabled ? { color: "var(--platform-color)" } : undefined}>
            {botEnabled ? "ON" : "OFF"}
          </span>
          <GlowToggle checked={botEnabled} disabled={settingsBusy} onChange={(value) => void toggleMaster(value)} />
        </div>
      </header>

      <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px] text-white/55">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/50" />
        <p>
          Botrix gibi bağlanır: Kick sohbetine{" "}
          <code className="rounded bg-black/40 px-1 font-mono text-[11px] text-teal-400/90">/mod {botName || "BotAxT"}</code>
          {" "}yazın. kick.com/settings/developer → Create a BOT (BotAxT). Mesajlar Kick API kuyruğundan ~1/sn gider.
        </p>
      </div>

      <nav className="mt-3 overflow-x-auto border-b border-white/[0.05] px-4">
        <div className="flex min-w-max gap-4">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "border-b-2 px-0.5 pb-2 text-[12px] font-medium transition-colors duration-150",
                tab === item.id
                  ? "border-teal-500 text-teal-400"
                  : "border-transparent text-white/50 hover:text-white/75"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="p-4">
        {sessionLost && !apiReady ? (
          <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3 py-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-red-400" />
              <div>
                <p className="text-[13px] text-red-300">Kick API bağlantısı yok</p>
                <p className="text-[11px] text-red-200/60">{lostReason || "OAuth ile yeniden bağlanın"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setTab("name");
                setSessionLost(false);
                window.setTimeout(() => connectionRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
              }}
              className="yya-btn-ghost text-red-200"
            >
              API bağla
            </button>
          </div>
        ) : null}

        {tab === "name" ? (
          <div className="space-y-3">
            <div className="yya-settings-panel">
              <SettingsRow label="Bot adı" description="Sohbette görünen isim">
                <div className="flex items-center gap-1.5">
                  <input
                    value={botNameDraft}
                    onChange={(e) => setBotNameDraft(e.target.value)}
                    className="yya-input w-[10rem]"
                    placeholder="Bot kullanıcı adı"
                  />
                  <button type="button" disabled={nameBusy} onClick={() => void saveBotName()} className="yya-btn-primary">
                    Kaydet
                  </button>
                </div>
              </SettingsRow>
              <SettingsRow label="Görünen" description={`@${botName}`} last>
                <button
                  type="button"
                  onClick={() => connectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="yya-btn-primary"
                >
                  Kick API bağla
                </button>
              </SettingsRow>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-3">
              <div className="yya-stat">
                <p className="yya-label flex items-center gap-1.5">
                  {chatListening ? <Wifi className="h-3 w-3 text-teal-400" /> : <WifiOff className="h-3 w-3" />}
                  Sohbet
                </p>
                <p className="mt-1 text-[13px] text-white/90">
                  {chatListening ? "Dinleniyor" : localChatConnecting ? "Bağlanıyor…" : "Kapalı"}
                </p>
              </div>
              <div className="yya-stat">
                <p className="yya-label flex items-center gap-1.5">
                  <Radio className="h-3 w-3" /> Kick API
                </p>
                <div className="mt-1">
                  <StatusDot ok={apiReady} />
                </div>
              </div>
              <div className="yya-stat">
                <p className="yya-label">Durum</p>
                <div className="mt-1">
                  <StatusDot ok={apiReady} />
                </div>
              </div>
            </div>

            <div className="yya-settings-panel">
              <SettingsRow label="Kanal (dinleme)" description="Komutların okunacağı Kick kanalı">
                <div className="flex items-center gap-1.5">
                  <input
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value)}
                    placeholder="kanal adı"
                    className="yya-input w-[9rem]"
                  />
                  <button
                    type="button"
                    disabled={chatBusy || !channelInput.trim()}
                    onClick={() => void connectChannelChat()}
                    className="yya-btn-primary disabled:opacity-40"
                  >
                    {chatBusy || localChatConnecting ? "…" : chatListening ? "Yenile" : "Bağla"}
                  </button>
                </div>
              </SettingsRow>
            </div>

            {needsChatroom ? (
              <p className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-[12px] text-white/50">
                Kick API bağlı ama sohbet dinlenmiyor — kanal adını yazıp bağlayın.
              </p>
            ) : null}

            <div ref={connectionRef} className="yya-settings-panel scroll-mt-4">
              <div className="border-b border-white/5 px-3 py-2">
                <p className="text-[13px] text-white/90">Kick API</p>
                <p className="mt-0.5 text-[11px] text-white/50">
                  Client ID + Secret bir kez kaydedilir. Kick.com tarayıcı çıkışı botu düşürmez;
                  uygulama her açılışta tokenı yeniler.
                </p>
              </div>
              <SettingsRow label="Client ID" description="Developer UUID">
                <input
                  value={clientIdDraft}
                  onChange={(e) => setClientIdDraft(e.target.value)}
                  className="yya-input w-[12rem] font-mono"
                  placeholder="Client ID"
                />
              </SettingsRow>
              <SettingsRow label="Client Secret" description="Zorunlu">
                <input
                  value={clientSecretDraft}
                  onChange={(e) => setClientSecretDraft(e.target.value)}
                  type="password"
                  className="yya-input w-[12rem] font-mono"
                  placeholder="••••••••"
                />
              </SettingsRow>
              <SettingsRow
                label="Bağlantı"
                description={
                  apiReady
                    ? `Hazır${oauthUser ? ` — @${oauthUser}` : " — uygulama tokenı"}`
                    : "Client ID + Secret kaydedin"
                }
                last
              >
                <div className="flex flex-wrap justify-end gap-1.5">
                  <button type="button" disabled={oauthBusy} onClick={() => void connectKickApi()} className="yya-btn-primary disabled:opacity-40">
                    <LogIn className="h-3.5 w-3.5" />
                    {oauthBusy ? "…" : apiReady ? "Yenile" : "Kaydet"}
                  </button>
                  <button
                    type="button"
                    disabled={oauthBusy}
                    onClick={() => void authorizeKickAccount()}
                    className="yya-btn-ghost disabled:opacity-40"
                    title="İsteğe bağlı: başka kanala user olarak yazmak için bir kez Kick izni"
                  >
                    Kick hesabı
                  </button>
                  <button type="button" onClick={() => void refreshOauth()} className="yya-btn-ghost">
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                  {apiReady ? (
                    <button type="button" onClick={() => void disconnectKickApi()} className="yya-btn-danger">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </SettingsRow>
            </div>

            <div className="yya-settings-panel">
              <SettingsRow label="Test mesajı" description="Kick API ile gönder" last>
                <div className="flex items-center gap-1.5">
                  <input
                    value={testMsg}
                    onChange={(event) => setTestMsg(event.target.value)}
                    className="yya-input w-[10rem]"
                  />
                  <button
                    type="button"
                    disabled={testBusy || !apiReady}
                    onClick={() => void sendTestMessage()}
                    className="yya-btn-primary disabled:opacity-35"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </SettingsRow>
            </div>

            <details className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2">
              <summary className="yya-label cursor-pointer">Gelişmiş · webhook</summary>
              <p className="mt-2 text-[11px] leading-relaxed text-white/50">
                Event abonelikleri için genel erişilebilir Webhook URL (localhost çalışmaz):
                <code className="mt-1 block rounded bg-black/40 px-2 py-1 font-mono text-[10px]" style={{ color: "var(--platform-color)" }}>
                  https://SIZIN-HOST/api/kick/webhook
                </code>
              </p>
            </details>
          </div>
        ) : null}

        {tab === "console" ? (
          <div className="overflow-hidden rounded-lg border border-white/[0.05] bg-[#050608]">
            <div className="flex items-center justify-between border-b border-white/[0.05] px-3 py-2">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-teal-500" />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-teal-500/90">
                  terminal
                </span>
                <span className={cn("h-1.5 w-1.5 rounded-full", wsOk ? "bg-teal-500" : "bg-red-500/80")} />
              </div>
              <button type="button" onClick={() => void loadConsole()} className="text-[11px] text-white/50 hover:text-white/70">
                Yenile
              </button>
            </div>
            <div
              ref={scroller}
              className="h-[380px] space-y-0.5 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed tracking-tight"
              style={{ fontFamily: '"JetBrains Mono", ui-monospace, Consolas, monospace' }}
            >
              <AnimatePresence initial={false}>
                {!lines.length ? (
                  <p className="text-white/50">$ waiting for events…</p>
                ) : (
                  lines.map((line, index) => (
                    <motion.div
                      key={`${line.t || 0}-${index}-${line.text || ""}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-white/65"
                    >
                      <span className="text-white/50">
                        {line.t
                          ? new Date(line.t).toLocaleTimeString("tr-TR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                          : "--:--:--"}
                      </span>{" "}
                      <span className="text-teal-500/70">[{line.platform || line.kind || "bot"}]</span>{" "}
                      {line.user ? <span className="text-white/80">{line.user}: </span> : null}
                      <MessageFormatter text={String(line.text || "")} />
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : null}

        {tab !== "name" && tab !== "console" ? (
          <BotrixTabs tab={tab} extras={extras} onSaveExtras={saveExtras} onToast={onToast} />
        ) : null}
      </div>
    </section>
  );
}
