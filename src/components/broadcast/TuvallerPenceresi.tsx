/**
 * Sahne Koleksiyonu › Tuvaller (OBS 32 "Canvases"): yatay ve dikeyin yanında en çok 8 ek tuval. Her ek tuvalin kendi
 * sahneleri olur; hedefler, projektör, Multiview, Studio Mode ve sanal kamera onu seçebilir. Boyut değişikliği motor
 * yeniden başlayınca uygulanır (libobs tuvali yeniden boyutlandırılamaz). Silme o tuvalin sahnelerini de kaldırır.
 */
import { useState } from "react";
import { motorApi } from "../../lib/api/motor";
import type { TuvalBilgisi } from "../../lib/tuvaller";
import { hataMetni, Pencere } from "./ortak";

const HAZIR: { ad: string; g: number; y: number }[] = [
  { ad: "Kare 1080×1080", g: 1080, y: 1080 },
  { ad: "Geniş 2560×1080", g: 2560, y: 1080 },
  { ad: "HD 1280×720", g: 1280, y: 720 },
  { ad: "Dikey 720×1280", g: 720, y: 1280 },
];

/** Boyut geçerli mi (sunucu kuralı: 16–8192, çift) */
export function tuvalBoyutuGecerli(g: number, y: number): boolean {
  return [g, y].every((v) => Number.isInteger(v) && v >= 16 && v <= 8192 && v % 2 === 0);
}

export function TuvallerPenceresi({
  tuvaller,
  onKapat,
  onDegisti,
  onToast,
}: {
  tuvaller: TuvalBilgisi[];
  onKapat: () => void;
  onDegisti: () => void;
  onToast: (m: string) => void;
}) {
  const [ad, setAd] = useState("");
  const [g, setG] = useState(1080);
  const [y, setY] = useState(1080);
  const [duzen, setDuzen] = useState<Record<string, { ad: string; g: number; y: number }>>({});
  const [silinecek, setSilinecek] = useState<TuvalBilgisi | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const ekler = tuvaller.filter((t) => t.ek);

  const yap = async (f: () => Promise<unknown>, basari: string) => {
    setMesgul(true);
    try {
      const r = (await f()) as { motorYenidenBaslamali?: boolean } | undefined;
      onToast(r?.motorYenidenBaslamali ? `${basari} — yeni boyut motor yeniden başlayınca uygulanır` : basari);
      onDegisti();
    } catch (e) {
      onToast(`Tuval: ${hataMetni(e)}`);
    } finally {
      setMesgul(false);
    }
  };

  return (
    <Pencere
      baslik="Tuvaller"
      genislik={600}
      onKapat={onKapat}
      alt={
        <button type="button" className="dt-btn" onClick={onKapat}>
          Kapat
        </button>
      }
    >
      <div className="dt-form p-3 text-[12px]">
        <p className="dt-soluk">
          Yatay ve dikey tuvalin yanında en çok 8 ek tuval eklenebilir; her birinin kendi sahneleri olur ve hedefler onu yayınlayabilir. Boyut değişikliği motor
          yeniden başlayınca uygulanır.
        </p>
        <table className="dt-table mt-2 w-full">
          <thead>
            <tr>
              <th>Tuval</th>
              <th>Boyut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tuvaller.map((t) => {
              const e = duzen[t.id];
              return (
                <tr key={t.id}>
                  <td>
                    {t.ek ? (
                      <input
                        className="dt-input w-40"
                        aria-label={`${t.ad} adı`}
                        value={e?.ad ?? t.ad}
                        maxLength={40}
                        onChange={(x) => setDuzen((d) => ({ ...d, [t.id]: { ad: x.target.value, g: e?.g ?? t.genislik, y: e?.y ?? t.yukseklik } }))}
                      />
                    ) : (
                      t.ad
                    )}
                  </td>
                  <td>
                    {t.ek ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          className="dt-input w-20"
                          type="number"
                          aria-label={`${t.ad} genişlik`}
                          value={e?.g ?? t.genislik}
                          onChange={(x) => setDuzen((d) => ({ ...d, [t.id]: { ad: e?.ad ?? t.ad, g: Number(x.target.value), y: e?.y ?? t.yukseklik } }))}
                        />
                        ×
                        <input
                          className="dt-input w-20"
                          type="number"
                          aria-label={`${t.ad} yükseklik`}
                          value={e?.y ?? t.yukseklik}
                          onChange={(x) => setDuzen((d) => ({ ...d, [t.id]: { ad: e?.ad ?? t.ad, g: e?.g ?? t.genislik, y: Number(x.target.value) } }))}
                        />
                      </span>
                    ) : (
                      `${t.genislik}×${t.yukseklik} (Ayarlar › Video)`
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {t.ek && (
                      <>
                        <button
                          type="button"
                          className="dt-btn"
                          disabled={mesgul || !e || !e.ad.trim() || !tuvalBoyutuGecerli(e.g, e.y)}
                          onClick={() =>
                            void yap(async () => {
                              if (e!.ad.trim() !== t.ad) await motorApi.tuval({ eylem: "adlandir", id: t.id, ad: e!.ad.trim() });
                              const r =
                                e!.g !== t.genislik || e!.y !== t.yukseklik
                                  ? await motorApi.tuval({ eylem: "boyut", id: t.id, genislik: e!.g, yukseklik: e!.y })
                                  : undefined;
                              setDuzen(({ [t.id]: _, ...d }) => d);
                              return r;
                            }, `«${e!.ad.trim()}» kaydedildi`)
                          }
                        >
                          Kaydet
                        </button>{" "}
                        <button type="button" className="dt-btn-danger" disabled={mesgul} onClick={() => setSilinecek(t)}>
                          Sil…
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {silinecek && (
          <div className="mt-2 flex items-center gap-2" role="alertdialog" aria-label="Tuvali sil">
            <span className="min-w-0 flex-1">«{silinecek.ad}» ve bu tuvalin tüm sahneleri silinecek. Bu tuvali yayınlayan hedefler yatay tuvale döner.</span>
            <button
              type="button"
              className="dt-btn-danger"
              onClick={() => {
                const t = silinecek;
                setSilinecek(null);
                void yap(() => motorApi.tuval({ eylem: "sil", id: t.id }), `«${t.ad}» silindi`);
              }}
            >
              Sil
            </button>
            <button type="button" className="dt-btn" onClick={() => setSilinecek(null)}>
              Vazgeç
            </button>
          </div>
        )}
        <span className="dt-etiket mt-3 block">Yeni tuval {ekler.length >= 8 && "(en çok 8 — sınıra ulaşıldı)"}</span>
        <div className="flex flex-wrap items-center gap-1.5">
          <input className="dt-input w-40" placeholder="Ad" aria-label="Yeni tuval adı" maxLength={40} value={ad} onChange={(e) => setAd(e.target.value)} />
          <input className="dt-input w-20" type="number" aria-label="Genişlik" value={g} onChange={(e) => setG(Number(e.target.value))} />×
          <input className="dt-input w-20" type="number" aria-label="Yükseklik" value={y} onChange={(e) => setY(Number(e.target.value))} />
          <select
            className="dt-input w-40"
            aria-label="Hazır boyut"
            value=""
            onChange={(e) => {
              const h = HAZIR[Number(e.target.value)];
              if (h) (setG(h.g), setY(h.y));
            }}
          >
            <option value="">Hazır boyut…</option>
            {HAZIR.map((h, i) => (
              <option key={h.ad} value={i}>
                {h.ad}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="dt-btn-primary"
            disabled={mesgul || !ad.trim() || !tuvalBoyutuGecerli(g, y) || ekler.length >= 8}
            onClick={() =>
              void yap(async () => {
                await motorApi.tuval({ eylem: "ekle", ad: ad.trim(), genislik: g, yukseklik: y });
                setAd("");
              }, `«${ad.trim()}» tuvali eklendi`)
            }
          >
            Ekle
          </button>
        </div>
        {!tuvalBoyutuGecerli(g, y) && <p className="mt-1">Boyut 16–8192 arası çift sayı olmalı.</p>}
      </div>
    </Pencere>
  );
}
