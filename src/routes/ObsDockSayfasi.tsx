/**
 * OBS özel tarayıcı dock'u: `/dock?id=sohbet|etkinlik|deste|yayinbilgisi|kontrol|muzik|sesler`. OBS Studio › Docklar
 * menüsünde görünür (OBS Studio sekmesi dock'ları OBS'in kullanıcı ayarına yazar). Veri ve eylemler ana panelle aynı
 * uçlardan gelir (izin + denetim sunucuda); dock yalnız görünümdür. Görünüm OBS'in koyu temasına uyar.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { ActivityFeedPanel, UniversalChatPanel } from "../components/control/UniversalChat";
import { DeckPanel } from "../components/control/DeckPanel";
import { YayinBilgisiDock } from "../components/control/YayinBilgisiDock";
import { API_BASE } from "../lib/api";
import "../styles/desktop.css";
import "@fontsource/open-sans/400.css";
import "@fontsource/open-sans/700.css";
import "../styles/obs-yami.css";

const ControlCenter = lazy(() => import("../components/control/ControlCenter"));
const MusicPanel = lazy(() => import("../components/panel/MusicPanel"));
const SoundBoardPanel = lazy(() => import("../components/panel/SoundBoardPanel"));

export const OBS_DOCKLARI = ["sohbet", "etkinlik", "deste", "yayinbilgisi", "kontrol", "muzik", "sesler"] as const;
export type ObsDockKimligi = (typeof OBS_DOCKLARI)[number];

const AD: Record<ObsDockKimligi, string> = {
  sohbet: "Çoklu Sohbet",
  etkinlik: "Etkinlik Akışı",
  deste: "Hızlı Eylemler",
  yayinbilgisi: "Yayın Bilgisi",
  kontrol: "Kontrol Merkezi",
  muzik: "Müzik",
  sesler: "Ses Paneli",
};

export function dockKimligi(arama: string): ObsDockKimligi {
  const id = new URLSearchParams(arama).get("id");
  return (OBS_DOCKLARI as readonly string[]).includes(id ?? "") ? (id as ObsDockKimligi) : "sohbet";
}

export default function ObsDockSayfasi() {
  const id = dockKimligi(window.location.search);
  const [mesaj, setMesaj] = useState<string | null>(null);

  useEffect(() => {
    document.title = `${AD[id]} — Yayın Yönetim Aracı`;
  }, [id]);

  const toast = (m: string) => {
    setMesaj(m.slice(0, 200));
    window.setTimeout(() => setMesaj(null), 5000);
  };

  let icerik: React.ReactNode;
  switch (id) {
    case "sohbet":
      icerik = <UniversalChatPanel onToast={toast} />;
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
  }

  return (
    <>
      <div className="obs-yami flex h-screen flex-col p-1">
        <div className="custom-scrollbar min-h-0 flex-1 overflow-auto p-1.5">
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
