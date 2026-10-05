/**
 * Dönüşümü düzenle (OBS "Edit Transform"): konum, döndürme, ölçek/boyut, hizalama, sınır türü + hizalama + boyut,
 * kırpma, ölçek filtresi, karıştırma. Her değişiklik anında uygulanır ve geri alınabilir.
 */
import { useEffect, useState } from "react";
import type { MotorDonusumAlanlari, MotorSahneOgesi } from "../../lib/api/motor";
import { kirpikBoyut } from "../../lib/sahneAgaci";
import { Pencere } from "./ortak";

export const SINIR_TURLERI = ["Sınır yok", "Sınıra uzat", "İçe sığdır", "Dışa sığdır (kırp)", "Genişliğe sığdır", "Yüksekliğe sığdır", "En fazla sınır boyutu"];
export const OLCEK_FILTRELERI = ["Kapalı", "Nokta", "Bikübik", "Çift doğrusal", "Lanczos", "Alan"];
export const KARISTIRMA = ["Normal", "Toplamalı", "Çıkarmalı", "Ekran", "Çarpma", "Açıklaştır", "Koyulaştır"];
/** 3×3 hizalama ızgarası: OBS_ALIGN_* bitleri (sol 1, sağ 2, üst 4, alt 8) */
export const HIZALAMA_IZGARASI = [5, 4, 6, 1, 0, 2, 9, 8, 10];
const HIZALAMA_ADI: Record<number, string> = { 5: "Sol üst", 4: "Üst", 6: "Sağ üst", 1: "Sol", 0: "Orta", 2: "Sağ", 9: "Sol alt", 8: "Alt", 10: "Sağ alt" };

function Izgara({ deger, onSec, etiket }: { deger: number; onSec: (v: number) => void; etiket: string }) {
  return (
    <div role="radiogroup" aria-label={etiket} className="grid w-[66px] grid-cols-3 gap-0.5">
      {HIZALAMA_IZGARASI.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={deger === v}
          title={HIZALAMA_ADI[v]}
          aria-label={HIZALAMA_ADI[v]}
          className="dt-toggle"
          onClick={() => onSec(v)}
        >
          {deger === v ? "●" : ""}
        </button>
      ))}
    </div>
  );
}

function Sayi({ id, deger, onUygula, birim, adim = 1 }: { id: string; deger: number; onUygula: (v: number) => void; birim?: string; adim?: number }) {
  const [m, setM] = useState(String(deger));
  useEffect(() => setM(String(+deger.toFixed(adim < 1 ? 4 : 2))), [deger, adim]);
  const uygula = () => {
    const v = Number(m.replace(",", "."));
    if (Number.isFinite(v) && v !== deger) onUygula(v);
    else setM(String(deger));
  };
  return (
    <span className="inline-flex items-center gap-1">
      <input
        id={id}
        className="dt-input dt-sayi w-20"
        inputMode="decimal"
        value={m}
        onChange={(e) => setM(e.target.value)}
        onBlur={uygula}
        onKeyDown={(e) => e.key === "Enter" && uygula()}
      />
      {birim && <span className="dt-birim">{birim}</span>}
    </span>
  );
}

export function DonusumDiyalogu({
  oge,
  onDegistir,
  onSifirla,
  onKapat,
}: {
  oge: MotorSahneOgesi;
  onDegistir: (yeni: MotorDonusumAlanlari, eski: MotorDonusumAlanlari) => void;
  onSifirla: () => void;
  onKapat: () => void;
}) {
  const [kg, kh] = kirpikBoyut(oge);
  const sinirTuru = oge.sinir_turu ?? 0;
  const kirp = oge.kirp ?? [0, 0, 0, 0];
  const d = <K extends keyof MotorDonusumAlanlari>(alan: K, v: MotorDonusumAlanlari[K]) =>
    onDegistir({ [alan]: v } as MotorDonusumAlanlari, { [alan]: oge[alan as keyof MotorSahneOgesi] } as MotorDonusumAlanlari);
  return (
    <Pencere
      baslik={`Dönüşümü düzenle — ${oge.ad ?? oge.kaynak}`}
      genislik={560}
      onKapat={onKapat}
      alt={
        <>
          <span className="mr-auto text-[11px] dt-soluk">
            Kaynak boyutu {oge.genislik ?? 0}×{oge.yukseklik ?? 0} px · değişiklikler anında uygulanır (Ctrl+Z geri alır)
          </span>
          <button type="button" className="dt-btn" onClick={onSifirla}>
            Sıfırla
          </button>
          <button type="button" className="dt-btn-primary" onClick={onKapat}>
            Kapat
          </button>
        </>
      }
    >
      <div className="dt-form">
        <label htmlFor="dn-x">Konum</label>
        <span className="flex items-center gap-2">
          <Sayi id="dn-x" deger={oge.konum[0]} birim="x" onUygula={(v) => d("konum", [v, oge.konum[1]])} />
          <Sayi id="dn-y" deger={oge.konum[1]} birim="y" onUygula={(v) => d("konum", [oge.konum[0], v])} />
        </span>
        <label htmlFor="dn-aci">Döndürme</label>
        <Sayi id="dn-aci" deger={oge.aci ?? 0} birim="°" onUygula={(v) => d("aci", ((v % 360) + 360) % 360)} />
        <label htmlFor="dn-ox">Ölçek</label>
        <span className="flex items-center gap-2">
          <Sayi id="dn-ox" deger={oge.olcek[0]} adim={0.01} birim="x" onUygula={(v) => d("olcek", [v, oge.olcek[1]])} />
          <Sayi id="dn-oy" deger={oge.olcek[1]} adim={0.01} birim="y" onUygula={(v) => d("olcek", [oge.olcek[0], v])} />
        </span>
        <label htmlFor="dn-bg">Boyut</label>
        <span className="flex items-center gap-2">
          <Sayi id="dn-bg" deger={Math.round(kg * oge.olcek[0])} birim="g" onUygula={(v) => kg > 0 && d("olcek", [v / kg, oge.olcek[1]])} />
          <Sayi id="dn-by" deger={Math.round(kh * oge.olcek[1])} birim="y" onUygula={(v) => kh > 0 && d("olcek", [oge.olcek[0], v / kh])} />
        </span>
        <span className="dt-etiket">Konum hizalaması</span>
        <Izgara etiket="Konum hizalaması" deger={oge.hizalama ?? 5} onSec={(v) => d("hizalama", v)} />
        <label htmlFor="dn-st">Sınır kutusu türü</label>
        <select id="dn-st" className="dt-input" value={sinirTuru} onChange={(e) => d("sinir_turu", Number(e.target.value))}>
          {SINIR_TURLERI.map((t, i) => (
            <option key={t} value={i}>
              {t}
            </option>
          ))}
        </select>
        {sinirTuru !== 0 && (
          <>
            <span className="dt-etiket">Sınır içi hizalama</span>
            <Izgara etiket="Sınır içi hizalama" deger={oge.sinir_hizalama ?? 0} onSec={(v) => d("sinir_hizalama", v)} />
            <label htmlFor="dn-sg">Sınır boyutu</label>
            <span className="flex items-center gap-2">
              <Sayi id="dn-sg" deger={oge.sinir?.[0] ?? kg} birim="g" onUygula={(v) => v > 0 && d("sinir", [v, oge.sinir?.[1] ?? kh])} />
              <Sayi id="dn-sy" deger={oge.sinir?.[1] ?? kh} birim="y" onUygula={(v) => v > 0 && d("sinir", [oge.sinir?.[0] ?? kg, v])} />
            </span>
          </>
        )}
        <span className="dt-etiket">Kırpma</span>
        <span className="grid grid-cols-2 gap-1.5">
          {(["Sol", "Üst", "Sağ", "Alt"] as const).map((ad, i) => (
            <span key={ad} className="inline-flex items-center gap-1">
              <span className="dt-birim w-7">{ad}</span>
              <Sayi
                id={`dn-k${i}`}
                deger={kirp[i]}
                birim="px"
                onUygula={(v) => {
                  const k = [...kirp] as [number, number, number, number];
                  k[i] = Math.max(0, Math.min(16384, Math.round(v)));
                  d("kirp", k);
                }}
              />
            </span>
          ))}
        </span>
        <label htmlFor="dn-of">Ölçek filtresi</label>
        <select id="dn-of" className="dt-input" value={oge.olcek_filtresi ?? 0} onChange={(e) => d("olcek_filtresi", Number(e.target.value))}>
          {OLCEK_FILTRELERI.map((t, i) => (
            <option key={t} value={i}>
              {t}
            </option>
          ))}
        </select>
        <label htmlFor="dn-kr">Karıştırma kipi</label>
        <select id="dn-kr" className="dt-input" value={oge.karistirma ?? 0} onChange={(e) => d("karistirma", Number(e.target.value))}>
          {KARISTIRMA.map((t, i) => (
            <option key={t} value={i}>
              {t}
            </option>
          ))}
        </select>
        <label htmlFor="dn-ky">Karıştırma yöntemi</label>
        <select id="dn-ky" className="dt-input" value={oge.karistirma_yontemi ?? 0} onChange={(e) => d("karistirma_yontemi", Number(e.target.value))}>
          <option value={0}>Varsayılan</option>
          <option value={1}>sRGB kapalı</option>
        </select>
      </div>
    </Pencere>
  );
}
