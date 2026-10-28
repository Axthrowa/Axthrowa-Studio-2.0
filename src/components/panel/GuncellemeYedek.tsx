/**
 * Ayarlar: güncelleme (bildirim adresi, denetle, uygulama içinden kur) ve yedekler
 * (otomatik günlük yedek, geri yükleme, eski kurulumdan taşıma). — AxthrowA
 */
import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${yol}`, {
    method: govde === undefined ? "GET" : "POST",
    headers: govde === undefined ? undefined : { "Content-Type": "application/json" },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
  return r.json() as Promise<T>;
}

type Denetim = { tanimli: boolean; mevcut: string; son?: string; yeniVar?: boolean; sayfa?: string | null; notlar?: string | null; kurulum?: string | null };

export function Guncelleme() {
  const [adres, setAdres] = useState("");
  const [d, setD] = useState<Denetim | null>(null);
  const [mesaj, setMesaj] = useState("");
  const [yuk, setYuk] = useState(false);

  useEffect(() => {
    istek<{ adres: string }>("/api/guncelleme").then((a) => setAdres(a.adres || "")).catch(() => {});
    istek<Denetim>("/api/guncelleme/durum").then(setD).catch(() => {});
  }, []);

  const calistir = async (is: () => Promise<void>) => {
    setYuk(true);
    setMesaj("");
    try {
      await is();
    } catch (e) {
      setMesaj(String((e as Error).message || e).slice(0, 240));
    } finally {
      setYuk(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Güncellemeler</h3>
      <p className="text-xs font-medium text-white/75">
        Güncelleme bildirimi adresi (https JSON): <code>{'{"surum":"1.2.0","sayfa":"https://…","kurulum":"https://…Setup.exe"}'}</code>. Uygulama açılışta denetler.
        "Kur" kurulumu indirir; yalnız bu uygulamanın sertifikasıyla imzalıysa çalıştırır.
      </p>
      <div className="flex flex-wrap gap-2">
        <input className="min-w-[260px] flex-1 rounded-md border border-panel-border bg-[#1c2030] px-2 py-1.5 text-xs text-white" placeholder="https://…/guncelleme.json" value={adres} onChange={(e) => setAdres(e.target.value)} />
        <button type="button" className="dt-btn" disabled={yuk} onClick={() => calistir(async () => { await istek("/api/guncelleme", { adres }); setMesaj("Kaydedildi"); })}>Kaydet</button>
        <button type="button" className="dt-btn" disabled={yuk} onClick={() => calistir(async () => setD(await istek<Denetim>("/api/guncelleme/denetle", {})))}>{yuk ? "…" : "Şimdi denetle"}</button>
      </div>
      {d?.tanimli && (
        <div className="rounded-lg border border-white/[0.06] bg-black/30 p-3 text-xs text-white/85">
          {d.yeniVar ? (
            <>
              <b className="text-emerald-300">Yeni sürüm var: v{d.son}</b> (şu an v{d.mevcut})
              {d.notlar && <p className="mt-1 whitespace-pre-wrap text-white/70">{d.notlar}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                {d.kurulum && (
                  <button type="button" className="dt-btn" disabled={yuk} onClick={() => calistir(async () => { await istek("/api/guncelleme/kur", {}); setMesaj("Kurulum açıldı; yönergeleri izleyin."); })}>
                    {yuk ? "İndiriliyor…" : "İndir ve kur"}
                  </button>
                )}
                {d.sayfa && <a className="dt-btn" href={d.sayfa} target="_blank" rel="noreferrer">Sürüm sayfası</a>}
              </div>
            </>
          ) : (
            <span>Güncel (v{d.mevcut}{d.son ? `, son v${d.son}` : ""}).</span>
          )}
        </div>
      )}
      {mesaj && <p className="text-xs text-amber-200">{mesaj}</p>}
    </div>
  );
}

type Yedekler = { yedekler: Array<{ ad: string; zaman: number; bayt: number; bot: boolean }>; bekleyen: string | null; sonUygulanan: string | null; klasor: string; sakla: number };

const adOku = (ad: string) => `${ad.slice(6, 8)}.${ad.slice(4, 6)}.${ad.slice(0, 4)} ${ad.slice(9, 11)}:${ad.slice(11, 13)}`;

export function YedekPaneli() {
  const [d, setD] = useState<Yedekler | null>(null);
  const [kaynak, setKaynak] = useState("");
  const [mesaj, setMesaj] = useState("");
  const [yuk, setYuk] = useState(false);
  useEffect(() => {
    istek<Yedekler>("/api/yedekler").then(setD).catch((e) => setMesaj(String(e.message || e)));
  }, []);
  const calistir = async (yol: string, govde: unknown, tamam: string) => {
    setYuk(true);
    setMesaj("");
    try {
      setD(await istek<Yedekler>(yol, govde));
      setMesaj(tamam);
    } catch (e) {
      setMesaj(String((e as Error).message || e).slice(0, 240));
    } finally {
      setYuk(false);
    }
  };
  if (!d) return mesaj ? <p className="text-xs text-red-300">{mesaj}</p> : null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-white">Yedekler</h3>
      <p className="text-xs font-medium text-white/75">
        Ayarlar, veritabanı ve bot verisi günde bir kendiliğinden yedeklenir (son {d.sakla} yedek ve son {d.sakla} günün
        her birinden bir yedek tutulur). Geri yükleme ve taşıma uygulamanın bir sonraki açılışında uygulanır; uygulamadan önce o anki
        hâl ayrıca yedeklenir, yanlış seçim geri alınabilir.
      </p>
      {d.sonUygulanan && <p className="rounded-md bg-emerald-500/10 p-2 text-xs text-emerald-200">{d.sonUygulanan}</p>}
      {d.bekleyen && (
        <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-200">
          Bekleyen: {d.bekleyen.startsWith("yedek:") ? `${adOku(d.bekleyen.slice(6))} yedeğine dönülecek` : `${d.bekleyen.slice(5)} klasöründen taşınacak`} — uygulamayı yeniden başlatın.{" "}
          <button type="button" className="underline" onClick={() => void calistir("/api/yedekler/iptal", {}, "İptal edildi")}>İptal</button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="dt-btn" disabled={yuk} onClick={() => void calistir("/api/yedekler", {}, "Yedek alındı")}>{yuk ? "…" : "Şimdi yedekle"}</button>
        <button type="button" className="dt-btn" onClick={() => void navigator.clipboard?.writeText(d.klasor)}>Klasör yolunu kopyala</button>
      </div>
      <ul className="space-y-1 text-xs text-white/85">
        {d.yedekler.map((y) => (
          <li key={y.ad} className="flex items-center justify-between rounded-md bg-black/30 px-2 py-1.5">
            <span>
              {adOku(y.ad)} · {(y.bayt / 1024 / 1024).toFixed(1)} MB
              {!y.bot && <span className="text-amber-200"> · bot verisi yok</span>}
            </span>
            <button
              type="button"
              className="dt-btn"
              disabled={yuk}
              onClick={() => {
                if (confirm(`${adOku(y.ad)} yedeğine dönülsün mü? Şu anki ayarların yerine geçer (uygulama yeniden başlayınca).`)) void calistir("/api/yedekler/geri-yukle", { ad: y.ad }, "Geri yükleme bir sonraki açılışta uygulanacak");
              }}
            >
              Geri yükle
            </button>
          </li>
        ))}
        {!d.yedekler.length && <li className="text-white/60">Henüz yedek yok.</li>}
      </ul>
      <div className="space-y-1 pt-2">
        <h4 className="text-xs font-bold text-white">Eski kurulumdan taşı</h4>
        <p className="text-[11px] text-white/65">
          Eski taşınabilir klasörün yolunu yaz (ör. C:\Users\…\YayinYonetimAraci-StreamAxT-v1.4.2). Ayarlar, veritabanı, kütüphane (assets) ve bot verisi bir sonraki
          açılışta buraya kopyalanır. Eski uygulamayı önce kapat.
        </p>
        <div className="flex flex-wrap gap-2">
          <input className="min-w-[260px] flex-1 rounded-md border border-panel-border bg-[#1c2030] px-2 py-1.5 text-xs text-white" value={kaynak} onChange={(e) => setKaynak(e.target.value)} placeholder="Eski klasörün tam yolu" />
          <button type="button" className="dt-btn" disabled={yuk || !kaynak.trim()} onClick={() => void calistir("/api/yedekler/tasi", { kaynak }, "Taşıma bir sonraki açılışta uygulanacak")}>Taşı</button>
        </div>
      </div>
      {mesaj && <p className="text-xs text-amber-200">{mesaj}</p>}
    </div>
  );
}
