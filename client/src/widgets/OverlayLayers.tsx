/**
 * StreamAxT — ortak overlay katmanları
 * Developed by AxthrowA
 *
 * Kullanıcı bildirdi: "OBS overlay & widget stüdyosunda önizlemede görünen
 * ile OBS'te görünen aynı değil."
 *
 * Sebep: `UnifiedOverlayWidget` (OBS'in yüklediği sayfa) GERÇEK widget
 * bileşenlerini render ediyordu; Overlay Stüdyo'nun tuvali ise her katman
 * için elle yazılmış sahte maketler çiziyordu (`03:45:20`, `🪙 x12`,
 * `HYPE TRENİ (Lv. 2) %80` gibi sabit metinler). İki ayrı uygulama olduğu
 * için kaçınılmaz olarak birbirinden uzaklaştılar.
 *
 * Çözüm: katman listesi TEK yerde. Hem OBS çıktısı hem stüdyo önizlemesi
 * bu bileşeni kullanır, dolayısıyla bir daha ayrışamazlar.
 * (TARGET_ARCHITECTURE §8: "Preview ile gerçek widget birbirinden tamamen
 * farklı iki implementation olmasın.")
 */
import type { CSSProperties, ReactNode } from 'react';
import { ChatBoxWidget } from './ChatBoxWidget.js';
import { AlertBoxWidget } from './AlertBoxWidget.js';
import { EmoteComboWidget } from './EmoteComboWidget.js';
import { SubathonWidget } from './SubathonWidget.js';
import { EventLabelsWidget } from './EventLabelsWidget.js';
import { ResonanceWidget } from './ResonanceWidget.js';
import { TheCupWidget } from './TheCupWidget.js';
import { PollsWidget } from './PollsWidget.js';
import { GoalWidget } from './GoalWidget.js';
import { WheelWidget } from './WheelWidget.js';
import { HypeTrainWidget } from './HypeTrainWidget.js';
import LyricsWidget from './LyricsWidget.js';
import KingWidget from './KingWidget.js';
import TriviaWidget from './TriviaWidget.js';
import { ActivityFeedWidget } from './ActivityFeedWidget.js';
import { GiveawayWidget } from './GiveawayWidget.js';
import { PinnedMessageWidget } from './PinnedMessageWidget.js';
import { ShoutoutWidget } from './ShoutoutWidget.js';
import { ViewerCounterWidget } from './ViewerCounterWidget.js';
import { RankingsWidget } from './RankingsWidget.js';
import { LoyaltyStoreWidget } from './LoyaltyStoreWidget.js';
import { KappagenWidget } from './KappagenWidget.js';
import { JumpScareWidget } from './JumpScareWidget.js';
import { EndCreditsWidget } from './EndCreditsWidget.js';
import { AudioPlayerWidget } from './AudioPlayerWidget.js';
import { SoundBoardWidget } from './SoundBoardWidget.js';
import { MuzikVideoWidget } from './MuzikVideoWidget.js';
import { hedefWidgetKimligi } from '../lib/widget-defaults.js';

export interface WidgetLayoutItem {
  enabled?: boolean;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  scale?: number;
  [k: string]: any;
}

/** Tuvaldeki katman anahtarları — `AllInOneConfig` ile birebir aynı. */
export type KatmanAnahtari =
  | 'eventLabels'
  | 'goals'
  | 'subathon'
  | 'alerts'
  | 'chat'
  | 'emoteCombo'
  | 'nowPlaying'
  | 'theCup'
  | 'polls'
  | 'wheel'
  | 'hypeTrain'
  | 'lyrics'
  | 'king'
  | 'trivia'
  | 'activityFeed'
  | 'giveaway'
  | 'pinned'
  | 'shoutout'
  | 'viewerCounter'
  | 'rankings'
  | 'loyalty'
  | 'kappagen'
  | 'jumpScare'
  | 'endCredits'
  | 'tts'
  | 'soundBoard'
  | 'muzikVideo';

export interface KatmanTanimi {
  anahtar: KatmanAnahtari;
  etiket: string;
  /** Üst üste binme sırası — OBS ve stüdyoda AYNI olmalı. */
  z: number;
  /** Varsayılan yerleşim; kayıtlı ayar yoksa kullanılır. */
  varsayilan: { x: number; y: number; width: number; height: number };
  /** `item`: bu katmanın yerleşim ayarı (ör. hedef türü). */
  ciz: (onizleme: boolean, item?: WidgetLayoutItem) => ReactNode;
}

/**
 * Katman kayıt defteri. Yeni bir widget tuvale eklenecekse YALNIZ buraya
 * satır eklenir; OBS çıktısı ve stüdyo önizlemesi kendiliğinden öğrenir.
 */
export const KATMANLAR: KatmanTanimi[] = [
  {
    anahtar: 'eventLabels',
    etiket: '🏷️ Etkinlik Etiketleri',
    z: 100,
    varsayilan: { x: 40, y: 20, width: 1840, height: 44 },
    ciz: (o) => <EventLabelsWidget embedded previewMode={o} />
  },
  {
    anahtar: 'goals',
    etiket: '🎯 Hedef Çubuğu',
    z: 90,
    varsayilan: { x: 1480, y: 140, width: 400, height: 90 },
    ciz: (o, item) => <GoalWidget embedded previewMode={o} widgetId={hedefWidgetKimligi(item?.type)} />
  },
  {
    anahtar: 'subathon',
    etiket: '⏳ Subathon Sayacı',
    z: 85,
    varsayilan: { x: 1560, y: 60, width: 320, height: 130 },
    ciz: (o) => <SubathonWidget embedded previewMode={o} />
  },
  {
    anahtar: 'alerts',
    etiket: '🔔 AlertBox Bildirimleri',
    z: 80,
    varsayilan: { x: 660, y: 120, width: 600, height: 300 },
    ciz: (o) => <AlertBoxWidget embedded previewMode={o} />
  },
  {
    anahtar: 'chat',
    etiket: '💬 Canlı Sohbet',
    z: 70,
    varsayilan: { x: 40, y: 430, width: 420, height: 610 },
    ciz: (o) => <ChatBoxWidget embedded previewMode={o} />
  },
  {
    anahtar: 'emoteCombo',
    etiket: '🔥 Emote Kombo',
    z: 75,
    varsayilan: { x: 500, y: 880, width: 260, height: 90 },
    ciz: (o) => <EmoteComboWidget embedded previewMode={o} />
  },
  {
    anahtar: 'nowPlaying',
    etiket: '🎵 Şu An Çalan (Resonance)',
    z: 65,
    varsayilan: { x: 40, y: 80, width: 380, height: 90 },
    ciz: () => <ResonanceWidget embedded />
  },
  {
    anahtar: 'theCup',
    etiket: '🍷 Bağış Kupası',
    z: 60,
    varsayilan: { x: 1660, y: 700, width: 220, height: 300 },
    ciz: (o) => <TheCupWidget embedded previewMode={o} />
  },
  {
    anahtar: 'polls',
    etiket: '📊 Canlı Anket',
    z: 78,
    varsayilan: { x: 700, y: 760, width: 520, height: 240 },
    ciz: (o) => <PollsWidget embedded previewMode={o} />
  },
  {
    anahtar: 'wheel',
    etiket: '🎡 Çarkıfelek',
    z: 88,
    varsayilan: { x: 760, y: 300, width: 400, height: 460 },
    ciz: (o) => <WheelWidget embedded previewMode={o} />
  },
  {
    anahtar: 'hypeTrain',
    etiket: '🚂 Hype Treni',
    z: 82,
    varsayilan: { x: 40, y: 200, width: 460, height: 130 },
    ciz: (o) => <HypeTrainWidget embedded previewMode={o} />
  },
  {
    anahtar: 'lyrics',
    etiket: '🎶 Şarkı Sözleri',
    z: 64,
    varsayilan: { x: 560, y: 940, width: 800, height: 110 },
    ciz: (o) => <LyricsWidget embedded previewMode={o} />
  },
  {
    anahtar: 'king',
    etiket: '👑 Tahtın Kralı',
    z: 68,
    varsayilan: { x: 1520, y: 940, width: 360, height: 100 },
    ciz: (o) => <KingWidget embedded previewMode={o} />
  },
  {
    anahtar: 'trivia',
    etiket: '🧠 Bil Bakalım',
    z: 76,
    varsayilan: { x: 660, y: 700, width: 600, height: 320 },
    ciz: (o) => <TriviaWidget embedded previewMode={o} />
  },
  // Galerideki diğer widget'lar da tek URL'ye eklenebilsin (varsayılan kapalı)
  {
    anahtar: 'activityFeed',
    etiket: 'Etkinlik Akışı',
    z: 62,
    varsayilan: { x: 1500, y: 300, width: 380, height: 360 },
    ciz: () => <ActivityFeedWidget />
  },
  {
    anahtar: 'giveaway',
    etiket: 'Çekiliş',
    z: 84,
    varsayilan: { x: 660, y: 380, width: 600, height: 300 },
    ciz: (o) => <GiveawayWidget embedded previewMode={o} />
  },
  {
    anahtar: 'pinned',
    etiket: 'Sabit Mesaj',
    z: 72,
    varsayilan: { x: 560, y: 820, width: 800, height: 110 },
    ciz: (o) => <PinnedMessageWidget embedded previewMode={o} />
  },
  {
    anahtar: 'shoutout',
    etiket: 'Shoutout',
    z: 83,
    varsayilan: { x: 1460, y: 680, width: 420, height: 220 },
    ciz: (o) => <ShoutoutWidget embedded previewMode={o} />
  },
  {
    anahtar: 'viewerCounter',
    etiket: 'İzleyici Sayacı',
    z: 66,
    varsayilan: { x: 1660, y: 20, width: 220, height: 60 },
    ciz: (o) => <ViewerCounterWidget embedded previewMode={o} />
  },
  {
    anahtar: 'rankings',
    etiket: 'Sıralama',
    z: 61,
    varsayilan: { x: 40, y: 300, width: 360, height: 420 },
    ciz: (o) => <RankingsWidget embedded previewMode={o} />
  },
  {
    anahtar: 'loyalty',
    etiket: 'Ödül Kullanımları',
    z: 81,
    varsayilan: { x: 660, y: 60, width: 600, height: 160 },
    ciz: (o) => <LoyaltyStoreWidget embedded previewMode={o} />
  },
  {
    anahtar: 'kappagen',
    etiket: 'Ekranda Emote',
    z: 95,
    varsayilan: { x: 0, y: 0, width: 1920, height: 1080 },
    ciz: (o) => <KappagenWidget embedded previewMode={o} />
  },
  {
    anahtar: 'jumpScare',
    etiket: 'JumpScare',
    z: 120,
    varsayilan: { x: 0, y: 0, width: 1920, height: 1080 },
    ciz: (o) => <JumpScareWidget previewMode={o} />
  },
  {
    anahtar: 'endCredits',
    etiket: 'Kapanış Jeneriği',
    z: 58,
    varsayilan: { x: 560, y: 120, width: 800, height: 840 },
    ciz: (o) => <EndCreditsWidget embedded previewMode={o} />
  },
  {
    anahtar: 'tts',
    etiket: 'TTS / Ses Oynatıcı',
    z: 10,
    varsayilan: { x: 0, y: 1040, width: 320, height: 40 },
    ciz: () => <AudioPlayerWidget embedded />
  },
  {
    anahtar: 'soundBoard',
    etiket: 'Ses Panosu',
    z: 11,
    varsayilan: { x: 340, y: 1040, width: 320, height: 40 },
    ciz: (o) => <SoundBoardWidget previewMode={o} />
  },
  {
    anahtar: 'muzikVideo',
    etiket: 'Şarkı Klipleri',
    z: 56,
    varsayilan: { x: 1280, y: 700, width: 600, height: 340 },
    ciz: (o) => <MuzikVideoWidget embedded previewMode={o} />
  }
];

/** Galeri widget kimliği → tek URL katmanı (hedef türleri aynı katmanı paylaşır). */
export const GALERI_KATMANI: Record<string, { anahtar: KatmanAnahtari; ek?: Record<string, unknown> }> = {
  'chat-overlay': { anahtar: 'chat' },
  'alert-box': { anahtar: 'alerts' },
  'follower-goal': { anahtar: 'goals', ek: { type: 'follower' } },
  'subscriber-goal': { anahtar: 'goals', ek: { type: 'sub' } },
  'donation-goal': { anahtar: 'goals', ek: { type: 'tip' } },
  'kicks-goal': { anahtar: 'goals', ek: { type: 'kicks' } },
  subathon: { anahtar: 'subathon' },
  'trivia-quiz': { anahtar: 'trivia' },
  'event-labels': { anahtar: 'eventLabels' },
  polls: { anahtar: 'polls' },
  'wheel-of-fortune': { anahtar: 'wheel' },
  'emote-combo': { anahtar: 'emoteCombo' },
  'the-cup': { anahtar: 'theCup' },
  'hype-train': { anahtar: 'hypeTrain' },
  'now-playing': { anahtar: 'nowPlaying' },
  lyrics: { anahtar: 'lyrics' },
  king: { anahtar: 'king' },
  jumpscare: { anahtar: 'jumpScare' },
  'activity-feed': { anahtar: 'activityFeed' },
  giveaways: { anahtar: 'giveaway' },
  'pinned-messages': { anahtar: 'pinned' },
  shoutout: { anahtar: 'shoutout' },
  'viewer-counter': { anahtar: 'viewerCounter' },
  rankings: { anahtar: 'rankings' },
  'loyalty-redemptions': { anahtar: 'loyalty' },
  'on-screen-emotes': { anahtar: 'kappagen' },
  'end-credits': { anahtar: 'endCredits' },
  tts: { anahtar: 'tts' },
  'cloud-tts': { anahtar: 'tts' },
  'muzik-video': { anahtar: 'muzikVideo' }
};

/**
 * Bir katmanın mutlak yerleşim stili.
 *
 * `olcek` tuval küçültmesi içindir: stüdyo 1920×1080'i dar bir kutuya
 * sığdırır, OBS ise birebir gösterir. Widget'ın KENDİ `scale` ayarı ayrıca
 * uygulanır — ikisi çarpılır, böylece önizleme OBS ile aynı oranı korur.
 */
export function katmanStili(
  item: WidgetLayoutItem | undefined,
  varsayilan: KatmanTanimi['varsayilan'],
  z: number,
  olcek = 1
): CSSProperties {
  const x = typeof item?.x === 'number' ? item.x : varsayilan.x;
  const y = typeof item?.y === 'number' ? item.y : varsayilan.y;
  const w = typeof item?.width === 'number' ? item.width : varsayilan.width;
  const h = typeof item?.height === 'number' ? item.height : varsayilan.height;
  const kendiOlcek = typeof item?.scale === 'number' ? item.scale : 1;

  return {
    position: 'absolute',
    left: `${x * olcek}px`,
    top: `${y * olcek}px`,
    width: `${w}px`,
    height: `${h}px`,
    transform: `scale(${kendiOlcek * olcek})`,
    transformOrigin: 'top left',
    zIndex: z,
    overflow: 'hidden'
  };
}

export interface OverlayKatmanlariProps {
  config: Record<string, WidgetLayoutItem | undefined>;
  /** Örnek veri göster (stüdyo önizlemesi ve OBS test kipi). */
  onizleme?: boolean;
  /** Tuval küçültme oranı; OBS'te 1. */
  olcek?: number;
  /** Stüdyo sürükleme/seçme sarmalayıcısı. OBS'te verilmez. */
  sarmala?: (katman: KatmanTanimi, icerik: ReactNode, stil: CSSProperties) => ReactNode;
}

/**
 * Etkin katmanları çizer. `sarmala` verilmezse düz render — OBS bunu kullanır.
 */
export function OverlayKatmanlari({ config, onizleme = false, olcek = 1, sarmala }: OverlayKatmanlariProps) {
  return (
    <>
      {KATMANLAR.map((katman) => {
        const item = config[katman.anahtar];
        if (!item?.enabled && !sarmala) return null; // OBS: kapalı katman hiç çizilmez

        const stil = katmanStili(item, katman.varsayilan, katman.z, olcek);
        const icerik = katman.ciz(onizleme, item);

        if (sarmala) return <span key={katman.anahtar}>{sarmala(katman, icerik, stil)}</span>;

        return (
          <div key={katman.anahtar} style={{ ...stil, pointerEvents: 'none' }}>
            {icerik}
          </div>
        );
      })}
    </>
  );
}
