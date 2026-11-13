import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import CopyUrl from "@/components/axthrowa/CopyUrl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerStatus } from "../../lib/api";
import { fetchPlayerStatus, sendPlayerCommand } from "../../lib/api";
import { useNowPlaying } from "../../lib/useNowPlaying";
import { useI18n } from "../../i18n";
import { frameOrigin, temaIstegi } from "../../lib/embedMessages";
import { botTemaMesaji, renkleriOku } from "../../lib/botTemaMesaji";
import type { MsgKey } from "../../i18n/messages";
import { Heart, LinkSimple, ListPlus, Prohibit } from "@phosphor-icons/react";
import { nesneMenusu, type MenuOgesi } from "../axthrowa/SagTikMenusu";
import { axbotBase } from "../../lib/axbot";

type Props = {
  baseUrl: string;
  onToast: (m: string) => void;
  onOpenExternal: (url: string) => void | Promise<void>;
};

const TAB_DEFS = [
  { id: "pulse", labelKey: "music.widget" as MsgKey, path: "/resonance/dashboard/widgets/pulse" },
  { id: "connections", labelKey: "music.connections" as MsgKey, path: "/resonance/dashboard/connections/music" },
  { id: "home", labelKey: "music.general" as MsgKey, path: "/resonance/dashboard/home" },
] as const;

/**
 * Resonance paneli — AxthrowA
 */
export default function MusicPanel({ baseUrl, onToast, onOpenExternal }: Props) {
  const { t } = useI18n();
  const [tab, setTab] = useState<(typeof TAB_DEFS)[number]["id"]>("pulse");
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const { track, progress } = useNowPlaying(true);

  const base = useMemo(() => baseUrl.replace(/\/$/, ""), [baseUrl]);
  const overlayUrl = `${base}/resonance/overlay`;
  const TABS = TAB_DEFS;

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchPlayerStatus());
    } catch {
      /* sunucu yeniden başlıyor olabilir */
    }
  }, []);

  // Studio teması gömülü Resonance'a da gider: çerçeve hazır olunca ister, tema değişince yeniden gönderilir
  useEffect(() => {
    const kok = frameOrigin(base);
    if (!kok) return;
    const gonder = () => {
      const el = document.documentElement;
      frameRef.current?.contentWindow?.postMessage(
        botTemaMesaji(renkleriOku((ad) => getComputedStyle(el).getPropertyValue(ad), el.dataset.kose ?? null)),
        kok,
      );
    };
    const dinle = (ev: MessageEvent) => temaIstegi(ev, frameRef.current?.contentWindow, kok) && gonder();
    window.addEventListener("message", dinle);
    const goz = new MutationObserver(gonder);
    goz.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin", "data-kose"] });
    return () => {
      window.removeEventListener("message", dinle);
      goz.disconnect();
    };
  }, [base]);

  useEffect(() => {
    void refresh();
    const timer = setVisibleInterval(() => void refresh(), 10000);
    return () => clearVisibleInterval(timer);
  }, [refresh]);

  // Resonance paketlenmemişse iframe sessizce boş kalır; kullanıcıya söyle.
  useEffect(() => {
    let cancelled = false;
    // Yalnız r.ok yetmez: Resonance'sız sunucu bu yola Studio'nun kendi index.html'ini döndürür ve çerçevede uygulama kendini açar.
    fetch(`${base}/resonance/dashboard/home`, { cache: "no-store" })
      .then(async (r) => r.ok && (await r.text()).includes("<title>Resonance</title>"))
      .then((resonanceVar) => !cancelled && setAvailable(resonanceVar))
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, [base]);

  // Spotify onay sayfası iframe'e yüklenemez (X-Frame-Options); gömülü
  // Resonance bize haber verir, biz sistem tarayıcısında açarız.
  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      const data = ev.data as { source?: string; type?: string; url?: string };
      if (data?.source !== "resonance") return;
      if (data.type === "open-external" && data.url) {
        void onOpenExternal(data.url);
      } else if (data.type === "changed") {
        void refresh();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onOpenExternal, refresh]);

  const source = track?.source || status?.source || "spotify";

  const command = async (action: string) => {
    setBusy(true);
    try {
      await sendPlayerCommand(action, source);
    } catch (e) {
      onToast(String((e as Error).message || "Komut gönderilemedi"));
    } finally {
      setBusy(false);
    }
  };

  const pct = track?.duration ? Math.min(100, (progress / track.duration) * 100) : 0;

  // Tablo A7 — şu an çalan: Beğen · Çalma listesine ekle · Sanatçıyı engelle · Bağlantıyı kopyala
  const kitaplik = async (eylem: "like" | "playlistAdd", tamam: string) => {
    try {
      await sendPlayerCommand(eylem);
      onToast(tamam);
    } catch (e) {
      onToast(String((e as Error).message || e).slice(0, 200));
    }
  };
  const calanMenusu = (): MenuOgesi[] => {
    if (!track) return [];
    const spotify = track.source === "spotify" && !!track.url;
    const sanatci = track.artist.split(",")[0].trim();
    return [
      { ad: "Beğen", ikon: Heart, kapali: !spotify, yap: () => void kitaplik("like", `${track.title}: Spotify'da beğenildi`) },
      { ad: "Çalma listesine ekle", ikon: ListPlus, kapali: !spotify, yap: () => void kitaplik("playlistAdd", `${track.title}: "AxthrowA Yayın" listesine eklendi`) },
      {
        ad: "Sanatçıyı engelle",
        ikon: Prohibit,
        kapali: sanatci.length < 2,
        onay: true,
        ayrac: true,
        yap: () =>
          void (async () => {
            try {
              const r = await fetch(`${await axbotBase()}/api/songrequest/engel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metin: sanatci }) });
              const d = (await r.json().catch(() => ({}))) as { eklendi?: boolean; error?: string };
              onToast(!r.ok ? d.error || `HTTP ${r.status}` : d.eklendi ? `${sanatci}: şarkı isteklerinde engellendi` : `${sanatci} zaten engelli`);
            } catch {
              onToast("AxBoT'a ulaşılamadı");
            }
          })(),
      },
      { ad: "Bağlantıyı kopyala", ikon: LinkSimple, kapali: !track.url, yap: () => void navigator.clipboard.writeText(track.url || "").then(() => onToast("Şarkı bağlantısı kopyalandı")).catch(() => onToast("Panoya yazılamadı")) },
    ];
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[360px_1fr]">
      <aside className="max-h-[calc(100vh-140px)] space-y-4 overflow-y-auto rounded-xl border border-panel-border bg-panel-card p-4">
        <div>
          <h2 className="text-sm font-semibold">Müzik kaynağı</h2>
          <div className="mt-2 rounded-md bg-panel-accent px-3 py-2 text-sm text-black">
            Otomatik — {source === "youtube-music" ? "YouTube Music" : "Spotify"}
          </div>
          <p className="mt-2 text-[11px] text-panel-muted">
            Hangisinde müzik çalıyorsa widget o kaynağa geçer.
          </p>
          <div className="mt-2 space-y-1 text-xs text-panel-muted">
            <p className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status?.spotify.connected ? "bg-emerald-400" : "bg-white/25"
                }`}
              />
              Spotify
              {status?.spotify.connected
                ? status.spotify.displayName
                  ? ` — ${status.spotify.displayName}`
                  : " bağlı"
                : " bağlı değil"}
            </p>
            <p className="flex items-center gap-2">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  status?.ytmd.connected ? "bg-emerald-400" : "bg-white/25"
                }`}
              />
              YouTube Music
              {status?.ytmd.connected
                ? ` bağlı (${status.ytmd.host}:${status.ytmd.port})`
                : " bağlı değil"}
            </p>
          </div>
          {status?.note && <p className="mt-1 text-xs text-amber-300">{status.note}</p>}
        </div>

        <hr className="border-panel-border" />

        <div>
          <h2 className="text-sm font-semibold">Şu an çalıyor</h2>
          <div
            tabIndex={track ? 0 : undefined}
            onContextMenu={nesneMenusu(calanMenusu)}
            aria-label={track ? `Şu an çalıyor: ${track.title} — ${track.artist}` : undefined}
            className="mt-2 flex gap-3 rounded-lg border border-panel-border bg-black/30 p-3 outline-none focus-visible:ring-1 focus-visible:ring-panel-accent/60"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-black/50">
              {track?.albumArt ? (
                <img src={track.albumArt} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{track?.title || "—"}</p>
              <p className="truncate text-xs text-panel-muted">{track?.artist || "Çalan bir şey yok"}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-panel-accent" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              disabled={busy}
              className="rounded-md bg-black/40 px-2 py-2 text-sm disabled:opacity-50"
              onClick={() => void command("previous")}
            >
              ⏮ Önceki
            </button>
            <button
              disabled={busy}
              className="rounded-md bg-panel-accent px-2 py-2 text-sm text-black disabled:opacity-50"
              onClick={() => void command("playPause")}
            >
              {track?.isPlaying ? "⏸ Duraklat" : "▶ Oynat"}
            </button>
            <button
              disabled={busy}
              className="rounded-md bg-black/40 px-2 py-2 text-sm disabled:opacity-50"
              onClick={() => void command("next")}
            >
              ⏭ Sonraki
            </button>
          </div>
          <p className="mt-2 text-[11px] text-panel-muted">
            Spotify'da oynatma kontrolü Premium hesap ve açık bir cihaz gerektirir.
          </p>
        </div>

        <hr className="border-panel-border" />

        <div>
          <h2 className="text-sm font-semibold">Overlay</h2>
          <p className="mt-1 text-[11px] text-panel-muted">
            Şarkı bilgisi Giriş / Mola / Çıkış ekranlarındaki “Şimdi Çalıyor” widget’ında görünür.
            Görünürlüğü ve konumu ilgili ekranın ayarlarından değiştirin.
          </p>
          <CopyUrl url={overlayUrl} className="mt-2" />
          <button
            className="mt-2 w-full rounded-md bg-black/40 px-3 py-2 text-xs"
            onClick={() => void onOpenExternal(`${base}/resonance/`)}
          >
            Resonance’ı tarayıcıda aç
          </button>
        </div>
      </aside>

      <section className="overflow-hidden rounded-xl border border-panel-border bg-black">
        <div className="flex items-center gap-2 border-b border-panel-border px-3 py-2 text-xs">
          {TABS.map((item) => (
            <button
              key={item.id}
              className={`rounded px-2 py-1 ${tab === item.id ? "bg-panel-accent text-black" : "bg-black/40 text-panel-muted"}`}
              onClick={() => setTab(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
          <span className="ml-auto text-panel-muted">Resonance — uygulama içinde</span>
        </div>
        <div className="h-[calc(100vh-190px)] w-full bg-[#0b0d13]">
          {available === false ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-panel-muted">
              Resonance paketi bulunamadı. Uygulamayı <code className="mx-1 text-white/70">npm run build:all</code>
              ile yeniden derleyin ya da portable klasöründe <code className="mx-1 text-white/70">resonance/dist</code> olduğundan emin olun.
            </div>
          ) : (
            <iframe
              ref={frameRef}
              title="Resonance"
              src={`${base}${TABS.find((t) => t.id === tab)!.path}`}
              className="h-full w-full border-0"
            />
          )}
        </div>
      </section>
    </div>
  );
}
