/** U14: tema (sahne ekranları), overlay widget düzeni ve deste tek dosyada; içe aktarmadan önce "neler değişecek". */
import { useRef, useState } from "react";
import { API_BASE, fetchSettings, patchSettings } from "../../lib/api";
import { parseDeck } from "../../lib/deck";
import { degisiklikler, PAKET_EKRANLARI, paketOku, paketOlustur, widgetEslesmesi, type Paket } from "../../lib/paylasimPaketi";

type Widget = { id: string; kind: string; name?: string };

async function widgetlar(): Promise<(Widget & Record<string, unknown>)[]> {
  const r = await fetch(`${API_BASE}/api/bot/widgets`, { cache: "no-store" });
  if (!r.ok) throw new Error("Widget listesi okunamadı");
  const d = (await r.json()) as unknown;
  return (Array.isArray(d) ? d : ((d as { widgets?: unknown[] })?.widgets ?? [])) as (Widget & Record<string, unknown>)[];
}

async function mevcutDurum() {
  const [ekranlar, w, panel] = await Promise.all([
    Promise.all(PAKET_EKRANLARI.map((e) => fetchSettings(e).then((s) => [e, s] as const))),
    widgetlar(),
    fetchSettings("panel"),
  ]);
  return { ekranlar: Object.fromEntries(ekranlar) as Record<string, Record<string, unknown>>, widgetlar: w, panel: panel as Record<string, unknown> };
}

async function istek(yol: string, yontem: string, govde: unknown) {
  const r = await fetch(`${API_BASE}${yol}`, { method: yontem, headers: { "Content-Type": "application/json" }, body: JSON.stringify(govde) });
  if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
}

export function PaketPaylasimi() {
  const [mesaj, setMesaj] = useState("");
  const [yuk, setYuk] = useState(false);
  const [onizleme, setOnizleme] = useState<{ paket: Paket; satirlar: string[] } | null>(null);
  const dosya = useRef<HTMLInputElement>(null);

  const disaAktar = async () => {
    setYuk(true);
    setMesaj("");
    try {
      const m = await mevcutDurum();
      const { paket, atilan } = paketOlustur({ ekranlar: m.ekranlar, widgetlar: m.widgetlar, deste: m.panel.controlDeck ?? null });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([JSON.stringify(paket, null, 2)], { type: "application/json" }));
      a.download = `axthrowa-paket-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMesaj(`Paket indirildi: ${Object.keys(paket.ekranlar).length} ekran, ${paket.widgetlar.length} widget${paket.deste ? ", deste" : ""}.${atilan.length ? ` Sır taşıyabilecek ${atilan.length} alan dosyaya yazılmadı.` : ""}`);
    } catch (e) {
      setMesaj(String((e as Error).message || e).slice(0, 240));
    } finally {
      setYuk(false);
    }
  };

  const dosyaSecildi = async (f: File | undefined) => {
    if (!f) return;
    setMesaj("");
    try {
      const paket = paketOku(await f.text());
      const m = await mevcutDurum();
      const satirlar = degisiklikler(paket, { ekranlar: m.ekranlar, widgetlar: m.widgetlar, deste: m.panel.controlDeck ? parseDeck(m.panel.controlDeck) : null });
      setOnizleme({ paket, satirlar });
    } catch (e) {
      setMesaj(String((e as Error).message || e).slice(0, 240));
    } finally {
      if (dosya.current) dosya.current.value = "";
    }
  };

  const uygula = async () => {
    if (!onizleme) return;
    const { paket } = onizleme;
    setYuk(true);
    try {
      for (const e of PAKET_EKRANLARI) if (paket.ekranlar[e]) await patchSettings(e, paket.ekranlar[e] as never);
      const { guncelle, ekle } = widgetEslesmesi(paket.widgetlar, await widgetlar());
      for (const g of guncelle) await istek(`/api/bot/widgets/${encodeURIComponent(g.id)}/config`, "PUT", { config: g.w.config });
      for (const w of ekle) await istek("/api/bot/widgets", "POST", w);
      if (paket.deste) {
        // Sürüm kilidi: kayıttaki sürümle yazılır (arada değiştiyse sunucu 409 döner)
        const rev = parseDeck((await fetchSettings("panel")).controlDeck).rev ?? 0;
        await istek("/api/settings/patch?screen=panel", "POST", { controlDeck: { ...paket.deste, rev } });
      }
      setMesaj("Paket uygulandı.");
      setOnizleme(null);
    } catch (e) {
      setMesaj(`Uygulanamadı (yarıda kalmış olabilir): ${String((e as Error).message || e).slice(0, 200)}`);
    } finally {
      setYuk(false);
    }
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold axt-etiket text-white">Paket paylaşımı</h3>
      <p className="text-xs font-medium text-white/75">
        Sahne ekranlarının görünümü, overlay widget düzeni ve deste tek dosyaya yazılır. Parola, belirteç ve yayın anahtarı gibi sırlar dosyaya
        girmez. İçe aktarırken önce neyin değişeceği gösterilir.
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="dt-btn" disabled={yuk} onClick={() => void disaAktar()}>
          Dışa aktar
        </button>
        <button type="button" className="dt-btn" disabled={yuk} onClick={() => dosya.current?.click()}>
          İçe aktar…
        </button>
        <input ref={dosya} type="file" accept=".json,application/json" className="hidden" aria-label="Paket dosyası" onChange={(e) => void dosyaSecildi(e.target.files?.[0])} />
      </div>
      {onizleme && (
        <div className="space-y-2 rounded-md bg-black/30 p-2 text-xs text-white/85">
          <p className="font-semibold text-white">Neler değişecek ({new Date(onizleme.paket.olusturma).toLocaleString("tr-TR")} tarihli paket)</p>
          {onizleme.satirlar.length ? (
            <ul className="list-disc pl-4">
              {onizleme.satirlar.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          ) : (
            <p>Hiçbir şey değişmeyecek; ayarlar zaten aynı.</p>
          )}
          <div className="flex gap-2">
            <button type="button" className="dt-btn" disabled={yuk || !onizleme.satirlar.length} onClick={() => void uygula()}>
              {yuk ? "…" : "Uygula"}
            </button>
            <button type="button" className="dt-btn" onClick={() => setOnizleme(null)}>
              Vazgeç
            </button>
          </div>
        </div>
      )}
      {mesaj && <p className="text-xs text-white/80">{mesaj}</p>}
    </div>
  );
}
