import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Link2,
  Terminal,
  Clock,
  ShieldCheck,
  Music,
  Coins,
  Gift,
  MessageSquare,
  Layers,
  Sparkles,
  Settings as SettingsIcon,
  ExternalLink,
  ChevronRight,
  Gamepad2,
  Volume2,
  ShieldAlert,
  DollarSign,
  HelpCircle,
  Bell,
  BarChart3,
  Trophy
} from 'lucide-react';

// Pages
import Dashboard from './pages/Dashboard.js';
import Platforms from './pages/Platforms.js';
import Commands from './pages/Commands.js';
import Timers from './pages/Timers.js';
import AutoMod from './pages/AutoMod.js';
import SongRequest from './pages/SongRequest.js';
import Economy from './pages/Economy.js';
import MiniGames from './pages/MiniGames.js';
import TriviaStudio from './pages/TriviaStudio.js';
import Giveaways from './pages/Giveaways.js';
import MultiChat from './pages/MultiChat.js';
import OverlayStudio from './pages/OverlayStudio.js';
import AISettings from './pages/AISettings.js';
import Settings from './pages/Settings.js';
import TTSManager from './pages/TTSManager.js';
import ShieldAndAudit from './pages/ShieldAndAudit.js';
import DonationsAndJumpScare from './pages/DonationsAndJumpScare.js';
import AlertsStudio from './pages/AlertsStudio.js';
import PollsStudio from './pages/PollsStudio.js';
import Extras from './pages/Extras.js';
import Rankings from './pages/Rankings.js';

// OBS Widgets
import TriviaWidget from './widgets/TriviaWidget.js';
import AlertBoxWidget from './widgets/AlertBoxWidget.js';
import ChatBoxWidget from './widgets/ChatBoxWidget.js';
import GoalWidget from './widgets/GoalWidget.js';
import WheelWidget from './widgets/WheelWidget.js';
import AudioPlayerWidget from './widgets/AudioPlayerWidget.js';
import EmoteComboWidget from './widgets/EmoteComboWidget.js';
import SubathonWidget from './widgets/SubathonWidget.js';
import HypeTrainWidget from './widgets/HypeTrainWidget.js';
import EventLabelsWidget from './widgets/EventLabelsWidget.js';
import NowPlayingWidget from './widgets/NowPlayingWidget.js';
import PollsWidget from './widgets/PollsWidget.js';
import ShoutoutWidget from './widgets/ShoutoutWidget.js';
import TheCupWidget from './widgets/TheCupWidget.js';
import EndCreditsWidget from './widgets/EndCreditsWidget.js';
import PinnedMessageWidget from './widgets/PinnedMessageWidget.js';
import LoyaltyStoreWidget from './widgets/LoyaltyStoreWidget.js';
import LyricsWidget from './widgets/LyricsWidget.js';
import JumpScareWidget from './widgets/JumpScareWidget.js';
import KingWidget from './widgets/KingWidget.js';
import { UnifiedOverlayWidget } from './widgets/UnifiedOverlayWidget.js';
import ViewerCounterWidget from './widgets/ViewerCounterWidget.js';
import ActivityFeedWidget from './widgets/ActivityFeedWidget.js';
import GiveawayWidget from './widgets/GiveawayWidget.js';
import RankingsWidget from './widgets/RankingsWidget.js';
import BotAdvanced from './pages/BotAdvanced.js';
import Interaction from './pages/Interaction.js';
import Integrations from './pages/Integrations.js';
import { ToastSaglayici } from './ui/index.js';
import { BRAND } from './brand.js';
import { openLink } from './lib/openLink.js';

export function App() {
  const path = window.location.pathname;

  // Render standalone OBS widgets when visiting /widgets/*
  if (path === '/widgets/overlay' || path === '/overlay') return <UnifiedOverlayWidget />;
  if (path === '/widgets/alertbox') return <AlertBoxWidget />;
  if (path === '/widgets/chatbox') return <ChatBoxWidget />;
  if (path === '/widgets/goals' || path === '/widgets/donation-goal' || path === '/widgets/follower-goal' || path === '/widgets/subscriber-goal' || path === '/widgets/kicks-goal') return <GoalWidget />;
  if (path === '/widgets/giveaways') return <GiveawayWidget />;
  if (path === '/widgets/rankings') return <RankingsWidget />;
  if (path === '/widgets/wheel') return <WheelWidget />;
  if (path === '/widgets/audio-player') return <AudioPlayerWidget />;
  if (path === '/widgets/emote-combo') return <EmoteComboWidget />;
  if (path === '/widgets/subathon') return <SubathonWidget />;
  if (path === '/widgets/hype-train') return <HypeTrainWidget />;
  if (path === '/widgets/event-labels') return <EventLabelsWidget />;
  if (path === '/widgets/now-playing') return <NowPlayingWidget />;
  if (path === '/widgets/polls') return <PollsWidget />;
  if (path === '/widgets/shoutout') return <ShoutoutWidget />;
  if (path === '/widgets/the-cup') return <TheCupWidget />;
  if (path === '/widgets/credits') return <EndCreditsWidget />;
  if (path === '/widgets/pinned') return <PinnedMessageWidget />;
  if (path === '/widgets/loyalty-redeem') return <LoyaltyStoreWidget />;
  if (path === '/widgets/lyrics') return <LyricsWidget />;
  if (path === '/widgets/jumpscare') return <JumpScareWidget />;
  if (path === '/widgets/king') return <KingWidget />;
  if (path === '/widgets/trivia' || path === '/trivia' || path === '/trivia-overlay') return <TriviaWidget />;
  if (path === '/widgets/viewer-counter') return <ViewerCounterWidget />;
  if (path === '/widgets/activity-feed') return <ActivityFeedWidget />;
  if (path === '/widgets/emotes' || path === '/widgets/on-screen-emotes') return <EmoteComboWidget />;

  // Otherwise, render full StreamAxT Dashboard
  const [activeTab, setActiveTab] = useState('dashboard');
  // Tarayıcı geri/ileri tuşu (B7): sekme adresteki #sekme ile eşlenir.
  // NOT: yukarıdaki useState satırı BİLEREK değiştirilmedi — panel kabuğunun
  // hazırlama betiği (streamaxt-hazirla.mjs) o satırı birebir arayıp gömme
  // yamasını uyguluyor. Bu etkiler yama uygulansa da uygulanmasa da çalışır.
  useEffect(() => {
    const ilk = window.location.hash.replace('#', '');
    if (ilk) setActiveTab(ilk);
    const geri = () => setActiveTab(window.location.hash.replace('#', '') || 'dashboard');
    window.addEventListener('popstate', geri);
    return () => window.removeEventListener('popstate', geri);
  }, []);
  useEffect(() => {
    const hedef = `#${activeTab}`;
    if (window.location.hash !== hedef) window.history.pushState(null, '', hedef);
  }, [activeTab]);
  const [focusPlatform, setFocusPlatform] = useState<string | null>(null);

  const navItems = [
    { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'platforms', label: 'Platformlar', icon: Link2, badge: '6 Platform' },
    { id: 'multichat', label: 'Canlı Multi-Chat', icon: MessageSquare, highlight: true },
    { id: 'trivia', label: 'Bil Bakalım', icon: HelpCircle, badge: 'Canlı 🧠', highlight: true },
    { id: 'tts', label: '5-Motorlu TTS', icon: Volume2, badge: 'Yedekli' },
    { id: 'donations', label: 'BynoGame & Bağış', icon: DollarSign, badge: 'JumpScare' },
    { id: 'shield', label: 'Kalkan & Denetim', icon: ShieldAlert, badge: 'Kalkan' },
    { id: 'commands', label: 'Komutlar', icon: Terminal, badge: 'Anahtar kelime' },
    { id: 'timers', label: 'Zamanlayıcılar', icon: Clock },
    { id: 'automod', label: 'Bot Moderasyonu', icon: ShieldCheck },
    { id: 'botadvanced', label: 'Gelişmiş Bot', icon: Sparkles, badge: 'Yeni' },
    { id: 'extras', label: 'Ekstralar', icon: Sparkles, badge: 'Klip/Seviye' },
    { id: 'rankings', label: 'Sıralamalar', icon: Trophy },
    { id: 'alerts', label: 'Uyarılar (Alert Box)', icon: Bell, highlight: true },
    { id: 'polls', label: 'Anketler', icon: BarChart3 },
    { id: 'interaction', label: 'Etkileşim', icon: BarChart3, badge: 'Tahmin/Kuyruk' },
    { id: 'songrequest', label: 'Şarkı İsteği (SR)', icon: Music },
    { id: 'economy', label: 'Sadakat & Ekonomi', icon: Coins },
    { id: 'games', label: 'Chat Oyunları', icon: Gamepad2, badge: '10 Oyun' },
    { id: 'giveaways', label: 'Çekilişler', icon: Gift },
    { id: 'overlays', label: 'OBS Overlay Stüdyo', icon: Layers },
    { id: 'ai', label: 'Gemini AI Asistan', icon: Sparkles },
    { id: 'integrations', label: 'Entegrasyonlar', icon: Link2, badge: 'Discord' },
    { id: 'settings', label: 'Ayarlar', icon: SettingsIcon },
  ];

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard': return (
        <Dashboard
          onConnectPlatform={(platform) => {
            setFocusPlatform(platform);
            setActiveTab('platforms');
          }}
        />
      );
      case 'platforms': return <Platforms focusPlatform={focusPlatform} />;
      case 'multichat': return <MultiChat />;
      case 'trivia': return <TriviaStudio />;
      case 'tts': return <TTSManager />;
      case 'donations': return <DonationsAndJumpScare />;
      case 'shield': return <ShieldAndAudit />;
      case 'commands': return <Commands />;
      case 'timers': return <Timers />;
      case 'automod': return <AutoMod />;
      case 'botadvanced': return <BotAdvanced />;
      case 'interaction': return <Interaction />;
      case 'integrations': return <Integrations />;
      case 'extras': return <Extras />;
      case 'rankings': return <Rankings />;
      case 'alerts': return <AlertsStudio />;
      case 'polls': return <PollsStudio />;
      case 'songrequest': return <SongRequest />;
      case 'economy': return <Economy />;
      case 'games': return <MiniGames />;
      case 'giveaways': return <Giveaways />;
      case 'overlays': return <OverlayStudio />;
      case 'ai': return <AISettings />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };


  return (
    // Toast bildirimleri tum panelde kullanilabilsin (ui/index.tsx).
    <ToastSaglayici>
    <div className="flex min-h-screen bg-[#090b10] text-gray-200">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/10 bg-[#0d1017]/90 backdrop-blur-xl flex flex-col justify-between fixed inset-y-0 left-0 z-30">
        <div>
          {/* Logo & Brand */}
          <div className="p-6 pb-5 flex items-center space-x-3 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30 text-white font-black text-xs tracking-wider">
              {BRAND.short}
            </div>
            <div>
              <div className="font-extrabold text-white text-lg tracking-tight flex items-center gap-1.5">
                {BRAND.name}
              </div>
              <div className="text-[11px] text-purple-400 font-semibold tracking-wider uppercase">
                {BRAND.tagline}
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : item.highlight
                      ? 'bg-white/[0.04] text-purple-300 hover:bg-white/[0.08]'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : item.highlight ? 'text-purple-400' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      isActive ? 'bg-white/20 text-white' : 'bg-purple-500/20 text-purple-300'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Status Info & Watermark */}
        <div className="p-4 border-t border-white/5 bg-black/20 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sistem Aktif
            </span>
            <span className="font-mono text-purple-400">Port 3001</span>
          </div>
          <div className="text-[10px] text-gray-500 text-center font-medium border-t border-white/5 pt-1.5">
            {BRAND.name} • Developed by <span className="text-purple-400 font-bold">{BRAND.author}</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 border-b border-white/10 bg-[#0d1017]/60 backdrop-blur-xl sticky top-0 z-20 px-8 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-gray-400 font-medium">
            <span className="font-bold text-white">{BRAND.name}</span>
            <span className="text-[10px] text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded font-semibold">by {BRAND.author}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-white font-bold capitalize">
              {navItems.find(n => n.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => openLink(`${window.location.origin}/widgets/alertbox`)}
              className="text-xs text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 px-3 py-1.5 rounded-xl transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" /> OBS Alert Önizle
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-8 overflow-y-auto">
          {renderActivePage()}
        </main>
      </div>
    </div>
    </ToastSaglayici>
  );
}

export default App;
