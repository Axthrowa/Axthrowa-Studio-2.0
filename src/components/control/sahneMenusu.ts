import { Eye, Keyboard, SquaresFour, Television } from "@phosphor-icons/react";
import type { MenuOgesi } from "../axthrowa/SagTikMenusu";
import { KISAYOL_YOK, kisayolAta } from "../../lib/nesneMenusu";
import { desteyeEkle } from "./DeckPanel";

/** Tablo A7 — sahne: Geç · Önizle · Kısayol ata · Desteye ekle. `onizle` yoksa Önizle kapalı görünür. */
export function sahneMenusu(ad: string, aktif: boolean, gec: () => void, onToast: (m: string) => void, onizle?: () => void): MenuOgesi[] {
  return [
    { ad: "Geç", ikon: Television, kapali: aktif, yap: gec },
    { ad: "Önizle", ikon: Eye, kapali: !onizle, yap: () => onizle?.() },
    { ad: "Kısayol ata", ikon: Keyboard, ayrac: true, yap: () => void (kisayolAta({ name: "scene.switch", label: `Sahne: ${ad}`, scene: ad }) || onToast(KISAYOL_YOK)) },
    {
      ad: "Desteye ekle",
      ikon: SquaresFour,
      yap: () =>
        void desteyeEkle({ label: ad.slice(0, 40), actionId: "scene.switch", params: { scene: ad }, color: "sky" })
          .then(onToast)
          .catch((e) => onToast(`Desteye eklenemedi: ${String((e as Error).message || e).slice(0, 120)}`)),
    },
  ];
}
