import { useState, useEffect, useRef } from 'react';
import { AlertPreset } from '../types.js';
import { 
  Layers, 
  Copy, 
  Check, 
  ExternalLink, 
  Sliders, 
  Bell, 
  Sparkles, 
  Play, 
  Volume2, 
  CheckCircle2, 
  Search, 
  MessageSquare, 
  Cloud, 
  DollarSign, 
  Smile, 
  Film, 
  Tag, 
  TrendingUp, 
  Gift, 
  Train, 
  Trophy, 
  Music, 
  Pin, 
  BarChart3, 
  Megaphone, 
  Hourglass, 
  Target, 
  Wine, 
  Users, 
  Disc, 
  Gem, 
  HelpCircle,
  Monitor,
  RotateCcw,
  X,
  VolumeX,
  FastForward,
  Plus,
  Minus,
  Radio,
  Move,
  Maximize2,
  Eye,
  EyeOff,
  Palette,
  Settings2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
import { OverlayKatmanlari } from '../widgets/OverlayLayers.js';
import { SubathonPanel } from '../components/SubathonPanel.js';

interface ChatOverlayConfig {
  maxMessages: number;
  fontSize: number;
  showPlatformLogo: boolean;
  showBadges: boolean;
  showTimestamp: boolean;
  highlightSpecial: boolean;
  fadeMessages: boolean;
  fadeTimeout: number;
  smoothMask: boolean;
  textShadow: boolean;
  transparentBg: boolean;
}

const DEFAULT_CHAT_CONFIG: ChatOverlayConfig = {
  maxMessages: 40,
  fontSize: 22,
  showPlatformLogo: true,
  showBadges: true,
  showTimestamp: true,
  highlightSpecial: true,
  fadeMessages: true,
  fadeTimeout: 17,
  smoothMask: true,
  textShadow: true,
  transparentBg: true
};

export interface WidgetLayoutItem {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
  [key: string]: any;
}

export interface AllInOneConfig {
  canvasWidth: number;
  canvasHeight: number;
  testMode?: boolean;
  chat: WidgetLayoutItem & {
    fontSize?: number;
    transparent?: boolean;
    mask?: boolean;
  };
  alerts: WidgetLayoutItem & {
    durationMs?: number;
    soundVolume?: number;
    animation?: string;
    layoutMode?: string;
    textEffect?: string;
  };
  goals: WidgetLayoutItem & {
    type?: 'follower' | 'sub' | 'tip' | 'kicks';
    target?: number;
    current?: number;
    title?: string;
  };
  subathon: WidgetLayoutItem;
  /** Bil Bakalım katmanı: yerleşimde eksikti, bu yüzden konumlandırılamıyordu. */
  trivia: WidgetLayoutItem;
  eventLabels: WidgetLayoutItem;
  emoteCombo: WidgetLayoutItem;
  nowPlaying: WidgetLayoutItem;
  theCup: WidgetLayoutItem;
  polls: WidgetLayoutItem;
  wheel: WidgetLayoutItem;
  hypeTrain: WidgetLayoutItem;
  lyrics?: WidgetLayoutItem & {
    fontSize?: number;
    glowColor?: string;
  };
  jumpScare?: WidgetLayoutItem;
  king?: WidgetLayoutItem;
}


/**
 * Tuvaldeki katman anahtarı → widget ayar kimliği.
 *
 * Sağ paneldeki ayar formu bu eşlemeyle açılır; seçilen bileşenin gerçek
 * ayarları (renk, yazı tipi, süre…) orada düzenlenir ve kaydedildiği anda
 * sunucu `widget_settings` yayını yaptığı için OBS'teki katman anında
 * güncellenir. Eskiden ayarlara yalnız galeri penceresinden ulaşılıyordu.
 */
/**
 * Widget galerisinin Türkçe adları ve açıklamaları. Kartlar İngilizce
 * yazılmıştı; panelin geri kalanı Türkçe olduğu için liste yabancı duruyordu.
 * Kategori DEĞERLERİ (filtre anahtarı) İngilizce kalır, yalnız görünen ad
 * çevrilir — filtre kırılmasın.
 */
const KATEGORI_ADI: Record<string, string> = {
  Goals: 'Hedefler',
  Engagement: 'Etkileşim',
  'On-Stream': 'Ekran Üstü',
  'Audio & AI': 'Ses & Yapay Zekâ'
};

const GALERI_TR: Record<string, { baslik: string; aciklama: string }> = {
  'activity-feed': {
    baslik: 'Aktivite Akışı',
    aciklama: 'Son olayları (takip, abone, bağış) listeler; uyarıyı tekrar oynatma, sessize alma ve atlama kontrolleri içerir.'
  },
  'alert-box': {
    baslik: 'Uyarı Kutusu',
    aciklama: 'Takip, abone, bağış, raid ve TikTok hediyesi uyarılarını ses, GIF ve animasyonla gösterir.'
  },
  'chat-overlay': {
    baslik: 'Sohbet Katmanı',
    aciklama: 'Kanal sohbetini yayın ekranına taşır; yumuşak maske ve özelleştirilebilir düzen sunar.'
  },
  'cloud-tts': {
    baslik: 'Bulut TTS',
    aciklama: 'Bilgisayardan bağımsız bulut sesleriyle okur. IRL yayınlar, telefon kurulumları ve çok cihazlı yayınlar için uygundur.'
  },
  'donation-goal': {
    baslik: 'Bağış Hedefi',
    aciklama: 'Bağış hedefi belirleyin; izleyiciler hedefe ulaşmanıza canlı olarak yardım etsin.'
  },
  'emote-combo': {
    baslik: 'Emoji Kombosu',
    aciklama: 'Aynı emoji arka arkaya gönderildiğinde ekranda kombo gösterir; sohbet etkileşimini artırır.'
  },
  'end-credits': {
    baslik: 'Jenerik (Kapanış)',
    aciklama: 'Yayın boyunca gelen takipçi, abone ve bağışları sinema jeneriği gibi akıtır.'
  },
  'event-labels': {
    baslik: 'Olay Etiketleri',
    aciklama: 'Son takipçi, son abone ve en çok bağış yapan gibi bilgileri metin olarak gösterir.'
  },
  'follower-goal': {
    baslik: 'Takipçi Hedefi',
    aciklama: 'Takipçi hedefi belirleyin; izleyiciler hedefe ulaşmanıza yardım etsin.'
  },
  giveaways: {
    baslik: 'Çekilişler',
    aciklama: 'Sohbetteki izleyiciler arasında anahtar kelimeyle (!katil) çekiliş düzenleyin.'
  },
  'hype-train': {
    baslik: 'Hype Treni',
    aciklama: 'Abone ve bağışları seviyeli, geri sayımlı bir topluluk etkinliğine çevirir.'
  },
  'loyalty-redemptions': {
    baslik: 'Sadakat Ödülleri',
    aciklama: 'İzleyiciler sadakat puanıyla ödül alır: ses, TTS, VIP rolü ve özel uyarılar.'
  },
  'now-playing': {
    baslik: 'Şu An Çalan',
    aciklama: 'Şarkı isteği kuyruğunda çalan parçayı kapak ve ekolayzerle canlı gösterir.'
  },
  'on-screen-emotes': {
    baslik: 'Ekranda Emojiler',
    aciklama: 'Sohbette gönderilen emojileri ekranda uçurur; etkileşimi görünür kılar.'
  },
  'pinned-messages': {
    baslik: 'Sabitlenmiş Mesajlar',
    aciklama: 'Öne çıkardığınız sohbet mesajını yayında özelleştirilebilir bir şeritte tutar.'
  },
  polls: {
    baslik: 'Anketler',
    aciklama: 'Yayında etkileşimli anket gösterir. İzleyiciler sohbetten (!oy) oy verir, sonuç anında güncellenir.'
  },
  shoutout: {
    baslik: 'Shoutout (Tavsiye)',
    aciklama: 'Başka bir yayıncıyı kanalınızda tanıtır; bilgilerini gösterip takip edilmesini kolaylaştırır (!so <kanal>).'
  },
  subathon: {
    baslik: 'Subathon Sayacı',
    aciklama: 'Abone, hediye abone ve bağışlarla süreyi otomatik uzatan canlı geri sayım.'
  },
  'subscriber-goal': {
    baslik: 'Abone Hedefi',
    aciklama: 'Abone hedefi belirleyin; izleyiciler hedefe ulaşmanıza yardım etsin.'
  },
  'the-cup': {
    baslik: 'Bağış Kupası',
    aciklama: 'Her destek olayında kupaya bir jeton düşer; kap dolarken topluluk katkısı görünür olur.'
  },
  tts: {
    baslik: 'TTS Oynatıcı',
    aciklama: "Sohbetten gelen seslendirme isteklerini OBS'te sırayla okur; ses düzeyi ve kuyruk sınırı ayarlanır."
  },
  'viewer-counter': {
    baslik: 'İzleyici Sayacı',
    aciklama: 'Kick, Twitch ve YouTube izleyicilerini tek tek ve toplam olarak canlı gösterir.'
  },
  'trivia-quiz': {
    baslik: 'Bil Bakalım',
    aciklama: 'Dört şıklı soruları ekranda gösterir; izleyiciler sohbetten A/B/C/D yazarak yarışır.'
  },
  'wheel-of-fortune': {
    baslik: 'Çarkıfelek',
    aciklama: 'Ödül çarkını ekranda çevirir; dilimler, ağırlıklar ve bekleme süresi ayarlanır.'
  },
  'kicks-goal': {
    baslik: 'KICKs Hedefi',
    aciklama: 'KICKs hedefi belirleyin; izleyiciler hedefe ulaşmanıza yardım etsin.'
  },
  rankings: {
    baslik: 'Sıralama (Rankings)',
    aciklama: 'Puan, izleme süresi veya mesaj sayısına göre ilk 10 izleyiciyi canlı tabloda gösterir.'
  },
  lyrics: {
    baslik: 'Şarkı Sözleri',
    aciklama: 'Çalan parçanın sözlerini önceki ve sonraki satırla birlikte akıtır.'
  },
  king: {
    baslik: 'Yayın Kralı',
    aciklama: 'Tahtı puanıyla satın alan izleyiciyi ve saltanat süresini gösterir.'
  },
  jumpscare: {
    baslik: 'JumpScare',
    aciklama: 'Bağış eşiği aşılınca tam ekran korku medyası oynatır; eşik ve süre ayarlanır.'
  }
};

const KATMAN_AYAR_ID: Record<string, string> = {
  chat: 'chat-overlay',
  alerts: 'alert-box',
  goals: 'follower-goal',
  subathon: 'subathon',
  trivia: 'trivia',
  eventLabels: 'event-labels',
  polls: 'polls',
  wheel: 'wheel-of-fortune',
  emoteCombo: 'emote-combo',
  nowPlaying: 'now-playing',
  theCup: 'the-cup',
  hypeTrain: 'hype-train',
  lyrics: 'lyrics',
  king: 'king',
  jumpScare: 'jumpscare'
};

const DEFAULT_ALL_IN_ONE_CONFIG: AllInOneConfig = {
  canvasWidth: 1920,
  canvasHeight: 1080,
  testMode: false,
  chat: {
    enabled: true,
    x: 40,
    y: 430,
    width: 420,
    height: 610,
    scale: 1,
    fontSize: 18,
    transparent: true,
    mask: true
  },
  alerts: {
    enabled: true,
    x: 660,
    y: 60,
    width: 600,
    height: 260,
    scale: 1,
    durationMs: 5000,
    soundVolume: 0.7,
    animation: 'bounce',
    layoutMode: 'stacked',
    textEffect: 'wiggle'
  },
  goals: {
    enabled: true,
    x: 40,
    y: 60,
    width: 380,
    height: 60,
    scale: 1,
    type: 'follower',
    target: 100,
    current: 28,
    title: 'Takipçi Hedefi'
  },
  subathon: {
    enabled: false,
    x: 1560,
    y: 60,
    width: 320,
    height: 70,
    scale: 1
  },
  trivia: {
    enabled: false,
    x: 660,
    y: 700,
    width: 600,
    height: 320,
    scale: 1
  },
  eventLabels: {
    enabled: true,
    x: 0,
    y: 0,
    width: 1920,
    height: 44,
    scale: 1
  },
  emoteCombo: {
    enabled: true,
    x: 1560,
    y: 460,
    width: 320,
    height: 140,
    scale: 1
  },
  nowPlaying: {
    enabled: false,
    x: 1460,
    y: 960,
    width: 420,
    height: 90,
    scale: 1
  },
  theCup: {
    enabled: false,
    x: 1580,
    y: 610,
    width: 300,
    height: 430,
    scale: 1
  },
  polls: {
    enabled: false,
    x: 1540,
    y: 180,
    width: 340,
    height: 260,
    scale: 1
  },
  wheel: {
    enabled: false,
    x: 760,
    y: 340,
    width: 400,
    height: 400,
    scale: 1
  },
  hypeTrain: {
    enabled: false,
    x: 685,
    y: 350,
    width: 550,
    height: 85,
    scale: 1
  },
  lyrics: {
    enabled: false,
    x: 460,
    y: 880,
    width: 1000,
    height: 150,
    scale: 1,
    fontSize: 24,
    glowColor: '#00f2fe'
  },
  jumpScare: {
    enabled: true,
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    scale: 1
  },
  king: {
    enabled: false,
    x: 1560,
    y: 180,
    width: 320,
    height: 120,
    scale: 1
  }
};


interface LivePreviewAlert {
  title: string;
  message: string;
  imageUrl: string;
  soundUrl: string;
  accentColor: string;
  textColor: string;
  durationMs: number;
}

export function OverlayStudio() {
  const [activeTab, setActiveTab] = useState<'all_in_one' | 'gallery' | 'chat_settings' | 'alerts'>('all_in_one');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  // All-in-One Single OBS Overlay State
  const [allInOne, setAllInOne] = useState<AllInOneConfig>(DEFAULT_ALL_IN_ONE_CONFIG);
  const [selectedCanvasWidget, setSelectedCanvasWidget] = useState<string>('chat');

  // Canvas interactive drag-and-drop state
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /**
   * Tuval 1920x1080 cizilip CSS ile kuculuyor: boylece onizlemedeki her
   * piksel OBS'teki ayni pikseldir. Genislik degistikce yeniden olculur.
   */
  const [tuvalOlcek, setTuvalOlcek] = useState(1);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const guncelle = () => setTuvalOlcek((el.clientWidth || 1920) / 1920);
    guncelle();
    const gozlemci = new ResizeObserver(guncelle);
    gozlemci.observe(el);
    return () => gozlemci.disconnect();
  }, []);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; widgetX: number; widgetY: number; origW: number; origH: number } | null>(null);

  const handleWidgetPointerDown = (e: React.PointerEvent, widgetKey: string) => {
    e.stopPropagation();
    setSelectedCanvasWidget(widgetKey);
    const item = (allInOne as any)[widgetKey];
    if (!item) return;

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      widgetX: item.x ?? 0,
      widgetY: item.y ?? 0,
      origW: item.width ?? 300,
      origH: item.height ?? 200
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (e: React.PointerEvent, widgetKey: string) => {
    e.stopPropagation();
    setSelectedCanvasWidget(widgetKey);
    const item = (allInOne as any)[widgetKey];
    if (!item) return;

    setIsResizing(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      widgetX: item.x ?? 0,
      widgetY: item.y ?? 0,
      origW: item.width ?? 300,
      origH: item.height ?? 200
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const displayScale = rect.width / 1920;
    const deltaX = (e.clientX - dragStartRef.current.pointerX) / displayScale;
    const deltaY = (e.clientY - dragStartRef.current.pointerY) / displayScale;

    if (isDragging) {
      const curItem = (allInOne as any)[selectedCanvasWidget];
      const w = curItem?.width || 300;
      const h = curItem?.height || 200;
      const newX = Math.round(Math.max(0, Math.min(1920 - w, dragStartRef.current.widgetX + deltaX)));
      const newY = Math.round(Math.max(0, Math.min(1080 - h, dragStartRef.current.widgetY + deltaY)));
      setAllInOne(prev => ({
        ...prev,
        [selectedCanvasWidget]: {
          ...(prev as any)[selectedCanvasWidget],
          x: newX,
          y: newY
        }
      }));
    } else if (isResizing) {
      const newW = Math.round(Math.max(100, Math.min(1920 - dragStartRef.current.widgetX, dragStartRef.current.origW + deltaX)));
      const newH = Math.round(Math.max(40, Math.min(1080 - dragStartRef.current.widgetY, dragStartRef.current.origH + deltaY)));
      setAllInOne(prev => ({
        ...prev,
        [selectedCanvasWidget]: {
          ...(prev as any)[selectedCanvasWidget],
          width: newW,
          height: newH
        }
      }));
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    dragStartRef.current = null;
  };

  const handleCenterHorizontal = (widgetKey: string) => {
    const item = (allInOne as any)[widgetKey];
    if (!item) return;
    const newX = Math.round((1920 - (item.width || 300)) / 2);
    setAllInOne(prev => ({
      ...prev,
      [widgetKey]: { ...(prev as any)[widgetKey], x: newX }
    }));
  };

  const handleCenterVertical = (widgetKey: string) => {
    const item = (allInOne as any)[widgetKey];
    if (!item) return;
    const newY = Math.round((1080 - (item.height || 200)) / 2);
    setAllInOne(prev => ({
      ...prev,
      [widgetKey]: { ...(prev as any)[widgetKey], y: newY }
    }));
  };

  const handleResetWidget = (widgetKey: string) => {
    const defItem = (DEFAULT_ALL_IN_ONE_CONFIG as any)[widgetKey];
    if (!defItem) return;
    setAllInOne(prev => ({
      ...prev,
      [widgetKey]: { ...defItem }
    }));
  };

  const handleToggleTestMode = async () => {
    const nextVal = !allInOne.testMode;
    const updated = { ...allInOne, testMode: nextVal };
    setAllInOne(updated);
    try {
      await fetch('/api/overlay/all-in-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      setTestNotification(
        nextVal
          ? '👁️ OBS Test/Önizleme Modu AÇILDI! (OBS ekranında tüm bileşenler örnek verilerle görünür)'
          : '👁️ OBS Test Modu KAPATILDI (Canlı yayın moduna dönüldü)'
      );
      setTimeout(() => setTestNotification(null), 4500);
    } catch {}
  };

  // Chat Overlay Configuration State (Image 1)
  const [chatConfig, setChatConfig] = useState<ChatOverlayConfig>(DEFAULT_CHAT_CONFIG);

  // Widget Gallery State (Image 2)
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedWidgetModal, setSelectedWidgetModal] = useState<any | null>(null);
  const [modalActionStatus, setModalActionStatus] = useState<string | null>(null);

  // AlertBox State
  const [alerts, setAlerts] = useState<AlertPreset[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertPreset | null>(null);
  const [livePreview, setLivePreview] = useState<LivePreviewAlert | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const previewTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const singleOverlayUrl = `${baseUrl}/widgets/overlay`;

  useEffect(() => {
    // Fetch All-in-One settings
    fetch('/api/overlay/all-in-one')
      .then(r => r.json())
      .then(d => {
        if (d && typeof d === 'object' && d.chat) {
          setAllInOne(prev => ({ ...prev, ...d }));
        }
      })
      .catch(() => {});

    // Fetch Chat Settings
    fetch('/api/settings/chat-overlay')
      .then(r => r.json())
      .then(d => {
        if (d) setChatConfig(prev => ({ ...prev, ...d }));
      })
      .catch(() => {});

    // Fetch Alerts
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => {
        setAlerts(d || []);
        if (d && d.length > 0) setSelectedAlert(d[0]);
      })
      .catch(() => {});
  }, []);

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleSaveAllInOne = async () => {
    await fetch('/api/overlay/all-in-one', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allInOne)
    });
    confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
    setTestNotification('✨ All-in-One OBS ayarları kaydedildi ve canlı OBS yayınına uygulandı!');
    setTimeout(() => setTestNotification(null), 4000);
  };

  const handleSaveChatSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/settings/chat-overlay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chatConfig)
    });
    setTestNotification('💾 Chat Overlay ayarları başarıyla kaydedildi!');
    setTimeout(() => setTestNotification(null), 3500);
  };

  // Trigger test for specific widget via API
  const triggerWidgetTest = async (widgetId: string, customBody?: any) => {
    try {
      const res = await fetch(`/api/widgets/test/${widgetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customBody || {})
      });
      const data = await res.json();
      setModalActionStatus(`✅ Test tetiklendi: ${data.message || 'Başarılı'}`);
      setTimeout(() => setModalActionStatus(null), 3000);
    } catch {
      setModalActionStatus('❌ Test tetiklenirken hata oluştu');
      setTimeout(() => setModalActionStatus(null), 3000);
    }
  };

  // Overlay widget gallery
  const widgetGalleryItems = [
    {
      id: 'activity-feed',
      category: 'On-Stream',
      icon: Layers,
      url: `${baseUrl}/widgets/activity-feed`,
      beta: false
    },
    {
      id: 'alert-box',
      category: 'On-Stream',
      icon: Bell,
      url: `${baseUrl}/widgets/alertbox`,
      beta: false
    },
    {
      id: 'chat-overlay',
      category: 'Engagement',
      icon: MessageSquare,
      url: `${baseUrl}/widgets/chatbox`,
      beta: false
    },
    {
      id: 'cloud-tts',
      category: 'Audio & AI',
      icon: Cloud,
      url: `${baseUrl}/widgets/audio-player`,
      beta: true,
      badge: 'BETA V3'
    },
    {
      id: 'donation-goal',
      category: 'Goals',
      icon: DollarSign,
      url: `${baseUrl}/widgets/donation-goal`,
      beta: false
    },
    {
      id: 'emote-combo',
      category: 'Engagement',
      icon: Smile,
      url: `${baseUrl}/widgets/emote-combo`,
      beta: false
    },
    {
      id: 'end-credits',
      category: 'On-Stream',
      icon: Film,
      url: `${baseUrl}/widgets/credits`,
      beta: true,
      badge: 'BETA'
    },
    {
      id: 'event-labels',
      category: 'On-Stream',
      icon: Tag,
      url: `${baseUrl}/widgets/event-labels`,
      beta: false
    },
    {
      id: 'follower-goal',
      category: 'Goals',
      icon: TrendingUp,
      url: `${baseUrl}/widgets/follower-goal`,
      beta: false
    },
    {
      id: 'giveaways',
      category: 'Engagement',
      icon: Gift,
      url: `${baseUrl}/widgets/giveaways`,
      beta: false
    },
    {
      id: 'hype-train',
      category: 'Engagement',
      icon: Train,
      url: `${baseUrl}/widgets/hype-train`,
      beta: true,
      badge: 'BETA'
    },
    {
      id: 'loyalty-redemptions',
      category: 'Engagement',
      icon: Trophy,
      url: `${baseUrl}/widgets/loyalty-redeem`,
      beta: false
    },
    {
      id: 'now-playing',
      category: 'Audio & AI',
      icon: Music,
      url: `${baseUrl}/widgets/now-playing`,
      beta: false
    },
    {
      id: 'on-screen-emotes',
      category: 'Engagement',
      icon: Smile,
      url: `${baseUrl}/widgets/emotes`,
      beta: false
    },
    {
      id: 'pinned-messages',
      category: 'On-Stream',
      icon: Pin,
      url: `${baseUrl}/widgets/pinned`,
      beta: true,
      badge: 'BETA'
    },
    {
      id: 'polls',
      category: 'Engagement',
      icon: BarChart3,
      url: `${baseUrl}/widgets/polls`,
      beta: false
    },
    {
      id: 'shoutout',
      category: 'On-Stream',
      icon: Megaphone,
      url: `${baseUrl}/widgets/shoutout`,
      beta: false
    },
    {
      id: 'subathon',
      category: 'Goals',
      icon: Hourglass,
      url: `${baseUrl}/widgets/subathon`,
      beta: true,
      badge: 'BETA V2'
    },
    {
      id: 'subscriber-goal',
      category: 'Goals',
      icon: Target,
      url: `${baseUrl}/widgets/subscriber-goal`,
      beta: false
    },
    {
      id: 'the-cup',
      category: 'Engagement',
      icon: Wine,
      url: `${baseUrl}/widgets/the-cup`,
      beta: false
    },
    {
      id: 'tts',
      category: 'Audio & AI',
      icon: Volume2,
      url: `${baseUrl}/widgets/audio-player`,
      beta: false
    },
    {
      id: 'viewer-counter',
      category: 'On-Stream',
      icon: Users,
      url: `${baseUrl}/widgets/viewer-counter`,
      beta: false
    },
    {
      id: 'trivia-quiz',
      category: 'Engagement',
      icon: HelpCircle,
      url: `${baseUrl}/widgets/trivia`,
      beta: false,
      badge: 'YENİ 🧠'
    },
    {
      id: 'wheel-of-fortune',
      category: 'Engagement',
      icon: Disc,
      url: `${baseUrl}/widgets/wheel`,
      beta: false
    },
    {
      id: 'kicks-goal',
      category: 'Goals',
      icon: Gem,
      url: `${baseUrl}/widgets/kicks-goal`,
      beta: false
    },
    // Ayar sistemine yeni bağlanan dört widget galeride hiç görünmüyordu:
    // OBS adresleri vardı ama panelden ayarlanamıyorlardı.
    {
      id: 'rankings',
      category: 'On-Stream',
      icon: Trophy,
      url: `${baseUrl}/widgets/rankings`,
      beta: false
    },
    {
      id: 'lyrics',
      category: 'On-Stream',
      icon: Disc,
      url: `${baseUrl}/widgets/lyrics`,
      beta: true,
      badge: 'BETA'
    },
    {
      id: 'king',
      category: 'Engagement',
      icon: Gem,
      url: `${baseUrl}/widgets/king`,
      beta: false
    },
    {
      id: 'jumpscare',
      category: 'Alerts',
      icon: Eye,
      url: `${baseUrl}/widgets/jumpscare`,
      beta: false
    }
  ];

  const widgetGalleryItemsTr = widgetGalleryItems.map(w => ({
    ...w,
    title: GALERI_TR[w.id]?.baslik || w.id,
    description: GALERI_TR[w.id]?.aciklama || ''
  }));

  const filteredWidgets = widgetGalleryItemsTr.filter(w => {
    const matchesSearch = w.title.toLowerCase().includes(searchQuery.toLowerCase()) || w.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'All' || w.category === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            OBS Overlay & Widget Stüdyosu
          </h1>
          <p className="text-sm text-gray-400">
            Tek bir URL ile tüm yayını yönetin veya {widgetGalleryItemsTr.length} profesyonel bağımsız widget'ı özelleştirin.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-white/10 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all_in_one')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'all_in_one'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Tek URL OBS Stüdyosu</span>
          </button>

          <button
            onClick={() => setActiveTab('gallery')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'gallery'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Widget Galerisi ({widgetGalleryItemsTr.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('chat_settings')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'chat_settings'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Overlay Ayarları</span>
          </button>

          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'alerts'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>AlertBox & Bildirimler</span>
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {testNotification && (
        <div className="flex items-center gap-2 p-3.5 bg-purple-600/30 border border-purple-500/40 rounded-xl text-purple-200 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{testNotification}</span>
        </div>
      )}

      {/* TAB 1: ALL-IN-ONE SINGLE OBS OVERLAY STUDIO */}
      {activeTab === 'all_in_one' && (
        <div className="space-y-6">
          {/* Master OBS Link Card */}
          <div className="glass-panel p-5 rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-purple-900/20 to-black flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${allInOne.testMode ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
                <h3 className="text-base font-extrabold text-white">Tek URL ile OBS Tüm Sahne Overlay'i</h3>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-mono font-bold">1920x1080 Full HD</span>
                {allInOne.testMode && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-bold animate-pulse">
                    OBS ÖNİZLEME MODU AKTİF
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 max-w-2xl">
                OBS'e tek tek widget eklemek yerine bu tek linki Tarayıcı Kaynağı (Browser Source) olarak ekleyin. Chat, alertler, hedefler ve tüm widget'lar bu tuvalde canlı senkronize çalışır.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
              <button
                onClick={handleToggleTestMode}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                  allInOne.testMode
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30'
                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
                title="OBS'te bileşenlerin konumunu rahatça ayarlamak için örnek verileri açıp kapatın"
              >
                {allInOne.testMode ? <Eye className="w-4 h-4 text-amber-400" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                <span>{allInOne.testMode ? 'OBS Test Modunu Kapat' : 'OBS Test Modunu Aç'}</span>
              </button>

              <input 
                type="text" 
                readOnly 
                value={singleOverlayUrl} 
                className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono w-full sm:w-64 select-all"
              />
              <button
                onClick={() => copyToClipboard(singleOverlayUrl)}
                className="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-purple-600/30"
              >
                {copiedUrl === singleOverlayUrl ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedUrl === singleOverlayUrl ? 'Kopyalandı' : 'Kopyala'}</span>
              </button>
            </div>
          </div>

          {/* Interactive Screen Preview & Controls Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: 16:9 Stream Canvas Preview with Interactive Drag & Drop */}
            <div className="lg:col-span-8 glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Move className="w-4 h-4 text-purple-400" />
                    Canlı Yayın Tuvali (16:9 Ekran - Sürükle & Bırak)
                  </h3>
                  <p className="text-xs text-gray-400">
                    Bileşenleri farenizle tutup sürükleyerek konumlandırın, sağ alttaki tutamaçla boyutlandırın.
                  </p>
                </div>
                <button
                  onClick={handleSaveAllInOne}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-600/30"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Ayarları Kaydet & OBS'e Yansıt</span>
                </button>
              </div>

              {/* 16:9 Screen Simulation Box (Interactive Drag Canvas) */}
              <div 
                ref={canvasRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="relative w-full aspect-video bg-[#07090e] rounded-2xl border border-white/20 overflow-hidden shadow-2xl select-none cursor-default"
                style={{ touchAction: 'none' }}
              >
                {/* Background Stream Grid Pattern & Aspect Ratio Watermark */}
                <div 
                  className="absolute inset-0 opacity-20 pointer-events-none" 
                  style={{ backgroundImage: 'radial-gradient(#8b5cf6 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                />
                <div className="absolute top-2 right-3 text-[10px] font-mono text-white/20 pointer-events-none font-bold">
                  1920 x 1080 OBS CANVAS
                </div>

                {/* TUVAL = OBS ÇIKTISI
                    Eskiden burada her katman için elle yazılmış sahte
                    maketler vardı ("03:45:20", "🪙 x12", "Lv. 2 %80"), OBS
                    ise gerçek widget'ları yüklüyordu — bu yüzden önizleme
                    ile yayın birbirini tutmuyordu.
                    Artık ikisi de OverlayLayers.tsx'i kullanıyor. Tuval
                    1920×1080 çizilip CSS ile küçültülüyor, böylece ölçek ve
                    konum birebir aynı. */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: 1920,
                    height: 1080,
                    transform: `scale(${tuvalOlcek})`,
                    transformOrigin: 'top left'
                  }}
                >
                  <OverlayKatmanlari
                    config={allInOne as any}
                    onizleme
                    sarmala={(katman, icerik, stil) => {
                      const item = (allInOne as any)[katman.anahtar];
                      const secili = selectedCanvasWidget === katman.anahtar;
                      return (
                        <div
                          onPointerDown={(e) => handleWidgetPointerDown(e, katman.anahtar)}
                          title={katman.etiket}
                          style={{
                            ...stil,
                            cursor: 'move',
                            // Kapalı katman tuvalde soluk görünür ki
                            // konumlandırılabilsin; OBS'te hiç çizilmez.
                            opacity: item?.enabled ? 1 : 0.3,
                            outline: secili ? '3px solid #a78bfa' : '1px dashed rgba(167,139,250,0.35)',
                            outlineOffset: 2,
                            borderRadius: 6
                          }}
                        >
                          <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>{icerik}</div>
                          {secili && (
                            <div
                              onPointerDown={(e) => handleResizePointerDown(e, katman.anahtar)}
                              style={{
                                position: 'absolute',
                                right: 0,
                                bottom: 0,
                                width: 30,
                                height: 30,
                                background: '#a78bfa',
                                cursor: 'se-resize',
                                borderTopLeftRadius: 6
                              }}
                            />
                          )}
                        </div>
                      );
                    }}
                  />
                </div>

              </div>
            </div>

            {/* Right: Detailed Component Positioning & Settings Panel */}
            <div className="lg:col-span-4 glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
              <div className="pb-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-purple-400" />
                    Bileşen Konumlandırma & Ayar
                  </h3>
                  <p className="text-xs text-gray-400">Bileşeni seçin, tek URL'ye dahil edin ve koordinatlarını belirleyin.</p>
                </div>
              </div>

              {/* Widget Selector Dropdown */}
              <div>
                <label className="text-[11px] font-bold text-gray-300 block mb-1">
                  Düzenlenecek Bileşen:
                </label>
                <select
                  value={selectedCanvasWidget}
                  onChange={e => setSelectedCanvasWidget(e.target.value)}
                  className="w-full bg-[#12141a] border border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="chat">💬 Canlı Sohbet (Chat)</option>
                  <option value="alerts">🔔 AlertBox Bildirimleri</option>
                  <option value="goals">🎯 Hedef Çubuğu (Goal)</option>
                  <option value="subathon">⏳ Subathon Sayacı</option>
                  <option value="trivia">🧠 Bil Bakalım</option>
                  <option value="eventLabels">🏷️ Event Labels (Üst Şerit)</option>
                  <option value="theCup">🍷 The Cup (Jeton Kavanozu)</option>
                  <option value="polls">📊 Canlı Anket (Polls)</option>
                  <option value="wheel">🎡 Çarkıfelek</option>
                  <option value="hypeTrain">🚂 Hype Treni</option>
                  <option value="nowPlaying">🎵 Now Playing (Şarkı Kartı)</option>
                  <option value="emoteCombo">🔥 Emote Kombo</option>
                  <option value="lyrics">🎶 Canlı Şarkı Sözleri (Lyrics)</option>
                  <option value="king">👑 Tahtın Kralı (King System)</option>
                  <option value="jumpScare">💀 JumpScare Katmanı</option>
                </select>
              </div>


              {/* Selected Widget Card */}
              {(() => {
                const cur = (allInOne as any)[selectedCanvasWidget];
                if (!cur) return null;

                const updateCur = (patch: any) => {
                  setAllInOne(prev => ({
                    ...prev,
                    [selectedCanvasWidget]: {
                      ...(prev as any)[selectedCanvasWidget],
                      ...patch
                    }
                  }));
                };

                return (
                  <div className="space-y-4">
                    {/* Include in Single OBS URL Toggle */}
                    <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Tek OBS URL'sine Dahil Et</span>
                        <span className="text-[10px] text-gray-400">Bu bileşeni tek tuvalde canlı yayına ekleyin</span>
                      </div>
                      <input 
                        type="checkbox"
                        checked={Boolean(cur.enabled)}
                        onChange={e => updateCur({ enabled: e.target.checked })}
                        className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                      />
                    </div>

                    {/* Numeric Coordinate and Size Inputs */}
                    <div className="p-3.5 bg-[#11131a] rounded-xl border border-white/10 space-y-3">
                      <div className="text-[11px] font-bold text-purple-300 flex items-center justify-between">
                        <span>Koordinatlar & Boyut (1920x1080)</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          X:{cur.x} Y:{cur.y} | {cur.width}x{cur.height}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">X Konumu (px)</label>
                          <input
                            type="number"
                            value={cur.x ?? 0}
                            onChange={e => updateCur({ x: parseInt(e.target.value, 10) || 0 })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Y Konumu (px)</label>
                          <input
                            type="number"
                            value={cur.y ?? 0}
                            onChange={e => updateCur({ y: parseInt(e.target.value, 10) || 0 })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Genişlik (px)</label>
                          <input
                            type="number"
                            value={cur.width ?? 300}
                            onChange={e => updateCur({ width: parseInt(e.target.value, 10) || 100 })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Yükseklik (px)</label>
                          <input
                            type="number"
                            value={cur.height ?? 200}
                            onChange={e => updateCur({ height: parseInt(e.target.value, 10) || 50 })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white font-mono"
                          />
                        </div>
                      </div>

                      {/* Scale Slider */}
                      <div className="pt-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-[10px] text-gray-400">Ölçek (Scale)</span>
                          <span className="text-[10px] font-mono text-purple-300 font-bold">{cur.scale ?? 1}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.05"
                          value={cur.scale ?? 1}
                          onChange={e => updateCur({ scale: parseFloat(e.target.value) || 1 })}
                          className="w-full accent-purple-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                        />
                      </div>

                      {/* Alignment Action Buttons */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1">
                        <button
                          onClick={() => handleCenterHorizontal(selectedCanvasWidget)}
                          className="px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-gray-200 transition-colors"
                        >
                          ↔️ Yatay Ortala
                        </button>
                        <button
                          onClick={() => handleCenterVertical(selectedCanvasWidget)}
                          className="px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-gray-200 transition-colors"
                        >
                          ↕️ Dikey Ortala
                        </button>
                        <button
                          onClick={() => handleResetWidget(selectedCanvasWidget)}
                          className="px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-amber-300 transition-colors"
                        >
                          🔄 Sıfırla
                        </button>
                      </div>
                    </div>

                    {/* Detailed AlertBox Settings (when alerts is selected) */}
                    {selectedCanvasWidget === 'alerts' && (
                      <div className="p-3.5 bg-[#11131a] rounded-xl border border-amber-500/20 space-y-3">
                        <div className="flex items-center justify-between border-b border-white/5 pb-2">
                          <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Bell className="w-3.5 h-3.5" />
                            Ayrıntılı AlertBox Ayarları
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono">OBS Bildirimleri</span>
                        </div>

                        {/* Layout Mode */}
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1 font-bold">Düzen Modu (Layout)</label>
                          <select
                            value={cur.layoutMode || 'stacked'}
                            onChange={e => updateCur({ layoutMode: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                          >
                            <option value="stacked">Resim Üstte, Metin Altta (Stacked)</option>
                            <option value="side-by-side">Resim Solda, Metin Sağda (Side by Side)</option>
                            <option value="text-over">Metin Resmin Üzerinde (Text Over)</option>
                          </select>
                        </div>

                        {/* Entrance Animation */}
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1 font-bold">Giriş Animasyonu</label>
                          <select
                            value={cur.animation || 'bounce'}
                            onChange={e => updateCur({ animation: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                          >
                            <option value="bounce">Zıplayarak Giriş (Bounce)</option>
                            <option value="slide">Yukarıdan Kayarak (Slide In)</option>
                            <option value="zoom">Büyüyerek Açılma (Zoom)</option>
                            <option value="flip">3D Takla (Flip)</option>
                            <option value="glitch">Siber Glitch (Glitch)</option>
                            <option value="fade">Yumuşak Belirme (Fade In)</option>
                          </select>
                        </div>

                        {/* Text Effect */}
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-1 font-bold">Metin Animasyon Efekti</label>
                          <select
                            value={cur.textEffect || 'wiggle'}
                            onChange={e => updateCur({ textEffect: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                          >
                            <option value="wiggle">Kıpırdayan Harfler (Wiggle)</option>
                            <option value="wave">Dalgalı Metin (Wave)</option>
                            <option value="shine">Işıltılı Parlama (Shine)</option>
                            <option value="pulse">Nabız Gibi Büyüyüp Küçülme (Pulse)</option>
                            <option value="shake">Titreyen Metin (Shake)</option>
                          </select>
                        </div>

                        {/* Duration Slider */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-gray-400 font-bold">Bildirim Süresi</span>
                            <span className="font-mono text-amber-300 font-bold">{((cur.durationMs || 5000) / 1000).toFixed(1)} sn</span>
                          </div>
                          <input
                            type="range"
                            min="2000"
                            max="15000"
                            step="500"
                            value={cur.durationMs || 5000}
                            onChange={e => updateCur({ durationMs: parseInt(e.target.value, 10) || 5000 })}
                            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                          />
                        </div>

                        {/* Sound Volume Slider */}
                        <div>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-gray-400 font-bold">Bildirim Ses Seviyesi</span>
                            <span className="font-mono text-amber-300 font-bold">{Math.round((cur.soundVolume ?? 0.7) * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={cur.soundVolume ?? 0.7}
                            onChange={e => updateCur({ soundVolume: parseFloat(e.target.value) || 0.7 })}
                            className="w-full accent-amber-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                          />
                        </div>

                        {/* Quick Test Trigger Buttons */}
                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <label className="text-[10px] font-bold text-gray-400 block">OBS Canlı Bildirim Testi:</label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              onClick={() => triggerWidgetTest('follow', { username: 'EmreCan' })}
                              className="px-2.5 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg text-[10px] font-bold"
                            >
                              💜 Takip Testi
                            </button>
                            <button
                              onClick={() => triggerWidgetTest('sub', { username: 'Ahmet_Kaya' })}
                              className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-bold"
                            >
                              ⭐ Abone Testi
                            </button>
                            <button
                              onClick={() => triggerWidgetTest('tip', { username: 'Caner', amount: 100, currency: 'TL' })}
                              className="px-2.5 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-bold"
                            >
                              💰 Bağış Testi
                            </button>
                            <button
                              onClick={() => triggerWidgetTest('raid', { username: 'ProGamer', viewers: 120 })}
                              className="px-2.5 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 rounded-lg text-[10px] font-bold"
                            >
                              🚀 Raid Testi
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Specific Goal Settings */}
                    {selectedCanvasWidget === 'goals' && (
                      <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 space-y-2 text-xs">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Hedef Başlığı</label>
                          <input
                            type="text"
                            value={cur.title || ''}
                            onChange={e => updateCur({ title: e.target.value })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Hedef Miktar</label>
                            <input
                              type="number"
                              value={cur.target || 100}
                              onChange={e => updateCur({ target: parseInt(e.target.value, 10) || 100 })}
                              className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-400 block mb-0.5">Mevcut Değer</label>
                            <input
                              type="number"
                              value={cur.current || 0}
                              onChange={e => updateCur({ current: parseInt(e.target.value, 10) || 0 })}
                              className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Specific Chat Settings */}
                    {selectedCanvasWidget === 'chat' && (
                      <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 space-y-2 text-xs">
                        <div>
                          <label className="text-[10px] text-gray-400 block mb-0.5">Yazı Boyutu (px)</label>
                          <input
                            type="number"
                            value={cur.fontSize || 18}
                            onChange={e => updateCur({ fontSize: parseInt(e.target.value, 10) || 18 })}
                            className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                          />
                        </div>
                        <div className="flex items-center gap-4 pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 text-[11px]">
                            <input
                              type="checkbox"
                              checked={cur.transparent !== false}
                              onChange={e => updateCur({ transparent: e.target.checked })}
                              className="accent-purple-600 rounded"
                            />
                            <span>Şeffaf Arka Plan</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300 text-[11px]">
                            <input
                              type="checkbox"
                              checked={cur.mask !== false}
                              onChange={e => updateCur({ mask: e.target.checked })}
                              className="accent-purple-600 rounded"
                            />
                            <span>Yumuşak Maske</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Seçili bileşenin KENDİ ayarları — değişiklik anında OBS'e gider. */}
              {KATMAN_AYAR_ID[selectedCanvasWidget] && (
                <div className="pt-1">
                  <div className="flex items-center justify-between pb-2">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                      Seçili Bileşen Ayarları
                    </h4>
                    <span className="text-[10px] text-emerald-400">otomatik kaydedilir</span>
                  </div>
                  <WidgetSettingsForm
                    key={KATMAN_AYAR_ID[selectedCanvasWidget]}
                    widgetId={KATMAN_AYAR_ID[selectedCanvasWidget]}
                    baseUrl={baseUrl}
                  />
                </div>
              )}

              <button
                onClick={handleSaveAllInOne}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Değişiklikleri OBS'e Uygula</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WIDGET GALLERY (23 BOTRIX-GRADE WIDGETS) */}
      {activeTab === 'gallery' && (
        <div className="space-y-6">
          {/* Gallery Header & Search */}
          <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                Widget Galerisi
                <span className="text-xs font-normal text-gray-400">({filteredWidgets.length} Widget)</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Yayını güçlendiren, gelir getiren ve kişiselleştiren temel araç seti.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Widget ara..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-[#12141a] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
              >
                <option value="All">Tüm Kategoriler</option>
                <option value="Goals">Hedefler</option>
                <option value="Engagement">Etkileşim</option>
                <option value="On-Stream">Ekran Üstü</option>
                <option value="Audio & AI">Ses & Yapay Zekâ</option>
              </select>
            </div>
          </div>

          {/* 4-Column Responsive Grid matching Image 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredWidgets.map(widget => {
              const Icon = widget.icon;
              return (
                <div
                  key={widget.id}
                  onClick={() => setSelectedWidgetModal(widget)}
                  className="glass-panel p-5 rounded-2xl border border-white/10 hover:border-purple-500/50 bg-[#12141a]/90 hover:bg-[#181b24] transition-all flex flex-col justify-between group cursor-pointer relative"
                >
                  {widget.beta && (
                    <span className="absolute top-3 right-3 px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30">
                      {widget.badge || 'BETA'}
                    </span>
                  )}

                  <div>
                    <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-3 group-hover:scale-110 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>

                    <h3 className="text-sm font-extrabold text-white group-hover:text-purple-300 transition-colors">
                      {widget.title}
                    </h3>

                    <p className="text-xs text-gray-400 mt-1 line-clamp-3 leading-relaxed">
                      {widget.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-medium text-gray-500">{KATEGORI_ADI[widget.category] || widget.category}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(widget.url);
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                      title="OBS URL'sini Kopyala"
                    >
                      {copiedUrl === widget.url ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Widget Settings & Test Modal */}
          {selectedWidgetModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-[#14161f] border border-white/15 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <selectedWidgetModal.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        {selectedWidgetModal.title}
                        {selectedWidgetModal.beta && (
                          <span className="text-[9px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded font-black">
                            {selectedWidgetModal.badge || 'BETA'}
                          </span>
                        )}
                      </h3>
                      <span className="text-xs text-gray-400">{KATEGORI_ADI[selectedWidgetModal.category] || selectedWidgetModal.category}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedWidgetModal(null)}
                    className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  {selectedWidgetModal.description}
                </p>

                <WidgetSettingsForm widgetId={selectedWidgetModal.id} baseUrl={baseUrl} />

                {/* Standalone OBS URL Box */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-400">Bağımsız OBS Browser Source URL:</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={selectedWidgetModal.url}
                      className="bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono w-full select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(selectedWidgetModal.url)}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {copiedUrl === selectedWidgetModal.url ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedUrl === selectedWidgetModal.url ? 'Kopyalandı' : 'Kopyala'}</span>
                    </button>
                  </div>
                </div>

                {/* Widget Specific Action & Test Panel */}
                <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-gray-200">Canlı İşlev & Test Kontrolleri</h4>

                  {/* Dynamic controls according to widget */}
                  {selectedWidgetModal.id === 'the-cup' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => triggerWidgetTest('the-cup', { tokenType: 'coin', count: 5 })}
                        className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        🪙 5x Altın Jeton Düşür
                      </button>
                      <button 
                        onClick={() => triggerWidgetTest('the-cup', { tokenType: 'bits', count: 10 })}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        💎 10x Bits Jetonu Düşür
                      </button>
                    </div>
                  )}

                  {/* Subathon kendi kontrol panelini kullanir: sayac artik
                      sunucuda, sure kurallari buradan ayarlanir. Eski iki
                      dugme yalniz sahte bir WS mesaji yolluyordu. */}
                  {selectedWidgetModal.id === 'subathon' && <SubathonPanel />}

                  {selectedWidgetModal.id === 'wheel-of-fortune' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => triggerWidgetTest('wheel')}
                        className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <Disc className="w-4 h-4" /> Çarkı Canlı Çevir
                      </button>
                    </div>
                  )}

                  {selectedWidgetModal.id === 'hype-train' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => triggerWidgetTest('hype-train', { level: 2, percent: 80, secondsLeft: 240 })}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                      >
                        🚂 Hype Train Seviye 2 Başlat
                      </button>
                    </div>
                  )}

                  {selectedWidgetModal.id === 'shoutout' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => triggerWidgetTest('shoutout', { channel: 'YayınUstası', game: 'Valorant' })}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                      >
                        📢 Spotlight Simülasyonu
                      </button>
                    </div>
                  )}

                  {selectedWidgetModal.id === 'end-credits' && (
                    <button 
                      onClick={() => triggerWidgetTest('credits')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Kayan Jeneriği Başlat
                    </button>
                  )}

                  {/* Universal Fallback Test Button */}
                  <button 
                    onClick={() => triggerWidgetTest(selectedWidgetModal.id)}
                    className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-purple-400" />
                    <span>OBS'te Canlı Olayı Test Et</span>
                  </button>

                  {modalActionStatus && (
                    <div className="text-xs font-bold text-emerald-400 mt-2">
                      {modalActionStatus}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedWidgetModal(null)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CHAT OVERLAY SETTINGS (IMAGE 1 SPECIFICATIONS) */}
      {activeTab === 'chat_settings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Settings Form (Exact replication of Image 1) */}
          <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
            <div className="pb-3 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-white">Chat Overlay Özelleştirme</h2>
                <p className="text-xs text-gray-400">OBS sohbet kutunuzun görünüm ve kaybolma davranışlarını belirleyin.</p>
              </div>
              <span className="text-[10px] font-mono bg-purple-600/20 text-purple-300 border border-purple-500/30 px-2.5 py-1 rounded-full font-bold">
                OBS 450x700 px
              </span>
            </div>

            <form onSubmit={handleSaveChatSettings} className="space-y-4">
              {/* Maks. Mesaj */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Maks. mesaj
                </label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={chatConfig.maxMessages}
                  onChange={e => setChatConfig({ ...chatConfig, maxMessages: parseInt(e.target.value, 10) || 40 })}
                  className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Yazı boyutu (px) */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  Yazı boyutu (px)
                </label>
                <input
                  type="number"
                  min="10"
                  max="40"
                  value={chatConfig.fontSize}
                  onChange={e => setChatConfig({ ...chatConfig, fontSize: parseInt(e.target.value, 10) || 22 })}
                  className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* Checkboxes List (Replication of Image 1) */}
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.showPlatformLogo}
                    onChange={e => setChatConfig({ ...chatConfig, showPlatformLogo: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Platform logosu (Twitch / Kick / YouTube)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.showBadges}
                    onChange={e => setChatConfig({ ...chatConfig, showBadges: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Sohbet rozetleri (mod / abone / VIP)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.showTimestamp}
                    onChange={e => setChatConfig({ ...chatConfig, showTimestamp: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Saat göster</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.highlightSpecial}
                    onChange={e => setChatConfig({ ...chatConfig, highlightSpecial: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Super Chat / abonelik / raid vurgusu</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.fadeMessages}
                    onChange={e => setChatConfig({ ...chatConfig, fadeMessages: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Mesajlar zamanla kaybolsun</span>
                </label>
              </div>

              {/* Slider: Kaybolma süresi (saniye) */}
              <div className="pt-2 pl-7 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Kaybolma süresi (saniye)</span>
                  <div className="flex items-center gap-1 bg-[#12141a] border border-white/10 px-2.5 py-1 rounded-lg">
                    <span className="text-xs font-mono font-bold text-white">{chatConfig.fadeTimeout}</span>
                    <span className="text-[10px] text-gray-400">sn</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="3"
                  max="60"
                  value={chatConfig.fadeTimeout}
                  onChange={e => setChatConfig({ ...chatConfig, fadeTimeout: parseInt(e.target.value, 10) || 17 })}
                  className="w-full accent-purple-500 cursor-pointer h-1.5 bg-gray-700 rounded-lg"
                />
                <p className="text-[11px] text-gray-500">
                  Süre dolunca mesaj solar ve listeden çıkar (varsayılan 12 sn).
                </p>
              </div>

              {/* Bottom Checkboxes */}
              <div className="space-y-3 pt-3 border-t border-white/10">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.smoothMask}
                    onChange={e => setChatConfig({ ...chatConfig, smoothMask: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Liste üstü yumuşak maske (eski mesajlar soluk)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.textShadow}
                    onChange={e => setChatConfig({ ...chatConfig, textShadow: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Yazı gölgesi (OBS'te okunurluk)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer text-xs font-bold text-gray-200">
                  <input
                    type="checkbox"
                    checked={chatConfig.transparentBg}
                    onChange={e => setChatConfig({ ...chatConfig, transparentBg: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 text-purple-600 focus:ring-purple-500 accent-purple-600"
                  />
                  <span>Şeffaf arka plan</span>
                </label>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Ayarları Kaydet ve OBS'e Senkronize Et</span>
                </button>
              </div>
            </form>
          </div>

          {/* Right: Live Chatbox Simulation */}
          <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  Canlı ChatBox Simülatörü
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">OBS Önizleme (400x550)</span>
              </div>

              {/* Chat Simulation Canvas */}
              <div 
                className="mt-4 rounded-2xl border border-white/10 overflow-hidden relative"
                style={{
                  height: 380,
                  backgroundColor: chatConfig.transparentBg ? 'rgba(10, 12, 18, 0.7)' : '#0f1117',
                  backgroundImage: chatConfig.transparentBg ? 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)' : 'none',
                  backgroundSize: '16px 16px',
                  maskImage: chatConfig.smoothMask 
                    ? 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 15%, black 100%)' 
                    : 'none',
                  WebkitMaskImage: chatConfig.smoothMask 
                    ? 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.8) 15%, black 100%)' 
                    : 'none'
                }}
              >
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2.5 flex flex-col justify-end">
                  {/* Sample Message 1 */}
                  <div className="flex items-start gap-2 animate-fadeIn" style={{ fontSize: `${chatConfig.fontSize}px` }}>
                    {chatConfig.showPlatformLogo && <PlatformLogo platform="kick" size={18} showLabel={false} />}
                    {chatConfig.showBadges && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-300 text-[10px] font-black uppercase">
                        MOD
                      </span>
                    )}
                    <span className="font-black text-[#53fc18]" style={{ textShadow: chatConfig.textShadow ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                      Kaan:
                    </span>
                    <span className="text-white font-medium" style={{ textShadow: chatConfig.textShadow ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                      Selamlar! Harika yayın oluyor.
                    </span>
                    {chatConfig.showTimestamp && <span className="text-[10px] text-gray-500 self-center">14:22</span>}
                  </div>

                  {/* Sample Message 2 (Special Event) */}
                  <div 
                    className={`flex items-start gap-2 p-2 rounded-xl transition-all ${
                      chatConfig.highlightSpecial ? 'bg-gradient-to-r from-amber-500/20 to-transparent border-l-4 border-amber-400' : ''
                    }`}
                    style={{ fontSize: `${chatConfig.fontSize}px` }}
                  >
                    {chatConfig.showPlatformLogo && <PlatformLogo platform="twitch" size={18} showLabel={false} />}
                    {chatConfig.showBadges && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-300 text-[10px] font-black uppercase">
                        SUB
                      </span>
                    )}
                    <span className="font-black text-amber-400" style={{ textShadow: chatConfig.textShadow ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                      Ayşe:
                    </span>
                    <span className="text-amber-200 font-bold" style={{ textShadow: chatConfig.textShadow ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                      ⭐ 3. ayında abone oldu! "Nice yayınlara!"
                    </span>
                  </div>

                  {/* Sample Message 3 */}
                  <div className="flex items-start gap-2 animate-fadeIn" style={{ fontSize: `${chatConfig.fontSize}px` }}>
                    {chatConfig.showPlatformLogo && <PlatformLogo platform="youtube" size={18} showLabel={false} />}
                    <span className="font-black text-red-400" style={{ textShadow: chatConfig.textShadow ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                      Murat:
                    </span>
                    <span className="text-white font-medium" style={{ textShadow: chatConfig.textShadow ? '0 1px 3px rgba(0,0,0,0.9)' : 'none' }}>
                      Boss savaşında bol şans 🔥
                    </span>
                    {chatConfig.showTimestamp && <span className="text-[10px] text-gray-500 self-center">14:24</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* OBS Browser Source URL */}
            <div className="p-3.5 bg-black/50 border border-white/10 rounded-xl space-y-2">
              <span className="text-xs font-bold text-gray-300">OBS Bağımsız Chatbox URL:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${baseUrl}/widgets/chatbox`}
                  className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono select-all"
                />
                <button
                  onClick={() => copyToClipboard(`${baseUrl}/widgets/chatbox`)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copiedUrl === `${baseUrl}/widgets/chatbox` ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>Kopyala</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ALERTBOX SETTINGS & SIMULATOR */}
      {activeTab === 'alerts' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Alert Presets */}
          <div className="lg:col-span-5 glass-panel p-6 rounded-2xl border border-white/10 space-y-4">
            <h2 className="text-base font-extrabold text-white">Bildirim Şablonları</h2>
            <div className="space-y-2.5">
              {alerts.map(preset => (
                <div
                  key={preset.id}
                  onClick={() => setSelectedAlert(preset)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    selectedAlert?.id === preset.id
                      ? 'bg-purple-600/20 border-purple-500/50 shadow-lg shadow-purple-600/20'
                      : 'bg-[#12141a] border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: preset.accent_color || '#8b5cf6' }}
                    />
                    <div>
                      <h4 className="text-xs font-extrabold text-white capitalize">{preset.event_type}</h4>
                      <p className="text-[11px] text-gray-400 truncate max-w-[200px]">{preset.title_template}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500">{(preset.duration_ms || 5000) / 1000}s</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Alert Test & Simulator */}
          <div className="lg:col-span-7 glass-panel p-6 rounded-2xl border border-white/10 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                AlertBox Canlı Test Paneli
              </h3>
              <span className="text-xs text-gray-400">Tek tıkla test bildirimleri fırlatın</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                onClick={() => triggerWidgetTest('follow', { username: 'EmreCan' })}
                className="p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-xl text-xs font-bold text-purple-200 transition-all text-center"
              >
                💜 Takipçi Testi
              </button>
              <button
                onClick={() => triggerWidgetTest('sub', { username: 'Elif_Nur' })}
                className="p-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-200 transition-all text-center"
              >
                ⭐ Abone Testi
              </button>
              <button
                onClick={() => triggerWidgetTest('tip', { username: 'Mert', amount: 150, currency: 'TL' })}
                className="p-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-200 transition-all text-center"
              >
                💰 Bağış Testi
              </button>
              <button
                onClick={() => triggerWidgetTest('raid', { username: 'ProStreamer', viewers: 85 })}
                className="p-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 rounded-xl text-xs font-bold text-red-200 transition-all text-center"
              >
                🚀 Raid Testi
              </button>
            </div>

            {/* Standalone AlertBox URL */}
            <div className="p-4 bg-black/50 border border-white/10 rounded-xl space-y-2 mt-4">
              <span className="text-xs font-bold text-gray-300">OBS Bağımsız AlertBox URL:</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`${baseUrl}/widgets/alertbox`}
                  className="w-full bg-[#12141a] border border-white/10 rounded-xl px-3 py-2 text-xs text-purple-300 font-mono select-all"
                />
                <button
                  onClick={() => copyToClipboard(`${baseUrl}/widgets/alertbox`)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                >
                  {copiedUrl === `${baseUrl}/widgets/alertbox` ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>Kopyala</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OverlayStudio;
