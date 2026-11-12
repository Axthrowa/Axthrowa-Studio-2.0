/**
 * İlk kurulum sihirbazı (U1): OBS'e bağlan → platform bağla → sahneleri eşle → test uyarısı.
 * Son adım birleşik overlay'i OBS'e ekler. Her adım atlanabilir; "Bitir" ya da "Kurulumu atla" satırı menüden kaldırır.
 */
import { useEffect, useState } from "react";
import { Button } from "../axthrowa/Button";
import StatusDot from "../axthrowa/StatusDot";
import AxBotHost from "./AxBotHost";
import { useObs } from "../../lib/obs/ObsContext";
import { birlesikOverlayEkle, listScenes } from "../../lib/obs";
import { API_BASE, fetchSettings, overlayUrl, patchSettings } from "../../lib/api";
import { botApi } from "../../lib/api/botApi";
import { KURULUM_ADIMLARI, OVERLAY_KAYNAK_ADI, sahneTahmini, sahneYamalari, type SahneEslemesi } from "../../lib/kurulum";

type Props = { onToast: (m: string) => void; onBitti: () => void };

const ADIM_ADI = { obs: "OBS'e bağlan", platform: "Platform bağla", sahne: "Sahneleri eşle", test: "Test uyarısı" } as const;

const girdi = "h-9 w-full rounded-lg border border-white/[0.12] bg-[#12151e] px-3 text-sm text-white";
const etiket = "mb-1 block text-xs text-panel-muted";

export default function KurulumSihirbazi({ onToast, onBitti }: Props) {
  const [adim, setAdim] = useState(0);
  const obs = useObs();
  const [baglanti, setBaglanti] = useState({ host: "127.0.0.1", port: "4455", password: "" });
  const [sahneler, setSahneler] = useState<string[] | null>(null);
  const [esleme, setEsleme] = useState<SahneEslemesi>({});
  const [overlay, setOverlay] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const ad = KURULUM_ADIMLARI[adim];

  useEffect(() => {
    fetchSettings("panel")
      .then((p) => {
        const o = (p.obs || {}) as Record<string, unknown>;
        setBaglanti({ host: String(o.host || "127.0.0.1"), port: String(o.port || 4455), password: String(o.password || "") });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ad !== "sahne" || !obs.connected) return;
    listScenes()
      .then((s) => {
        setSahneler(s);
        setEsleme((e) => ({ ...sahneTahmini(s), ...Object.fromEntries(Object.entries(e).filter(([, v]) => v)) }));
      })
      .catch(() => setSahneler([]));
  }, [ad, obs.connected]);

  const obsBaglan = async () => {
    setMesgul(true);
    try {
      const cfg = { host: baglanti.host.trim() || "127.0.0.1", port: Number(baglanti.port) || 4455, password: baglanti.password };
      await obs.connect(cfg);
      await patchSettings("panel", { obs: cfg });
      onToast("OBS'e bağlanıldı");
    } catch {
      /* hata obs.lastError'da görünür */
    } finally {
      setMesgul(false);
    }
  };

  const sahneleriKaydet = async () => {
    const y = sahneYamalari(esleme);
    if (y.starting) await patchSettings("starting", y.starting);
    if (y.brb) await patchSettings("brb", y.brb);
  };

  const overlayEkle = async () => {
    setMesgul(true);
    try {
      const r = await birlesikOverlayEkle(overlayUrl(API_BASE, "overlay/master"), OVERLAY_KAYNAK_ADI);
      setOverlay(r.durum === "eklendi" ? `"${r.sahne}" sahnesine eklendi` : `OBS'te zaten var: ${r.kaynak}`);
    } catch (e) {
      onToast(`Overlay eklenemedi: ${(e as Error).message || e}`);
    } finally {
      setMesgul(false);
    }
  };

  const testGonder = async () => {
    try {
      const r = await botApi.testAlert({ kind: "follow", user: "TestUser" });
      onToast(r.ok ? "Test uyarısı gönderildi: OBS'te görünmeli" : "Test uyarısı gönderilemedi");
    } catch (e) {
      onToast(`Test uyarısı gönderilemedi: ${(e as Error).message || e}`);
    }
  };

  const bitir = async () => {
    try {
      await patchSettings("panel", { kurulumBitti: true });
    } catch {
      onToast("Kurulum durumu kaydedilemedi");
      return;
    }
    onBitti();
  };

  const ileri = async () => {
    if (ad === "sahne") await sahneleriKaydet().catch(() => onToast("Sahne eşlemesi kaydedilemedi"));
    setAdim((n) => Math.min(n + 1, KURULUM_ADIMLARI.length - 1));
  };

  const sahneSecici = (alan: keyof SahneEslemesi, metin: string) => (
    <label className="block">
      <span className={etiket}>{metin}</span>
      <select aria-label={metin} className={girdi} value={esleme[alan] || ""} onChange={(e) => setEsleme((s) => ({ ...s, [alan]: e.target.value || undefined }))}>
        <option value="">Seçilmedi</option>
        {(sahneler || []).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ol className="flex shrink-0 flex-wrap gap-1 border-b border-white/10 px-4 py-2" aria-label="Kurulum adımları">
        {KURULUM_ADIMLARI.map((a, i) => (
          <li key={a}>
            <button
              type="button"
              aria-current={i === adim ? "step" : undefined}
              onClick={() => setAdim(i)}
              className={`h-8 rounded-md px-3 text-sm font-semibold transition-colors ${i === adim ? "bg-white/10 text-white" : i < adim ? "text-panel-accent hover:text-white" : "text-panel-muted hover:text-white"}`}
            >
              {i + 1}. {ADIM_ADI[a]}
            </button>
          </li>
        ))}
      </ol>

      <div className={`min-h-0 flex-1 ${ad === "platform" ? "flex flex-col" : "custom-scrollbar overflow-y-auto p-6"}`}>
        {ad === "obs" ? (
          <section className="mx-auto flex max-w-md flex-col gap-3">
            <h2 className="text-lg font-semibold text-white">OBS'e bağlan</h2>
            <p className="text-sm text-panel-muted">OBS'te Araçlar → WebSocket Sunucu Ayarları'nı aç, sunucuyu etkinleştir; bağlantı bilgilerini buraya gir.</p>
            <label className="block">
              <span className={etiket}>Adres</span>
              <input className={girdi} value={baglanti.host} onChange={(e) => setBaglanti((b) => ({ ...b, host: e.target.value }))} />
            </label>
            <label className="block">
              <span className={etiket}>Port</span>
              <input className={girdi} inputMode="numeric" value={baglanti.port} onChange={(e) => setBaglanti((b) => ({ ...b, port: e.target.value }))} />
            </label>
            <label className="block">
              <span className={etiket}>Parola</span>
              <input className={girdi} type="password" autoComplete="off" value={baglanti.password} onChange={(e) => setBaglanti((b) => ({ ...b, password: e.target.value }))} />
            </label>
            <div className="flex items-center gap-3">
              <Button loading={mesgul || obs.connecting} onClick={() => void obsBaglan()}>
                Bağlan
              </Button>
              <StatusDot ok={obs.connected} label={obs.connected ? "Bağlı" : "Bağlı değil"} />
            </div>
            {obs.lastError && !obs.connected ? <p role="alert" className="text-sm text-red-300">{obs.lastError}</p> : null}
          </section>
        ) : ad === "platform" ? (
          <AxBotHost onToast={onToast} tab="platforms" embed />
        ) : ad === "sahne" ? (
          <section className="mx-auto flex max-w-md flex-col gap-3">
            <h2 className="text-lg font-semibold text-white">Sahneleri eşle</h2>
            <p className="text-sm text-panel-muted">Ekranlar açılınca OBS hangi sahneye geçsin? Sonradan Sahne → Ekranlar'dan değiştirebilirsin.</p>
            {!obs.connected ? (
              <p className="text-sm text-amber-200">
                Önce OBS'e bağlan.{" "}
                <button type="button" className="font-semibold text-panel-accent" onClick={() => setAdim(0)}>
                  1. adıma dön
                </button>
              </p>
            ) : sahneler === null ? (
              <p className="text-sm text-panel-muted">Sahneler okunuyor…</p>
            ) : (
              <>
                {sahneSecici("giris", "Giriş ekranı")}
                {sahneSecici("oyun", "Oyun / canlı sahne")}
                {sahneSecici("mola", "Mola ekranı")}
              </>
            )}
          </section>
        ) : (
          <section className="mx-auto flex max-w-md flex-col gap-3">
            <h2 className="text-lg font-semibold text-white">Test uyarısı</h2>
            <p className="text-sm text-panel-muted">
              Uyarılar, sohbet ve widget'lar tek bir tarayıcı kaynağında gelir. Önce OBS'e ekle, sonra bir test uyarısı gönder.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" disabled={!obs.connected} loading={mesgul} onClick={() => void overlayEkle()}>
                Overlay'i OBS'e ekle
              </Button>
              {overlay ? <span className="text-sm text-emerald-300">{overlay}</span> : !obs.connected ? <span className="text-sm text-panel-muted">OBS bağlı değil</span> : null}
            </div>
            <div>
              <Button onClick={() => void testGonder()}>Test uyarısı gönder</Button>
            </div>
          </section>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <button type="button" className="text-sm text-panel-muted hover:text-white" onClick={() => void bitir()}>
          Kurulumu atla
        </button>
        <div className="flex gap-2">
          {adim > 0 ? (
            <Button variant="ghost" onClick={() => setAdim((n) => n - 1)}>
              Geri
            </Button>
          ) : null}
          {ad === "test" ? <Button onClick={() => void bitir()}>Bitir</Button> : <Button onClick={() => void ileri()}>{ad === "obs" && !obs.connected ? "Atla" : "İleri"}</Button>}
        </div>
      </div>
    </div>
  );
}
