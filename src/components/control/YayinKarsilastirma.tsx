/** Y3: son 30 yayının karşılaştırması: ortalama ve zirve izleyici, saat başına takip, dakika başına mesaj, süre;
 * gün ve saat dilimine göre en iyi ortalama (Yayın sonrası kipi). */
import { useEffect, useState } from "react";
import { fmtDuration, listSessions, type StreamSession } from "../../lib/api/botApi";
import { egriNoktalari } from "./YayinRaporu";

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

export type KarsilastirmaSatiri = {
  id: string;
  baslangic: number;
  ort: number;
  zirve: number;
  takipSaat: number;
  mesajDk: number;
  sureSn: number;
};

/** Biten ve en az 1 dk süren yayınlar, eskiden yeniye */
export function karsilastirmaSatirlari(oturumlar: StreamSession[]): KarsilastirmaSatiri[] {
  return oturumlar
    .filter((s) => s.ended_at && (s.duration_sec ?? 0) >= 60)
    .map((s) => {
      const sn = s.duration_sec as number;
      return {
        id: s.id,
        baslangic: s.started_at,
        ort: Math.round(s.avg_viewers),
        zirve: s.peak_viewers,
        takipSaat: +(s.new_followers / (sn / 3600)).toFixed(1),
        mesajDk: +(s.chat_messages / (sn / 60)).toFixed(1),
        sureSn: sn,
      };
    })
    .sort((a, b) => a.baslangic - b.baslangic);
}

/** Gün + başlangıç saatine göre en yüksek ortalama izleyici; en az iki yayın yoksa null */
export function enIyiDilim(satirlar: KarsilastirmaSatiri[]): { ad: string; ort: number; yayin: number } | null {
  if (satirlar.length < 2) return null;
  const kume = new Map<string, number[]>();
  for (const s of satirlar) {
    const t = new Date(s.baslangic);
    const ad = `${GUNLER[t.getDay()]} ${String(t.getHours()).padStart(2, "0")}:00`;
    kume.set(ad, [...(kume.get(ad) ?? []), s.ort]);
  }
  let en: { ad: string; ort: number; yayin: number } | null = null;
  for (const [ad, v] of kume) {
    const ort = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
    if (!en || ort > en.ort) en = { ad, ort, yayin: v.length };
  }
  return en;
}

export function YayinKarsilastirma() {
  const [satirlar, setSatirlar] = useState<KarsilastirmaSatiri[] | null>(null);
  const [hata, setHata] = useState("");

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const { sessions } = await listSessions(30);
        if (!iptal) setSatirlar(karsilastirmaSatirlari(sessions));
      } catch (e) {
        if (!iptal) setHata(String((e as Error)?.message || e));
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  if (hata) return <p className="text-sm text-panel-muted">Yayınlar okunamadı: {hata}</p>;
  if (!satirlar) return null;
  if (satirlar.length < 2) return <p id="rapor-karsilastirma" className="text-sm text-panel-muted">Karşılaştırma için en az iki biten yayın gerekir.</p>;
  const en = enIyiDilim(satirlar);
  return (
    <div id="rapor-karsilastirma" className="flex h-full min-h-0 flex-col gap-2 text-[12px]">
      {en && (
        <p className="text-panel-muted">
          En iyi dilim: <span className="font-medium text-white/90">{en.ad}</span> — ortalama {en.ort} izleyici ({en.yayin} yayın)
        </p>
      )}
      <svg viewBox="0 0 600 60" preserveAspectRatio="none" className="h-12 w-full" role="img" aria-label="Ortalama izleyici eğilimi">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="text-panel-accent"
          points={egriNoktalari(satirlar.map((s) => [s.baslangic, s.ort]), 600, 60)}
        />
      </svg>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full text-left">
          <thead className="text-panel-muted">
            <tr>
              <th className="font-normal">Tarih</th>
              <th className="font-normal">Süre</th>
              <th className="font-normal">Ort.</th>
              <th className="font-normal">Zirve</th>
              <th className="font-normal">Takip/sa</th>
              <th className="font-normal">Mesaj/dk</th>
            </tr>
          </thead>
          <tbody>
            {[...satirlar].reverse().map((s) => (
              <tr key={s.id} className="border-t border-white/[0.05]">
                <td>{new Date(s.baslangic).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</td>
                <td>{fmtDuration(s.sureSn)}</td>
                <td>{s.ort}</td>
                <td>{s.zirve}</td>
                <td>{s.takipSaat}</td>
                <td>{s.mesajDk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
