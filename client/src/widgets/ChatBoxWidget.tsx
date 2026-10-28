/**
 * StreamAxT Chat Overlay
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { CHAT_DEFAULTS } from '../lib/widget-defaults.js';
import { ChatMessageContent } from '../components/ChatMessageContent.js';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { PlatformBadges } from '../components/PlatformBadge.js';
import { onizlemeKipi } from '../lib/widget-style.js';
import { iletiCikar, iletiEkle } from '../lib/sohbetListesi.js';

/** Yeni ileti sesi: dosya gerektirmeyen kısa bir "tık" (WebAudio). */
let sesBaglami: AudioContext | null = null;
function tikla(ses: number) {
  try {
    sesBaglami ??= new AudioContext();
    const c = sesBaglami;
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(Math.max(0, Math.min(1, ses)) * 0.3, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.13);
  } catch {
    /* ses aygıtı yoksa sessiz geç */
  }
}

interface OverlayMsg {
  id: string;
  /** Platformun ileti kimliği (moderatör silince kaldırmak için) */
  kaynakId?: string;
  /** Küçük harf kullanıcı adı (yasaklanınca iletilerini kaldırmak için) */
  kullanici?: string;
  platform: string;
  user: string;
  color: string;
  text: string;
  /** Platformun gönderdiği rozet ve rol bilgisi (özgün rozet görselleri için) */
  rozet: { rawBadges?: any[]; badges?: string[]; isBroadcaster?: boolean; isMod?: boolean; isVip?: boolean; isSub?: boolean };
  avatar?: string;
  ts: string;
  special?: boolean;
  created: number;
}

const PLATFORM_COLORS: Record<string, string> = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff0000', tiktok: '#fe2c55' };

/**
 * Önizleme örnekleri: stüdyo tuvali ve OBS test kipi boş bir kutu yerine
 * gerçek bileşenin bu ayarlarla NASIL görüneceğini göstersin.
 */
const ORNEK_MESAJLAR: OverlayMsg[] = [
  { id: 'o1', platform: 'kick', user: 'Kaan', color: '#53fc18', text: 'Selamlar! Harika yayın oluyor.', rozet: { isMod: true }, ts: '14:22', special: true, created: 0 },
  { id: 'o2', platform: 'twitch', user: 'Ayse', color: '#f59e0b', text: 'Boss savaşında bol şans 🔥', rozet: { isSub: true }, ts: '14:23', special: true, created: 0 },
  { id: 'o3', platform: 'youtube', user: 'Murat', color: '#f87171', text: '!ses alkış', rozet: {}, ts: '14:24', created: 0 }
];

export function ChatBoxWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('chat-overlay', CHAT_DEFAULTS);
  const { lastMessage } = useWebSocket('chatbox');
  const [messages, setMessages] = useState<OverlayMsg[]>([]);
  /** Bu etki ayar (`s`) değişince de çalışır: aynı ileti İKİNCİ KEZ eklenmesin. */
  const islenen = useRef<unknown>(null);
  const canliGeldi = useRef(false);

  useEffect(() => {
    if (!lastMessage || islenen.current === lastMessage) return;
    // Panelden/komutla sohbet temizlenince ya da moderatör iletiyi silince/kullanıcıyı
    // yasaklayınca OBS katmanı da güncellenir (eskiden yalnız 'chat' dinleniyordu).
    if (lastMessage.type === 'clear_chat') {
      islenen.current = lastMessage;
      setMessages([]);
      return;
    }
    if (lastMessage.type === 'chat_deleted' || lastMessage.type === 'chat_user_removed') {
      islenen.current = lastMessage;
      const d = lastMessage.data || {};
      setMessages((prev) => iletiCikar(prev, { platform: d.platform, id: d.id ? String(d.id) : undefined, kullanici: d.username }));
      return;
    }
    if (lastMessage.type === 'chat_event') {
      islenen.current = lastMessage;
      const d = lastMessage.data || {};
      if ((d.tur === 'bagis' && !s.showDonations) || (d.tur === 'odul' && !s.showRedemptions)) return;
      const olay: OverlayMsg = {
        id: `${Date.now()}-${Math.random()}`,
        platform: 'olay',
        user: `${d.tur === 'bagis' ? '💸' : '🎁'} ${d.kullanici || ''}`,
        color: s.highlightColor,
        text: String(d.metin || ''),
        rozet: {},
        ts: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        special: true,
        created: Date.now()
      };
      setMessages((prev) => iletiEkle(prev, olay, s.maxMessages));
      return;
    }
    if (lastMessage.type !== 'chat') return;
    islenen.current = lastMessage;
    const p = lastMessage.data || lastMessage.payload;
    // Ortak kara listedeki kullanıcının ve kalkana takılan mesaj yayında gösterilmez
    if (!p || p.karaListede || p.kalkanda) return;
    const user = p.user;
    const username = (user?.username || '').toLowerCase();
    const ignored = (s.ignoreList || '').split(',').map((x: string) => x.trim().toLowerCase()).filter(Boolean);
    if (ignored.includes(username)) return;
    // Seçilmeyen platformun sohbeti katmanda gösterilmez
    if ((s as Record<string, unknown>)[`${p.platform}Goster`] === false) return;
    if (s.hideCommands && (p.message || '').trim().startsWith('!')) return;
    // Panel iç hata iletisi (Gönderilemedi…) yayına çıkmaz
    if (user?.id === 'streamaxt_system') return;
    // "Botları gizle" başka botlar içindir; kendi botumuzun yanıtları (yapay zekâ, bilgi yarışması,
    // zamanlayıcılar) ayrı seçenekle görünür — eskiden bot adı ("…_Bot") yüzünden hep gizleniyordu
    const kendiBot = user?.isSelf === true || user?.id === 'streamaxt_bot';
    if (kendiBot ? !s.showOwnBot : s.hideBots && (user?.isBot || username.includes('bot'))) return;
    if (s.hideBroadcaster && user?.isBroadcaster) return;
    // Kick emote'u `[emote:123:ad]` biçiminde gelir; eski `:ad:` deseni onu tanımıyordu
    if (s.hideEmoteOnly && !String(p.message || '').replace(/\[emote:\d+:[^\]]+\]|:\w+:/g, '').trim()) return;

    // Rozetler emoji yerine platformun ÖZGÜN rozetleriyle çizilir (PlatformBadges)
    const rozet = {
      rawBadges: Array.isArray(user?.rawBadges) ? user.rawBadges : [],
      badges: Array.isArray(user?.badges) ? user.badges : [],
      isBroadcaster: Boolean(user?.isBroadcaster),
      isMod: Boolean(user?.isMod),
      isVip: Boolean(user?.isVip),
      isSub: Boolean(user?.isSub)
    };

    const color = s.usernameColorMode === 'platform'
      ? (PLATFORM_COLORS[p.platform] || '#fff')
      : s.usernameColorMode === 'custom'
        ? s.customUsernameColor
        : (user?.color || PLATFORM_COLORS[p.platform] || '#fff');

    setMessages(prev => {
      const next: OverlayMsg = {
        id: `${Date.now()}-${Math.random()}`,
        kaynakId: p.id ? String(p.id) : undefined,
        kullanici: username || undefined,
        platform: p.platform,
        user: user?.displayName || user?.username || 'anon',
        color,
        text: p.message,
        rozet,
        // Sunucu yükü `avatarUrl` taşır; eski `avatar` alanı hiç dolu gelmiyordu
        avatar: user?.avatarUrl || user?.avatar,
        ts: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        special: Boolean(user?.isSub || user?.isMod || user?.isBroadcaster),
        created: Date.now()
      };
      return iletiEkle(prev, next, s.maxMessages);
    });
    canliGeldi.current = true;
    if (s.messageSound && !onizlemeKipi(props?.previewMode)) tikla(Number(s.messageSoundVolume) || 0.4);
  }, [lastMessage, s]);

  useEffect(() => {
    if (!s.fadeMessages) return;
    const t = setInterval(() => {
      const cutoff = Date.now() - s.fadeTimeout * 1000;
      setMessages(prev => prev.filter(m => m.created > cutoff));
    }, 1000);
    return () => clearInterval(t);
  }, [s.fadeMessages, s.fadeTimeout]);

  // Stüdyo önizlemesi: örnekler yalnız henüz hiç canlı ileti gelmemişken (kaybolan iletinin yerine
  // örnekler geri gelince canlı sohbet görünmüyor sanılıyordu)
  const kaynak = onizlemeKipi(props?.previewMode) && messages.length === 0 && !canliGeldi.current ? ORNEK_MESAJLAR : messages;
  // Liste eskiden yeniye; "yeni mesajlar üstte" yalnız çizimde ters çevirir
  const list = s.reverse ? [...kaynak].reverse() : kaynak;
  const yanYana = s.layout === 'row';
  // Balon: eskiden yalnız "şeffaf arka plan" kapalıyken (kutu da siyahken) çiziliyordu
  const balon = !s.transparentBg || Boolean(s.messageBubbles);
  const msgBg = s.messageBgColor.length === 7
    ? `${s.messageBgColor}${Math.round(s.messageBgOpacity * 255).toString(16).padStart(2, '0')}`
    : 'transparent';

  return (
    <div className="flex gap-1 p-4 h-full" style={{
      fontFamily: s.fontFamily,
      gap: s.gap,
      // Alt alta: yeni mesaj altta ise kutunun dibine, üstte ise tepesine dayanır.
      // Yan yana: tek satır, en yeni sağda; eskiler soldan taşar.
      flexDirection: yanYana ? 'row' : 'column',
      justifyContent: yanYana ? 'flex-end' : s.reverse ? 'flex-start' : 'flex-end',
      alignItems: yanYana ? 'center' : undefined,
      overflow: 'hidden',
      background: s.transparentBg ? 'transparent' : '#0a0a0a',
      maskImage: s.smoothMask
        ? `linear-gradient(to ${yanYana ? 'right' : s.reverse ? 'top' : 'bottom'}, transparent 0%, black 18%)`
        : undefined
    }}>
      {list.map(msg => (
        <div key={msg.id} className={`axt-anim-${s.animation} flex items-start`} style={{
          flexShrink: 0,
          whiteSpace: yanYana ? 'nowrap' : undefined,
          gap: 8,
          justifyContent: s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start',
          background: balon ? msgBg : 'transparent',
          borderRadius: s.borderRadius,
          padding: balon ? '6px 10px' : 0,
          borderLeft: s.highlightSpecial && msg.special ? `3px solid ${s.highlightColor}` : undefined,
          textShadow: s.textShadow ? '0 2px 8px #000' : undefined
        }}>
          {s.showAvatars && msg.avatar && (
            <img src={msg.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', marginTop: 2 }} />
          )}
          {s.showPlatformLogo && (
            <span style={{ color: PLATFORM_COLORS[msg.platform] || '#cbd5e1', display: 'inline-flex', marginTop: 3, flexShrink: 0 }} title={msg.platform}>
              <PlatformLogo platform={msg.platform} size={Math.round(Number(s.fontSize) * 0.95) || 16} />
            </span>
          )}
          {s.showTimestamp && <span style={{ color: '#64748b', fontSize: s.fontSize * 0.65, marginTop: 4 }}>{msg.ts}</span>}
          {s.showBadges && (
            <span style={{ display: 'inline-flex', gap: 3, marginTop: 2, flexShrink: 0 }}>
              <PlatformBadges platform={msg.platform as any} user={msg.rozet as any} size={Math.round(Number(s.fontSize) * 1.05) || 18} />
            </span>
          )}
          <p style={{
            fontSize: s.fontSize,
            fontWeight: s.fontWeight,
            lineHeight: s.lineHeight,
            letterSpacing: s.letterSpacing,
            color: s.textColor,
            textAlign: s.align as any,
            WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined
          }}>
            <span style={{ color: msg.color, fontWeight: 800 }}>{msg.user}: </span>
            <ChatMessageContent message={msg.text} size={Math.round(Number(s.fontSize) * 1.3) || 24} />
          </p>
        </div>
      ))}
    </div>
  );
}

export default ChatBoxWidget;
