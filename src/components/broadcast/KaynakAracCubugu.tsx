/**
 * Kaynak araç çubuğu (OBS: önizlemenin altındaki "source toolbar"): seçili tek kaynağa göre hızlı denetimler. Medya
 * kaynağında oynat/duraklat, baştan oynat, durdur ve konum; metin kaynağında metin kutusu; ekran/pencere/oyun/
 * uygulama sesi/kamera/mikrofon/masaüstü sesinde aygıt ya da pencere listesi; her kaynakta Özellikler ve Filtreler.
 */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Square } from "./obsSimgeler";
import { motorApi, type MotorKaynakTuru, type MotorSahneOgesi, type MotorSecenek, type MotorSesKanali } from "../../lib/api/motor";

const MEDYA_TURLERI = new Set(["ffmpeg_source", "vlc_source"]);

/** Aygıt/pencere seçimi olan türler → ayar anahtarı (sunucudaki `secenek_ozelligi` ile aynı) */
export const SECENEK_ALANI: Partial<Record<string, string>> = {
  ekran: "monitor_id",
  pencere: "window",
  oyun: "window",
  uygulama_sesi: "window",
  kamera: "video_device_id",
  mikrofon: "device_id",
  masaustu: "device_id",
};

/** Metin kutusu: yazdıkça (300 ms sonra) kaynağa uygulanır */
function MetinAlani({ kaynak }: { kaynak: string }) {
  const [metin, setMetin] = useState<string | null>(null);
  const zaman = useRef<number | undefined>(undefined);
  useEffect(() => {
    let iptal = false;
    setMetin(null);
    motorApi.kaynakOzellikleri(kaynak).then(
      (t) => !iptal && setMetin(String((t.ayarlar as Record<string, unknown>)["text"] ?? "")),
      () => !iptal && setMetin("")
    );
    return () => {
      iptal = true;
      window.clearTimeout(zaman.current);
    };
  }, [kaynak]);
  if (metin === null) return null;
  return (
    <input
      className="dt-input h-6 min-w-0 max-w-[260px] flex-1 py-0 text-[12px]"
      aria-label="Metin"
      value={metin}
      onChange={(e) => {
        const v = e.target.value;
        setMetin(v);
        window.clearTimeout(zaman.current);
        zaman.current = window.setTimeout(() => void motorApi.kaynakGuncelle(kaynak, { text: v }).catch(() => {}), 300);
      }}
    />
  );
}

/** Aygıt/pencere listesi (kurulu OBS'in özellik listesinden; yalnız okunur, yakalama başlatmaz) */
function SecenekAlani({ kaynak, tur, alan }: { kaynak: string; tur: string; alan: string }) {
  const [liste, setListe] = useState<MotorSecenek[] | null>(null);
  const [deger, setDeger] = useState<string>("");
  useEffect(() => {
    let iptal = false;
    setListe(null);
    Promise.all([motorApi.secenekler(tur as MotorKaynakTuru), motorApi.kaynakOzellikleri(kaynak)]).then(
      ([s, t]) => {
        if (iptal) return;
        setListe(s);
        setDeger(String((t.ayarlar as Record<string, unknown>)[alan] ?? ""));
      },
      () => !iptal && setListe([])
    );
    return () => {
      iptal = true;
    };
  }, [kaynak, tur, alan]);
  if (!liste) return null;
  return (
    <select
      className="dt-input h-6 max-w-[260px] py-0 text-[12px]"
      aria-label={tur === "pencere" || tur === "oyun" || tur === "uygulama_sesi" ? "Pencere" : tur === "ekran" ? "Ekran" : "Aygıt"}
      value={deger}
      onChange={(e) => {
        setDeger(e.target.value);
        const sec = liste.find((x) => String(x.deger) === e.target.value);
        void motorApi.kaynakGuncelle(kaynak, { [alan]: sec ? sec.deger : e.target.value }).catch(() => {});
      }}
    >
      {!liste.some((x) => String(x.deger) === deger) && <option value={deger}>{deger ? "(listede yok)" : "Seçilmedi"}</option>}
      {liste.map((x) => (
        <option key={String(x.deger)} value={String(x.deger)}>
          {x.ad}
        </option>
      ))}
    </select>
  );
}

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
        {oge ? "Grup/sahne seçili" : "Kaynak seçilmemiş"}
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
          <button
            type="button"
            className="dt-tool"
            onClick={() => onMedya(oynuyor ? "duraklat" : "oynat")}
            aria-label={oynuyor ? "Duraklat" : "Oynat"}
            title={oynuyor ? "Duraklat" : "Oynat"}
          >
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
      {oge.tur === "yazi" && (
        <>
          <MetinAlani key={oge.kaynak} kaynak={oge.kaynak} />
          <span className="dt-dikey-ayirici mx-1" aria-hidden />
        </>
      )}
      {SECENEK_ALANI[oge.tur ?? ""] && (
        <>
          <SecenekAlani key={oge.kaynak} kaynak={oge.kaynak} tur={oge.tur!} alan={SECENEK_ALANI[oge.tur ?? ""]!} />
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
