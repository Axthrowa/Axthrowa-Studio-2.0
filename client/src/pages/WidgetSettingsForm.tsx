/**
 * StreamAxT widget settings
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { FONTS, WIDGET_DEFAULTS } from '../lib/widget-defaults.js';
import { ANIM_SECENEKLERI, METIN_EFEKTLERI } from '../lib/animations.js';
import { temalar, temayiUygula } from '../lib/themes.js';
import { UyariOlayMedyasi } from '../components/UyariOlayMedyasi.js';
import { SabitMesajPaneli, SkorTablosuPaneli, SohbetIstatistikPaneli } from '../components/SohbetAraclariPaneli.js';
import { CARK_PALETLERI } from '../widgets/WheelWidget.js';

const LABELS: Record<string, string> = {
  showFollow: 'Takip göster', showSub: 'Abone göster', showGiftSub: 'Hediye abone göster',
  showTip: 'Bağış göster', showRaid: 'Raid göster', showHost: 'Host göster', showKicks: 'Kicks göster',
  showBits: 'Bits göster', maxItems: 'Maks. öğe', newestFirst: 'Yeniler üstte', showIcons: 'İkonlar',
  showTimestamp: 'Saat göster', compact: 'Kompakt görünüm', hideEmpty: 'Boşken gizle',
  fontFamily: 'Yazı tipi', fontSize: 'Yazı boyutu', fontWeight: 'Kalınlık', fontColor: 'Yazı rengi',
  letterSpacing: 'Harf aralığı', backgroundColor: 'Arka plan rengi', backgroundOpacity: 'Arka plan opaklığı',
  borderRadius: 'Köşe yuvarlaklığı', borderColor: 'Kenar rengi', outlineEnabled: 'Kontur açık',
  outlineColor: 'Kontur rengi', outlineWidth: 'Kontur kalınlığı', animation: 'Animasyon',
  animationDuration: 'Animasyon süresi (ms)', gap: 'Boşluk', iconFollow: 'Takip ikonu',
  iconSub: 'Abone ikonu', iconTip: 'Bağış ikonu', iconRaid: 'Raid ikonu', iconHost: 'Host ikonu',
  iconKicks: 'Kicks ikonu', templateFollow: 'Takip şablonu', templateSub: 'Abone şablonu',
  templateGiftSub: 'Hediye abone şablonu', templateTip: 'Bağış şablonu', templateRaid: 'Raid şablonu',
  templateHost: 'Host şablonu', templateKicks: 'Kicks şablonu', soundEnabled: 'Ses açık',
  soundUrl: 'Ses URL', soundVolume: 'Ses düzeyi', mute: 'Sessiz', paused: 'Duraklat',
  maxMessages: 'Maks. mesaj', textColor: 'Metin rengi', usernameColorMode: 'Kullanıcı rengi',
  customUsernameColor: 'Özel kullanıcı rengi', lineHeight: 'Satır yüksekliği',
  showPlatformLogo: 'Platform logosu', showBadges: 'Rozetler', showAvatars: 'Avatarlar',
  highlightSpecial: 'Özel mesaj vurgusu', fadeMessages: 'Mesajlar kaybolsun', fadeTimeout: 'Kaybolma (sn)',
  smoothMask: 'Yumuşak maske', textShadow: 'Yazı gölgesi', transparentBg: 'Şeffaf arka plan',
  hideCommands: 'Komutları gizle', hideBots: 'Botları gizle', hideEmoteOnly: 'Sadece emote gizle',
  ignoreList: 'Yoksay listesi', align: 'Hizalama', reverse: 'Yeni mesajlar üstte',
  messageSound: 'Yeni mesaj sesi', messageSoundVolume: 'Ses düzeyi', taranacakSaat: 'Taranacak saat',
  cevirmeBeklemeSn: '!cark bekleme süresi (sn)', cevirmeMaliyeti: '!cark puan maliyeti (0 = ücretsiz)',
  raidOtomatikEsik: "Raid'de otomatik göster (izleyici eşiği, 0 = kapalı)",
  kickGoster: 'Kick sohbeti', twitchGoster: 'Twitch sohbeti', youtubeGoster: 'YouTube sohbeti', tiktokGoster: 'TikTok sohbeti',
  trovoGoster: 'Trovo sohbeti', discordGoster: 'Discord sohbeti',
  messageBubbles: 'Mesaj balonları', showOwnBot: 'Kendi botumun yanıtlarını göster', showDonations: 'Bağışları sohbette göster', showRedemptions: 'Puan ödüllerini sohbette göster',
  messageBgColor: 'Mesaj arka planı', messageBgOpacity: 'Mesaj opaklığı', highlightColor: 'Vurgu rengi',
  hideBroadcaster: 'Yayıncıyı gizle', title: 'Başlık', endingTitle: 'Bitiş başlığı', current: 'Mevcut',
  target: 'Hedef', currency: 'Birim', type: 'Hedef tipi', barColor: 'Bar rengi', barBackground: 'Bar arka plan',
  barHeight: 'Bar yüksekliği', barRadius: 'Bar yuvarlaklığı', barStyle: 'Bar dolgusu', syncOffsetMs: 'Senkron kaydırma (ms, + erken)', lineFontFamily: 'Etkin satır yazı tipi', comboStyle: 'Görsel stil', iconStyle: 'Simge biçimi', palette: 'Renk paleti',
  timeFontFamily: 'Süre yazı tipi', timeFontSize: 'Süre boyutu (px)', showRules: 'Kuralları göster', barColor2: 'Bar 2. renk (geçiş)',
  barBorderColor: 'Bar çerçeve rengi', barBorderWidth: 'Bar çerçeve kalınlığı', barIcon: 'Dolgu ucundaki simge (emoji)', layout: 'Düzen', showRemaining: 'Kalan göster',
  showPercent: 'Yüzde göster', showGlow: 'Parıltı', decimals: 'Ondalık', prefix: 'Önek', suffix: 'Sonek',
  textTransform: 'Metin dönüşümü', minCombo: 'Min. combo', timeoutMs: 'Combo zaman aşımı (ms)',
  displayMs: 'Gösterim (ms)', size: 'Emote boyutu', showFloating: 'Uçan emote', showPopup: 'Popup göster',
  confetti: 'Konfeti', template: 'Şablon', subTemplate: 'Alt şablon', onlyKnownEmotes: 'Sadece bilinen emote',
  gatherMode: "Gelen emote'lar büyük emote'ta toplansın", burstOnEnd: "Kombo bitince emote'lar etrafa dağılıp kaybolsun",
  showTop: 'Top bağışçı', separator: 'Ayırıcı', marqueeSpeed: 'Kayan yazı hızı', height: 'Yükseklik',
  paddingX: 'Yatay dolgu', command: 'Komut', titleColor: 'Başlık rengi', showVotes: 'Oy sayısı',
  hideUntilEnd: 'Bitene kadar gizle', spinMs: 'Dönüş süresi (ms)', extraSpins: 'Ek tur',
  pointerColor: 'İşaretçi rengi', queueEnabled: 'Kuyruk', gapMs: 'Alert aralığı (ms)',
  ttsEnabled: 'TTS açık', ttsReadMessage: 'Mesajı oku', globalVolume: 'Genel ses', layoutMode: 'Düzen',
  textEffect: 'Yazı efekti', minTipAmount: 'Min. bağış', minKicks: 'Min. kicks', skipEnabled: 'Atla açık',
  keyword: 'Katılım kelimesi', durationMinutes: 'Süre (dk)', winnerCount: 'Kazanan sayısı',
  maxEntries: 'Maks. katılım (0=sınırsız)', costPoints: 'Puan maliyeti', subBonusMultiplier: 'Abone çarpanı',
  followerOnly: 'Sadece takipçi', subOnly: 'Sadece abone', minWatchMinutes: 'Min. izleme (dk)',
  minMessages: 'Min. mesaj', announceChat: 'Sohbette duyur', duplicatePrevent: 'Çift katılımı engelle',
  autoClose: 'Otomatik kapat', overlayTitle: 'Overlay başlığı', winnerShowSec: 'Kazanan gösterim süresi (sn, 0 = kalıcı)', accentColor: 'Vurgu rengi',
  showKeyword: 'Kelimeyi göster', showEntries: 'Katılımcı sayısı',
  // --- 2026-09 revizyonu: ayar sistemine yeni bağlanan widget'lar ---
  fromChat: "Sohbetteki emote'lar uçsun", durationMs: 'Uçuş süresi (ms)', maxOnScreen: 'Ekranda en çok',
  burstCopies: '!kappagen kopya sayısı', spin: 'Dönerek uç', shadow: 'Gölge',
  theme: 'Tema', position: 'Ekran konumu', label: 'Etiket', icon: 'İkon',
  maxWidth: 'Maks. genişlik', minWidth: 'Min. genişlik', paddingY: 'Dikey dolgu',
  radius: 'Köşe yuvarlaklığı', bgColor: 'Arka plan rengi', bgOpacity: 'Arka plan opaklığı',
  accentColor2: 'İkinci vurgu rengi', 
  showTitle: 'Başlık göster', showTotal: 'Toplam göster', showPerPlatform: 'Platform kırılımı',
  showPlatformName: 'Platform adı', compactNumbers: 'Kısa sayı (12,3 B)',
  showKick: 'Kick', showTwitch: 'Twitch', showYoutube: 'YouTube',
  coverSize: 'Kapak boyutu', showCover: 'Kapak göster', showLabel: 'Etiket göster',
  showRequester: 'İsteyeni göster', showEqualizer: 'Ekolayzer', marquee: 'Kayan yazı',
  hideWhenIdle: 'Boşta gizle', hideWhenEmpty: 'Boşken gizle',
  cupWidth: 'Kap genişliği', cupHeight: 'Kap yüksekliği', cupRadius: 'Kap taban yuvarlaklığı',
  borderWidth: 'Kenar kalınlığı', itemSize: 'Öğe boyutu', itemSizeVary: 'Boyut oynaması',
  emojiTip: 'Bağış emojileri', emojiSub: 'Abone emojileri', emojiGift: 'Hediye emojileri',
  emojiKicks: 'KICKs emojileri', showCount: 'Öğe sayısı', showGlare: 'Cam parlaması',
  animateItems: 'Öğeler zıplasın',
  autoHideSeconds: 'Otomatik gizle (sn, 0=kalıcı)', showAuthor: 'Yazarı göster',
  showPlatform: 'Platformu göster', showIcon: 'İkon göster',
  avatarSize: 'Avatar boyutu', urlPrefix: 'Adres öneki', defaultBio: 'Varsayılan tanıtım',
  showAvatar: 'Avatar göster', showBio: 'Tanıtım göster', showUrl: 'Adres göster',
  sort: 'Sıralama ölçütü', limit: 'Satır sayısı', refreshSeconds: 'Yenileme (sn)',
  rowGap: 'Satır aralığı', valueSuffix: 'Değer soneki', showRank: 'Sıra numarası',
  showMedals: 'Madalyalar', showValue: 'Değeri göster', highlightTop: 'Birinciyi vurgula',
  subtitle: 'Alt başlık', levelGoal: 'Seviye 1 hedefi', levelGrowth: 'Seviye büyüme katsayısı',
  maxLevel: 'Maks. seviye', windowSeconds: 'Tren süresi (sn)', pointsSub: 'Abone puanı',
  pointsGiftSub: 'Hediye abone puanı', pointsTip: 'Bağış puanı (birim başına)',
  pointsKicks: 'KICKs puanı (birim başına)', pointsFollow: 'Takip puanı',
  showTimer: 'Sayaç göster', showLevel: 'Seviye göster', showSubtitle: 'Alt başlık göster',
  showLastSupporter: 'Son destekçi',
  contextFontSize: 'Yan satır boyutu', contextColor: 'Yan satır rengi',
  lineMs: 'Satır süresi (ms)', idleText: 'Boşta yazısı', showTrack: 'Parça adı',
  showPrev: 'Önceki satır', showNext: 'Sonraki satır', showDisc: 'Plak ikonu',
  pointsLabel: 'Puan etiketi', showCrown: 'Taç göster', showPoints: 'Puanı göster',
  showReign: 'Saltanat süresi',
  mediaUrl: 'Medya adresi', mediaType: 'Medya türü', audioUrl: 'Ses adresi',
  donorLabelColor: 'Bağışçı etiket rengi', fallbackEmoji: 'Yedek emoji',
  contrast: 'Kontrast (%)', brightness: 'Parlaklık (%)', screamFallback: 'Yedek çığlık sesi',
  showDonor: 'Bağışçıyı göster', shake: 'Sarsıntı',
  showCost: 'Maliyeti göster', showPayload: 'Girilen metni göster',
  footer: 'Alt not', titleSize: 'Başlık boyutu', scrollSeconds: 'Kaydırma süresi (sn)',
  maxPerSection: 'Bölüm başına maks.', titleSubs: 'Abone bölüm başlığı',
  titleTips: 'Bağış bölüm başlığı', titleFollows: 'Takip bölüm başlığı',
  titleRaids: 'Raid bölüm başlığı', showSubs: 'Abone bölümü', showTips: 'Bağış bölümü',
  showFollows: 'Takip bölümü', showRaids: 'Raid bölümü', showAmounts: 'Tutarları göster',
  showFooter: 'Alt notu göster', loop: 'Döngü',
  maxQueue: 'Maks. kuyruk', showStatus: 'Durum kartı', showText: 'Okunan metni göster',
  showQueue: 'Kuyruk sayısı',
  // --- Uyarı kutusu derinleştirmesi ---
  exitAnimation: 'Çıkış animasyonu',
  messageColor: 'Alt metin rengi',
  messageSize: 'Alt metin boyutu (px)',
  textOffsetX: 'Metin yatay konumu (px)',
  textOffsetY: 'Metin dikey konumu (px)', hideUserMessage: 'Kullanıcı mesajını gizle',
  textFromMs: 'Metin görünsün (ms, başlangıç)', textToMs: 'Metin görünsün (ms, bitiş)',
  imageMaxHeight: 'Görsel maks. yükseklik (px)',
  // --- Görünürlük / olay seçimi (2026-10) ---
  hideDelaySec: 'Cevaptan sonra kaybolma (sn, 0 = kalsın)', podiumHideSec: 'Kürsü ekranda kalma (sn, 0 = kalsın)',
  hideAfterSec: 'Bitince kaybolma (sn, 0 = kalsın)', autoHide: 'Yalnız kullanılınca görünsün',
  fromTip: 'Bağışlar sayılsın', fromSub: 'Aboneler sayılsın', fromGift: 'Hediye abonelikler sayılsın',
  fromKicks: 'KICKs sayılsın', fromFollow: 'Takipler sayılsın', autoStart: 'Olay gelince kendiliğinden başlasın',
  onlyViewers: 'Yalnız izleyiciler (yayıncı tahta çıkamaz/gösterilmez)', emptyText: 'Taht boşken yazı',
  labelFollow: 'Takipçi başlığı', labelSub: 'Abone başlığı', labelTip: 'Bağış başlığı', labelTop: 'En büyük bağış başlığı',
  labelRaid: 'Raid başlığı', labelKicks: 'KICKs başlığı', labelFollowers: 'Takipçi sayısı başlığı', showFollowers: 'Takipçi sayısı göster', emptyValue: 'Veri yokken', labelColor: 'Başlık rengi',
  notFoundText: 'Söz bulunamayınca yazı'
};

const SECTIONS: Record<string, string> = {
  showFollow: 'Olaylar', showSub: 'Olaylar', showGiftSub: 'Olaylar', showTip: 'Olaylar', showRaid: 'Olaylar',
  showHost: 'Olaylar', showKicks: 'Olaylar', showFollowers: 'Olaylar', showBits: 'Olaylar', showTop: 'Olaylar',
  templateFollow: 'Şablon', templateSub: 'Şablon', templateGiftSub: 'Şablon', templateTip: 'Şablon',
  templateRaid: 'Şablon', templateHost: 'Şablon', templateKicks: 'Şablon', template: 'Şablon',
  subTemplate: 'Şablon',
  fontFamily: 'Tipografi', fontSize: 'Tipografi', fontWeight: 'Tipografi', fontColor: 'Tipografi',
  letterSpacing: 'Tipografi', textColor: 'Tipografi', lineHeight: 'Tipografi', textTransform: 'Tipografi',
  titleColor: 'Tipografi',
  outlineEnabled: 'Kontur', outlineColor: 'Kontur', outlineWidth: 'Kontur',
  animation: 'Animasyon', animationDuration: 'Animasyon', marqueeSpeed: 'Animasyon', extraSpins: 'Animasyon',
  spinMs: 'Animasyon',
  soundEnabled: 'Ses', soundUrl: 'Ses', soundVolume: 'Ses', mute: 'Ses', globalVolume: 'Ses',
  backgroundColor: 'Görünüm', backgroundOpacity: 'Görünüm', borderRadius: 'Görünüm', borderColor: 'Görünüm',
  barColor: 'Görünüm', barBackground: 'Görünüm', barHeight: 'Görünüm', barRadius: 'Görünüm',
  barStyle: 'Görünüm', barColor2: 'Görünüm', barBorderColor: 'Görünüm', barBorderWidth: 'Görünüm', barIcon: 'Görünüm',
  messageBgColor: 'Görünüm', messageBgOpacity: 'Görünüm', highlightColor: 'Görünüm', accentColor: 'Görünüm',
  pointerColor: 'Görünüm', transparentBg: 'Görünüm', textShadow: 'Görünüm', smoothMask: 'Görünüm',
  showGlow: 'Görünüm',
  maxItems: 'Düzen', newestFirst: 'Düzen', showIcons: 'Düzen', showTimestamp: 'Düzen', compact: 'Düzen',
  hideEmpty: 'Düzen', gap: 'Düzen', maxMessages: 'Düzen', showPlatformLogo: 'Düzen', showBadges: 'Düzen',
  showAvatars: 'Düzen', highlightSpecial: 'Düzen', fadeMessages: 'Düzen', fadeTimeout: 'Düzen',
  hideCommands: 'Düzen', hideBots: 'Düzen', hideEmoteOnly: 'Düzen', ignoreList: 'Düzen', align: 'Düzen',
  reverse: 'Düzen', hideBroadcaster: 'Düzen', layout: 'Düzen', showRemaining: 'Düzen', showPercent: 'Düzen',
  messageSound: 'Düzen', messageSoundVolume: 'Düzen', showDonations: 'Düzen', showRedemptions: 'Düzen', messageBubbles: 'Görünüm', showOwnBot: 'Düzen',
  kickGoster: 'Platformlar', twitchGoster: 'Platformlar', youtubeGoster: 'Platformlar', tiktokGoster: 'Platformlar',
  trovoGoster: 'Platformlar', discordGoster: 'Platformlar',
  decimals: 'Düzen', prefix: 'Düzen', suffix: 'Düzen', height: 'Düzen', paddingX: 'Düzen',
  showVotes: 'Düzen', hideUntilEnd: 'Düzen', layoutMode: 'Düzen', queueEnabled: 'Gelişmiş',
  gapMs: 'Gelişmiş', ttsEnabled: 'Gelişmiş', ttsReadMessage: 'Gelişmiş', textEffect: 'Gelişmiş',
  minTipAmount: 'Gelişmiş', minKicks: 'Gelişmiş', skipEnabled: 'Gelişmiş', confetti: 'Gelişmiş',
  usernameColorMode: 'Düzen', customUsernameColor: 'Görünüm',
  iconFollow: 'İkonlar', iconSub: 'İkonlar', iconTip: 'İkonlar', iconRaid: 'İkonlar', iconHost: 'İkonlar', iconKicks: 'İkonlar',
  title: 'Hedef', endingTitle: 'Hedef', current: 'Hedef', target: 'Hedef', currency: 'Hedef', type: 'Hedef',
  minCombo: 'Combo', timeoutMs: 'Combo', displayMs: 'Combo', size: 'Combo', showFloating: 'Combo',
  showPopup: 'Combo', onlyKnownEmotes: 'Combo',
  keyword: 'Çekiliş', durationMinutes: 'Çekiliş', winnerCount: 'Çekiliş', maxEntries: 'Çekiliş',
  costPoints: 'Çekiliş', subBonusMultiplier: 'Çekiliş', followerOnly: 'Çekiliş', subOnly: 'Çekiliş',
  minWatchMinutes: 'Çekiliş', minMessages: 'Çekiliş', announceChat: 'Çekiliş', duplicatePrevent: 'Çekiliş',
  autoClose: 'Çekiliş', overlayTitle: 'Çekiliş', winnerShowSec: 'Çekiliş', showKeyword: 'Çekiliş', showEntries: 'Çekiliş', showTimer: 'Çekiliş',
  command: 'Komut', paused: 'Kontrol', separator: 'Şablon',
  // --- 2026-09 revizyonu ---
  theme: 'Tema', position: 'Düzen', label: 'Genel', icon: 'Genel', maxWidth: 'Düzen',
  minWidth: 'Düzen', paddingY: 'Düzen', radius: 'Görünüm', bgColor: 'Görünüm',
  bgOpacity: 'Görünüm', accentColor2: 'Görünüm', 
  showTitle: 'Düzen', showTotal: 'Düzen', showPerPlatform: 'Platformlar',
  showPlatformName: 'Platformlar', compactNumbers: 'Düzen',
  showKick: 'Platformlar', showTwitch: 'Platformlar', showYoutube: 'Platformlar',
  coverSize: 'Düzen', showCover: 'Düzen', showLabel: 'Düzen', showRequester: 'Düzen',
  showEqualizer: 'Görünüm', marquee: 'Animasyon', hideWhenIdle: 'Düzen', hideWhenEmpty: 'Düzen',
  cupWidth: 'Kupa', cupHeight: 'Kupa', cupRadius: 'Kupa', borderWidth: 'Kupa',
  itemSize: 'Kupa', itemSizeVary: 'Kupa', emojiTip: 'Emojiler', emojiSub: 'Emojiler',
  emojiGift: 'Emojiler', emojiKicks: 'Emojiler', showCount: 'Düzen', showGlare: 'Görünüm',
  animateItems: 'Animasyon',
  autoHideSeconds: 'Düzen', showAuthor: 'Düzen', showPlatform: 'Düzen', showIcon: 'Düzen',
  avatarSize: 'Düzen', urlPrefix: 'Genel', defaultBio: 'Genel', showAvatar: 'Düzen',
  showBio: 'Düzen', showUrl: 'Düzen',
  sort: 'Sıralama', limit: 'Sıralama', refreshSeconds: 'Sıralama', rowGap: 'Düzen',
  valueSuffix: 'Sıralama', showRank: 'Düzen', showMedals: 'Düzen', showValue: 'Düzen',
  highlightTop: 'Görünüm',
  subtitle: 'Genel', levelGoal: 'Tren', levelGrowth: 'Tren', maxLevel: 'Tren',
  windowSeconds: 'Tren', pointsSub: 'Puanlar', pointsGiftSub: 'Puanlar', pointsTip: 'Puanlar',
  pointsKicks: 'Puanlar', pointsFollow: 'Puanlar', showLevel: 'Düzen',
  showSubtitle: 'Düzen', showLastSupporter: 'Düzen',
  contextFontSize: 'Tipografi', contextColor: 'Tipografi', lineMs: 'Animasyon',
  idleText: 'Genel', showTrack: 'Düzen', showPrev: 'Düzen', showNext: 'Düzen', showDisc: 'Düzen',
  pointsLabel: 'Genel', showCrown: 'Düzen', showPoints: 'Düzen', showReign: 'Düzen',
  mediaUrl: 'Medya', mediaType: 'Medya', audioUrl: 'Medya', donorLabelColor: 'Görünüm',
  fallbackEmoji: 'Medya', contrast: 'Görünüm', brightness: 'Görünüm',
  screamFallback: 'Ses', showDonor: 'Düzen', shake: 'Animasyon',
  showCost: 'Düzen', showPayload: 'Düzen',
  footer: 'Genel', titleSize: 'Tipografi', scrollSeconds: 'Animasyon',
  maxPerSection: 'Bölümler', titleSubs: 'Bölümler', titleTips: 'Bölümler',
  titleFollows: 'Bölümler', titleRaids: 'Bölümler', showSubs: 'Bölümler', showTips: 'Bölümler',
  showFollows: 'Bölümler', showRaids: 'Bölümler', showAmounts: 'Bölümler',
  showFooter: 'Düzen', loop: 'Animasyon',
  maxQueue: 'Ses', showStatus: 'Düzen', showText: 'Düzen', showQueue: 'Düzen',
  exitAnimation: 'Animasyon',
  messageColor: 'Metin', messageSize: 'Metin',
  textOffsetX: 'Metin', textOffsetY: 'Metin',
  hideUserMessage: 'Metin', textFromMs: 'Metin', textToMs: 'Metin',
  imageMaxHeight: 'Görünüm',
  hideDelaySec: 'Görünürlük', podiumHideSec: 'Görünürlük', hideAfterSec: 'Görünürlük', autoHide: 'Görünürlük',
  fromTip: 'Olaylar', fromSub: 'Olaylar', fromGift: 'Olaylar', fromKicks: 'Olaylar', fromFollow: 'Olaylar',
  autoStart: 'Olaylar', onlyViewers: 'Genel', emptyText: 'Genel',
  labelFollow: 'Başlıklar', labelSub: 'Başlıklar', labelTip: 'Başlıklar', labelTop: 'Başlıklar', labelRaid: 'Başlıklar',
  labelKicks: 'Başlıklar', labelFollowers: 'Başlıklar', emptyValue: 'Başlıklar', labelColor: 'Tipografi'
};

/**
 * Widget'a özel bölüm adları. Küresel tabloda `title` "Hedef" (hedef
 * widget'larından kalma), `size` "Combo" ve `showTimer` "Çekiliş" demek;
 * bu adlar sıralama, kupa veya tren ayarlarının üstünde yanlış duruyordu.
 */
const WIDGET_SECTIONS: Record<string, Record<string, string>> = {
  rankings: { title: 'Genel' },
  'the-cup': { title: 'Genel' },
  'hype-train': { title: 'Genel', showTimer: 'Düzen' },
  'end-credits': { title: 'Genel' },
  king: { title: 'Genel' },
  subathon: { title: 'Genel', theme: 'Görünüm', icon: 'Görünüm', timeFontFamily: 'Tipografi', timeFontSize: 'Tipografi', showRules: 'Düzen', showStatus: 'Düzen' },
  'viewer-counter': { title: 'Genel' },
  trivia: { title: 'Genel' },
  'wheel-of-fortune': { size: 'Görünüm', palette: 'Görünüm' },
  'audio-player': { label: 'Genel' }
};

const SELECTS: Record<string, Array<{ value: string; label: string }>> = {
  // 37 on ayar (lib/animations.ts). Eski 9'luk liste geriye uyum icin
  // `animKimligi()` ile eslenmeye devam ediyor.
  animation: ANIM_SECENEKLERI,
  exitAnimation: ANIM_SECENEKLERI,
  barStyle: [
    { value: 'flat', label: 'Düz' },
    { value: 'gradient', label: 'Renk geçişi' },
    { value: 'striped', label: 'Çizgili (akan)' },
    { value: 'glossy', label: 'Parlak' }
  ],
  fontFamily: FONTS.map(f => ({ value: f, label: f })),
  usernameColorMode: [
    { value: 'user', label: 'Kullanıcı rengi' },
    { value: 'platform', label: 'Platform rengi' },
    { value: 'custom', label: 'Özel' }
  ],
  align: [
    { value: 'left', label: 'Sol' },
    { value: 'center', label: 'Orta' },
    { value: 'right', label: 'Sağ' }
  ],
  layout: [
    { value: 'text-above', label: 'Yazı üstte' },
    { value: 'text-below', label: 'Yazı altta' }
  ],
  type: [
    { value: 'tip', label: 'Bağış' },
    { value: 'follower', label: 'Takipçi' },
    { value: 'sub', label: 'Abone' },
    { value: 'kicks', label: 'Kicks' }
  ],
  textTransform: [
    { value: 'none', label: 'Yok' },
    { value: 'uppercase', label: 'BÜYÜK' },
    { value: 'lowercase', label: 'küçük' },
    { value: 'capitalize', label: 'Başlık' }
  ],
  layoutMode: [
    { value: 'stacked', label: 'Üst üste' },
    { value: 'side-by-side', label: 'Yan yana' },
    { value: 'text-over', label: 'Yazı üstünde' }
  ],
  textEffect: METIN_EFEKTLERI
};

/**
 * Widget'a özel seçenek listeleri. `theme` her widget'ta farklı, `layout`
 * hedef widget'ında "yazı üstte/altta" iken sayaçta "satır/sütun" demek —
 * tek bir küresel tablo ikisini birden karşılayamıyordu.
 */
const tema = (...ler: Array<[string, string]>) => ler.map(([value, label]) => ({ value, label }));

const WIDGET_SELECTS: Record<string, Record<string, Array<{ value: string; label: string }>>> = {
  'chat-overlay': {
    layout: tema(['column', 'Alt alta'], ['row', 'Yan yana (tek satır)']),
    animation: [...ANIM_SECENEKLERI, { value: 'daktilo', label: 'Daktilo' }]
  },
  'event-labels': {
    layout: tema(['row', 'Yan yana'], ['column', 'Alt alta']),
    animation: [...ANIM_SECENEKLERI, { value: 'marquee', label: 'Kayan yazı' }]
  },
  'viewer-counter': {
    theme: tema(['classic', 'Klasik'], ['minimal', 'Minimal'], ['glass', 'Cam'], ['neon', 'Neon'], ['capsule', 'Kapsül'], ['velvet', 'Kadife'], ['ticker', 'Borsa bandı'], ['holochip', 'Holografik'], ['splitflap', 'Çevirmeli tabela']),
    layout: tema(['column', 'Alt alta'], ['row', 'Yan yana']),
    iconStyle: tema(['logo', 'Platform logosu'], ['dot', 'Renkli nokta'])
  },

  'the-cup': {
    theme: tema(['glass', 'Cam'], ['neon', 'Neon'], ['wood', 'Ahşap'], ['minimal', 'Minimal'], ['crystal', 'Kristal'])
  },
  'pinned-messages': {
    theme: tema(['card', 'Kart'], ['banner', 'Şerit'], ['minimal', 'Minimal'], ['neon', 'Neon'], ['glass', 'Cam'], ['cute', 'Sevimli'], ['terminal', 'Terminal'], ['cozy', 'Rahat'], ['pixel', 'Piksel'], ['compact', 'Kompakt'], ['capsule', 'Kapsül'], ['hud', 'HUD (oyun arayüzü)']),
    position: tema(['top', 'Üst'], ['center', 'Orta'], ['bottom', 'Alt'])
  },
  'emote-combo': {
    comboStyle: tema(['none', 'Yok (renk ayarları)'], ['pixel', 'Piksel'], ['neon', 'Neon'], ['clean', 'Minimal'])
  },
  shoutout: {
    theme: tema(['card', 'Kart'], ['banner', 'Şerit'], ['minimal', 'Minimal'], ['neon', 'Neon'], ['glass', 'Cam'], ['softcard', 'Yumuşak kart'], ['neumorph', 'Kabartma'], ['borderline', 'Yalnız çerçeve'], ['broadcast', 'Haber bandı'], ['horizon', 'Ufuk'], ['stage', 'Sahne ışığı'], ['ember', 'Kor'], ['signal', 'Sinyal'], ['tag', 'Etiket'], ['ribbon', 'Kurdele'], ['guestpass', 'Konuk kartı'], ['phosphor', 'Fosfor ekran'], ['prism', 'Prizma']),
    position: tema(['top', 'Üst'], ['center', 'Orta'], ['bottom', 'Alt'])
  },
  rankings: {
    theme: tema(['classic', 'Klasik'], ['minimal', 'Minimal'], ['glass', 'Cam'], ['neon', 'Neon'], ['podium', 'Podyum']),
    sort: tema(['points', 'Puan'], ['watchtime', 'İzleme süresi'], ['messages', 'Mesaj sayısı'])
  },
  'hype-train': {
    theme: tema(['classic', 'Klasik'], ['minimal', 'Minimal'], ['glass', 'Cam'], ['neon', 'Neon'], ['rails', 'Raylar'])
  },
  lyrics: {
    theme: tema(['neon', 'Neon'], ['minimal', 'Minimal'], ['glass', 'Cam'], ['karaoke', 'Karaoke'], ['band', 'Şerit'], ['altyazi', 'Film altyazısı'], ['sahne', 'Sahne ışığı'], ['retro', 'Retro arcade'], ['kart', 'Beyaz kart'], ['kaset', 'Kaset / vintage'], ['aurora', 'Kutup ışığı']),
    lineFontFamily: [{ value: '', label: 'Genel yazı tipiyle aynı' }, ...FONTS.map(f => ({ value: f, label: f }))]
  },
  king: {
    theme: tema(['royal', 'Kraliyet'], ['minimal', 'Minimal'], ['glass', 'Cam'], ['neon', 'Neon'], ['plate', 'Plaka'])
  },
  jumpscare: {
    mediaType: tema(['image', 'Görsel'], ['video', 'Video'], ['audio', 'Yalnız ses'])
  },
  'loyalty-redemptions': {
    theme: tema(['card', 'Kart'], ['banner', 'Şerit'], ['minimal', 'Minimal'], ['neon', 'Neon'], ['glass', 'Cam']),
    position: tema(['top', 'Üst'], ['center', 'Orta'], ['bottom', 'Alt'])
  },
  'wheel-of-fortune': {
    palette: Object.entries(CARK_PALETLERI).map(([value, p]) => ({ value, label: p.ad }))
  },
  scoreboard: {
    theme: tema(['split', 'Yan yana kartlar'], ['stacked', 'Alt alta liste'], ['minimal', 'Minimal (yalnız yazı)'])
  },
  subathon: {
    theme: tema(['card', 'Kart'], ['minimal', 'Minimal (yalnız süre)'], ['digital', 'Dijital saat (LCD)'], ['flip', 'Çevirmeli kartlar'], ['neon', 'Neon'], ['pill', 'Tek satır hap']),
    timeFontFamily: FONTS.map(f => ({ value: f, label: f }))
  },
  'audio-player': {
    theme: tema(['status', 'Durum kartı'], ['minimal', 'Minimal'], ['neon', 'Neon'], ['dot', 'Sadece nokta'])
  }
};

/**
 * Galeri kimliği ile ayar kimliği aynı olmayan widget'lar. CloudTTS ile TTS
 * aynı ses oynatıcıyı, "Ekranda Emojiler" ile Emote Combo aynı bileşeni,
 * "Trivia Quiz" ise Bil Bakalım'ı açıyor — ayarları da ortak olmalı. Eskiden
 * bu kimliklerin WIDGET_DEFAULTS karşılığı yoktu ve pencere boş açılıyordu.
 */
const AYAR_TAKMA: Record<string, string> = {
  'cloud-tts': 'audio-player',
  tts: 'audio-player',
  'trivia-quiz': 'trivia'
};

const PATH_MAP: Record<string, string> = {
  'chat-overlay': '/widgets/chatbox',
  'alert-box': '/widgets/alertbox',
  'activity-feed': '/widgets/activity-feed',
  'cloud-tts': '/widgets/audio-player',
  tts: '/widgets/audio-player',
  'donation-goal': '/widgets/donation-goal',
  'follower-goal': '/widgets/follower-goal',
  'subscriber-goal': '/widgets/subscriber-goal',
  'kicks-goal': '/widgets/kicks-goal',
  'emote-combo': '/widgets/emote-combo',
  'on-screen-emotes': '/widgets/emotes',
  'event-labels': '/widgets/event-labels',
  subathon: '/widgets/subathon',
  'the-cup': '/widgets/the-cup',
  'word-cloud': '/widgets/word-cloud',
  scoreboard: '/widgets/scoreboard',
  'viewer-counter': '/widgets/viewer-counter',
  shoutout: '/widgets/shoutout',
  polls: '/widgets/polls',
  'hype-train': '/widgets/hype-train',
  'pinned-messages': '/widgets/pinned',
  'end-credits': '/widgets/credits',
  'wheel-of-fortune': '/widgets/wheel',
  'trivia-quiz': '/widgets/trivia',
  giveaways: '/widgets/giveaways',
  'loyalty-redemptions': '/widgets/loyalty-redeem',
  rankings: '/widgets/rankings',
  lyrics: '/widgets/lyrics',
  king: '/widgets/king',
  jumpscare: '/widgets/jumpscare',
  'audio-player': '/widgets/audio-player',
  trivia: '/widgets/trivia'
};

function secenekler(widgetId: string, key: string) {
  return WIDGET_SELECTS[widgetId]?.[key] || SELECTS[key];
}

function inferType(key: string, value: any, widgetId = ''): 'text' | 'textarea' | 'number' | 'checkbox' | 'color' | 'select' | 'range' {
  if (secenekler(widgetId, key)) return 'select';
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('opacity') || key.toLowerCase().includes('volume')) return 'range';
    return 'number';
  }
  if (key.toLowerCase().includes('color')) return 'color';
  if (key.toLowerCase().includes('template') || key === 'ignoreList') return 'textarea';
  return 'text';
}

export function WidgetSettingsForm({ widgetId, baseUrl, onUrlChange, autoSave = true }: { widgetId: string; baseUrl: string; onUrlChange?: (url: string) => void; autoSave?: boolean }) {
  const ayarId = AYAR_TAKMA[widgetId] || widgetId;
  const defaults = WIDGET_DEFAULTS[ayarId] || {};
  const keys = Object.keys(defaults).filter(k => typeof defaults[k] !== 'object' || defaults[k] === null);
  const [values, setValues] = useState<Record<string, any>>(defaults);
  const [status, setStatus] = useState('');
  const [openSection, setOpenSection] = useState<string>('all');

  // Yazı tipi listesi kendi görünümüyle gösterilsin: panel tüm yazı tiplerini bir kez yükler
  useEffect(() => {
    if (document.getElementById('axt-tum-yazilar')) return;
    const l = document.createElement('link');
    l.id = 'axt-tum-yazilar';
    l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?${FONTS.map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}`).join('&')}&display=swap`;
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    fetch(`/api/widgets/${ayarId}/settings`)
      .then(r => r.json())
      .then(d => { ilkDeger.current = true; setValues({ ...defaults, ...d }); })
      .catch(() => { ilkDeger.current = true; setValues(defaults); });
  }, [ayarId]);

  const buildUrl = (next = values) => {
    const qs = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (typeof v === 'object') return;
      if (typeof v === 'boolean') qs.set(k, v ? '1' : '0');
      else if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return `${baseUrl}${PATH_MAP[widgetId] || '/widgets/alertbox'}${q ? `?${q}` : ''}`;
  };

  const save = async (veri: Record<string, any> = values) => {
    await fetch(`/api/widgets/${ayarId}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(veri)
    });
    onUrlChange?.(buildUrl(veri));
    setStatus('Ayarlar kaydedildi. Overlay anında güncellendi.');
    setTimeout(() => setStatus(''), 2500);
  };

  // Otomatik kaydetme: değişiklik 500 ms sonra sunucuya yazılır, sunucu da
  // `widget_settings` yayını yapar; OBS'teki katman anında güncellenir.
  // Eskiden yalnız "Kaydet" düğmesiyle uygulanıyordu.
  const ilkDeger = useRef(true);
  useEffect(() => {
    if (!autoSave) return;
    if (ilkDeger.current) {
      ilkDeger.current = false;
      return;
    }
    const t = setTimeout(() => {
      void save(values).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, autoSave]);

  if (keys.length === 0) return null;

  const grouped = keys.reduce((acc, key) => {
    const section = WIDGET_SECTIONS[ayarId]?.[key] || SECTIONS[key] || 'Genel';
    acc[section] = acc[section] || [];
    acc[section].push(key);
    return acc;
  }, {} as Record<string, string[]>);

  const sections = Object.keys(grouped);

  return (
    <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-gray-200">Widget Ayarları</h4>
        <select
          value={openSection}
          onChange={e => setOpenSection(e.target.value)}
          className="bg-black/60 border border-white/10 rounded-lg p-1 text-[11px] text-white"
        >
          <option value="all">Tüm sekmeler</option>
          {sections.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Tema kutuphanesi — BotRix widget basina 13-28 tema sunuyor, bizde
          4-5 vardi. Tema, ayar degerlerinin hazir bir kumesidir: secilince
          ilgili alanlar dolar, kullanici sonra tek tek degistirebilir.
          Widget'in TANIMADIGI anahtarlar atlanir. */}
      <div>
        <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300 border-b border-white/10 pb-1 mb-2">
          Hazır Temalar ({temalar(ayarId).length})
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-40 overflow-y-auto pr-1">
          {temalar(ayarId).map(t => (
            <button
              key={t.id}
              type="button"
              title={t.etiket}
              onClick={() =>
                setValues(v =>
                  temayiUygula(v, t, keys, (k, deger) => {
                    const sec = secenekler(ayarId, k);
                    return !sec || sec.some(o => o.value === deger);
                  }) as Record<string, any>
                )
              }
              className="rounded-lg border border-white/10 hover:border-cyan-400 overflow-hidden text-left transition-colors"
            >
              <div
                className="h-7 flex items-center justify-center"
                style={{ background: t.onizleme.arka, borderBottom: `2px solid ${t.onizleme.vurgu}` }}
              >
                <span className="text-[11px] font-black" style={{ color: t.onizleme.metin, fontFamily: t.onizleme.yazi || String(t.degerler.fontFamily || '') || undefined }}>Aa</span>
              </div>
              <div className="px-1 py-0.5 text-[9px] text-gray-300 truncate">{t.etiket}</div>
            </button>
          ))}
        </div>
      </div>

      {ayarId === 'alert-box' && <UyariOlayMedyasi />}
      {/* Widget'a özel kontroller: galeri penceresinde ve Tek URL stüdyosunda aynı yerde */}
      {ayarId === 'pinned-messages' && <SabitMesajPaneli />}
      {ayarId === 'word-cloud' && <SohbetIstatistikPaneli />}
      {ayarId === 'scoreboard' && <SkorTablosuPaneli />}

      {sections.filter(s => openSection === 'all' || openSection === s).map(section => (
        <div key={section} className="space-y-2">
          <div className="text-[10px] font-black uppercase tracking-wider text-purple-300 border-b border-white/10 pb-1">{section}</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {grouped[section].map(key => {
              const type = inferType(key, values[key] ?? defaults[key], ayarId);
              return (
                <label key={key} className="text-[11px] text-gray-300 font-semibold space-y-1">
                  <span>{LABELS[key] || key}</span>
                  {type === 'checkbox' ? (
                    <input type="checkbox" checked={!!values[key]} onChange={e => setValues(v => ({ ...v, [key]: e.target.checked }))} className="ml-2 accent-purple-600" />
                  ) : type === 'select' ? (
                    <select value={values[key] ?? ''} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white">
                      {(secenekler(ayarId, key) || []).map(o => <option key={o.value} value={o.value} style={/font/i.test(key) && FONTS.includes(o.value) ? { fontFamily: o.value } : undefined}>{o.label}</option>)}
                    </select>
                  ) : type === 'textarea' ? (
                    <textarea value={values[key] ?? ''} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white min-h-[52px]" />
                  ) : (
                    <input
                      type={type === 'range' ? 'range' : type}
                      min={type === 'range' ? 0 : undefined}
                      max={type === 'range' ? 1 : undefined}
                      step={type === 'range' ? 0.05 : type === 'number' ? 1 : undefined}
                      value={values[key] ?? ''}
                      onChange={e => setValues(v => ({
                        ...v,
                        [key]: type === 'number' || type === 'range' ? parseFloat(e.target.value) : e.target.value
                      }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>
      ))}

      <button onClick={save} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
        <Save className="w-3.5 h-3.5" /> Ayarları Kaydet
      </button>
      {status && <div className="text-xs text-emerald-400">{status}</div>}
    </div>
  );
}
