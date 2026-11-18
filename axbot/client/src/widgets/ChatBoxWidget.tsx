/**
 * AxBoT Chat Overlay
 * Developed by AxthrowA
 */
import { SohbetAvatari } from '../components/SohbetAvatari.js';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { CHAT_DEFAULTS, OGE_TAVANI } from '../lib/widget-defaults.js';
import { ChatMessageContent } from '../components/ChatMessageContent.js';
import { boyaStili, useYediTvBoyasi } from '../lib/yediTv.js';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { PlatformBadges } from '../components/PlatformBadge.js';
import { kartTasarimlari, onizlemeKipi, yaziAilesi, yaziOlcegi } from '../lib/widget-style.js';
import { kokOzellik, yapisalKabukMu } from '../lib/kabuklar.js';
import { CIKIS_ORANI, animKimligi, cikisKimligi, hareketAnahtari, ortakHareket } from '../lib/animations.js';
import { iletiCikar, iletiEkle, iletiVurgula } from '../lib/sohbetListesi.js';

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

/** Kullanıcının 7TV boyası varsa ad degrade/gölgeyle; yoksa düz renk */
function BoyaliAd({ msg, acik, style, children }: { msg: OverlayMsg; acik: unknown; style: CSSProperties; children: ReactNode }) {
  const boya = useYediTvBoyasi(msg.platform, msg.kullaniciId, acik !== false);
  return <span style={{ ...style, ...boyaStili(boya) }}>{children}</span>;
}

interface OverlayMsg {
  id: string;
  /** Platformun ileti kimliği (moderatör silince kaldırmak için) */
  kaynakId?: string;
  /** Küçük harf kullanıcı adı (yasaklanınca iletilerini kaldırmak için) */
  kullanici?: string;
  /** Platform kullanıcı kimliği (7TV ad boyası için) */
  kullaniciId?: string;
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
  /** Panelden "katmanda vurgula" bitiş zamanı (ms) */
  vurguBitis?: number;
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
      // İşaret yalnız gerçekten silinen ileti varsa: boş sohbette takılı kalıp sonraki çıkışı yutmasın
      const platform = lastMessage.platform;
      setMessages((prev) => {
        const kalan = platform ? prev.filter((m) => m.platform !== platform) : [];
        if (kalan.length !== prev.length) anlik.current = true;
        return kalan;
      });
      return;
    }
    if (lastMessage.type === 'chat_deleted' || lastMessage.type === 'chat_user_removed') {
      islenen.current = lastMessage;
      const d = lastMessage.data || {};
      setMessages((prev) => {
        const kalan = iletiCikar(prev, { platform: d.platform, id: d.id ? String(d.id) : undefined, kullanici: d.username });
        if (kalan.length !== prev.length) anlik.current = true;
        return kalan;
      });
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
      setMessages((prev) => iletiEkle(prev, olay, Math.min(OGE_TAVANI.sohbet, s.maxMessages)));
      return;
    }
    if (lastMessage.type === 'chat_highlight') {
      islenen.current = lastMessage;
      const d = lastMessage.data || {};
      const bitis = Date.now() + Math.min(60000, Math.max(3000, Number(d.sure) || 15000));
      setMessages((prev) =>
        iletiVurgula(prev, { platform: d.platform, id: d.id ? String(d.id) : undefined }, bitis, () => ({
          id: `${Date.now()}-${Math.random()}`,
          kaynakId: d.id ? String(d.id) : undefined,
          kullanici: String(d.username || '').toLowerCase() || undefined,
          platform: String(d.platform || 'kick'),
          user: String(d.displayName || d.username || 'anon'),
          color: d.color || PLATFORM_COLORS[d.platform] || '#fff',
          text: String(d.message || ''),
          rozet: {},
          ts: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          created: Date.now()
        }), Math.min(OGE_TAVANI.sohbet, s.maxMessages))
      );
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
    if (user?.id === 'axbot_system') return;
    // "Botları gizle" başka botlar içindir; kendi botumuzun yanıtları (yapay zekâ, bilgi yarışması,
    // zamanlayıcılar) ayrı seçenekle görünür — eskiden bot adı ("…_Bot") yüzünden hep gizleniyordu
    const kendiBot = user?.isSelf === true || user?.id === 'axbot_bot';
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
        kullaniciId: user?.id != null ? String(user.id) : undefined,
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
      return iletiEkle(prev, next, Math.min(OGE_TAVANI.sohbet, s.maxMessages));
    });
    canliGeldi.current = true;
    if (s.messageSound && !onizlemeKipi(props?.previewMode)) tikla(Number(s.messageSoundVolume) || 0.4);
  }, [lastMessage, s]);

  useEffect(() => {
    const bitisler = messages.map((m) => m.vurguBitis).filter((b): b is number => !!b);
    if (!bitisler.length) return;
    const t = window.setTimeout(() => {
      const simdi = Date.now();
      setMessages((prev) => prev.map((m) => (m.vurguBitis && m.vurguBitis <= simdi ? { ...m, vurguBitis: undefined } : m)));
    }, Math.max(0, Math.min(...bitisler) - Date.now()) + 20);
    return () => window.clearTimeout(t);
  }, [messages]);

  const girisId = animKimligi(String(s.animation || 'fade'));
  const cikisId = cikisKimligi(s.animation, s.exitAnimation);
  const girisMs = Math.max(0, Number(s.animationDuration) || 450);
  const cikisMs = Math.max(40, Math.round(girisMs * CIKIS_ORANI));
  useEffect(() => {
    const once = oncekiler.current;
    oncekiler.current = messages;
    if (anlik.current) {
      anlik.current = false;
      return;
    }
    if (cikisId === 'none') return;
    const kalan = new Set(messages.map((m) => m.id));
    const giden = once.filter((m) => !kalan.has(m.id));
    if (!giden.length) return;
    setGidenler((g) => [...g, ...giden]);
    // Temizlikte iptal edilmez: sohbet hızlıyken bir sonraki değişim zamanlayıcıyı iptal edip gidenleri biriktiriyordu
    setTimeout(() => setGidenler((g) => g.filter((x) => !giden.includes(x))), cikisMs + 40);
  }, [messages, cikisId, cikisMs]);

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
  const seffafIleti = s.messageBgTransparent === true || s.arkaPlanKapali === true;
  const msgBg = !seffafIleti && s.messageBgColor.length === 7 ? saydam(s.messageBgColor, s.messageBgOpacity) : 'transparent';
  // Koyu zemin isteyen görünümler, ileti zemini kapalıyken de okunur kalsın
  const koyuBg = seffafIleti ? 'transparent' : s.messageBgOpacity > 0 ? msgBg : '#000000b3';
  // Görünümün kendi zemini (şeffaf ayarı açıkken çizilmez)
  const zemin = (v: string) => (seffafIleti ? 'transparent' : v);
  // Dar/süslü yazı tipleri aynı puntoda çok küçük görünüyordu: görünür boyut dengelenir
  const kurulu = String(s.customFont || '').trim();
  const boy = Math.round((Number(s.fontSize) || 22) * (kurulu ? 1 : yaziOlcegi(s.fontFamily)));

  const metinStili: CSSProperties = {
    fontSize: boy,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textTransform: s.uppercase ? 'uppercase' : undefined,
    color: s.textColor,
    textAlign: s.align as CSSProperties['textAlign'],
    WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined,
    margin: 0,
    minWidth: 0
  };
  const yaslama = s.align === 'center' ? 'center' : s.align === 'right' ? 'flex-end' : 'flex-start';
  const sira: CSSProperties = { display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, verticalAlign: 'middle', maxWidth: '100%' };

  const ileti = (msg: OverlayMsg) => {
    const pr = PLATFORM_COLORS[msg.platform] || s.highlightColor;
    // Vurgu: "platform renkleri" açıksa platformun özgün rengi
    const vurgu = s.platformColors && PLATFORM_COLORS[msg.platform] ? pr : s.highlightColor;
    // Satır başı çizgileri tek ayarla kapanır
    const cizgi = (v: string) => (s.satirCizgisi === false ? undefined : v);
    const vurguKenar = s.highlightSpecial && msg.special ? cizgi(`3px solid ${vurgu}`) : undefined;
    const avatarOge = (boyut: number) =>
      s.showAvatars && msg.platform !== 'olay' ? (
        <SohbetAvatari
          platform={msg.platform}
          kullanici={msg.kullanici}
          ad={msg.user}
          url={msg.avatar}
          boyut={boyut}
          bicim={s.avatarShape}
          yedekHarf={Boolean(s.avatarFallback)}
          renk={msg.color}
        />
      ) : null;
    const avatarBoyu = Number(s.avatarSize) || Math.round(boy * 1.1);
    const satirBoyu = boy * (Number(s.lineHeight) || 1.35);
    // Yandaki avatar ilk satırla ortalanır; resim yoksa yuva da yer kaplamaz (.axt-avatar-yuva:empty)
    const avatar = s.showAvatars && msg.platform !== 'olay' ? (
      <span className="axt-avatar-yuva" style={{ display: 'inline-flex', flexShrink: 0, marginTop: Math.max(0, Math.round((satirBoyu - avatarBoyu) / 2)) }}>{avatarOge(avatarBoyu)}</span>
    ) : null;
    // Ad satırının içindeki avatar (başlık çubuğu, sekme, bant): satır boyunu aşmaz
    const kucukAvatar = avatarOge(Math.min(avatarBoyu, Math.round(boy * 0.95)));
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
    const icerik = <ChatMessageContent message={msg.text} size={Math.round(boy * (Number(s.emoteScale) || 1.3)) || 24} twitchEmotes={msg.emotes} dondur={s.emoteDondur} />;
    const ad = (renk: string = msg.color) => (s.hideUsernames ? null : <BoyaliAd msg={msg} acik={s.yediTvBoyalari} style={{ color: renk, fontWeight: 800 }}>{msg.user}</BoyaliAd>);
    const kutu: CSSProperties = { whiteSpace: yanYana ? 'nowrap' : undefined, textShadow: s.textShadow ? '0 2px 8px #000' : undefined };
    // Ad satırı + ileti (kart, neon ve şerit görünümlerinde ortak)
    const satir = (oncesi: ReactNode, renk?: string) => (
      <p style={{ ...metinStili, ...(renk ? { color: renk } : null), marginTop: avatar ? Math.max(0, Math.round((avatarBoyu - satirBoyu) / 2)) : 0 }}>
        <span style={{ ...sira, marginRight: 6, display: s.nameOnOwnLine ? 'flex' : sira.display }}>{oncesi}{ad()}</span>
        {icerik}
      </p>
    );

    // Yapısal temalar (lib/kabuklar.ts): biçim ve süs kutudan gelir, satır düzeni ortak
    if (yapisalKabukMu(stil)) {
      const k = kartTasarimlari({ bgColor: s.messageBgColor, bgOpacity: Math.max(Number(s.messageBgOpacity) || 0, 0.85), accentColor: s.highlightColor })[stil];
      return (
        <div data-axt-kabuk={seffafIleti ? undefined : stil} style={{ ...kutu, ...(seffafIleti ? {} : k), display: 'flex', alignItems: 'flex-start', gap: 8, padding: stil === 'perde' ? undefined : stil === 'ampul' ? '22px 24px' : stil === 'defter' ? '22px 16px 10px' : '8px 12px', textShadow: k.color ? 'none' : kutu.textShadow }}>
          {avatar}
          {/* Açık zeminli temaların (defter, manga) yazısı temadan gelir: beyaz yazı okunmuyordu */}
          {satir(<>{logo()}{rozetler}</>, seffafIleti ? undefined : (k.color as string | undefined))}
        </div>
      );
    }

    switch (stil) {
      // Kart: platformun renginde şerit ve hafif tonlu zemin
      case 'platformkart':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-start', gap: 8, background: zemin(`linear-gradient(90deg, ${saydam(pr, 0.25)}, ${koyuBg})`), borderLeft: cizgi(`4px solid ${pr}`), borderRadius: s.borderRadius, padding: '6px 10px' }}>
            {avatar}
            {satir(<>{logo()}{rozetler}</>)}
          </div>
        );
      // Başlıklı: üstte ad satırı, altında ileti balonu
      case 'baslikli':
        return (
          <div style={{ ...kutu, display: 'flex', flexDirection: 'column', gap: 3, alignItems: yaslama }}>
            <div style={{ ...sira, display: 'flex', fontSize: Math.round(boy * 0.8) }}>{kucukAvatar}{logo()}{rozetler}{ad()}{zaman}</div>
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
              <div style={{ ...sira, display: 'flex', fontSize: Math.round(boy * 0.75), marginBottom: 2 }}>{avatar ? logo() : null}{rozetler}{ad()}{zaman}</div>
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
            <div style={{ padding: '6px 10px', minWidth: 0 }}>{satir(<>{kucukAvatar}{rozetler}</>)}</div>
          </div>
        );
      // Neon: platformun (ya da vurgunun) renginde parlayan çerçeve
      case 'neon':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-start', gap: 8, background: seffafIleti ? 'transparent' : s.messageBgOpacity > 0 ? msgBg : '#05010dcc', border: `2px solid ${vurgu}`, boxShadow: `0 0 10px ${saydam(vurgu, 0.8)}, inset 0 0 8px ${saydam(vurgu, 0.35)}`, borderRadius: s.borderRadius, padding: '6px 10px' }}>
            {avatar}
            {satir(<>{logo()}{rozetler}</>)}
          </div>
        );
      // Eski pencere: başlık çubuğunda ad, gri kabartmalı kutuda ileti
      case 'pencere':
        return (
          <div style={{ ...kutu, background: zemin('#c0c0c0'), ...(seffafIleti ? {} : { border: '2px solid', borderColor: '#ffffff #404040 #404040 #ffffff', boxShadow: '1px 1px 0 #000' }) }}>
            <div style={{ ...sira, display: 'flex', background: zemin('linear-gradient(90deg,#000080,#1084d0)'), color: '#fff', padding: '1px 6px', fontSize: Math.round(boy * 0.75), fontWeight: 700 }}>{kucukAvatar}{logo('#ffffff')}{rozetler}{ad('#ffffff')}{zaman}</div>
            <p style={{ ...metinStili, color: seffafIleti ? s.textColor : '#000000', padding: '4px 8px' }}>{icerik}</p>
          </div>
        );
      // Sıvı cam: çok saydam kapsül, üst kenarda ışık
      case 'sivicam':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-start', gap: 8, background: zemin('rgba(255,255,255,.1)'), border: seffafIleti ? undefined : '1px solid rgba(255,255,255,.28)', boxShadow: seffafIleti ? undefined : 'inset 0 1px 0 rgba(255,255,255,.45), 0 8px 22px rgba(0,0,0,.3)', backdropFilter: seffafIleti ? undefined : 'blur(14px) saturate(160%)', borderRadius: 20, padding: '8px 14px' }}>
            {avatar}
            {satir(<>{logo()}{rozetler}</>)}
          </div>
        );
      // Terminal: yeşil yazı, komut satırı gibi
      case 'terminal':
        return (
          <div style={{ ...kutu, background: zemin('#020b05e6'), borderLeft: cizgi('2px solid #22c55e'), padding: '4px 10px', fontFamily: '"Fira Code", "Source Code Pro", monospace' }}>
            <p style={{ ...metinStili, color: '#86efac', fontSize: Math.round(boy * 0.9) }}>
              <span style={{ color: '#22c55e' }}>{'> '}</span>
              {kucukAvatar && <span className="axt-avatar-yuva" style={{ ...sira, marginRight: 6 }}>{kucukAvatar}</span>}
              {s.hideUsernames ? null : <span style={{ color: '#4ade80', fontWeight: 700 }}>{msg.user}: </span>}
              {icerik}
            </p>
          </div>
        );
      // Yapışkan not: sarı kağıt, koyu yazı
      case 'yapiskan':
        return (
          <div style={{ ...kutu, background: zemin('linear-gradient(180deg,#fde68a,#fcd34d)'), boxShadow: seffafIleti ? undefined : '2px 5px 12px rgba(0,0,0,.4)', padding: '8px 12px', textShadow: 'none' }}>
            <div style={{ ...sira, display: 'flex', fontSize: Math.round(boy * 0.75), marginBottom: 2 }}>{kucukAvatar}{logo('#3f2d06')}{rozetler}{ad('#92400e')}{zaman}</div>
            <p style={{ ...metinStili, color: seffafIleti ? s.textColor : '#3f2d06' }}>{icerik}</p>
          </div>
        );
      // Oyun diyaloğu: çift çerçeve, ad sekmesi üstte
      case 'rpg':
        return (
          <div style={{ ...kutu, position: 'relative', marginTop: 12, background: zemin('#0f1535f0'), border: '3px double #e2e8f0', borderRadius: 6, padding: '14px 12px 8px' }}>
            <span style={{ ...sira, position: 'absolute', top: -12, left: 10, background: '#312e81', border: '2px solid #e2e8f0', borderRadius: 4, padding: '0 8px', fontSize: Math.round(boy * 0.75) }}>{kucukAvatar}{logo('#ffffff')}{rozetler}{ad('#fde68a')}</span>
            <p style={metinStili}>{icerik}</p>
          </div>
        );
      // Çizgi roman: kalın kontur, düz gölge
      case 'cizgiroman':
        return (
          <div style={{ ...kutu, background: zemin('#ffffff'), border: seffafIleti ? undefined : '3px solid #111', boxShadow: seffafIleti ? undefined : '5px 5px 0 #111', borderRadius: 14, padding: '6px 12px', textShadow: 'none' }}>
            <p style={{ ...metinStili, color: seffafIleti ? s.textColor : '#111111' }}>
              <span style={{ ...sira, marginRight: 6, display: s.nameOnOwnLine ? 'flex' : sira.display }}>{kucukAvatar}{logo()}{rozetler}{ad()}</span>
              {icerik}
            </p>
          </div>
        );
      // Yayın bandı: ad bloğu ve ileti bloğu yan yana
      case 'yayinbandi':
        return (
          <div style={{ ...kutu, display: 'flex', flexWrap: yanYana ? undefined : 'wrap', alignItems: 'stretch', transform: 'skewX(-6deg)' }}>
            <span style={{ ...sira, background: vurgu, color: PLATFORM_YAZI[msg.platform] || '#ffffff', padding: '4px 10px', fontSize: Math.round(boy * 0.8), flexShrink: 0, textShadow: 'none' }}>{kucukAvatar && <span className="axt-avatar-yuva" style={{ display: 'inline-flex', transform: 'skewX(6deg)' }}>{kucukAvatar}</span>}{logo('currentColor')}{rozetler}{ad('inherit')}</span>
            <div style={{ background: koyuBg, padding: '4px 12px', minWidth: 0 }}><p style={metinStili}>{icerik}</p></div>
          </div>
        );
      // Renk geçişi: kullanıcının renginden zemine
      case 'gecis':
        return (
          <div style={{ ...kutu, display: 'flex', alignItems: 'flex-start', gap: 8, background: zemin(`linear-gradient(100deg, ${saydam(msg.color, 0.45)}, ${saydam(msg.color, 0.05)})`), borderRadius: s.borderRadius, padding: '6px 12px' }}>
            {avatar}
            {satir(<>{logo()}{rozetler}</>)}
          </div>
        );
      // Alt çizgi: zeminsiz, ad renginde ince çizgi
      case 'altcizgi':
        return (
          <div style={{ ...kutu, borderBottom: `2px solid ${saydam(msg.color, 0.7)}`, paddingBottom: 3 }}>
            {satir(<>{kucukAvatar}{logo()}{rozetler}</>)}
          </div>
        );
      // Kompakt: zeminsiz, küçük öğeler
      case 'kompakt':
        return (
          <div style={kutu}>
            <p style={{ ...metinStili, fontSize: Math.round(boy * 0.85) }}>
              <span style={{ ...sira, gap: 4, marginRight: 5 }}>{kucukAvatar}{logo()}{ad()}:</span>
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
            {avatar}
            <p style={{ ...metinStili, marginTop: avatar ? Math.max(0, Math.round((avatarBoyu - satirBoyu) / 2)) : 0 }}>
              {(logo() || zaman || rozetler) && <span style={{ ...sira, marginRight: 6 }}>{logo()}{zaman}{rozetler}</span>}
              {s.hideUsernames ? null : <span style={{ fontWeight: 800, display: s.nameOnOwnLine ? 'block' : undefined }}><BoyaliAd msg={msg} acik={s.yediTvBoyalari} style={{ color: msg.color }}>{msg.user}</BoyaliAd>{s.nameOnOwnLine ? '' : ': '}</span>}
              {icerik}
            </p>
          </div>
        );
    }
  };

  return (
    <div key={hareketAnahtari(s)} {...kokOzellik(s)} className="flex gap-1 p-4 h-full" style={{
      ...ortakHareket(s, { giris: false }),
      fontFamily: kurulu ? yaziAilesi(kurulu) : s.fontFamily,
      // Kalınlık uydurulmaz: yazı tipinde olmayan kalınlığı tarayıcı kendisi çizince harfler dağılıyordu
      fontSynthesis: 'none',
      gap: s.gap,
      // Alt alta: yeni mesaj altta ise kutunun dibine, üstte ise tepesine dayanır.
      // Yan yana: tek satır, en yeni sağda; eskiler soldan taşar.
      flexDirection: yanYana ? 'row' : 'column',
      justifyContent: yanYana ? 'flex-end' : s.reverse ? 'flex-start' : 'flex-end',
      alignItems: yanYana ? 'center' : undefined,
      overflow: 'hidden',
      background: s.transparentBg || s.arkaPlanKapali ? 'transparent' : '#0a0a0a',
      maskImage: s.smoothMask
        ? `linear-gradient(to ${yanYana ? 'right' : s.reverse ? 'top' : 'bottom'}, transparent 0%, black 18%)`
        : undefined
    }}>
      {list.map((msg) => (
        <div key={`${msg.id}-${girisId}-${girisMs}`} data-sohbet-satir="" className={gidenIdler.has(msg.id) ? `axt-cikis-${cikisId}` : `axt-anim-${girisId}`} style={{ flexShrink: 0, animationDuration: `${gidenIdler.has(msg.id) ? cikisMs : girisMs}ms` }}>
          {msg.vurguBitis ? <div style={{ outline: `3px solid ${s.highlightColor}`, outlineOffset: 2, borderRadius: s.borderRadius, boxShadow: `0 0 18px ${s.highlightColor}` }}>{ileti(msg)}</div> : ileti(msg)}
        </div>
      ))}
    </div>
  );
}

export default ChatBoxWidget;
