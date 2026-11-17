/** Y7: üst şeritte sonraki Twitch reklamına geri sayım ve "Ertele"; olayları AxBoT otomasyonuna bildirir */
import { useEffect, useRef, useState } from "react";
import { bildir } from "../../lib/bildirimler";
import { sureMetni } from "../../lib/miniKip";
import { twitchReklamErtele, twitchReklamOkuyabilir, twitchReklamTakvimi, type ReklamTakvimi } from "../../lib/platformAuth/twitchWrite";
import { BOS_REKLAM, reklamAdimi, reklamOlayiGonder } from "../../lib/twitchReklam";

export function ReklamSayaci() {
  const [takvim, setTakvim] = useState<ReklamTakvimi | null>(null);
  const [simdi, setSimdi] = useState(() => Date.now());
  const [bekle, setBekle] = useState(false);
  const durum = useRef(BOS_REKLAM);

  useEffect(() => {
    let iptal = false;
    const oku = async () => {
      if (!twitchReklamOkuyabilir()) return setTakvim(null);
      try {
        const t = await twitchReklamTakvimi();
        if (iptal) return;
        setTakvim(t);
        const r = reklamAdimi(durum.current, t, Date.now() / 1000);
        durum.current = r.durum;
        for (const o of r.olaylar) void reklamOlayiGonder(o, o === "reklam_yaklasiyor" ? Math.round(t.sonrakiReklam - Date.now() / 1000) : t.sure);
      } catch {
        /* geçici Twitch hatası: bir sonraki turda yeniden */
      }
    };
    void oku();
    const o = setInterval(() => void oku(), 15_000);
    const s = setInterval(() => setSimdi(Date.now()), 1000);
    return () => {
      iptal = true;
      clearInterval(o);
      clearInterval(s);
    };
  }, []);

  if (!takvim?.sonrakiReklam) return null;
  const kalanMs = Math.max(0, takvim.sonrakiReklam * 1000 - simdi);
  const yakin = kalanMs <= 60_000;
  const ertele = async () => {
    setBekle(true);
    try {
      const e = await twitchReklamErtele();
      setTakvim((t) => (t ? { ...t, ...e } : t));
      bildir("Sonraki reklam 5 dakika ertelendi");
    } catch (e) {
      bildir(`Reklam ertelenemedi: ${String((e as Error).message || e).slice(0, 120)}`);
    } finally {
      setBekle(false);
    }
  };

  return (
    <div className={`flex items-center gap-1.5 rounded-ui-1 px-2 py-0.5 text-ui-2 ${yakin ? "bg-amber-500/20 text-amber-200" : "bg-black/20 text-white/70"}`} title="Sonraki Twitch reklamı">
      <span>Reklam</span>
      <span className="font-mono tabular-nums">{sureMetni(kalanMs)}</span>
      <button
        type="button"
        disabled={bekle || takvim.ertelemeHakki < 1}
        onClick={() => void ertele()}
        className="rounded px-1.5 font-semibold text-white hover:bg-white/10 disabled:opacity-40"
        title={takvim.ertelemeHakki < 1 && takvim.ertelemeYenilenme ? `Erteleme hakkı ${new Date(takvim.ertelemeYenilenme * 1000).toLocaleTimeString()} itibarıyla yenilenir` : "Sonraki reklamı 5 dk ertele"}
      >
        Ertele ({takvim.ertelemeHakki})
      </button>
    </div>
  );
}
