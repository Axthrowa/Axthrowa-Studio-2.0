/**
 * Ayrı pencerede dock (çoklu monitör): `/dock?id=mikser|sahneler|hedefler|istatistik|sohbet|etkinlik|deste`. Veri ve eylemler ana
 * çalışma alanıyla aynı uçlardan gelir (izin + denetim sunucuda); ayrı pencere yalnız görünüm ve bu dock'un kendi
 * eylemleridir. Motor kapalıyken bilgi gösterir.
 */
import { useCallback, useEffect, useState } from "react";
import { motorApi, type MotorDurumu, type MotorSahneler, type MotorSesDurumu, type MotorSesKanali } from "../lib/api/motor";
import { useMotorCanli } from "../lib/motorCanli";
import { clearVisibleInterval, setVisibleInterval } from "../lib/visibleInterval";
import { useBaglamMenusu } from "../components/ui/BaglamMenusu";
import { MikserDock } from "../components/broadcast/MikserDock";
import { SahnelerDock } from "../components/broadcast/SahnelerDock";
import { HedeflerDock, IstatistikDock, useBitHizi } from "../components/broadcast/HedeflerDock";
import { konumuKaydet } from "../lib/projektor";
import { ActivityFeedPanel, UniversalChatPanel } from "../components/control/UniversalChat";
import { DeckPanel } from "../components/control/DeckPanel";
import "../styles/desktop.css";

export type BagimsizDockKimligi = "mikser" | "sahneler" | "hedefler" | "istatistik" | "sohbet" | "etkinlik" | "deste";
const GECERLI: BagimsizDockKimligi[] = ["mikser", "sahneler", "hedefler", "istatistik", "sohbet", "etkinlik", "deste"];
const AD: Record<BagimsizDockKimligi, string> = {
  mikser: "Ses Mikseri",
  sahneler: "Sahneler",
  hedefler: "Hedefler",
  istatistik: "İstatistikler",
  sohbet: "Çoklu Sohbet",
  etkinlik: "Etkinlik Akışı",
  deste: "Hızlı Eylemler",
};
/** Motordan bağımsız docklar (Kontrol Merkezi bileşenleri): motor kapalıyken de çalışır */
const MOTORSUZ: BagimsizDockKimligi[] = ["sohbet", "etkinlik", "deste"];

export function dockKimligi(arama: string): BagimsizDockKimligi {
  const id = new URLSearchParams(arama).get("id") as BagimsizDockKimligi | null;
  return id && GECERLI.includes(id) ? id : "mikser";
}

export default function BagimsizDockSayfasi() {
  const id = dockKimligi(window.location.search);
  const [d, setD] = useState<MotorDurumu | null>(null);
  const [sl, setSl] = useState<MotorSahneler | null>(null);
  const [ses, setSes] = useState<MotorSesDurumu | null>(null);
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
      if (id === "sahneler") setSl(await motorApi.sahneler());
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
  const sesAyarla = (k: MotorSesKanali, eylem: "ses" | "sessiz" | "izleme" | "izler" | "mono", deger: number | boolean) => void yap(() => motorApi.sesAyarla(k.id, eylem, deger));
  const tuval = "ana";
  const studyo = !!sl && Object.prototype.hasOwnProperty.call(sl.studyo, tuval);

  const toast = (m: string) => {
    setMesaj(m.slice(0, 200));
    window.setTimeout(() => setMesaj(null), 5000);
  };
  let icerik: React.ReactNode;
  if (MOTORSUZ.includes(id))
    icerik = (
      <div className="h-full overflow-auto p-1.5">
        {id === "sohbet" ? <UniversalChatPanel onToast={toast} /> : id === "etkinlik" ? <ActivityFeedPanel onToast={toast} /> : <DeckPanel onToast={toast} />}
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
          programa: (s) => void yap(async () => (studyo ? (await motorApi.studyo(tuval, "onizleme", { sahne: s }), await motorApi.studyo(tuval, "gecis")) : await motorApi.program(s))),
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
  else if (id === "hedefler")
    icerik = (
      <HedeflerDock
        d={d}
        tuvaller={d.dikey ? ["ana", "dikey"] : ["ana"]}
        mesgul={false}
        bitHizi={bitHizi}
        onBaslat={(h, t, iz) => void yap(() => motorApi.hedef(h, "baslat", t, iz))}
        onDurdur={(h) => void yap(() => motorApi.hedef(h, "durdur"))}
      />
    );
  else icerik = <IstatistikDock d={d} bitHizi={bitHizi} />;

  return (
    <div className="flex h-screen flex-col p-1 text-[13px]" style={{ background: "var(--panel-bg, #0f1115)", color: "var(--dt-text)" }}>
      <div className="min-h-0 flex-1">{icerik}</div>
      {mesaj && (
        <div className="dt-durum-cubugu" role="status">
          {mesaj}
        </div>
      )}
      {menu.menu}
    </div>
  );
}
