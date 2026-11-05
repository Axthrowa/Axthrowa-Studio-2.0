/**
 * Premium lisans arayüzü.
 * - `LisansFormu`: anahtar gir / durum / kaldır (Ayarlar › Genel'de ve karşılama ekranında)
 * - varsayılan dışa aktarım: ilk açılışta bir kez görünen, atlanabilir karşılama ekranı. Uygulamayı kilitlemez;
 *   hata raporu izni de burada bir kez sorulur (derlemede Sentry varsa).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isTauri } from "@tauri-apps/api/core";
import { CheckCircle, Crown, Key } from "@phosphor-icons/react";
import { WidgetCard } from "./WidgetCard";
import { Button } from "./Button";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { lisansEtkinlestir, lisansKaldir, lisansYukle } from "../../lib/lisans";
import { HataRaporuAnahtari } from "./HataRaporuAnahtari";

const KARSILAMA_GORULDU = "axthrowa.karsilama.goruldu";

const GIRDI =
  "w-full rounded-xl bg-zinc-950/60 px-4 py-2.5 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 " +
  "ring-1 ring-white/5 transition-shadow duration-200 focus:outline-none focus:ring-2 focus:ring-axthrowa-violet/60";

export function LisansFormu({ onEtkin }: { onEtkin?: () => void }) {
  const lisans = useAxthrowaStore((s) => s.lisans);
  const [anahtar, setAnahtar] = useState("");
  const [hata, setHata] = useState("");
  const [yuk, setYuk] = useState(false);

  useEffect(() => {
    void lisansYukle().then((h) => h && setHata(h));
  }, []);

  if (lisans) {
    return (
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-zinc-950/40 px-4 py-3">
        <CheckCircle weight="duotone" className="h-5 w-5 text-axthrowa-cyan" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold text-zinc-100">Premium etkin — {lisans.kime}</p>
          <p className="text-xs text-zinc-500">{lisans.bitis ? `${lisans.bitis} tarihine kadar` : "Süresiz"}</p>
        </div>
        <Button variant="ghost" onClick={() => void lisansKaldir()}>
          Kaldır
        </Button>
      </div>
    );
  }

  async function etkinlestir() {
    setHata("");
    setYuk(true);
    try {
      await lisansEtkinlestir(anahtar);
      setAnahtar("");
      onEtkin?.();
    } catch (e) {
      setHata(String(e));
    } finally {
      setYuk(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void etkinlestir();
      }}
    >
      <label className="flex flex-col gap-2">
        <span className="text-xs font-medium text-zinc-400">Lisans anahtarı</span>
        <input aria-label="Lisans anahtarı"
          className={GIRDI}
          value={anahtar}
          onChange={(e) => setAnahtar(e.target.value)}
          placeholder="AXT1-…"
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      {hata ? <p className="rounded-xl bg-red-500/10 px-4 py-2 text-xs text-red-300">{hata}</p> : null}
      <div className="flex justify-end">
        <Button type="submit" loading={yuk} disabled={!anahtar.trim()}>
          <Key weight="bold" className="h-4 w-4" />
          Etkinleştir
        </Button>
      </div>
    </form>
  );
}

function goruldu(): boolean {
  try {
    return localStorage.getItem(KARSILAMA_GORULDU) === "1";
  } catch {
    return true;
  }
}

export default function KarsilamaEkrani() {
  const lisans = useAxthrowaStore((s) => s.lisans);
  const [acik, setAcik] = useState(() => isTauri() && !goruldu());

  if (!acik || lisans) return null;

  const kapat = () => {
    try {
      localStorage.setItem(KARSILAMA_GORULDU, "1");
    } catch {
      /* gizli pencere: yalnız bu oturum */
    }
    setAcik(false);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[650] flex items-center justify-center bg-axthrowa-dark/70 p-4 backdrop-blur-md animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label="AxthrowA'ya hoş geldiniz"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_50%_45%,rgba(139,92,246,0.18),transparent_70%)]" />
      <WidgetCard
        title="AxthrowA'ya hoş geldiniz"
        description="Premium lisansınız varsa anahtarı girin. Lisans olmadan da bütün özellikler açık; bu adımı atlayabilirsiniz."
        icon={<Crown weight="duotone" className="h-5 w-5 text-axthrowa-violet" />}
        className="relative w-full max-w-md bg-axthrowa-card/85 shadow-float backdrop-blur-xl transform-gpu animate-zoom-in"
      >
        <LisansFormu onEtkin={kapat} />
        <HataRaporuAnahtari className="mt-5 rounded-xl bg-zinc-950/40 px-4 py-3" />
        <div className="mt-4 flex justify-center">
          <Button variant="ghost" onClick={kapat}>
            Şimdilik geç
          </Button>
        </div>
      </WidgetCard>
    </div>,
    document.body
  );
}
