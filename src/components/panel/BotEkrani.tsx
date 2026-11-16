/**
 * Bot ekranı: durum, sohbete yanıt anahtarı ve sekmeler. Sayfaların içi botun kendi sayfaları (gömülü).
 * Her bot sayfası bir sekmede ya da kendi menü başlığında (lib/anaMenu.ts); "Tüm ayarlar" botun tam panelini
 * kendi yan menüsüyle açar (kullanıcı isteği: A2'de kaldırılmıştı, geri geldi).
 */
import { useCallback, useEffect, useState } from "react";
import { BOT_SEKMELERI, TUM_AYARLAR, botSekmesiBul } from "../../lib/anaMenu";
import { axbotBase } from "../../lib/axbot";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import StatusDot from "@/components/axthrowa/StatusDot";
import AxBotHost from "./AxBotHost";

import { okJson } from "../../lib/api";
type Props = {
  sayfa?: string;
  onSayfa: (sayfa: string) => void;
  onToast: (m: string) => void;
  onOpenMusic: () => void;
};

type Kick = { connected?: boolean; yazabilir?: boolean; botHesabi?: string };

export default function BotEkrani({ sayfa, onSayfa, onToast, onOpenMusic }: Props) {
  const [kick, setKick] = useState<Kick | null>(null);
  const [sessiz, setSessiz] = useState<boolean | null>(null);
  const secili = botSekmesiBul(sayfa);
  const tumu = secili === TUM_AYARLAR;

  const yukle = useCallback(async () => {
    try {
      const base = await axbotBase();
      const [d, s] = await Promise.all([
        fetch(`${base}/api/status`, { cache: "no-store" }).then(okJson),
        fetch(`${base}/api/bot/sessiz`, { cache: "no-store" }).then(okJson),
      ]);
      setKick(d?.platforms?.kick || {});
      setSessiz(!!s?.sessiz);
    } catch {
      setKick(null);
      setSessiz(null);
    }
  }, []);

  useEffect(() => {
    void yukle();
    const id = setVisibleInterval(() => void yukle(), 8000);
    return () => clearVisibleInterval(id);
  }, [yukle]);

  const yanitDegistir = async (yanitVersin: boolean) => {
    setSessiz(!yanitVersin);
    try {
      const r = await fetch(`${await axbotBase()}/api/bot/sessiz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessiz: !yanitVersin }),
      });
      if (!r.ok) throw new Error(String(r.status));
      onToast(yanitVersin ? "Bot sohbete yanıt verecek" : "Bot sohbete yazmayacak");
    } catch {
      setSessiz(yanitVersin);
      onToast("Ayar değiştirilemedi: bot kapalı olabilir");
    }
  };

  const sekmeSinifi = (acik: boolean) => `h-9 whitespace-nowrap rounded-md px-3.5 text-sm font-semibold transition-colors ${acik ? "bg-white/10 text-white" : "text-panel-muted hover:text-white"}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-2">
        <div role="tablist" aria-label="Bot bölümleri" className="flex flex-wrap gap-1">
          {BOT_SEKMELERI.map((s) => (
            <button key={s.id} type="button" role="tab" aria-selected={secili === s.id} className={sekmeSinifi(secili === s.id)} onClick={() => onSayfa(s.id)}>
              {s.ad}
            </button>
          ))}
          <button type="button" role="tab" aria-selected={tumu} className={sekmeSinifi(tumu)} onClick={() => onSayfa(TUM_AYARLAR)}>
            Tüm ayarlar
          </button>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-panel-muted">
          <span className="inline-flex items-center gap-2">
            <StatusDot ok={!!kick?.connected} label={kick === null ? "Bot kapalı" : kick.botHesabi ? `@${kick.botHesabi}` : kick.yazabilir ? "Bot hazır" : "Bot hesabı yok"} />
          </span>
          <label className={`inline-flex min-h-9 items-center gap-2 ${sessiz === null ? "opacity-50" : "cursor-pointer"}`}>
            <input type="checkbox" className="h-4 w-4 accent-[var(--panel-accent)]" disabled={sessiz === null} checked={sessiz === false} onChange={(e) => void yanitDegistir(e.target.checked)} />
            Sohbete yanıt versin
          </label>
        </div>
      </div>
      <AxBotHost onToast={onToast} tab={tumu ? "dashboard" : sayfa || BOT_SEKMELERI[0].id} embed={!tumu} onOpenMusic={onOpenMusic} />
    </div>
  );
}
