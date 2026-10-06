/**
 * OBS Studio sekmesi: yayın OBS'in kendi arayüzünde (sahneler, kaynaklar, filtreler, eklentiler) yapılır; bu uygulama
 * OBS'e dock olarak girer ve obs-websocket ile konuşur. Buradan OBS başlatılır, panel dock'ları OBS'e eklenir ve
 * websocket bağlantı bilgisi OBS'in kendi ayarından alınır.
 */
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Copy, LayoutPanelLeft, MonitorPlay, PlugZap, RefreshCw, XCircle } from "lucide-react";
import { API_BASE } from "../../lib/api";
import { copyText } from "../../lib/clipboard";

type Dock = { kimlik: string; baslik: string; url: string; ekli: boolean; onerilen: boolean };
type Durum = {
  kurulu: boolean;
  exe: string | null;
  surum: string | null;
  calisiyor: boolean;
  bagli: boolean;
  ayarDizini: string | null;
  websocket: { etkin: boolean; port: number; sifreGerekli: boolean } | null;
  docklar: Dock[];
};

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${yol}`, {
    method: govde === undefined ? "GET" : "POST",
    headers: govde === undefined ? undefined : { "Content-Type": "application/json" },
    body: govde === undefined ? undefined : JSON.stringify(govde),
    cache: "no-store",
  });
  if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
  return (await r.json()) as T;
}

function Rozet({ ok, evet, hayir }: { ok: boolean; evet: string; hayir: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
        ok ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border border-white/10 bg-white/5 text-white/70"
      }`}
    >
      {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {ok ? evet : hayir}
    </span>
  );
}

const KART = "rounded-2xl border border-white/[0.08] bg-panel-card/70 p-4 shadow-panel";
const BASLIK = "flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-white";

export default function ObsStudioPanel({ onToast }: { onToast: (m: string) => void }) {
  const [d, setD] = useState<Durum | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [secim, setSecim] = useState<Set<string>>(new Set());
  const [mesgul, setMesgul] = useState<string | null>(null);

  const yenile = useCallback(async () => {
    try {
      const x = await istek<Durum>("/api/obs-studio");
      setD(x);
      setHata(null);
      return x;
    } catch (e) {
      setHata(String((e as Error).message || e));
      return null;
    }
  }, []);

  useEffect(() => {
    void yenile().then((x) => {
      if (!x) return;
      // İlk açılışta: eklenmiş dock'lar, hiç yoksa önerilenler seçili gelir
      const ekli = x.docklar.filter((k) => k.ekli).map((k) => k.kimlik);
      setSecim(new Set(ekli.length ? ekli : x.docklar.filter((k) => k.onerilen).map((k) => k.kimlik)));
    });
    const t = window.setInterval(() => void yenile(), 4000);
    return () => window.clearInterval(t);
  }, [yenile]);

  const yap = async (ad: string, f: () => Promise<string>) => {
    setMesgul(ad);
    try {
      onToast(await f());
    } catch (e) {
      onToast(String((e as Error).message || e).slice(0, 300));
    } finally {
      setMesgul(null);
      void yenile();
    }
  };

  const obsAc = () =>
    yap("ac", async () => {
      const r = await istek<{ sonuc: string }>("/api/obs-studio/launch", {});
      return r.sonuc === "already" ? "OBS zaten açık" : "OBS başlatılıyor…";
    });

  const docklariYaz = (liste: string[]) =>
    yap("dock", async () => {
      const r = await istek<{ ekli: string[]; yedek: string | null }>("/api/obs-studio/docks", { docklar: liste });
      const yedek = r.yedek ? " (özgün ayarın yedeği alındı)" : "";
      return r.ekli.length
        ? `${r.ekli.length} dock OBS'e yazıldı${yedek}. OBS'i açınca Docklar menüsünde görünür.`
        : `Dock'lar OBS'ten kaldırıldı${yedek}.`;
    });

  const websocketAl = () =>
    yap("ws", async () => {
      const r = await istek<{ port: number; bagli: boolean; hata: string | null }>("/api/obs-studio/websocket/import", {});
      return r.bagli ? `OBS'e bağlanıldı (port ${r.port})` : `Bilgi alındı (port ${r.port}); ${r.hata ?? "OBS'e bağlanılamadı"}`;
    });

  const degistir = (k: string) =>
    setSecim((s) => {
      const y = new Set(s);
      if (y.has(k)) y.delete(k);
      else y.add(k);
      return y;
    });

  if (!d) {
    return <div className="p-6 text-sm text-panel-muted">{hata ? `OBS durumu okunamadı: ${hata}` : "OBS Studio aranıyor…"}</div>;
  }

  const ws = d.websocket;
  return (
    <div className="custom-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
      <section className={KART}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
          <h3 className={BASLIK}>
            <MonitorPlay className="h-4 w-4 text-panel-accent" /> OBS Studio
          </h3>
          <div className="flex flex-wrap gap-2">
            <Rozet ok={d.kurulu} evet={d.surum ? `Kurulu · ${d.surum}` : "Kurulu"} hayir="Kurulu değil" />
            <Rozet ok={d.calisiyor} evet="Açık" hayir="Kapalı" />
            <Rozet ok={d.bagli} evet="Bağlı" hayir="Bağlı değil" />
          </div>
        </div>
        <p className="text-sm text-white/80">
          Sahneler, kaynaklar, filtreler, kodlayıcılar ve eklentiler OBS'in kendi penceresinde. Bu uygulama OBS'e dock olarak girer
          (sohbet, etkinlikler, hızlı eylemler, müzik…) ve kısayollar, deste, bot ve otomasyonlar OBS'i obs-websocket üzerinden yönetir.
        </p>
        {!d.kurulu && (
          <p className="mt-2 text-sm text-amber-300">
            OBS Studio bulunamadı. obsproject.com'dan kurun ya da Ayarlar'da OBS yolunu verin.
          </p>
        )}
        {d.exe && <p className="mt-2 truncate font-mono text-xs text-white/60">{d.exe}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="yya-btn-primary h-9 px-4 text-sm font-bold" disabled={!d.kurulu || d.calisiyor || mesgul !== null} onClick={() => void obsAc()}>
            {d.calisiyor ? "OBS açık" : mesgul === "ac" ? "Başlatılıyor…" : "OBS'i aç"}
          </button>
          <button type="button" className="yya-btn-ghost h-9 px-3.5 text-sm font-bold" onClick={() => void yenile()}>
            <RefreshCw className="mr-1.5 inline h-3.5 w-3.5" /> Yenile
          </button>
        </div>
      </section>

      <section className={KART}>
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
          <h3 className={BASLIK}>
            <PlugZap className="h-4 w-4 text-panel-accent" /> obs-websocket
          </h3>
          <Rozet ok={!!ws?.etkin} evet={ws ? `Açık · ${ws.port}` : "Açık"} hayir="Kapalı" />
        </div>
        {!ws ? (
          <p className="text-sm text-white/80">OBS'in websocket ayarı bulunamadı. OBS'i bir kez açıp kapatın (OBS 28 ve sonrası gerekir).</p>
        ) : !ws.etkin ? (
          <p className="text-sm text-amber-300">OBS › Araçlar › WebSocket Sunucu Ayarları › "WebSocket sunucusunu etkinleştir"i açın.</p>
        ) : (
          <p className="text-sm text-white/80">
            Port {ws.port}
            {ws.sifreGerekli ? ", şifreli" : ", şifresiz"}. Panelde şifre girili değilse uygulama bu bilgiyi kendisi kullanır. Panelin OBS bağlantı
            ayarına yazmak için aşağıdaki düğmeye basın; şifre ekranda gösterilmez.
          </p>
        )}
        <div className="mt-3">
          <button type="button" className="yya-btn-accent h-9 px-4 text-sm font-bold" disabled={!ws?.etkin || mesgul !== null} onClick={() => void websocketAl()}>
            {mesgul === "ws" ? "Bağlanıyor…" : "Bağlantı bilgisini OBS'ten al"}
          </button>
        </div>
      </section>

      <section className={KART}>
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-white/[0.06] pb-2.5">
          <h3 className={BASLIK}>
            <LayoutPanelLeft className="h-4 w-4 text-panel-accent" /> OBS dock'ları
          </h3>
          <span className="text-xs font-bold uppercase tracking-wider text-white/70">{d.docklar.filter((k) => k.ekli).length} ekli</span>
        </div>
        <p className="mb-3 text-sm text-white/80">
          Seçtiğiniz paneller OBS'in Docklar menüsüne eklenir; yerlerini OBS'te sürükleyerek ayarlarsınız ve OBS hatırlar. Dock'ların çalışması için
          bu uygulama açık olmalı.
        </p>
        <ul className="grid gap-2 md:grid-cols-2">
          {d.docklar.map((k) => (
            <li key={k.kimlik} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/35 p-3">
              <input
                id={`dock-${k.kimlik}`}
                type="checkbox"
                className="h-4 w-4 accent-[var(--panel-accent)]"
                checked={secim.has(k.kimlik)}
                onChange={() => degistir(k.kimlik)}
              />
              <label htmlFor={`dock-${k.kimlik}`} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm font-bold text-white">{k.baslik.replace(/^YYA · /, "")}</span>
                <span className="block truncate font-mono text-[11px] text-white/55">{k.url}</span>
              </label>
              {k.ekli && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-label="OBS'te ekli" />}
              <button
                type="button"
                className="shrink-0 text-white/60 hover:text-white"
                title="Adresi kopyala (OBS › Docklar › Özel Tarayıcı Dock'ları)"
                aria-label={`${k.baslik} adresini kopyala`}
                onClick={() => void copyText(k.url).then((ok) => onToast(ok ? "Adres kopyalandı" : "Kopyalanamadı"))}
              >
                <Copy className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        {d.calisiyor && (
          <p className="mt-3 text-sm text-amber-300">
            OBS açıkken dock listesi yazılamaz (OBS kapanırken kendi ayarını yazar ve değişikliği ezer). OBS'i kapatın ya da dock'u elle ekleyin:
            adresi kopyalayıp OBS › Docklar › Özel Tarayıcı Dock'ları'na yapıştırın.
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="yya-btn-primary h-9 px-4 text-sm font-bold"
            disabled={d.calisiyor || !d.ayarDizini || mesgul !== null}
            onClick={() => void docklariYaz([...secim])}
          >
            {mesgul === "dock" ? "Yazılıyor…" : "Seçilenleri OBS'e ekle"}
          </button>
          <button
            type="button"
            className="yya-btn-ghost h-9 px-3.5 text-sm font-bold"
            disabled={d.calisiyor || !d.ayarDizini || mesgul !== null || !d.docklar.some((k) => k.ekli)}
            onClick={() => void docklariYaz([])}
          >
            Hepsini OBS'ten kaldır
          </button>
        </div>
      </section>
    </div>
  );
}
