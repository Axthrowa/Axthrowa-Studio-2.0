/** Y1: işaretten Twitch VOD klibi — başlık, süre ve başlangıç kaydırması; oluşan klibin bağlantısı saklanır. */
import { useState } from "react";
import { twitchKlipYazabilir, twitchVodKlibi } from "../../lib/platformAuth/twitchWrite";
import type { Isaret } from "../../lib/api/botApi";

const ANAHTAR = "studio.twitchKlipleri";
// shortcut: klip bağlantıları bu bilgisayarın tarayıcı deposunda; cihazlar arası gerekirse stream_markers'a sütun eklenir
type Kayit = Record<string, { id: string; editUrl: string }>;

function oku(): Kayit {
  try {
    return JSON.parse(localStorage.getItem(ANAHTAR) || "{}") as Kayit;
  } catch {
    return {};
  }
}

export function TwitchKlipFormu({ isaret }: { isaret: Isaret }) {
  const [klip, setKlip] = useState(() => oku()[isaret.id]);
  const [acik, setAcik] = useState(false);
  const [baslik, setBaslik] = useState(isaret.note || "");
  const [sure, setSure] = useState(30);
  const [kaydirma, setKaydirma] = useState(-20);
  const [durum, setDurum] = useState<{ yuk: boolean; hata?: string }>({ yuk: false });

  if (klip)
    return (
      <a href={klip.editUrl} target="_blank" rel="noreferrer" className="block text-[11px] text-panel-accent hover:underline">
        Twitch klibi: {klip.id}
      </a>
    );
  if (!acik)
    return (
      <button type="button" className="text-[11px] text-panel-accent hover:underline" onClick={() => setAcik(true)}>
        Twitch klibi (VOD'dan)
      </button>
    );

  const yap = async () => {
    setDurum({ yuk: true });
    try {
      const k = await twitchVodKlibi({ anMs: isaret.ts, baslik, sureSn: sure, kaydirmaSn: kaydirma });
      const kayit = oku();
      kayit[isaret.id] = k;
      localStorage.setItem(ANAHTAR, JSON.stringify(kayit));
      setKlip(k);
    } catch (e) {
      setDurum({ yuk: false, hata: String((e as Error).message || e).slice(0, 200) });
    }
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px]">
      {!twitchKlipYazabilir() && <p className="w-full text-amber-300">Twitch klip izni yok: Bağlantılar'dan Twitch'i yeniden bağlayın.</p>}
      <input aria-label="Klip başlığı" value={baslik} maxLength={100} onChange={(e) => setBaslik(e.target.value)} placeholder="Başlık" className="min-w-40 flex-1 rounded bg-white/5 px-1" />
      <label className="flex items-center gap-1">
        Süre
        <input type="number" min={5} max={60} value={sure} onChange={(e) => setSure(Number(e.target.value) || 30)} className="w-12 rounded bg-white/5 px-1" />
        sn
      </label>
      <label className="flex items-center gap-1" title="Klibin işarete göre başladığı an (eksi: işaretten önce)">
        Başlangıç
        <input type="number" min={-120} max={60} value={kaydirma} onChange={(e) => setKaydirma(Number(e.target.value) || 0)} className="w-14 rounded bg-white/5 px-1" />
        sn
      </label>
      <button type="button" disabled={durum.yuk || !baslik.trim()} onClick={() => void yap()} className="rounded-md bg-panel-accent/80 px-2 py-0.5 text-white disabled:opacity-60">
        {durum.yuk ? "Oluşturuluyor…" : "Klip oluştur"}
      </button>
      <button type="button" onClick={() => setAcik(false)} className="text-panel-muted hover:text-white">
        Kapat
      </button>
      {durum.hata && <p className="w-full text-red-300">{durum.hata}</p>}
    </div>
  );
}
