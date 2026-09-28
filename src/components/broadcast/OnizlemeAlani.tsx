/**
 * Önizleme alanı: tuvalin canlı karesi (`/ws/motor` JPEG; bağlantı yoksa PNG yoklaması) ve düzenleme katmanı.
 *
 * Etkileşim (OBS alışkanlıkları): tıkla-seç (Ctrl ile çoklu), sürükle-taşı (kenar/merkez yapışması; Ctrl basılıyken
 * yapışma kapalı), köşe/kenar tutamaçlarıyla boyutlandır (köşede oran korunur, Shift serbest), ok tuşlarıyla 1 px
 * (Shift 10 px) itme, sağ tık bağlam menüsü. Kilitli öğe seçilir ama taşınmaz; döndürülmüş öğe yalnız taşınır.
 * Alt basılıyken tutamaç sürüklemek kaynağı kırpar (sınırsız, döndürülmemiş öğede; ölçek değişmez).
 * Sürükleme sırasında motor ~12 kez/sn güncellenir; bırakınca tek geri alınabilir işlem kaydedilir.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motorApi, type MotorDonusumAlanlari, type MotorSahneOgesi } from "../../lib/api/motor";
import { boyutlandir, kirpilabilir, kirpSurukle, noktadakiOge, ogeKutusu, TUTAMACLAR, yapistir, type AgacDugumu, type Kutu } from "../../lib/sahneAgaci";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";

/** WebSocket karesi yokken yedek: PNG yoklaması (uzaktan açılan panel ya da bağlantı kopukken) */
function YoklamaKaresi({ tuval, genislik }: { tuval: string; genislik: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const onceki = useRef<string | null>(null);
  useEffect(() => {
    let iptal = false;
    const cek = () =>
      motorApi
        .onizleme(tuval, genislik)
        .then((b) => {
          if (iptal || !b) return;
          const yeni = URL.createObjectURL(b);
          if (onceki.current) URL.revokeObjectURL(onceki.current);
          onceki.current = yeni;
          setUrl(yeni);
        })
        .catch(() => {});
    void cek();
    const id = setVisibleInterval(cek, 1000);
    return () => {
      iptal = true;
      clearVisibleInterval(id);
      if (onceki.current) URL.revokeObjectURL(onceki.current);
      onceki.current = null;
    };
  }, [tuval, genislik]);
  return url ? <img src={url} alt="" className="dt-onizleme-kare" draggable={false} /> : null;
}

/** İşaretçiyi yakala (sürükleme katman dışına taşsa da sürsün); desteklenmeyen ortamda sessizce geç */
function yakala(e: React.PointerEvent<Element>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* yapay ya da etkin olmayan işaretçi */
  }
}

type Surukleme =
  | { tur: "tasi"; bas: [number, number]; ogeler: { oge: MotorSahneOgesi; konum: [number, number]; kutu: Kutu }[] }
  | { tur: "boyut"; oge: MotorSahneOgesi; kutu: Kutu; tutamac: { x: number; y: number }; eski: MotorDonusumAlanlari }
  | { tur: "kirp"; oge: MotorSahneOgesi; kutu: Kutu; tutamac: { x: number; y: number }; eski: MotorDonusumAlanlari };

export type OnizlemeEylemleri = {
  sec: (oge: string | null, kip: "tek" | "ekle") => void;
  /** Kalıcı (geri alınabilir) dönüşüm; `eski` geri alma için */
  donustur: (degisim: { oge: MotorSahneOgesi; yeni: MotorDonusumAlanlari; eski: MotorDonusumAlanlari }[], ad: string) => void;
  /** Sürükleme sırasında ara güncelleme (geri alma kaydı yok) */
  anlik: (oge: string, yeni: MotorDonusumAlanlari) => void;
  menu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, o: MotorSahneOgesi | null) => void;
};

export function TuvalGorunumu({
  etiket,
  tuval,
  boyut,
  kare,
  canliBagli,
  agac,
  secim,
  duzenlenebilir,
  eylem,
  vurgu,
  kilavuz,
}: {
  etiket: string;
  /** Kare kaynağı: "ana", "dikey", "studyo-ana"… */
  tuval: string;
  boyut: [number, number];
  kare: string | null;
  canliBagli: boolean;
  agac: AgacDugumu[];
  secim: string[];
  duzenlenebilir: boolean;
  eylem: OnizlemeEylemleri;
  vurgu?: "program" | "onizleme";
  /** Güvenli alan kılavuzları (eylem %90, başlık %80) ve merkez çizgileri */
  kilavuz?: boolean;
}) {
  const kap = useRef<HTMLDivElement>(null);
  const [olcu, setOlcu] = useState({ g: 0, y: 0 });
  const [surukleme, setSurukleme] = useState<Surukleme | null>(null);
  const [gecici, setGecici] = useState<Record<string, MotorDonusumAlanlari>>({});
  const sonAnlik = useRef(0);

  // Kutuyu alana sığdır (en-boy oranı tuvalinki)
  useLayoutEffect(() => {
    const el = kap.current;
    if (!el) return;
    const hesapla = () => {
      const r = el.getBoundingClientRect();
      const oran = boyut[0] / boyut[1];
      const g = Math.min(r.width, r.height * oran);
      setOlcu({ g: Math.floor(g), y: Math.floor(g / oran) });
    };
    hesapla();
    const ro = new ResizeObserver(hesapla);
    ro.observe(el);
    return () => ro.disconnect();
  }, [boyut]);

  const olcek = olcu.g > 0 ? olcu.g / boyut[0] : 1;
  const tuvalNoktasi = (e: { clientX: number; clientY: number }, el: Element): [number, number] => {
    const r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * boyut[0], ((e.clientY - r.top) / r.height) * boyut[1]];
  };
  const goster = (o: MotorSahneOgesi): MotorSahneOgesi => (gecici[o.oge] ? { ...o, ...gecici[o.oge] } as MotorSahneOgesi : o);
  const seciliOgeler = agac.map((d) => d.oge).filter((o) => secim.includes(o.oge));
  const tutamacBoyu = 9 / olcek;

  // Motor yeni değeri bildirince geçici gösterim düşer
  useEffect(() => {
    if (!surukleme) setGecici({});
  }, [agac, surukleme]);

  const basla = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!duzenlenebilir || e.button !== 0) return;
    const p = tuvalNoktasi(e, e.currentTarget);
    // Seçili, kilitsiz, döndürülmemiş tek öğenin tutamacı mı?
    if (seciliOgeler.length === 1) {
      const o = seciliOgeler[0];
      const k = ogeKutusu(o);
      if (k && !o.kilit && !(o.aci ?? 0)) {
        const t = TUTAMACLAR.find((h) => Math.abs(p[0] - (k.x + h.x * k.g)) <= tutamacBoyu && Math.abs(p[1] - (k.y + h.y * k.h)) <= tutamacBoyu);
        if (t) {
          yakala(e);
          if (e.altKey && kirpilabilir(o)) {
            setSurukleme({ tur: "kirp", oge: o, kutu: k, tutamac: t, eski: { konum: o.konum, kirp: o.kirp ?? [0, 0, 0, 0] } });
          } else {
            setSurukleme({ tur: "boyut", oge: o, kutu: k, tutamac: t, eski: { konum: o.konum, olcek: o.olcek, ...(o.sinir ? { sinir: o.sinir } : {}) } });
          }
          return;
        }
      }
    }
    const isabet = noktadakiOge(agac, p[0], p[1]);
    if (!isabet) {
      if (!e.ctrlKey) eylem.sec(null, "tek");
      return;
    }
    const ek = e.ctrlKey || e.metaKey;
    const zatenSecili = secim.includes(isabet.oge);
    if (!zatenSecili || ek) eylem.sec(isabet.oge, ek ? "ekle" : "tek");
    const tasinacak = (zatenSecili && !ek ? seciliOgeler : [isabet]).filter((o) => !o.kilit);
    const ogeler = tasinacak.map((o) => ({ oge: o, konum: o.konum, kutu: ogeKutusu(o)! })).filter((x) => x.kutu);
    if (ogeler.length) {
      yakala(e);
      setSurukleme({ tur: "tasi", bas: p, ogeler });
    }
  };

  const hareket = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!surukleme) return;
    const p = tuvalNoktasi(e, e.currentTarget);
    const yeniler: Record<string, MotorDonusumAlanlari> = {};
    if (surukleme.tur === "tasi") {
      let dx = p[0] - surukleme.bas[0];
      let dy = p[1] - surukleme.bas[1];
      const ilk = surukleme.ogeler[0];
      if (!e.ctrlKey) {
        const y = yapistir([ilk.konum[0] + dx, ilk.konum[1] + dy], ilk.kutu, boyut);
        dx = y[0] - ilk.konum[0];
        dy = y[1] - ilk.konum[1];
      }
      for (const x of surukleme.ogeler) yeniler[x.oge.oge] = { konum: [Math.round(x.konum[0] + dx), Math.round(x.konum[1] + dy)] };
    } else if (surukleme.tur === "kirp") {
      yeniler[surukleme.oge.oge] = kirpSurukle(surukleme.oge, surukleme.kutu, surukleme.tutamac, p);
    } else {
      yeniler[surukleme.oge.oge] = boyutlandir(surukleme.oge, surukleme.kutu, surukleme.tutamac, p, e.shiftKey);
    }
    setGecici(yeniler);
    const simdi = performance.now();
    if (simdi - sonAnlik.current > 80) {
      sonAnlik.current = simdi;
      for (const [oge, d] of Object.entries(yeniler)) eylem.anlik(oge, d);
    }
  };

  const bitir = () => {
    if (!surukleme) return;
    const s = surukleme;
    setSurukleme(null);
    if (s.tur === "tasi") {
      const degisim = s.ogeler
        .filter((x) => gecici[x.oge.oge]?.konum && (gecici[x.oge.oge].konum![0] !== x.konum[0] || gecici[x.oge.oge].konum![1] !== x.konum[1]))
        .map((x) => ({ oge: x.oge, yeni: gecici[x.oge.oge], eski: { konum: x.konum } }));
      if (degisim.length) eylem.donustur(degisim, degisim.length > 1 ? `${degisim.length} öğeyi taşı` : `«${degisim[0].oge.ad ?? degisim[0].oge.kaynak}» taşı`);
    } else if (gecici[s.oge.oge]) {
      const ad = s.tur === "kirp" ? "kırp" : "boyutlandır";
      eylem.donustur([{ oge: s.oge, yeni: gecici[s.oge.oge], eski: s.eski }], `«${s.oge.ad ?? s.oge.kaynak}» ${ad}`);
    }
  };

  const tus = (e: React.KeyboardEvent) => {
    if (!duzenlenebilir || !seciliOgeler.length) return;
    const adim = e.shiftKey ? 10 : 1;
    const d = { ArrowLeft: [-adim, 0], ArrowRight: [adim, 0], ArrowUp: [0, -adim], ArrowDown: [0, adim] }[e.key];
    if (!d) return;
    e.preventDefault();
    const degisim = seciliOgeler.filter((o) => !o.kilit).map((o) => ({ oge: o, yeni: { konum: [o.konum[0] + d[0], o.konum[1] + d[1]] as [number, number] }, eski: { konum: o.konum } }));
    if (degisim.length) eylem.donustur(degisim, "Öğeyi it");
  };

  return (
    <div className="dt-onizleme-bolme" data-vurgu={vurgu}>
      <div className="dt-onizleme-etiket">{etiket}</div>
      <div ref={kap} className="dt-onizleme-alan">
        <div className="dt-onizleme-tuval" style={{ width: olcu.g, height: olcu.y }}>
          {canliBagli && kare ? <img src={kare} alt={etiket} className="dt-onizleme-kare" draggable={false} /> : <YoklamaKaresi tuval={tuval} genislik={Math.min(960, Math.max(320, Math.round(olcu.g)))} />}
          <svg
            className="dt-onizleme-katman"
            viewBox={`0 0 ${boyut[0]} ${boyut[1]}`}
            preserveAspectRatio="none"
            tabIndex={duzenlenebilir ? 0 : -1}
            role="application"
            aria-label={`${etiket} düzenleme alanı`}
            onPointerDown={basla}
            onPointerMove={hareket}
            onPointerUp={bitir}
            onPointerCancel={bitir}
            onKeyDown={tus}
            onContextMenu={(e) => {
              if (!duzenlenebilir) return;
              const p = tuvalNoktasi(e, e.currentTarget);
              const o = noktadakiOge(agac, p[0], p[1]);
              if (o && !secim.includes(o.oge)) eylem.sec(o.oge, "tek");
              eylem.menu(e, o);
            }}
          >
            {kilavuz && (
              <g className="dt-kilavuz" aria-hidden>
                <rect x={boyut[0] * 0.05} y={boyut[1] * 0.05} width={boyut[0] * 0.9} height={boyut[1] * 0.9} vectorEffect="non-scaling-stroke" />
                <rect x={boyut[0] * 0.1} y={boyut[1] * 0.1} width={boyut[0] * 0.8} height={boyut[1] * 0.8} vectorEffect="non-scaling-stroke" />
                <line x1={boyut[0] / 2} y1={0} x2={boyut[0] / 2} y2={boyut[1]} vectorEffect="non-scaling-stroke" />
                <line x1={0} y1={boyut[1] / 2} x2={boyut[0]} y2={boyut[1] / 2} vectorEffect="non-scaling-stroke" />
              </g>
            )}
            {duzenlenebilir &&
              agac.map(({ oge }) => {
                if (!oge.gorunur) return null;
                const o = goster(oge);
                const k = ogeKutusu(o);
                if (!k) return null;
                const secili = secim.includes(o.oge);
                return (
                  <g key={o.oge} transform={k.aci ? `rotate(${k.aci} ${k.ox} ${k.oy})` : undefined}>
                    <rect x={k.x} y={k.y} width={k.g} height={k.h} className={secili ? "dt-secim-kutu" : "dt-secim-ince"} vectorEffect="non-scaling-stroke" />
                    {secili &&
                      !o.kilit &&
                      !k.aci &&
                      seciliOgeler.length === 1 &&
                      TUTAMACLAR.map((h) => (
                        <rect
                          key={h.ad}
                          x={k.x + h.x * k.g - tutamacBoyu / 2}
                          y={k.y + h.y * k.h - tutamacBoyu / 2}
                          width={tutamacBoyu}
                          height={tutamacBoyu}
                          className="dt-tutamac"
                          style={{ cursor: h.imlec }}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                  </g>
                );
              })}
          </svg>
        </div>
      </div>
    </div>
  );
}
