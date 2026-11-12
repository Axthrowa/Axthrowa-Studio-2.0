/**
 * Bildirimler (A5): köşedeki yığın ve üst şeritteki bildirim merkezi. Kurallar lib/bildirimler.ts içinde.
 *
 *   bildir("Sahne değişti")                     // bilgi, 4 sn
 *   bildir("Mikrofon çok kısık", "uyari")       // 8 sn
 *   bildir("OBS bağlanamadı", "hata")           // kapatılana kadar
 */
import { useEffect, useRef, useState } from "react";
import { Bell, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "./cn";
import { useI18n } from "../../i18n";
import { type Bildirim, type BildirimTuru, gecmisiTemizle, hepsiniOku, kapat, useBildirimler } from "../../lib/bildirimler";

const SIMGE: Record<BildirimTuru, typeof Info> = { bilgi: CircleCheck, uyari: Info, hata: TriangleAlert };
const RENK: Record<BildirimTuru, string> = { bilgi: "text-ui-ok", uyari: "text-ui-warn", hata: "text-ui-err" };

function Satir({ b, kapatilabilir }: { b: Bildirim; kapatilabilir?: boolean }) {
  const { t } = useI18n();
  const Simge = SIMGE[b.tur];
  return (
    <div className="flex items-start gap-2.5">
      <Simge aria-hidden className={cn("mt-0.5 h-4 w-4 shrink-0", RENK[b.tur])} />
      <div className="min-w-0 flex-1">
        {b.baslik ? <p className="text-ui-2 font-semibold text-ui-fg">{b.baslik}</p> : null}
        <p className="whitespace-pre-wrap break-words text-ui-2 text-ui-fg">{b.metin}</p>
        {b.ipucu ? <p className="mt-0.5 text-ui-1 text-ui-fg2">{b.ipucu}</p> : null}
      </div>
      {kapatilabilir ? (
        <button
          type="button"
          aria-label={t("ui.close")}
          onClick={() => kapat(b.id)}
          className="-mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-ui-1 text-ui-fg2 hover:bg-ui-s3 hover:text-ui-fg"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/** Köşede açık bildirimler. Hata `alert`, ötekiler `status` olarak duyurulur. */
export function BildirimYigini() {
  const acik = useBildirimler().filter((b) => b.acik).slice(-4);
  if (!acik.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-10 right-4 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {acik.map((b) => (
        <div
          key={b.id}
          role={b.tur === "hata" ? "alert" : "status"}
          className="ui-gir pointer-events-auto rounded-ui-3 border border-ui-line2 bg-ui-s2 px-3 py-2.5 shadow-lg"
        >
          <Satir b={b} kapatilabilir />
        </div>
      ))}
    </div>
  );
}

const saat = (z: number) => new Date(z).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

/** Üst şeritteki zil: okunmamış sayısı ve oturum boyunca gelen bütün bildirimler. */
export function BildirimMerkezi() {
  const { t } = useI18n();
  const liste = useBildirimler();
  const [acik, setAcik] = useState(false);
  const kok = useRef<HTMLDivElement>(null);
  const okunmamis = liste.filter((b) => !b.okundu).length;

  useEffect(() => {
    if (!acik) return;
    hepsiniOku();
    const disari = (e: MouseEvent) => !kok.current?.contains(e.target as Node) && setAcik(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAcik(false);
    document.addEventListener("mousedown", disari);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", disari);
      document.removeEventListener("keydown", esc);
    };
  }, [acik, liste.length]);

  return (
    <div ref={kok} className="relative shrink-0">
      <button
        type="button"
        aria-label={okunmamis ? `${t("bildirim.merkez")} (${okunmamis})` : t("bildirim.merkez")}
        aria-expanded={acik}
        onClick={() => setAcik((a) => !a)}
        className="relative flex h-6 w-7 items-center justify-center rounded-ui-2 text-ui-fg2 transition-colors duration-ui hover:bg-ui-s2 hover:text-ui-fg"
      >
        <Bell aria-hidden className="h-4 w-4" />
        {okunmamis ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-ui-accent px-0.5 font-mono text-[9px] font-bold text-ui-accent-ink">
            {okunmamis > 9 ? "9+" : okunmamis}
          </span>
        ) : null}
      </button>
      {acik ? (
        <div
          role="dialog"
          aria-label={t("bildirim.merkez")}
          className="ui-gir-olcek absolute right-0 top-8 z-50 flex max-h-[60vh] w-[360px] flex-col rounded-ui-3 border border-ui-line2 bg-ui-s1 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-ui-line px-3 py-2">
            <p className="text-ui-2 font-semibold text-ui-fg">{t("bildirim.merkez")}</p>
            {liste.length ? (
              <button type="button" onClick={gecmisiTemizle} className="text-ui-1 text-ui-fg2 hover:text-ui-fg">
                {t("bildirim.temizle")}
              </button>
            ) : null}
          </div>
          {liste.length ? (
            <ul className="min-h-0 flex-1 divide-y divide-ui-line overflow-y-auto">
              {[...liste].reverse().map((b) => (
                <li key={b.id} className="flex gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <Satir b={b} kapatilabilir={b.acik} />
                  </div>
                  <span className="shrink-0 font-mono text-ui-1 text-ui-fg3">{saat(b.zaman)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-ui-2 text-ui-fg2">{t("bildirim.bos")}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
