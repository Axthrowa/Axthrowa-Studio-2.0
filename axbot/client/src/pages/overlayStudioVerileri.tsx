/** Tek URL ve widget stüdyosunun sabit verileri: galeri adları, test adları, varsayılan yerleşim ve hizalama ızgarası (TEK-4). */
import { GALERI_KATMANI, KATMANLAR } from '../widgets/OverlayLayers.js';
import { type Yon } from '../lib/hizala.js';
import { Secim } from '../ui/index.js';

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
    cubuklar?: Array<'follower' | 'sub' | 'tip' | 'kicks'>;
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
export const KATEGORI_ADI: Record<string, string> = {
  Goals: 'Hedefler',
  Engagement: 'Etkileşim',
  'On-Stream': 'Ekran Üstü',
  'Audio & AI': 'Ses & Yapay Zekâ'
};

export const GALERI_TR: Record<string, { baslik: string; aciklama: string }> = {
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
  'social-rotator': {
    baslik: 'Dönen Sosyal Medya',
    aciklama: 'Eklediğiniz sosyal medya hesaplarını yayında sırayla gösterir.'
  },
  'sponsor-banner': {
    baslik: 'Sponsor ve İş Birliği',
    aciklama: 'Reklam ve iş birliği görsellerini, GIF ve videolarını sırayla gösterir.'
  },
  'pinned-messages': {
    baslik: 'Sabitlenmiş Mesajlar',
    aciklama: 'Öne çıkardığınız sohbet mesajını yayında özelleştirilebilir bir şeritte tutar.'
  },
  polls: {
    baslik: 'Anketler',
    aciklama: 'Yayında etkileşimli anket gösterir. İzleyiciler sohbetten (!oy) oy verir, sonuç anında güncellenir.'
  },
  atla: {
    baslik: 'Şarkı Atla',
    aciklama: 'İzleyici !atla yazınca oy çubuğu çıkar; mod hemen atlar. Kart birkaç saniye görünür.'
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
export function onizlemeBoyutu(galeriId: string): { w: number; h: number } | undefined {
  const anahtar = GALERI_KATMANI[galeriId]?.anahtar;
  const v = KATMANLAR.find((k) => k.anahtar === anahtar)?.varsayilan;
  // Ekran boyu şeritler (olay etiketleri 1840 px) önizlemede çok küçülmesin: genişlik 960 ile sınırlı
  return v && (v.width < 1900 || v.height < 1060) ? { w: Math.min(960, v.width), h: v.height } : undefined;
}

/** Galeri kimliği → sunucudaki test adı (widgets/test/:ad). Listede olmayanın ayrı testi yok, önizlemesi var. */
export const HEDEF_TABANLARI = ['donation-goal', 'follower-goal', 'subscriber-goal', 'kicks-goal'];

export const TEST_ADI: Record<string, string> = {
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
  scoreboard: 'scoreboard',
  'muzik-video': 'muzik-video'
};

export const HIZA_NOKTALARI: Array<[string, string, Yon[]]> = [
  ['↖', 'Sol üst köşe', ['sol', 'ust']], ['↑', 'Üst orta', ['yatayOrta', 'ust']], ['↗', 'Sağ üst köşe', ['sag', 'ust']],
  ['←', 'Sol orta', ['sol', 'dikeyOrta']], ['⊙', 'Tam orta', ['yatayOrta', 'dikeyOrta']], ['→', 'Sağ orta', ['sag', 'dikeyOrta']],
  ['↙', 'Sol alt köşe', ['sol', 'alt']], ['↓', 'Alt orta', ['yatayOrta', 'alt']], ['↘', 'Sağ alt köşe', ['sag', 'alt']]
];

/** Tuvalin dokuz noktasına tek tıkla hizalama + yalnız tek eksen + kenardan bırakılacak pay */
export function HizaIzgarasi({ onSec, pay, payDegisti }: { onSec: (yonler: Yon[]) => void; pay: number; payDegisti: (p: number) => void }) {
  const dugme = 'py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-[11px] font-bold text-gray-200 transition-colors';
  return (
    <div className="flex gap-2 pt-1" role="group" aria-label="Hizalama">
      <div className="grid grid-cols-3 gap-1 w-28 shrink-0">
        {HIZA_NOKTALARI.map(([simge, ad, yonler]) => (
          <button key={ad} type="button" title={ad} aria-label={ad} onClick={() => onSec(yonler)} className={dugme}>
            {simge}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-1">
        <button type="button" onClick={() => onSec(['yatayOrta'])} className={`${dugme} w-full`}>↔ Yalnız yatay orta</button>
        <button type="button" onClick={() => onSec(['dikeyOrta'])} className={`${dugme} w-full`}>↕ Yalnız dikey orta</button>
        <label className="flex items-center justify-between gap-1 text-[10px] font-bold text-gray-400">
          Kenar payı
          <Secim kucuk value={pay} onChange={(e) => payDegisti(Number(e.target.value))}>
            {[0, 20, 40, 80].map((p) => <option key={p} value={p}>{p} px</option>)}
          </Secim>
        </label>
      </div>
    </div>
  );
}

/** Widget seçme listesinde adın yanındaki simge */
export const KATMAN_EMOJISI: Record<string, string> = {
  chat: '💬', alerts: '🔔', goals: '🎯', subathon: '⏳', trivia: '🧠', eventLabels: '🏷️', theCup: '🏆', polls: '📊',
  wheel: '🎡', hypeTrain: '🚂', nowPlaying: '🎵', emoteCombo: '🔥', lyrics: '🎤', king: '👑', jumpScare: '👻',
  socials: '🔗', sponsor: '🤝', activityFeed: '📰', giveaway: '🎁', pinned: '📌', shoutout: '📣', viewerCounter: '👀', rankings: '🥇', loyalty: '🎟️',
  kappagen: '🎉', endCredits: '🎬', tts: '🗣️', soundBoard: '🎛️', muzikVideo: '📺', wordCloud: '☁️', scoreboard: '🏅'
};

// Tek URL katmanı → ayar kimliği. Eskiden elle yazılmış 14 katmanla sınırlıydı: sabitlenmiş mesaj, shoutout,
// izleyici sayacı, sıralama, sadakat, jenerik vb. seçilince ayar paneli hiç açılmıyordu. Artık galeri
// eşlemesinden türetilir; aşağıdaki elle yazılanlar önceliklidir.
export const KATMAN_AYAR_ID: Record<string, string> = {
  ...Object.fromEntries(Object.entries(GALERI_KATMANI).reverse().map(([galeriId, k]) => [k.anahtar, galeriId])),
  chat: 'chat-overlay',
  alerts: 'alert-box',
  goals: 'follower-goal',
  subathon: 'subathon',
  trivia: 'trivia',
  eventLabels: 'event-labels',
  polls: 'polls',
  wheel: 'wheel-of-fortune',
  socials: 'social-rotator',
  sponsor: 'sponsor-banner',
  emoteCombo: 'emote-combo',
  theCup: 'the-cup',
  hypeTrain: 'hype-train',
  lyrics: 'lyrics',
  king: 'king',
  jumpScare: 'jumpscare'
};

export const DEFAULT_ALL_IN_ONE_CONFIG: AllInOneConfig = {
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
    x: 760,
    y: 340,
    width: 400,
    height: 400,
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
    height: 130,
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
