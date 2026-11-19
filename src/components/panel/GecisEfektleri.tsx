/**
 * Geçiş efektleri (stinger) galerisi — OBS Studio sekmesinin içinde.
 *
 * Dokuz özgün stinger uygulamayla gelir (saydam VP9 WebM, 1920×1080). "OBS'e uygula" videoyu veri klasörüne
 * yazar, OBS'teki Stinger geçişinin dosyasını ve geçiş noktasını ayarlar ve onu etkin geçiş yapar.
 * obs-websocket yeni geçiş oluşturamadığı için OBS'te bir kez Stinger geçişi eklenmesi gerekir; yoksa adımlar gösterilir.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Clapperboard, Play, RefreshCw } from "lucide-react";
import { API_BASE } from "../../lib/api";

type Gecis = { id: string; ad: string; aciklama: string; sureMs: number; noktaMs: number };
type Liste = { gecisler: Gecis[]; obsBagli: boolean; stingerler: string[] | null; hata: string | null };

const KART = "rounded-2xl border border-white/[0.08] bg-panel-card/70 p-4 shadow-panel";
/** Saydamlığı göstermek için dama zemin (filtresiz, ucuz) */
const DAMA = {
  backgroundColor: "#1a1d24",
  backgroundImage:
    "linear-gradient(45deg,#232733 25%,transparent 25%,transparent 75%,#232733 75%),linear-gradient(45deg,#232733 25%,transparent 25%,transparent 75%,#232733 75%)",
  backgroundSize: "16px 16px",
  backgroundPosition: "0 0,8px 8px",
} as const;

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

function GecisKarti({ g, secili, onSec }: { g: Gecis; secili: boolean; onSec: () => void }) {
  const video = useRef<HTMLVideoElement | null>(null);
  const [oynuyor, setOynuyor] = useState(false);
  const oynat = () => {
    const v = video.current;
    if (!v) return;
    v.currentTime = 0;
    setOynuyor(true);
    void v.play().catch(() => setOynuyor(false));
  };
  return (
    <li>
      <button
        type="button"
        onClick={onSec}
        onMouseEnter={oynat}
        onFocus={oynat}
        aria-pressed={secili}
        className={`group block w-full overflow-hidden rounded-xl border text-left transition ${
          secili ? "border-[var(--panel-accent)] ring-2 ring-[var(--panel-accent)]/40" : "border-white/[0.08] hover:border-white/25"
        }`}
      >
        <div className="relative aspect-video" style={DAMA}>
          <img
            src={`${API_BASE}/api/gecisler/${g.id}/onizleme`}
            alt=""
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover ${oynuyor ? "opacity-0" : ""}`}
          />
          <video
            ref={video}
            src={`${API_BASE}/api/gecisler/${g.id}/video`}
            muted
            playsInline
            preload="none"
            onEnded={() => setOynuyor(false)}
            className={`absolute inset-0 h-full w-full object-cover ${oynuyor ? "" : "opacity-0"}`}
          />
          {!oynuyor && (
            <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-ui-2 text-white/80">
              <Play className="h-3 w-3" /> Önizle
            </span>
          )}
        </div>
        <div className="p-2.5">
          <span className="block text-sm font-bold text-white">{g.ad}</span>
          <span className="mt-0.5 block text-ui-2 leading-snug text-white/60">{g.aciklama}</span>
          <span className="mt-1 block font-mono text-ui-2 text-white/45">
            {(g.sureMs / 1000).toFixed(2)} sn · geçiş noktası {g.noktaMs} ms
          </span>
        </div>
      </button>
    </li>
  );
}

export default function GecisEfektleri({ onToast }: { onToast: (m: string) => void }) {
  const [l, setL] = useState<Liste | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [secili, setSecili] = useState<string>("");
  const [hedef, setHedef] = useState<string>("");
  const [mesgul, setMesgul] = useState(false);

  const yenile = useCallback(async () => {
    try {
      const x = await istek<Liste>("/api/gecisler");
      setL(x);
      setHata(null);
      setSecili((s) => s || x.gecisler[0]?.id || "");
      setHedef((h) => (h && x.stingerler?.includes(h) ? h : x.stingerler?.[0] || ""));
    } catch (e) {
      setHata(String((e as Error).message || e));
    }
  }, []);

  useEffect(() => {
    void yenile();
  }, [yenile]);

  const uygula = async () => {
    const g = l?.gecisler.find((x) => x.id === secili);
    if (!g) return;
    setMesgul(true);
    try {
      const r = await istek<{ gecis: string }>("/api/gecisler/uygula", { id: g.id, gecis: hedef || undefined });
      onToast(`OBS'teki «${r.gecis}» geçişi artık «${g.ad}»`);
    } catch (e) {
      onToast(String((e as Error).message || e));
    } finally {
      setMesgul(false);
      void yenile();
    }
  };

  const stingerYok = l?.obsBagli && l.stingerler !== null && l.stingerler.length === 0;

  return (
    <section className={KART} aria-labelledby="gecis-efektleri-baslik">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 id="gecis-efektleri-baslik" className="flex items-center gap-2 text-sm font-bold axt-etiket text-white">
          <Clapperboard className="h-4 w-4" /> Geçiş efektleri (stinger)
        </h2>
        <button type="button" className="text-white/60 hover:text-white" aria-label="Yenile" title="OBS'teki geçişleri yeniden oku" onClick={() => void yenile()}>
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>
      <p className="mb-3 text-sm text-white/80">
        Sahne değiştirirken ekranı kısa bir animasyonla örten hazır geçişler. Üzerine gelince önizlenir; birini seçip OBS'e uygulayın. Sahne,
        animasyon ekranı tam kapattığı anda değişir.
      </p>
      {hata && <p className="mb-3 text-sm text-red-300">{hata}</p>}
      {l && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {l.gecisler.map((g) => (
              <GecisKarti key={g.id} g={g} secili={g.id === secili} onSec={() => setSecili(g.id)} />
            ))}
          </ul>

          {!l.obsBagli && <p className="mt-3 text-sm text-amber-300">OBS bağlı değil: uygulamak için önce OBS'i açıp bağlayın.</p>}
          {stingerYok && (
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">
              <p className="font-bold">OBS'te henüz Stinger geçişi yok</p>
              <p className="mt-1 text-amber-100/85">
                OBS, dışarıdan yeni geçiş eklenmesine izin vermiyor; bir kez elle ekleyin: OBS › Sahne Geçişleri paneli › <b>+</b> › <b>Stinger</b> ›
                bir ad verin (dosya seçmeniz gerekmez) › Tamam. Ardından burada yenileyip «OBS'e uygula»ya basın.
              </p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {l.stingerler && l.stingerler.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-white/80">
                OBS geçişi
                <select
                  className="h-9 rounded-lg border border-white/10 bg-black/40 px-2 text-sm text-white"
                  value={hedef}
                  onChange={(e) => setHedef(e.target.value)}
                >
                  {l.stingerler.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="studio-btn-primary h-9 px-4 text-sm font-bold"
              disabled={!secili || !l.obsBagli || stingerYok || mesgul}
              onClick={() => void uygula()}
            >
              {mesgul ? "Uygulanıyor…" : "OBS'e uygula"}
            </button>
            <span className="text-ui-2 text-white/50">OBS bu bilgisayarda çalışmalı (video dosyası buradan okunur).</span>
          </div>
        </>
      )}
    </section>
  );
}
