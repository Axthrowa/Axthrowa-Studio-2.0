/**
 * Yeni sürüm bildirimi. Açılışta Rust tarafı (`acilista_denetle`) bildirimi denetler; bu pencere sonucu okur,
 * sürüm notlarını gösterir ve "İndir ve kur"da indirme ilerlemesini çizer. Kurulum imzası Rust'ta doğrulanır.
 * "Sonra" o sürüm için bir daha sormaz (yeni sürüm çıkınca yine sorar). Ayarlar › Hakkında'daki bölüm aynı API'yi kullanır.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowCircleUp } from "@phosphor-icons/react";
import { WidgetCard } from "./WidgetCard";
import { Button } from "./Button";
import { istek, type Denetim } from "../panel/GuncellemeYedek";
import { gunluk } from "../../lib/gunluk";

type Ilerleme = { asama: "bos" | "indiriliyor" | "dogrulaniyor" | "bitti" | "hata"; inen?: number; toplam?: number | null; hata?: string };

const ATLANAN = "guncelleme.atlanan";
const DENETIM_ARASI = 10 * 60_000;

function oku(): string | null {
  try {
    return localStorage.getItem(ATLANAN);
  } catch {
    return null;
  }
}

const mb = (n = 0) => (n / 1024 / 1024).toFixed(1);

export default function UpdateModal() {
  const [d, setD] = useState<Denetim | null>(null);
  const [kapali, setKapali] = useState(false);
  const [kuruluyor, setKuruluyor] = useState(false);
  const [ilerleme, setIlerleme] = useState<Ilerleme | null>(null);
  const [hata, setHata] = useState("");
  const izleyici = useRef<number | undefined>(undefined);

  // Açılış denetimi birkaç saniye sürebilir: hemen ve sonra aralıklarla son sonucu oku
  useEffect(() => {
    const al = () => istek<Denetim>("/api/guncelleme/durum").then(setD).catch(() => {});
    const ilk = window.setTimeout(al, 4000);
    const aralik = window.setInterval(al, DENETIM_ARASI);
    void al();
    return () => {
      window.clearTimeout(ilk);
      window.clearInterval(aralik);
      window.clearInterval(izleyici.current);
    };
  }, []);

  const acik = !kapali && !!d?.yeniVar && !!d.son && (kuruluyor || oku() !== d.son);

  useEffect(() => {
    if (!acik || kuruluyor) return;
    const tus = (e: KeyboardEvent) => e.key === "Escape" && sonra();
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  });

  if (!acik || !d) return null;

  function sonra() {
    try {
      localStorage.setItem(ATLANAN, d!.son!);
    } catch {
      /* gizli pencere: yalnız bu oturum için kapanır */
    }
    gunluk.info(`Güncelleme ertelendi: ${d!.son}`);
    setKapali(true);
  }

  async function kur() {
    setHata("");
    setKuruluyor(true);
    setIlerleme({ asama: "indiriliyor", inen: 0 });
    gunluk.info(`Güncelleme başlatıldı: ${d!.mevcut} → ${d!.son}`);
    izleyici.current = window.setInterval(() => {
      istek<Ilerleme>("/api/guncelleme/ilerleme").then(setIlerleme).catch(() => {});
    }, 400);
    try {
      await istek("/api/guncelleme/kur", {});
      setIlerleme({ asama: "bitti" });
    } catch (e) {
      const m = String((e as Error)?.message || e);
      gunluk.error(`Güncelleme başarısız: ${m}`);
      setHata(m);
      setIlerleme(null);
    } finally {
      window.clearInterval(izleyici.current);
      setKuruluyor(false);
    }
  }

  const yuzde = ilerleme?.toplam ? Math.min(100, Math.round(((ilerleme.inen || 0) / ilerleme.toplam) * 100)) : null;
  const bitti = ilerleme?.asama === "bitti";
  const durumYazisi =
    ilerleme?.asama === "dogrulaniyor"
      ? "İmza doğrulanıyor…"
      : bitti
        ? "Kurulum açıldı — yönergeleri izleyin, uygulama kapanmayı kendisi soracak."
        : ilerleme
          ? `${mb(ilerleme.inen)} MB${ilerleme.toplam ? ` / ${mb(ilerleme.toplam)} MB` : ""}`
          : "";

  return createPortal(
    <div
      className="fixed inset-0 z-[700] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="guncelleme-baslik"
    >
      <WidgetCard
        title={`Yeni sürüm: ${d.son}`}
        description={`Kullandığınız sürüm ${d.mevcut}.`}
        icon={<ArrowCircleUp weight="duotone" className="h-5 w-5 text-axthrowa-cyan" />}
        className="w-full max-w-lg bg-axthrowa-card/90 shadow-float backdrop-blur-xl transform-gpu animate-zoom-in [&_h3]:text-lg"
      >
        <span id="guncelleme-baslik" className="sr-only">Güncelleme</span>
        {d.notlar ? (
          <div className="custom-scrollbar max-h-60 overflow-y-auto whitespace-pre-wrap rounded-xl bg-zinc-950/50 px-4 py-3 text-sm leading-relaxed text-zinc-300">
            {d.notlar}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Bu sürüm için not yazılmamış.</p>
        )}

        {ilerleme ? (
          <div className="mt-5 flex flex-col gap-2" aria-live="polite">
            <div
              className="h-2 overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={bitti ? 100 : yuzde ?? undefined}
            >
              <div
                className={
                  "h-full rounded-full bg-gradient-to-r from-axthrowa-violet to-axthrowa-cyan transition-[width] duration-300 " +
                  (yuzde === null && !bitti ? "w-1/3 animate-pulse" : "")
                }
                style={yuzde !== null || bitti ? { width: `${bitti ? 100 : yuzde}%` } : undefined}
              />
            </div>
            <div className="flex justify-between font-mono text-ui-2 text-zinc-500">
              <span>{durumYazisi}</span>
              {yuzde !== null && !bitti ? <span className="text-axthrowa-cyan">%{yuzde}</span> : null}
            </div>
          </div>
        ) : null}

        {hata ? <p className="mt-4 rounded-xl bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{hata}</p> : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          {d.sayfa ? (
            <a href={d.sayfa} target="_blank" rel="noreferrer" className="mr-auto text-sm text-zinc-500 transition-colors hover:text-axthrowa-cyan">
              Sürüm sayfası
            </a>
          ) : null}
          {bitti ? (
            <Button variant="secondary" onClick={() => setKapali(true)}>Kapat</Button>
          ) : (
            <>
              <Button variant="ghost" disabled={kuruluyor} onClick={sonra}>Sonra</Button>
              {d.kurulum ? (
                <Button loading={kuruluyor} onClick={() => void kur()}>{hata ? "Yeniden dene" : "İndir ve kur"}</Button>
              ) : null}
            </>
          )}
        </div>
      </WidgetCard>
    </div>,
    document.body
  );
}
