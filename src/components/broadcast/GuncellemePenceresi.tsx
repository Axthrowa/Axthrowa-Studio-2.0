/**
 * Yardım › Güncellemeleri denetle: kullanıcının tanımladığı güncelleme bildirimi adresinden (JSON) son sürüm okunur ve
 * bu sürümle karşılaştırılır. Hiçbir şey indirilmez ya da çalıştırılmaz; yeni sürüm varsa sayfası tarayıcıda açılabilir.
 */
import { useEffect, useState } from "react";
import { API_BASE } from "../../lib/api";
import { openExternal } from "../../lib/openExternal";
import { hataMetni, Pencere } from "./ortak";

type Sonuc = { tanimli: boolean; mevcut: string; son?: string; yeniVar?: boolean; sayfa?: string | null; notlar?: string | null };

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${yol}`, {
    method: govde === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return JSON.parse(t) as T;
}

export function GuncellemePenceresi({ onKapat }: { onKapat: () => void }) {
  const [adres, setAdres] = useState("");
  const [surum, setSurum] = useState("");
  const [sonuc, setSonuc] = useState<Sonuc | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  useEffect(() => {
    istek<{ adres: string; surum: string }>("/api/guncelleme").then(
      (r) => (setAdres(r.adres), setSurum(r.surum)),
      (e) => setHata(hataMetni(e))
    );
  }, []);
  const denetle = async () => {
    setMesgul(true);
    setHata(null);
    try {
      await istek("/api/guncelleme", { adres });
      setSonuc(await istek<Sonuc>("/api/guncelleme/denetle", {}));
    } catch (e) {
      setHata(hataMetni(e));
    } finally {
      setMesgul(false);
    }
  };
  return (
    <Pencere
      baslik="Güncellemeleri denetle"
      genislik={520}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Kapat
          </button>
          <button type="button" className="dt-btn-primary" disabled={mesgul || !adres.trim()} onClick={() => void denetle()}>
            {mesgul ? "Denetleniyor…" : "Denetle"}
          </button>
        </>
      }
    >
      <div className="dt-form p-3 text-[12px]">
        <span className="dt-etiket">Bu sürüm</span>
        <span className="dt-sayi">{surum || "—"}</span>
        <label htmlFor="gn-adres">Bildirim adresi</label>
        <input id="gn-adres" className="dt-input" placeholder="https://…/guncelleme.json" value={adres} onChange={(e) => setAdres(e.target.value)} />
        <span />
        <span className="text-[11px] dt-soluk">
          Uygulamanın kendi dağıtım sunucusu yok: bir güncelleme bildirimi adresi (JSON: surum, sayfa, notlar) tanımlayın. Denetim yalnız siz "Denetle"ye
          basınca yapılır; hiçbir şey indirilmez.
        </span>
        {sonuc && (
          <>
            <span className="dt-etiket">Sonuç</span>
            <span>
              {!sonuc.tanimli
                ? "Bildirim adresi tanımlı değil."
                : sonuc.yeniVar
                  ? `Yeni sürüm var: ${sonuc.son} (bu sürüm ${sonuc.mevcut})`
                  : `Güncel: son sürüm ${sonuc.son}, bu sürüm ${sonuc.mevcut}`}
              {sonuc.yeniVar && sonuc.sayfa && (
                <button type="button" className="dt-btn ml-2" onClick={() => void openExternal(sonuc.sayfa!)}>
                  Sayfayı aç
                </button>
              )}
            </span>
            {sonuc.notlar && (
              <>
                <span className="dt-etiket">Notlar</span>
                <span className="whitespace-pre-wrap">{sonuc.notlar}</span>
              </>
            )}
          </>
        )}
        {hata && (
          <>
            <span />
            <span className="dt-uyari-metni">{hata}</span>
          </>
        )}
      </div>
    </Pencere>
  );
}
