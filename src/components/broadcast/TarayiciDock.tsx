/**
 * Özel tarayıcı dock'u (OBS "Docks › Custom Browser Docks"): kaydedilmiş sayfalardan biri kısıtlı bir çerçevede
 * gösterilir. Sayfalar ekle/kaldır ile yönetilir (yalnız http/https). Çerçeve korumalıdır: üst pencereye erişemez,
 * gezinme yalnız çerçeve içinde; bazı siteler çerçeve içinde açılmayı reddeder (X-Frame-Options) — bu sitenin
 * kararıdır, dock bunu gösterir.
 */
import { useState } from "react";
import { ExternalLink, Minus, Plus } from "lucide-react";
import { adresGecerli, oku, yaz, type OzelDock } from "../../lib/ozelDocklar";

export function TarayiciDock({ onToast }: { onToast: (m: string) => void }) {
  const [liste, setListe] = useState<OzelDock[]>(oku);
  const [secili, setSecili] = useState<string>(() => oku()[0]?.id ?? "");
  const [ekle, setEkle] = useState(false);
  const [ad, setAd] = useState("");
  const [url, setUrl] = useState("");
  const sayfa = liste.find((d) => d.id === secili) ?? liste[0];
  const kaydet = (l: OzelDock[]) => {
    setListe(l);
    yaz(l);
  };
  const ekleUygula = () => {
    if (!ad.trim() || !adresGecerli(url)) return onToast("Ad ve http(s) adresi gerekli");
    const id = `d${Date.now().toString(36)}`;
    kaydet([...liste, { id, ad: ad.trim(), url: url.trim() }]);
    setSecili(id);
    setEkle(false);
    setAd("");
    setUrl("");
  };
  return (
    <section className="dt-dock h-full" aria-label="Tarayıcı dock'u">
      <div className="dt-dock-baslik">
        Tarayıcı
        <span className="dt-bosluk" />
        {liste.length > 0 && (
          <select className="dt-input max-w-[140px] py-0 text-[11px]" aria-label="Sayfa" value={sayfa?.id ?? ""} onChange={(e) => setSecili(e.target.value)}>
            {liste.map((d) => (
              <option key={d.id} value={d.id}>
                {d.ad}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="dt-tool" aria-label="Sayfa ekle" title="Sayfa ekle" onClick={() => setEkle((x) => !x)}>
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="dt-tool"
          aria-label="Sayfayı kaldır"
          title="Sayfayı kaldır"
          disabled={!sayfa}
          onClick={() => sayfa && (kaydet(liste.filter((d) => d.id !== sayfa.id)), setSecili(""))}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        {sayfa && (
          <a className="dt-tool" href={sayfa.url} target="_blank" rel="noreferrer noopener" aria-label="Tarayıcıda aç" title="Tarayıcıda aç">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
      <div className="dt-dock-govde flex flex-col">
        {ekle && (
          <div className="dt-form p-2">
            <label htmlFor="td-ad">Ad</label>
            <input id="td-ad" className="dt-input" maxLength={60} value={ad} onChange={(e) => setAd(e.target.value)} />
            <label htmlFor="td-url">Adres</label>
            <input
              id="td-url"
              className="dt-input"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ekleUygula()}
            />
            <span />
            <span className="flex gap-1">
              <button type="button" className="dt-btn-primary" disabled={!ad.trim() || !adresGecerli(url)} onClick={ekleUygula}>
                Ekle
              </button>
              <button type="button" className="dt-btn" onClick={() => setEkle(false)}>
                Vazgeç
              </button>
            </span>
          </div>
        )}
        {sayfa ? (
          <iframe
            key={sayfa.id}
            title={sayfa.ad}
            src={sayfa.url}
            className="min-h-0 w-full flex-1 border-0 bg-white"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            allow=""
          />
        ) : (
          !ekle && (
            <p className="p-3 text-[12px] dt-soluk">
              Henüz sayfa yok. "+" ile ad ve adres (https://…) ekleyin; ör. bir platformun sohbet ya da etkinlik açılır penceresi.
            </p>
          )
        )}
      </div>
    </section>
  );
}
