import { useState, useEffect, useRef, useCallback } from 'react';
import { AlertPreset } from '../types.js';
import {
  Layers,
  Copy,
  Check,
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
  X,
  Move,
  Eye,
  EyeOff,
  Settings2,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
import { WidgetOnizleme } from '../components/WidgetOnizleme.js';
import { GALERI_KATMANI, KATMANLAR, OverlayKatmanlari } from '../widgets/OverlayLayers.js';
import { enBuyukBoyut, hizala, sinirla, yapistir, type Kilavuzlar, type Kutu, type Yon } from '../lib/hizala.js';
import { ChatBoxWidget } from '../widgets/ChatBoxWidget.js';
import { hedefWidgetKimligi } from '../lib/widget-defaults.js';
import { ayarKanalinaKatil, YERLESIM_KIMLIGI } from '../lib/ayarKanali.js';
import { SubathonPanel } from '../components/SubathonPanel.js';
import { OBS_EKLEME, WIDGET_IPUCLARI } from '../lib/widget-ipuclari.js';


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
    aciklama: 'Son olayları (takip, abone, bağış) listeler. Uyarıyı yeniden oynatma, susturma ve atlama denetimleri Genel Bakış’taki uyarı kuyruğu kartındadır (OBS kaynağı tıklanamaz).'
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
    aciklama: 'Aynı emote art arda gelince ekranda belirir, geldikçe büyür; gelmeyi kesince patlayıp etrafa saçılır.'
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
    baslik: 'Resonance — Şu An Çalan',
    aciklama: 'Spotify ya da YouTube Music’te gerçekten çalan şarkıyı kapak ve ilerlemeyle gösterir; görünümü Resonance’ta seçilir.'
  },
  'on-screen-emotes': {
    baslik: 'Ekranda Emojiler (Kappagen)',
    aciklama: "Sohbetteki Kick, 7TV ve emoji emote'larını ekranda uçurur; !kappagen ile ortadan patlatır."
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
  'word-cloud': {
    baslik: 'Kelime Bulutu',
    aciklama: 'Sohbette en çok konuşulanlar, sıklığa göre büyüyen sözcüklerle OBS’te.'
  },
  scoreboard: {
    baslik: 'Skor Tablosu',
    aciklama: 'İki ya da daha çok takımın skoru; moderatörler sohbetten günceller.'
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
  'muzik-video': {
    baslik: 'Şarkı Klipleri',
    aciklama: 'İzleyici şarkı isteklerini YouTube klibiyle sırayla oynatır; bitince sıradaki istek başlar.'
  },
  jumpscare: {
    baslik: 'JumpScare',
    aciklama: 'Bağış eşiği aşılınca tam ekran korku medyası oynatır; eşik ve süre ayarlanır.'
  }
};

/** Galeri önizlemesinin açılacağı boyut: widget'ın Tek URL katmanındaki varsayılan boyutu (OBS'teki gibi görünsün) */
function onizlemeBoyutu(galeriId: string): { w: number; h: number } | undefined {
  const anahtar = GALERI_KATMANI[galeriId]?.anahtar;
  const v = KATMANLAR.find((k) => k.anahtar === anahtar)?.varsayilan;
  // Ekran boyu şeritler (olay etiketleri 1840 px) önizlemede çok küçülmesin: genişlik 960 ile sınırlı
  return v && (v.width < 1900 || v.height < 1060) ? { w: Math.min(960, v.width), h: v.height } : undefined;
}

/** Galeri kimliği → sunucudaki test adı (widgets/test/:ad). Listede olmayanın ayrı testi yok, önizlemesi var. */
const TEST_ADI: Record<string, string> = {
  'activity-feed': 'activity-feed',
  'alert-box': 'alert-box',
  'emote-combo': 'emote-combo',
  'on-screen-emotes': 'on-screen-emotes',
  'the-cup': 'the-cup',
  'hype-train': 'hype-train',
  subathon: 'subathon',
  shoutout: 'shoutout',
  'end-credits': 'credits',
  'wheel-of-fortune': 'wheel',
  tts: 'tts',
  'cloud-tts': 'cloud-tts',
  jumpscare: 'jumpscare',
  'viewer-counter': 'viewer-counter',
  polls: 'polls',
  giveaways: 'giveaways',
  'loyalty-redemptions': 'loyalty-redemptions',
  // Eskiden testi olmayanlar (sunucuda yalnız katmana örnek gider)
  'chat-overlay': 'chat-overlay',
  'donation-goal': 'donation-goal',
  'follower-goal': 'follower-goal',
  'subscriber-goal': 'subscriber-goal',
  'kicks-goal': 'kicks-goal',
  'event-labels': 'event-labels',
  'pinned-messages': 'pinned-messages',
  king: 'king',
  scoreboard: 'scoreboard'
};

/** Widget seçme listesinde adın yanındaki simge */
const KATMAN_EMOJISI: Record<string, string> = {
  chat: '💬', alerts: '🔔', goals: '🎯', subathon: '⏳', trivia: '🧠', eventLabels: '🏷️', theCup: '🏆', polls: '📊',
  wheel: '🎡', hypeTrain: '🚂', nowPlaying: '🎵', emoteCombo: '🔥', lyrics: '🎤', king: '👑', jumpScare: '👻',
  activityFeed: '📰', giveaway: '🎁', pinned: '📌', shoutout: '📣', viewerCounter: '👀', rankings: '🥇', loyalty: '🎟️',
  kappagen: '🎉', endCredits: '🎬', tts: '🗣️', soundBoard: '🎛️', muzikVideo: '📺', wordCloud: '☁️', scoreboard: '🏅'
};

// Tek URL katmanı → ayar kimliği. Eskiden elle yazılmış 14 katmanla sınırlıydı: sabitlenmiş mesaj, shoutout,
// izleyici sayacı, sıralama, sadakat, jenerik vb. seçilince ayar paneli hiç açılmıyordu. Artık galeri
// eşlemesinden türetilir; aşağıdaki elle yazılanlar önceliklidir.
const KATMAN_AYAR_ID: Record<string, string> = {
  ...Object.fromEntries(Object.entries(GALERI_KATMANI).reverse().map(([galeriId, k]) => [k.anahtar, galeriId])),
  chat: 'chat-overlay',
  alerts: 'alert-box',
  goals: 'follower-goal',
  subathon: 'subathon',
  trivia: 'trivia',
  eventLabels: 'event-labels',
  polls: 'polls',
  wheel: 'wheel-of-fortune',
  emoteCombo: 'emote-combo',
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
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
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



export function OverlayStudio() {
  const [activeTab, setActiveTab] = useState<'all_in_one' | 'gallery' | 'chat_settings' | 'alerts'>('all_in_one');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  // All-in-One Single OBS Overlay State
  const [allInOne, setAllInOne] = useState<AllInOneConfig>(DEFAULT_ALL_IN_ONE_CONFIG);
  const [selectedCanvasWidget, setSelectedCanvasWidget] = useState<string>('chat');
  /** Tuval OBS'te görüneceği gibi mi (true) yoksa örnek verilerle mi çizilsin. */
  const [obsGorunumu, setObsGorunumu] = useState(false);
  // Artınca tuvaldeki widget'lar yeniden yüklenir
  const [tuvalAnahtari, setTuvalAnahtari] = useState(0);
  /** Seçili katmanın kendi ayar kaydı (hedef çubuğunda türe göre). */
  const seciliAyarId =
    selectedCanvasWidget === 'goals' ? hedefWidgetKimligi(allInOne.goals?.type) : KATMAN_AYAR_ID[selectedCanvasWidget];

  /**
   * Kullanıcı bildirdi: "Overlay Stüdyo'da yaptığım değişiklikler OBS'e
   * yansımıyor." Konum/boyut/aç-kapa yalnız "Kaydet"e basınca gidiyordu; hemen
   * yanındaki bileşen ayarları ise kendiliğinden kaydediliyordu — kullanıcı
   * ikisinin de kaydedildiğini sanıyordu. Artık yerleşim de kendiliğinden
   * kaydedilir (sürükleme bitince) ve sunucu OBS'e anında yayınlar.
   */
  type YerlesimDurumu = 'kaydedildi' | 'bekliyor' | 'kaydediliyor' | 'hata';
  const [yerlesimDurumu, setYerlesimDurumu] = useState<YerlesimDurumu>('kaydedildi');
  /** Sunucudaki yerleşim okunmadan otomatik kayıt YAPILMAZ (varsayılanlar kayıtlı ayarın üstüne yazılmasın). */
  const yerlesimYuklendi = useRef(false);
  /** Sunucuyla eşit olan son yerleşim (JSON) — aynısını yeniden göndermemek için. */
  const sonKaydedilen = useRef('');
  /** Kendi kaydımızın sunucudan geri yankısı, o arada yapılan yeni düzenlemeyi ezmesin. */
  const sonKendiKaydi = useRef(0);

  const yerlesimiKaydet = async (veri: AllInOneConfig): Promise<boolean> => {
    const json = JSON.stringify(veri);
    sonKendiKaydi.current = Date.now();
    setYerlesimDurumu('kaydediliyor');
    try {
      const r = await fetch('/api/overlay/all-in-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      sonKaydedilen.current = json;
      setYerlesimDurumu('kaydedildi');
      return true;
    } catch {
      setYerlesimDurumu('hata');
      return false;
    }
  };

  // Yerleşimi başka bir yer değiştirdi (sesli komut, başka panel sekmesi):
  // stüdyodaki eski hâl, sonraki otomatik kayıtta onun üstüne yazmasın.
  useEffect(
    () =>
      ayarKanalinaKatil({
        widgetId: YERLESIM_KIMLIGI,
        ayar: (config) => {
          if (!config || typeof config !== 'object' || !(config as any).chat) return;
          if (Date.now() - sonKendiKaydi.current < 2000) return; // kendi kaydımızın yankısı
          setAllInOne((prev) => {
            const yeni = { ...prev, ...(config as Partial<AllInOneConfig>) };
            sonKaydedilen.current = JSON.stringify(yeni);
            return yeni;
          });
        },
        tazele: () => {}
      }),
    []
  );

  // Canvas interactive drag-and-drop state
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /**
   * Tuval 1920x1080 cizilip CSS ile kuculuyor: boylece onizlemedeki her
   * piksel OBS'teki ayni pikseldir. Genislik degistikce yeniden olculur.
   */
  const [tuvalOlcek, setTuvalOlcek] = useState(1);
  /**
   * Gözlemci tuval öğesi HER oluştuğunda bağlanır (geri çağrılı ref).
   * Eskiden `useEffect(..., [])` yalnız ilk açılışta bağlıyordu: sekme
   * değişip tuval yeniden oluşunca ölçek güncellenmiyor, 1920 piksellik
   * tuvalin yalnız sol üst köşesi görünüyordu ("önizleme tam göstermiyor").
   */
  const tuvalGozlemci = useRef<ResizeObserver | null>(null);
  const tuvalRef = useCallback((el: HTMLDivElement | null) => {
    canvasRef.current = el;
    tuvalGozlemci.current?.disconnect();
    tuvalGozlemci.current = null;
    if (!el) return;
    const guncelle = () => setTuvalOlcek(Math.max(0.05, (el.clientWidth || 1920) / 1920));
    guncelle();
    const g = new ResizeObserver(guncelle);
    g.observe(el);
    tuvalGozlemci.current = g;
  }, []);
  useEffect(() => () => tuvalGozlemci.current?.disconnect(), []);
  const [isDragging, setIsDragging] = useState(false);
  const [kilavuz, setKilavuz] = useState<Kilavuzlar>({ dikey: [], yatay: [] });
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ pointerX: number; pointerY: number; widgetX: number; widgetY: number; origW: number; origH: number } | null>(null);

  // Otomatik kayıt: değişiklikten 400 ms sonra; sürükleme sırasında bekler
  useEffect(() => {
    if (!yerlesimYuklendi.current) return;
    const json = JSON.stringify(allInOne);
    if (json === sonKaydedilen.current) return;
    setYerlesimDurumu('bekliyor');
    if (isDragging || isResizing) return;
    const t = setTimeout(() => void yerlesimiKaydet(allInOne), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInOne, isDragging, isResizing]);

  const handleWidgetPointerDown = (e: React.PointerEvent, widgetKey: string) => {
    e.stopPropagation();
    // Yalnız seçili widget taşınır: başka widget'a tıklamak onu yalnız seçer (üst üste binen
    // widget'lardan istenmeyeni sürüklemek yerleşimi bozuyordu)
    if (widgetKey !== selectedCanvasWidget) {
      setSelectedCanvasWidget(widgetKey);
      return;
    }
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
      const kutu: Kutu = { x: 0, y: 0, width: curItem?.width || 300, height: curItem?.height || 200, scale: curItem?.scale };
      const hamX = dragStartRef.current.widgetX + deltaX;
      const hamY = dragStartRef.current.widgetY + deltaY;
      let newX: number;
      let newY: number;
      if (e.altKey) {
        ({ x: newX, y: newY } = sinirla(hamX, hamY, kutu));
        setKilavuz({ dikey: [], yatay: [] });
      } else {
        // Yalnız tuvalde görünen (açık) diğer katmanlara yapış
        const digerleri = KATMANLAR.map((k) => (allInOne as any)[k.anahtar])
          .filter((it, i) => it?.enabled && KATMANLAR[i].anahtar !== selectedCanvasWidget) as Kutu[];
        const yap = yapistir(hamX, hamY, kutu, digerleri);
        newX = yap.x;
        newY = yap.y;
        setKilavuz(yap.kilavuz);
      }
      setAllInOne(prev => ({
        ...prev,
        [selectedCanvasWidget]: {
          ...(prev as any)[selectedCanvasWidget],
          x: newX,
          y: newY
        }
      }));
    } else if (isResizing) {
      const curItem = (allInOne as any)[selectedCanvasWidget];
      const olcek = typeof curItem?.scale === 'number' && curItem.scale > 0 ? curItem.scale : 1;
      const enBuyuk = enBuyukBoyut({ x: dragStartRef.current.widgetX, y: dragStartRef.current.widgetY, width: 0, height: 0, scale: olcek });
      // Fare hareketi görünen boyutu değiştirir; ölçeksiz boyuta çevir
      const newW = Math.round(Math.max(100, Math.min(enBuyuk.width, dragStartRef.current.origW + deltaX / olcek)));
      const newH = Math.round(Math.max(40, Math.min(enBuyuk.height, dragStartRef.current.origH + deltaY / olcek)));
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
    setKilavuz({ dikey: [], yatay: [] });
    dragStartRef.current = null;
  };

  /** Seçili katmanı tuvale göre hizalar (görünen, yani ölçekli boyuta göre). */
  const hizalaSecili = (yon: Yon) => {
    const item = (allInOne as any)[selectedCanvasWidget];
    if (!item) return;
    const yeni = hizala({ x: item.x ?? 0, y: item.y ?? 0, width: item.width || 300, height: item.height || 200, scale: item.scale }, yon);
    setAllInOne(prev => ({ ...prev, [selectedCanvasWidget]: { ...(prev as any)[selectedCanvasWidget], ...yeni } }));
  };

  // Ok tuşları seçili katmanı 1 px (Shift ile 10 px) kaydırır; yazı alanındayken değil
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      const yon = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!yon) return;
      const hedef = e.target as HTMLElement | null;
      if (hedef && (hedef.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(hedef.tagName))) return;
      if (!canvasRef.current) return; // tuval görünmüyorsa (başka sekme) dokunma
      e.preventDefault();
      const adim = e.shiftKey ? 10 : 1;
      setAllInOne(prev => {
        const item = (prev as any)[selectedCanvasWidget];
        if (!item) return prev;
        const yeni = sinirla((item.x ?? 0) + yon[0] * adim, (item.y ?? 0) + yon[1] * adim, {
          x: 0, y: 0, width: item.width || 300, height: item.height || 200, scale: item.scale
        });
        return { ...prev, [selectedCanvasWidget]: { ...item, ...yeni } };
      });
    };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [selectedCanvasWidget]);

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
      if (!(await yerlesimiKaydet(updated))) throw new Error('kaydedilemedi');
      setTestNotification(
        nextVal
          ? '👁️ OBS Test/Önizleme Modu AÇILDI! (OBS ekranında tüm bileşenler örnek verilerle görünür)'
          : '👁️ OBS Test Modu KAPATILDI (Canlı yayın moduna dönüldü)'
      );
      setTimeout(() => setTestNotification(null), 4500);
    } catch {}
  };

  // Widget Gallery State (Image 2)
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedWidgetModal, setSelectedWidgetModal] = useState<any | null>(null);
  useEffect(() => {
    if (!selectedWidgetModal) return;
    const kapat = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedWidgetModal(null);
    window.addEventListener('keydown', kapat);
    return () => window.removeEventListener('keydown', kapat);
  }, [selectedWidgetModal]);
  const [modalActionStatus, setModalActionStatus] = useState<string | null>(null);

  // AlertBox State
  const [alerts, setAlerts] = useState<AlertPreset[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertPreset | null>(null);

  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const singleOverlayUrl = `${baseUrl}/widgets/overlay`;

  useEffect(() => {
    // Fetch All-in-One settings
    fetch('/api/overlay/all-in-one')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setAllInOne(prev => {
          const yeni = d && typeof d === 'object' && d.chat ? { ...prev, ...d } : prev;
          sonKaydedilen.current = JSON.stringify(yeni);
          return yeni;
        });
        yerlesimYuklendi.current = true;
      })
      .catch(() => setYerlesimDurumu('hata'));

    // Fetch Alerts
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => {
        setAlerts(d || []);
        if (d && d.length > 0) setSelectedAlert(d[0]);
      })
      .catch(() => {});
  }, []);

  /** Galerideki widget'ı tek OBS URL'sine ekler (katmanı açar) ve stüdyoda seçer. */
  const tekUrlyeEkle = (widgetId: string) => {
    const g = GALERI_KATMANI[widgetId];
    if (!g) return;
    const tanim = KATMANLAR.find((k) => k.anahtar === g.anahtar);
    setAllInOne((prev) => ({
      ...prev,
      [g.anahtar]: { scale: 1, ...tanim?.varsayilan, ...(prev as any)[g.anahtar], ...g.ek, enabled: true }
    }));
    setSelectedCanvasWidget(g.anahtar);
    setSelectedWidgetModal(null);
    setActiveTab('all_in_one');
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleSaveAllInOne = async () => {
    yerlesimYuklendi.current = true;
    const ok = await yerlesimiKaydet(allInOne);
    if (ok) confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
    setTestNotification(
      ok
        ? '✨ Yerleşim kaydedildi ve OBS\'teki overlay\'e uygulandı!'
        : '❌ Kaydedilemedi — StreamAxT çalışıyor mu? Tekrar deneyin.'
    );
    setTimeout(() => setTestNotification(null), 4000);
  };

  /** OBS'teki Tek URL'yi ve buradaki tuvali yeniden yükler. */
  const tekUrlYenile = async () => {
    setTuvalAnahtari((n) => n + 1);
    const res = await fetch('/api/overlay/reload', { method: 'POST' }).catch(() => null);
    setTestNotification(res?.ok ? "Tek URL yenilendi: OBS kaynağı ve önizleme yeniden yüklendi." : 'Yenilenemedi: sunucuya ulaşılamadı.');
    setTimeout(() => setTestNotification(null), 3000);
  };

  /** Test olayı örnek kipte görünmez: tuval OBS görünümüne geçer. */
  const katmaniTestEt = async (etiket: string, testAdi: string) => {
    setObsGorunumu(true);
    await triggerWidgetTest(testAdi);
    setTestNotification(`${etiket} testi gönderildi.`);
    setTimeout(() => setTestNotification(null), 3000);
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
      url: `${baseUrl}/widgets/activity-feed`
    },
    {
      id: 'alert-box',
      category: 'On-Stream',
      icon: Bell,
      url: `${baseUrl}/widgets/alertbox`
    },
    {
      id: 'chat-overlay',
      category: 'Engagement',
      icon: MessageSquare,
      url: `${baseUrl}/widgets/chatbox`
    },
    {
      id: 'cloud-tts',
      category: 'Audio & AI',
      icon: Cloud,
      url: `${baseUrl}/widgets/audio-player`
    },
    {
      id: 'donation-goal',
      category: 'Goals',
      icon: DollarSign,
      url: `${baseUrl}/widgets/donation-goal`
    },
    {
      id: 'emote-combo',
      category: 'Engagement',
      icon: Smile,
      url: `${baseUrl}/widgets/emote-combo`
    },
    {
      id: 'end-credits',
      category: 'On-Stream',
      icon: Film,
      url: `${baseUrl}/widgets/credits`
    },
    {
      id: 'event-labels',
      category: 'On-Stream',
      icon: Tag,
      url: `${baseUrl}/widgets/event-labels`
    },
    {
      id: 'follower-goal',
      category: 'Goals',
      icon: TrendingUp,
      url: `${baseUrl}/widgets/follower-goal`
    },
    {
      id: 'giveaways',
      category: 'Engagement',
      icon: Gift,
      url: `${baseUrl}/widgets/giveaways`
    },
    {
      id: 'hype-train',
      category: 'Engagement',
      icon: Train,
      url: `${baseUrl}/widgets/hype-train`
    },
    {
      id: 'loyalty-redemptions',
      category: 'Engagement',
      icon: Trophy,
      url: `${baseUrl}/widgets/loyalty-redeem`
    },
    {
      id: 'now-playing',
      category: 'Audio & AI',
      icon: Music,
      url: `${baseUrl}/resonance/overlay`
    },
    {
      id: 'on-screen-emotes',
      category: 'Engagement',
      icon: Smile,
      url: `${baseUrl}/widgets/emotes`
    },
    {
      id: 'pinned-messages',
      category: 'On-Stream',
      icon: Pin,
      url: `${baseUrl}/widgets/pinned`
    },
    {
      id: 'polls',
      category: 'Engagement',
      icon: BarChart3,
      url: `${baseUrl}/widgets/polls`
    },
    {
      id: 'shoutout',
      category: 'On-Stream',
      icon: Megaphone,
      url: `${baseUrl}/widgets/shoutout`
    },
    {
      id: 'subathon',
      category: 'Goals',
      icon: Hourglass,
      url: `${baseUrl}/widgets/subathon`
    },
    {
      id: 'subscriber-goal',
      category: 'Goals',
      icon: Target,
      url: `${baseUrl}/widgets/subscriber-goal`
    },
    {
      id: 'the-cup',
      category: 'Engagement',
      icon: Wine,
      url: `${baseUrl}/widgets/the-cup`
    },
    {
      id: 'word-cloud',
      category: 'Engagement',
      icon: Cloud,
      url: `${baseUrl}/widgets/word-cloud`
    },
    {
      id: 'scoreboard',
      category: 'Engagement',
      icon: Trophy,
      url: `${baseUrl}/widgets/scoreboard`
    },
    {
      id: 'tts',
      category: 'Audio & AI',
      icon: Volume2,
      url: `${baseUrl}/widgets/audio-player`
    },
    {
      id: 'viewer-counter',
      category: 'On-Stream',
      icon: Users,
      url: `${baseUrl}/widgets/viewer-counter`
    },
    {
      id: 'trivia-quiz',
      category: 'Engagement',
      icon: HelpCircle,
      url: `${baseUrl}/widgets/trivia`
    },
    {
      id: 'wheel-of-fortune',
      category: 'Engagement',
      icon: Disc,
      url: `${baseUrl}/widgets/wheel`
    },
    {
      id: 'kicks-goal',
      category: 'Goals',
      icon: Gem,
      url: `${baseUrl}/widgets/kicks-goal`
    },
    // Ayar sistemine yeni bağlanan dört widget galeride hiç görünmüyordu:
    // OBS adresleri vardı ama panelden ayarlanamıyorlardı.
    {
      id: 'rankings',
      category: 'On-Stream',
      icon: Trophy,
      url: `${baseUrl}/widgets/rankings`
    },
    {
      id: 'lyrics',
      category: 'On-Stream',
      icon: Disc,
      url: `${baseUrl}/widgets/lyrics`
    },
    {
      id: 'muzik-video',
      category: 'On-Stream',
      icon: Disc,
      url: `${baseUrl}/widgets/muzik-video`
    },
    {
      id: 'king',
      category: 'Engagement',
      icon: Gem,
      url: `${baseUrl}/widgets/king`
    },
    {
      id: 'jumpscare',
      category: 'Alerts',
      icon: Eye,
      url: `${baseUrl}/widgets/jumpscare`
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
          <p className="text-sm text-gray-400">Tek adresle bütün yayın ya da tek tek widget'lar.</p>
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
            <span>Tek URL</span>
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
            <span>Widget'lar ({widgetGalleryItemsTr.length})</span>
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
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 p-3.5 bg-[#1b1430] border border-purple-500/40 rounded-xl shadow-xl text-purple-200 text-xs font-bold animate-fadeIn">
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
                <h3 className="text-sm font-medium text-white">OBS adresi</h3>
                {allInOne.testMode && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-md font-bold animate-pulse">
                    Test modu açık
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">Bu adresi OBS'e 1920×1080 Tarayıcı Kaynağı olarak ekleyin.</p>
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
                <span>{allInOne.testMode ? 'Test modunu kapat' : 'Test modu'}</span>
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
                    Yayın ekranı
                  </h3>
                  <p className="text-xs text-gray-400">
                    Sürükleyerek taşıyın, köşeden boyutlandırın.
                  </p>
                </div>
                <span
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                    yerlesimDurumu === 'hata'
                      ? 'bg-red-500/15 border-red-500/40 text-red-300'
                      : yerlesimDurumu === 'kaydedildi'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/5 border-white/10 text-gray-300'
                  }`}
                  title="Tuvaldeki konum/boyut değişiklikleri kendiliğinden kaydedilir ve OBS'teki overlay'e anında yansır"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>
                    {yerlesimDurumu === 'kaydediliyor' || yerlesimDurumu === 'bekliyor'
                      ? 'Kaydediliyor…'
                      : yerlesimDurumu === 'hata'
                        ? 'Kaydedilemedi'
                        : 'OBS ile eşit'}
                  </span>
                </span>
              </div>

              {/* Önizleme kipi: örnek veri mi, OBS'in o an gösterdiği mi? Kullanıcı
                  "önizlemede görünenler OBS'te görünmüyor" dedi: tuval her bileşeni
                  örnek veriyle (ve kapalı katmanları soluk) gösteriyordu; OBS ise
                  yalnız AÇIK katmanları, gerçek olay geldikçe çiziyor. */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <div role="tablist" aria-label="Önizleme kipi" className="flex gap-1">
                  {([
                    [false, 'Örnek verilerle', 'Her bileşeni örnek içerikle gösterir (yerleşim için)'],
                    [true, "OBS'te görüneceği gibi", "OBS'in şu an gösterdiğinin aynısı: kapalı katmanlar yok, örnekler yalnız OBS Test Modu açıksa"]
                  ] as const).map(([deger, ad, ipucu]) => (
                    <button
                      key={ad}
                      type="button"
                      role="tab"
                      aria-selected={obsGorunumu === deger}
                      title={ipucu}
                      onClick={() => setObsGorunumu(deger)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        obsGorunumu === deger ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-white/10'
                      }`}
                    >
                      {ad}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => void tekUrlYenile()}
                  title="OBS'teki Tek URL kaynağını ve bu önizlemeyi yeniden yükler"
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Yenile
                </button>
                <p className="text-[10px] text-gray-400 max-w-md">
                  {obsGorunumu
                    ? allInOne.testMode
                      ? 'OBS Test Modu açık: OBS de örnek verileri gösteriyor.'
                      : 'Gerçek veri: uyarı, anket, çark gibi bileşenler olay geldiğinde görünür.'
                    : 'Örnekler yalnız burada; OBS’te de görmek için “OBS Test Modunu Aç”.'}
                </p>
              </div>

              {/* Açık katmanların testleri: yayında görünür, bitince önceki hâline döner */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-gray-400 mr-1">Test:</span>
                {KATMANLAR.filter((k) => (allInOne as any)[k.anahtar]?.enabled && TEST_ADI[KATMAN_AYAR_ID[k.anahtar]]).map((k) => (
                  <button
                    key={k.anahtar}
                    type="button"
                    onClick={() => void katmaniTestEt(k.etiket, TEST_ADI[KATMAN_AYAR_ID[k.anahtar]])}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                  >
                    {KATMAN_EMOJISI[k.anahtar] || '🧩'} {k.etiket}
                  </button>
                ))}
              </div>

              {/* 16:9 Screen Simulation Box (Interactive Drag Canvas) */}
              <div 
                ref={tuvalRef}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className="axt-onizleme relative w-full aspect-video bg-[#07090e] rounded-lg border border-white/10 overflow-hidden select-none cursor-default mx-auto"
                // Pencere alçakken tuval ekrandan taşmasın: yükseklik görünür alana sığar, 16:9 korunur
                style={{ touchAction: 'none', maxWidth: 'max(320px, calc((100vh - 180px) * 16 / 9))' }}
              >
                {/* Background Stream Grid Pattern & Aspect Ratio Watermark */}
                <div 
                  className="absolute inset-0 opacity-20 pointer-events-none" 
                  style={{ backgroundImage: 'radial-gradient(#8b5cf6 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                />

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
                    key={tuvalAnahtari}
                    config={allInOne as any}
                    onizleme={obsGorunumu ? Boolean(allInOne.testMode) : true}
                    sarmala={(katman, icerik, stil) => {
                      const item = (allInOne as any)[katman.anahtar];
                      const secili = selectedCanvasWidget === katman.anahtar;
                      // OBS görünümü: kapalı katman OBS'te hiç çizilmez, burada da yok
                      if (obsGorunumu && !item?.enabled) return null;
                      // Düzenleme görünümü: kapalı katman yalnız seçiliyken (konumlandırmak için) soluk çizilir;
                      // tam ekran katmanlar (JumpScare, ekranda emote) seçili değilken çizilmez. Eskiden 28
                      // katmanın hepsi çiziliyor, açık JumpScare tuvali kaplayıp tüm tıklamaları yutuyordu.
                      if (!obsGorunumu && !secili && (!item?.enabled || katman.tamEkran)) return null;
                      const tiklanir = !katman.tamEkran || secili;
                      return (
                        <div
                          onPointerDown={tiklanir ? (e) => handleWidgetPointerDown(e, katman.anahtar) : undefined}
                          title={secili ? katman.etiket : `${katman.etiket} — seçmek için tıkla`}
                          style={{
                            ...stil,
                            // Seçili widget düzenlemede üstte: başka widget'ın altında kalsa da tutulabilsin
                            ...(secili && !obsGorunumu ? { zIndex: 9000 } : null),
                            cursor: secili ? 'move' : 'pointer',
                            pointerEvents: tiklanir ? undefined : 'none',
                            // Kapalı katman tuvalde soluk görünür ki
                            // konumlandırılabilsin; OBS'te hiç çizilmez.
                            outline: secili ? `3px ${item?.enabled ? 'solid' : 'dashed'} #a78bfa` : '1px dashed rgba(167,139,250,0.35)',
                            outlineOffset: 2,
                            borderRadius: 6
                          }}
                        >
                          {item?.enabled ? (
                            <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>{icerik}</div>
                          ) : (
                            // Kaldırılan (Tek URL'ye dahil olmayan) widget içeriğiyle çizilmez: eskiden seçili kaldığı
                            // için soluk hâliyle tuvalde duruyor, kaldırılmamış sanılıyordu. Yalnız yeri belli olur.
                            <div style={{ pointerEvents: 'none', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(167,139,250,0.08)', color: '#c4b5fd', fontSize: 22, fontWeight: 800, textAlign: 'center', padding: 8 }}>
                              {katman.etiket} — kapalı (Tek URL'de yok)
                            </div>
                          )}
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
                  {kilavuz.dikey.map((x) => (
                    <div key={'d' + x} style={{ position: 'absolute', left: x - 1, top: 0, width: 2, height: 1080, background: '#f472b6', zIndex: 9999, pointerEvents: 'none' }} />
                  ))}
                  {kilavuz.yatay.map((y) => (
                    <div key={'y' + y} style={{ position: 'absolute', top: y - 1, left: 0, height: 2, width: 1920, background: '#f472b6', zIndex: 9999, pointerEvents: 'none' }} />
                  ))}
                </div>

              </div>
            </div>

            {/* Right: Detailed Component Positioning & Settings Panel */}
            <div className="lg:col-span-4 glass-panel p-5 rounded-2xl border border-white/10 space-y-4">
              <div className="pb-3 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-extrabold text-white flex items-center gap-1.5">
                    <Settings2 className="w-4 h-4 text-purple-400" />
                    Seçili widget
                  </h3>
                  <p className="text-xs text-gray-400">Konumu ve görünürlüğü buradan ayarlanır.</p>
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
                  <option value="theCup">🏆 The Cup (Jeton Kavanozu)</option>
                  <option value="polls">📊 Canlı Anket (Polls)</option>
                  <option value="wheel">🎡 Çarkıfelek</option>
                  <option value="hypeTrain">🚂 Hype Treni</option>
                  <option value="nowPlaying">🎵 Resonance (şu an çalan)</option>
                  <option value="emoteCombo">🔥 Emote Kombo</option>
                  <option value="lyrics">🎤 Canlı Şarkı Sözleri (Lyrics)</option>
                  <option value="king">👑 Tahtın Kralı (King System)</option>
                  <option value="jumpScare">👻 JumpScare Katmanı</option>
                  {KATMANLAR.slice(KATMANLAR.findIndex((k) => k.anahtar === 'activityFeed')).filter((k) => k.anahtar !== 'jumpScare').map((k) => (
                    <option key={k.anahtar} value={k.anahtar}>
                      {KATMAN_EMOJISI[k.anahtar] || '🧩'} {k.etiket}
                    </option>
                  ))}
                </select>
              </div>


              {/* Selected Widget Card */}
              {(() => {
                // Yeni katmanların kayıtlı yerleşimi yoksa varsayılanından başlanır
                const tanim = KATMANLAR.find((k) => k.anahtar === selectedCanvasWidget);
                const cur = (allInOne as any)[selectedCanvasWidget] || (tanim ? { enabled: false, scale: 1, ...tanim.varsayilan } : null);
                if (!cur) return null;

                const updateCur = (patch: any) => {
                  setAllInOne(prev => ({
                    ...prev,
                    [selectedCanvasWidget]: {
                      ...((prev as any)[selectedCanvasWidget] || cur),
                      ...patch
                    }
                  }));
                };

                const kendiUrl =
                  selectedCanvasWidget === 'soundBoard'
                    ? `${baseUrl}/widgets/pano`
                    : widgetGalleryItems.find((w) => w.id === seciliAyarId || GALERI_KATMANI[w.id]?.anahtar === selectedCanvasWidget)?.url;

                return (
                  <div className="space-y-4">
                    {kendiUrl && (
                      <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 space-y-1.5">
                        <span className="text-xs font-bold text-white block">Bu widget'ın kendi adresi</span>
                        <span className="text-[10px] text-gray-400 block">OBS'te Tek URL olmadan ayrı kaynak olarak eklemek için</span>
                        <div className="space-y-1.5">
                          <p
                            data-widget-adresi
                            className="bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-purple-300 font-mono break-all select-all"
                          >
                            {kendiUrl}
                          </p>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(kendiUrl)}
                            className="w-full justify-center px-2.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1"
                          >
                            {copiedUrl === kendiUrl ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedUrl === kendiUrl ? 'Kopyalandı' : 'Kopyala'}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Include in Single OBS URL Toggle */}
                    <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">Yayında göster</span>
                        <span className="text-[10px] text-gray-400">Kapalıysa OBS'te görünmez</span>
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
                        <span>Konum ve boyut</span>
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
                      <div className="grid grid-cols-3 gap-1.5 pt-1" role="group" aria-label="Hizalama">
                        {([
                          ['sol', '⇤ Sola'], ['yatayOrta', '↔️ Yatay orta'], ['sag', 'Sağa ⇥'],
                          ['ust', '⤒ Üste'], ['dikeyOrta', '↕️ Dikey orta'], ['alt', 'Alta ⤓']
                        ] as Array<[Yon, string]>).map(([yon, etiket]) => (
                          <button
                            key={yon}
                            onClick={() => hizalaSecili(yon)}
                            className="px-2 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-bold text-gray-200 transition-colors"
                          >
                            {etiket}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-gray-500 leading-snug">
                        Sürüklerken kenarlara, ortaya ve diğer katmanlara yapışır (Alt basılı: serbest). Ok tuşları 1 px, Shift+ok 10 px kaydırır.
                      </p>
                      <div className="grid grid-cols-1 gap-1.5">
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

                        {/* Düzen, animasyon, süre ve ses eskiden burada AYRI alanlardı ama hiçbir
                            bileşen onları okumuyordu (OBS'e yansımıyordu). Gerçek ayarlar aşağıdaki
                            "Seçili Bileşen Ayarları"nda; OBS ile önizleme aynı kaydı kullanır. */}
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          Düzen, animasyon, yazı efekti ve ses düzeyi aşağıdaki <b className="text-cyan-300">Seçili Bileşen Ayarları</b> bölümünden değişir ve anında OBS'e gider.
                        </p>

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

                    {/* Hedef türü: tuvaldeki hedef çubuğunun HANGİ hedefi göstereceği. Başlık, hedef ve
                        mevcut değer o hedefin kendi ayarlarındadır (aşağıda) — eskiden buradaki kopya
                        alanlar hiçbir yere bağlı değildi. */}
                    {selectedCanvasWidget === 'goals' && (
                      <div className="p-3 bg-[#11131a] rounded-xl border border-white/10 space-y-1.5 text-xs">
                        <label className="text-[10px] text-gray-400 block font-bold">Gösterilecek hedef</label>
                        <select
                          value={hedefWidgetKimligi(cur.type)}
                          onChange={e => updateCur({ type: ({ 'follower-goal': 'follower', 'subscriber-goal': 'sub', 'donation-goal': 'tip', 'kicks-goal': 'kicks' } as Record<string, string>)[e.target.value] })}
                          className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                        >
                          <option value="follower-goal">Takipçi hedefi</option>
                          <option value="subscriber-goal">Abone hedefi</option>
                          <option value="donation-goal">Bağış hedefi</option>
                          <option value="kicks-goal">KICKs hedefi</option>
                        </select>
                        <p className="text-[10px] text-gray-500">Başlık, hedef miktarı ve mevcut değer aşağıdaki ayarlardadır.</p>
                      </div>
                    )}

                  </div>
                );
              })()}

              {/* Seçili bileşenin KENDİ ayarları — değişiklik anında OBS'e gider. */}
              {seciliAyarId && (
                <div className="pt-1">
                  <div className="flex items-center justify-between pb-2">
                    <h4 className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
                      Seçili Bileşen Ayarları
                    </h4>
                    <span className="text-[10px] text-emerald-400">otomatik kaydedilir</span>
                  </div>
                  <WidgetSettingsForm
                    key={seciliAyarId}
                    widgetId={seciliAyarId}
                    baseUrl={baseUrl}
                  />
                </div>
              )}

              <button
                onClick={handleSaveAllInOne}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Şimdi Kaydet</span>
              </button>
              <p className={`text-[10px] text-center ${yerlesimDurumu === 'hata' ? 'text-red-400' : 'text-gray-500'}`}>
                {yerlesimDurumu === 'kaydediliyor'
                  ? 'Kaydediliyor…'
                  : yerlesimDurumu === 'bekliyor'
                    ? 'Değişiklik birazdan kaydedilecek…'
                    : yerlesimDurumu === 'hata'
                      ? 'Kaydedilemedi — StreamAxT çalışıyor mu? Tekrar deneyin.'
                      : 'Konum ve boyut değişiklikleri kendiliğinden kaydedilir ve OBS\'e yansır.'}
              </p>
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
                    {WIDGET_IPUCLARI[widget.id]?.[0] && (
                      <p className="text-[11px] text-purple-200/80 mt-2 leading-snug line-clamp-2">💡 {WIDGET_IPUCLARI[widget.id][0]}</p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <span className="text-[10px] font-medium text-gray-500">{KATEGORI_ADI[widget.category] || widget.category}</span>
                    <div className="flex items-center gap-1">
                    {TEST_ADI[widget.id] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void triggerWidgetTest(TEST_ADI[widget.id]);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-purple-300 transition-colors text-[11px] font-bold"
                        title="Hızlı test: OBS'te örnek göster"
                        aria-label="Hızlı test"
                      >
                        ▶
                      </button>
                    )}
                    {GALERI_KATMANI[widget.id] && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          tekUrlyeEkle(widget.id);
                        }}
                        className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-emerald-300 transition-colors"
                        title="Tek OBS URL'sine ekle"
                        aria-label="Tek OBS URL'sine ekle"
                      >
                        <Monitor className="w-3.5 h-3.5" />
                      </button>
                    )}
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
                </div>
              );
            })}
          </div>

          {/* Interactive Widget Settings & Test Modal */}
          {selectedWidgetModal && (
            // Ayarlar kendiliğinden kaydedilir: boşluğa tıklamak kapatır (içerideki seçimden sürükleyip dışarıda bırakmak kapatmaz)
            <div
              className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setSelectedWidgetModal(null);
              }}
            >
              <div className="bg-[#14161f] border border-white/15 rounded-2xl max-w-6xl w-full p-6 space-y-5 shadow-2xl animate-fadeIn max-h-[92vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <selectedWidgetModal.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                        {selectedWidgetModal.title}
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

                {/* Nasıl çalışır? */}
                {WIDGET_IPUCLARI[selectedWidgetModal.id] && (
                  <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 space-y-1.5">
                    <h4 className="text-xs font-bold text-purple-200">💡 Nasıl çalışır?</h4>
                    <ul className="text-[11px] text-gray-300 space-y-1 list-disc pl-4">
                      {WIDGET_IPUCLARI[selectedWidgetModal.id].map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                      <li className="text-gray-400">{OBS_EKLEME}</li>
                    </ul>
                  </div>
                )}

                {selectedWidgetModal.id === 'now-playing' ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-gray-300 space-y-2">
                    <p>Görünüm (tema, renk, animasyon, kapak biçimi) Resonance’ın kendi ekranında ayarlanır; OBS adresi aynı kalır.</p>
                    <a href="/resonance/" target="_blank" rel="noreferrer" className="inline-block px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold">
                      🎵 Resonance’ı aç
                    </a>
                  </div>
                ) : (
                  // Ayarlar solda (geniş), önizleme sağda sabit genişlikte (kaydırırken görünür kalır)
                  <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4 items-start">
                    <WidgetSettingsForm widgetId={selectedWidgetModal.id} baseUrl={baseUrl} />
                    <div className="lg:sticky lg:top-0">
                      <WidgetOnizleme url={selectedWidgetModal.url} testAdi={TEST_ADI[selectedWidgetModal.id]} boyut={onizlemeBoyutu(selectedWidgetModal.id)} />
                    </div>
                  </div>
                )}

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
                  {GALERI_KATMANI[selectedWidgetModal.id] && (
                    <button
                      onClick={() => tekUrlyeEkle(selectedWidgetModal.id)}
                      className="mt-2 w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Monitor className="w-4 h-4" />
                      <span>Tek OBS URL'sine ekle (ayrı kaynak gerekmez)</span>
                    </button>
                  )}
                </div>

                {/* Widget Specific Action & Test Panel */}
                <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-bold text-gray-200">Canlı İşlev & Test Kontrolleri</h4>
                  {TEST_ADI[selectedWidgetModal.id] ? (
                    <button
                      onClick={() => triggerWidgetTest(TEST_ADI[selectedWidgetModal.id])}
                      className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                    >
                      ▶ Hızlı test (OBS'te örnek göster)
                    </button>
                  ) : (
                    <p className="text-[11px] text-gray-500">Bu widget gerçek olayla çalışır; örnek görünüm yukarıdaki önizlemede.</p>
                  )}

                  {/* Dynamic controls according to widget */}
                  {selectedWidgetModal.id === 'the-cup' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'coin', count: 3 })} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold">
                        🪙 3 bağış
                      </button>
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'sub', count: 2 })} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold">
                        ⭐ 2 abone
                      </button>
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'gift', count: 5 })} className="px-3 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold">
                        🎁 5 hediye abone
                      </button>
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'kicks', count: 3 })} className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold">
                        🟢 3 KICKs
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Kupanın içi tamamen boşaltılsın mı?')) return;
                          await fetch('/api/cup/reset', { method: 'POST' }).catch(() => {});
                          setModalActionStatus('🗑️ Kupa sıfırlandı');
                          setTimeout(() => setModalActionStatus(null), 2500);
                        }}
                        className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-xl text-xs font-bold"
                      >
                        🗑️ Kupayı sıfırla
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
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={async () => {
                          await fetch('/api/hype-train/start', { method: 'POST' }).catch(() => {});
                          setModalActionStatus('🚂 Tren sıfırdan başlatıldı');
                          setTimeout(() => setModalActionStatus(null), 2500);
                        }}
                        className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                      >
                        ▶ Treni başlat (sıfırdan)
                      </button>
                      <button
                        onClick={async () => {
                          await fetch('/api/hype-train/reset', { method: 'POST' }).catch(() => {});
                          setModalActionStatus('⏹ Tren durduruldu');
                          setTimeout(() => setModalActionStatus(null), 2500);
                        }}
                        className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-xl text-xs font-bold"
                      >
                        ⏹ Durdur / sıfırla
                      </button>
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

            {/* Eskiden burada ayrı bir form vardı ve `chat_overlay_settings` kaydına yazıyordu;
                OBS'teki sohbet bileşeni o kaydı HİÇ okumuyordu ("önizlemede başka, OBS'te başka").
                Artık gerçek bileşenin kendi ayarları: değişiklik kendiliğinden kaydedilir ve OBS'e gider. */}
            <WidgetSettingsForm widgetId="chat-overlay" baseUrl={baseUrl} />
          </div>

          {/* Right: Live Chatbox Simulation */}
          <div className="lg:col-span-6 glass-panel p-6 rounded-2xl border border-white/10 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="w-4 h-4 text-emerald-400" />
                  Canlı Önizleme (OBS ile aynı bileşen)
                </h3>
                <span className="text-[10px] text-gray-400 font-mono">OBS Önizleme (400x550)</span>
              </div>

              {/* GERÇEK sohbet bileşeni (OBS'tekiyle aynı kod ve ayarlar); sohbet boşken örnek mesajlar */}
              <div
                className="mt-4 rounded-2xl border border-white/10 overflow-hidden relative bg-[#07090e]"
                style={{ height: 420, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '16px 16px' }}
              >
                <ChatBoxWidget embedded previewMode />
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
