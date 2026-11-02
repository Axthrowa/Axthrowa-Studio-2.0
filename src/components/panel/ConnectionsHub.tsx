/**
 * Dashboard — Kick + Master yayın + OBS kartları.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Cable, CirclePower, Radio, Save, Unplug } from "lucide-react";
import { fetchSettings, patchSettings } from "../../lib/api";
import { obsControl, type ObsConnectionStatus } from "../../lib/obsControl";
import { loadObsSaved, saveObsSaved } from "../../lib/obsPersist";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { openExternal } from "../../lib/openExternal";
import { streamaxtBase } from "../../lib/streamaxt";
import { getBotConfig, saveBotConfig } from "../../lib/smartBot";
import StatusDot from "@/components/axthrowa/StatusDot";
import { PlatformLogo } from "../chat/ChatFeed";
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
  /** Diğer platformların girişi botun Platformlar sayfasında */
  onBotPlatformlar?: () => void;
  /** OBS'e bağlanılınca (Kaydet) panel sahne/giriş listelerini yenilesin. */
  onObsConnected?: () => void;
  master?: {
    live: boolean;
    busy: boolean;
    onToggle: () => void;
  };
};

type BotPlatformDurumu = {
  connected?: boolean;
  channel?: string;
  yazabilir?: boolean;
  botHesabi?: string;
  kanalHesabi?: string;
  error?: string;
};

const DIGER_PLATFORMLAR = [
  { id: "twitch", ad: "Twitch" },
  { id: "youtube", ad: "YouTube" },
  { id: "discord", ad: "Discord" },
  { id: "trovo", ad: "Trovo" },
  { id: "tiktok", ad: "TikTok" },
];

/**
 * Bot Kick sohbetine yazabiliyor mu. `yazabilir` StreamAxT 1.9 ile geldi (jetonsuz bağlantı yalnız okur);
 * daha eski bot bu alanı göndermez, o zaman bağlı olması yeterli sayılır — yoksa API girilmiş olsa bile
 * "girilmemiş" uyarısı çıkıyordu.
 */
export function botKickYazabilir(kick: { connected?: boolean; yazabilir?: boolean } | undefined): boolean {
  if (!kick?.connected) return false;
  return kick.yazabilir ?? true;
}

const EMPTY_OBS: ObsConnectionStatus = {
  connected: false,
  connecting: false,
  host: "127.0.0.1",
  port: 4455,
};

const inputCls = "yya-input mt-1 h-9 text-xs md:text-sm font-medium text-white";

export default function ConnectionsHub({ onToast, master, obs: sharedObs, onObsPatch, onObsConnected, onBotPlatformlar }: Props) {
  const [kickSlug, setKickSlug] = useState("");
  // Tek doğruluk kaynağı botun durumu: bağlantıyı da sohbete yazmayı da bot yapıyor
  const [platformlar, setPlatformlar] = useState<Record<string, BotPlatformDurumu> | null>(null);
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
  const slugYazildi = useRef(false);

  const refreshBot = useCallback(async () => {
    try {
      const r = await fetch(`${await streamaxtBase()}/api/status`, { cache: "no-store" });
      const d = r.ok ? ((await r.json()) as { platforms?: Record<string, BotPlatformDurumu> }) : null;
      setPlatformlar(d?.platforms || null);
      const kanal = String(d?.platforms?.kick?.channel || "");
      if (kanal && !slugYazildi.current) setKickSlug(kanal);
    } catch {
      setPlatformlar(null); // bot kapalı
    }
  }, []);

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
        // Panel dilimi şifresizse (eski kayıtlarda oluyordu) ekran dilimlerinde
        // duran şifreyi getir: kutu doğru değeri göstersin, Kaydet onu yazsın.
        if (!String(obs.password ?? saved?.password ?? "").trim()) {
          void (async () => {
            for (const scr of ["starting", "ending", "brb", "chat"] as const) {
              try {
                const o = ((await fetchSettings(scr)).obs || {}) as Record<string, unknown>;
                const pw = String(o.password || "");
                if (pw.trim()) {
                  setPassword(pw);
                  break;
                }
              } catch {
                /* dilim okunamadı */
              }
            }
          })();
        }
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
    void refreshBot();
    // OBS durumu da yoklanır: uygulama arka planda kendiliğinden bağlanınca kart
    // "Bağlı Değil" göstermeye devam ediyor, kullanıcı Kaydet'e basıp yeniden
    // bağlanıyordu (zaten bağlıyken).
    const poll = setVisibleInterval(() => {
      void refreshBot();
      void obsControl
        .status()
        .then((next) => setStatus((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next)))
        .catch(() => {});
    }, 8000);
    return () => clearVisibleInterval(poll);
  }, [refreshBot]);

  const kick = platformlar?.kick;

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
      // Yayın kanalı botta da değişir; kayıtlı bot hesabı korunur
      if (slug && platformlar && slug.toLowerCase() !== String(kick?.channel || "").toLowerCase()) {
        const r = await fetch(`${await streamaxtBase()}/api/platforms/kick/connect`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelName: slug }),
        });
        if (!r.ok) onToast(String((await r.json().catch(() => null))?.error || "Kick kanalı kaydedilemedi"));
        void refreshBot();
      }
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

  /** Kick'in resmi izin sayfası varsayılan tarayıcıda açılır; onaydan sonra bot kaydeder ve bağlanır. */
  const kickGirisi = async (hedef: "bot" | "kanal") => {
    try {
      const r = await fetch(`${await streamaxtBase()}/api/platforms/kick/auth-url?hedef=${hedef}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok || !d.authUrl) {
        onToast("Önce Kick Client ID gerekli: Bot › Platformlar › Kick");
        onBotPlatformlar?.();
        return;
      }
      const sonuc = await openExternal(d.authUrl);
      onToast(sonuc === "opened" ? "Kick izin sayfası tarayıcıda açıldı" : "Giriş adresi panoya kopyalandı");
    } catch {
      onToast("Bot kapalı — Kick girişi açılamadı");
    }
  };

  return (
    <div className={`mx-4 mb-3 mt-1.5 grid gap-3.5 ${master ? "lg:grid-cols-[minmax(0,1fr)_17rem_minmax(0,1fr)]" : "lg:grid-cols-2"}`}>
      <section className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-panel-card/70 p-4 shadow-panel">
        <div>
          <header className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Platformlar</h3>
            </div>
          </header>

          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-panel-accent" />
              <span className="text-xs font-bold text-white">Bot hesabı</span>
              <StatusDot ok={!!kick?.yazabilir} />
              <span className="ml-auto truncate text-xs text-white/70">
                {kick?.botHesabi ? `@${kick.botHesabi}` : kick?.yazabilir ? "kayıtlı" : "girilmedi"}
              </span>
              <button type="button" className="yya-btn-ghost h-8 shrink-0 px-2.5 text-xs font-bold" onClick={() => void kickGirisi("bot")}>
                {kick?.yazabilir ? "Değiştir" : "Giriş yap"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-panel-muted">Sohbete yazan hesap. Bir kez girilir, kayıtlı kalır.</p>
          </div>

          <div className="mt-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-panel-accent" />
              <span className="text-xs font-bold text-white">Yayın kanalı</span>
              <StatusDot ok={!!kick?.connected} />
              <button type="button" className="yya-btn-ghost ml-auto h-8 shrink-0 px-2.5 text-xs font-bold" onClick={() => void kickGirisi("kanal")}>
                {kick?.kanalHesabi ? `@${kick.kanalHesabi}` : "Kanala giriş"}
              </button>
            </div>
            <input
              className={inputCls}
              placeholder="ör. kanal-adi"
              value={kickSlug}
              onChange={(e) => {
                slugYazildi.current = true;
                setKickSlug(e.target.value);
              }}
            />
            <p className="mt-1.5 text-[11px] text-panel-muted">
              {kick?.error || "Dinlenecek kanal; Kaydet ile değişir. Kanala giriş, temizleme ve başlık gibi yayıncı işleri için."}
            </p>
          </div>

          <div className="mt-2.5 flex flex-col gap-1">
            {DIGER_PLATFORMLAR.map(({ id, ad }) => {
              const p = platformlar?.[id];
              return (
                <div key={id} className="flex items-center gap-2 rounded-lg px-1 py-1 text-xs text-white/85">
                  {id !== "trovo" && id !== "tiktok" ? <PlatformLogo platform={id as "twitch"} /> : null}
                  <span className="font-semibold">{ad}</span>
                  <StatusDot ok={!!p?.connected} />
                  <span className="truncate text-white/55">{p?.connected ? p.channel : ""}</span>
                  <button type="button" className="yya-btn-ghost ml-auto h-7 shrink-0 px-2.5 text-[11px] font-bold" onClick={onBotPlatformlar}>
                    {p?.connected ? "Yönet" : "Giriş"}
                  </button>
                </div>
              );
            })}
          </div>
          {!platformlar && <p className="mt-2 text-[11px] text-amber-200">Bot kapalı: bağlantılar okunamıyor.</p>}
        </div>
      </section>

      {master ? (
        <button
          type="button"
          disabled={master.busy}
          className={
            "group relative flex min-h-[8.5rem] w-full flex-col items-center justify-center gap-2.5 rounded-2xl border-2 " +
            "text-base font-bold tracking-wider transition-all duration-200 active:scale-[0.98] focus:outline-none " +
            "disabled:opacity-60 " +
            (master.live
              ? "border-red-400 bg-gradient-to-b from-red-500 to-red-600 text-white shadow-[0_0_30px_rgba(239,68,68,0.55)] hover:from-red-400 hover:to-red-500 hover:shadow-[0_0_40px_rgba(239,68,68,0.7)]"
              : "border-emerald-400/80 bg-gradient-to-b from-emerald-500 to-emerald-600 text-[#03291e] shadow-[0_0_28px_rgba(16,185,129,0.45)] hover:from-emerald-400 hover:to-emerald-500 hover:shadow-[0_0_38px_rgba(16,185,129,0.65)]")
          }
          onClick={master.onToggle}
        >
          <div className="relative">
            <CirclePower className="h-10 w-10 transition-transform group-hover:scale-110" />
            {master.live && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-red-600 bg-white animate-ping" />
            )}
          </div>
          <span className="text-sm font-extrabold uppercase tracking-widest">
            {master.busy ? "İşleniyor…" : master.live ? "Yayını Bitir" : "Yayını Başlat"}
          </span>
          <span className="text-xs font-semibold opacity-90">
            {master.live ? "OBS + Platform Yayında" : "Tek Tıkla Canlıya Geç"}
          </span>
        </button>
      ) : null}

      <section className="relative flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-panel-card/70 p-4 shadow-panel">
        <div>
          <header className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-panel-accent shadow-glow-sm" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">OBS WebSocket</h3>
            </div>
            <StatusDot ok={status.connected} />
          </header>
          <div className="grid grid-cols-[1fr_6rem] gap-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-white/85">
              IP Adresi
              <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/85">
              Port
              <input
                className={inputCls}
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value) || 4455)}
              />
            </label>
          </div>
          <label className="mt-2.5 block text-xs font-bold uppercase tracking-wider text-white/85">
            Parola
            <input
              className={inputCls}
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-white/85">
              Giriş Bekletme (dk)
              <input
                className={inputCls}
                type="number"
                min={1}
                value={startHoldMin}
                onChange={(e) => setStartHoldMin(Math.max(1, Number(e.target.value) || 5))}
              />
            </label>
            <label className="block text-xs font-bold uppercase tracking-wider text-white/85">
              Çıkış Bekletme (dk)
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
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            disabled={!!busy}
            className="yya-btn-primary h-9 px-4 text-xs md:text-sm font-bold"
            onClick={() => void saveAll()}
          >
            <Save className="mr-1.5 inline h-4 w-4" />
            {busy === "save" ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {status.connected && (
            <button
              type="button"
              className="yya-btn-danger h-9 px-3.5 text-xs md:text-sm font-bold"
              onClick={() => {
                void obsControl.disconnect().then(setStatus);
              }}
            >
              <Unplug className="mr-1.5 inline h-4 w-4" />
              Bağlantıyı Kes
            </button>
          )}
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-xs font-mono font-medium text-white/80">
            <Cable className="h-3.5 w-3.5 text-panel-accent" /> v5.x
          </span>
        </div>
      </section>
    </div>
  );
}
