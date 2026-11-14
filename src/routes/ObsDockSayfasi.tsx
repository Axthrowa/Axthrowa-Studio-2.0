/**
 * OBS özel tarayıcı dock'u: `/dock?id=sohbet|etkinlik|deste|yayinbilgisi|kontrol|muzik|sesler|uyarilar|mikser`.
 * Studio'nun ayrılabilir panelleri (U9, `lib/ayrikPanel`) de bu sayfayı ayrı pencerede açar. OBS Studio › Docklar
 * menüsünde görünür (OBS Studio sekmesi dock'ları OBS'in kullanıcı ayarına yazar). Veri ve eylemler ana panelle aynı
 * uçlardan gelir (izin + denetim sunucuda); dock yalnız görünümdür. Görünüm OBS'in koyu temasına uyar.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { ActivityFeedPanel } from "../components/control/UniversalChat";
import AxBotHost from "../components/panel/AxBotHost";
import { DeckPanel } from "../components/control/DeckPanel";
import { YayinBilgisiDock } from "../components/control/YayinBilgisiDock";
import { API_BASE } from "../lib/api";
import { actionsApi } from "../lib/api/actions";
import { obsControl } from "../lib/obsControl";
import { isAudioInput } from "../lib/obsAudio";
import type { ObsInputInfo } from "../lib/obsControl";
import "../styles/desktop.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/700.css";
import "../styles/obs-yami.css";

const ControlCenter = lazy(() => import("../components/control/ControlCenter"));
const MusicPanel = lazy(() => import("../components/panel/MusicPanel"));
const SoundBoardPanel = lazy(() => import("../components/panel/SoundBoardPanel"));
const UyariKuyrugu = lazy(() => import("../components/control/UyariKuyrugu"));
const SesKaristirici = lazy(() => import("../components/control/SesKaristirici"));

/** Mikser tek başına: girişleri Studio'dan okur, susturma eylem kayıt defterinden (Canlı ekranındakiyle aynı) */
function MikserDock({ onToast }: { onToast: (m: string) => void }) {
  const [girisler, setGirisler] = useState<ObsInputInfo[] | null>(null);
  useEffect(() => {
    let bitti = false;
    const oku = async () => {
      try {
        const st = await obsControl.status();
        const l = st.connected ? (await obsControl.inputs()).filter((i) => isAudioInput(i.kind, i.name)) : null;
        if (!bitti) setGirisler(l);
      } catch {
        if (!bitti) setGirisler(null);
      }
    };
    void oku();
    const t = window.setInterval(() => void oku(), 2000);
    return () => {
      bitti = true;
      window.clearInterval(t);
    };
  }, []);
  const sustur = async (g: ObsInputInfo) => {
    const hedef = !g.muted;
    setGirisler((l) => l && l.map((i) => (i.name === g.name ? { ...i, muted: hedef } : i)));
    try {
      await actionsApi.run(hedef ? "audio.mute" : "audio.unmute", { input: g.name });
    } catch (e) {
      setGirisler((l) => l && l.map((i) => (i.name === g.name ? { ...i, muted: !hedef } : i)));
      onToast(`${g.name}: ${String((e as Error).message || e).slice(0, 160)}`);
    }
  };
  if (!girisler) return <p className="p-3 text-[12px] dt-soluk">Ses karıştırıcısı için OBS bağlı değil.</p>;
  return <SesKaristirici girisler={girisler} onSustur={(g) => void sustur(g)} onToast={onToast} />;
}

export const OBS_DOCKLARI = ["sohbet", "etkinlik", "deste", "yayinbilgisi", "kontrol", "muzik", "sesler", "uyarilar", "mikser"] as const;
export type ObsDockKimligi = (typeof OBS_DOCKLARI)[number];

const AD: Record<ObsDockKimligi, string> = {
  sohbet: "Çoklu Sohbet",
  etkinlik: "Etkinlik Akışı",
  deste: "Hızlı Eylemler",
  yayinbilgisi: "Yayın Bilgisi",
  kontrol: "Kontrol Merkezi",
  muzik: "Müzik",
  sesler: "Ses Paneli",
  uyarilar: "Uyarı Kuyruğu",
  mikser: "Ses Karıştırıcısı",
};

export function dockKimligi(arama: string): ObsDockKimligi {
  const id = new URLSearchParams(arama).get("id");
  return (OBS_DOCKLARI as readonly string[]).includes(id ?? "") ? (id as ObsDockKimligi) : "sohbet";
}

export default function ObsDockSayfasi() {
  const id = dockKimligi(window.location.search);
  const [mesaj, setMesaj] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${AD[id]} — AxthrowA Studio`;
  }, [id]);

  const toast = (m: string) => {
    setMesaj(m.slice(0, 200));
    window.setTimeout(() => setMesaj(null), 5000);
  };

  let icerik: React.ReactNode;
  switch (id) {
    case "sohbet":
      icerik = <AxBotHost onToast={toast} tab="multichat" embed />;
      break;
    case "etkinlik":
      icerik = <ActivityFeedPanel onToast={toast} />;
      break;
    case "deste":
      icerik = <DeckPanel onToast={toast} />;
      break;
    case "yayinbilgisi":
      icerik = <YayinBilgisiDock onToast={toast} />;
      break;
    case "kontrol":
      icerik = <ControlCenter onToast={toast} />;
      break;
    case "muzik":
      icerik = (
        <MusicPanel
          baseUrl={API_BASE || window.location.origin}
          onToast={toast}
          onOpenExternal={(url) => void window.open(url, "_blank", "noopener")}
        />
      );
      break;
    case "sesler":
      icerik = <SoundBoardPanel onToast={toast} />;
      break;
    case "uyarilar":
      icerik = <UyariKuyrugu onToast={toast} />;
      break;
    case "mikser":
      icerik = <MikserDock onToast={toast} />;
      break;
  }

  return (
    <>
      <div className="obs-yami flex h-screen flex-col p-1">
        <div className={`min-h-0 flex-1 p-1.5 ${id === "sohbet" ? "flex flex-col overflow-hidden" : "custom-scrollbar overflow-auto"}`}>
          <Suspense fallback={<p className="p-3 text-[12px] dt-soluk">Yükleniyor…</p>}>{icerik}</Suspense>
        </div>
        {mesaj && (
          <div className="dt-durum-cubugu" role="status">
            {mesaj}
          </div>
        )}
      </div>
    </>
  );
}
