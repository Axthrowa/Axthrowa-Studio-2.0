/**
 * OBS'in dikey ses karıştırıcısı görünümü: her giriş bir sütun; ad, fader dB değeri, dikey fader,
 * kanal başına renkli ölçer, dB cetveli ve susturma.
 *
 * Ölçer saniyede onlarca kez değişir: React durumu yerine doğrudan öğeye yazılır, yalnız ölçerler güncellenir.
 */
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { EyeSlash, FadersHorizontal, Headphones, SpeakerHigh, SpeakerSlash } from "@phosphor-icons/react";
import { nesneMenusu, type MenuOgesi } from "../axthrowa/SagTikMenusu";
import { obsApi, type ObsInputLevel } from "../../lib/api/actions";
import { dbYazisi, meterPercent, olcerAdimi, OLCER_BOSTA, sesDbdenYuzde, sesYuzdedenDb, type OlcerDurumu } from "../../lib/obsAudio";
import { obsControl, type IzlemeTuru, type ObsInputInfo } from "../../lib/obsControl";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";

/** OBS'in eşikleri: yeşil -20 dB'ye, sarı -9 dB'ye kadar, üstü kırmızı */
const SARI = meterPercent(-20);
const KIRMIZI = meterPercent(-9);
const ZEMIN = `linear-gradient(0deg, rgb(var(--ui-ok) / 0.3) 0 ${SARI}%, rgb(var(--ui-warn) / 0.3) ${SARI}% ${KIRMIZI}%, rgb(var(--ui-danger) / 0.3) ${KIRMIZI}% 100%)`;
const DOLU = `linear-gradient(0deg, rgb(var(--ui-ok)) 0 ${SARI}%, rgb(var(--ui-warn)) ${SARI}% ${KIRMIZI}%, rgb(var(--ui-danger)) ${KIRMIZI}% 100%)`;
const SUSTURULMUS_ZEMIN = "rgb(var(--ui-s3))";
const SUSTURULMUS_DOLU = "rgb(var(--ui-fg3))";
const CETVEL = [-60, -50, -40, -30, -20, -10, 0];
const VARSAYILAN_KANAL = 2;
/** LED görünümü: 3 px yanık, 1 px boşluk */
const LED = "repeating-linear-gradient(0deg, rgb(var(--ui-bg)) 0 3px, transparent 3px 4px)";
const GIZLI_KEY = "axt.mikser.gizli";

function kayitliGizli(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(GIZLI_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const IZLEME: { tur: IzlemeTuru; ad: string }[] = [
  { tur: "none", ad: "İzleme: kapalı" },
  { tur: "monitorOnly", ad: "İzleme: yalnız dinle" },
  { tur: "monitorAndOutput", ad: "İzleme: dinle ve yayına ver" },
];

function Olcer({ ad, kanal, susturulmus }: { ad: string; kanal: number; susturulmus: boolean }) {
  return (
    <span data-olcer={`${ad}\u0000${kanal}`} className="relative block h-full w-[7px] overflow-hidden rounded-[1px]" style={{ background: susturulmus ? SUSTURULMUS_ZEMIN : ZEMIN, maskImage: LED }}>
      <span data-dolu className="absolute inset-0" style={{ background: susturulmus ? SUSTURULMUS_DOLU : DOLU, clipPath: "inset(100% 0 0 0)" }} />
      <span data-tepe className="absolute inset-x-0 bottom-0 h-0.5 opacity-0" />
    </span>
  );
}

function Satir({ girdi, kanalSayisi, onSustur, onToast, menu }: { girdi: ObsInputInfo; kanalSayisi: number; onSustur: () => void; onToast: (m: string) => void; menu: () => MenuOgesi[] }) {
  const [db, setDb] = useState<number | null>(null);
  const surukleniyor = useRef(false);
  const sonGonderim = useRef(0);

  // OBS'te elle değiştirilen ses de yansısın
  useEffect(() => {
    let iptal = false;
    const oku = () => {
      if (surukleniyor.current) return;
      void obsControl
        .volumeDb(girdi.name)
        .then((d) => {
          if (!iptal && !surukleniyor.current) setDb(d);
        })
        .catch(() => {});
    };
    oku();
    const id = setVisibleInterval(oku, 3000);
    return () => {
      iptal = true;
      clearVisibleInterval(id);
    };
  }, [girdi.name]);

  const gonder = (deger: number, zorla: boolean) => {
    // Sürüklerken OBS'i boğmayalım; bırakınca son değer kesin gider
    if (!zorla && Date.now() - sonGonderim.current < 60) return;
    sonGonderim.current = Date.now();
    void obsControl.setVolumeDb(girdi.name, deger).catch((e) => onToast(`${girdi.name}: ${String((e as Error).message || e).slice(0, 120)}`));
  };

  const birak = (e: { currentTarget: HTMLInputElement }) => {
    surukleniyor.current = false;
    gonder(sesYuzdedenDb(Number(e.currentTarget.value)), true);
  };

  return (
    <div className="flex w-[104px] shrink-0 flex-col items-center gap-1 px-1.5 py-2" onContextMenu={nesneMenusu(menu)}>
      <span className={`w-full truncate text-center text-xs font-medium ${girdi.muted ? "text-panel-muted" : "text-white"}`} title={girdi.name}>{girdi.name}</span>
      <span className="h-4 font-mono text-[11px] tabular-nums text-panel-muted">{db === null ? "" : dbYazisi(db)}</span>
      <div className="flex min-h-44 flex-1 items-stretch justify-center gap-1.5">
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          aria-label={`${girdi.name} ses düzeyi`}
          value={db === null ? 0 : sesDbdenYuzde(db)}
          disabled={db === null}
          onPointerDown={(e) => {
            // Fare kaydırıcının dışında bırakılırsa da son değer gitsin
            const el = e.currentTarget;
            surukleniyor.current = true;
            window.addEventListener("pointerup", () => birak({ currentTarget: el }), { once: true });
          }}
          onChange={(e) => {
            const d = sesYuzdedenDb(Number(e.target.value));
            setDb(d);
            gonder(d, false);
          }}
          onKeyUp={birak}
          className="h-full w-5 accent-[var(--panel-accent)] [direction:rtl] [writing-mode:vertical-lr]"
        />
        <div className="flex gap-[2px]">
          {Array.from({ length: kanalSayisi }, (_, k) => (
            <Olcer key={k} ad={girdi.name} kanal={k} susturulmus={girdi.muted} />
          ))}
        </div>
        <div aria-hidden className="relative w-5 text-[9px] leading-none text-panel-muted">
          {CETVEL.map((d) => (
            <span key={d} className="absolute left-0 translate-y-1/2" style={{ bottom: `${meterPercent(d)}%` }}>{d}</span>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={onSustur}
        aria-pressed={girdi.muted}
        aria-label={`${girdi.name} ${girdi.muted ? "sesini aç" : "sesini kapat"}`}
        title={girdi.muted ? "Sesi aç" : "Sustur"}
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-all active:scale-[0.98] motion-reduce:active:scale-100 ${girdi.muted ? "border-red-500 text-red-400" : "border-panel-border text-white hover:bg-[var(--dt-surface-3)]"}`}
      >
        {girdi.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>
    </div>
  );
}

export default function SesKaristirici({ girisler, onSustur, onToast }: { girisler: ObsInputInfo[]; onSustur: (g: ObsInputInfo) => void; onToast: (m: string) => void }) {
  const kutu = useRef<HTMLDivElement>(null);
  const seviyeler = useRef<Map<string, ObsInputLevel>>(new Map());
  const [kanallar, setKanallar] = useState<Record<string, number>>({});
  const [gizli, setGizli] = useState(kayitliGizli);
  const gizliYaz = (l: string[]) => {
    setGizli(l);
    try {
      localStorage.setItem(GIZLI_KEY, JSON.stringify(l));
    } catch {
      /* depolama kapalıysa yalnız bu oturumda */
    }
  };
  const hata = (g: ObsInputInfo, e: unknown) => onToast(`${g.name}: ${String((e as Error).message || e).slice(0, 140)}`);
  // Tablo A7 — Sustur · İzleme türü · Filtreler · Gizle
  const kanalMenusu = (g: ObsInputInfo): MenuOgesi[] => [
    { ad: g.muted ? "Sesi aç" : "Sustur", ikon: g.muted ? SpeakerHigh : SpeakerSlash, yap: () => onSustur(g) },
    ...IZLEME.map((i, n) => ({
      ad: i.ad,
      ikon: Headphones,
      ayrac: n === 0,
      yap: () => void obsControl.setMonitorType(g.name, i.tur).then(() => onToast(`${g.name}: ${i.ad.toLocaleLowerCase("tr-TR")}`)).catch((e) => hata(g, e)),
    })),
    { ad: "Filtreler", ikon: FadersHorizontal, ayrac: true, yap: () => void obsControl.openFilters(g.name).then(() => onToast(`${g.name}: OBS'te filtre penceresi açıldı`)).catch((e) => hata(g, e)) },
    { ad: "Gizle", ikon: EyeSlash, yap: () => gizliYaz([...gizli.filter((x) => x !== g.name), g.name]) },
  ];
  const gorunen = girisler.filter((g) => !gizli.includes(g.name));
  const gizlenen = girisler.length - gorunen.length;
  const varMi = girisler.length > 0;

  useEffect(() => {
    if (!varMi) return;
    // R7: ölçüm WebSocket'ten OBS hızında (20/sn) gelir, yoklama yok
    const kapat = obsApi.olcerAkisi((r) => {
      const taze = !!r && r.ageMs >= 0 && r.ageMs < 2000;
      seviyeler.current = new Map(taze && r ? r.inputs.map((l) => [l.name, l]) : []);
      if (taze && r) {
        // Kanal sayısı yalnız değişince yeniden çizilir
        setKanallar((o) => (r.inputs.every((l) => !l.channels?.length || o[l.name] === l.channels.length) ? o : Object.fromEntries(r.inputs.map((l) => [l.name, l.channels?.length || VARSAYILAN_KANAL]))));
      }
    });

    // Düşüş her karede yumuşak ilerler
    const durum = new Map<string, OlcerDurumu>();
    let kare = 0;
    let son = performance.now();
    const ciz = (simdi: number) => {
      const dt = simdi - son;
      son = simdi;
      kutu.current?.querySelectorAll<HTMLElement>("[data-olcer]").forEach((el) => {
        const anahtar = el.dataset.olcer as string;
        const [ad, kanal] = anahtar.split("\u0000");
        const l = seviyeler.current.get(ad);
        const c = l?.channels?.[Number(kanal)];
        const d = olcerAdimi(durum.get(anahtar) ?? OLCER_BOSTA, c ? c.peakDb : -Infinity, dt, simdi);
        durum.set(anahtar, d);
        (el.querySelector("[data-dolu]") as HTMLElement).style.clipPath = `inset(${100 - meterPercent(d.deger)}% 0 0 0)`;
        const tepe = el.querySelector("[data-tepe]") as HTMLElement;
        const yuzde = meterPercent(d.tepe);
        tepe.style.opacity = yuzde > 0 ? "1" : "0";
        tepe.style.bottom = `calc(${yuzde}% - 2px)`;
        tepe.style.background = yuzde >= KIRMIZI ? "rgb(var(--ui-danger))" : yuzde >= SARI ? "rgb(var(--ui-warn))" : "rgb(var(--ui-ok))";
      });
      kare = requestAnimationFrame(ciz);
    };
    kare = requestAnimationFrame(ciz);
    return () => {
      kapat();
      cancelAnimationFrame(kare);
    };
  }, [varMi]);

  if (!varMi) return <p className="text-xs text-panel-muted">Ses girişi bulunamadı.</p>;
  return (
    <div ref={kutu} className="custom-scrollbar flex h-full divide-x divide-panel-border overflow-x-auto">
      {gorunen.map((g) => (
        <Satir key={g.name} girdi={g} kanalSayisi={kanallar[g.name] || VARSAYILAN_KANAL} onSustur={() => onSustur(g)} onToast={onToast} menu={() => kanalMenusu(g)} />
      ))}
      {gizlenen > 0 && (
        <button type="button" className="shrink-0 self-start px-2 py-2 text-[11px] text-panel-muted hover:text-white" onClick={() => gizliYaz([])} title="Gizlenen kanalları yeniden göster">
          {gizlenen} gizli kanal · göster
        </button>
      )}
    </div>
  );
}
