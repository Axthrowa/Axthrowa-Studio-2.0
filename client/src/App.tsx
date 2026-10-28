import { useState, useEffect, useRef, useCallback, lazy, Suspense, type ReactNode } from 'react';
import {
  LayoutDashboard,
  Link2,
  Terminal,
  ShieldCheck,
  Music,
  Coins,
  MessageSquare,
  Layers,
  Sparkles,
  Settings as SettingsIcon,
  ExternalLink,
  ChevronRight,
  Gamepad2,
  BarChart3
} from 'lucide-react';

// Pages
const Dashboard = lazy(() => import('./pages/Dashboard.js'));
const HizliKurulum = lazy(() => import('./pages/HizliKurulum.js'));
import { DurumSeridi } from './components/DurumSeridi.js';
const Platforms = lazy(() => import('./pages/Platforms.js'));
const Commands = lazy(() => import('./pages/Commands.js'));
const Timers = lazy(() => import('./pages/Timers.js'));
const AutoMod = lazy(() => import('./pages/AutoMod.js'));
const SongRequest = lazy(() => import('./pages/SongRequest.js'));
const Economy = lazy(() => import('./pages/Economy.js'));
const MiniGames = lazy(() => import('./pages/MiniGames.js'));
const TriviaStudio = lazy(() => import('./pages/TriviaStudio.js'));
const Giveaways = lazy(() => import('./pages/Giveaways.js'));
const MultiChat = lazy(() => import('./pages/MultiChat.js'));
const OverlayStudio = lazy(() => import('./pages/OverlayStudio.js'));
const AISettings = lazy(() => import('./pages/AISettings.js'));
const Settings = lazy(() => import('./pages/Settings.js'));
const TTSManager = lazy(() => import('./pages/TTSManager.js'));
const ShieldAndAudit = lazy(() => import('./pages/ShieldAndAudit.js'));
const DonationsAndJumpScare = lazy(() => import('./pages/DonationsAndJumpScare.js'));
const AlertsStudio = lazy(() => import('./pages/AlertsStudio.js'));
const PollsStudio = lazy(() => import('./pages/PollsStudio.js'));
const Extras = lazy(() => import('./pages/Extras.js'));
const Rankings = lazy(() => import('./pages/Rankings.js'));

// OBS Widgets
const TriviaWidget = lazy(() => import('./widgets/TriviaWidget.js'));
const AlertBoxWidget = lazy(() => import('./widgets/AlertBoxWidget.js'));
const ChatBoxWidget = lazy(() => import('./widgets/ChatBoxWidget.js'));
const GoalWidget = lazy(() => import('./widgets/GoalWidget.js'));
const WheelWidget = lazy(() => import('./widgets/WheelWidget.js'));
const AudioPlayerWidget = lazy(() => import('./widgets/AudioPlayerWidget.js'));
const EmoteComboWidget = lazy(() => import('./widgets/EmoteComboWidget.js'));
const KappagenWidget = lazy(() => import('./widgets/KappagenWidget.js'));
const SubathonWidget = lazy(() => import('./widgets/SubathonWidget.js'));
const HypeTrainWidget = lazy(() => import('./widgets/HypeTrainWidget.js'));
const EventLabelsWidget = lazy(() => import('./widgets/EventLabelsWidget.js'));
const ResonanceWidget = lazy(() => import('./widgets/ResonanceWidget.js'));
const PollsWidget = lazy(() => import('./widgets/PollsWidget.js'));
const ShoutoutWidget = lazy(() => import('./widgets/ShoutoutWidget.js'));
const TheCupWidget = lazy(() => import('./widgets/TheCupWidget.js'));
const WordCloudWidget = lazy(() => import('./widgets/WordCloudWidget.js'));
const ScoreboardWidget = lazy(() => import('./widgets/ScoreboardWidget.js'));
const EndCreditsWidget = lazy(() => import('./widgets/EndCreditsWidget.js'));
const PinnedMessageWidget = lazy(() => import('./widgets/PinnedMessageWidget.js'));
const LoyaltyStoreWidget = lazy(() => import('./widgets/LoyaltyStoreWidget.js'));
const LyricsWidget = lazy(() => import('./widgets/LyricsWidget.js'));
const MuzikVideoWidget = lazy(() => import('./widgets/MuzikVideoWidget.js'));
const JumpScareWidget = lazy(() => import('./widgets/JumpScareWidget.js'));
const KingWidget = lazy(() => import('./widgets/KingWidget.js'));
const UnifiedOverlayWidget = lazy(() => import('./widgets/UnifiedOverlayWidget.js').then((m) => ({ default: m.UnifiedOverlayWidget })));
const ViewerCounterWidget = lazy(() => import('./widgets/ViewerCounterWidget.js'));
const ActivityFeedWidget = lazy(() => import('./widgets/ActivityFeedWidget.js'));
const GiveawayWidget = lazy(() => import('./widgets/GiveawayWidget.js'));
const RankingsWidget = lazy(() => import('./widgets/RankingsWidget.js'));
const BotAdvanced = lazy(() => import('./pages/BotAdvanced.js'));
const Interaction = lazy(() => import('./pages/Interaction.js'));
const Integrations = lazy(() => import('./pages/Integrations.js'));
const SoundBoard = lazy(() => import('./pages/SoundBoard.js'));
const SoundBoardWidget = lazy(() => import('./widgets/SoundBoardWidget.js'));
const SesliDinleyici = lazy(() => import('./pages/SesliDinleyici.js'));
const VoiceCommands = lazy(() => import('./pages/VoiceCommands.js'));
import { ToastSaglayici, useOnay } from './ui/index.js';
import { AYRILMA_SORUSU, kaydedilmemisVar, kirlileriBirak } from './lib/kaydedilmemis.js';
import { BRAND } from './brand.js';
import { openLink } from './lib/openLink.js';
import { sunucuPortu } from './lib/widget-style.js';

export function App() {
  const path = window.location.pathname;

  // OBS sayfaları yalnız kendi widget'ının kodunu yükler (panelin tamamını değil);
  // yüklenirken saydam kalır.
  const obsSayfasi = (icerik: ReactNode) => <Suspense fallback={null}>{icerik}</Suspense>;

  // Render standalone OBS widgets when visiting /widgets/*
  if (path === '/widgets/overlay' || path === '/overlay') return obsSayfasi(<UnifiedOverlayWidget />);
  if (path === '/widgets/alertbox') return obsSayfasi(<AlertBoxWidget />);
  if (path === '/widgets/chatbox') return obsSayfasi(<ChatBoxWidget />);
  if (path === '/widgets/goals' || path === '/widgets/donation-goal' || path === '/widgets/follower-goal' || path === '/widgets/subscriber-goal' || path === '/widgets/kicks-goal') return obsSayfasi(<GoalWidget />);
  if (path === '/widgets/giveaways') return obsSayfasi(<GiveawayWidget />);
  if (path === '/widgets/rankings') return obsSayfasi(<RankingsWidget />);
  if (path === '/widgets/wheel') return obsSayfasi(<WheelWidget />);
  if (path === '/widgets/audio-player') return obsSayfasi(<AudioPlayerWidget />);
  if (path === '/widgets/emote-combo') return obsSayfasi(<EmoteComboWidget />);
  if (path === '/widgets/subathon') return obsSayfasi(<SubathonWidget />);
  if (path === '/widgets/hype-train') return obsSayfasi(<HypeTrainWidget />);
  if (path === '/widgets/event-labels') return obsSayfasi(<EventLabelsWidget />);
  // "Şu An Çalan" artık Resonance (eski adres de onu gösterir)
  if (path === '/widgets/now-playing' || path === '/widgets/resonance') return obsSayfasi(<ResonanceWidget />);
  if (path === '/widgets/polls') return obsSayfasi(<PollsWidget />);
  if (path === '/widgets/shoutout') return obsSayfasi(<ShoutoutWidget />);
  if (path === '/widgets/the-cup') return obsSayfasi(<TheCupWidget />);
  if (path === '/widgets/word-cloud') return obsSayfasi(<WordCloudWidget />);
  if (path === '/widgets/scoreboard') return obsSayfasi(<ScoreboardWidget />);
  if (path === '/widgets/credits') return obsSayfasi(<EndCreditsWidget />);
  if (path === '/widgets/pinned') return obsSayfasi(<PinnedMessageWidget />);
  if (path === '/widgets/loyalty-redeem') return obsSayfasi(<LoyaltyStoreWidget />);
  if (path === '/widgets/lyrics') return obsSayfasi(<LyricsWidget />);
  if (path === '/widgets/muzik-video') return obsSayfasi(<MuzikVideoWidget />);
  if (path === '/widgets/jumpscare') return obsSayfasi(<JumpScareWidget />);
  if (path === '/widgets/king') return obsSayfasi(<KingWidget />);
  if (path === '/widgets/pano') return obsSayfasi(<SoundBoardWidget />);
  if (path === '/sesli-dinleyici') return obsSayfasi(<SesliDinleyici />);
  if (path === '/widgets/trivia' || path === '/trivia' || path === '/trivia-overlay') return obsSayfasi(<TriviaWidget />);
  if (path === '/widgets/viewer-counter') return obsSayfasi(<ViewerCounterWidget />);
  if (path === '/widgets/activity-feed') return obsSayfasi(<ActivityFeedWidget />);
  // Eskiden Emote Combo'yu açıyordu; artık gerçek uçan emote (kappagen) katmanı
  if (path === '/widgets/emotes' || path === '/widgets/on-screen-emotes' || path === '/widgets/kappagen') return obsSayfasi(<KappagenWidget />);

  // Otherwise, render full StreamAxT Dashboard
  const [activeTab, setActiveTab] = useState('dashboard');
  // Tarayıcı geri/ileri tuşu (B7): sekme adresteki #sekme ile eşlenir.
  // NOT: yukarıdaki useState satırı BİLEREK değiştirilmedi — panel kabuğunun
  // hazırlama betiği (streamaxt-hazirla.mjs) o satırı birebir arayıp gömme
  // yamasını uyguluyor. Bu etkiler yama uygulansa da uygulanmasa da çalışır.
  // Kaydedilmemiş form varken sekme değişimi önce sorar (tek sayfalık
  // uygulamada `beforeunload` sekme geçişinde tetiklenmez).
  const { sor: onayIste, eleman: onayDiyalogu } = useOnay();
  const aktifSekme = useRef(activeTab);
  aktifSekme.current = activeTab;
  const sekmeyeGec = useCallback((hedef: string) => {
    if (hedef === aktifSekme.current) return;
    if (!kaydedilmemisVar()) {
      setActiveTab(hedef);
      return;
    }
    onayIste('Kaydedilmemiş değişiklikler', AYRILMA_SORUSU, () => {
      kirlileriBirak();
      setActiveTab(hedef);
    });
  }, [onayIste]);
  const sekmeyeGecRef = useRef(sekmeyeGec);
  sekmeyeGecRef.current = sekmeyeGec;
  useEffect(() => {
    const ilk = window.location.hash.replace('#', '');
    if (ilk) setActiveTab(ilk);
    const geri = () => {
      const hedef = window.location.hash.replace('#', '') || 'dashboard';
      if (hedef === aktifSekme.current) return;
      if (kaydedilmemisVar()) {
        // Adres onay gelene kadar mevcut sekmede kalsın (gömülü kabuğun
        // hashchange dinleyicisi de bu adresi okur ve sekmeyi değiştirmez)
        window.history.replaceState(null, '', `#${aktifSekme.current}`);
        sekmeyeGecRef.current(hedef);
        return;
      }
      setActiveTab(hedef);
    };
    window.addEventListener('popstate', geri);
    return () => window.removeEventListener('popstate', geri);
  }, []);
  useEffect(() => {
    const hedef = `#${activeTab}`;
    if (window.location.hash !== hedef) window.history.pushState(null, '', hedef);
  }, [activeTab]);
  const [focusPlatform, setFocusPlatform] = useState<string | null>(null);
  const sonAltSayfa = useRef<Record<string, string>>({});

  // Sayfa adları (alt sekme ve başlık). Kimlikler adres (#overlays…) ve gömülü YYA için AYNI kalmalı.
  const sayfaAdlari: Record<string, string> = {
    dashboard: 'Genel Bakış', kurulum: 'Hızlı Kurulum', multichat: 'Canlı Multi-Chat',
    overlays: 'Overlay Stüdyo', alerts: 'Uyarılar', pano: 'Ses / Video Panosu', tts: 'TTS',
    songrequest: 'Şarkı İsteği', polls: 'Anketler', giveaways: 'Çekilişler', interaction: 'Tahmin & Kuyruk',
    trivia: 'Bil Bakalım', games: 'Chat Oyunları', economy: 'Sadakat & Market', rankings: 'Sıralamalar',
    donations: 'Bağış & JumpScare', commands: 'Komutlar', timers: 'Zamanlayıcılar', sesli: 'Sesli Komutlar',
    extras: 'Klip & Seviye', automod: 'Bot Moderasyonu', shield: 'Kalkan & Denetim', ai: 'Yapay Zekâ',
    platforms: 'Platformlar', integrations: 'Discord & Entegrasyonlar', settings: 'Genel Ayarlar', botadvanced: 'Gelişmiş Bot'
  };

  // Aynı konudaki sayfalar tek ana sekmede: 27 menü satırı 12'ye indi, sayfalar alt sekme oldu
  const navItems = [
    { id: 'genel', label: 'Genel Bakış', icon: LayoutDashboard, grup: 'Yayın sırasında', alt: ['dashboard', 'kurulum'] },
    { id: 'sohbet', label: 'Canlı Sohbet', icon: MessageSquare, grup: 'Yayın sırasında', alt: ['multichat'] },
    { id: 'obs', label: 'OBS & Uyarılar', icon: Layers, grup: 'Yayın sırasında', alt: ['overlays', 'alerts', 'pano', 'tts'] },
    { id: 'muzik', label: 'Müzik', icon: Music, grup: 'Yayın sırasında', alt: ['songrequest'] },
    { id: 'etkinlik', label: 'Anket & Çekiliş', icon: BarChart3, grup: 'Yayın sırasında', alt: ['polls', 'giveaways', 'interaction'] },
    { id: 'oyun', label: 'Oyunlar', icon: Gamepad2, grup: 'Etkileşim', alt: ['trivia', 'games'] },
    { id: 'ekonomi', label: 'Puan & Bağış', icon: Coins, grup: 'Etkileşim', alt: ['economy', 'rankings', 'donations'] },
    { id: 'komut', label: 'Komutlar', icon: Terminal, grup: 'Etkileşim', alt: ['commands', 'timers', 'sesli', 'extras'] },
    { id: 'moderasyon', label: 'Moderasyon', icon: ShieldCheck, grup: 'Kurulum & Ayarlar', alt: ['automod', 'shield'] },
    { id: 'yapayzeka', label: 'Yapay Zekâ', icon: Sparkles, grup: 'Kurulum & Ayarlar', alt: ['ai'] },
    { id: 'baglanti', label: 'Bağlantılar', icon: Link2, grup: 'Kurulum & Ayarlar', alt: ['platforms', 'integrations'] },
    { id: 'ayarlar', label: 'Ayarlar', icon: SettingsIcon, grup: 'Kurulum & Ayarlar', alt: ['settings', 'botadvanced'] },
  ];
  const aktifMerkez = navItems.find((m) => m.alt.includes(activeTab));
  if (aktifMerkez) sonAltSayfa.current[aktifMerkez.id] = activeTab;

  const renderActivePage = () => {
    switch (activeTab) {
      case 'kurulum': return <HizliKurulum git={sekmeyeGec} />;
      case 'dashboard': return (
        <Dashboard
          onConnectPlatform={(platform) => {
            setFocusPlatform(platform);
            sekmeyeGec('platforms');
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
      case 'pano': return <SoundBoard />;
      case 'sesli': return <VoiceCommands />;
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
    {onayDiyalogu}
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
            {navItems.map((item, i) => {
              const Icon = item.icon;
              const isActive = aktifMerkez?.id === item.id;
              const grupBasi = i === 0 || navItems[i - 1].grup !== item.grup;

              return (
                <div key={item.id}>
                {grupBasi && (
                  <div className="px-3.5 pt-3 pb-1 text-[10px] font-black uppercase tracking-wider text-gray-500">{item.grup}</div>
                )}
                <button
                  onClick={() => sekmeyeGec(sonAltSayfa.current[item.id] || item.alt[0])}
                  aria-current={isActive ? 'page' : undefined}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.alt.length > 1 && (
                    <span className={`text-[10px] font-extrabold ${isActive ? 'text-white/70' : 'text-gray-600'}`}>{item.alt.length}</span>
                  )}
                </button>
                </div>
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
            <span className="font-mono text-purple-400">Port {sunucuPortu()}</span>
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
            <span className="text-white font-bold">{aktifMerkez?.label || sayfaAdlari[activeTab]}</span>
            {aktifMerkez && aktifMerkez.alt.length > 1 && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-purple-300 font-bold">{sayfaAdlari[activeTab]}</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <DurumSeridi git={sekmeyeGec} />
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
          {aktifMerkez && aktifMerkez.alt.length > 1 && (
            <div role="tablist" aria-label={aktifMerkez.label} className="mb-6 flex flex-wrap gap-1.5 border-b border-white/10 pb-3">
              {aktifMerkez.alt.map((alt) => (
                <button
                  key={alt}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === alt}
                  onClick={() => sekmeyeGec(alt)}
                  className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    activeTab === alt ? 'bg-purple-600 text-white' : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white'
                  }`}
                >
                  {sayfaAdlari[alt]}
                </button>
              ))}
            </div>
          )}
          <Suspense fallback={<div className="p-8 text-sm text-gray-400 animate-pulse">Yükleniyor…</div>}>
            {renderActivePage()}
          </Suspense>
        </main>
      </div>
    </div>
    </ToastSaglayici>
  );
}

export default App;
