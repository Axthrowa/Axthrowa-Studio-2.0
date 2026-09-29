/**
 * Kaynak araç çubuğu (OBS: önizlemenin altındaki "source toolbar"): seçili tek kaynağa göre hızlı denetimler. Medya
 * kaynağında oynat/duraklat, baştan oynat, durdur ve konum; her kaynakta Özellikler ve Filtreler.
 */
import { Pause, Play, RotateCcw, Square } from "lucide-react";
import type { MotorSahneOgesi, MotorSesKanali } from "../../lib/api/motor";

const MEDYA_TURLERI = new Set(["ffmpeg_source", "vlc_source"]);

function sure(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function KaynakAracCubugu({
  oge,
  kanal,
  onMedya,
  onOzellikler,
  onFiltreler,
}: {
  oge: MotorSahneOgesi | null;
  kanal: MotorSesKanali | undefined;
  onMedya: (eylem: "oynat" | "duraklat" | "yeniden" | "durdur") => void;
  onOzellikler: () => void;
  onFiltreler: () => void;
}) {
  if (!oge || oge.grup || oge.tur === "sahne") {
    return (
      <div className="dt-arac-cubugu px-2 text-[11px] dt-soluk" aria-label="Kaynak araç çubuğu">
        {oge ? "Grup/sahne seçili" : "Kaynak seçilmedi"}
      </div>
    );
  }
  const medya = kanal?.medya ?? null;
  const medyaKaynagi = MEDYA_TURLERI.has(oge.obsTuru ?? "") || !!medya;
  const oynuyor = medya?.durum === "oynuyor";
  return (
    <div className="dt-arac-cubugu flex items-center gap-1 px-2 text-[12px]" role="toolbar" aria-label={`${oge.ad ?? oge.kaynak} araç çubuğu`}>
      <span className="mr-2 max-w-48 truncate font-medium" title={oge.ad ?? oge.kaynak}>
        {oge.ad ?? oge.kaynak}
      </span>
      {medyaKaynagi && (
        <>
          <button type="button" className="dt-tool" onClick={() => onMedya(oynuyor ? "duraklat" : "oynat")} aria-label={oynuyor ? "Duraklat" : "Oynat"} title={oynuyor ? "Duraklat" : "Oynat"}>
            {oynuyor ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button type="button" className="dt-tool" onClick={() => onMedya("yeniden")} aria-label="Baştan oynat" title="Baştan oynat">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button type="button" className="dt-tool" onClick={() => onMedya("durdur")} aria-label="Durdur" title="Durdur">
            <Square className="h-3.5 w-3.5" />
          </button>
          {medya && medya.sure_ms > 0 && (
            <span className="dt-sayi dt-soluk ml-1" aria-label="Konum">
              {sure(medya.zaman_ms)} / {sure(medya.sure_ms)}
            </span>
          )}
          <span className="dt-dikey-ayirici mx-1" aria-hidden />
        </>
      )}
      <button type="button" className="dt-btn" onClick={onOzellikler}>
        Özellikler
      </button>
      <button type="button" className="dt-btn" onClick={onFiltreler}>
        Filtreler
      </button>
    </div>
  );
}
