import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import PanelPage from "./routes/panel/PanelPage";
import StartingPage from "./routes/starting/StartingPage";
import EndingPage from "./routes/ending/EndingPage";
import BrbPage from "./routes/brb/BrbPage";
import ChatPage from "./routes/chat/ChatPage";
import SfxPage from "./routes/sfx/SfxPage";
import GoalPage from "./routes/widgets/GoalPage";
import LabelPage from "./routes/widgets/LabelPage";
import PollPage from "./routes/widgets/PollPage";
import ActivityFeedPage from "./routes/widgets/ActivityFeedPage";
import SubathonPage from "./routes/widgets/SubathonPage";
import ViewerCountPage from "./routes/widgets/ViewerCountPage";
import EmoteComboPage from "./routes/widgets/EmoteComboPage";
import ShoutoutPage from "./routes/widgets/ShoutoutPage";
import WheelPage from "./routes/widgets/WheelPage";
import HypeTrainPage from "./routes/widgets/HypeTrainPage";
import NowPlayingWidgetPage from "./routes/widgets/NowPlayingWidgetPage";
import RedeemOverlayPage from "./routes/widgets/RedeemOverlayPage";
import GiveawayPage from "./routes/widgets/GiveawayPage";
import CupPage from "./routes/widgets/CupPage";
import OnScreenEmotesPage from "./routes/widgets/OnScreenEmotesPage";
import TtsPage from "./routes/widgets/TtsPage";
import EndCreditsWidgetPage from "./routes/widgets/EndCreditsWidgetPage";
import OAuthCallbackPage from "./routes/oauth/OAuthCallbackPage";
import WidgetOverlay from "./routes/widgets/WidgetOverlay";
import OverlayAlertsPage from "./routes/overlay/OverlayAlertsPage";
import OverlayWidgetRedirect from "./routes/overlay/OverlayWidgetRedirect";
import MasterOverlay from "./routes/overlay/MasterOverlay";
import RemoteLoginPage from "./routes/remote/RemoteLoginPage";
import LoginPage from "./auth/LoginPage";
import ProjektorSayfasi from "./routes/ProjektorSayfasi";
import BagimsizDockSayfasi from "./routes/BagimsizDockSayfasi";

export default function App() {
  const loc = useLocation();
  void loc;
  return (
    <Routes>
      <Route path="/" element={<PanelPage />} />
      <Route path="/panel" element={<PanelPage />} />
      <Route path="/projektor" element={<ProjektorSayfasi />} />
      <Route path="/dock" element={<BagimsizDockSayfasi />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/remote" element={<RemoteLoginPage />} />
      <Route path="/remote/login" element={<RemoteLoginPage />} />
      <Route path="/oauth/twitch" element={<OAuthCallbackPage platform="twitch" />} />
      <Route path="/oauth/youtube" element={<OAuthCallbackPage platform="youtube" />} />
      <Route path="/oauth/discord" element={<OAuthCallbackPage platform="discord" />} />
      <Route path="/overlay/alerts" element={<OverlayAlertsPage />} />
      <Route path="/overlay/master" element={<MasterOverlay />} />
      <Route path="/widgets/master" element={<MasterOverlay />} />
      <Route path="/overlay/widgets/:kind" element={<OverlayWidgetRedirect />} />
      <Route path="/overlay/widgets" element={<OverlayWidgetRedirect />} />
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
  );
}
