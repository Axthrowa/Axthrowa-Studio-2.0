import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { ExternalLink, Loader2, Play, RefreshCw, Square } from "lucide-react";
import { openExternal } from "../../lib/openExternal";
import { frameOrigin, komutPaletiRequest, openExternalRequest, openMusicRequest, temaIstegi } from "../../lib/embedMessages";
import { botTemaMesaji, renkleriOku } from "../../lib/botTemaMesaji";
import { PALET_AC_OLAYI } from "./KomutPaleti";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { cn } from "../../lib/cn";
import { streamaxtStatus as getStatus, type StreamAxtStatus } from "../../lib/streamaxt";

export type { StreamAxtStatus };

/**
 * Bot sekmesi: AxBoT'u (ayrı Node sunucusu) gömer. Sunucuyu Rust başlatır;
 * burada durum izlenir, gerekirse başlat/durdur/yeniden başlat sunulur.
 */
export type StreamAxtHostProps = {
  onToast?: (msg: string) => void;
  /** AxBoT'un hangi sekmesi açılsın (ör. "multichat"). */
  tab?: string;
  /** AxBoT'un kendi kenar çubuğu gizlensin (tek sekme gömerken). */
  embed?: boolean;
  /** AxBoT "Resonance'ı aç" dediğinde panelin Müzik sekmesine geç. */
  onOpenMusic?: () => void;
};

/** Gömülecek adres: `#sekme` açılış sekmesini, `?embed=1` kenar çubuğunu belirler. */
export function frameUrl(base: string, tab?: string, embed?: boolean): string {
  const clean = base.replace(/[#?].*$/, "");
  return `${clean}${embed ? "?embed=1" : ""}${tab ? `#${tab}` : ""}`;
}

export default function StreamAxtHost({ onToast, tab, embed, onOpenMusic }: StreamAxtHostProps) {
  const [st, setSt] = useState<StreamAxtStatus | null>(null);
  const [busy, setBusy] = useState<null | "start" | "stop">(null);
  const [error, setError] = useState<string | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  // Sayfa gelene kadar boş ekran yerine yükleniyor yazısı (#sekme değişimi sayfayı yeniden yüklemez)
  const [yuklendi, setYuklendi] = useState(false);
  useEffect(() => setYuklendi(false), [frameKey, embed]);
  const triedAuto = useRef(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const expectedOrigin = st ? frameOrigin(st.url) : null;

  const temaGonder = useCallback(() => {
    const win = frameRef.current?.contentWindow;
    if (!win || !expectedOrigin) return;
    const kok = document.documentElement;
    win.postMessage(
      botTemaMesaji(renkleriOku((ad) => getComputedStyle(kok).getPropertyValue(ad), kok.dataset.kose ?? null)),
      expectedOrigin,
    );
  }, [expectedOrigin]);

  const refresh = useCallback(async () => {
    try {
      setSt(await getStatus());
    } catch (e) {
      setError(String(e));
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setVisibleInterval(() => void refresh(), 10000);
    return () => clearVisibleInterval(id);
  }, [refresh]);

  const start = useCallback(async () => {
    if (!isTauri()) return;
    setBusy("start");
    setError(null);
    try {
      setSt(await invoke<StreamAxtStatus>("streamaxt_start"));
      setFrameKey((k) => k + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  }, []);

  const stop = useCallback(
    async (force: boolean) => {
      if (!isTauri()) return;
      setBusy("stop");
      setError(null);
      try {
        setSt(await invoke<StreamAxtStatus>("streamaxt_stop", { force }));
      } catch (e) {
        setError(String(e));
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  // Gömülü AxBoT'tan gelen "dış bağlantı aç" isteği.
  //
  // iframe içinde `target="_blank"` / `window.open` çalışmıyor; AxBoT
  // açamadığı adresi üst pencereye bildiriyor, biz işletim sisteminin
  // tarayıcısında açıyoruz ("OBS Alert Önizle" gibi düğmeler bu yüzden
  // hiçbir şey yapmıyormuş gibi görünüyordu). Yalnız BU çerçeveden ve
  // AxBoT kökeninden gelen http(s) istekleri kabul edilir
  // (`lib/embedMessages.ts`).
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      if (temaIstegi(ev, frameRef.current?.contentWindow, expectedOrigin)) {
        temaGonder();
        return;
      }
      if (openMusicRequest(ev, frameRef.current?.contentWindow, expectedOrigin)) {
        onOpenMusic?.();
        return;
      }
      if (komutPaletiRequest(ev, frameRef.current?.contentWindow, expectedOrigin)) {
        window.dispatchEvent(new Event(PALET_AC_OLAYI));
        return;
      }
      const url = openExternalRequest(ev, frameRef.current?.contentWindow, expectedOrigin);
      if (!url) return;
      void openExternal(url).then((sonuc) => {
        if (sonuc === "copied") onToast?.("Tarayıcı açılamadı — adres kopyalandı");
        else if (sonuc === "failed") onToast?.("Adres açılamadı: " + url);
      });
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onToast, expectedOrigin, onOpenMusic, temaGonder]);

  useEffect(() => {
    if (!yuklendi) return;
    temaGonder();
    const goz = new MutationObserver(() => temaGonder());
    goz.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin", "data-kose"] });
    return () => goz.disconnect();
  }, [yuklendi, temaGonder, frameKey]);

  // Sekme ilk açıldığında kurulu ama kapalıysa (ve elle durdurulmadıysa) bir kez başlat.
  useEffect(() => {
    if (!st || triedAuto.current) return;
    if (st.installed && st.node && !st.running && !st.disabled) {
      triedAuto.current = true;
      void start();
    }
  }, [st, start]);

  if (!st) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-white/60">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> AxBoT denetleniyor…
      </div>
    );
  }

  if (isTauri() && !st.installed) {
    return (
      <Notice
        title="AxBoT bulunamadı"
        body="Uygulamanın yanında `streamaxt` klasörü olmalı. Hazırlamak için proje klasöründe şunu çalıştırın:"
        code="node scripts/streamaxt-hazirla.mjs"
      />
    );
  }
  if (isTauri() && !st.node) {
    return (
      <Notice
        title="Node.js gerekli"
        body="AxBoT, Node.js 22 veya üstünü gerektirir. nodejs.org üzerinden kurup uygulamayı yeniden açın."
      />
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {/* Gömülü sayfalarda sunucu şeridi gerekmez: bot çalışıyorsa yer kaplamasın ("Tüm ayarlar"da görünür) */}
      <div className={cn("flex shrink-0 items-center gap-2 px-3 py-1.5 text-[11px] text-white/70", embed && st.running && "hidden")}>
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            st.running ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-amber-400",
          )}
        />
        <span className="font-semibold text-white">AxBoT</span>
        <span className="font-mono text-cyan-300/90">127.0.0.1:{st.port}</span>
        {st.external && <span className="rounded bg-white/[0.06] px-1.5 py-0.5">harici örnek</span>}
        <div className="ml-auto flex items-center gap-1">
          <Small onClick={() => setFrameKey((k) => k + 1)} title="Sayfayı yenile" icon={<RefreshCw className="h-3 w-3" />} />
          <Small
            onClick={() => void openExternal(frameUrl(st.url, tab))}
            title="Tarayıcıda aç"
            icon={<ExternalLink className="h-3 w-3" />}
          />
          {isTauri() &&
            (st.running ? (
              <Small
                onClick={() => void stop(st.external)}
                title={st.external ? "Harici örneği kapat" : "AxBoT'u durdur"}
                icon={busy === "stop" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
              />
            ) : (
              <Small
                onClick={() => void start()}
                title="AxBoT'u başlat"
                icon={busy === "start" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
              />
            ))}
        </div>
      </div>

      {st.external && isTauri() && (
        <div className="mx-3 mb-1.5 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-200">
          <span className="min-w-0 flex-1">
            {st.port} portunda uygulamanın başlatmadığı bir AxBoT çalışıyor; eski arayüzü gösterebilir.
          </span>
          <button
            type="button"
            className="shrink-0 rounded-md bg-amber-400/20 px-2 py-1 font-semibold hover:bg-amber-400/30"
            onClick={() => {
              void stop(true).then(() => start());
              onToast?.("Harici AxBoT kapatılıp yerleşik sürüm başlatılıyor…");
            }}
          >
            Kapat ve yerleşik sürümü başlat
          </button>
        </div>
      )}

      {error && (
        <pre className="mx-3 mb-1.5 max-h-28 overflow-auto whitespace-pre-wrap rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
          {error}
        </pre>
      )}

      {st.running && !yuklendi ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-panel-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Yükleniyor…
        </div>
      ) : null}
      {st.running ? (
        <iframe
          key={frameKey}
          onLoad={() => setYuklendi(true)}
          ref={frameRef}
          title="AxBoT"
          src={frameUrl(st.url, tab, embed)}
          className="min-h-0 w-full flex-1 border-0 bg-[#090b10]"
          // microphone: Sesli Komutlar sayfasında "Bu pencerede dinle" ve mikrofon listesi
          allow="clipboard-write; autoplay; fullscreen; microphone"
        />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-white/70">
          {busy === "start" ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
              AxBoT başlatılıyor…
            </>
          ) : (
            <>
              <p>AxBoT kapalı{st.disabled ? " (elle durduruldu)" : ""}.</p>
              {isTauri() && (
                <button
                  type="button"
                  onClick={() => void start()}
                  className="rounded-xl bg-gradient-to-r from-cyan-400 to-teal-400 px-4 py-2 text-xs font-bold text-[#022227] shadow-[0_0_15px_rgba(62,237,254,0.3)]"
                >
                  Başlat
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Small({ onClick, title, icon }: { onClick: () => void; title: string; icon: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="flex h-6 w-6 items-center justify-center rounded-md text-white/70 hover:bg-white/[0.08] hover:text-white"
    >
      {icon}
    </button>
  );
}

function Notice({ title, body, code }: { title: string; body: string; code?: string }) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="max-w-md rounded-2xl bg-white/[0.04] p-5 text-center ring-1 ring-white/10">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-white/70">{body}</p>
        {code && (
          <code className="mt-3 block rounded-lg bg-black/40 px-3 py-2 font-mono text-[11px] text-cyan-300">{code}</code>
        )}
      </div>
    </div>
  );
}
