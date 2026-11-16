import { lazy, Suspense, useEffect } from "react";

import { useAxthrowaStore } from "./store/useAxthrowaStore";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
const PanelPage = lazy(() => import("./routes/panel/PanelPage"));
const StartingPage = lazy(() => import("./routes/starting/StartingPage"));
const EndingPage = lazy(() => import("./routes/ending/EndingPage"));
const BrbPage = lazy(() => import("./routes/brb/BrbPage"));
const ChatPage = lazy(() => import("./routes/chat/ChatPage"));
const SfxPage = lazy(() => import("./routes/sfx/SfxPage"));
const AltyaziPage = lazy(() => import("./routes/widgets/AltyaziPage"));
const OAuthCallbackPage = lazy(() => import("./routes/oauth/OAuthCallbackPage"));
const MasterOverlay = lazy(() => import("./routes/overlay/MasterOverlay"));
const RemoteLoginPage = lazy(() => import("./routes/remote/RemoteLoginPage"));
const RemotePage = lazy(() => import("./routes/remote/RemotePage"));
const LoginPage = lazy(() => import("./auth/LoginPage"));
const ObsDockSayfasi = lazy(() => import("./routes/ObsDockSayfasi"));
const SagTikMenusu = lazy(() => import("@/components/axthrowa/SagTikMenusu"));

/** Tarayıcı sağ tık menüsünün AxthrowA menüsüyle değiştiği ekranlar (OBS'e verilen overlay sayfaları değil) */
export const PANEL_YOLLARI = new Set(["/", "/panel", "/dock"]);

export default function App() {
  const loc = useLocation();
  // Y15: İngilizce seçiliyse panel sayfaları sözlükten çevrilir (OBS'e verilen sayfalar Türkçe kalır)
  const locale = useAxthrowaStore((s) => s.locale);
  const panelSayfasi = PANEL_YOLLARI.has(loc.pathname) || loc.pathname.startsWith("/remote") || loc.pathname === "/login";
  useEffect(() => {
    if (locale !== "en" || !panelSayfasi) return;
    let durdur: (() => void) | undefined;
    let bitti = false;
    void import("./i18n/domCeviri").then((m) => {
      if (bitti) return;
      m.domCeviriBaslat();
      durdur = m.domCeviriDurdur;
    });
    return () => {
      bitti = true;
      durdur?.();
    };
  }, [locale, panelSayfasi]);
  // Her sayfa kendi parçasını yükler: OBS katmanları (giriş/mola/sohbet…) panelin
  // tamamını (~1,3 MB) indirmesin. Yüklenirken saydam (OBS'te boş kare yok).
  return (
    <Suspense fallback={null}>
    {PANEL_YOLLARI.has(loc.pathname) && <SagTikMenusu />}
    <Routes>
      {/* Eski widget adresleri (/goal, /widgets/poll, /alerts…) sunucuda AxBoT'a yönlenir (WID-0, eski_widgetlar.rs) */}
      <Route path="/" element={<PanelPage />} />
      <Route path="/panel" element={<PanelPage />} />
      <Route path="/dock" element={<ObsDockSayfasi />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/remote" element={<RemotePage />} />
      <Route path="/remote/login" element={<RemoteLoginPage />} />
      <Route path="/oauth/twitch" element={<OAuthCallbackPage platform="twitch" />} />
      <Route path="/oauth/youtube" element={<OAuthCallbackPage platform="youtube" />} />
      <Route path="/oauth/discord" element={<OAuthCallbackPage platform="discord" />} />
      <Route path="/overlay/master" element={<MasterOverlay />} />
      <Route path="/widgets/master" element={<MasterOverlay />} />
      <Route path="/widgets/altyazi" element={<AltyaziPage />} />
      <Route path="/starting" element={<StartingPage />} />
      <Route path="/ending" element={<EndingPage />} />
      <Route path="/brb" element={<BrbPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/sfx" element={<SfxPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
