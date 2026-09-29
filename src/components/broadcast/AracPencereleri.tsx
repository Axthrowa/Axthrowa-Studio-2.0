/**
 * Araçlar ve Yardım pencereleri: çıkış zamanlayıcısı (OBS "Output Timer") ve son günlük (motorun libobs günlüğü,
 * yayın anahtarları ve kullanıcı klasörü ayıklanmış).
 */
import { useEffect, useState } from "react";
import { motorApi } from "../../lib/api/motor";
import { kalanMetin, sureMs, type Zamanlayici } from "../../lib/cikisZamanlayicisi";
import { hataMetni, Pencere } from "./ortak";

function SureAlani({ id, deger, onDegis }: { id: string; deger: [number, number, number]; onDegis: (d: [number, number, number]) => void }) {
  const alan = (i: 0 | 1 | 2, en_cok: number, birim: string) => (
    <span className="inline-flex items-center gap-1">
      <input
        id={i === 0 ? id : undefined}
        className="dt-input dt-sayi w-14"
        inputMode="numeric"
        value={deger[i]}
        onChange={(e) => {
          const v = Math.min(en_cok, Math.max(0, Math.round(Number(e.target.value) || 0)));
          const y = [...deger] as [number, number, number];
          y[i] = v;
          onDegis(y);
        }}
      />
      <span className="dt-birim">{birim}</span>
    </span>
  );
  return (
    <span className="inline-flex items-center gap-2">
      {alan(0, 23, "sa")}
      {alan(1, 59, "dk")}
      {alan(2, 59, "sn")}
    </span>
  );
}

export function CikisZamanlayicisiPenceresi({
  z,
  canli,
  kayitta,
  onAyarla,
  onKapat,
}: {
  z: Zamanlayici;
  canli: boolean;
  kayitta: boolean;
  onAyarla: (z: Zamanlayici) => void;
  onKapat: () => void;
}) {
  const [yayin, setYayin] = useState<[number, number, number]>([0, 30, 0]);
  const [kayit, setKayit] = useState<[number, number, number]>([0, 30, 0]);
  const [simdi, setSimdi] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setSimdi(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  const satir = (ad: string, id: string, deger: [number, number, number], setD: (d: [number, number, number]) => void, bitis: number | null, acik: boolean, alan: "yayinBitis" | "kayitBitis") => (
    <>
      <label htmlFor={id}>{ad}</label>
      <span className="inline-flex flex-wrap items-center gap-2">
        <SureAlani id={id} deger={deger} onDegis={setD} />
        {bitis !== null ? (
          <>
            <span className="dt-sayi">{kalanMetin(bitis, simdi)} sonra durur</span>
            <button type="button" className="dt-btn" onClick={() => onAyarla({ ...z, [alan]: null })}>
              İptal
            </button>
          </>
        ) : (
          <button
            type="button"
            className="dt-btn"
            disabled={sureMs(...deger) === null}
            title={acik ? undefined : "Çıktı şu an kapalı; başladığında süre işlemeye devam eder"}
            onClick={() => {
              const ms = sureMs(...deger);
              if (ms !== null) onAyarla({ ...z, [alan]: Date.now() + ms });
            }}
          >
            Başlat
          </button>
        )}
      </span>
    </>
  );
  return (
    <Pencere baslik="Çıkış zamanlayıcısı" genislik={520} onKapat={onKapat}>
      <div className="dt-form">
        {satir("Yayını durdur", "cz-yayin", yayin, setYayin, z.yayinBitis, canli, "yayinBitis")}
        {satir("Kaydı durdur", "cz-kayit", kayit, setKayit, z.kayitBitis, kayitta, "kayitBitis")}
        <span />
        <span className="text-[11px] dt-soluk">Süre dolunca çıktı durdurulur. Zamanlayıcı bu pencere kapalıyken de çalışır, uygulama kapanınca sıfırlanır (OBS'te de böyledir).</span>
      </div>
    </Pencere>
  );
}

export function GunlukPenceresi({ onKapat, tur = "motor" }: { onKapat: () => void; tur?: "motor" | "cokme" }) {
  const [satirlar, setSatirlar] = useState<string[] | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [gizlenen, setGizlenen] = useState(0);
  const yukle = () =>
    motorApi.gunluk(600, tur).then(
      (r) => {
        setSatirlar(r.satirlar);
        setGizlenen(r.gizlenen);
      },
      (e) => setHata(hataMetni(e))
    );
  useEffect(() => {
    void yukle();
  }, []);
  return (
    <Pencere
      baslik={tur === "cokme" ? "Çökme raporları (panel)" : "Son günlük (yayın motoru)"}
      genis
      onKapat={onKapat}
      alt={
        <>
          <span className="mr-auto text-[11px] dt-soluk">{gizlenen > 0 ? `${gizlenen} olası sır/kişisel yol gizlendi` : "Yayın anahtarları ve kullanıcı klasörü gizlenir"}</span>
          <button type="button" className="dt-btn" onClick={() => void yukle()}>
            Yenile
          </button>
          <button type="button" className="dt-btn" onClick={() => void motorApi.klasorAc("gunluk").catch((e) => setHata(hataMetni(e)))}>
            Klasörde göster
          </button>
        </>
      }
    >
      {hata ? (
        <p className="p-3 text-[12px] dt-uyari-metni">{hata}</p>
      ) : (
        <pre className="h-full overflow-auto whitespace-pre-wrap p-2 text-[11px] leading-snug" tabIndex={0} aria-label="Günlük satırları">
          {satirlar ? (satirlar.length ? satirlar.join("\n") : tur === "cokme" ? "Kayıtlı çökme yok." : "Günlük boş (motor hiç başlatılmadı).") : "Okunuyor…"}
        </pre>
      )}
    </Pencere>
  );
}
