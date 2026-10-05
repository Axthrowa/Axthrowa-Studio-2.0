/**
 * Filtreler penceresi (OBS "Filters"): ses filtreleri ve efekt (video) filtreleri ayrı listeler; ekle (türler motorun
 * kayıtlı filtrelerinden, kaynağın ses/görüntü yeteneğine göre), kaldır, sırala, aç/kapa, yeniden adlandır; seçili
 * filtrenin özellikleri sağda anında uygulanır. Kurulamayan (türü olmayan) filtre kayıtta korunur ve gösterilir.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Minus, Plus } from "lucide-react";
import { motorApi, type MotorFiltre, type MotorFiltreTuru } from "../../lib/api/motor";
import type { MenuOgesi } from "../ui/BaglamMenusu";
import { OzellikGovdesi } from "./OzellikFormu";
import { hataMetni, Pencere } from "./ortak";

export function FiltrelerDiyalogu({
  kaynak,
  kaynakAdi,
  ses,
  goruntu,
  menuAc,
  onToast,
  onDegisti,
  onKapat,
}: {
  kaynak: string;
  kaynakAdi: string;
  ses: boolean;
  goruntu: boolean;
  menuAc: (e: { clientX: number; clientY: number }, o: MenuOgesi[]) => void;
  onToast: (m: string) => void;
  onDegisti: () => void;
  onKapat: () => void;
}) {
  const [filtreler, setFiltreler] = useState<MotorFiltre[]>([]);
  const [eksikler, setEksikler] = useState<MotorFiltre[]>([]);
  const [turler, setTurler] = useState<MotorFiltreTuru[]>([]);
  const [secili, setSecili] = useState<string | null>(null);
  const [adlandir, setAdlandir] = useState<{ id: string; ad: string } | null>(null);

  const yukle = useCallback(async () => {
    try {
      const r = await motorApi.filtreler(kaynak);
      setFiltreler(r.filtreler);
      setEksikler(r.eksikler);
      setSecili((s) => (s && r.filtreler.some((f) => f.id === s) ? s : (r.filtreler[0]?.id ?? null)));
    } catch (e) {
      onToast(`Filtreler okunamadı: ${hataMetni(e)}`);
    }
  }, [kaynak, onToast]);

  useEffect(() => {
    void yukle();
    motorApi
      .filtreTurleri()
      .then(setTurler)
      .catch(() => setTurler([]));
  }, [yukle]);

  const yap = async (f: () => Promise<unknown>) => {
    try {
      await f();
      onDegisti();
    } catch (e) {
      onToast(`Filtre: ${hataMetni(e)}`);
    }
    await yukle();
  };

  const turAdi = (id: string) => turler.find((t) => t.id === id)?.ad ?? id;
  const sesFiltreleri = filtreler.filter((f) => turler.find((t) => t.id === f.tur)?.ses && !turler.find((t) => t.id === f.tur)?.video);
  const efektler = filtreler.filter((f) => !sesFiltreleri.includes(f));
  const secilen = filtreler.find((f) => f.id === secili) ?? null;

  const ekleMenusu = (e: { clientX: number; clientY: number }, sesMi: boolean) => {
    const uygun = turler.filter((t) => (sesMi ? t.ses && !t.video : t.video)).sort((a, b) => a.ad.localeCompare(b.ad, "tr"));
    menuAc(
      e,
      uygun.length
        ? uygun.map((t) => ({
            etiket: t.ad,
            eylem: () =>
              void yap(async () => {
                const r = await motorApi.filtre({ eylem: "ekle", kaynak, tur: t.id, ad: t.ad });
                if (r.id) setSecili(r.id);
              }),
          }))
        : [{ etiket: "Uygun filtre türü yok", devreDisi: true, eylem: () => undefined }]
    );
  };

  const oku = useMemo(() => (secili ? () => motorApi.filtreOzellikleri(secili) : null), [secili]);
  const yaz = useMemo(() => (secili ? (a: Record<string, unknown>) => motorApi.filtre({ eylem: "guncelle", id: secili, ayarlar: a }) : null), [secili]);

  const liste = (baslik: string, ogeler: MotorFiltre[], sesMi: boolean) => (
    <div className="flex min-h-0 flex-col">
      <div className="dt-dock-baslik">{baslik}</div>
      <div className="min-h-[90px] flex-1 overflow-auto" role="listbox" aria-label={baslik}>
        {ogeler.map((f) => (
          <div
            key={f.id}
            role="option"
            aria-selected={f.id === secili}
            className="dt-row"
            onClick={() => setSecili(f.id)}
            onDoubleClick={() => setAdlandir({ id: f.id, ad: f.ad })}
            onContextMenu={(e) =>
              menuAc(e, [
                {
                  etiket: f.etkin ? "Devre dışı bırak" : "Etkinleştir",
                  eylem: () => void yap(() => motorApi.filtre({ eylem: "etkin", id: f.id, acik: !f.etkin })),
                },
                { etiket: "Yeniden adlandır", kisayol: "F2", eylem: () => setAdlandir({ id: f.id, ad: f.ad }) },
                { etiket: "Yukarı taşı", eylem: () => void yap(() => motorApi.filtre({ eylem: "sira", id: f.id, yon: "yukari" })) },
                { etiket: "Aşağı taşı", eylem: () => void yap(() => motorApi.filtre({ eylem: "sira", id: f.id, yon: "asagi" })) },
                "ayirici",
                { etiket: "Kaldır", tehlikeli: true, eylem: () => void yap(() => motorApi.filtre({ eylem: "sil", id: f.id })) },
              ])
            }
          >
            <input
              type="checkbox"
              aria-label={`${f.ad} etkin`}
              checked={f.etkin}
              onClick={(e) => e.stopPropagation()}
              onChange={() => void yap(() => motorApi.filtre({ eylem: "etkin", id: f.id, acik: !f.etkin }))}
            />
            <span className="min-w-0 flex-1 truncate">{f.ad}</span>
            <span className="dt-soluk truncate text-[10px]">{turAdi(f.tur)}</span>
          </div>
        ))}
      </div>
      <div className="dt-arac-cubugu">
        <button type="button" className="dt-tool" aria-label={`${baslik}: ekle`} onClick={(e) => ekleMenusu(e, sesMi)}>
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="dt-tool"
          aria-label="Filtreyi kaldır"
          disabled={!secilen || !ogeler.includes(secilen)}
          onClick={() => secilen && void yap(() => motorApi.filtre({ eylem: "sil", id: secilen.id }))}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="dt-bosluk" />
        <button
          type="button"
          className="dt-tool"
          aria-label="Yukarı taşı"
          disabled={!secilen || !ogeler.includes(secilen)}
          onClick={() => secilen && void yap(() => motorApi.filtre({ eylem: "sira", id: secilen.id, yon: "yukari" }))}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="dt-tool"
          aria-label="Aşağı taşı"
          disabled={!secilen || !ogeler.includes(secilen)}
          onClick={() => secilen && void yap(() => motorApi.filtre({ eylem: "sira", id: secilen.id, yon: "asagi" }))}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <Pencere
      baslik={`Filtreler — ${kaynakAdi}`}
      genis
      onKapat={onKapat}
      alt={
        <button type="button" className="dt-btn-primary" onClick={onKapat}>
          Kapat
        </button>
      }
    >
      <div className="grid h-full min-h-0" style={{ gridTemplateColumns: "300px minmax(0,1fr)" }}>
        <div className="flex min-h-0 flex-col border-r border-[color:var(--dt-line)]">
          {ses && liste("Ses filtreleri", sesFiltreleri, true)}
          {goruntu && liste("Efekt filtreleri", efektler, false)}
          {!ses && !goruntu && <p className="p-3 text-[12px] dt-soluk">Bu kaynak ses ya da görüntü üretmiyor.</p>}
          {eksikler.length > 0 && (
            <div className="p-2 text-[11px] dt-uyari-metni">
              {eksikler.length} filtre bu motorda kurulamadı (türü yok): {eksikler.map((f) => `${f.ad} (${f.tur})`).join(", ")}. Ayarları korunuyor.
            </div>
          )}
        </div>
        <div className="min-h-0 overflow-auto">
          {secilen && oku && yaz ? (
            <>
              <div className="dt-dock-baslik">
                {secilen.ad} <span className="dt-soluk font-normal">· {turAdi(secilen.tur)}</span>
              </div>
              <OzellikGovdesi key={secilen.id} oku={oku} yaz={yaz} bos="Bu filtrenin ayarı yok." />
            </>
          ) : (
            <p className="p-3 text-[12px] dt-soluk">Bir filtre seçin ya da + ile ekleyin.</p>
          )}
        </div>
      </div>
      {adlandir && (
        <div className="dt-modal-arka" onMouseDown={(e) => e.target === e.currentTarget && setAdlandir(null)}>
          <div className="dt-modal" role="dialog" aria-label="Filtreyi yeniden adlandır" style={{ width: 360 }}>
            <div className="dt-form">
              <label htmlFor="flt-ad">Ad</label>
              <input
                id="flt-ad"
                autoFocus
                className="dt-input"
                value={adlandir.ad}
                maxLength={80}
                onChange={(e) => setAdlandir({ ...adlandir, ad: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && adlandir.ad.trim()) {
                    const a = adlandir;
                    setAdlandir(null);
                    void yap(() => motorApi.filtre({ eylem: "adlandir", id: a.id, ad: a.ad.trim() }));
                  } else if (e.key === "Escape") setAdlandir(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </Pencere>
  );
}
