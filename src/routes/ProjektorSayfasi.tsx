/**
 * Projektör (OBS "Projector"): bir tuvalin programını ya da Studio Mode önizlemesini ayrı pencerede, siyah zemin
 * üzerinde en-boy oranı korunarak gösterir. `?tuval=ana|dikey|studyo-ana|studyo-dikey`. Kareler `/ws/motor`
 * akışından (en çok 15 kare/sn); bağlantı yoksa PNG yoklaması. Esc ya da çift tık pencereyi kapatır.
 */
import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { motorApi } from "../lib/api/motor";
import { useMotorCanli } from "../lib/motorCanli";
import { clearVisibleInterval, setVisibleInterval } from "../lib/visibleInterval";

const GECERLI = ["ana", "dikey", "studyo-ana", "studyo-dikey"];

export function projektorTuvali(arama: string): string {
  const t = new URLSearchParams(arama).get("tuval") ?? "ana";
  return GECERLI.includes(t) ? t : "ana";
}

async function kapat() {
  if (isTauri()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } else {
    window.close();
  }
}

export default function ProjektorSayfasi() {
  const tuval = projektorTuvali(window.location.search);
  const dikey = tuval.endsWith("dikey");
  const canli = useMotorCanli(true, { seviye: false, kare: { tuval, genislik: 1280, fps: 15 } });
  const [yedek, setYedek] = useState<string | null>(null);
  const [imlec, setImlec] = useState(true);

  // Canlı akış yoksa yedek: saniyede bir PNG
  useEffect(() => {
    if (canli.bagli) return;
    let onceki: string | null = null;
    const cek = () =>
      motorApi
        .onizleme(tuval, 960)
        .then((b) => {
          if (!b) return;
          const u = URL.createObjectURL(b);
          if (onceki) URL.revokeObjectURL(onceki);
          onceki = u;
          setYedek(u);
        })
        .catch(() => {});
    void cek();
    const id = setVisibleInterval(cek, 1000);
    return () => {
      clearVisibleInterval(id);
      if (onceki) URL.revokeObjectURL(onceki);
    };
  }, [canli.bagli, tuval]);

  useEffect(() => {
    document.title = `Projektör — ${dikey ? "Dikey" : "Yatay"}${tuval.startsWith("studyo-") ? " (önizleme)" : ""}`;
    const tus = (e: KeyboardEvent) => e.key === "Escape" && void kapat();
    window.addEventListener("keydown", tus);
    // İmleç 2 sn hareketsizse gizlenir (tam ekran projektörde)
    let z: number | undefined;
    const hareket = () => {
      setImlec(true);
      window.clearTimeout(z);
      z = window.setTimeout(() => setImlec(false), 2000);
    };
    window.addEventListener("mousemove", hareket);
    hareket();
    return () => {
      window.removeEventListener("keydown", tus);
      window.removeEventListener("mousemove", hareket);
      window.clearTimeout(z);
    };
  }, [tuval, dikey]);

  const kare = canli.bagli && canli.kare?.tuval === tuval ? canli.kare.url : yedek;
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black"
      style={{ cursor: imlec ? "default" : "none" }}
      onDoubleClick={() => void kapat()}
      role="img"
      aria-label={`Projektör: ${tuval}`}
    >
      {kare ? (
        <img src={kare} alt="" className="max-h-full max-w-full" style={{ aspectRatio: dikey ? "9 / 16" : "16 / 9", objectFit: "contain" }} draggable={false} />
      ) : (
        <span className="text-[13px] text-white/70">Motor görüntüsü bekleniyor…</span>
      )}
    </div>
  );
}
