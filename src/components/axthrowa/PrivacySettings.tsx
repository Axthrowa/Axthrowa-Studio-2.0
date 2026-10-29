/**
 * Gizlilik ayarları: anonim kullanım analitiği ve çökme raporları. İkisi de varsayılan kapalı ve yalnız bu
 * derlemede ilgili anahtar varsa görünür (analitik: `VITE_POSTHOG_KEY`, çökme: `SENTRY_DSN`).
 */
import { useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { ShieldCheck } from "@phosphor-icons/react";
import { WidgetCard } from "./WidgetCard";
import { Switch } from "./switch";
import { HataRaporuAnahtari } from "./HataRaporuAnahtari";
import { analitikIzniVar, analitikIzniVer, analitikKullanilabilir } from "../../lib/analitik";

export default function PrivacySettings() {
  const [analitik, setAnalitik] = useState(analitikIzniVar);
  if (!isTauri()) return null;

  return (
    <WidgetCard
      title="Gizlilik"
      description="Siz izin vermedikçe uygulama hiçbir kullanım ya da hata verisi göndermez."
      icon={<ShieldCheck weight="duotone" className="h-5 w-5 text-axthrowa-cyan" />}
    >
      <div className="flex flex-col gap-5">
        {analitikKullanilabilir() ? (
          <div className="flex items-center justify-between gap-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-200">Analitik verilerimi anonim olarak paylaş</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                Hangi özelliklerin ne sıklıkla kullanıldığı (ör. OBS bağlantısı, sahne değişimi sayısı, açılan sekme).
                Sahne ve kaynak adları, sohbet, kanal bilgisi ve kişisel veriler gönderilmez.
              </p>
            </div>
            <Switch
              checked={analitik}
              aria-label="Analitik verilerimi anonim olarak paylaş"
              onCheckedChange={(acik) => {
                analitikIzniVer(acik);
                setAnalitik(acik);
              }}
            />
          </div>
        ) : null}
        <HataRaporuAnahtari />
      </div>
    </WidgetCard>
  );
}
