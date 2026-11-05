/**
 * Dashboard — Kick + Master yayın + OBS kartları.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, Save, Unplug } from "lucide-react";
import { fetchSettings, patchSettings } from "../../lib/api";
import { obsControl, type ObsConnectionStatus } from "../../lib/obsControl";
import { loadObsSaved, saveObsSaved } from "../../lib/obsPersist";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { kickGirisiAc } from "../../lib/kickAuth";
import { streamaxtBase } from "../../lib/streamaxt";
import { getBotConfig, saveBotConfig } from "../../lib/smartBot";
import StatusDot from "@/components/axthrowa/StatusDot";
import { SOCIAL_META } from "../../lib/socials";
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
};

type BotPlatformDurumu = {
  connected?: boolean;
  channel?: string;
  yazabilir?: boolean;
  botHesabi?: string;
  kanalHesabi?: string;
  error?: string;
};

/** Platformun kendi renginde simge; logosu olmayanda baş harf */
function PlatformRozeti({ id }: { id: string }) {
  const meta = SOCIAL_META[id];
  return (
    <span aria-hidden className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold" style={{ background: meta?.color || "var(--panel-border)", color: meta?.iconFill || "var(--panel-text, #fff)" }}>
      {meta ? (
        <svg viewBox="0 0 24 24" width="20" height="20"><path d={meta.path} fill={meta.iconFill} /></svg>
      ) : (
        id.charAt(0).toUpperCase()
      )}
    </span>
  );
}

const DIGER_PLATFORMLAR = [
  { id: "twitch", ad: "Twitch" },
  { id: "youtube", ad: "YouTube" },
  { id: "discord", ad: "Discord" },
  { id: "trovo", ad: "Trovo" },
  { id: "tiktok", ad: "TikTok" },
];

/**
 * Bot Kick sohbetine yazabiliyor mu. `yazabilir` AxBoT 1.9 ile geldi (jetonsuz bağlantı yalnız okur);
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

export default function ConnectionsHub({ onToast, obs: sharedObs, onObsPatch, onObsConnected, onBotPlatformlar }: Props) {
  const [kickSlug, setKickSlug] = useState("");
  // Tek doğruluk kaynağı botun durumu: bağlantıyı da sohbete yazmayı da bot yapıyor
  const [platformlar, setPlatformlar] = useState<Record<string, BotPlatformDurumu> | null>(null);
  const [obsKaynaklari, setObsKaynaklari] = useState(0);
  const [botAdresi, setBotAdresi] = useState("");
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
      const base = await streamaxtBase();
      setBotAdresi(base);
      const r = await fetch(`${base}/api/status`, { cache: "no-store" });
      const d = r.ok ? ((await r.json()) as { platforms?: Record<string, BotPlatformDurumu>; obsKaynaklari?: number }) : null;
      setPlatformlar(d?.platforms || null);
      setObsKaynaklari(Number(d?.obsKaynaklari) || 0);
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

  const kanalKaydet = async () => {
    if (busy) return;
    setBusy("kanal");
    const slug = kickSlug.trim().replace(/^@/, "");
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
        if (!r.ok) throw new Error(String((await r.json().catch(() => null))?.error || "Kick kanalı kaydedilemedi"));
      }
      slugYazildi.current = false;
      onToast("Yayın kanalı kaydedildi");
      void refreshBot();
    } catch (e) {
      onToast(String((e as Error).message || e));
    } finally {
      setBusy("");
    }
  };

  const denetle = () => {
    void refreshBot();
    void obsControl.status().then(setStatus).catch(() => {});
  };

  const tekUrlKopyala = async () => {
    const adres = `${botAdresi || (await streamaxtBase())}/widgets/overlay`;
    try {
      await navigator.clipboard.writeText(adres);
      onToast("Tek URL kopyalandı: OBS'e Tarayıcı Kaynağı olarak ekle");
    } catch {
      onToast(adres);
    }
  };

  const saveAll = async () => {
    if (busy) return;
    setBusy("save");
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
      onToast("OBS ayarları kaydedildi");
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

  const kickGirisi = async (hedef: "bot" | "kanal") => {
    const r = await kickGirisiAc(hedef);
    onToast(r.message);
    if (r.needConfig) onBotPlatformlar?.();
  };

  const hazirlik = [
    { ok: !!kick?.connected, ad: "Kick kanalı okunuyor" },
    { ok: !!kick?.yazabilir, ad: "Bot sohbete yazabiliyor" },
    { ok: status.connected, ad: "OBS bağlı" },
    { ok: obsKaynaklari > 0, ad: "Tek URL OBS'te açık", cozum: { ad: "Adresi kopyala", calistir: () => void tekUrlKopyala() } },
  ];
  const hazirSayi = hazirlik.filter((h) => h.ok).length;
  const kart = "rounded-xl bg-panel-card p-4";
  const icKart = "flex flex-col gap-2.5 rounded-lg bg-white/[0.04] p-4";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="flex min-w-0 flex-col gap-3">
          <section aria-labelledby="kick-baslik" className={`${kart} flex flex-col gap-3`}>
            <div className="flex items-center gap-3">
              <PlatformRozeti id="kick" />
              <h2 id="kick-baslik" className="text-base font-semibold text-white">Kick</h2>
              <span className="ml-auto">
                <StatusDot ok={!!kick?.connected} />
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className={icKart}>
                <h3 className="text-xs font-semibold text-panel-muted">Bot hesabı</h3>
                <div className="truncate text-base font-semibold text-white">
                  {kick?.botHesabi ? `@${kick.botHesabi}` : kick?.yazabilir ? "Kayıtlı" : "Girilmedi"}
                </div>
                <p className="text-[13px] leading-snug text-panel-muted">Sohbete yazar. Bir kez girilir, kayıtlı kalır.</p>
                <button type="button" className="yya-btn-ghost h-10 self-start px-4 text-sm font-medium" onClick={() => void kickGirisi("bot")}>
                  {kick?.yazabilir ? "Hesabı değiştir" : "Giriş yap"}
                </button>
              </div>
              <div className={icKart}>
                <h3 className="text-xs font-semibold text-panel-muted">Yayın kanalı</h3>
                <label className="block">
                  <span className="sr-only">Kanal adı</span>
                  <input aria-label="Kanal adı"
                    className="yya-input h-10 w-full text-sm font-medium text-white"
                    placeholder="ör. kanal-adi"
                    value={kickSlug}
                    onChange={(e) => {
                      slugYazildi.current = true;
                      setKickSlug(e.target.value);
                    }}
                  />
                </label>
                <p className="text-[13px] leading-snug text-panel-muted">
                  {kick?.error || (kick?.kanalHesabi ? `Giriş yapıldı: @${kick.kanalHesabi}. Temizleme ve başlık işleri açık.` : "Sohbet buradan okunur. Giriş, temizleme ve başlık işlerini açar.")}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!!busy} className="yya-btn-ghost h-10 px-4 text-sm font-medium" onClick={() => void kanalKaydet()}>
                    {busy === "kanal" ? "Kaydediliyor…" : "Kaydet"}
                  </button>
                  <button type="button" className="yya-btn-ghost h-10 px-4 text-sm font-medium" onClick={() => void kickGirisi("kanal")}>
                    Kanala giriş
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="diger-baslik" className={`${kart} !py-2`}>
            <h2 id="diger-baslik" className="mb-1 mt-2 text-xs font-semibold text-panel-muted">Diğer platformlar</h2>
            {DIGER_PLATFORMLAR.map(({ id, ad }) => {
              const p = platformlar?.[id];
              return (
                <div key={id} className="flex min-h-[60px] items-center gap-3">
                  <PlatformRozeti id={id} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-white">{ad}</div>
                    <div className="truncate text-[13px] text-panel-muted">{p?.connected ? `@${p.channel} bağlı` : "Bağlı değil"}</div>
                  </div>
                  <button type="button" className="yya-btn-ghost h-10 min-w-[104px] px-4 text-sm font-medium" onClick={onBotPlatformlar}>
                    {p?.connected ? "Yönet" : "Giriş yap"}
                  </button>
                </div>
              );
            })}
            {!platformlar && <p className="mb-2 text-xs text-amber-200">Bot kapalı: bağlantılar okunamıyor.</p>}
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-3">
          <section aria-labelledby="hazir-baslik" className={`${kart} flex flex-col gap-3`}>
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="hazir-baslik" className="text-base font-semibold text-white">Yayına hazır mı?</h2>
              <span className="text-xs tabular-nums text-panel-muted">{hazirSayi} / {hazirlik.length}</span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {hazirlik.map((h) => (
                <li key={h.ad} className="flex items-start gap-2.5 text-sm text-white">
                  {h.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" strokeWidth={2.5} aria-label="Hazır" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-label="Eksik" />}
                  <span>
                    {h.ad}
                    {!h.ok && h.cozum ? (
                      <button type="button" className="block text-[13px] text-panel-accent underline" onClick={h.cozum.calistir}>{h.cozum.ad}</button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <button type="button" className="yya-btn-accent h-10 text-sm font-semibold" onClick={denetle}>Yeniden denetle</button>
          </section>

          <section aria-labelledby="obs-baslik" className={`${kart} flex flex-col gap-3`}>
            <div className="flex items-center gap-2">
              <h2 id="obs-baslik" className="text-base font-semibold text-white">OBS</h2>
              <span className="ml-auto">
                <StatusDot ok={status.connected} />
              </span>
            </div>
            <div className="grid grid-cols-[1fr_6rem] gap-2.5">
              <label className="block text-xs font-semibold text-panel-muted">
                Adres
                <input className={inputCls} value={host} onChange={(e) => setHost(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold text-panel-muted">
                Port
                <input className={inputCls} type="number" value={port} onChange={(e) => setPort(Number(e.target.value) || 4455)} />
              </label>
            </div>
            <label className="block text-xs font-semibold text-panel-muted">
              Parola
              <input className={inputCls} type="password" value={password} placeholder="••••••••" onChange={(e) => setPassword(e.target.value)} />
            </label>
            <details className="text-[13px] text-panel-muted">
              <summary className="flex min-h-8 cursor-pointer items-center">Bekletme süreleri ve bitiş kuralları</summary>
              <div className="mt-2 grid grid-cols-2 gap-2.5">
                <label className="block text-xs font-semibold">
                  Giriş bekletme (dk)
                  <input className={inputCls} type="number" min={1} value={startHoldMin} onChange={(e) => setStartHoldMin(Math.max(1, Number(e.target.value) || 5))} />
                </label>
                <label className="block text-xs font-semibold">
                  Çıkış bekletme (dk)
                  <input className={inputCls} type="number" min={1} value={endHoldMin} onChange={(e) => setEndHoldMin(Math.max(1, Number(e.target.value) || 2))} />
                </label>
              </div>
              {onObsPatch && <EndRulesEditor obs={sharedObs} legacy={legacyEnd} scenes={obsScenes} onChange={(endRules) => onObsPatch({ endRules })} />}
            </details>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!!busy} className="yya-btn-primary h-10 px-4 text-sm font-semibold" onClick={() => void saveAll()}>
                <Save className="mr-1.5 inline h-4 w-4" />
                {busy === "save" ? "Kaydediliyor…" : "Kaydet ve bağlan"}
              </button>
              {status.connected && (
                <button type="button" className="yya-btn-ghost h-10 px-3.5 text-sm font-medium" onClick={() => void obsControl.disconnect().then(setStatus)}>
                  <Unplug className="mr-1.5 inline h-4 w-4" />
                  Kes
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
