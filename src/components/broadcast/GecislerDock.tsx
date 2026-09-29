/**
 * Sahne Geçişleri dock'u (OBS "Scene Transitions"): adlandırılmış geçiş listesi (yerleşik Kes/Soldur + kullanıcının
 * eklediği geçişler), +/− ve dişli menüsü (özellikler, yeniden adlandır), süre. Studio Mode açıkken "Geçiş" düğmesi
 * önizlemeyi programa alır. Türle seçilmiş eski bir geçiş (listede adı yok) "tür: …" olarak gösterilir.
 */
import { useEffect, useState } from "react";
import { ArrowRightLeft, Minus, Plus, Settings2 } from "lucide-react";
import type { MotorAdliGecis, MotorGecis } from "../../lib/api/motor";
import type { MenuOgesi } from "../ui/BaglamMenusu";
import { Pencere } from "./ortak";

export function GecisEkleDiyalogu({
  turler,
  onEkle,
  onKapat,
}: {
  turler: { id: string; ad: string }[];
  onEkle: (ad: string, tur: string) => void;
  onKapat: () => void;
}) {
  const secilebilir = turler.filter((t) => t.id !== "cut_transition" && t.id !== "fade_transition");
  const [tur, setTur] = useState(secilebilir[0]?.id ?? "");
  const [ad, setAd] = useState(secilebilir[0]?.ad ?? "");
  const [elle, setElle] = useState(false);
  const gecerli = !!tur && ad.trim().length > 0;
  return (
    <Pencere
      baslik="Geçiş ekle"
      genislik={400}
      onKapat={onKapat}
      alt={
        <>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" disabled={!gecerli} onClick={() => onEkle(ad.trim(), tur)}>
            Ekle
          </button>
        </>
      }
    >
      <div className="dt-form">
        <label htmlFor="ge-tur">Tür</label>
        <select
          id="ge-tur"
          className="dt-input"
          value={tur}
          onChange={(e) => {
            setTur(e.target.value);
            if (!elle) setAd(secilebilir.find((t) => t.id === e.target.value)?.ad ?? "");
          }}
        >
          {secilebilir.map((t) => (
            <option key={t.id} value={t.id}>
              {t.ad}
            </option>
          ))}
        </select>
        <label htmlFor="ge-ad">Ad</label>
        <input id="ge-ad" className="dt-input" value={ad} maxLength={80} onChange={(e) => (setAd(e.target.value), setElle(true))} />
      </div>
    </Pencere>
  );
}

export function GecislerDock({
  gecis,
  adliGecisler,
  secili,
  studyo,
  meşgul,
  onSec,
  onEkle,
  onSil,
  onAdlandir,
  onSure,
  onOzellikler,
  onGecis,
  menuAc,
}: {
  gecis: MotorGecis | undefined;
  adliGecisler: MotorAdliGecis[];
  secili: string | undefined;
  studyo: boolean;
  meşgul: boolean;
  onSec: (id: string) => void;
  onEkle: () => void;
  onSil: (g: MotorAdliGecis) => void;
  onAdlandir: (g: MotorAdliGecis) => void;
  onSure: (ms: number) => void;
  onOzellikler: () => void;
  onGecis: () => void;
  menuAc: (e: { clientX: number; clientY: number }, ogeler: MenuOgesi[]) => void;
}) {
  const [sure, setSure] = useState(String(gecis?.sure_ms ?? 300));
  useEffect(() => setSure(String(gecis?.sure_ms ?? 300)), [gecis?.sure_ms]);
  const sureUygula = () => {
    const v = Math.round(Number(sure));
    if (Number.isFinite(v) && v >= 0 && v <= 20000 && v !== gecis?.sure_ms) onSure(v);
    else setSure(String(gecis?.sure_ms ?? 300));
  };
  const kesme = gecis?.tur === "cut_transition";
  // Seçim yoksa etkin tür yerleşik Kes/Soldur'a karşılık geliyorsa onu göster
  const deger = secili ?? adliGecisler.find((g) => g.yerlesik && g.tur === gecis?.tur)?.id ?? "";
  const seciliGecis = adliGecisler.find((g) => g.id === deger);
  const disliMenusu = (e: React.MouseEvent) => {
    const r = e.currentTarget.getBoundingClientRect();
    menuAc({ clientX: r.left, clientY: r.bottom }, [
      { etiket: "Özellikler…", devreDisi: kesme, eylem: onOzellikler },
      {
        etiket: "Yeniden adlandır…",
        devreDisi: !seciliGecis || seciliGecis.yerlesik,
        eylem: () => seciliGecis && onAdlandir(seciliGecis),
      },
    ]);
  };
  return (
    <section className="dt-dock h-full" aria-label="Sahne geçişleri">
      <div className="dt-dock-baslik">Sahne Geçişleri</div>
      <div className="dt-dock-govde">
        <div className="dt-form">
          <label htmlFor="gecis-ad">Geçiş</label>
          <select id="gecis-ad" className="dt-input min-w-0" value={deger} onChange={(e) => onSec(e.target.value)}>
            {!deger && gecis?.tur && <option value="">tür: {gecis.tur}</option>}
            {adliGecisler.map((g) => (
              <option key={g.id} value={g.id}>
                {g.ad}
              </option>
            ))}
          </select>
          <span />
          <span className="flex items-center gap-1">
            <button type="button" className="dt-tool" aria-label="Geçiş ekle" title="Geçiş ekle" onClick={onEkle}>
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="dt-tool"
              aria-label="Seçili geçişi kaldır"
              title="Seçili geçişi kaldır (Kes ve Soldur kaldırılamaz)"
              disabled={!seciliGecis || seciliGecis.yerlesik}
              onClick={() => seciliGecis && onSil(seciliGecis)}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button type="button" className="dt-tool" aria-label="Geçiş özellikleri ve adı" title="Özellikler, yeniden adlandır" onClick={disliMenusu}>
              <Settings2 className="h-3.5 w-3.5" />
            </button>
          </span>
          <label htmlFor="gecis-sure">Süre</label>
          <span className="flex items-center gap-1.5">
            <input
              id="gecis-sure"
              className="dt-input dt-sayi w-20"
              inputMode="numeric"
              value={sure}
              disabled={kesme}
              onChange={(e) => setSure(e.target.value)}
              onBlur={sureUygula}
              onKeyDown={(e) => e.key === "Enter" && sureUygula()}
            />
            <span className="dt-birim">ms</span>
          </span>
        </div>
        {studyo && (
          <div className="px-3 pb-2">
            <button type="button" className="dt-btn-primary w-full" disabled={meşgul} onClick={onGecis} title="Önizlemedeki sahneyi programa al">
              <ArrowRightLeft className="h-3.5 w-3.5" />
              Geçiş
            </button>
          </div>
        )}
        {kesme && <p className="px-3 text-[11px] dt-soluk">Kesme anında geçer; süre kullanılmaz.</p>}
      </div>
    </section>
  );
}
