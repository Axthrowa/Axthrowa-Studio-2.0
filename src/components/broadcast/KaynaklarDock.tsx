/**
 * Kaynaklar dock'u (OBS "Sources"): seçili sahnenin öğeleri üstten alta; gruplar açılıp kapanır. Göz (görünürlük),
 * kilit, durum (bekliyor), filtre işareti. Ctrl ile çoklu, Shift ile aralık seçimi; sürükle-bırak sıralama;
 * klavye: ↑/↓ seçim, Del kaldır, F2 yeniden adlandır, Enter özellikler, Menü/Shift+F10 bağlam menüsü.
 */
import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ChevronUp, Eye, EyeOff, Filter, Lock, LockOpen, Minus, Plus, Settings2 } from "lucide-react";
import type { MotorEksikOge, MotorSahneOgesi } from "../../lib/api/motor";
import { duzListe, type AgacDugumu } from "../../lib/sahneAgaci";

export type KaynakDockEylemleri = {
  sec: (oge: string, kip: "tek" | "ekle" | "aralik") => void;
  grupAcKapa: (oge: string) => void;
  gorunurluk: (o: MotorSahneOgesi) => void;
  kilit: (o: MotorSahneOgesi) => void;
  menu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, o: MotorSahneOgesi) => void;
  bosMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }) => void;
  ekleMenusu: (e: { clientX: number; clientY: number }) => void;
  kaldir: () => void;
  ozellikler: (o: MotorSahneOgesi) => void;
  filtreler: (o: MotorSahneOgesi) => void;
  adlandir: (o: MotorSahneOgesi) => void;
  tasi: (o: MotorSahneOgesi, yon: "yukari" | "asagi") => void;
  /** Kök öğeyi başka bir kök öğenin yerine taşı */
  birak: (surulen: string, hedef: string) => void;
  eksikMenu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, k: MotorEksikOge) => void;
};

export function turEtiketi(o: MotorSahneOgesi): string {
  switch (o.tur) {
    case "sahne":
      return "Sahne";
    case "grup":
      return "Grup";
    case "eklenti":
      return "Eklenti";
    case "obs":
      return o.obsTuru ?? "OBS";
    default:
      return (
        {
          renk: "Renk",
          yazi: "Yazı",
          gorsel: "Görsel",
          medya: "Medya",
          tarayici: "Tarayıcı",
          ekran: "Ekran",
          pencere: "Pencere",
          oyun: "Oyun",
          kamera: "Kamera",
          mikrofon: "Mikrofon",
          masaustu: "Masaüstü sesi",
          uygulama_sesi: "Uygulama sesi",
        } as Record<string, string>
      )[o.tur ?? ""] ?? o.tur ?? "";
  }
}

export function KaynaklarDock({
  sahneAdi,
  agac,
  eksikler,
  secim,
  acikGruplar,
  eylem,
}: {
  sahneAdi: string | null;
  agac: AgacDugumu[];
  eksikler: MotorEksikOge[];
  secim: string[];
  acikGruplar: ReadonlySet<string>;
  eylem: KaynakDockEylemleri;
}) {
  const [surukle, setSurukle] = useState<string | null>(null);
  const satirlar = duzListe(agac, acikGruplar);
  const tek = secim.length === 1 ? satirlar.find((s) => s.oge.oge === secim[0])?.oge ?? null : null;

  const tus = (e: React.KeyboardEvent) => {
    const i = satirlar.findIndex((s) => s.oge.oge === secim.at(-1));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const j = e.key === "ArrowDown" ? Math.min(satirlar.length - 1, i + 1) : Math.max(0, i - 1);
      if (satirlar[j]) eylem.sec(satirlar[j].oge.oge, e.shiftKey ? "aralik" : "tek");
    } else if (e.key === "Delete" && secim.length) {
      e.preventDefault();
      eylem.kaldir();
    } else if (e.key === "F2" && tek) {
      e.preventDefault();
      eylem.adlandir(tek);
    } else if (e.key === "Enter" && tek) {
      e.preventDefault();
      eylem.ozellikler(tek);
    } else if ((e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) && tek) {
      e.preventDefault();
      const r = (e.currentTarget.querySelector('[aria-selected="true"]') as HTMLElement | null)?.getBoundingClientRect();
      eylem.menu({ clientX: r?.left ?? 0, clientY: r?.bottom ?? 0 }, tek);
    }
  };

  return (
    <section className="dt-dock h-full" aria-label="Kaynaklar">
      <div className="dt-dock-baslik">
        Kaynaklar {sahneAdi && <span className="dt-soluk truncate font-normal">· {sahneAdi}</span>}
      </div>
      <div
        className="dt-dock-govde"
        role="tree"
        aria-label="Kaynaklar"
        aria-multiselectable
        tabIndex={0}
        onKeyDown={tus}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) eylem.bosMenu(e);
        }}
      >
        {satirlar.length === 0 && eksikler.length === 0 && (
          <div className="p-3 text-[12px]">
            <p>Bu sahnede kaynak yok.</p>
            <button type="button" className="dt-btn mt-2" onClick={(e) => eylem.ekleMenusu(e)}>
              <Plus className="h-3.5 w-3.5" />
              Kaynak ekle
            </button>
            <p className="mt-2 dt-soluk">Sağ tık ya da + ile kaynak eklenir; var olan kaynaklar da eklenebilir.</p>
          </div>
        )}
        {satirlar.map(({ oge: o, derinlik }) => {
          const secili = secim.includes(o.oge);
          const grup = !!o.grup;
          const acik = acikGruplar.has(o.oge);
          return (
            <div
              key={o.oge}
              role="treeitem"
              aria-selected={secili}
              aria-expanded={grup ? acik : undefined}
              aria-level={derinlik + 1}
              className="dt-row"
              style={derinlik ? { paddingLeft: 26 } : undefined}
              draggable={derinlik === 0}
              data-surukle-hedef={surukle && surukle !== o.oge && derinlik === 0 ? "true" : undefined}
              onDragStart={(e) => {
                setSurukle(o.oge);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setSurukle(null)}
              onDragOver={(e) => surukle && derinlik === 0 && e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (surukle && surukle !== o.oge) eylem.birak(surukle, o.oge);
                setSurukle(null);
              }}
              onClick={(e) => eylem.sec(o.oge, e.ctrlKey || e.metaKey ? "ekle" : e.shiftKey ? "aralik" : "tek")}
              onDoubleClick={() => (grup ? eylem.grupAcKapa(o.oge) : eylem.ozellikler(o))}
              onContextMenu={(e) => {
                if (!secili) eylem.sec(o.oge, "tek");
                eylem.menu(e, o);
              }}
            >
              {grup ? (
                <button
                  type="button"
                  className="dt-tool"
                  aria-label={acik ? "Grubu daralt" : "Grubu genişlet"}
                  onClick={(e) => {
                    e.stopPropagation();
                    eylem.grupAcKapa(o.oge);
                  }}
                >
                  {acik ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              ) : null}
              <span className={`min-w-0 flex-1 truncate ${o.gorunur ? "" : "dt-soluk"}`} title={o.ad ?? o.kaynak}>
                {o.ad ?? o.kaynak}
              </span>
              {o.durum === "bekliyor" && (
                <span className="dt-uyari-metni text-[10px]" title="Görüntü yok: pencere/oyun bulunamadı, aygıt bağlı değil ya da içerik yükleniyor">
                  bekliyor
                </span>
              )}
              {!!o.filtre && (
                <button
                  type="button"
                  className="dt-tool"
                  aria-label={`${o.filtre} filtre`}
                  title={`${o.filtre} filtre`}
                  onClick={(e) => {
                    e.stopPropagation();
                    eylem.filtreler(o);
                  }}
                >
                  <Filter className="h-3 w-3" />
                </button>
              )}
              <span className="dt-soluk w-16 truncate text-right text-[10px]">{turEtiketi(o)}</span>
              <button
                type="button"
                className="dt-tool"
                aria-label={o.gorunur ? "Gizle" : "Göster"}
                aria-pressed={!o.gorunur}
                title={o.gorunur ? "Gizle" : "Göster"}
                onClick={(e) => {
                  e.stopPropagation();
                  eylem.gorunurluk(o);
                }}
              >
                {o.gorunur ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                className="dt-tool"
                aria-label={o.kilit ? "Kilidi aç" : "Kilitle"}
                aria-pressed={!!o.kilit}
                title={o.kilit ? "Kilitli: önizlemede taşınamaz" : "Kilitle"}
                onClick={(e) => {
                  e.stopPropagation();
                  eylem.kilit(o);
                }}
              >
                {o.kilit ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5 opacity-40" />}
              </button>
            </div>
          );
        })}
        {eksikler.map((k) => (
          <div
            key={k.kaynak}
            className="dt-row"
            title={`Kaynak türü "${k.obsTuru}" bu motorda kayıtlı değil (eklenti yüklü değil). Ayarlar korunuyor; eklenti gelince geri kurulur.`}
            onContextMenu={(e) => eylem.eksikMenu(e, k)}
          >
            <AlertTriangle className="h-3.5 w-3.5 dt-uyari-metni" />
            <span className="min-w-0 flex-1 truncate dt-soluk">{k.ad}</span>
            <button type="button" className="dt-tool text-[11px] dt-uyari-metni" onClick={(e) => eylem.eksikMenu(e, k)}>
              Eklenti eksik
            </button>
          </div>
        ))}
      </div>
      <div className="dt-arac-cubugu">
        <button type="button" className="dt-tool" aria-label="Kaynak ekle" title="Kaynak ekle" onClick={(e) => eylem.ekleMenusu(e)}>
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="dt-tool" aria-label="Seçilenleri kaldır" title="Kaldır (Del)" disabled={!secim.length} onClick={eylem.kaldir}>
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="dt-tool" aria-label="Özellikler" title="Özellikler" disabled={!tek || !!tek.grup} onClick={() => tek && eylem.ozellikler(tek)}>
          <Settings2 className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="dt-tool" aria-label="Filtreler" title="Filtreler" disabled={!tek || !!tek.grup || tek.tur === "sahne"} onClick={() => tek && eylem.filtreler(tek)}>
          <Filter className="h-3.5 w-3.5" />
        </button>
        <span className="dt-bosluk" />
        <button type="button" className="dt-tool" aria-label="Yukarı taşı" title="Yukarı taşı" disabled={!tek} onClick={() => tek && eylem.tasi(tek, "yukari")}>
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="dt-tool" aria-label="Aşağı taşı" title="Aşağı taşı" disabled={!tek} onClick={() => tek && eylem.tasi(tek, "asagi")}>
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </section>
  );
}
