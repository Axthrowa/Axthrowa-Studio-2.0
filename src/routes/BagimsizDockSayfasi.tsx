/**
 * Ayrı pencerede dock (çoklu monitör): `/dock?id=mikser|sahneler|kaynaklar|gecisler|denetimler|hedefler|istatistik|sohbet|etkinlik|deste|tarayici`. Veri ve eylemler ana
 * çalışma alanıyla aynı uçlardan gelir (izin + denetim sunucuda); ayrı pencere yalnız görünüm ve bu dock'un kendi
 * eylemleridir. Motor kapalıyken bilgi gösterir.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  cikisEtkin,
  motorApi,
  type MotorDurumu,
  type MotorSahneOgesi,
  type MotorSahneler,
  type MotorSahneYaniti,
  type MotorSesDurumu,
  type MotorSesKanali,
} from "../lib/api/motor";
import { canliOzeti } from "../lib/broadcast";
import { sahneAgaci } from "../lib/sahneAgaci";
import { KaynaklarDock } from "../components/broadcast/KaynaklarDock";
import { GecislerDock } from "../components/broadcast/GecislerDock";
import { DenetimlerDock } from "../components/broadcast/DenetimlerDock";
import { tuvalleriKaydet } from "../lib/tuvaller";
import { BAGIMSIZ_DOCKLAR, type BagimsizDockKimligi } from "../lib/dockDuzeni";
import { useMotorCanli } from "../lib/motorCanli";
import { clearVisibleInterval, setVisibleInterval } from "../lib/visibleInterval";
import { useBaglamMenusu } from "../components/ui/BaglamMenusu";
import { MikserDock } from "../components/broadcast/MikserDock";
import { SahnelerDock } from "../components/broadcast/SahnelerDock";
import { HedeflerDock, IstatistikDock, useBitHizi } from "../components/broadcast/HedeflerDock";
import { konumuKaydet } from "../lib/projektor";
import { ActivityFeedPanel, UniversalChatPanel } from "../components/control/UniversalChat";
import { DeckPanel } from "../components/control/DeckPanel";
import { TarayiciDock } from "../components/broadcast/TarayiciDock";
import { KliplerDock } from "../components/broadcast/KliplerDock";
import { YayinBilgisiDock } from "../components/broadcast/YayinBilgisiDock";
import "../styles/desktop.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/700.css";
import "../styles/obs-yami.css";

export type { BagimsizDockKimligi };
const GECERLI = BAGIMSIZ_DOCKLAR;
const AD: Record<BagimsizDockKimligi, string> = {
  mikser: "Ses Karıştırıcı",
  sahneler: "Sahneler",
  kaynaklar: "Kaynaklar",
  gecisler: "Sahne Geçişleri",
  denetimler: "Kontroller",
  hedefler: "Hedefler",
  istatistik: "İstatistikler",
  sohbet: "Çoklu Sohbet",
  etkinlik: "Etkinlik Akışı",
  deste: "Hızlı Eylemler",
  tarayici: "Tarayıcı (özel)",
  klipler: "Klipler (Backtrack)",
  yayinbilgisi: "Yayın Bilgisi",
};
/** Motordan bağımsız docklar (Kontrol Merkezi bileşenleri): motor kapalıyken de çalışır */
const MOTORSUZ: BagimsizDockKimligi[] = ["sohbet", "etkinlik", "deste", "tarayici", "klipler", "yayinbilgisi"];

export function dockKimligi(arama: string): BagimsizDockKimligi {
  const id = new URLSearchParams(arama).get("id") as BagimsizDockKimligi | null;
  return id && GECERLI.includes(id) ? id : "mikser";
}

export default function BagimsizDockSayfasi() {
  const id = dockKimligi(window.location.search);
  const [d, setD] = useState<MotorDurumu | null>(null);
  const [sl, setSl] = useState<MotorSahneler | null>(null);
  const [ses, setSes] = useState<MotorSesDurumu | null>(null);
  const [sahne, setSahne] = useState<MotorSahneYaniti | null>(null);
  const [secim, setSecim] = useState<string[]>([]);
  const [acikGruplar, setAcikGruplar] = useState<Set<string>>(new Set());
  /** Geri alınamaz eylemler (yayını bitir, öğe kaldır) bu pencerede de açık onay ister */
  const [onay, setOnay] = useState<{ metin: string; eylem: string; yap: () => void } | null>(null);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const menu = useBaglamMenusu();
  const calisiyor = !!d?.calisiyor;
  const canli = useMotorCanli(calisiyor && id === "mikser", { seviye: true, kare: null });
  const bitHizi = useBitHizi(d?.istatistik as never);

  const yenile = useCallback(async () => {
    try {
      const x = await motorApi.durum();
      setD(x);
      if (!x.calisiyor) return;
      if (id === "mikser") setSes(await motorApi.ses());
      if (id === "sahneler" || id === "kaynaklar" || id === "gecisler" || id === "denetimler" || id === "hedefler") {
        const s = await motorApi.sahneler();
        setSl(s);
        tuvalleriKaydet(s.tuvaller);
        if (id === "kaynaklar") {
          // Ana tuvalin etkin sahnesi: Studio Mode'da önizleme, değilse program (ana pencereyle aynı kural)
          const hedef = Object.prototype.hasOwnProperty.call(s.studyo, "ana") ? (s.studyo.ana ?? s.program.ana) : s.program.ana;
          setSahne(hedef ? await motorApi.sahneDetay(hedef) : null);
        }
      }
    } catch {
      /* sunucu yeniden başlıyor olabilir */
    }
  }, [id]);
  useEffect(() => {
    document.title = `${AD[id]} — Yayın`;
    void yenile();
    const t = setVisibleInterval(() => void yenile(), 1000);
    // Konum periyodik ve kapanırken kaydedilir (bir sonraki açılışta aynı yerde, ekran yoksa ana monitörde)
    const k = window.setInterval(() => void konumuKaydet(`dock-${id}`), 5000);
    const kapanis = () => void konumuKaydet(`dock-${id}`);
    window.addEventListener("beforeunload", kapanis);
    return () => {
      clearVisibleInterval(t);
      window.clearInterval(k);
      window.removeEventListener("beforeunload", kapanis);
    };
  }, [id, yenile]);

  const yap = async (f: () => Promise<unknown>) => {
    try {
      await f();
    } catch (e) {
      setMesaj(String((e as Error).message || e).slice(0, 200));
      window.setTimeout(() => setMesaj(null), 5000);
    }
    void yenile();
  };
  const sesAyarla = (k: MotorSesKanali, eylem: "ses" | "sessiz" | "izleme" | "izler" | "mono", deger: number | boolean) =>
    void yap(() => motorApi.sesAyarla(k.id, eylem, deger));
  const tuval = "ana";
  const studyo = !!sl && Object.prototype.hasOwnProperty.call(sl.studyo, tuval);
  const ogeler = useMemo(() => sahne?.ogeler ?? [], [sahne]);
  const agac = useMemo(() => sahneAgaci(ogeler), [ogeler]);
  const sahneAdi = sl?.sahneler.find((s) => s.id === sahne?.sahne)?.ad ?? null;
  const anaPencerede = (ne: string) => () => setMesaj(`${ne} ana pencerede`);
  const ogeDegistir = (o: MotorSahneOgesi, donusum: { gorunur?: boolean; kilit?: boolean }) =>
    void yap(() => motorApi.ogeIslem({ eylem: "donustur", oge: o.oge, donusum }));
  const ogeTasi = (o: MotorSahneOgesi, yon: "yukari" | "asagi" | "en_ust" | "en_alt") => void yap(() => motorApi.ogeIslem({ eylem: "sira", oge: o.oge, yon }));
  const kaldirOnayi = (liste: MotorSahneOgesi[]) => {
    if (!liste.length) return;
    setOnay({
      metin: `${liste.map((o) => `«${o.ad ?? o.kaynak}»`).join(", ")} bu sahneden kaldırılsın mı? (Bu pencerede geri alınamaz; kaynaklar koleksiyonda kalır.)`,
      eylem: "Kaldır",
      yap: () =>
        void yap(async () => {
          for (const o of liste) await motorApi.ogeIslem({ eylem: "kaldir", oge: o.oge });
          setSecim([]);
        }),
    });
  };
  const ozet = d ? canliOzeti(d) : { canli: 0, toplam: 0 };
  const kayitta = d ? cikisEtkin(d.kayit.durum) : false;
  const tekrarAcik = d ? cikisEtkin(d.tekrar.durum) : false;
  const sanalKameraAcik = d?.sanalKamera ? cikisEtkin(d.sanalKamera.durum) : false;

  const toast = (m: string) => {
    setMesaj(m.slice(0, 200));
    window.setTimeout(() => setMesaj(null), 5000);
  };
  let icerik: React.ReactNode;
  if (MOTORSUZ.includes(id))
    icerik = (
      <div className="h-full overflow-auto p-1.5">
        {id === "sohbet" ? (
          <UniversalChatPanel onToast={toast} />
        ) : id === "etkinlik" ? (
          <ActivityFeedPanel onToast={toast} />
        ) : id === "tarayici" ? (
          <TarayiciDock onToast={toast} />
        ) : id === "klipler" ? (
          <KliplerDock onToast={toast} />
        ) : id === "yayinbilgisi" ? (
          <YayinBilgisiDock onToast={toast} />
        ) : (
          <DeckPanel onToast={toast} />
        )}
      </div>
    );
  else if (!d) icerik = <p className="p-3 text-[12px] dt-soluk">Bağlanıyor…</p>;
  else if (!calisiyor) icerik = <p className="p-3 text-[12px] dt-soluk">Yayın motoru kapalı. Ana penceredeki Yayın sekmesinden başlatın.</p>;
  else if (id === "mikser")
    icerik = (
      <MikserDock
        ses={ses}
        seviyeler={canli.seviyeler}
        canliBagli={canli.bagli}
        eylem={{
          ses: (k, c) => sesAyarla(k, "ses", c),
          sessiz: (k) => sesAyarla(k, "sessiz", !k.sessiz),
          medya: (k, e) => void yap(() => motorApi.medya(k.id, e)),
          menu: menu.ac,
          gelismis: () => setMesaj("Gelişmiş ses özellikleri ana pencerede (Düzen menüsü)"),
          filtreler: () => setMesaj("Filtreler ana pencerede (kaynağın bağlam menüsü)"),
          ozellikler: () => setMesaj("Özellikler ana pencerede"),
          izleme: (k, t) => sesAyarla(k, "izleme", t),
          izler: (k, m) => (m === 0 ? setMesaj("En az bir iz açık kalmalı") : sesAyarla(k, "izler", m)),
          mono: (k) => sesAyarla(k, "mono", !k.mono),
          ciftSes: (c, karar) => void yap(() => motorApi.ciftSes(c.uygulama, c.masaustu, karar)),
        }}
      />
    );
  else if (id === "sahneler")
    icerik = (
      <SahnelerDock
        sahneler={(sl?.sahneler ?? []).filter((s) => s.tuval === tuval)}
        tumSahneler={sl?.sahneler ?? []}
        program={sl?.program[tuval]}
        onizleme={studyo ? (sl?.studyo[tuval] ?? null) : undefined}
        studyo={studyo}
        secili={studyo ? (sl?.studyo[tuval] ?? null) : (sl?.program[tuval] ?? null)}
        gecisTurleri={sl?.gecisTurleri ?? []}
        eylem={{
          sec: (s) => void yap(() => (studyo ? motorApi.studyo(tuval, "onizleme", { sahne: s }) : motorApi.program(s))),
          programa: (s) =>
            void yap(async () =>
              studyo ? (await motorApi.studyo(tuval, "onizleme", { sahne: s }), await motorApi.studyo(tuval, "gecis")) : await motorApi.program(s)
            ),
          ekle: () => setMesaj("Sahne eklemek için ana pencereyi kullanın"),
          sil: () => setMesaj("Sahne silmek için ana pencereyi kullanın"),
          adlandir: () => setMesaj("Yeniden adlandırmak için ana pencereyi kullanın"),
          cogalt: (s) => void yap(() => motorApi.sahneIslem({ eylem: "cogalt", id: s.id })),
          sirala: (ids) => void yap(() => motorApi.sahneIslem({ eylem: "sirala", sira: ids })),
          gecisGecersiz: (s, g) => void yap(() => motorApi.sahneIslem({ eylem: "gecis", id: s.id, gecis: g })),
          menuAc: menu.ac,
        }}
      />
    );
  else if (id === "kaynaklar")
    icerik = (
      <KaynaklarDock
        sahneAdi={sahneAdi}
        agac={agac}
        eksikler={sahne?.eksikler ?? []}
        secim={secim}
        acikGruplar={acikGruplar}
        eylem={{
          sec: (o, kip) => setSecim((s) => (kip === "ekle" ? (s.includes(o) ? s.filter((x) => x !== o) : [...s, o]) : [o])),
          grupAcKapa: (o) =>
            setAcikGruplar((s) => {
              const y = new Set(s);
              if (y.has(o)) y.delete(o);
              else y.add(o);
              return y;
            }),
          gorunurluk: (o) => ogeDegistir(o, { gorunur: !o.gorunur }),
          kilit: (o) => ogeDegistir(o, { kilit: !o.kilit }),
          menu: (e, o) =>
            menu.ac(e, [
              { etiket: o.gorunur ? "Gizle" : "Göster", eylem: () => ogeDegistir(o, { gorunur: !o.gorunur }) },
              { etiket: o.kilit ? "Kilidi aç" : "Kilitle", eylem: () => ogeDegistir(o, { kilit: !o.kilit }) },
              "ayirici",
              { etiket: "Sıra › Yukarı", eylem: () => ogeTasi(o, "yukari") },
              { etiket: "Sıra › Aşağı", eylem: () => ogeTasi(o, "asagi") },
              { etiket: "Sıra › En üste", eylem: () => ogeTasi(o, "en_ust") },
              { etiket: "Sıra › En alta", eylem: () => ogeTasi(o, "en_alt") },
              "ayirici",
              { etiket: "Kaldır…", tehlikeli: true, eylem: () => kaldirOnayi([o]) },
            ]),
          bosMenu: anaPencerede("Kaynak ekleme"),
          ekleMenusu: anaPencerede("Kaynak ekleme"),
          kaldir: () => kaldirOnayi(secim.map((x) => ogeler.find((o) => o.oge === x)).filter((x): x is MotorSahneOgesi => !!x)),
          ozellikler: anaPencerede("Özellikler"),
          filtreler: anaPencerede("Filtreler"),
          adlandir: anaPencerede("Yeniden adlandırma"),
          tasi: (o, yon) => ogeTasi(o, yon),
          birak: anaPencerede("Sürükleyerek sıralama"),
          eksikMenu: anaPencerede("Eksik eklenti işlemleri"),
        }}
      />
    );
  else if (id === "gecisler")
    icerik = (
      <GecislerDock
        gecis={sl?.gecisler[tuval]}
        adliGecisler={sl?.adliGecisler ?? []}
        secili={sl?.seciliGecis?.[tuval]}
        studyo={studyo}
        meşgul={false}
        onSec={(g) => void yap(() => motorApi.gecisListesi({ eylem: "sec", id: g, tuval }))}
        onEkle={anaPencerede("Geçiş ekleme")}
        onSil={anaPencerede("Geçiş kaldırma")}
        onAdlandir={anaPencerede("Geçiş adlandırma")}
        onSure={(ms) => void yap(() => motorApi.gecisAyarla(tuval, sl?.gecisler[tuval]?.tur ?? "fade_transition", ms))}
        onOzellikler={anaPencerede("Geçiş özellikleri")}
        onGecis={() => void yap(() => motorApi.studyo(tuval, "gecis"))}
        menuAc={menu.ac}
      />
    );
  else if (id === "denetimler")
    icerik = (
      <DenetimlerDock
        canli={ozet.canli}
        canliToplam={ozet.toplam}
        kayitta={kayitta}
        duraklatildi={!!d.kayit.duraklatildi}
        sanalKamera={sanalKameraAcik}
        tekrarAcik={tekrarAcik}
        studyo={studyo}
        meşgul={false}
        // Yayına geçiş ön kontrol penceresinden geçer (ana pencere); bitirmek burada da onaylıdır
        onYayin={
          ozet.canli > 0
            ? () =>
                setOnay({
                  metin: "Tüm motor hedefleri durdurulsun mu? Kayıt ve tekrar arabelleği sürer.",
                  eylem: "Yayını bitir",
                  yap: () => void yap(() => motorApi.golive("durdur")),
                })
            : anaPencerede("Yayına geçiş (ön kontrol)")
        }
        onKayit={() => void yap(() => motorApi.kayit(kayitta ? "durdur" : "baslat"))}
        onDuraklat={() => void yap(() => motorApi.kayit(d.kayit.duraklatildi ? "surdur" : "duraklat"))}
        onBol={() => void yap(() => motorApi.kayit("bol"))}
        onSanalKamera={() => void yap(() => motorApi.sanalKamera(sanalKameraAcik ? "durdur" : "baslat", tuval))}
        onTekrar={() => void yap(() => motorApi.tekrar(tekrarAcik ? "kapat" : "ac"))}
        onTekrarKaydet={() => void yap(() => motorApi.tekrar("kaydet"))}
        onStudyo={() => void yap(() => motorApi.studyo(tuval, studyo ? "kapat" : "ac"))}
        onAyarlar={anaPencerede("Ayarlar")}
        onMotorDurdur={anaPencerede("Motoru durdurma")}
      />
    );
  else if (id === "hedefler")
    icerik = (
      <HedeflerDock
        d={d}
        tuvaller={sl?.tuvaller?.map((t) => t.id) ?? (d.dikey ? ["ana", "dikey"] : ["ana"])}
        mesgul={false}
        bitHizi={bitHizi}
        onBaslat={(h, t, iz) => void yap(() => motorApi.hedef(h, "baslat", t, iz))}
        onDurdur={(h) => void yap(() => motorApi.hedef(h, "durdur"))}
      />
    );
  else icerik = <IstatistikDock d={d} bitHizi={bitHizi} />;

  return (
    <div className="obs-yami flex h-screen flex-col p-1">
      <div className="min-h-0 flex-1">{icerik}</div>
      {onay && (
        <div className="dt-durum-cubugu flex items-center gap-2" role="alertdialog" aria-label="Onay">
          <span className="min-w-0 flex-1">{onay.metin}</span>
          <button
            type="button"
            className="dt-btn-danger"
            onClick={() => {
              onay.yap();
              setOnay(null);
            }}
          >
            {onay.eylem}
          </button>
          <button type="button" className="dt-btn" onClick={() => setOnay(null)}>
            Vazgeç
          </button>
        </div>
      )}
      {mesaj && (
        <div className="dt-durum-cubugu" role="status">
          {mesaj}
        </div>
      )}
      {menu.menu}
    </div>
  );
}
