/**
 * StreamAxT Chat Overlay
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { CHAT_DEFAULTS } from '../lib/widget-defaults.js';
import { ChatMessageContent } from '../components/ChatMessageContent.js';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { PlatformBadges } from '../components/PlatformBadge.js';
import { onizlemeKipi, yaziOlcegi } from '../lib/widget-style.js';
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
  /** Twitch emote konumları (kanalın kendi emote'ları için) */
  emotes?: Record<string, string[]>;
  /** Platformun gönderdiği rozet ve rol bilgisi (özgün rozet görselleri için) */
  rozet: { rawBadges?: any[]; badges?: string[]; isBroadcaster?: boolean; isMod?: boolean; isVip?: boolean; isSub?: boolean };
  avatar?: string;
  ts: string;
  special?: boolean;
  created: number;
}

/** Platformların özgün marka renkleri */
const PLATFORM_COLORS: Record<string, string> = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff0000', tiktok: '#fe2c55', trovo: '#19d66b', discord: '#5865f2' };
/** Marka renginin üstünde okunur yazı (Kick yeşili açık: siyah) */
const PLATFORM_YAZI: Record<string, string> = { kick: '#000000', trovo: '#000000' };

/** #rrggbb + saydamlık → #rrggbbaa */
const saydam = (renk: string, oran: number) =>
  /^#[0-9a-f]{6}$/i.test(renk) ? `${renk}${Math.round(Math.max(0, Math.min(1, oran)) * 255).toString(16).padStart(2, '0')}` : renk;

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
  // Çıkış animasyonu: listeden düşen ileti kısa süre "gidiyor" olarak çizilir. Moderatör silmesi ve
  // sohbet temizliği anında olur (silinen ileti ekranda oynamasın).
  const [gidenler, setGidenler] = useState<OverlayMsg[]>([]);
  const oncekiler = useRef<OverlayMsg[]>([]);
  const anlik = useRef(false);

  useEffect(() => {
    if (!lastMessage || islenen.current === lastMessage) return;
    // Panelden/komutla sohbet temizlenince ya da moderatör iletiyi silince/kullanıcıyı
    // yasaklayınca OBS katmanı da güncellenir (eskiden yalnız 'chat' dinleniyordu).
    if (lastMessage.type === 'clear_chat') {
      islenen.current = lastMessage;
      anlik.current = true;
      setMessages([]);
      return;
    }
    if (lastMessage.type === 'chat_deleted' || lastMessage.type === 'chat_user_removed') {
      islenen.current = lastMessage;
      const d = lastMessage.data || {};
      anlik.current = true;
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
        emotes: p.emotes,
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

  const cikis = String(s.exitAnimation || 'fade');
  useEffect(() => {
    const once = oncekiler.current;
    oncekiler.current = messages;
    if (anlik.current) {
      anlik.current = false;
      return;
    }
    if (cikis === 'none') return;
    const kalan = new Set(messages.map((m) => m.id));
    const giden = once.filter((m) => !kalan.has(m.id));
    if (!giden.length) return;
    setGidenler((g) => [...g, ...giden]);
    const t = setTimeout(() => setGidenler((g) => g.filter((x) => !giden.includes(x))), 520);
    return () => clearTimeout(t);
  }, [messages, cikis]);

  // Mesajlar kaybolsun (isteğe bağlı) · bağış/ödül satırları ayrı sürede kaybolur (varsayılan 30 sn)
  const olaySn = Number(s.eventFadeSec) || 0;
  useEffect(() => {
    if (!s.fadeMessages && olaySn <= 0) return;
    const t = setInterval(() => {
      const simdi = Date.now();
      setMessages((prev) => {
        const kalan = prev.filter(
          (m) => (!s.fadeMessages || m.created > simdi - s.fadeTimeout * 1000) && (olaySn <= 0 || m.platform !== 'olay' || m.created > simdi - olaySn * 1000)
        );
        return kalan.length === prev.length ? prev : kalan;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [s.fadeMessages, s.fadeTimeout, olaySn]);

  // Stüdyo önizlemesi: örnekler yalnız henüz hiç canlı ileti gelmemişken (kaybolan iletinin yerine
  // örnekler geri gelince canlı sohbet görünmüyor sanılıyordu)
  const kaynak = onizlemeKipi(props?.previewMode) && messages.length === 0 && !canliGeldi.current ? ORNEK_MESAJLAR : messages;
  // Liste eskiden yeniye; "yeni mesajlar üstte" yalnız çizimde ters çevirir. Giden iletiler eski yerinde çizilir.
  const gidenIdler = new Set(gidenler.map((m) => m.id));
  const birlesik = gidenler.length ? [...gidenler, ...kaynak].sort((a, b) => a.created - b.created) : kaynak;
  const list = s.reverse ? [...birlesik].reverse() : birlesik;
  const yanYana = s.layout === 'row';
  const stil = String(s.chatStyle || 'klasik');
  // Balon: eskiden yalnız "şeffaf arka plan" kapalıyken (kutu da siyahken) çiziliyordu
  const balon = !s.transparentBg || Boolean(s.messageBubbles);
  const msgBg = s.messageBgColor.length === 7 ? saydam(s.messageBgColor, s.messageBgOpacity) : 'transparent';
  // Koyu zemin isteyen görünümler, ileti zemini kapalıyken de okunur kalsın
  const koyuBg = s.messageBgOpacity > 0 ? msgBg : '#000000b3';
  // Dar/süslü yazı tipleri aynı puntoda çok küçük görünüyordu: görünür boyut dengelenir
  const boy = Math.round((Number(s.fontSize) || 22) * yaziOlcegi(s.fontFamily));

  const metinStili: CSSProperties = {
    fontSize: boy,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    color: s.textColor,
    textAlign: s.align as CSSProperties['textAlign'],
    WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined,
    margin: 0,
    minWidth: 0
  };
  const yaslama = s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start';
  const sira: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, verticalAlign: 'middle' };

  const ileti = (msg: OverlayMsg) => {
    const pr = PLATFORM_COLORS[msg.platform] || s.highlightColor;
    // Vurgu: "platform renkleri" açıksa platformun özgün rengi
    const vurgu = s.platformColors && PLATFORM_COLORS[msg.platform] ? pr : s.highlightColor;
    const vurguKenar = s.highlightSpecial && msg.special ? `3px solid ${vurgu}` : undefined;
    const avatar = s.showAvatars && msg.avatar ? (
      <img src={msg.avatar} alt="" style={{ width: Math.round(boy * 1.1), height: Math.round(boy * 1.1), borderRadius: '50%', flexShrink: 0 }} />
    ) : null;
    const logo = (renk?: string) =>
      s.showPlatformLogo && msg.platform !== 'olay' ? (
        <span style={{ color: renk || PLATFORM_COLORS[msg.platform] || '#cbd5e1', display: 'inline-flex', flexShrink: 0 }} title={msg.platform}>
          <PlatformLogo platform={msg.platform} size={Math.round(boy * 0.95) || 16} />
        </span>
      ) : null;
    const zaman = s.showTimestamp ? <span style={{ color: '#94a3b8', fontSize: Math.round(boy * 0.65), flexShrink: 0 }}>{msg.ts}</span> : null;
    const rozetler = s.showBadges ? (
      <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
        <PlatformBadges platform={msg.platform as any} user={msg.rozet as any} size={Math.round(boy * 1.05) || 18} />
      </span>
    ) : null;
    const icerik = <ChatMessageContent message={msg.text} size={Math.round(boy * 1.3) || 24} twitchEmotes={msg.emotes} />;
    const ad = (renk: string = msg.color) => <span style={{ color: renk, fontWeight: 800 }}>{msg.user}</span>;
    const kutu: CSSProperties = { whiteSpace: yanYana ? 'nowrap' : undefined, textShadow: s.textShadow ? '0 2px 8px #000' : undefined };
    // Ad satırı + ileti (kart, neon ve şerit görünümlerinde ortak)
    const satir = (oncesi: ReactNode) => (
      <p style={metinStili}>
        <span style={{ ...sira, marginRight: 6 }}>{oncesi}{ad()}</span>
        {icerik}
      </p>
    );

    switch (stil) {
      // Kart: platformun renginde şerit ve hafif tonlu zemin
      case 'platformkart':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-start', gap: 8, background: `linear-gradient(90deg, ${saydam(pr, 0.25)}, ${koyuBg})`, borderLeft: `4px solid ${pr}`, borderRadius: s.borderRadius, padding: '6px 10px' }}>
            {avatar}
            {satir(<>{logo()}{rozetler}</>)}
          </div>
        );
      // Başlıklı: üstte ad satırı, altında ileti balonu
      case 'baslikli':
        return (
          <div style={{ ...kutu, display: 'flex', flexDirection: 'column', gap: 3, alignItems: yaslama }}>
            <div style={{ ...sira, display: 'flex', fontSize: Math.round(boy * 0.8) }}>{avatar}{logo()}{rozetler}{ad()}{zaman}</div>
            <p style={{ ...metinStili, background: koyuBg, borderRadius: s.borderRadius, padding: '6px 12px', borderLeft: vurguKenar }}>{icerik}</p>
          </div>
        );
      // Etiket: kullanıcı adı dolu bir hapın içinde (platform renkleri açıksa platformun renginde)
      case 'etiket': {
        const zemin = s.platformColors ? pr : msg.color;
        const yazi = s.platformColors ? PLATFORM_YAZI[msg.platform] || '#ffffff' : '#ffffff';
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-start', gap: 8, background: balon ? msgBg : 'transparent', borderRadius: s.borderRadius, padding: balon ? '5px 8px' : 0 }}>
            {avatar}
            <p style={metinStili}>
              <span style={{ ...sira, gap: 5, background: zemin, color: yazi, borderRadius: 999, padding: '1px 10px 1px 6px', marginRight: 8, textShadow: 'none' }}>
                {logo(yazi)}
                {rozetler}
                {ad('inherit')}
              </span>
              {icerik}
            </p>
          </div>
        );
      }
      // Konuşma balonu: solda avatar ya da logo, kuyruklu balon
      case 'konusma':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-end', gap: 10, justifyContent: yaslama }}>
            {avatar || logo()}
            <div style={{ position: 'relative', background: koyuBg, borderRadius: s.borderRadius, padding: '6px 12px', border: `2px solid ${saydam(vurgu, 0.7)}`, minWidth: 0 }}>
              <span style={{ position: 'absolute', left: -9, bottom: 8, width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `8px solid ${saydam(vurgu, 0.7)}` }} />
              <div style={{ ...sira, display: 'flex', fontSize: Math.round(boy * 0.75), marginBottom: 2 }}>{rozetler}{ad()}{zaman}</div>
              <p style={metinStili}>{icerik}</p>
            </div>
          </div>
        );
      // Şerit: solda platformun renginde blok, içinde logo
      case 'serit':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'stretch', borderRadius: s.borderRadius, overflow: 'hidden', background: koyuBg }}>
            <span style={{ background: pr, color: PLATFORM_YAZI[msg.platform] || '#ffffff', display: 'flex', alignItems: 'center', padding: '0 8px', flexShrink: 0 }}>
              {msg.platform === 'olay' ? '★' : <PlatformLogo platform={msg.platform} size={Math.round(boy * 0.95)} />}
            </span>
            <div style={{ padding: '6px 10px', minWidth: 0 }}>{satir(rozetler)}</div>
          </div>
        );
      // Neon: platformun (ya da vurgunun) renginde parlayan çerçeve
      case 'neon':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-start', gap: 8, background: s.messageBgOpacity > 0 ? msgBg : '#05010dcc', border: `2px solid ${vurgu}`, boxShadow: `0 0 10px ${saydam(vurgu, 0.8)}, inset 0 0 8px ${saydam(vurgu, 0.35)}`, borderRadius: s.borderRadius, padding: '6px 10px' }}>
            {avatar}
            {satir(<>{logo()}{rozetler}</>)}
          </div>
        );
      // Kompakt: zeminsiz, küçük öğeler
      case 'kompakt':
        return (
          <div style={kutu}>
            <p style={{ ...metinStili, fontSize: Math.round(boy * 0.85) }}>
              <span style={{ ...sira, gap: 4, marginRight: 5 }}>{logo()}{ad()}:</span>
              {icerik}
            </p>
          </div>
        );
      default:
        return (
          <div className="flex items-start" style={{
            ...kutu,
            gap: 8,
            justifyContent: yaslama,
            background: balon ? msgBg : 'transparent',
            borderRadius: s.borderRadius,
            padding: balon ? '6px 10px' : 0,
            borderLeft: vurguKenar
          }}>
            {avatar && <span style={{ marginTop: 2, display: 'inline-flex' }}>{avatar}</span>}
            {logo() && <span style={{ marginTop: 3, display: 'inline-flex' }}>{logo()}</span>}
            {zaman && <span style={{ marginTop: 4, display: 'inline-flex' }}>{zaman}</span>}
            {rozetler && <span style={{ marginTop: 2, display: 'inline-flex' }}>{rozetler}</span>}
            <p style={metinStili}>
              <span style={{ color: msg.color, fontWeight: 800 }}>{msg.user}: </span>
              {icerik}
            </p>
          </div>
        );
    }
  };

  return (
    <div className="flex gap-1 p-4 h-full" style={{
      fontFamily: s.fontFamily,
      // Kalınlık uydurulmaz: yazı tipinde olmayan kalınlığı tarayıcı kendisi çizince harfler dağılıyordu
      fontSynthesis: 'none',
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
      {list.map((msg) => (
        <div key={msg.id} className={gidenIdler.has(msg.id) ? `axt-cikis-${cikis}` : `axt-anim-${s.animation}`} style={{ flexShrink: 0 }}>
          {ileti(msg)}
        </div>
      ))}
    </div>
  );
}

export default ChatBoxWidget;
