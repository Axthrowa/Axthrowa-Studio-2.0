/** U7b: son biten yayının raporu: süre, zirve, izleyici eğrisi ve düşen kare (Yayın sonrası kipi). */
import { useEffect, useState } from "react";
import { fetchDashboard, fmtDuration, sessionReport, type OturumRaporu, type StreamSession } from "../../lib/api/botApi";

/** Eğri noktaları (svg viewBox 0..w, 0..h); tek örnekte yatay çizgi */
export function egriNoktalari(izleyici: [number, number][], w: number, h: number): string {
  if (!izleyici.length) return "";
  const t0 = izleyici[0][0];
  const sure = Math.max(1, izleyici[izleyici.length - 1][0] - t0);
  const enCok = Math.max(1, ...izleyici.map((n) => n[1]));
  const nokta = (t: number, v: number) => `${((t - t0) / sure) * w},${h - (v / enCok) * h}`;
  return izleyici.length === 1 ? `0,${h - (izleyici[0][1] / enCok) * h} ${w},${h - (izleyici[0][1] / enCok) * h}` : izleyici.map(([t, v]) => nokta(t, v)).join(" ");
}

export function YayinRaporu() {
  const [oturum, setOturum] = useState<StreamSession | null>(null);
  const [rapor, setRapor] = useState<OturumRaporu | null>(null);
  const [hata, setHata] = useState("");

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const son = (await fetchDashboard()).sessions.find((s) => s.ended_at) ?? null;
        if (iptal) return;
        setOturum(son);
        if (son) {
          const r = await sessionReport(son.id);
          if (!iptal) setRapor(r);
        }
      } catch (e) {
        if (!iptal) setHata(String((e as Error)?.message || e));
      }
    })();
    return () => {
      iptal = true;
    };
  }, []);

  if (hata) return <p className="text-sm text-panel-muted">Rapor okunamadı: {hata}</p>;
  if (!oturum) return <p className="text-sm text-panel-muted">Henüz biten yayın yok. Yayını bitirince rapor burada açılır.</p>;
  const egri = rapor?.izleyici ?? [];
  const kare =
    rapor?.toplamKare && rapor.dusenKare !== null
      ? `%${((rapor.dusenKare / rapor.toplamKare) * 100).toFixed(2)} (${rapor.dusenKare} / ${rapor.toplamKare})`
      : "ölçülmedi";
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 text-sm">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-panel-muted">
        <span className="font-medium text-white/90">{oturum.title || "Yayın"}</span>
        <span>Süre {fmtDuration(oturum.duration_sec)}</span>
        <span>Zirve {oturum.peak_viewers} izleyici</span>
        <span>+{oturum.new_followers} takip</span>
        <span>+{oturum.new_subs} abone</span>
        <span>Düşen kare {kare}</span>
      </div>
      {egri.length ? (
        <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="İzleyici eğrisi">
          <polyline fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-panel-accent" points={egriNoktalari(egri, 600, 120)} />
        </svg>
      ) : (
        <p className="text-[12px] text-panel-muted">İzleyici eğrisi için bu yayında örnek kaydedilmedi.</p>
      )}
    </div>
  );
}
