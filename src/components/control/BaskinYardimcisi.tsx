/** Y10: canlı takip edilen kanallar (izleyici, kategori, son baskın) ve onaylı Twitch baskını */
import { useEffect, useState } from "react";
import { Dialog } from "../ui/Dialog";
import { bildir } from "../../lib/bildirimler";
import { twitchBaskinBaslat, twitchBaskinIptal, twitchTakipYayinlari, type TakipYayini } from "../../lib/platformAuth/twitchWrite";

const GECMIS = "studio.baskinGecmisi";

function gecmisOku(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(GECMIS) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

export function BaskinYardimcisi({ acik, kapat }: { acik: boolean; kapat: () => void }) {
  const [liste, setListe] = useState<TakipYayini[] | null>(null);
  const [hata, setHata] = useState("");
  const [secili, setSecili] = useState<string | null>(null);
  const [baslayan, setBaslayan] = useState<string | null>(null);
  const [gecmis, setGecmis] = useState(gecmisOku);

  useEffect(() => {
    if (!acik) return;
    setListe(null);
    setHata("");
    setSecili(null);
    twitchTakipYayinlari()
      .then(setListe)
      .catch((e) => setHata(String((e as Error).message || e).slice(0, 160)));
  }, [acik]);

  const baskin = async (y: TakipYayini) => {
    if (secili !== y.id) return setSecili(y.id);
    try {
      await twitchBaskinBaslat(y.id);
      const g = { ...gecmisOku(), [y.login]: Date.now() };
      try {
        localStorage.setItem(GECMIS, JSON.stringify(g));
      } catch {
        /* geçmiş yazılamadı: baskın yine başladı */
      }
      setGecmis(g);
      setBaslayan(y.ad);
      bildir(`${y.ad} kanalına baskın başladı (Twitch geri sayımı ~90 sn)`);
    } catch (e) {
      bildir(`Baskın başlatılamadı: ${String((e as Error).message || e).slice(0, 120)}`);
    }
    setSecili(null);
  };

  const iptal = async () => {
    try {
      await twitchBaskinIptal();
      setBaslayan(null);
      bildir("Baskın iptal edildi");
    } catch (e) {
      bildir(`İptal edilemedi: ${String((e as Error).message || e).slice(0, 120)}`);
    }
  };

  return (
    <Dialog open={acik} onOpenChange={(a) => !a && kapat()} title="Baskın yap" description="Takip ettiğin ve şu an canlı olan Twitch kanalları" size="md">
      {baslayan && (
        <div className="mb-2 flex items-center justify-between rounded-md bg-amber-500/15 px-2 py-1.5 text-xs text-amber-200">
          <span>{baslayan} kanalına baskın geri sayımda</span>
          <button type="button" className="rounded px-2 py-0.5 font-semibold hover:bg-white/10" onClick={() => void iptal()}>
            İptal et
          </button>
        </div>
      )}
      {hata ? (
        <p className="text-xs text-red-300">{hata}</p>
      ) : !liste ? (
        <p className="text-xs text-panel-muted">Yükleniyor…</p>
      ) : !liste.length ? (
        <p className="text-xs text-panel-muted">Takip ettiğin kanallardan şu an canlı olan yok.</p>
      ) : (
        <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
          {liste.map((y) => (
            <li key={y.id} className="flex items-center gap-2 rounded-md border border-panel-border px-2 py-1.5 text-xs">
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-white">{y.ad}</div>
                <div className="truncate text-white/60">
                  {y.kategori || "Kategori yok"} · {y.izleyici} izleyici
                  {gecmis[y.login] ? ` · son baskın ${new Date(gecmis[y.login]).toLocaleDateString()}` : ""}
                </div>
              </div>
              <button
                type="button"
                className={`shrink-0 rounded-md border px-2 py-1 font-semibold ${secili === y.id ? "border-amber-400 bg-amber-500/20 text-amber-100" : "border-panel-border text-white hover:bg-white/10"}`}
                onClick={() => void baskin(y)}
                onBlur={() => setSecili((s) => (s === y.id ? null : s))}
              >
                {secili === y.id ? "Onayla" : "Baskın"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
