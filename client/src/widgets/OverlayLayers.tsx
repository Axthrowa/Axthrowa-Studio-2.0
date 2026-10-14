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
import { NowPlayingWidget } from './NowPlayingWidget.js';
import { TheCupWidget } from './TheCupWidget.js';
import { PollsWidget } from './PollsWidget.js';
import { GoalWidget } from './GoalWidget.js';
import { WheelWidget } from './WheelWidget.js';
import { HypeTrainWidget } from './HypeTrainWidget.js';
import LyricsWidget from './LyricsWidget.js';
import KingWidget from './KingWidget.js';
import TriviaWidget from './TriviaWidget.js';
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
  | 'trivia';

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
    etiket: '🎵 Şu An Çalan',
    z: 65,
    varsayilan: { x: 40, y: 80, width: 380, height: 90 },
    ciz: (o) => <NowPlayingWidget embedded previewMode={o} />
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
  }
];

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
