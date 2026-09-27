/**
 * Ses mikseri dock'u (OBS "Audio Mixer"): ses taşıyan her kaynak ayrı kanal. Kanal: ad, dB, stereo ölçer (RMS +
 * tepe + tepe tutma, kırpılma uyarısı), dB fader (çift tık 0 dB), sustur, izleme göstergesi, medya denetimi ve
 * dişli menüsü (Gelişmiş ses özellikleri, filtreler, izler, izleme, mono, gizle). Programda olmayan kanal soluk.
 *
 * Ölçerler `/ws/motor` seviye olaylarından requestAnimationFrame ile doğrudan DOM'a çizilir.
 * Çift ses uyarısı: uygulama sesini yakalayan kaynak + masaüstü sesi aynı izlerde.
 */
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Headphones, Pause, Play, RotateCcw, Settings2, Volume2, VolumeX } from "lucide-react";
import type { MotorCiftSes, MotorSesDurumu, MotorSesKanali, MotorSeviye } from "../../lib/api/motor";
import { carpandanDb, dbdenCarpan, dbdenKonum, dbMetni, IZLEME_ADLARI, kirpiliyor, konumdanDb, olcerBolgesi, olcerYuzdesi } from "../../lib/sesMatematik";
import type { MenuOgesi } from "../ui/BaglamMenusu";

export type MikserEylemleri = {
  ses: (k: MotorSesKanali, carpan: number) => void;
  sessiz: (k: MotorSesKanali) => void;
  medya: (k: MotorSesKanali, e: "oynat" | "duraklat" | "yeniden") => void;
  menu: (e: { clientX: number; clientY: number; preventDefault?: () => void }, o: MenuOgesi[]) => void;
  gelismis: () => void;
  filtreler: (k: MotorSesKanali) => void;
  ozellikler: (k: MotorSesKanali) => void;
  izleme: (k: MotorSesKanali, t: number) => void;
  izler: (k: MotorSesKanali, maske: number) => void;
  mono: (k: MotorSesKanali) => void;
  ciftSes: (c: MotorCiftSes, karar: "ikisini-tut" | "masaustunu-kapat") => void;
};

const GIZLI_ANAHTAR = "yya.yayin.mikser-gizli.v1";

function gizliOku(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(GIZLI_ANAHTAR) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function gizliYaz(s: Set<string>) {
  try {
    localStorage.setItem(GIZLI_ANAHTAR, JSON.stringify([...s]));
  } catch {
    /* depolama yoksa yalnız bu oturumda */
  }
}

/** Kanalın ölçerini rAF ile çizer */
function Olcer({ id, seviyeler }: { id: string; seviyeler: MutableRefObject<Map<string, MotorSeviye>> }) {
  const kok = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let r = 0;
    const tut = [-Infinity, -Infinity];
    let tutZaman = [0, 0];
    let kirpma = 0;
    const ciz = (t: number) => {
      const s = seviyeler.current.get(id);
      const el = kok.current;
      if (el) {
        for (const kanal of [0, 1] as const) {
          const tepe = s?.tepe[kanal] ?? -144;
          const ort = s?.ortalama[kanal] ?? -144;
          if (tepe > tut[kanal] || t - tutZaman[kanal] > 1500) {
            tut[kanal] = tepe;
            tutZaman = kanal === 0 ? [t, tutZaman[1]] : [tutZaman[0], t];
          }
          if (kirpiliyor(tepe)) kirpma = t;
          const satir = el.children[kanal] as HTMLElement | undefined;
          if (!satir) continue;
          const [rms, tp, tutma] = [satir.children[0], satir.children[1], satir.children[2]] as HTMLElement[];
          rms.style.width = `${olcerYuzdesi(ort)}%`;
          rms.dataset.bolge = olcerBolgesi(ort);
          tp.style.width = `${olcerYuzdesi(tepe)}%`;
          tp.dataset.bolge = olcerBolgesi(tepe);
          tutma.style.left = `${olcerYuzdesi(tut[kanal])}%`;
          tutma.style.opacity = Number.isFinite(tut[kanal]) && tut[kanal] > -60 ? "1" : "0";
        }
        el.dataset.kirpma = t - kirpma < 1000 ? "true" : "false";
      }
      r = requestAnimationFrame(ciz);
    };
    r = requestAnimationFrame(ciz);
    return () => cancelAnimationFrame(r);
  }, [id, seviyeler]);
  return (
    <div ref={kok} className="dt-olcer" aria-hidden>
      {[0, 1].map((k) => (
        <div key={k} className="dt-olcer-kanal">
          <span className="dt-olcer-rms" />
          <span className="dt-olcer-tepe" />
          <span className="dt-olcer-tutma" />
        </div>
      ))}
    </div>
  );
}

function Kanal({ k, seviyeler, izAdlari, eylem, gizle }: { k: MotorSesKanali; seviyeler: MutableRefObject<Map<string, MotorSeviye>>; izAdlari: string[]; eylem: MikserEylemleri; gizle: () => void }) {
  const [konum, setKonum] = useState(() => dbdenKonum(carpandanDb(k.ses)));
  const surukleniyor = useRef(false);
  const zaman = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!surukleniyor.current) setKonum(dbdenKonum(carpandanDb(k.ses)));
  }, [k.ses]);
  const degistir = (v: number) => {
    setKonum(v);
    window.clearTimeout(zaman.current);
    zaman.current = window.setTimeout(() => eylem.ses(k, dbdenCarpan(konumdanDb(v))), 60);
  };
  const db = carpandanDb(dbdenCarpan(konumdanDb(konum)));
  const menu = (): MenuOgesi[] => [
    { etiket: k.sessiz ? "Sesi aç" : "Sustur", eylem: () => eylem.sessiz(k) },
    { etiket: "Gelişmiş ses özellikleri…", eylem: eylem.gelismis },
    { etiket: "Filtreler…", eylem: () => eylem.filtreler(k) },
    { etiket: "Özellikler…", eylem: () => eylem.ozellikler(k) },
    "ayirici",
    ...IZLEME_ADLARI.map((ad, t): MenuOgesi => ({ etiket: `${k.izleme === t ? "● " : ""}${ad}`, eylem: () => eylem.izleme(k, t) })),
    "ayirici",
    ...[1, 2, 3, 4, 5, 6].map(
      (iz): MenuOgesi => ({
        etiket: `${(k.izler & (1 << (iz - 1))) !== 0 ? "☑" : "☐"} İz ${iz} · ${izAdlari[iz - 1] ?? ""}`,
        eylem: () => {
          const m = k.izler ^ (1 << (iz - 1));
          eylem.izler(k, m & 0x3f);
        },
      })
    ),
    "ayirici",
    { etiket: k.mono ? "Monoyu kapat" : "Mono'ya indir", eylem: () => eylem.mono(k) },
    { etiket: "Mikserde gizle", eylem: gizle },
  ];
  return (
    <div className="dt-kanal" data-soluk={k.etkin === false ? "true" : undefined} title={k.etkin === false ? "Programdaki sahnede değil" : undefined}>
      <div className="flex items-center gap-1.5">
        <span className="min-w-0 flex-1 truncate font-medium">{k.ad}</span>
        {k.izleme !== 0 && (
          <span title={IZLEME_ADLARI[k.izleme]} aria-label={IZLEME_ADLARI[k.izleme]}>
            <Headphones className="h-3 w-3 dt-uyari-metni" />
          </span>
        )}
        {k.mono && <span className="dt-soluk text-[10px]">MONO</span>}
        <span className="dt-sayi dt-soluk w-[62px] text-right text-[11px]">{k.sessiz ? "susturuldu" : dbMetni(db)}</span>
      </div>
      <Olcer id={k.id} seviyeler={seviyeler} />
      <div className="flex items-center gap-1">
        <input
          type="range"
          className="dt-fader min-w-0 flex-1"
          aria-label={`${k.ad} ses düzeyi`}
          aria-valuetext={dbMetni(db)}
          min={0}
          max={1000}
          value={Math.round(konum * 1000)}
          onPointerDown={() => (surukleniyor.current = true)}
          onPointerUp={() => (surukleniyor.current = false)}
          onChange={(e) => degistir(Number(e.target.value) / 1000)}
          onDoubleClick={() => degistir(1)}
          title="Çift tık: 0 dB"
        />
        {k.medya && (
          <>
            <button type="button" className="dt-tool" aria-label={k.medya.durum === "oynuyor" ? "Duraklat" : "Oynat"} onClick={() => eylem.medya(k, k.medya?.durum === "oynuyor" ? "duraklat" : "oynat")}>
              {k.medya.durum === "oynuyor" ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
            <button type="button" className="dt-tool" aria-label="Baştan oynat" onClick={() => eylem.medya(k, "yeniden")}>
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </>
        )}
        <button type="button" className="dt-tool" aria-label={k.sessiz ? "Sesi aç" : "Sustur"} aria-pressed={k.sessiz} onClick={() => eylem.sessiz(k)}>
          {k.sessiz ? <VolumeX className="h-3.5 w-3.5" style={{ color: "var(--dt-error)" }} /> : <Volume2 className="h-3.5 w-3.5" />}
        </button>
        <button type="button" className="dt-tool" aria-label={`${k.ad} ses seçenekleri`} onClick={(e) => eylem.menu(e, menu())} onContextMenu={(e) => eylem.menu(e, menu())}>
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function MikserDock({ ses, seviyeler, canliBagli, eylem }: { ses: MotorSesDurumu | null; seviyeler: MutableRefObject<Map<string, MotorSeviye>>; canliBagli: boolean; eylem: MikserEylemleri }) {
  const [gizli, setGizli] = useState<Set<string>>(gizliOku);
  const [yokSay, setYokSay] = useState<Set<string>>(new Set());
  const kanallar = (ses?.kaynaklar ?? []).filter((k) => !gizli.has(k.id));
  const uyarilar = (ses?.ciftSes ?? []).filter((c) => !yokSay.has(`${c.uygulama}|${c.masaustu}`));
  const gizleDegistir = (id: string, gizlensin: boolean) => {
    const s = new Set(gizli);
    if (gizlensin) s.add(id);
    else s.delete(id);
    setGizli(s);
    gizliYaz(s);
  };
  return (
    <section className="dt-dock h-full" aria-label="Ses mikseri">
      <div className="dt-dock-baslik">
        Ses Mikseri
        <span className="dt-bosluk" />
        {!canliBagli && <span className="dt-soluk font-normal" title="Canlı ölçer bağlantısı yok">ölçer yok</span>}
        {gizli.size > 0 && (
          <button type="button" className="dt-tool text-[11px]" onClick={() => (setGizli(new Set()), gizliYaz(new Set()))}>
            {gizli.size} gizli kanalı göster
          </button>
        )}
        <button type="button" className="dt-tool" aria-label="Gelişmiş ses özellikleri" title="Gelişmiş ses özellikleri" onClick={eylem.gelismis}>
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="dt-dock-govde">
        {uyarilar.map((c) => (
          <div key={`${c.uygulama}|${c.masaustu}`} className="dt-uyari-kutusu" role="alert">
            <p>
              «{c.uygulamaAdi}» uygulamanın sesini yakalıyor; «{c.masaustuAdi}» de aynı izlerde ({c.izler.join(", ")}). Bu uygulamanın sesi
              yayında iki kez duyulabilir.
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button type="button" className="dt-btn" onClick={() => eylem.ciftSes(c, "ikisini-tut")}>
                İkisini de tut
              </button>
              <button type="button" className="dt-btn" onClick={() => eylem.ciftSes(c, "masaustunu-kapat")}>
                Masaüstü sesini sustur
              </button>
              <button type="button" className="dt-btn" onClick={() => setYokSay(new Set(yokSay).add(`${c.uygulama}|${c.masaustu}`))}>
                Yok say
              </button>
            </div>
          </div>
        ))}
        {!ses && <p className="p-3 text-[12px] dt-soluk">Mikser okunuyor…</p>}
        {ses && kanallar.length === 0 && <p className="p-3 text-[12px] dt-soluk">Ses taşıyan kaynak yok. Mikrofon, masaüstü sesi, uygulama sesi ya da sesli medya ekleyin.</p>}
        {kanallar.map((k) => (
          <Kanal key={k.id} k={k} seviyeler={seviyeler} izAdlari={ses?.izAdlari ?? []} eylem={eylem} gizle={() => gizleDegistir(k.id, true)} />
        ))}
      </div>
    </section>
  );
}
