import { lazy, Suspense, useEffect } from "react";
import { useAxthrowaStore } from "./store/useAxthrowaStore";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
const PanelPage = lazy(() => import("./routes/panel/PanelPage"));
const StartingPage = lazy(() => import("./routes/starting/StartingPage"));
const EndingPage = lazy(() => import("./routes/ending/EndingPage"));
const BrbPage = lazy(() => import("./routes/brb/BrbPage"));
const ChatPage = lazy(() => import("./routes/chat/ChatPage"));
const SfxPage = lazy(() => import("./routes/sfx/SfxPage"));
const GoalPage = lazy(() => import("./routes/widgets/GoalPage"));
const LabelPage = lazy(() => import("./routes/widgets/LabelPage"));
const PollPage = lazy(() => import("./routes/widgets/PollPage"));
const ActivityFeedPage = lazy(() => import("./routes/widgets/ActivityFeedPage"));
const SubathonPage = lazy(() => import("./routes/widgets/SubathonPage"));
const ViewerCountPage = lazy(() => import("./routes/widgets/ViewerCountPage"));
const EmoteComboPage = lazy(() => import("./routes/widgets/EmoteComboPage"));
const ShoutoutPage = lazy(() => import("./routes/widgets/ShoutoutPage"));
const AltyaziPage = lazy(() => import("./routes/widgets/AltyaziPage"));
const WheelPage = lazy(() => import("./routes/widgets/WheelPage"));
const HypeTrainPage = lazy(() => import("./routes/widgets/HypeTrainPage"));
const NowPlayingWidgetPage = lazy(() => import("./routes/widgets/NowPlayingWidgetPage"));
const RedeemOverlayPage = lazy(() => import("./routes/widgets/RedeemOverlayPage"));
const GiveawayPage = lazy(() => import("./routes/widgets/GiveawayPage"));
const CupPage = lazy(() => import("./routes/widgets/CupPage"));
const OnScreenEmotesPage = lazy(() => import("./routes/widgets/OnScreenEmotesPage"));
const TtsPage = lazy(() => import("./routes/widgets/TtsPage"));
const EndCreditsWidgetPage = lazy(() => import("./routes/widgets/EndCreditsWidgetPage"));
const OAuthCallbackPage = lazy(() => import("./routes/oauth/OAuthCallbackPage"));
const WidgetOverlay = lazy(() => import("./routes/widgets/WidgetOverlay"));
const OverlayAlertsPage = lazy(() => import("./routes/overlay/OverlayAlertsPage"));
const OverlayWidgetRedirect = lazy(() => import("./routes/overlay/OverlayWidgetRedirect"));
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
      <Route path="/" element={<PanelPage />} />
      <Route path="/panel" element={<PanelPage />} />
      <Route path="/dock" element={<ObsDockSayfasi />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/remote" element={<RemotePage />} />
      <Route path="/remote/login" element={<RemoteLoginPage />} />
      <Route path="/oauth/twitch" element={<OAuthCallbackPage platform="twitch" />} />
      <Route path="/oauth/youtube" element={<OAuthCallbackPage platform="youtube" />} />
      <Route path="/oauth/discord" element={<OAuthCallbackPage platform="discord" />} />
      <Route path="/overlay/alerts" element={<OverlayAlertsPage />} />
      <Route path="/overlay/master" element={<MasterOverlay />} />
      <Route path="/widgets/master" element={<MasterOverlay />} />
      <Route path="/overlay/widgets/:kind" element={<OverlayWidgetRedirect />} />
      <Route path="/overlay/widgets" element={<OverlayWidgetRedirect />} />
      <Route path="/widgets/altyazi" element={<AltyaziPage />} />
      <Route path="/widgets/:kind" element={<WidgetOverlay />} />
      <Route path="/widgets" element={<WidgetOverlay />} />
      <Route path="/starting" element={<StartingPage />} />
      <Route path="/ending" element={<EndingPage />} />
      <Route path="/brb" element={<BrbPage />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/sfx" element={<SfxPage />} />
      <Route path="/alerts" element={<OverlayAlertsPage />} />
      <Route path="/goal" element={<GoalPage />} />
      <Route path="/label" element={<LabelPage />} />
      <Route path="/poll" element={<PollPage />} />
      <Route path="/activity" element={<ActivityFeedPage />} />
      <Route path="/activityfeed" element={<ActivityFeedPage />} />
      <Route path="/subathon" element={<SubathonPage />} />
      <Route path="/viewers" element={<ViewerCountPage />} />
      <Route path="/emote-combo" element={<EmoteComboPage />} />
      <Route path="/emotecombo" element={<EmoteComboPage />} />
      <Route path="/emotewall" element={<OnScreenEmotesPage />} />
      <Route path="/emotes" element={<OnScreenEmotesPage />} />
      <Route path="/shoutout" element={<ShoutoutPage />} />
      <Route path="/shoutouts" element={<ShoutoutPage />} />
      <Route path="/wheel" element={<WheelPage />} />
      <Route path="/fortunewheel" element={<WheelPage />} />
      <Route path="/hype" element={<HypeTrainPage />} />
      <Route path="/hypetrain" element={<HypeTrainPage />} />
      <Route path="/now-playing" element={<NowPlayingWidgetPage />} />
      <Route path="/songrequest" element={<NowPlayingWidgetPage />} />
      <Route path="/redeems" element={<RedeemOverlayPage />} />
      <Route path="/giveaway" element={<GiveawayPage />} />
      <Route path="/raffles" element={<GiveawayPage />} />
      <Route path="/cup" element={<CupPage />} />
      <Route path="/glass" element={<CupPage />} />
      <Route path="/tts" element={<TtsPage />} />
      <Route path="/cloudtts" element={<TtsPage />} />
      <Route path="/moviecredits" element={<EndCreditsWidgetPage />} />
      <Route path="/credits" element={<EndCreditsWidgetPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
