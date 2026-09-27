/**
 * Yayın çalışma alanı — kendi yayın çekirdeğimizin (libobs, ayrı süreç) OBS'e tanıdık düzeni.
 *
 * Yerleşim (docs/WORKSPACE_LAYOUT_ARCHITECTURE.md): menü çubuğu · üstte önizleme (Studio Mode'da Önizleme | Program)
 * · altta dock sırası Sahneler | Kaynaklar | Ses Mikseri | Sahne Geçişleri | Denetimler (+ Hedefler, İstatistikler
 * isteğe bağlı; ayırıcılarla boyutlandırılır, Docklar menüsünden açılıp kapanır) · durum çubuğu.
 * Normal kipte sahneye tıklamak programa alır; Studio Mode'da önizlemeye. Kaynaklar dock'u ve önizleme düzenlemesi
 * o an düzenlenen sahneye (normalde program, Studio Mode'da önizleme) uygulanır.
 * Düzenlemeler Ctrl+Z / Ctrl+Y ile geri alınır (dönüşüm, görünürlük, kilit, sıra, kaldırma, ad).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  cikisEtkin,
  eklentiKaynakTurleri,
  KAYNAK_TURLERI,
  motorApi,
  type MotorDonusumAlanlari,
  type MotorDurumu,
  type MotorGecis,
  type MotorKaynak,
  type MotorKaynakTuru,
  type MotorKoleksiyonOzeti,
  type MotorSahneler,
  type MotorSahneOgesi,
  type MotorSahneOzeti,
  type MotorSahneYaniti,
  type MotorSesDurumu,
  type MotorSesKanali,
} from "../../lib/api/motor";
import { multistreamApi, type Finding } from "../../lib/api/multistream";
import { canliOzeti, sureBicimi } from "../../lib/broadcast";
import { ayiriciKaydir, ANAHTAR, DOCKLAR, dockDegistir, duzenOku, EN_AZ_YUKSEKLIK, EN_COK_YUKSEKLIK, siraliGorunur, varsayilanDuzen, type DockDuzeni, type DockKimligi } from "../../lib/dockDuzeni";
import { GeriAlYigini } from "../../lib/geriAl";
import { useMotorCanli } from "../../lib/motorCanli";
import { altanSira, sahneAgaci, tuvaleGore } from "../../lib/sahneAgaci";
import { clearVisibleInterval, setVisibleInterval } from "../../lib/visibleInterval";
import { cokmeMetni } from "../../lib/api/eklentiler";
import { useBaglamMenusu, type MenuOgesi } from "../ui/BaglamMenusu";
import { EklentiYoneticisi, type EklentiSekmesi } from "../eklenti/EklentiYoneticisi";
import { DenetimlerDock } from "./DenetimlerDock";
import { DonusumDiyalogu } from "./DonusumDiyalogu";
import { FiltrelerDiyalogu } from "./FiltrelerDiyalogu";
import { GecislerDock } from "./GecislerDock";
import { GelismisSesDiyalogu } from "./GelismisSesDiyalogu";
import { HedeflerDock, IstatistikDock, TUVAL_ADI, useBitHizi } from "./HedeflerDock";
import { KaynakEkleDiyalogu } from "./KaynakEkleDiyalogu";
import { KaynaklarDock } from "./KaynaklarDock";
import { KoleksiyonYoneticisi } from "./KoleksiyonYoneticisi";
import { MikserDock } from "./MikserDock";
import { TuvalGorunumu, type OnizlemeEylemleri } from "./OnizlemeAlani";
import { AdIstemi, hataMetni, MenuCubugu, OnayKutusu, Pencere, type Menu, type OnayIstegi } from "./ortak";
import { OzellikFormu } from "./OzellikFormu";
import { SahnelerDock } from "./SahnelerDock";
import { YayinAyarlari } from "./YayinAyarlari";
import { ayriPencere, monitorler, type Monitor } from "../../lib/projektor";

type Props = { onToast: (m: string) => void; onGit?: (hedef: "control" | "hotkeys" | "settings") => void };

const BOYUT: Record<string, [number, number]> = { ana: [1920, 1080], dikey: [1080, 1920] };

function duzenYukle(): DockDuzeni {
  try {
    return duzenOku(localStorage.getItem(ANAHTAR));
  } catch {
    return varsayilanDuzen();
  }
}

function duzenKaydet(d: DockDuzeni) {
  try {
    localStorage.setItem(ANAHTAR, JSON.stringify(d));
  } catch {
    /* depolama yoksa yalnız bu oturum */
  }
}

// ─── Motor kapalı ekranı ───────────────────────────────────────────────────

function MotorKapali({
  d,
  mesgul,
  onBaslat,
  onEklentiler,
  onAyarlar,
}: {
  d: MotorDurumu;
  mesgul: boolean;
  onBaslat: (dikey: boolean, fps: 30 | 60, ek?: { cokme_karari?: "normal" | "guvenli" | "devre-disi"; guvenli_kip?: boolean }) => void;
  onEklentiler: (s: EklentiSekmesi) => void;
  onAyarlar?: () => void;
}) {
  const [dikey, setDikey] = useState(d.dikey);
  const [fps, setFps] = useState<30 | 60>(d.fps === 30 ? 30 : 60);
  return (
    <div className="dt-dock flex-1 items-center justify-center">
      <div className="w-[440px] p-4">
        <p className="font-semibold">{mesgul ? "Video motoru başlatılıyor…" : "Video motoru kapalı."}</p>
        <p className="mt-1 text-[12px] dt-soluk">
          Motor, bilgisayarınızdaki OBS Studio kitaplıklarını kullanır; OBS penceresi açılmaz. Sahne koleksiyonunuz kayıtlıdır, açılışta geri gelir.
        </p>
        <div className="dt-form mt-2 px-0">
          <label htmlFor="yb-dikey">Dikey tuval</label>
          <label className="inline-flex items-center gap-2">
            <input id="yb-dikey" type="checkbox" checked={dikey} onChange={(e) => setDikey(e.target.checked)} />
            <span className="dt-soluk">1080×1920 (Shorts, TikTok, Twitch dikey)</span>
          </label>
          <label htmlFor="yb-fps">Kare hızı</label>
          <select id="yb-fps" className="dt-input w-28" value={fps} onChange={(e) => setFps(Number(e.target.value) as 30 | 60)}>
            <option value={60}>60 FPS</option>
            <option value={30}>30 FPS</option>
          </select>
        </div>
        {d.cokme ? (
          <div className="mt-3 rounded border border-[color:var(--dt-warn)] p-3" role="alert">
            <p className="font-semibold">{cokmeMetni(d.cokme)}</p>
            <p className="mt-1 text-[12px] dt-soluk">Sahneleriniz korunuyor. Güvenli kip bu açılışta üçüncü taraf eklentileri yüklemez; eklentinin kaynakları yer tutucu olarak görünür.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="dt-btn-primary" disabled={mesgul} onClick={() => onBaslat(dikey, fps, { cokme_karari: "guvenli" })}>
                Güvenli kipte başlat
              </button>
              {d.cokme.supheli && (
                <button type="button" className="dt-btn" disabled={mesgul} onClick={() => onBaslat(dikey, fps, { cokme_karari: "devre-disi" })}>
                  {d.cokme.supheli} eklentisini devre dışı bırak ve başlat
                </button>
              )}
              <button type="button" className="dt-btn" disabled={mesgul} onClick={() => onBaslat(dikey, fps, { cokme_karari: "normal" })}>
                Normal başlat
              </button>
              <button type="button" className="dt-btn" onClick={() => onEklentiler(d.cokme?.supheli ? "gelistirici" : "karantina")}>
                Tanılama…
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button type="button" className="dt-btn-primary" disabled={mesgul} onClick={() => onBaslat(dikey, fps)}>
              {mesgul ? "Başlatılıyor…" : "Motoru başlat"}
            </button>
            <button type="button" className="dt-btn" disabled={mesgul} title="Üçüncü taraf eklentiler bu açılışta yüklenmez" onClick={() => onBaslat(dikey, fps, { guvenli_kip: true })}>
              Güvenli kipte başlat
            </button>
            {onAyarlar && (
              <button type="button" className="dt-btn" onClick={onAyarlar}>
                Yayın ayarları…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GO LIVE ön kontrolü ───────────────────────────────────────────────────

function OnKontrol({ d, onBaslat, onKapat }: { d: MotorDurumu; onBaslat: () => void; onKapat: () => void }) {
  const [bulgular, setBulgular] = useState<Finding[] | null>(null);
  const [hata, setHata] = useState("");
  useEffect(() => {
    multistreamApi
      .preflight()
      .then((r) => setBulgular(r.findings))
      .catch((e) => {
        setHata(hataMetni(e));
        setBulgular([]);
      });
  }, []);
  const hedefler = d.hedefler.filter((h) => h.etkin && h.anahtarVar);
  const engel = (bulgular ?? []).some((b) => b.level === "block");
  const ad = (id: string | null) => (id ? (d.hedefler.find((h) => h.id === id)?.ad ?? id) : "Genel");
  return (
    <Pencere
      baslik="Yayına başlamadan önce"
      genislik={620}
      onKapat={onKapat}
      alt={
        <>
          <span className="mr-auto text-[11px] dt-soluk">Yayın yalnız bu düğmeyle başlar. Her hedef bağımsızdır; biri başarısız olursa diğerleri sürer.</span>
          <button type="button" className="dt-btn" onClick={onKapat}>
            Vazgeç
          </button>
          <button type="button" className="dt-btn-primary" disabled={!bulgular || engel || !hedefler.length} onClick={onBaslat}>
            {hedefler.length} hedefe yayını başlat
          </button>
        </>
      }
    >
      <table className="dt-table">
        <thead>
          <tr>
            <th>Hedef</th>
            <th>Platform</th>
            <th>Tuval</th>
            <th>Ses izi</th>
          </tr>
        </thead>
        <tbody>
          {hedefler.map((h) => (
            <tr key={h.id}>
              <td>{h.ad}</td>
              <td className="dt-soluk">{h.platform}</td>
              <td>{TUVAL_ADI[h.tuval ?? "ana"]}</td>
              <td>İz {(h.iz ?? 0) + 1}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 text-[12px]">
        {!bulgular && <p className="dt-soluk">Kontroller çalışıyor…</p>}
        {hata && <p className="dt-hata-metni">Ön kontrol çalışmadı: {hata}</p>}
        {bulgular?.length === 0 && !hata && <p style={{ color: "var(--dt-ok)" }}>Engel yok.</p>}
        {bulgular?.map((b) => (
          <p key={b.id + (b.destination ?? "")} className={b.level === "block" ? "dt-hata-metni" : b.level === "warn" ? "dt-uyari-metni" : "dt-soluk"}>
            {b.level === "block" ? "Engel" : b.level === "warn" ? "Uyarı" : "Bilgi"} · {ad(b.destination)}: {b.message}
          </p>
        ))}
      </div>
    </Pencere>
  );
}

// ─── Ana bileşen ───────────────────────────────────────────────────────────

export default function YayinCalismaAlani({ onToast, onGit }: Props) {
  const [d, setD] = useState<MotorDurumu | null>(null);
  const [sl, setSl] = useState<MotorSahneler | null>(null);
  const [sahne, setSahne] = useState<MotorSahneYaniti | null>(null);
  const [ses, setSes] = useState<MotorSesDurumu | null>(null);
  const [tuval, setTuval] = useState("ana");
  const [secim, setSecim] = useState<string[]>([]);
  const [acikGruplar, setAcikGruplar] = useState<Set<string>>(new Set());
  const [duzen, setDuzenHam] = useState<DockDuzeni>(duzenYukle);
  const [koleksiyonlar, setKoleksiyonlar] = useState<MotorKoleksiyonOzeti[]>([]);
  const [profiller, setProfiller] = useState<{ id: string; ad: string; etkin: boolean }[]>([]);
  const [ekranlar, setEkranlar] = useState<Monitor[]>([]);
  useEffect(() => {
    monitorler().then(setEkranlar, () => setEkranlar([]));
  }, []);
  const [ayarlar, setAyarlar] = useState<Parameters<typeof YayinAyarlari>[0]["baslangic"] | null>(null);
  const [mesgul, setMesgul] = useState<string | null>(null);
  const [durumCubugu, setDurumCubugu] = useState(true);
  // Diyaloglar
  const [ekle, setEkle] = useState<{ tur: MotorKaynakTuru; eklenti?: { id: string; ad: string } } | null>(null);
  const [ozellik, setOzellik] = useState<{ id: string; ad: string } | null>(null);
  const [filtre, setFiltre] = useState<{ kaynak: string; ad: string; ses: boolean; goruntu: boolean } | null>(null);
  const [donusumOge, setDonusumOge] = useState<string | null>(null);
  const [gelismisSes, setGelismisSes] = useState(false);
  const [koleksiyonPenceresi, setKoleksiyonPenceresi] = useState(false);
  const [gecisOzellik, setGecisOzellik] = useState(false);
  const [onKontrol, setOnKontrol] = useState(false);
  const [istem, setIstem] = useState<{ baslik: string; baslangic: string; yap: (ad: string) => void } | null>(null);
  const [onay, setOnay] = useState<OnayIstegi | null>(null);
  const [eklentiPenceresi, setEklentiPenceresi] = useState<{ sekme: EklentiSekmesi; paket?: boolean } | null>(null);
  // Panolar
  const [donusumPanosu, setDonusumPanosu] = useState<MotorDonusumAlanlari | null>(null);
  const [kaynakPanosu, setKaynakPanosu] = useState<{ kaynak: string; donusum: MotorDonusumAlanlari } | null>(null);
  // Süreler
  const [canliBas, setCanliBas] = useState<number | null>(null);
  const [kayitBas, setKayitBas] = useState<number | null>(null);
  const [simdi, setSimdi] = useState(Date.now());
  const menu = useBaglamMenusu();
  const yigin = useMemo(() => new GeriAlYigini(100), []);
  const [, setYiginSurum] = useState(0);
  useEffect(() => yigin.abone(() => setYiginSurum((s) => s + 1)), [yigin]);
  const docklarRef = useRef<HTMLDivElement>(null);

  const setDuzen = (f: (d: DockDuzeni) => DockDuzeni) =>
    setDuzenHam((d) => {
      const y = f(d);
      duzenKaydet(y);
      return y;
    });

  // ── Veri ──
  const calisiyor = !!d?.calisiyor;
  const studyo = !!sl && Object.prototype.hasOwnProperty.call(sl.studyo, tuval);
  const program = sl?.program[tuval];
  const onizleme = studyo ? (sl?.studyo[tuval] ?? program ?? null) : undefined;
  const aktifSahne = studyo ? (onizleme ?? program) : program;
  const tuvaller = calisiyor ? (sl?.dikey || d?.dikey ? ["ana", "dikey"] : ["ana"]) : [];

  const durumYenile = useCallback(async () => {
    try {
      setD(await motorApi.durum());
    } catch (e) {
      onToast(`Motor durumu alınamadı: ${hataMetni(e)}`);
    }
  }, [onToast]);
  const sahnelerYenile = useCallback(async () => {
    try {
      setSl(await motorApi.sahneler());
    } catch {
      /* motor kapanırken */
    }
  }, []);
  const sahneYenile = useCallback(async () => {
    if (!aktifSahne) return setSahne(null);
    try {
      setSahne(await motorApi.sahneDetay(aktifSahne));
    } catch {
      setSahne(null);
    }
  }, [aktifSahne]);
  const sesYenile = useCallback(async () => {
    try {
      setSes(await motorApi.ses());
    } catch {
      setSes(null);
    }
  }, []);
  const koleksiyonlarYenile = useCallback(() => {
    motorApi
      .koleksiyonlar()
      .then((r) => setKoleksiyonlar(r.liste))
      .catch(() => {});
    motorApi
      .profiller()
      .then((r) => setProfiller(r.liste))
      .catch(() => {});
  }, []);
  const hepsiniYenile = useCallback(() => {
    void durumYenile();
    void sahnelerYenile();
    void sahneYenile();
    void sesYenile();
  }, [durumYenile, sahnelerYenile, sahneYenile, sesYenile]);

  useEffect(() => {
    void durumYenile();
    koleksiyonlarYenile();
    const id = setVisibleInterval(() => void durumYenile(), 1000);
    return () => clearVisibleInterval(id);
  }, [durumYenile, koleksiyonlarYenile]);
  useEffect(() => {
    if (!calisiyor) return;
    void sahnelerYenile();
    void sesYenile();
    const id = setVisibleInterval(() => {
      void sahnelerYenile();
      void sesYenile();
    }, 1500);
    return () => clearVisibleInterval(id);
  }, [calisiyor, sahnelerYenile, sesYenile]);
  useEffect(() => {
    if (!calisiyor) return;
    void sahneYenile();
    const id = setVisibleInterval(() => void sahneYenile(), 1500);
    return () => clearVisibleInterval(id);
  }, [calisiyor, sahneYenile]);
  useEffect(() => {
    if (tuvaller.length && !tuvaller.includes(tuval)) setTuval("ana");
  }, [tuvaller.join(","), tuval]); // eslint-disable-line react-hooks/exhaustive-deps
  // Sahne değişince seçim düşer
  useEffect(() => setSecim([]), [aktifSahne]);

  // ── Canlı akış ──
  const canli = useMotorCanli(calisiyor, { seviye: true, kare: calisiyor ? { tuval: studyo ? `studyo-${tuval}` : tuval, genislik: 960, fps: 10 } : null });
  const programAkisi = useMotorCanli(calisiyor && studyo, { seviye: false, kare: calisiyor && studyo ? { tuval, genislik: 640, fps: 10 } : null });

  // ── Süreler ──
  const ozet = d ? canliOzeti(d) : { canli: 0, toplam: 0 };
  const kayitta = d ? cikisEtkin(d.kayit.durum) : false;
  useEffect(() => setCanliBas((b) => (ozet.canli > 0 ? (b ?? Date.now()) : null)), [ozet.canli]);
  useEffect(() => setKayitBas((b) => (kayitta ? (b ?? Date.now()) : null)), [kayitta]);
  useEffect(() => {
    if (canliBas === null && kayitBas === null) return;
    const id = window.setInterval(() => setSimdi(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [canliBas, kayitBas]);
  const bitHizi = useBitHizi(d?.istatistik as never);

  // ── Yardımcılar ──
  const yap = useCallback(
    async (etiket: string, f: () => Promise<unknown>, basari?: (r: unknown) => string | null) => {
      setMesgul(etiket);
      try {
        const r = await f();
        const m = basari?.(r);
        if (m) onToast(m);
        return r;
      } catch (e) {
        onToast(`${etiket}: ${hataMetni(e)}`);
        return undefined;
      } finally {
        setMesgul(null);
        hepsiniYenile();
      }
    },
    [onToast, hepsiniYenile]
  );

  const ogeler = sahne?.ogeler ?? [];
  const agac = useMemo(() => sahneAgaci(ogeler), [ogeler]);
  const oge = (id: string) => ogeler.find((o) => o.oge === id);
  const kaynakKaydi = (id: string): MotorKaynak | undefined => d?.kaynaklar.find((k) => k.id === id);
  const seciliOgeler = secim.map(oge).filter((x): x is MotorSahneOgesi => !!x);
  const tek = seciliOgeler.length === 1 ? seciliOgeler[0] : null;
  const sahneBilgi = (id: string | undefined | null) => sl?.sahneler.find((s) => s.id === id);
  const tuvalSahneleri = (sl?.sahneler ?? []).filter((s) => s.tuval === tuval);

  /** Geri alınabilir dönüşüm */
  const donustur = useCallback(
    async (degisim: { oge: MotorSahneOgesi; yeni: MotorDonusumAlanlari; eski: MotorDonusumAlanlari }[], ad: string) => {
      const uygula = (hangisi: "yeni" | "eski") => Promise.all(degisim.map((x) => motorApi.ogeIslem({ eylem: "donustur", oge: x.oge.oge, donusum: x[hangisi] })));
      try {
        await uygula("yeni");
        yigin.kaydet({ ad, geri: () => uygula("eski").then(sahneYenile), ileri: () => uygula("yeni").then(sahneYenile) });
      } catch (e) {
        onToast(`${ad}: ${hataMetni(e)}`);
      }
      void sahneYenile();
    },
    [yigin, onToast, sahneYenile]
  );

  const eskiDonusum = (o: MotorSahneOgesi, alanlar: MotorDonusumAlanlari): MotorDonusumAlanlari =>
    Object.fromEntries(Object.keys(alanlar).map((k) => [k, (o as Record<string, unknown>)[k] ?? null]).filter(([, v]) => v !== null)) as MotorDonusumAlanlari;

  const ogeDonustur = (o: MotorSahneOgesi, yeni: MotorDonusumAlanlari, ad: string) => void donustur([{ oge: o, yeni, eski: eskiDonusum(o, yeni) }], ad);

  const gorunurlukDegistir = (o: MotorSahneOgesi) => ogeDonustur(o, { gorunur: !o.gorunur }, `«${o.ad ?? o.kaynak}» ${o.gorunur ? "gizle" : "göster"}`);
  const kilitDegistir = (o: MotorSahneOgesi) => ogeDonustur(o, { kilit: !o.kilit }, `«${o.ad ?? o.kaynak}» ${o.kilit ? "kilidi aç" : "kilitle"}`);

  const sirayaTasi = async (o: MotorSahneOgesi, hedef: number, ad: string) => {
    const eski = altanSira(agac, o.oge);
    if (eski < 0 || hedef === eski) return;
    const uygula = (k: number) => motorApi.ogeIslem({ eylem: "sira", oge: o.oge, konum_sira: k });
    try {
      await uygula(hedef);
      yigin.kaydet({ ad, geri: () => uygula(eski).then(sahneYenile), ileri: () => uygula(hedef).then(sahneYenile) });
    } catch (e) {
      onToast(`${ad}: ${hataMetni(e)}`);
    }
    void sahneYenile();
  };
  const tasi = (o: MotorSahneOgesi, yon: "yukari" | "asagi" | "en_ust" | "en_alt") => {
    if (o.ust) return void yap("Sıra", () => motorApi.ogeIslem({ eylem: "sira", oge: o.oge, yon }));
    const i = altanSira(agac, o.oge);
    const son = agac.length - 1;
    const hedef = yon === "yukari" ? Math.min(son, i + 1) : yon === "asagi" ? Math.max(0, i - 1) : yon === "en_ust" ? son : 0;
    void sirayaTasi(o, hedef, `«${o.ad ?? o.kaynak}» sırası`);
  };

  const ogeleriKaldir = (liste: MotorSahneOgesi[]) => {
    if (!liste.length || !aktifSahne) return;
    const gruplu = liste.some((o) => o.grup);
    setOnay({
      baslik: liste.length > 1 ? `${liste.length} öğeyi kaldır` : "Öğeyi kaldır",
      metin: `${liste.map((o) => `«${o.ad ?? o.kaynak}»`).join(", ")} bu sahneden kaldırılacak. Kaynaklar diğer sahnelerde ve koleksiyonda kalır.${gruplu ? " Grup içindekilerle birlikte kalkar (geri alınamaz)." : ""}`,
      eylem: "Kaldır",
      yap: () => void kaldir(liste, gruplu),
    });
  };
  const kaldir = async (liste: MotorSahneOgesi[], gruplu: boolean) => {
    const sahneId = aktifSahne!;
    const kayit = liste.map((o) => ({ o, sira: altanSira(agac, o.oge) }));
    try {
      for (const { o } of kayit) await motorApi.ogeIslem({ eylem: "kaldir", oge: o.oge });
      if (!gruplu && kayit.every(({ o }) => !o.ust)) {
        let yeniOgeler: string[] = kayit.map(({ o }) => o.oge);
        const geri = async () => {
          const eklenen: string[] = [];
          for (const { o, sira } of [...kayit].sort((a, b) => a.sira - b.sira)) {
            const r = await motorApi.ogeIslem({
              eylem: "ekle",
              sahne: sahneId,
              kaynak: o.kaynak,
              donusum: {
                konum: o.konum,
                olcek: o.olcek,
                aci: o.aci ?? 0,
                gorunur: o.gorunur,
                kilit: !!o.kilit,
                hizalama: o.hizalama ?? 5,
                sinir_turu: o.sinir_turu ?? 0,
                sinir_hizalama: o.sinir_hizalama ?? 0,
                kirp: o.kirp ?? [0, 0, 0, 0],
                olcek_filtresi: o.olcek_filtresi ?? 0,
                karistirma: o.karistirma ?? 0,
                ...(o.sinir && (o.sinir_turu ?? 0) !== 0 ? { sinir: o.sinir } : {}),
              },
            });
            if (r.oge) {
              await motorApi.ogeIslem({ eylem: "sira", oge: r.oge, konum_sira: sira });
              eklenen.push(r.oge);
            }
          }
          yeniOgeler = eklenen;
          await sahneYenile();
        };
        const ileri = async () => {
          for (const x of yeniOgeler) await motorApi.ogeIslem({ eylem: "kaldir", oge: x });
          await sahneYenile();
        };
        yigin.kaydet({ ad: liste.length > 1 ? `${liste.length} öğeyi kaldır` : `«${liste[0].ad ?? liste[0].kaynak}» kaldır`, geri, ileri });
      }
      setSecim([]);
    } catch (e) {
      onToast(`Kaldırılamadı: ${hataMetni(e)}`);
    }
    hepsiniYenile();
  };

  const kaynakAdlandir = (o: MotorSahneOgesi) => {
    if (o.grup) {
      setIstem({ baslik: "Grubu yeniden adlandır", baslangic: o.ad ?? "", yap: (ad) => void yap("Adlandırılamadı", () => motorApi.ogeIslem({ eylem: "grup-adlandir", oge: o.oge, ad })) });
      return;
    }
    if (o.tur === "sahne") {
      const s = sahneBilgi(o.kaynak);
      if (s) sahneAdlandir(s);
      return;
    }
    const eski = o.ad ?? o.kaynak;
    setIstem({
      baslik: "Kaynağı yeniden adlandır",
      baslangic: eski,
      yap: async (ad) => {
        const r = await yap("Adlandırılamadı", () => motorApi.kaynakIslem(o.kaynak, "adlandir", { ad }));
        if (r !== undefined)
          yigin.kaydet({
            ad: `«${eski}» → «${ad}»`,
            geri: () => motorApi.kaynakIslem(o.kaynak, "adlandir", { ad: eski }).then(hepsiniYenile),
            ileri: () => motorApi.kaynakIslem(o.kaynak, "adlandir", { ad }).then(hepsiniYenile),
          });
      },
    });
  };

  const ozellikAc = (kaynak: string) => {
    const k = kaynakKaydi(kaynak);
    if (k && !k.eksik) setOzellik({ id: k.id, ad: k.ad });
  };
  const filtreAc = (kaynak: string) => {
    const k = kaynakKaydi(kaynak);
    if (!k || k.eksik) return;
    const o = ogeler.find((x) => x.kaynak === kaynak);
    const sesVar = !!ses?.kaynaklar.some((s) => s.id === kaynak) || !!o?.ses;
    const goruntuVar = (o?.genislik ?? 0) > 0 || !KAYNAK_TURLERI.find((t) => t.tur === k.tur)?.ses || ["tarayici", "medya"].includes(k.tur);
    setFiltre({ kaynak, ad: k.ad, ses: sesVar, goruntu: goruntuVar });
  };

  // ── Sahne işlemleri ──
  const sahneSec = (id: string) => {
    if (studyo) void yap("Önizleme", () => motorApi.studyo(tuval, "onizleme", { sahne: id }));
    else if (id !== program) void yap("Sahne geçişi", () => motorApi.program(id));
  };
  const programaAl = (id: string) => {
    if (!studyo) return sahneSec(id);
    void (async () => {
      await yap("Önizleme", () => motorApi.studyo(tuval, "onizleme", { sahne: id }));
      await yap("Geçiş", () => motorApi.studyo(tuval, "gecis"));
    })();
  };
  const sahneEkle = () =>
    setIstem({
      baslik: "Sahne ekle",
      baslangic: (() => {
        const adlar = new Set((sl?.sahneler ?? []).map((s) => s.ad));
        for (let i = (sl?.sahneler.length ?? 0) + 1; ; i++) if (!adlar.has(`Sahne ${i}`)) return `Sahne ${i}`;
      })(),
      yap: (ad) => void yap("Sahne eklenemedi", () => motorApi.sahneIslem({ eylem: "olustur", ad, tuval })),
    });
  const sahneAdlandir = (s: MotorSahneOzeti) =>
    setIstem({
      baslik: "Sahneyi yeniden adlandır",
      baslangic: s.ad,
      yap: async (ad) => {
        const eski = s.ad;
        const r = await yap("Adlandırılamadı", () => motorApi.sahneIslem({ eylem: "adlandir", id: s.id, ad }));
        if (r !== undefined)
          yigin.kaydet({
            ad: `Sahne «${eski}» → «${ad}»`,
            geri: () => motorApi.sahneIslem({ eylem: "adlandir", id: s.id, ad: eski }).then(hepsiniYenile),
            ileri: () => motorApi.sahneIslem({ eylem: "adlandir", id: s.id, ad }).then(hepsiniYenile),
          });
      },
    });
  const sahneSil = (s: MotorSahneOzeti) =>
    setOnay({ baslik: "Sahneyi kaldır", metin: `«${s.ad}» sahnesi kaldırılacak. İçindeki kaynaklar koleksiyonda kalır. Bu işlem geri alınamaz.`, eylem: "Kaldır", yap: () => void yap("Sahne kaldırılamadı", () => motorApi.sahneIslem({ eylem: "sil", id: s.id })) });

  // ── Bağlam menüleri ──
  const donusumMenusu = (o: MotorSahneOgesi): MenuOgesi[] => {
    const b = BOYUT[tuval];
    const ad = o.ad ?? o.kaynak;
    const cevir = (x: number, y: number) => ogeDonustur(o, { olcek: [o.olcek[0] * x, o.olcek[1] * y] }, `«${ad}» çevir`);
    return [
      { etiket: "Dönüşümü düzenle…", kisayol: "Ctrl+E", eylem: () => setDonusumOge(o.oge) },
      { etiket: "Dönüşümü kopyala", eylem: () => setDonusumPanosu({ konum: o.konum, olcek: o.olcek, aci: o.aci ?? 0, hizalama: o.hizalama ?? 5, sinir_turu: o.sinir_turu ?? 0, sinir_hizalama: o.sinir_hizalama ?? 0, kirp: o.kirp ?? [0, 0, 0, 0], ...(o.sinir ? { sinir: o.sinir } : {}) }) },
      { etiket: "Dönüşümü yapıştır", devreDisi: !donusumPanosu, eylem: () => donusumPanosu && ogeDonustur(o, donusumPanosu, `«${ad}» dönüşüm yapıştır`) },
      { etiket: "Dönüşümü sıfırla", eylem: () => ogeDonustur(o, { konum: [0, 0], olcek: [1, 1], aci: 0, hizalama: 5, sinir_turu: 0, kirp: [0, 0, 0, 0] }, `«${ad}» dönüşüm sıfırla`) },
      "ayirici",
      { etiket: "90° saat yönünde döndür", eylem: () => ogeDonustur(o, { aci: ((o.aci ?? 0) + 90) % 360 }, `«${ad}» döndür`) },
      { etiket: "90° saat yönü tersine döndür", eylem: () => ogeDonustur(o, { aci: ((o.aci ?? 0) + 270) % 360 }, `«${ad}» döndür`) },
      { etiket: "180° döndür", eylem: () => ogeDonustur(o, { aci: ((o.aci ?? 0) + 180) % 360 }, `«${ad}» döndür`) },
      { etiket: "Yatay çevir", eylem: () => cevir(-1, 1) },
      { etiket: "Dikey çevir", eylem: () => cevir(1, -1) },
      "ayirici",
      { etiket: "Tuvale sığdır", kisayol: "Ctrl+F", eylem: () => ogeDonustur(o, tuvaleGore(o, b, "sigdir"), `«${ad}» sığdır`) },
      { etiket: "Tuvale uzat", kisayol: "Ctrl+S", eylem: () => ogeDonustur(o, tuvaleGore(o, b, "uzat"), `«${ad}» uzat`) },
      { etiket: "Ekranda ortala", kisayol: "Ctrl+D", eylem: () => ogeDonustur(o, tuvaleGore(o, b, "ortala"), `«${ad}» ortala`) },
      { etiket: "Yatay ortala", eylem: () => ogeDonustur(o, tuvaleGore(o, b, "yatay-ortala"), `«${ad}» ortala`) },
      { etiket: "Dikey ortala", eylem: () => ogeDonustur(o, tuvaleGore(o, b, "dikey-ortala"), `«${ad}» ortala`) },
    ];
  };

  const ogeMenusu = (o: MotorSahneOgesi): MenuOgesi[] => {
    const k = kaynakKaydi(o.kaynak);
    const coklu = seciliOgeler.length > 1;
    const ayniGrup = seciliOgeler.every((x) => !x.ust && !x.grup);
    return [
      ...(coklu
        ? [
            { etiket: `${seciliOgeler.length} öğeyi grupla`, devreDisi: !ayniGrup, eylem: () => grupla(seciliOgeler) } as MenuOgesi,
            { etiket: `${seciliOgeler.length} öğeyi kaldır`, kisayol: "Del", tehlikeli: true, eylem: () => ogeleriKaldir(seciliOgeler) } as MenuOgesi,
            "ayirici" as const,
          ]
        : []),
      { etiket: "Özellikler…", devreDisi: !k || !!k.eksik, eylem: () => ozellikAc(o.kaynak) },
      { etiket: "Filtreler…", devreDisi: !k || !!k.eksik, eylem: () => filtreAc(o.kaynak) },
      { etiket: "Etkileşim…", devreDisi: true, eylem: () => undefined },
      "ayirici",
      ...donusumMenusu(o),
      "ayirici",
      { etiket: "Yukarı taşı", eylem: () => tasi(o, "yukari") },
      { etiket: "Aşağı taşı", eylem: () => tasi(o, "asagi") },
      { etiket: "En üste", kisayol: "Ctrl+Home", eylem: () => tasi(o, "en_ust") },
      { etiket: "En alta", kisayol: "Ctrl+End", eylem: () => tasi(o, "en_alt") },
      "ayirici",
      ...(o.grup ? [{ etiket: "Grubu çöz", eylem: () => void yap("Grup çözülemedi", () => motorApi.ogeIslem({ eylem: "grubu-coz", oge: o.oge })) } as MenuOgesi] : []),
      ...(o.ust ? [{ etiket: "Gruptan çıkar", eylem: () => void yap("Gruptan çıkarılamadı", () => motorApi.ogeIslem({ eylem: "gruptan-cikar", oge: o.oge })) } as MenuOgesi] : []),
      ...(!o.grup && !o.ust
        ? agac
            .filter((g) => g.oge.grup)
            .map((g) => ({ etiket: `«${g.oge.ad ?? g.oge.kaynak}» grubuna ekle`, eylem: () => void yap("Gruba eklenemedi", () => motorApi.ogeIslem({ eylem: "gruba-ekle", oge: o.oge, grup: g.oge.oge })) }) as MenuOgesi)
        : []),
      { etiket: o.gorunur ? "Gizle" : "Göster", eylem: () => gorunurlukDegistir(o) },
      { etiket: o.kilit ? "Kilidi aç" : "Kilitle", eylem: () => kilitDegistir(o) },
      "ayirici",
      { etiket: "Kopyala", kisayol: "Ctrl+C", devreDisi: o.grup || o.tur === "sahne", eylem: () => kopyala(o) },
      { etiket: "Yapıştır (başvuru)", kisayol: "Ctrl+V", devreDisi: !kaynakPanosu, eylem: () => yapistir(false) },
      { etiket: "Yapıştır (kopya)", devreDisi: !kaynakPanosu, eylem: () => yapistir(true) },
      { etiket: "Çoğalt", devreDisi: !k || !!k.eksik || o.grup, eylem: () => void yap("Çoğaltılamadı", () => motorApi.kaynakIslem(o.kaynak, "cogalt", { oge: o.oge })) },
      { etiket: "Yeniden adlandır", kisayol: "F2", eylem: () => kaynakAdlandir(o) },
      { etiket: "Kaldır", kisayol: "Del", tehlikeli: true, eylem: () => ogeleriKaldir(coklu ? seciliOgeler : [o]) },
      ...(k ? ["ayirici" as const, { etiket: "Kaynağı tamamen sil…", tehlikeli: true, eylem: () => kaynakSilOnay(k) } as MenuOgesi] : []),
    ];
  };

  const kaynakSilOnay = (k: MotorKaynak) =>
    setOnay({ baslik: "Kaynağı sil", metin: `«${k.ad}» tüm sahnelerden kaldırılacak ve ayarları, filtreleri silinecek. Bu işlem geri alınamaz.`, eylem: "Sil", yap: () => void yap("Kaynak silinemedi", () => motorApi.kaynakSil(k.id)) });

  const grupla = (liste: MotorSahneOgesi[]) =>
    setIstem({
      baslik: "Seçilenleri grupla",
      baslangic: (() => {
        const adlar = new Set(ogeler.filter((o) => o.grup).map((o) => o.ad));
        for (let i = 1; ; i++) if (!adlar.has(`Grup ${i}`)) return `Grup ${i}`;
      })(),
      yap: (ad) => void yap("Gruplanamadı", () => motorApi.ogeIslem({ eylem: "grupla", sahne: aktifSahne, ogeler: liste.map((o) => o.oge), ad })),
    });

  const kopyala = (o: MotorSahneOgesi) => {
    setKaynakPanosu({ kaynak: o.kaynak, donusum: { konum: o.konum, olcek: o.olcek, aci: o.aci ?? 0, hizalama: o.hizalama ?? 5 } });
    onToast(`«${o.ad ?? o.kaynak}» kopyalandı`);
  };
  const yapistir = (kopyaOlarak: boolean) => {
    if (!kaynakPanosu || !aktifSahne) return;
    const p = kaynakPanosu;
    if (kopyaOlarak) {
      void yap("Yapıştırılamadı", async () => {
        const r = await motorApi.kaynakIslem(p.kaynak, "cogalt");
        if (r.id) await motorApi.ogeIslem({ eylem: "ekle", sahne: aktifSahne, kaynak: r.id, donusum: p.donusum });
      });
    } else {
      void yap("Yapıştırılamadı", () => motorApi.ogeIslem({ eylem: "ekle", sahne: aktifSahne, kaynak: p.kaynak, donusum: p.donusum }));
    }
  };

  const ekleMenusu = (e: { clientX: number; clientY: number }) => {
    const grup = (turler: MotorKaynakTuru[]): MenuOgesi[] => turler.map((t) => ({ etiket: KAYNAK_TURLERI.find((k) => k.tur === t)!.ad, eylem: () => setEkle({ tur: t }) }));
    const eklenti: MenuOgesi[] = eklentiKaynakTurleri(d?.eklentiler).map((t) => ({ etiket: `${t.ad} — ${t.eklenti}`, eylem: () => setEkle({ tur: "eklenti", eklenti: { id: t.id, ad: t.ad } }) }));
    const sahneler: MenuOgesi[] = tuvalSahneleri
      .filter((s) => s.id !== aktifSahne)
      .map((s) => ({ etiket: `Sahne: ${s.ad}`, eylem: () => void yap("Sahne eklenemedi", () => motorApi.ogeIslem({ eylem: "ekle", sahne: aktifSahne, kaynak: s.id })) }));
    menu.ac(e, [
      ...grup(["renk", "yazi", "gorsel", "medya", "tarayici"]),
      "ayirici",
      ...grup(["ekran", "pencere", "oyun", "kamera"]),
      "ayirici",
      ...grup(["mikrofon", "masaustu", "uygulama_sesi"]),
      ...(sahneler.length ? (["ayirici"] as MenuOgesi[]).concat(sahneler) : []),
      ...(eklenti.length ? (["ayirici"] as MenuOgesi[]).concat(eklenti) : []),
      "ayirici",
      { etiket: "Yapıştır (başvuru)", devreDisi: !kaynakPanosu, eylem: () => yapistir(false) },
    ]);
  };

  const onizlemeEylem: OnizlemeEylemleri = {
    sec: (o, kip) => {
      if (!o) return setSecim([]);
      setSecim((s) => (kip === "ekle" ? (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]) : [o]));
    },
    donustur: (degisim, ad) => void donustur(degisim, ad),
    anlik: (o, yeni) => void motorApi.ogeIslem({ eylem: "donustur", oge: o, donusum: yeni }).catch(() => {}),
    menu: (e, o) =>
      menu.ac(
        e,
        o
          ? ogeMenusu(o)
          : [{ etiket: "Kaynak ekle…", eylem: () => ekleMenusu(e) }, { etiket: "Yapıştır (başvuru)", devreDisi: !kaynakPanosu, eylem: () => yapistir(false) }, "ayirici", ...projektorMenusu()]
      ),
  };

  // ── Klavye (çalışma alanı geneli) ──
  const genelTus = (e: React.KeyboardEvent) => {
    const hedef = e.target as HTMLElement;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(hedef.tagName)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && (e.key === "z" || e.key === "Z") && !e.shiftKey) {
      e.preventDefault();
      void yigin.geriAl().then((ad) => ad && onToast(`Geri alındı: ${ad}`), (x) => onToast(`Geri alınamadı: ${hataMetni(x)}`));
    } else if (ctrl && (e.key === "y" || ((e.key === "z" || e.key === "Z") && e.shiftKey))) {
      e.preventDefault();
      void yigin.yinele().then((ad) => ad && onToast(`Yinelendi: ${ad}`), (x) => onToast(`Yinelenemedi: ${hataMetni(x)}`));
    } else if (ctrl && e.key === "c" && tek) {
      e.preventDefault();
      kopyala(tek);
    } else if (ctrl && e.key === "v") {
      e.preventDefault();
      yapistir(false);
    } else if (ctrl && e.key === "e" && tek) {
      e.preventDefault();
      setDonusumOge(tek.oge);
    } else if (ctrl && tek && (e.key === "f" || e.key === "s" || e.key === "d")) {
      e.preventDefault();
      const kip = e.key === "f" ? "sigdir" : e.key === "s" ? "uzat" : "ortala";
      ogeDonustur(tek, tuvaleGore(tek, BOYUT[tuval], kip), `«${tek.ad ?? tek.kaynak}» ${kip}`);
    } else if (ctrl && tek && (e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      tasi(tek, e.key === "Home" ? "en_ust" : "en_alt");
    }
  };

  // ── Yayın denetimleri ──
  const yayinDugmesi = () => {
    if (!d) return;
    if (ozet.canli > 0) setOnay({ baslik: "Yayını bitir", metin: "Tüm motor hedefleri durdurulacak. Kayıt ve tekrar arabelleği sürer.", eylem: "Yayını bitir", yap: () => void yap("Yayın durdurulamadı", () => motorApi.golive("durdur")) });
    else setOnKontrol(true);
  };
  const golive = () => {
    setOnKontrol(false);
    void yap("Yayın başlatılamadı", () => motorApi.golive("baslat"), (r) => {
      const s = Object.entries((r as { sonuc: Record<string, { ok: boolean; hata?: string }> }).sonuc);
      const kotu = s.filter(([, v]) => !v.ok);
      return kotu.length ? `${s.length - kotu.length}/${s.length} hedef başladı. ${kotu.map(([k, v]) => `${k}: ${v.hata}`).join(" · ")}` : `${s.length} hedef başladı`;
    });
  };
  const kayitDugmesi = () =>
    void yap("Kayıt", () => motorApi.kayit(kayitta ? "durdur" : "baslat"), (r) => (kayitta ? `Kayıt kaydedildi: ${String((r as { yol?: string }).yol ?? "").split(/[\\/]/).pop()}` : null));
  const tekrarAcik = d ? cikisEtkin(d.tekrar.durum) : false;
  const tekrarDugmesi = () => void yap("Tekrar arabelleği", () => motorApi.tekrar(tekrarAcik ? "kapat" : "ac"));
  const tekrarKaydet = () => void yap("Tekrar kaydedilemedi", () => motorApi.tekrar("kaydet"), (r) => `Tekrar kaydedildi: ${String((r as { yol?: string }).yol ?? "").split(/[\\/]/).pop()}`);
  const studyoDugmesi = () => void yap("Studio Mode", () => motorApi.studyo(tuval, studyo ? "kapat" : "ac"));
  const motorDurdur = () => setOnay({ baslik: "Motoru durdur", metin: "Motor kapanır: tüm motor yayınları, kayıt ve tekrar arabelleği biter. Sahne koleksiyonu kayıtlıdır.", eylem: "Motoru durdur", yap: () => void yap("Motor durdurulamadı", () => motorApi.durdur()) });

  // ── Projektör ──
  const projektor = (hedef: string, monitor?: Monitor) =>
    void ayriPencere(`projektor-${hedef}${monitor ? "-tam" : ""}`, `/projektor?tuval=${encodeURIComponent(hedef)}`, `Projektör — ${hedef}`, { monitor, genislik: hedef.endsWith("dikey") ? 540 : 960, yukseklik: hedef.endsWith("dikey") ? 960 : 540 }).catch((e) =>
      onToast(`Projektör açılamadı: ${hataMetni(e)}`)
    );
  const projektorMenusu = (): MenuOgesi[] => [
    { etiket: `Projektör (pencere): Program · ${TUVAL_ADI[tuval]}`, devreDisi: !calisiyor, eylem: () => projektor(tuval) },
    ...(studyo ? [{ etiket: `Projektör (pencere): Önizleme · ${TUVAL_ADI[tuval]}`, eylem: () => projektor(`studyo-${tuval}`) } as MenuOgesi] : []),
    ...ekranlar.map((m): MenuOgesi => ({ etiket: `Tam ekran projektör: ${m.ad} (${m.genislik}×${m.yukseklik})`, devreDisi: !calisiyor, eylem: () => projektor(tuval, m) })),
  ];

  // ── Menü çubuğu ──
  const menuler: Menu[] = [
    {
      ad: "Dosya",
      ogeler: () => [
        { etiket: calisiyor ? "Motoru durdur…" : "Motoru başlat", eylem: calisiyor ? motorDurdur : () => void yap("Motor başlatılamadı", () => motorApi.baslat(d?.dikey ?? false, d?.fps === 30 ? 30 : 60)) },
        { etiket: `Kayıt klasörü: ${d?.kayitKlasoru ?? "—"}`, devreDisi: true, eylem: () => undefined },
        ...(d?.kayit.son ? [{ etiket: `Son kayıt: ${d.kayit.son.split(/[\\/]/).pop()}`, devreDisi: true, eylem: () => undefined } as MenuOgesi] : []),
        "ayirici",
        { etiket: "Yayın ayarları…", eylem: () => setAyarlar("cikis") },
        { etiket: "Uygulama ayarları", eylem: () => onGit?.("settings") },
      ],
    },
    {
      ad: "Düzen",
      ogeler: () => [
        { etiket: yigin.geriAdi ? `Geri al: ${yigin.geriAdi}` : "Geri al", kisayol: "Ctrl+Z", devreDisi: !yigin.geriAdi, eylem: () => void yigin.geriAl().catch((x) => onToast(`Geri alınamadı: ${hataMetni(x)}`)) },
        { etiket: yigin.ileriAdi ? `Yinele: ${yigin.ileriAdi}` : "Yinele", kisayol: "Ctrl+Y", devreDisi: !yigin.ileriAdi, eylem: () => void yigin.yinele().catch((x) => onToast(`Yinelenemedi: ${hataMetni(x)}`)) },
        "ayirici",
        { etiket: "Kopyala", kisayol: "Ctrl+C", devreDisi: !tek, eylem: () => tek && kopyala(tek) },
        { etiket: "Yapıştır (başvuru)", kisayol: "Ctrl+V", devreDisi: !kaynakPanosu, eylem: () => yapistir(false) },
        { etiket: "Yapıştır (kopya)", devreDisi: !kaynakPanosu, eylem: () => yapistir(true) },
        "ayirici",
        ...(tek ? donusumMenusu(tek) : [{ etiket: "Dönüşüm (bir kaynak seçin)", devreDisi: true, eylem: () => undefined } as MenuOgesi]),
        "ayirici",
        { etiket: "Gelişmiş ses özellikleri…", devreDisi: !calisiyor, eylem: () => setGelismisSes(true) },
      ],
    },
    {
      ad: "Görünüm",
      ogeler: () => [
        { etiket: `${studyo ? "☑" : "☐"} Studio Mode`, devreDisi: !calisiyor, eylem: studyoDugmesi },
        ...tuvaller.map((t): MenuOgesi => ({ etiket: `${t === tuval ? "● " : ""}Tuval: ${TUVAL_ADI[t]}`, eylem: () => setTuval(t) })),
        "ayirici",
        ...projektorMenusu(),
        "ayirici",
        { etiket: `${durumCubugu ? "☑" : "☐"} Durum çubuğu`, eylem: () => setDurumCubugu((x) => !x) },
      ],
    },
    {
      ad: "Docklar",
      ogeler: () => [
        ...DOCKLAR.map((x): MenuOgesi => ({ etiket: `${duzen.gorunur.includes(x.id) ? "☑" : "☐"} ${x.ad}`, eylem: () => setDuzen((dz) => dockDegistir(dz, x.id)) })),
        "ayirici",
        { etiket: `${duzen.kilitli ? "☑" : "☐"} Dockları kilitle`, eylem: () => setDuzen((dz) => ({ ...dz, kilitli: !dz.kilitli })) },
        { etiket: "Düzeni sıfırla", eylem: () => setDuzen(() => varsayilanDuzen()) },
        "ayirici",
        ...(["mikser", "sahneler", "hedefler", "istatistik"] as const).map(
          (x): MenuOgesi => ({
            etiket: `Ayrı pencerede aç: ${DOCKLAR.find((k) => k.id === x)?.ad}`,
            eylem: () =>
              void ayriPencere(`dock-${x}`, `/dock?id=${x}`, DOCKLAR.find((k) => k.id === x)?.ad ?? x, { genislik: x === "hedefler" ? 900 : 420, yukseklik: 520 }).catch((e) =>
                onToast(`Pencere açılamadı: ${hataMetni(e)}`)
              ),
          })
        ),
      ],
    },
    {
      ad: "Profil",
      ogeler: () => {
        const etkin = profiller.find((x) => x.etkin);
        const profilAc = (id: string, ad: string) =>
          void yap(
            "Profil değiştirilemedi",
            () => motorApi.profilIslem({ eylem: "gec", id }),
            (r) => ((r as { motorYenidenBasladi?: boolean }).motorYenidenBasladi ? `«${ad}» profili: motor yeni ayarlarla yeniden başladı` : `«${ad}» profili etkin`)
          ).then(koleksiyonlarYenile);
        return [
          ...profiller.map((x): MenuOgesi => ({ etiket: `${x.etkin ? "● " : ""}${x.ad}`, devreDisi: x.etkin, eylem: () => profilAc(x.id, x.ad) })),
          "ayirici",
          { etiket: "Yeni…", eylem: () => setIstem({ baslik: "Yeni profil", baslangic: "Yeni profil", yap: (ad) => void yap("Oluşturulamadı", () => motorApi.profilIslem({ eylem: "yeni", ad })).then(koleksiyonlarYenile) }) },
          { etiket: "Çoğalt…", devreDisi: !etkin, eylem: () => etkin && setIstem({ baslik: "Profili çoğalt", baslangic: `${etkin.ad} (kopya)`, yap: (ad) => void yap("Çoğaltılamadı", () => motorApi.profilIslem({ eylem: "cogalt", id: etkin.id, ad })).then(koleksiyonlarYenile) }) },
          { etiket: "Yeniden adlandır…", devreDisi: !etkin, eylem: () => etkin && setIstem({ baslik: "Profili yeniden adlandır", baslangic: etkin.ad, yap: (ad) => void yap("Adlandırılamadı", () => motorApi.profilIslem({ eylem: "adlandir", id: etkin.id, ad })).then(koleksiyonlarYenile) }) },
          ...profiller
            .filter((x) => !x.etkin)
            .map((x): MenuOgesi => ({
              etiket: `Kaldır: ${x.ad}…`,
              tehlikeli: true,
              eylem: () => setOnay({ baslik: "Profili kaldır", metin: `«${x.ad}» profili yedek klasörüne taşınacak (silinmez).`, eylem: "Kaldır", yap: () => void yap("Kaldırılamadı", () => motorApi.profilIslem({ eylem: "sil", id: x.id })).then(koleksiyonlarYenile) }),
            })),
          "ayirici",
          { etiket: "Dışa aktar (etkin profil)", devreDisi: !etkin, eylem: () => etkin && window.open(motorApi.profilDisaAktarUrl(etkin.id), "_blank") },
          { etiket: "Yayın ayarları…", eylem: () => setAyarlar("cikis") },
        ];
      },
    },
    {
      ad: "Sahne Koleksiyonu",
      ogeler: () => [
        ...koleksiyonlar.map((k): MenuOgesi => ({
          etiket: `${k.etkin ? "● " : ""}${k.ad}`,
          devreDisi: k.etkin,
          eylem: () =>
            void yap("Koleksiyona geçilemedi", () => motorApi.koleksiyon({ eylem: "gec", id: k.id }), () => `«${k.ad}» koleksiyonuna geçildi`).then(() => {
              yigin.temizle();
              koleksiyonlarYenile();
            }),
        })),
        "ayirici",
        { etiket: "Yeni…", eylem: () => setIstem({ baslik: "Yeni koleksiyon", baslangic: "Yeni koleksiyon", yap: (ad) => void yap("Oluşturulamadı", () => motorApi.koleksiyon({ eylem: "yeni", ad })).then(koleksiyonlarYenile) }) },
        { etiket: "Koleksiyonları yönet (çoğalt, adlandır, içe/dışa aktar, OBS'ten al)…", eylem: () => setKoleksiyonPenceresi(true) },
      ],
    },
    {
      ad: "Araçlar",
      ogeler: () => [
        { etiket: "Eklentiler…", eylem: () => setEklentiPenceresi({ sekme: "kurulu" }) },
        { etiket: "Kısayollar ve eylemler", eylem: () => onGit?.("hotkeys") },
      ],
    },
    {
      ad: "Yayın",
      ogeler: () => [
        { etiket: ozet.canli > 0 ? "Yayını bitir…" : "Yayını başlat…", devreDisi: !calisiyor || (ozet.canli === 0 && ozet.toplam === 0), eylem: yayinDugmesi },
        { etiket: kayitta ? "Kaydı durdur" : "Kaydı başlat", devreDisi: !calisiyor, eylem: kayitDugmesi },
        { etiket: tekrarAcik ? "Tekrar arabelleğini kapat" : "Tekrar arabelleğini aç", devreDisi: !calisiyor, eylem: tekrarDugmesi },
        { etiket: "Tekrarı kaydet", devreDisi: !tekrarAcik, eylem: tekrarKaydet },
      ],
    },
    {
      ad: "Hedefler",
      ogeler: () => [
        ...(d?.hedefler ?? []).map((h): MenuOgesi => ({
          etiket: `${cikisEtkin(h.durum) ? "■ Durdur" : "▶ Başlat"}: ${h.ad}`,
          devreDisi: !calisiyor || (!cikisEtkin(h.durum) && !h.anahtarVar),
          eylem: () => void yap("Hedef", () => motorApi.hedef(h.id, cikisEtkin(h.durum) ? "durdur" : "baslat")),
        })),
        "ayirici",
        { etiket: "Hedefler dock'unu göster", eylem: () => setDuzen((dz) => (dz.gorunur.includes("hedefler") ? dz : dockDegistir(dz, "hedefler"))) },
        { etiket: "Hedef ekle / düzenle (Kontrol Merkezi)", eylem: () => onGit?.("control") },
      ],
    },
    { ad: "Eklentiler", ogeler: () => [{ etiket: "Eklenti yöneticisi…", eylem: () => setEklentiPenceresi({ sekme: "kurulu" }) }, { etiket: "Paket kur…", eylem: () => setEklentiPenceresi({ sekme: "kurulu", paket: true }) }] },
    { ad: "Kontrol Merkezi", ogeler: () => [{ etiket: "Kontrol Merkezi'ni aç", eylem: () => onGit?.("control") }] },
    { ad: "Otomasyon", ogeler: () => [{ etiket: "Kısayollar ve eylem kayıt defteri", eylem: () => onGit?.("hotkeys") }, { etiket: "Olay kuralları (Kontrol Merkezi)", eylem: () => onGit?.("control") }] },
    {
      ad: "Yardım",
      ogeler: () => [
        { etiket: `libobs ${d?.bilgi?.libobs ?? "—"}`, devreDisi: true, eylem: () => undefined },
        { etiket: "Kısayollar: Ctrl+Z/Y geri al/yinele · Ctrl+C/V kopyala/yapıştır · Ctrl+E dönüşüm · Ctrl+F sığdır · Del kaldır · F2 adlandır", devreDisi: true, eylem: () => undefined },
      ],
    },
  ];

  // ── Oluşturma ──
  if (!d) return <div className="flex flex-1 items-center justify-center text-[13px] dt-soluk">Yayın motoru durumu alınıyor…</div>;
  if (!d.exeVar) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="dt-dock max-w-md p-4 text-[13px]">
          <p className="font-semibold">Yayın motoru bu kurulumda yok.</p>
          <p className="mt-2 dt-soluk">yayin-motoru.exe bulunamadı. Portable pakette uygulamanın yanında olmalı.</p>
        </div>
      </div>
    );
  }
  const gorunurDocklar = siraliGorunur(duzen);
  const toplamOran = gorunurDocklar.reduce((t, id) => t + (duzen.oranlar[id] ?? 1), 0);
  const aktifSahneAdi = sahneBilgi(aktifSahne)?.ad ?? null;
  const donusumHedefi = donusumOge ? oge(donusumOge) : undefined;
  const gecis = sl?.gecisler[tuval];

  const dock = (id: DockKimligi) => {
    switch (id) {
      case "sahneler":
        return (
          <SahnelerDock
            sahneler={tuvalSahneleri}
            tumSahneler={sl?.sahneler ?? []}
            program={program}
            onizleme={onizleme}
            studyo={studyo}
            secili={aktifSahne ?? null}
            gecisTurleri={sl?.gecisTurleri ?? []}
            eylem={{
              sec: sahneSec,
              programa: programaAl,
              ekle: sahneEkle,
              sil: sahneSil,
              adlandir: sahneAdlandir,
              cogalt: (s) => void yap("Sahne çoğaltılamadı", () => motorApi.sahneIslem({ eylem: "cogalt", id: s.id })),
              sirala: (ids) => void yap("Sahneler sıralanamadı", () => motorApi.sahneIslem({ eylem: "sirala", sira: ids })),
              gecisGecersiz: (s, g: MotorGecis | null) => void yap("Geçiş ayarlanamadı", () => motorApi.sahneIslem({ eylem: "gecis", id: s.id, gecis: g })),
              menuAc: menu.ac,
            }}
          />
        );
      case "kaynaklar":
        return (
          <KaynaklarDock
            sahneAdi={aktifSahneAdi}
            agac={agac}
            eksikler={sahne?.eksikler ?? []}
            secim={secim}
            acikGruplar={acikGruplar}
            eylem={{
              sec: (o, kip) => {
                if (kip === "ekle") setSecim((s) => (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]));
                else if (kip === "aralik" && secim.length) {
                  const duz = agac.flatMap((x) => [x.oge.oge, ...(acikGruplar.has(x.oge.oge) ? x.cocuklar.map((c) => c.oge) : [])]);
                  const [a, b] = [duz.indexOf(secim[0]), duz.indexOf(o)].sort((x, y) => x - y);
                  setSecim(duz.slice(a, b + 1));
                } else setSecim([o]);
              },
              grupAcKapa: (o) =>
                setAcikGruplar((s) => {
                  const y = new Set(s);
                  if (y.has(o)) y.delete(o);
                  else y.add(o);
                  return y;
                }),
              gorunurluk: gorunurlukDegistir,
              kilit: kilitDegistir,
              menu: (e, o) => menu.ac(e, ogeMenusu(o)),
              bosMenu: (e) => onizlemeEylem.menu(e, null),
              ekleMenusu,
              kaldir: () => ogeleriKaldir(seciliOgeler),
              ozellikler: (o) => (o.tur === "sahne" ? sahneSec(o.kaynak) : ozellikAc(o.kaynak)),
              filtreler: (o) => filtreAc(o.kaynak),
              adlandir: kaynakAdlandir,
              tasi: (o, yon) => tasi(o, yon),
              birak: (surulen, hedef) => {
                const o = oge(surulen);
                const h = altanSira(agac, hedef);
                if (o && h >= 0) void sirayaTasi(o, h, `«${o.ad ?? o.kaynak}» sırası`);
              },
              eksikMenu: (e, k) =>
                menu.ac(e, [
                  { etiket: "Eklentiyi kur…", eylem: () => setEklentiPenceresi({ sekme: "kurulu", paket: true }) },
                  { etiket: "Eklenti konumu ekle…", eylem: () => setEklentiPenceresi({ sekme: "konumlar" }) },
                  { etiket: `Gereken tür: ${k.obsTuru}`, devreDisi: true, eylem: () => undefined },
                  "ayirici",
                  { etiket: "Kaynağı sil…", tehlikeli: true, eylem: () => kaynakKaydi(k.kaynak) && kaynakSilOnay(kaynakKaydi(k.kaynak)!) },
                ]),
            }}
          />
        );
      case "mikser":
        return (
          <MikserDock
            ses={ses}
            seviyeler={canli.seviyeler}
            canliBagli={canli.bagli}
            eylem={{
              ses: (k, c) => void motorApi.sesAyarla(k.id, "ses", c).then(sesYenile, (x) => onToast(`Ses: ${hataMetni(x)}`)),
              sessiz: (k) => void motorApi.sesAyarla(k.id, "sessiz", !k.sessiz).then(sesYenile, (x) => onToast(`Ses: ${hataMetni(x)}`)),
              medya: (k, e) => void yap("Medya", () => motorApi.medya(k.id, e)),
              menu: menu.ac,
              gelismis: () => setGelismisSes(true),
              filtreler: (k) => filtreAc(k.id),
              ozellikler: (k) => ozellikAc(k.id),
              izleme: (k, t) => sesAyarla(k, "izleme", t),
              izler: (k, m) => (m === 0 ? onToast("En az bir iz açık kalmalı") : sesAyarla(k, "izler", m)),
              mono: (k) => sesAyarla(k, "mono", !k.mono),
              ciftSes: (c, karar) => void yap("Çift ses", () => motorApi.ciftSes(c.uygulama, c.masaustu, karar)),
            }}
          />
        );
      case "gecisler":
        return (
          <GecislerDock
            gecis={gecis}
            turler={sl?.gecisTurleri ?? []}
            studyo={studyo}
            meşgul={mesgul !== null}
            onTur={(t) => void yap("Geçiş", () => motorApi.gecisAyarla(tuval, t))}
            onSure={(ms) => void yap("Geçiş süresi", () => motorApi.gecisAyarla(tuval, gecis?.tur ?? "fade_transition", ms))}
            onOzellikler={() => setGecisOzellik(true)}
            onGecis={() => void yap("Geçiş", () => motorApi.studyo(tuval, "gecis"))}
          />
        );
      case "denetimler":
        return (
          <DenetimlerDock
            canli={ozet.canli}
            canliToplam={ozet.toplam}
            kayitta={kayitta}
            tekrarAcik={tekrarAcik}
            studyo={studyo}
            meşgul={mesgul !== null}
            onYayin={yayinDugmesi}
            onKayit={kayitDugmesi}
            onTekrar={tekrarDugmesi}
            onTekrarKaydet={tekrarKaydet}
            onStudyo={studyoDugmesi}
            onAyarlar={() => setAyarlar("cikis")}
            onMotorDurdur={motorDurdur}
          />
        );
      case "hedefler":
        return (
          <HedeflerDock
            d={d}
            tuvaller={tuvaller}
            mesgul={mesgul !== null}
            bitHizi={bitHizi}
            onBaslat={(id, t, iz) => void yap("Hedef başlatılamadı", () => motorApi.hedef(id, "baslat", t, iz))}
            onDurdur={(id) => void yap("Hedef durdurulamadı", () => motorApi.hedef(id, "durdur"))}
          />
        );
      case "istatistik":
        return <IstatistikDock d={d} bitHizi={bitHizi} />;
    }
  };

  function sesAyarla(k: MotorSesKanali, eylem: "ses" | "mono" | "denge" | "senkron" | "izleme" | "izler", deger: number | boolean) {
    void motorApi.sesAyarla(k.id, eylem, deger).then(sesYenile, (x) => onToast(`Ses: ${hataMetni(x)}`));
  }

  const ayiriciSurukle = (sol: DockKimligi, sag: DockKimligi) => (e: React.PointerEvent) => {
    if (duzen.kilitli) return;
    const bas = e.clientX;
    const genislik = docklarRef.current?.getBoundingClientRect().width ?? 1000;
    const ilk = duzen;
    const hareket = (m: PointerEvent) => setDuzen(() => ayiriciKaydir(ilk, sol, sag, m.clientX - bas, genislik));
    const birak = () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
    };
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
  };
  const yukseklikSurukle = (e: React.PointerEvent) => {
    if (duzen.kilitli) return;
    const bas = e.clientY;
    const ilk = duzen.yukseklik;
    const hareket = (m: PointerEvent) => setDuzen((dz) => ({ ...dz, yukseklik: Math.min(EN_COK_YUKSEKLIK, Math.max(EN_AZ_YUKSEKLIK, ilk - (m.clientY - bas))) }));
    const birak = () => {
      window.removeEventListener("pointermove", hareket);
      window.removeEventListener("pointerup", birak);
    };
    window.addEventListener("pointermove", hareket);
    window.addEventListener("pointerup", birak);
  };

  const ist = d.istatistik as (MotorDurumu["istatistik"] & { cpu?: number; atlanan_kare?: number }) | null;
  const toplamKbps = Object.entries(bitHizi)
    .filter(([id]) => id.startsWith("h-"))
    .reduce((t, [, v]) => t + v, 0);
  const yenidenBaglanan = d.hedefler.filter((h) => h.durum === "yeniden_baglaniyor").length;
  const basarisiz = d.hedefler.filter((h) => h.durum === "basarisiz").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col text-[13px]" style={{ color: "var(--dt-text)" }} onKeyDown={genelTus}>
      <MenuCubugu menuler={menuler} />
      {!calisiyor ? (
        <div className="flex min-h-0 flex-1 p-1">
          <MotorKapali
            d={d}
            mesgul={mesgul === "Motor başlatılamadı"}
            onBaslat={(dikey, fps, ek) =>
              void yap("Motor başlatılamadı", () => motorApi.baslat(dikey, fps, ek), (r) => {
                const eksik = (r as { eksikKaynaklar?: string[] }).eksikKaynaklar ?? [];
                return eksik.length ? `Eklentisi yüklü olmayan ${eksik.length} kaynak yer tutucu olarak korundu: ${eksik.join(", ")}` : null;
              })
            }
            onEklentiler={(s) => setEklentiPenceresi({ sekme: s })}
            onAyarlar={() => setAyarlar("cikis")}
          />
        </div>
      ) : (
        <>
          {/* Önizleme */}
          <div className="flex min-h-0 flex-1 flex-col gap-1 p-1">
            <div className="flex items-center gap-2 px-1 text-[12px]">
              {tuvaller.length > 1 && (
                <div className="dt-sekmeler" role="tablist" aria-label="Tuval">
                  {tuvaller.map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={t === tuval} className="dt-sekme" onClick={() => setTuval(t)}>
                      {TUVAL_ADI[t]} <span className="dt-soluk font-normal">{BOYUT[t].join("×")}</span>
                    </button>
                  ))}
                </div>
              )}
              {d.guvenliKip && (
                <span className="dt-durum" data-ton="uyari" title="Üçüncü taraf eklentiler bu oturumda yüklenmedi">
                  Güvenli kip
                </span>
              )}
              <span className="dt-bosluk" />
              {studyo && <span className="dt-soluk">Studio Mode · önizlemede düzenleyin, "Geçiş" ile programa alın</span>}
            </div>
            <div className="flex min-h-0 flex-1 gap-1">
              <TuvalGorunumu
                etiket={studyo ? `Önizleme · ${sahneBilgi(onizleme)?.ad ?? ""}` : `Program · ${sahneBilgi(program)?.ad ?? ""}`}
                tuval={studyo ? `studyo-${tuval}` : tuval}
                boyut={BOYUT[tuval]}
                kare={canli.kare?.tuval === (studyo ? `studyo-${tuval}` : tuval) ? canli.kare.url : null}
                canliBagli={canli.bagli}
                agac={agac}
                secim={secim}
                duzenlenebilir
                eylem={onizlemeEylem}
                vurgu={studyo ? "onizleme" : "program"}
              />
              {studyo && (
                <>
                  <div className="flex flex-col items-center justify-center gap-2 px-1">
                    <button type="button" className="dt-btn-primary" disabled={mesgul !== null} onClick={() => void yap("Geçiş", () => motorApi.studyo(tuval, "gecis"))} title="Önizlemeyi programa al">
                      Geçiş →
                    </button>
                    <button type="button" className="dt-btn" disabled={mesgul !== null} onClick={() => void yap("Kesme", () => motorApi.studyo(tuval, "gecis", { sure_ms: 0 }))} title="Anında geç">
                      Kes →
                    </button>
                    <button type="button" className="dt-btn" disabled={mesgul !== null} onClick={() => void yap("Takas", () => motorApi.studyo(tuval, "gecis", { takas: true }))} title="Geç ve önizlemeyi eski programla değiştir">
                      Takas ⇄
                    </button>
                  </div>
                  <TuvalGorunumu
                    etiket={`Program · ${sahneBilgi(program)?.ad ?? ""}`}
                    tuval={tuval}
                    boyut={BOYUT[tuval]}
                    kare={programAkisi.kare?.tuval === tuval ? programAkisi.kare.url : null}
                    canliBagli={programAkisi.bagli}
                    agac={[]}
                    secim={[]}
                    duzenlenebilir={false}
                    eylem={onizlemeEylem}
                    vurgu="program"
                  />
                </>
              )}
            </div>
          </div>
          {/* Alt dock sırası */}
          <div className="dt-yatay-ayirici" role="separator" aria-orientation="horizontal" aria-label="Dock yüksekliği" data-kilitli={duzen.kilitli || undefined} onPointerDown={yukseklikSurukle} />
          <div ref={docklarRef} className="flex min-h-0 gap-0 px-1" style={{ height: duzen.yukseklik }}>
            {gorunurDocklar.map((id, i) => (
              <div key={id} className="flex min-h-0 min-w-0" style={{ flex: `${(duzen.oranlar[id] ?? 1) / toplamOran} 1 0` }}>
                <div className="min-h-0 min-w-0 flex-1">{dock(id)}</div>
                {i < gorunurDocklar.length - 1 && (
                  <div className="dt-dikey-ayirici" role="separator" aria-orientation="vertical" data-kilitli={duzen.kilitli || undefined} onPointerDown={ayiriciSurukle(id, gorunurDocklar[i + 1])} />
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {/* Durum çubuğu */}
      {durumCubugu && (
        <div className="dt-durum-cubugu" role="status" aria-label="Durum çubuğu">
          <span className="dt-nokta" data-durum={calisiyor ? "hazir" : undefined} />
          <span>{calisiyor ? `libobs ${d.bilgi?.libobs ?? "?"}` : d.sonCikisKodu != null ? `Motor kapalı (son çıkış kodu ${d.sonCikisKodu})` : "Motor kapalı"}</span>
          {sl?.koleksiyon && <span className="dt-soluk">· {sl.koleksiyon.ad}</span>}
          <span className="dt-bosluk" />
          {canliBas !== null && (
            <span className="dt-canli" title={`${ozet.canli}/${ozet.toplam} hedef canlı`}>
              CANLI {sureBicimi(simdi - canliBas)} · {ozet.canli}/{ozet.toplam}
            </span>
          )}
          {kayitBas !== null && <span className="dt-kayit">KAYIT {sureBicimi(simdi - kayitBas)}</span>}
          {(yenidenBaglanan > 0 || basarisiz > 0) && (
            <span className="dt-uyari-metni">
              {yenidenBaglanan > 0 && `${yenidenBaglanan} hedef yeniden bağlanıyor`} {basarisiz > 0 && `${basarisiz} hedef başarısız`}
            </span>
          )}
          {calisiyor && ist && (
            <>
              <span className="dt-sayi">CPU %{(ist.cpu ?? 0).toFixed(1)}</span>
              <span className="dt-sayi">{ist.fps.toFixed(2)} FPS</span>
              <span className="dt-sayi" title="İşlemede geciken kare / toplam">
                geciken {ist.geciken_kare}
              </span>
              {ist.atlanan_kare != null && <span className="dt-sayi" title="Kodlamada atlanan kare">atlanan {ist.atlanan_kare}</span>}
              {toplamKbps > 0 && <span className="dt-sayi">{Math.round(toplamKbps)} kbps</span>}
            </>
          )}
        </div>
      )}

      {menu.menu}
      {ekle && aktifSahne && (
        <KaynakEkleDiyalogu
          tur={ekle.tur}
          eklentiTuru={ekle.eklenti}
          sahne={{ id: aktifSahne, ad: aktifSahneAdi ?? aktifSahne, tuval }}
          kaynaklar={d.kaynaklar}
          onEklendi={(r) => {
            hepsiniYenile();
            if (r.varOlan && r.oge) {
              const o = r.oge;
              const s = aktifSahne;
              let guncel = o;
              yigin.kaydet({
                ad: `«${r.ad}» ekle`,
                geri: () => motorApi.ogeIslem({ eylem: "kaldir", oge: guncel }).then(sahneYenile),
                ileri: async () => {
                  const x = await motorApi.ogeIslem({ eylem: "ekle", sahne: s, kaynak: o.split("/")[1]?.split("#")[0] ?? "" });
                  guncel = x.oge ?? guncel;
                  await sahneYenile();
                },
              });
            }
          }}
          onKapat={() => setEkle(null)}
        />
      )}
      {ozellik && <KaynakOzellikleri id={ozellik.id} ad={ozellik.ad} onKapat={() => (setOzellik(null), hepsiniYenile())} />}
      {filtre && (
        <FiltrelerDiyalogu
          kaynak={filtre.kaynak}
          kaynakAdi={filtre.ad}
          ses={filtre.ses}
          goruntu={filtre.goruntu}
          menuAc={menu.ac}
          onToast={onToast}
          onDegisti={hepsiniYenile}
          onKapat={() => setFiltre(null)}
        />
      )}
      {donusumHedefi && (
        <DonusumDiyalogu
          oge={donusumHedefi}
          onDegistir={(yeni, eski) => void donustur([{ oge: donusumHedefi, yeni, eski }], `«${donusumHedefi.ad ?? donusumHedefi.kaynak}» dönüşüm`)}
          onSifirla={() => ogeDonustur(donusumHedefi, { konum: [0, 0], olcek: [1, 1], aci: 0, hizalama: 5, sinir_turu: 0, kirp: [0, 0, 0, 0] }, "Dönüşüm sıfırla")}
          onKapat={() => setDonusumOge(null)}
        />
      )}
      {gelismisSes && <GelismisSesDiyalogu ses={ses} onAyarla={sesAyarla} onKapat={() => setGelismisSes(false)} />}
      {gecisOzellik && <GecisOzellikleri tuval={tuval} ad={sl?.gecisTurleri?.find((t) => t.id === gecis?.tur)?.ad ?? gecis?.tur ?? ""} onKapat={() => setGecisOzellik(false)} />}
      {koleksiyonPenceresi && (
        <KoleksiyonYoneticisi
          onToast={onToast}
          onDegisti={() => {
            yigin.temizle();
            hepsiniYenile();
            koleksiyonlarYenile();
          }}
          onKapat={() => {
            setKoleksiyonPenceresi(false);
            koleksiyonlarYenile();
          }}
        />
      )}
      {onKontrol && <OnKontrol d={d} onBaslat={golive} onKapat={() => setOnKontrol(false)} />}
      {ayarlar && (
        <YayinAyarlari
          baslangic={ayarlar}
          motorKodlayicilari={d.kodlayicilar}
          onToast={onToast}
          onGit={(h) => {
            setAyarlar(null);
            onGit?.(h);
          }}
          onKapat={() => {
            setAyarlar(null);
            hepsiniYenile();
            koleksiyonlarYenile();
          }}
        />
      )}
      {istem && <AdIstemi baslik={istem.baslik} baslangic={istem.baslangic} onKapat={() => setIstem(null)} onTamam={(ad) => (setIstem(null), istem.yap(ad))} />}
      {onay && <OnayKutusu istek={onay} onKapat={() => setOnay(null)} />}
      {eklentiPenceresi && (
        <EklentiYoneticisi
          baslangic={eklentiPenceresi.sekme}
          paketKur={eklentiPenceresi.paket}
          onToast={onToast}
          onKapat={() => {
            setEklentiPenceresi(null);
            void durumYenile();
          }}
        />
      )}
    </div>
  );
}

/** Kaynak özellikleri (okuma/yazma işlevleri kimliğe göre sabit: form her yenilemede baştan yüklenmesin) */
function KaynakOzellikleri({ id, ad, onKapat }: { id: string; ad: string; onKapat: () => void }) {
  const oku = useCallback(() => motorApi.kaynakOzellikleri(id), [id]);
  const yaz = useCallback((a: Record<string, unknown>) => motorApi.kaynakGuncelle(id, a), [id]);
  return <OzellikFormu baslik={ad} oku={oku} yaz={yaz} onKapat={onKapat} />;
}

function GecisOzellikleri({ tuval, ad, onKapat }: { tuval: string; ad: string; onKapat: () => void }) {
  const oku = useCallback(() => motorApi.gecisOzellikleri(tuval), [tuval]);
  const yaz = useCallback((a: Record<string, unknown>) => motorApi.gecisGuncelle(tuval, a), [tuval]);
  return <OzellikFormu baslik={`Geçiş: ${ad}`} oku={oku} yaz={yaz} onKapat={onKapat} />;
}
