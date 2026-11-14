/** U7b: son biten yayının raporu: süre, zirve, izleyici eğrisi ve düşen kare (Yayın sonrası kipi). */
import { useEffect, useState } from "react";
import { spotifyYayinListesi } from "../../lib/api";
import { KlipDuzenleyici } from "./KlipDuzenleyici";
import { TwitchKlipFormu } from "./TwitchKlipFormu";
import { fetchDashboard, fmtDuration, markers, sessionReport, type Isaret, type OturumRaporu, type StreamSession } from "../../lib/api/botApi";

/** Eğri noktaları (svg viewBox 0..w, 0..h); tek örnekte yatay çizgi */
export function egriNoktalari(izleyici: [number, number][], w: number, h: number): string {
  if (!izleyici.length) return "";
  const t0 = izleyici[0][0];
  const sure = Math.max(1, izleyici[izleyici.length - 1][0] - t0);
  const enCok = Math.max(1, ...izleyici.map((n) => n[1]));
  const nokta = (t: number, v: number) => `${((t - t0) / sure) * w},${h - (v / enCok) * h}`;
  return izleyici.length === 1 ? `0,${h - (izleyici[0][1] / enCok) * h} ${w},${h - (izleyici[0][1] / enCok) * h}` : izleyici.map(([t, v]) => nokta(t, v)).join(" ");
}

/** U6: yayındaki an "1:02:03" (yayın kapalıyken işaretlendiyse null) */
export function anMetni(ms: number | null): string | null {
  if (ms === null || ms < 0) return null;
  const sn = Math.floor(ms / 1000);
  const s = Math.floor(sn / 3600);
  const d = Math.floor((sn % 3600) / 60);
  const iki = (n: number) => String(n).padStart(2, "0");
  return s ? `${s}:${iki(d)}:${iki(sn % 60)}` : `${d}:${iki(sn % 60)}`;
}

export function YayinRaporu() {
  const [oturum, setOturum] = useState<StreamSession | null>(null);
  const [rapor, setRapor] = useState<OturumRaporu | null>(null);
  const [hata, setHata] = useState("");
  const [isaretler, setIsaretler] = useState<Isaret[]>([]);
  const [dikey, setDikey] = useState<number | null>(null);
  const [liste, setListe] = useState<{ durum: "bos" | "yapiliyor" | "hata"; metin?: string } | { durum: "tamam"; url: string; eklenen: number }>({ durum: "bos" });

  useEffect(() => {
    let iptal = false;
    void (async () => {
      try {
        const son = (await fetchDashboard()).sessions.find((s) => s.ended_at) ?? null;
        if (iptal) return;
        setOturum(son);
        if (son) {
          const [r, i] = await Promise.all([sessionReport(son.id), markers(son.id).catch(() => [])]);
          if (!iptal) {
            setRapor(r);
            setIsaretler(i);
          }
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
        {oturum.ended_at && (
          <button
            type="button"
            disabled={liste.durum === "yapiliyor" || liste.durum === "tamam"}
            className="rounded-md border border-white/10 px-2 text-white/90 hover:bg-white/5 disabled:opacity-60"
            onClick={() => {
              setListe({ durum: "yapiliyor" });
              const ad = `Yayın ${new Date(oturum.started_at).toLocaleDateString("tr-TR")}${oturum.title ? ` — ${oturum.title}` : ""}`;
              spotifyYayinListesi(oturum.started_at, oturum.ended_at as number, ad)
                .then((r) => setListe({ durum: "tamam", url: r.url, eklenen: r.eklenen }))
                .catch((e) => setListe({ durum: "hata", metin: String((e as Error)?.message || e) }));
            }}
          >
            {liste.durum === "yapiliyor" ? "Liste yapılıyor…" : "Spotify çalma listesi yap"}
          </button>
        )}
        {liste.durum === "tamam" &&
          (liste.url ? (
            <a href={liste.url} target="_blank" rel="noreferrer" className="text-panel-accent underline">
              {liste.eklenen} şarkılık liste Spotify'da
            </a>
          ) : (
            <span>{liste.eklenen} şarkılık liste Spotify'da oluştu</span>
          ))}
        {liste.durum === "hata" && <span className="text-red-300">{liste.metin}</span>}
      </div>
      {egri.length ? (
        <svg viewBox="0 0 600 120" preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label="İzleyici eğrisi">
          <polyline fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" className="text-panel-accent" points={egriNoktalari(egri, 600, 120)} />
        </svg>
      ) : (
        <p className="text-[12px] text-panel-muted">İzleyici eğrisi için bu yayında örnek kaydedilmedi.</p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="mb-1 text-[12px] font-medium text-white/90">İşaretler ({isaretler.length})</p>
        {isaretler.length ? (
          <ul className="flex flex-col gap-1 text-[12px]">
            {isaretler.map((i) => (
              <li key={i.id} className="rounded-md border border-white/[0.06] px-2 py-1">
                <span className="font-mono text-white/90">{new Date(i.ts).toLocaleTimeString("tr-TR")}</span>
                {anMetni(i.offsetMs) && <span className="ml-2 text-panel-muted">yayında {anMetni(i.offsetMs)}</span>}
                {i.scene && <span className="ml-2 text-panel-muted">{i.scene}</span>}
                {i.chapter && <span className="ml-2 text-panel-muted">kayda bölüm eklendi</span>}
                {i.note && <span className="ml-2">“{i.note}”</span>}
                <div className="break-all text-[11px] text-panel-muted">{i.replayPath || "Tekrar dosyası yok (tekrar arabelleği kapalıydı)"}</div>
                {i.replayPath &&
                  (dikey === i.id ? (
                    <KlipDuzenleyici isaret={i.id} onKapat={() => setDikey(null)} />
                  ) : (
                    <button type="button" className="text-[11px] text-panel-accent hover:underline" onClick={() => setDikey(i.id)}>
                      Dikey klip (9:16)
                    </button>
                  ))}
                <TwitchKlipFormu isaret={i} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-panel-muted">İşaret yok. Yayında "An işaretle" kısayolu, deste tuşu ya da sohbette !isaret ile eklenir.</p>
        )}
      </div>
    </div>
  );
}
