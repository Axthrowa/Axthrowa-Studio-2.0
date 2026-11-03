/**
 * OBS ses karıştırıcısı görünümünde giriş listesi: ad, fader dB değeri, kanal başına renkli ölçer,
 * dB cetveli, fader ve susturma.
 *
 * Ölçer saniyede onlarca kez değişir: React durumu yerine doğrudan öğeye yazılır, yalnız ölçerler güncellenir.
 */
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { obsApi, type ObsInputLevel } from "../../lib/api/actions";
import { dbYazisi, meterPercent, olcerAdimi, OLCER_BOSTA, sesDbdenYuzde, sesYuzdedenDb, type OlcerDurumu } from "../../lib/obsAudio";
import { obsControl, type ObsInputInfo } from "../../lib/obsControl";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";

/** OBS'in eşikleri: yeşil -20 dB'ye, sarı -9 dB'ye kadar, üstü kırmızı */
const SARI = meterPercent(-20);
const KIRMIZI = meterPercent(-9);
const ZEMIN = `linear-gradient(90deg, #1f5c2f 0 ${SARI}%, #6b5f1c ${SARI}% ${KIRMIZI}%, #6b2424 ${KIRMIZI}% 100%)`;
const DOLU = `linear-gradient(90deg, #4ade50 0 ${SARI}%, #facc15 ${SARI}% ${KIRMIZI}%, #ef4444 ${KIRMIZI}% 100%)`;
const SUSTURULMUS_ZEMIN = "#2c2d36";
const SUSTURULMUS_DOLU = "#8b8d9b";
const CETVEL = [-60, -50, -40, -30, -20, -10, 0];
const VARSAYILAN_KANAL = 2;
const OLCUM_MS = 100;

function Olcer({ ad, kanal, susturulmus }: { ad: string; kanal: number; susturulmus: boolean }) {
  return (
    <span data-olcer={`${ad}\u0000${kanal}`} className="relative block h-[7px] overflow-hidden rounded-[1px]" style={{ background: susturulmus ? SUSTURULMUS_ZEMIN : ZEMIN }}>
      <span data-dolu className="absolute inset-0" style={{ background: susturulmus ? SUSTURULMUS_DOLU : DOLU, clipPath: "inset(0 100% 0 0)" }} />
      <span data-tepe className="absolute inset-y-0 left-0 w-0.5 bg-white opacity-0" />
    </span>
  );
}

function Satir({ girdi, kanalSayisi, onSustur, onToast }: { girdi: ObsInputInfo; kanalSayisi: number; onSustur: () => void; onToast: (m: string) => void }) {
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
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={`min-w-0 truncate font-medium ${girdi.muted ? "text-panel-muted" : "text-white"}`} title={girdi.name}>{girdi.name}</span>
        <span className="shrink-0 font-mono tabular-nums text-panel-muted">{db === null ? "" : dbYazisi(db)}</span>
      </div>
      <div className="mt-1 flex flex-col gap-[2px]">
        {Array.from({ length: kanalSayisi }, (_, k) => (
          <Olcer key={k} ad={girdi.name} kanal={k} susturulmus={girdi.muted} />
        ))}
      </div>
      <div className="mt-0.5 flex items-center gap-2">
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
          className="h-6 min-w-0 flex-1 accent-[var(--panel-accent)]"
        />
        <button
          type="button"
          onClick={onSustur}
          aria-pressed={girdi.muted}
          aria-label={`${girdi.name} ${girdi.muted ? "sesini aç" : "sesini kapat"}`}
          title={girdi.muted ? "Sesi aç" : "Sustur"}
          className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded ${girdi.muted ? "bg-red-500/25 text-red-300" : "text-white hover:bg-white/10"}`}
        >
          {girdi.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function SesKaristirici({ girisler, onSustur, onToast }: { girisler: ObsInputInfo[]; onSustur: (g: ObsInputInfo) => void; onToast: (m: string) => void }) {
  const kutu = useRef<HTMLDivElement>(null);
  const seviyeler = useRef<Map<string, ObsInputLevel>>(new Map());
  const [kanallar, setKanallar] = useState<Record<string, number>>({});
  const varMi = girisler.length > 0;

  useEffect(() => {
    if (!varMi) return;
    let bekliyor = false;
    const id = setVisibleInterval(() => {
      if (bekliyor) return;
      bekliyor = true;
      obsApi
        .meters()
        .then((r) => {
          const taze = r.ageMs >= 0 && r.ageMs < 2000;
          seviyeler.current = new Map(taze ? r.inputs.map((l) => [l.name, l]) : []);
          if (taze) {
            // Kanal sayısı yalnız değişince yeniden çizilir
            setKanallar((o) => (r.inputs.every((l) => !l.channels?.length || o[l.name] === l.channels.length) ? o : Object.fromEntries(r.inputs.map((l) => [l.name, l.channels?.length || VARSAYILAN_KANAL]))));
          }
        })
        .catch(() => seviyeler.current.clear())
        .finally(() => {
          bekliyor = false;
        });
    }, OLCUM_MS);

    // Ölçüm 10/sn gelir; düşüş her karede yumuşak ilerler
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
        (el.querySelector("[data-dolu]") as HTMLElement).style.clipPath = `inset(0 ${100 - meterPercent(d.deger)}% 0 0)`;
        const tepe = el.querySelector("[data-tepe]") as HTMLElement;
        const yuzde = meterPercent(d.tepe);
        tepe.style.opacity = yuzde > 0 ? "1" : "0";
        tepe.style.left = `calc(${yuzde}% - 2px)`;
      });
      kare = requestAnimationFrame(ciz);
    };
    kare = requestAnimationFrame(ciz);
    return () => {
      clearVisibleInterval(id);
      cancelAnimationFrame(kare);
    };
  }, [varMi]);

  if (!varMi) return <p className="text-xs text-panel-muted">Ses girişi bulunamadı.</p>;
  return (
    <div ref={kutu} className="custom-scrollbar max-h-64 divide-y divide-white/[0.06] overflow-y-auto rounded-lg bg-panel-card px-3 py-1">
      {girisler.map((g) => (
        <Satir key={g.name} girdi={g} kanalSayisi={kanallar[g.name] || VARSAYILAN_KANAL} onSustur={() => onSustur(g)} onToast={onToast} />
      ))}
      <div aria-hidden className="relative h-4 text-[9px] text-panel-muted">
        {CETVEL.map((db) => (
          <span key={db} className="absolute top-1 -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${meterPercent(db)}%` }}>{db}</span>
        ))}
      </div>
    </div>
  );
}
