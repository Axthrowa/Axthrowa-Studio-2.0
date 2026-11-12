/**
 * Canlı ekranı › Hızlı işlem. Düğmeye basınca sayfa değişmez: botun sayfası (çekiliş, anket…) pencerede açılır,
 * kapatınca Canlı ekranına dönülür; eylemler doğrudan çalışır. Panel başlığındaki "Özelleştir" ile liste değiştirilir.
 */
import { Suspense, lazy, useEffect, useState } from "react";
import { X } from "lucide-react";
import { actionsApi, quickActions, type ActionInfo } from "../../lib/api/actions";
import { EK_PANEL_GRUPLARI, botSekmesi } from "../../lib/canliEkPaneller";
import { HIZLI_EN_COK, HIZLI_KEY, VARSAYILAN_HIZLI, hizliOku, type HizliIslem } from "../../lib/canliHizli";
import { Dialog } from "../ui";
import { TUS } from "./donanim";

const AxBotHost = lazy(() => import("../panel/AxBotHost"));

type Props = {
  onToast: (m: string) => void;
  onSoru: () => void;
  onTemizle: () => void;
  /** Özelleştirme açık mı (düğmesi panel başlığında durur) */
  duzen: boolean;
};

const kayitli = (): HizliIslem[] => {
  try {
    return hizliOku(localStorage.getItem(HIZLI_KEY));
  } catch {
    return VARSAYILAN_HIZLI;
  }
};

/** Eklenebilecek bot sayfaları: Canlı ekranına panel olarak eklenebilenlerle aynı liste */
const BOT_SAYFALARI: HizliIslem[] = EK_PANEL_GRUPLARI.flatMap((g) => g.paneller)
  .filter((p) => botSekmesi(p.id))
  .map((p) => ({ id: `bot:${botSekmesi(p.id)}`, ad: p.ad }));

export default function HizliIslemler({ onToast, onSoru, onTemizle, duzen }: Props) {
  const [liste, setListe] = useState(kayitli);
  const [pencere, setPencere] = useState<HizliIslem | null>(null);
  const [eylemler, setEylemler] = useState<ActionInfo[]>([]);

  // Eylem listesi yalnız özelleştirirken istenir
  useEffect(() => {
    if (!duzen) return;
    let iptal = false;
    void actionsApi
      .list()
      .then((l) => !iptal && setEylemler(quickActions(l)))
      .catch(() => {});
    return () => {
      iptal = true;
    };
  }, [duzen]);

  const yaz = (yeni: HizliIslem[]) => {
    setListe(yeni);
    try {
      localStorage.setItem(HIZLI_KEY, JSON.stringify(yeni));
    } catch {
      /* saklanamadı: bu oturumda yine geçerli */
    }
  };

  const calistir = async (k: HizliIslem) => {
    if (k.id === "soru") return onSoru();
    if (k.id === "temizle") return onTemizle();
    if (k.id.startsWith("bot:")) return setPencere(k);
    const kimlik = k.id.slice("eylem:".length);
    try {
      const bilgi = (await actionsApi.list()).find((a) => a.id === kimlik);
      if (!bilgi) return onToast(`${k.ad}: bu eylem artık yok`);
      if (!bilgi.available) return onToast(`${k.ad}: ${bilgi.reason || "şu an kullanılamıyor"}`);
      // Onay isteyen eylem (yayını etkiler) yanlışlıkla çalışmasın
      if (bilgi.confirm && !window.confirm(`${k.ad} çalıştırılsın mı?`)) return;
      await actionsApi.run(kimlik, {}, bilgi.confirm);
      onToast(`${k.ad}: tamam`);
    } catch (e) {
      onToast(`${k.ad}: ${String((e as Error).message || e).slice(0, 160)}`);
    }
  };

  const secenekler: { grup: string; ogeler: HizliIslem[] }[] = [
    { grup: "Yerleşik", ogeler: VARSAYILAN_HIZLI.filter((k) => !k.id.startsWith("bot:")) },
    { grup: "Bot sayfaları (pencerede açılır)", ogeler: BOT_SAYFALARI },
    { grup: "Eylemler (hemen çalışır)", ogeler: eylemler.map((a) => ({ id: `eylem:${a.id}`, ad: a.label })) },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
        {liste.map((k) => (
          <span key={k.id} className="relative">
            <button type="button" className={`${TUS} h-10 w-full truncate px-2 text-xs font-semibold`} title={k.ad} onClick={() => void calistir(k)}>
              {k.ad}
            </button>
            {duzen ? (
              <button
                type="button"
                aria-label={`${k.ad} düğmesini kaldır`}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-panel-border bg-panel-elevated text-white hover:bg-red-600"
                onClick={() => yaz(liste.filter((x) => x.id !== k.id))}
              >
                <X aria-hidden className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        ))}
      </div>

      {duzen ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Hızlı işlem ekle"
            className={`${TUS} h-8 min-w-0 max-w-full px-2 text-xs font-medium`}
            value=""
            disabled={liste.length >= HIZLI_EN_COK}
            onChange={(e) => {
              const k = secenekler.flatMap((g) => g.ogeler).find((x) => x.id === e.target.value);
              if (k) yaz([...liste, k]);
            }}
          >
            <option value="">+ İşlem ekle…</option>
            {secenekler.map((g) =>
              g.ogeler.length ? (
                <optgroup key={g.grup} label={g.grup}>
                  {g.ogeler.map((k) => (
                    <option key={k.id} value={k.id} disabled={liste.some((x) => x.id === k.id)}>
                      {k.ad}
                    </option>
                  ))}
                </optgroup>
              ) : null
            )}
          </select>
          <button type="button" className={`${TUS} h-8 px-3 text-xs font-medium`} onClick={() => yaz(VARSAYILAN_HIZLI)}>
            Varsayılana dön
          </button>
        </div>
      ) : null}

      {/* Botun sayfası pencerede: kapatınca Canlı ekranı olduğu gibi durur */}
      <Dialog open={!!pencere} onOpenChange={(a) => !a && setPencere(null)} title={pencere?.ad || ""} className="h-[min(820px,calc(100vh-32px))] !max-w-[1100px]">
        {pencere ? (
          <Suspense fallback={<p className="p-3 text-sm text-panel-muted">Yükleniyor…</p>}>
            <div className="flex h-full min-h-0 flex-col">
              <AxBotHost onToast={onToast} tab={pencere.id.slice(4)} embed onOpenMusic={() => {}} />
            </div>
          </Suspense>
        ) : null}
      </Dialog>
    </div>
  );
}
