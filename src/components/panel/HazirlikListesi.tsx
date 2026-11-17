/**
 * UI-4: Dashboard açılışı. Yayın öncesi beş satır (OBS, bot, platformlar, sahneler, katmanlar), her satırda
 * durum ve tek düğme. Kurallar lib/hazirlik.ts'te; canlı sayılar Canlı ekranında.
 */
import { useCallback, useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { API_BASE, fetchSettings, okJson, overlayUrl } from "../../lib/api";
import { axbotBase, axbotStatus, type AxBotStatus } from "../../lib/axbot";
import { birlesikOverlayBul, birlesikOverlayEkle } from "../../lib/obs";
import { useObs } from "../../lib/obs/ObsContext";
import { OVERLAY_KAYNAK_ADI } from "../../lib/kurulum";
import { bagliPlatformlar, hazirMi, hazirlikSatirlari, type HazirlikGirdisi, type HazirlikHedefi } from "../../lib/hazirlik";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { Button, Panel, StatusDot } from "../ui";

type Props = {
  /** Satırın düğmesi: ilgili sayfaya git (bot başlatma ve katman ekleme burada yapılır) */
  onGit: (hedef: HazirlikHedefi) => void;
  onCanli: () => void;
  onToast: (m: string) => void;
};

const TON = { tamam: "ok", eksik: "warn", bilinmiyor: "neutral" } as const;
const DURUM_ADI = { tamam: "Hazır", eksik: "Eksik", bilinmiyor: "Bilinmiyor" } as const;

export default function HazirlikListesi({ onGit, onCanli, onToast }: Props) {
  const { connected: obsBagli } = useObs();
  const [girdi, setGirdi] = useState<Omit<HazirlikGirdisi, "obsBagli">>({ platformlar: null, bot: "kapali", sahneler: null, katman: null });
  const [mesgul, setMesgul] = useState<HazirlikHedefi | null>(null);

  const yukle = useCallback(async () => {
    const st: AxBotStatus | null = await axbotStatus().catch(() => null);
    const bot = st?.running ? "calisiyor" : st && !st.installed ? "yok" : "kapali";
    const [platformlar, sahneler, katman] = await Promise.all([
      bot === "calisiyor"
        ? axbotBase()
            .then((b) => fetch(`${b}/api/status`, { cache: "no-store" }))
            .then(okJson)
            .then((d: { platforms?: unknown }) => bagliPlatformlar(d?.platforms))
            .catch(() => null)
        : null,
      Promise.all([fetchSettings("starting"), fetchSettings("brb")])
        .then(([g, m]) => ({ giris: !!(g.obs as { startingScene?: string } | undefined)?.startingScene, mola: !!(m.obs as { brbScene?: string } | undefined)?.brbScene }))
        .catch(() => null),
      obsBagli ? birlesikOverlayBul(overlayUrl(API_BASE, "overlay/master"), OVERLAY_KAYNAK_ADI).then((k) => k !== null).catch(() => null) : null,
    ]);
    setGirdi({ bot, platformlar, sahneler, katman });
  }, [obsBagli]);

  useEffect(() => {
    void yukle();
    const id = setVisibleInterval(() => void yukle(), 10000);
    return () => clearVisibleInterval(id);
  }, [yukle]);

  const satirlar = hazirlikSatirlari({ obsBagli, ...girdi });

  const eylem = async (hedef: HazirlikHedefi) => {
    const s = satirlar.find((x) => x.id === hedef);
    if (hedef === "bot" && s?.durum === "eksik" && girdi.bot === "kapali" && isTauri()) {
      setMesgul(hedef);
      try {
        await invoke("axbot_start");
        onToast("Bot başlatıldı");
      } catch (e) {
        onToast(`Bot başlatılamadı: ${String((e as Error)?.message || e).slice(0, 120)}`);
      } finally {
        setMesgul(null);
        void yukle();
      }
      return;
    }
    if (hedef === "katman" && s?.durum === "eksik") {
      setMesgul(hedef);
      try {
        const r = await birlesikOverlayEkle(overlayUrl(API_BASE, "overlay/master"), OVERLAY_KAYNAK_ADI);
        onToast(r.durum === "eklendi" ? `Katman "${r.sahne}" sahnesine eklendi` : `OBS'te zaten var: ${r.kaynak}`);
      } catch (e) {
        onToast(`Katman eklenemedi: ${String((e as Error)?.message || e).slice(0, 120)}`);
      } finally {
        setMesgul(null);
        void yukle();
      }
      return;
    }
    onGit(hedef);
  };

  const hazir = hazirMi(satirlar);
  return (
    <Panel
      title="Yayın öncesi"
      meta={hazir ? "hazır" : `${satirlar.filter((s) => s.durum === "eksik").length} eksik`}
      scroll={false}
      className="mx-4 mb-3 rounded-ui-2 border border-ui-line"
      actions={
        <Button size="sm" variant={hazir ? "primary" : "secondary"} onClick={onCanli}>
          Canlı ekranına geç
        </Button>
      }
    >
      <ul className="divide-y divide-ui-line">
        {satirlar.map((s) => (
          <li key={s.id} className="flex min-h-hit items-center gap-3 px-pad py-1.5">
            <span className="w-28 shrink-0 text-ui-3 font-semibold text-ui-fg">{s.ad}</span>
            <StatusDot tone={TON[s.durum]} label={DURUM_ADI[s.durum]} className="w-24 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-ui-2 text-ui-fg2">{s.aciklama}</span>
            <Button
              size="md"
              variant={s.durum === "eksik" ? "secondary" : "ghost"}
              loading={mesgul === s.id}
              disabled={s.id === "katman" && s.durum === "bilinmiyor"}
              onClick={() => void eylem(s.id)}
            >
              {s.eylem}
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
