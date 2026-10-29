/**
 * "Hata raporlarını gönder" izni (Rust `hata_raporu.rs`). Bu derlemede Sentry yoksa (DSN verilmemiş) ya da
 * Tauri dışındaysa hiç görünmez. Varsayılan kapalı; gönderilen rapor kişisel bilgiden arındırılır.
 */
import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { Switch } from "./switch";

type Durum = { kullanilabilir: boolean; izin: boolean };

export function HataRaporuAnahtari({ className }: { className?: string }) {
  const [d, setD] = useState<Durum | null>(null);

  useEffect(() => {
    if (isTauri()) void invoke<Durum>("hata_raporu_durumu").then(setD).catch(() => {});
  }, []);

  if (!d?.kullanilabilir) return null;
  return (
    <div className={"flex items-center justify-between gap-6 " + (className || "")}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-200">Hata raporlarını gönder</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Uygulama çökerse hata ayrıntısı (sürüm, işletim sistemi, hata metni) geliştiriciye iletilir. Bilgisayar adı,
          kullanıcı klasörü ve belirteçler gönderilmez.
        </p>
      </div>
      <Switch
        checked={d.izin}
        aria-label="Hata raporlarını gönder"
        onCheckedChange={(izin) => {
          setD({ ...d, izin });
          void invoke("hata_raporu_izni", { acik: izin }).catch(() => setD({ ...d, izin: !izin }));
        }}
      />
    </div>
  );
}
