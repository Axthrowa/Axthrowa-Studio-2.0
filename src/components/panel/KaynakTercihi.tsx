import { useState } from "react";
import { setPlayerTercih, type NowPlaying, type PlayerStatus } from "../../lib/api";

const ADLAR: Record<string, string> = {
  spotify: "Spotify",
  "youtube-music": "YouTube Music",
  smtc: "Windows medya (Apple Music, tarayıcı, VLC…)",
};
const VARSAYILAN_SIRA = ["spotify", "youtube-music", "smtc"];

type Props = {
  status: PlayerStatus | null;
  track: NowPlaying | null;
  onSaved: (s: PlayerStatus) => void;
  onToast: (m: string) => void;
};

/** R3: kaynak sırası (boş = otomatik) ve Windows medya oturumunda yok sayılan uygulamalar. */
export default function KaynakTercihi({ status, track, onSaved, onToast }: Props) {
  const tercih = status?.tercih ?? { oncelik: [], yoksay: [] };
  const [yeni, setYeni] = useState("");
  const otomatik = tercih.oncelik.length === 0;

  const kaydet = async (t: { oncelik: string[]; yoksay: string[] }) => {
    try {
      onSaved(await setPlayerTercih(t));
    } catch {
      onToast("Kaynak tercihi kaydedilemedi");
    }
  };
  const yukari = (i: number) => {
    const s = [...tercih.oncelik];
    [s[i - 1], s[i]] = [s[i], s[i - 1]];
    void kaydet({ ...tercih, oncelik: s });
  };
  const yoksayEkle = (ad: string) => {
    const a = ad.trim().toLowerCase();
    if (!a || tercih.yoksay.includes(a)) return;
    void kaydet({ ...tercih, yoksay: [...tercih.yoksay, a] });
    setYeni("");
  };
  const ekrandaki = track?.source === "smtc" && track.app ? track.app : "";

  return (
    <div className="space-y-2 text-xs">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={otomatik}
          onChange={(e) => void kaydet({ ...tercih, oncelik: e.target.checked ? [] : VARSAYILAN_SIRA })}
        />
        Otomatik (en son çalan kaynak gösterilir)
      </label>
      {!otomatik && (
        <ol className="space-y-1" aria-label="Kaynak sırası">
          {tercih.oncelik.map((k, i) => (
            <li key={k} className="flex items-center gap-2 rounded-md bg-white/5 px-2 py-1">
              <span className="w-4 text-panel-muted">{i + 1}.</span>
              <span className="flex-1">{ADLAR[k] || k}</span>
              {i > 0 && (
                <button type="button" className="rounded px-1.5 hover:bg-white/10" aria-label={`${ADLAR[k] || k} yukarı`} onClick={() => yukari(i)}>
                  ↑
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {!otomatik && <p className="text-ui-2 text-panel-muted">Üstteki kaynak çalıyorsa o gösterilir; çalmıyorsa sıradaki.</p>}

      <div>
        <p className="font-semibold">Yok sayılan uygulamalar</p>
        <p className="text-ui-2 text-panel-muted">Windows medya oturumunda adı bunları içeren oynatıcılar overlay'e gelmez (ör. brave, chrome, msedge).</p>
        {tercih.yoksay.length > 0 && (
          <ul className="mt-1 flex flex-wrap gap-1">
            {tercih.yoksay.map((y) => (
              <li key={y} className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-0.5">
                {y}
                <button
                  type="button"
                  aria-label={`${y} yok saymayı kaldır`}
                  className="text-panel-muted hover:text-white"
                  onClick={() => void kaydet({ ...tercih, yoksay: tercih.yoksay.filter((x) => x !== y) })}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-1 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            yoksayEkle(yeni);
          }}
        >
          <input
            className="studio-input min-w-0 flex-1 !py-1 text-xs"
            aria-label="Yok sayılacak uygulama"
            placeholder="uygulama adı"
            maxLength={100}
            value={yeni}
            onChange={(e) => setYeni(e.target.value)}
          />
          <button type="submit" className="rounded-md bg-white/10 px-2">
            Ekle
          </button>
        </form>
        {ekrandaki && (
          <button type="button" className="mt-1 rounded-md bg-white/10 px-2 py-1" onClick={() => yoksayEkle(ekrandaki)}>
            Ekrandaki "{ekrandaki}" uygulamasını yok say
          </button>
        )}
      </div>
    </div>
  );
}
