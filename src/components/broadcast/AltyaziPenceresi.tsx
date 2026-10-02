/**
 * Araçlar › Altyazı (OBS "Captions"): yazılan satır CEA-608 kapalı altyazısı olarak etkin motor yayınlarına gömülür
 * (izleyici oynatıcıda "CC" ile açar). Konuşma tanıma yoktur — satırlar elle, kısayolla (engine.caption.send) ya da
 * otomasyonla gönderilir. Son satırlar yalnız bu oturumda tutulur; hiçbir dosyaya yazılmaz.
 */
import { useState } from "react";
import { cikisEtkin, motorApi, type MotorHedef } from "../../lib/api/motor";
import { hataMetni, Pencere } from "./ortak";

const SURELER = [2, 4, 6, 10];

export function AltyaziPenceresi({ hedefler, onKapat }: { hedefler: MotorHedef[]; onKapat: () => void }) {
  const canli = hedefler.filter((h) => cikisEtkin(h.durum));
  const [metin, setMetin] = useState("");
  const [sure, setSure] = useState(4);
  /** Boş = tüm canlı hedefler */
  const [secili, setSecili] = useState<string[]>([]);
  const [gecmis, setGecmis] = useState<string[]>([]);
  const [durum, setDurum] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);

  const gonder = async (satir: string) => {
    const t = satir.trim();
    if (!t || mesgul) return;
    setMesgul(true);
    try {
      const r = await motorApi.altyazi(
        t,
        sure,
        secili.filter((id) => canli.some((h) => h.id === id))
      );
      setGecmis((g) => [t, ...g.filter((x) => x !== t)].slice(0, 10));
      setDurum(`Gönderildi → ${r.hedefler.map((id) => hedefler.find((h) => h.id === id)?.ad ?? id).join(", ")}`);
      setMetin("");
    } catch (e) {
      setDurum(`Gönderilemedi: ${hataMetni(e)}`);
    } finally {
      setMesgul(false);
    }
  };

  return (
    <Pencere
      baslik="Altyazı"
      genislik={540}
      onKapat={onKapat}
      alt={
        <button type="button" className="dt-btn" onClick={onKapat}>
          Kapat
        </button>
      }
    >
      <div className="dt-form p-3 text-[12px]">
        <p className="dt-soluk">
          Satır, canlı yayınlara CEA-608 kapalı altyazısı olarak gömülür (H.264/HEVC). Konuşma tanıma yoktur: metni yazın ya da kısayol/otomasyonla gönderin. ş,
          ğ, ı harfleri altyazı karakter kümesinde olmadığından s, g, i olarak gider; satır en çok 128 bayttır.
        </p>
        {canli.length === 0 ? (
          <p className="mt-2" role="status">
            Canlı motor yayını yok — altyazı yalnız yayın sürerken gönderilebilir.
          </p>
        ) : (
          <fieldset className="mt-2">
            <legend className="dt-etiket">Hedefler (hiçbiri seçili değilse tüm canlı yayınlar)</legend>
            {canli.map((h) => (
              <label key={h.id} className="mr-3 inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={secili.includes(h.id)}
                  onChange={(e) => setSecili((s) => (e.target.checked ? [...s, h.id] : s.filter((x) => x !== h.id)))}
                />
                {h.ad}
              </label>
            ))}
          </fieldset>
        )}
        <label className="dt-etiket mt-2 block" htmlFor="altyazi-metin">
          Satır
        </label>
        <div className="flex gap-1.5">
          <input
            id="altyazi-metin"
            className="dt-input min-w-0 flex-1"
            value={metin}
            maxLength={500}
            disabled={canli.length === 0}
            placeholder="Yazıp Enter'a basın"
            onChange={(e) => setMetin(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void gonder(metin);
              }
            }}
          />
          <select className="dt-input w-24" value={sure} onChange={(e) => setSure(Number(e.target.value))} aria-label="Ekranda kalma süresi">
            {SURELER.map((s) => (
              <option key={s} value={s}>
                {s} sn
              </option>
            ))}
          </select>
          <button type="button" className="dt-btn-primary" disabled={!metin.trim() || mesgul || canli.length === 0} onClick={() => void gonder(metin)}>
            Gönder
          </button>
        </div>
        {durum && (
          <p className="mt-1.5" role="status">
            {durum}
          </p>
        )}
        {gecmis.length > 0 && (
          <>
            <span className="dt-etiket mt-2 block">Son satırlar (tıklayınca yeniden gönderilir)</span>
            <ul className="mt-1 flex flex-col gap-0.5">
              {gecmis.map((g) => (
                <li key={g}>
                  <button type="button" className="dt-btn w-full truncate text-left" disabled={mesgul || canli.length === 0} onClick={() => void gonder(g)}>
                    {g}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Pencere>
  );
}
