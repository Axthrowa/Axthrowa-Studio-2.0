import { useEffect, useState } from "react";
import { CirclePower, History, LayoutDashboard, PlugZap, SlidersHorizontal, Wrench } from "lucide-react";
import type { DashboardBolumu } from "./ProfileDashboard";
import YayinSaglikSatiri from "./YayinSaglikSatiri";
import { BasiliTutDugme } from "../ui/BasiliTut";

/**
 * Dashboard üst şeridi: alt sekmeler + her sekmeden erişilen yayın düğmesi.
 *
 * Kullanıcı bildirdi: "Dashboard daha derli toplu ve anlaşılır olsun." Eskiden
 * tek sayfada ~3500 px alt alta: Kick girişi, OBS ayarları, dev bir dikey
 * "Yayını Başlat" sütunu, telemetri, iki ayrı istatistik ızgarası (aynı sayılar
 * iki kez), önizleme, geçmiş, veritabanı test düğmeleri, uzak editör, OBS
 * sahneleri ve kısayollar. Artık amaca göre beş sekme; hiçbir özellik kalkmadı.
 */
export const DASHBOARD_SEKMELERI: {
  id: DashboardBolumu;
  ad: string;
  ipucu: string;
  ikon: typeof LayoutDashboard;
}[] = [
  { id: "genel", ad: "Genel bakış", ipucu: "Canlı durum, istatistikler, önizleme, sohbet, son olaylar", ikon: LayoutDashboard },
  { id: "baglantilar", ad: "Bağlantılar", ipucu: "Kick girişi, OBS WebSocket ve bitiş kuralları", ikon: PlugZap },
  { id: "obs", ad: "OBS kontrol", ipucu: "Sahneler, kaynaklar, ses mikseri, kısayollar, otomasyon", ikon: SlidersHorizontal },
  { id: "gecmis", ad: "Geçmiş", ipucu: "Önceki yayınlar ve izleyici zirveleri", ikon: History },
  { id: "gelismis", ad: "Gelişmiş", ipucu: "Veritabanı araçları ve uzak editör", ikon: Wrench },
];

const ANAHTAR = "panel.dashboardBolum";

/** Kayıtlı değeri doğrular (eski/bozuk kayıt "genel"e döner). */
export function bolumOku(ham: string | null): DashboardBolumu {
  return DASHBOARD_SEKMELERI.some((s) => s.id === ham) ? (ham as DashboardBolumu) : "genel";
}

/** Seçili alt sekme (panel tercihi — overlay ayarı değil, OBS'e gitmez). */
export function useDashboardBolumu(): [DashboardBolumu, (b: DashboardBolumu) => void] {
  const [bolum, setBolum] = useState<DashboardBolumu>(() => {
    try {
      return bolumOku(localStorage.getItem(ANAHTAR));
    } catch {
      return "genel";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(ANAHTAR, bolum);
    } catch {
      /* depolama kapalı */
    }
  }, [bolum]);
  return [bolum, setBolum];
}

type Props = {
  bolum: DashboardBolumu;
  onBolum: (b: DashboardBolumu) => void;
  master: { live: boolean; busy: boolean; onToggle: () => void };
  obsBagli: boolean;
};

export default function DashboardUstSerit({ bolum, onBolum, master, obsBagli }: Props) {
  return (
    <div className="sticky top-0 z-20 mx-4 mb-3 mt-1.5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.08] bg-[color:var(--panel-elevated)] px-2 py-1.5 shadow-panel">
      <div role="tablist" aria-label="Dashboard bölümleri" className="flex flex-wrap gap-1">
        {DASHBOARD_SEKMELERI.map(({ id, ad, ipucu, ikon: Ikon }) => {
          const secili = id === bolum;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={secili}
              title={ipucu}
              onClick={() => onBolum(id)}
              className={
                "inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors " +
                (secili
                  ? "bg-panel-accent/15 text-panel-accent ring-1 ring-panel-accent/40"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white")
              }
            >
              <Ikon className="h-3.5 w-3.5" />
              {ad}
            </button>
          );
        })}
      </div>

      <YayinSaglikSatiri />
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => onBolum("baglantilar")}
          title={obsBagli ? "OBS WebSocket bağlı" : "OBS WebSocket bağlı değil — Bağlantılar sekmesinden bağlan"}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-semibold text-white/80 hover:bg-white/[0.08]"
        >
          <span className={`h-2 w-2 rounded-full ${obsBagli ? "bg-emerald-400" : "bg-red-400"}`} />
          OBS {obsBagli ? "bağlı" : "bağlı değil"}
        </button>
        <BasiliTutDugme
          basiliTut={master.live}
          disabled={master.busy}
          onOnay={master.onToggle}
          title={master.live ? "OBS yayınını ve platform oturumunu bitir" : "OBS + platform: tek tıkla canlıya geç"}
          className={
            "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-extrabold uppercase tracking-wider transition disabled:opacity-60 " +
            (master.live
              ? "bg-red-500 text-white shadow-[0_0_18px_rgb(var(--ui-danger)/0.45)] hover:bg-red-400"
              : "bg-emerald-500 text-ui-bg shadow-[0_0_18px_rgb(var(--ui-ok)/0.35)] hover:bg-emerald-400")
          }
        >
          <CirclePower className="h-4 w-4" />
          {master.busy ? "İşleniyor…" : master.live ? "Yayını bitir" : "Yayını başlat"}
        </BasiliTutDugme>
      </div>
    </div>
  );
}
