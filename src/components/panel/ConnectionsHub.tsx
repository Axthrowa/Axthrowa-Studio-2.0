/**
 * Dashboard — Kick + Master yayın + OBS kartları.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Cable, CirclePower, Cookie, Radio, Save, Unplug } from "lucide-react";
import { API_BASE, fetchSettings, patchSettings } from "../../lib/api";
import { obsControl, type ObsConnectionStatus } from "../../lib/obsControl";
import { loadObsSaved, saveObsSaved } from "../../lib/obsPersist";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { getBotConfig, saveBotConfig } from "../../lib/smartBot";
import StatusDot from "../ui/StatusDot";
import EndRulesEditor from "./EndRulesEditor";

type Props = {
  onToast: (message: string) => void;
  /**
   * Panelin ortak OBS ayarı ve onu yazan yol. `obs` ekranlar arasında
   * paylaşıldığı için bitiş kuralı buradan geçmeli; doğrudan `patchSettings`
   * yapılırsa panelin otomatik kaydı eski `obs`'u geri yazıp kuralı siler.
   */
  obs?: { endRules?: Record<string, any> } | null;
  onObsPatch?: (patch: Record<string, unknown>) => void;
  /** OBS'e bağlanılınca (Kaydet) panel sahne/giriş listelerini yenilesin. */
  onObsConnected?: () => void;
  master?: {
    live: boolean;
    busy: boolean;
    onToggle: () => void;
  };
};

/** `/api/kick/oauth/status` yanıtı — resmi Kick API bağlantısı. */
type KickApiStatus = {
  connected?: boolean;
  username?: string | null;
  clientId?: string | null;
  hasSecret?: boolean;
};

type KickSession = {
  ready?: boolean;
  connected?: boolean;
  hasCookies?: boolean;
  pending?: boolean;
  username?: string | null;
  channelSlug?: string | null;
  error?: string | null;
};

const EMPTY_OBS: ObsConnectionStatus = {
  connected: false,
  connecting: false,
  host: "127.0.0.1",
  port: 4455,
};

const inputCls = "yya-input mt-0.5 h-8 text-xs";

export default function ConnectionsHub({ onToast, master, obs: sharedObs, onObsPatch, onObsConnected }: Props) {
  const [kickSlug, setKickSlug] = useState("");
  const [kickSession, setKickSession] = useState<KickSession>({});
  // Çerez oturumu ile Kick API (OAuth) bağlantısı ayrı şeyler: bot sohbete
  // yazabilmek için API'ye ihtiyaç duyuyor. Tek rozet ikisini birleştirince
  // API kopukken de yeşil yanıyor ve "neden yazmıyor?" sorusuna yol açıyordu.
  const [kickApi, setKickApi] = useState<KickApiStatus>({});
  const [obsScenes, setObsScenes] = useState<string[]>([]);
  // Bitiş kuralı düzenleyicisi için her ekranın kendi eski süre alanları.
  const [legacyEnd, setLegacyEnd] = useState<
    Record<string, { endingMinutes?: unknown; brbMinutes?: unknown; targetDate?: unknown }>
  >({});
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState(4455);
  const [password, setPassword] = useState("");
  const [startHoldMin, setStartHoldMin] = useState(5);
  const [endHoldMin, setEndHoldMin] = useState(2);
  const [status, setStatus] = useState<ObsConnectionStatus>(EMPTY_OBS);
  const [busy, setBusy] = useState("");
  const harvestLoop = useRef(false);

  const applyKick = useCallback((raw: KickSession | null | undefined) => {
    if (!raw || typeof raw !== "object") return;
    setKickSession(raw);
    const fromSession = String(raw.username || raw.channelSlug || "").trim();
    if (fromSession) setKickSlug((prev) => prev || fromSession);
  }, []);

  const refreshKick = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      applyKick((await invoke("kick_bot_session_status")) as KickSession);
    } catch {
      try {
        const r = await fetch("/api/kick/bot-session/status", { cache: "no-store" });
        if (r.ok) applyKick((await r.json()) as KickSession);
      } catch {
        /* Tauri dışı önizleme */
      }
    }
  }, [applyKick]);

  // OBS bağlanınca sahne adlarını çek: bitiş kuralındaki sahne alanı bunlarla
  // öneri sunuyor. Bağlı değilse boş kalır, alan serbest yazıma açık.
  useEffect(() => {
    if (!status.connected) {
      setObsScenes([]);
      return;
    }
    let iptal = false;
    void obsControl
      .scenes()
      .then((snap) => {
        if (!iptal) setObsScenes(snap?.scenes || []);
      })
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, [status.connected]);

  const refreshKickApi = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/kick/oauth/status`, { cache: "no-store" });
      if (r.ok) setKickApi((await r.json()) as KickApiStatus);
    } catch {
      /* sunucu kapalıysa bilinmiyor olarak kalsın */
    }
  }, []);

  const silentHarvest = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      let result = (await invoke("import_kick_session_from_browser")) as KickSession;
      if (!(result.ready || result.connected || result.hasCookies)) {
        try {
          result = (await invoke("harvest_kick_bot_cookies")) as KickSession;
        } catch {
          /* CDP yedek */
        }
      }
      applyKick(result);
      return !!(result.ready || result.connected);
    } catch {
      return false;
    }
  }, [applyKick]);

  useEffect(() => {
    let iptal = false;
    void (async () => {
      const out: typeof legacyEnd = {};
      for (const scr of ["starting", "ending", "brb"] as const) {
        try {
          const d = await fetchSettings(scr);
          out[scr] = {
            endingMinutes: d.endingMinutes,
            brbMinutes: d.brbMinutes,
            targetDate: d.targetDate,
          };
        } catch {
          /* ekran okunamadıysa varsayılanla devam */
        }
      }
      if (!iptal) setLegacyEnd(out);
    })();
    return () => {
      iptal = true;
    };
  }, []);

  useEffect(() => {
    const cfg = getBotConfig();
    setKickSlug(String(cfg.channelName || "").trim());
    const saved = loadObsSaved();
    void (async () => {
      try {
        const settings = await fetchSettings("panel");
        const obs = (settings.obs || {}) as Record<string, unknown>;
        setHost(String(obs.host || saved?.host || "127.0.0.1"));
        setPort(Number(obs.port) || saved?.port || 4455);
        setPassword(String(obs.password ?? saved?.password ?? ""));
        setStartHoldMin(Math.max(1, Number(obs.startHoldMin) || 5));
        setEndHoldMin(Math.max(1, Number(obs.endHoldMin) || 2));
      } catch {
        if (saved) {
          setHost(saved.host);
          setPort(saved.port);
          setPassword(saved.password);
        }
      }
      try {
        setStatus(await obsControl.status());
      } catch {
        setStatus(EMPTY_OBS);
      }
    })();
    void refreshKick();
    void refreshKickApi();
    // OBS durumu da yoklanır: uygulama arka planda kendiliğinden bağlanınca kart
    // "Bağlı Değil" göstermeye devam ediyor, kullanıcı Kaydet'e basıp yeniden
    // bağlanıyordu (zaten bağlıyken).
    const poll = setVisibleInterval(() => {
      void refreshKick();
      void refreshKickApi();
      void obsControl
        .status()
        .then((next) => setStatus((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)))
        .catch(() => {});
    }, 3000);
    return () => clearVisibleInterval(poll);
  }, [refreshKick, refreshKickApi]);

  const kickReady = !!(kickSession.ready || kickSession.connected || kickSession.hasCookies);

  const saveAll = async () => {
    if (busy) return;
    setBusy("save");
    const slug = kickSlug.trim().replace(/^@/, "");
    // Şifre kutusu boşken Kaydet, aynı adres için kayıtlı şifreyi sessizce siliyordu
    // (kutu yüklenmeden basılınca ya da tarayıcı otomatik doldurmayı temizleyince).
    // Aynı adreste kayıtlı bir şifre varsa boş alan onu ezmez.
    let effectivePassword = password;
    if (!password.trim()) {
      try {
        const cur = ((await fetchSettings("panel")).obs || {}) as Record<string, unknown>;
        const stored = String(cur.password || "");
        if (stored && String(cur.host || "").trim() === host.trim()) {
          effectivePassword = stored;
          setPassword(stored);
          onToast("Şifre alanı boştu; kayıtlı şifre korundu");
        }
      } catch {
        /* sunucu okunamazsa girilen değer kullanılır */
      }
    }
    const conn = { host, port, password: effectivePassword };
    saveObsSaved(conn);
    try {
      saveBotConfig((prev) => ({ ...prev, channelName: slug }));
      await patchSettings("chat", { kickSlug: slug });
      await patchSettings("panel", {
        obs: { host, port, password: effectivePassword, startHoldMin, endHoldMin },
      });
      await patchSettings("ending", { endingMinutes: endHoldMin });
      const next = await obsControl.connect(host, port, effectivePassword);
      setStatus(next);
      // Ekran dilimini de aynı bağlantıyla hizala ve sahne listesini yenile;
      // aksi halde panel eski adrese bakıyor, sahneler gelmiyordu.
      onObsPatch?.({ host, port, password: effectivePassword });
      onObsConnected?.();
      onToast("Bağlantılar kaydedildi");
    } catch (error) {
      const message = String((error as Error)?.message || error);
      setStatus((prev) => ({
        ...prev,
        connected: false,
        connecting: false,
        lastError: message,
      }));
      onToast(message.includes("ACL") ? "OBS WebSocket bağlanamadı — OBS açık mı?" : message);
    } finally {
      setBusy("");
    }
  };

  const harvestCookies = async () => {
    if (busy) return;
    setBusy("cookie");
    try {
      const ok = await silentHarvest();
      await refreshKick();
      if (ok || kickReady) onToast("Kick oturumu alındı");
    } catch {
      /* bağlanana kadar toast yok */
    } finally {
      setBusy("");
    }
  };

  const openKickLogin = async () => {
    try {
      const { openKickLoginPage, bindBotToKickChannel } = await import("../../lib/kickAuth");
      // Native yol (Edge + CDP) çalıştıysa ayrıca tarayıcı açmıyoruz: eskiden
      // ikisi birden çalışıp kullanıcıda iki giriş penceresi bırakıyordu.
      let nativeAcildi = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        try {
          await invoke("close_kick_bot_login");
        } catch {
          /* açık pencere yoksa sorun değil */
        }
        try {
          await invoke("open_kick_login_in_browser");
          nativeAcildi = true;
        } catch {
          /* native açılamadı — aşağıda varsayılan tarayıcıya düşülür */
        }
      } catch {
        /* Tauri dışı ortam */
      }
      if (nativeAcildi) {
        onToast("Kick girişi Edge'de açıldı — giriş yapınca oturum otomatik alınır");
      } else {
        const opened = await openKickLoginPage();
        onToast(
          opened === "opened"
            ? "Kick girişi tarayıcıda açıldı"
            : "Tarayıcı açılamadı — adres panoya kopyalandı: https://id.kick.com/login"
        );
      }
      harvestLoop.current = true;
      void (async () => {
        for (let i = 0; i < 40 && harvestLoop.current; i++) {
          await new Promise((r) => window.setTimeout(r, 2500));
          const ok = await silentHarvest();
          if (ok) {
            harvestLoop.current = false;
            const bound = await bindBotToKickChannel(kickSlug);
            if (bound.ok) onToast(bound.message);
            break;
          }
        }
      })();
    } catch {
      /* pencere yoksa sessiz poll devam */
    }
  };

  return (
    <div className="mx-4 mb-2 mt-1 grid gap-2 lg:grid-cols-[minmax(0,1fr)_16rem_minmax(0,1fr)]">
      <section className="rounded-xl border border-panel-border/80 bg-panel-card/80 p-2.5">
        <header className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-white">Yayın platformu · Kick</h3>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] text-panel-muted">
              Oturum
              <StatusDot ok={kickReady} />
            </span>
            <span className="flex items-center gap-1 text-[10px] text-panel-muted">
              API
              <StatusDot ok={!!kickApi.connected} />
            </span>
          </div>
        </header>
        <label className="block text-[11px] uppercase tracking-wider text-panel-muted">
          Kanal
          <input
            className={inputCls}
            placeholder="kanal-adi"
            value={kickSlug}
            onChange={(e) => setKickSlug(e.target.value)}
          />
        </label>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button type="button" className="yya-btn-ghost h-8 px-2.5 text-[11px]" onClick={() => void openKickLogin()}>
            <Radio className="mr-1 inline h-3 w-3" />
            Kick girişi
          </button>
          <button
            type="button"
            disabled={!!busy}
            className="yya-btn-accent h-8 px-2.5 text-[11px]"
            onClick={() => void harvestCookies()}
          >
            <Cookie className="mr-1 inline h-3 w-3" />
            {busy === "cookie" ? "Alınıyor…" : "Çerez al"}
          </button>
        </div>
        {kickSession.username ? (
          <p className="mt-1 truncate text-[11px] text-panel-muted">@{kickSession.username}</p>
        ) : null}
        {/* İki durum ayrı: çerez oturumu sohbeti okumaya, API yazmaya yarıyor. */}
        {!kickApi.connected && (
          <p className="mt-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200">
            {kickApi.clientId
              ? "Kick API bağlı değil — bot sohbete yazamaz. Bot sekmesinden Bağlan’a basıp Kick onayını tamamla."
              : "Kick API bilgileri girilmemiş — bot sohbete yazamaz. Bot sekmesinden Client ID ve Secret’ı gir."}
          </p>
        )}
      </section>

      {master ? (
        <button
          type="button"
          disabled={master.busy}
          className={
            // Panelin tek birincil eylemi bu. %15 opaklıkla neredeyse diğer
            // kartlarla aynı ağırlıktaydı; dolu zemine alıp odak noktası yaptık.
            "flex min-h-[7.5rem] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 " +
            "text-base font-semibold tracking-wide transition focus:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-white/60 disabled:opacity-60 " +
            (master.live
              ? "border-red-300 bg-red-500 text-red-950 shadow-[0_0_24px_rgba(239,68,68,0.35)] hover:bg-red-400"
              : "border-emerald-300 bg-emerald-500 text-emerald-950 shadow-[0_0_24px_rgba(16,185,129,0.35)] hover:bg-emerald-400")
          }
          onClick={master.onToggle}
        >
          <CirclePower className="h-9 w-9" />
          {master.busy ? "…" : master.live ? "Yayını Bitir" : "Yayını Başlat"}
        </button>
      ) : (
        <div />
      )}

      <section className="rounded-xl border border-panel-border/80 bg-panel-card/80 p-2.5">
        <header className="mb-1.5 flex items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-white">OBS WebSocket</h3>
          <StatusDot ok={status.connected} />
        </header>
        <div className="grid grid-cols-[1fr_4.5rem] gap-1.5">
          <label className="block text-[11px] uppercase tracking-wider text-panel-muted">
            IP
            <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} />
          </label>
          <label className="block text-[11px] uppercase tracking-wider text-panel-muted">
            Port
            <input
              className={inputCls}
              type="number"
              value={port}
              onChange={(e) => setPort(Number(e.target.value) || 4455)}
            />
          </label>
        </div>
        <label className="mt-1.5 block text-[11px] uppercase tracking-wider text-panel-muted">
          Şifre
          <input
            className={inputCls}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <label className="block text-[11px] uppercase tracking-wider text-panel-muted">
            Giriş (dk)
            <input
              className={inputCls}
              type="number"
              min={1}
              value={startHoldMin}
              onChange={(e) => setStartHoldMin(Math.max(1, Number(e.target.value) || 5))}
            />
          </label>
          <label className="block text-[11px] uppercase tracking-wider text-panel-muted">
            Çıkış (dk)
            <input
              className={inputCls}
              type="number"
              min={1}
              value={endHoldMin}
              onChange={(e) => setEndHoldMin(Math.max(1, Number(e.target.value) || 2))}
            />
          </label>
        </div>
        {onObsPatch && (
          <EndRulesEditor
            obs={sharedObs}
            legacy={legacyEnd}
            scenes={obsScenes}
            onChange={(endRules) => onObsPatch({ endRules })}
          />
        )}
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={!!busy}
            className="yya-btn-primary h-8 px-3 text-[11px]"
            onClick={() => void saveAll()}
          >
            <Save className="mr-1 inline h-3 w-3" />
            {busy === "save" ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {status.connected && (
            <button
              type="button"
              className="yya-btn-ghost h-8 px-2.5 text-[11px]"
              onClick={() => {
                void obsControl.disconnect().then(setStatus);
              }}
            >
              <Unplug className="mr-1 inline h-3 w-3" />
              Kes
            </button>
          )}
          <span className="ml-auto inline-flex items-center gap-1 self-center text-[10px] text-panel-muted">
            <Cable className="h-3 w-3" /> v5
          </span>
        </div>
      </section>
    </div>
  );
}
