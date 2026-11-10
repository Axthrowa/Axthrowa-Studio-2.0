/**
 * Durum şeridi (tally): pencere başlığının içinde, her ekranda kalıcı. CANLI süre, KAYIT, OBS, Bot, platformlar,
 * bit hızı, kare kaybı ve açık uyarılar. Durum = renk + simge + metin; kırmızı yalnız CANLI, "bağlı değil" nötr.
 * Veri: store (`isLive`, `isObsConnected`, `obsConnecting`, `kick`), `getStreamHealth` yoklaması (5 sn, eskiden alt
 * çubuktaydı) ve `useNotices`. Ölçülmeyen değer "—" (KAYIT, Bot, Twitch, YouTube: kabukta veri kaynağı yok).
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, Gauge, LoaderCircle, Unplug, TriangleAlert, Bot, Circle } from "lucide-react";
import { useI18n } from "../../i18n";
import { getStreamHealth, isObsConnected, type StreamHealth } from "../../lib/obs";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { bitHiziKbps } from "../../lib/yayinSagligi";
import { useNotices } from "../../lib/notices";
import { useAxthrowaStore } from "../../store/useAxthrowaStore";
import { StatusPill, Tooltip, cn } from "@/components/ui";
import { sayiBicim } from "@/components/ui/yardimci";

/** `01:42:10` — saat her zaman iki basamak (tally okunurluğu) */
export function sureBicim(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const iki = (n: number) => String(n).padStart(2, "0");
  return `${iki(Math.floor(s / 3600))}:${iki(Math.floor((s % 3600) / 60))}:${iki(s % 60)}`;
}

/** Kare kaybı eşikleri (docs/tasarim/yonler/studyo-masasi): < %1 iyi, %1–5 uyarı, > %5 uyarı + "yüksek" */
export function kareKaybiTonu(pct: number): "ok" | "warn" | "yuksek" {
  return pct < 1 ? "ok" : pct <= 5 ? "warn" : "yuksek";
}

/** Şeritteki sade öğe: simge + değer (+ geniş pencerede etiket). Sürükleme bölgesi. */
function Oge({ icon, children, className, ipucu }: { icon: ReactNode; children: ReactNode; className?: string; ipucu?: string }) {
  const oge = (
    <span
      data-tauri-drag-region
      className={cn("inline-flex h-[18px] shrink-0 items-center gap-1 whitespace-nowrap font-mono text-ui-1 tabular-nums text-ui-fg2 [&>svg]:pointer-events-none [&>svg]:h-3 [&>svg]:w-3", className)}
    >
      {icon}
      {children}
    </span>
  );
  return ipucu ? <Tooltip content={ipucu} side="bottom">{oge}</Tooltip> : oge;
}

/** Platform: harf kutusu (marka simgesi yok — lucide 1.x marka simgelerini kaldırdı) + ad + izleyici */
function Platform({ harf, ad, deger, ipucu }: { harf: string; ad: string; deger: string | null; ipucu: string }) {
  return (
    <Tooltip content={ipucu} side="bottom">
      <span data-tauri-drag-region className="inline-flex h-[18px] shrink-0 items-center gap-1 whitespace-nowrap text-ui-1 text-ui-fg2">
        <span aria-hidden className="pointer-events-none flex h-3.5 w-3.5 items-center justify-center rounded-ui-1 border border-ui-line2 font-mono text-ui-1 font-semibold leading-none text-ui-fg">
          {harf}
        </span>
        <span className="pointer-events-none max-xl:hidden">{ad}</span>
        <span className={cn("pointer-events-none font-mono tabular-nums", deger ? "text-ui-fg" : "text-ui-fg3")}>{deger ?? "—"}</span>
        <span className="sr-only xl:hidden">{ad}</span>
      </span>
    </Tooltip>
  );
}

type Props = {
  /** OBS öğesine basınca bağlantı ayarlarını aç */
  onObs?: () => void;
};

export default function DurumCubugu({ onObs }: Props) {
  const { t, locale } = useI18n();
  const obs = useAxthrowaStore((s) => s.isObsConnected);
  const obsBaglaniyor = useAxthrowaStore((s) => s.obsConnecting);
  const canli = useAxthrowaStore((s) => s.isLive);
  const kick = useAxthrowaStore((s) => s.kick);
  const notices = useNotices();
  const [saglik, setSaglik] = useState<StreamHealth | null>(null);
  const [kbps, setKbps] = useState<number | null>(null);
  const [sure, setSure] = useState(0);
  const ornek = useRef({ at: 0, sure: 0, aktif: false });
  const onceki = useRef<StreamHealth | null>(null);

  useEffect(() => {
    let iptal = false;
    const tick = async () => {
      if (!isObsConnected()) {
        ornek.current.aktif = false;
        onceki.current = null;
        if (!iptal) {
          setSure(0);
          setSaglik(null);
          setKbps(null);
        }
        return;
      }
      try {
        const h = await getStreamHealth();
        if (iptal) return;
        ornek.current = { at: Date.now(), sure: h.active ? h.durationMs : 0, aktif: h.active };
        setSure(ornek.current.sure);
        setSaglik(h);
        // Önbellekten aynı örnek döndüyse son bit hızı ekranda kalır
        if (!(onceki.current && onceki.current.durationMs === h.durationMs && h.active)) {
          setKbps(bitHiziKbps(onceki.current, h));
          onceki.current = h;
        }
      } catch {
        if (!iptal) setSaglik(null);
      }
    };
    void tick();
    const id = setVisibleInterval(() => void tick(), 5000);
    const clock = window.setInterval(() => {
      const o = ornek.current;
      if (!o.aktif) return;
      setSure(o.sure + (Date.now() - o.at));
    }, 1000);
    return () => {
      iptal = true;
      clearVisibleInterval(id);
      window.clearInterval(clock);
    };
  }, [obs]);

  const yayinda = !!saglik?.active;
  const dil = locale === "en" ? "en-US" : "tr-TR";
  const yuzde = (v: number) => (locale === "en" ? `${sayiBicim(v, locale)}%` : `%${sayiBicim(v, locale)}`);
  const kayip = yayinda ? kareKaybiTonu(saglik!.dropPct) : null;
  const olculmuyor = t("kabuk.olculmuyor");

  const obsPill = obs ? (
    <StatusPill tone="ok">{t("status.obsOn")}</StatusPill>
  ) : obsBaglaniyor ? (
    <StatusPill tone="neutral" icon={LoaderCircle}>{t("kabuk.obsBaglaniyor")}</StatusPill>
  ) : (
    <StatusPill tone="neutral" icon={Unplug}>{t("status.obsOff")}</StatusPill>
  );

  return (
    <div data-tauri-drag-region role="group" aria-label={t("kabuk.durum")} className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      {saglik?.reconnecting ? (
        <StatusPill data-tauri-drag-region tone="warn" aria-live="polite">
          {t("kabuk.yenidenBaglaniyor")}
        </StatusPill>
      ) : canli ? (
        <StatusPill data-tauri-drag-region tone="live" className="font-mono tabular-nums">
          {t("kabuk.canli")} {yayinda ? sureBicim(sure) : "—"}
        </StatusPill>
      ) : (
        <StatusPill data-tauri-drag-region tone="neutral" icon={Circle}>
          {t("kabuk.yayinKapali")}
        </StatusPill>
      )}

      <Tooltip content={olculmuyor} side="bottom">
        <StatusPill data-tauri-drag-region tone="neutral" icon={Circle} className="font-mono">
          {t("kabuk.kayit")} —
        </StatusPill>
      </Tooltip>

      {onObs ? (
        <Tooltip content={t("kabuk.obsAc")} side="bottom">
          <button type="button" className="flex shrink-0 rounded-ui-1" onClick={onObs}>
            {obsPill}
          </button>
        </Tooltip>
      ) : (
        obsPill
      )}

      <Oge icon={<Bot aria-hidden />} ipucu={olculmuyor}>
        <span className="font-sans">{t("kabuk.bot")}</span>
        <span className="text-ui-fg3">—</span>
      </Oge>

      <span data-tauri-drag-region className="flex shrink-0 items-center gap-2.5" role="group" aria-label={t("kabuk.platformlar")}>
        <Platform
          harf="K"
          ad="Kick"
          deger={kick.live ? kick.viewers.toLocaleString(dil) : null}
          ipucu={kick.live ? `Kick · ${kick.viewers.toLocaleString(dil)} ${t("kabuk.izleyici")}` : t("kabuk.kickKapali")}
        />
        <Platform harf="T" ad="Twitch" deger={null} ipucu={`Twitch · ${olculmuyor}`} />
        <Platform harf="Y" ad="YouTube" deger={null} ipucu={`YouTube · ${olculmuyor}`} />
      </span>

      <Oge icon={<Gauge aria-hidden />} ipucu={t("kabuk.bitHizi")}>
        {yayinda && kbps != null ? (
          <span className="text-ui-fg">{kbps.toLocaleString(dil)} kbps</span>
        ) : (
          <span className="text-ui-fg3">— kbps</span>
        )}
      </Oge>

      <Oge
        icon={kayip === "yuksek" ? <TriangleAlert aria-hidden className="text-ui-warn" /> : <Activity aria-hidden />}
        className={kayip === "ok" ? "text-ui-ok" : kayip ? "text-ui-warn" : undefined}
      >
        <span className={kayip ? undefined : "text-ui-fg3"}>{yayinda ? yuzde(saglik!.dropPct) : "—"}</span>
        <span className="font-sans max-2xl:hidden">{t("kabuk.kareKaybi")}</span>
        <span className="sr-only 2xl:hidden">{t("kabuk.kareKaybi")}</span>
        {kayip === "yuksek" ? <span className="font-sans">{t("kabuk.kareKaybiYuksek")}</span> : null}
      </Oge>

      {notices.length ? (
        <Tooltip content={notices.map((n) => n.text).join(" · ")} side="bottom">
          <StatusPill data-tauri-drag-region tone="warn">
            {notices.length} {t("kabuk.uyarilar")}
          </StatusPill>
        </Tooltip>
      ) : null}
    </div>
  );
}
