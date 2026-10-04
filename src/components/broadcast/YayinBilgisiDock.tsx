/**
 * Yayın bilgisi dock'u (OBS "Stream Information" karşılığı): bağlı Kick kanalının başlığı, kategorisi ve etiketleri.
 * "Kanaldan oku" yalnız okur; "Kick'te güncelle" herkese açık kanalı değiştirdiği için ayrıca onay ister. Twitch ve
 * YouTube için bu uygulamada OAuth bağlantısı yoktur — dock bunu açıkça söyler.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../lib/api";
import { hataMetni } from "./ortak";

type Durum = { kick: { bagli: boolean; yazabilir: boolean; kanal: string }; desteklenmeyen: string[] };
type Kategori = { id: number; name: string };

async function istek<T>(yol: string, govde?: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${yol}`, {
    method: govde === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    body: govde === undefined ? undefined : JSON.stringify(govde),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(t || `HTTP ${r.status}`);
  return (t ? JSON.parse(t) : {}) as T;
}

/** "a, b ,, c" → ["a", "b", "c"] (en çok 10; Kick belgesi) */
export function etiketleriAyir(metin: string): string[] {
  return metin
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);
}

export function YayinBilgisiDock({ onToast }: { onToast: (m: string) => void }) {
  const [durum, setDurum] = useState<Durum | null>(null);
  const [baslik, setBaslik] = useState("");
  const [kategori, setKategori] = useState<Kategori | null>(null);
  const [arama, setArama] = useState("");
  const [sonuclar, setSonuclar] = useState<Kategori[]>([]);
  const [etiketler, setEtiketler] = useState("");
  const [onay, setOnay] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const zamanlayici = useRef<number | undefined>(undefined);

  const yukle = useCallback(() => istek<Durum>("/api/yayin-bilgisi").then(setDurum, (e) => onToast(`Yayın bilgisi: ${hataMetni(e)}`)), [onToast]);
  useEffect(() => void yukle(), [yukle]);

  // Kategori araması: yazmayı bırakınca (400 ms), en az 2 karakter
  useEffect(() => {
    window.clearTimeout(zamanlayici.current);
    const q = arama.trim();
    if (q.length < 2 || !durum?.kick.bagli) return setSonuclar([]);
    zamanlayici.current = window.setTimeout(() => {
      istek<{ kategoriler: Kategori[] }>(`/api/yayin-bilgisi/kategoriler?q=${encodeURIComponent(q)}`).then(
        (r) => setSonuclar(r.kategoriler),
        (e) => (setSonuclar([]), onToast(`Kategori araması: ${hataMetni(e)}`))
      );
    }, 400);
    return () => window.clearTimeout(zamanlayici.current);
  }, [arama, durum?.kick.bagli, onToast]);

  const oku = async () => {
    setMesgul(true);
    try {
      const r = await istek<{ baslik: string | null; kategori: { id: number | null; ad: string | null } }>("/api/yayin-bilgisi/oku", {});
      setBaslik(r.baslik ?? "");
      setKategori(r.kategori.id ? { id: r.kategori.id, name: r.kategori.ad ?? String(r.kategori.id) } : null);
    } catch (e) {
      onToast(`Kanal okunamadı: ${hataMetni(e)}`);
    } finally {
      setMesgul(false);
    }
  };

  const guncelle = async () => {
    setOnay(false);
    setMesgul(true);
    try {
      await istek("/api/yayin-bilgisi", {
        baslik: baslik.trim() || undefined,
        kategori_id: kategori?.id,
        etiketler: etiketler.trim() ? etiketleriAyir(etiketler) : undefined,
        confirm: true,
      });
      onToast("Kick kanal bilgisi güncellendi");
    } catch (e) {
      onToast(`Güncellenemedi: ${hataMetni(e)}`);
    } finally {
      setMesgul(false);
    }
  };

  const k = durum?.kick;
  const degisiklikVar = !!baslik.trim() || !!kategori || !!etiketler.trim();
  return (
    <section className="dt-dock h-full" aria-label="Yayın bilgisi">
      <div className="dt-dock-baslik">Yayın Bilgisi</div>
      <div className="dt-dock-govde flex flex-col gap-1.5 overflow-auto p-2 text-[12px]">
        {!durum ? (
          <p className="dt-soluk">Yükleniyor…</p>
        ) : !k?.bagli ? (
          <p className="dt-soluk">Kick bağlı değil — Kick hesabını uygulamanın giriş (platform bağlantısı) ekranından bağlayın.</p>
        ) : (
          <>
            <p className="dt-soluk">
              Kick{k.kanal ? ` · ${k.kanal}` : ""}
              {!k.yazabilir && " — yazma izni (channel:write) yok: güncellemek için Kick'i yeniden bağlayın"}
            </p>
            <button type="button" className="dt-btn" disabled={mesgul} onClick={() => void oku()}>
              Kanaldan oku
            </button>
            <label className="dt-etiket" htmlFor="yb-baslik">
              Başlık
            </label>
            <input id="yb-baslik" className="dt-input" value={baslik} onChange={(e) => setBaslik(e.target.value)} />
            <span className="dt-etiket">Kategori{kategori ? `: ${kategori.name}` : ""}</span>
            <input
              className="dt-input"
              value={arama}
              placeholder="Kategori ara (en az 2 harf)"
              aria-label="Kategori ara"
              onChange={(e) => setArama(e.target.value)}
            />
            {sonuclar.length > 0 && (
              <ul className="flex max-h-32 flex-col gap-0.5 overflow-auto" aria-label="Kategori sonuçları">
                {sonuclar.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="dt-btn w-full truncate text-left"
                      aria-pressed={kategori?.id === s.id}
                      onClick={() => (setKategori(s), setArama(""), setSonuclar([]))}
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="dt-etiket" htmlFor="yb-etiket">
              Etiketler (virgülle, en çok 10)
            </label>
            <input id="yb-etiket" className="dt-input" value={etiketler} onChange={(e) => setEtiketler(e.target.value)} />
            {onay ? (
              <div className="flex flex-col gap-1" role="alertdialog" aria-label="Onay">
                <span>Kick kanalınızın bilgisi herkese açık olarak değişecek. Emin misiniz?</span>
                <div className="flex gap-1">
                  <button type="button" className="dt-btn-primary" onClick={() => void guncelle()}>
                    Güncelle
                  </button>
                  <button type="button" className="dt-btn" onClick={() => setOnay(false)}>
                    Vazgeç
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="dt-btn-primary" disabled={mesgul || !k.yazabilir || !degisiklikVar} onClick={() => setOnay(true)}>
                Kick'te güncelle…
              </button>
            )}
          </>
        )}
        {durum && <p className="dt-soluk mt-1">{durum.desteklenmeyen.join(" ve ")}: bu uygulamada yayın bilgisi bağlantısı yok.</p>}
      </div>
    </section>
  );
}
