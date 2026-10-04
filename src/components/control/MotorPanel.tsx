/**
 * Yayın motoru paneli — yerel yayın çekirdeği (libobs, ayrı süreç).
 *
 * Tuval önizlemeleri, kaynak ekleme/silme, hedef başına tuval seçimi ve bağımsız başlat/durdur. Kaynakları ve tuvalleri
 * çekirdek işler; bu bileşen yalnız `/api/motor` uçlarını çağırır (izin + denetim sunucuda).
 */
import { tuvalAdi } from "../../lib/tuvaller";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cpu, Play, Plus, Square, Trash2 } from "lucide-react";
import { CIKIS_DURUM_ETIKETI, hedefBaslatilabilir, KAYNAK_TURLERI, motorApi, type MotorDurumu, type MotorKaynakTuru } from "../../lib/api/motor";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";

const DURUM_RENGI: Record<string, string> = {
  canli: "border-emerald-400/50 bg-emerald-500/15 text-emerald-200",
  baglaniyor: "border-sky-400/50 bg-sky-500/15 text-sky-200",
  yeniden_baglaniyor: "border-amber-400/50 bg-amber-500/15 text-amber-200",
  basarisiz: "border-red-400/50 bg-red-500/15 text-red-200",
};

function hata(e: unknown): string {
  return String((e as Error)?.message || e).slice(0, 200);
}

/** Tuval önizlemesi: görünürken saniyede bir kare çeker; kare hazır değilse öncekini tutar. */
function Onizleme({ tuval, oran }: { tuval: string; oran: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const onceki = useRef<string | null>(null);
  useEffect(() => {
    let iptal = false;
    const cek = () =>
      motorApi
        .onizleme(tuval, 480)
        .then((b) => {
          if (iptal || !b) return;
          const yeni = URL.createObjectURL(b);
          if (onceki.current) URL.revokeObjectURL(onceki.current);
          onceki.current = yeni;
          setUrl(yeni);
        })
        .catch(() => {});
    void cek();
    const id = setVisibleInterval(cek, 1000);
    return () => {
      iptal = true;
      clearVisibleInterval(id);
      if (onceki.current) URL.revokeObjectURL(onceki.current);
      onceki.current = null;
    };
  }, [tuval]);
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex items-center justify-center overflow-hidden rounded-md border border-white/10 bg-black/40"
        style={{ aspectRatio: oran, height: 150 }}
      >
        {url ? (
          <img src={url} alt={`${tuval} tuvali önizlemesi`} className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] text-panel-muted">hazırlanıyor…</span>
        )}
      </div>
      <span className="text-[10px] text-panel-muted">{tuval === "ana" ? "Yatay 1920×1080" : "Dikey 1080×1920"}</span>
    </div>
  );
}

export function MotorPanel({ onToast }: { onToast: (m: string) => void }) {
  const [d, setD] = useState<MotorDurumu | null>(null);
  const [yuk, setYuk] = useState<string | null>(null);
  const [dikey, setDikey] = useState(true);
  const [fps, setFps] = useState<30 | 60>(60);
  const [durdurKurulu, setDurdurKurulu] = useState(false);
  const [tur, setTur] = useState<MotorKaynakTuru>("renk");
  const [deger, setDeger] = useState("#1e1e2e");
  const [ad, setAd] = useState("");
  const [tuvalSec, setTuvalSec] = useState<string[]>(["ana", "dikey"]);
  const [hedefTuval, setHedefTuval] = useState<Record<string, string>>({});

  const yenile = useCallback(async () => {
    try {
      setD(await motorApi.durum());
    } catch (e) {
      onToast(`Motor durumu alınamadı: ${hata(e)}`);
    }
  }, [onToast]);

  useEffect(() => {
    void yenile();
    const id = setVisibleInterval(() => void yenile(), 1500);
    return () => clearVisibleInterval(id);
  }, [yenile]);

  useEffect(() => {
    if (!durdurKurulu) return;
    const t = window.setTimeout(() => setDurdurKurulu(false), 4000);
    return () => window.clearTimeout(t);
  }, [durdurKurulu]);

  const yap = async (etiket: string, f: () => Promise<unknown>) => {
    setYuk(etiket);
    try {
      await f();
    } catch (e) {
      onToast(`${etiket}: ${hata(e)}`);
    } finally {
      setYuk(null);
      void yenile();
    }
  };

  if (!d) return <p className="text-xs text-panel-muted">Yükleniyor…</p>;
  if (!d.exeVar) {
    return <p className="text-xs text-amber-300">Yayın motoru paketi bulunamadı (yayin-motoru.exe). Bu sürümde motor kurulu değil.</p>;
  }

  const tanim = KAYNAK_TURLERI.find((k) => k.tur === tur)!;
  const tuvaller = d.calisiyor ? (d.dikey ? ["ana", "dikey"] : ["ana"]) : [];
  const ist = d.istatistik;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <Cpu className="h-4 w-4 text-panel-accent" />
        <span className={`h-2 w-2 rounded-full ${d.calisiyor ? "bg-emerald-400" : "bg-white/30"}`} />
        <span className="font-bold text-white/85">
          {d.calisiyor ? `Çalışıyor · libobs ${d.bilgi?.libobs ?? "?"}` : d.sonCikisKodu != null ? `Durdu (çıkış ${d.sonCikisKodu})` : "Kapalı"}
        </span>
        {ist && (
          <span className="text-panel-muted">
            {ist.fps.toFixed(0)} fps · kare {ist.ortalama_kare_ms.toFixed(1)} ms · geciken {ist.geciken_kare}
          </span>
        )}
        <span className="flex-1" />
        {!d.calisiyor ? (
          <>
            <label className="inline-flex items-center gap-1 text-white/75">
              <input type="checkbox" checked={dikey} onChange={(e) => setDikey(e.target.checked)} /> Dikey tuval
            </label>
            <select className="yya-input !py-0.5 text-xs" aria-label="Kare hızı" value={fps} onChange={(e) => setFps(Number(e.target.value) as 30 | 60)}>
              <option value={60}>60 fps</option>
              <option value={30}>30 fps</option>
            </select>
            <button
              type="button"
              className="yya-btn-primary !px-2 !py-1"
              disabled={yuk !== null}
              onClick={() => void yap("Motor başlatılamadı", () => motorApi.baslat(dikey, fps))}
            >
              <Play className="mr-1 inline h-3 w-3" />
              {yuk ? "Başlatılıyor…" : "Motoru başlat"}
            </button>
          </>
        ) : (
          <button
            type="button"
            className={`yya-btn-ghost !px-2 !py-1 ${durdurKurulu ? "ring-2 ring-red-400" : ""}`}
            disabled={yuk !== null}
            title="Tüm motor yayınları ve kayıt biter"
            onClick={() => (durdurKurulu ? (setDurdurKurulu(false), void yap("Motor durdurulamadı", motorApi.durdur)) : setDurdurKurulu(true))}
          >
            <Square className="mr-1 inline h-3 w-3" />
            {durdurKurulu ? "Emin misin? Tekrar tıkla" : "Motoru durdur"}
          </button>
        )}
      </div>

      {d.calisiyor && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            {tuvaller.map((t) => (
              <Onizleme key={t} tuval={t} oran={t === "ana" ? "16 / 9" : "9 / 16"} />
            ))}
          </div>

          <div>
            <div className="mb-1 font-bold text-white/80">Kaynaklar</div>
            <div className="space-y-1">
              {d.kaynaklar.length === 0 && <p className="text-panel-muted">Kaynak yok — aşağıdan ekleyin.</p>}
              {d.kaynaklar.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-2 rounded bg-white/[0.04] px-2 py-1">
                  <span className="min-w-0 truncate text-white/85">
                    {k.ad}{" "}
                    <span className="text-panel-muted">
                      · {KAYNAK_TURLERI.find((x) => x.tur === k.tur)?.ad ?? k.tur} · {k.eksik ? "eksik tür" : `${k.filtreler?.length ?? 0} filtre`}
                    </span>
                  </span>
                  <button
                    type="button"
                    aria-label={`${k.ad} kaynağını sil`}
                    className="rounded p-1 text-red-300 hover:bg-white/10"
                    onClick={() => void yap("Kaynak silinemedi", () => motorApi.kaynakSil(k.id))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <select
                className="yya-input !py-1 text-xs"
                aria-label="Kaynak türü"
                value={tur}
                onChange={(e) => {
                  const t = e.target.value as MotorKaynakTuru;
                  setTur(t);
                  setDeger(t === "renk" ? "#1e1e2e" : "");
                }}
              >
                {KAYNAK_TURLERI.map((k) => (
                  <option key={k.tur} value={k.tur}>
                    {k.ad}
                  </option>
                ))}
              </select>
              {tanim.deger === "renk" && <input type="color" aria-label="Renk" value={deger} onChange={(e) => setDeger(e.target.value)} />}
              {tanim.deger === "yazi" && (
                <input
                  className="yya-input !py-1 text-xs"
                  aria-label="Yazı"
                  placeholder="Yazı"
                  maxLength={500}
                  value={deger}
                  onChange={(e) => setDeger(e.target.value)}
                />
              )}
              {tanim.deger === "dosya" && (
                <input
                  className="yya-input min-w-[14rem] !py-1 text-xs"
                  aria-label="Dosya yolu"
                  placeholder="C:\…\dosya"
                  value={deger}
                  onChange={(e) => setDeger(e.target.value)}
                />
              )}
              <input
                className="yya-input w-28 !py-1 text-xs"
                aria-label="Kaynak adı"
                placeholder="Ad (isteğe bağlı)"
                maxLength={60}
                value={ad}
                onChange={(e) => setAd(e.target.value)}
              />
              {tuvaller.length > 1 &&
                tuvaller.map((t) => (
                  <label key={t} className="inline-flex items-center gap-1 text-white/75">
                    <input
                      type="checkbox"
                      checked={tuvalSec.includes(t)}
                      onChange={(e) => setTuvalSec((s) => (e.target.checked ? [...new Set([...s, t])] : s.filter((x) => x !== t)))}
                    />
                    {tuvalAdi(t)}
                  </label>
                ))}
              <button
                type="button"
                className="yya-btn-ghost !px-2 !py-1"
                disabled={yuk !== null || (tanim.deger !== "yok" && !deger.trim())}
                onClick={() =>
                  void yap("Kaynak eklenemedi", async () => {
                    await motorApi.kaynakEkle(
                      tur,
                      deger,
                      ad,
                      tuvalSec.filter((t) => tuvaller.includes(t))
                    );
                    setAd("");
                  })
                }
              >
                <Plus className="mr-1 inline h-3 w-3" />
                Ekle
              </button>
            </div>
            {tanim.yakalar && <p className="mt-1 text-amber-300">Bu kaynak {tanim.yakalar} yakalar; yalnız kendi yayınınız için ekleyin.</p>}
          </div>

          <div>
            <div className="mb-1 font-bold text-white/80">Hedefler (motor)</div>
            {d.hedefler.length === 0 && <p className="text-panel-muted">Hedef yok — Hedefler panelinden ekleyin.</p>}
            <div className="space-y-1">
              {d.hedefler.map((h) => {
                const b = hedefBaslatilabilir(h, d.calisiyor);
                const canli = ["baglaniyor", "canli", "yeniden_baglaniyor"].includes(h.durum);
                const secili = h.tuval ?? hedefTuval[h.id] ?? "ana";
                const cikis = ist?.cikislar.find((c) => c.id === `h-${h.id}`);
                return (
                  <div key={h.id} className="flex flex-wrap items-center gap-2 rounded bg-white/[0.04] px-2 py-1">
                    <span className="min-w-0 flex-1 truncate text-white/85">
                      {h.ad} <span className="text-panel-muted">· {h.platform}</span>
                    </span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${DURUM_RENGI[h.durum] ?? "border-white/15 text-white/70"}`}>
                      {CIKIS_DURUM_ETIKETI[h.durum] ?? h.durum}
                      {h.durum === "basarisiz" && h.kod != null ? ` (${h.kod})` : ""}
                    </span>
                    {cikis && cikis.etkin && (
                      <span className="text-[10px] text-panel-muted">
                        {(cikis.bayt / 1e6).toFixed(1)} MB · düşen {cikis.dusen_kare}
                      </span>
                    )}
                    <select
                      className="yya-input !py-0.5 text-xs"
                      aria-label={`${h.ad} tuvali`}
                      value={secili}
                      disabled={h.tuval != null || tuvaller.length < 2}
                      title={h.tuval != null ? "Tuval bu motor oturumunda sabit" : "Bu hedef hangi tuvali yayınlasın"}
                      onChange={(e) => setHedefTuval((m) => ({ ...m, [h.id]: e.target.value }))}
                    >
                      {tuvaller.map((t) => (
                        <option key={t} value={t}>
                          {tuvalAdi(t)}
                        </option>
                      ))}
                    </select>
                    {canli ? (
                      <button
                        type="button"
                        className="yya-btn-ghost !px-2 !py-0.5"
                        disabled={yuk !== null}
                        onClick={() => void yap("Hedef durdurulamadı", () => motorApi.hedef(h.id, "durdur"))}
                      >
                        Durdur
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="yya-btn-ghost !px-2 !py-0.5"
                        disabled={!b.olur || yuk !== null}
                        title={b.neden ?? "Bu hedefe yayını başlat"}
                        onClick={() => void yap("Hedef başlatılamadı", () => motorApi.hedef(h.id, "baslat", secili))}
                      >
                        Başlat
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
