/** Platformlar sayfası: platform bağlantı durumu, OAuth ve kanal ayarları */
import { useState, useEffect } from 'react';
import { openLink } from '../lib/openLink.js';
import { ChannelConfig } from '../types.js';
import { wsAdresi } from '../lib/widget-style.js';
import { KickVerificationResult } from './Platforms';

export type UsePlatformBaglantilariGirdisi = {
  focusPlatform: string | null | undefined;
};

export function usePlatformBaglantilari({ focusPlatform }: UsePlatformBaglantilariGirdisi) {
  const [channels, setChannels] = useState<Record<string, ChannelConfig>>({});
  const [loading, setLoading] = useState(false);
  const [savedPlatform, setSavedPlatform] = useState<string | null>(null);

  // Kick specific wizard state
  const [canliKick, setCanliKick] = useState<{ botHesabi?: string; kanalHesabi?: string } | null>(null);
  const [kickMethod, setKickMethod] = useState<'quick' | 'oauth' | 'token'>('quick');
  const [kickChannelInput, setKickChannelInput] = useState('');
  const [kickTokenInput, setKickTokenInput] = useState('');
  const [kickClientIdInput, setKickClientIdInput] = useState('');
  const [kickClientSecretInput, setKickClientSecretInput] = useState('');
  const [kickConnecting, setKickConnecting] = useState(false);
  const [kickResult, setKickResult] = useState<KickVerificationResult | null>(null);
  const [kickFeedback, setKickFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Kick test message
  const [kickTestSending, setKickTestSending] = useState(false);
  const [kickTestFeedback, setKickTestFeedback] = useState<string | null>(null);

  // Kick incognito link copy state
  const [copiedLink, setCopiedLink] = useState(false);
  const [oauthUrlForCopy, setOauthUrlForCopy] = useState<string | null>(null);

  useEffect(() => {
    if (!focusPlatform) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`platform-${focusPlatform}`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => clearTimeout(timer);
  }, [focusPlatform]);

  useEffect(() => {
    loadPlatforms();

    // Listen for Kick OAuth popup message
    // Sunucu artık ham token GÖNDERMİYOR (güvenlik): başarıda token zaten
    // kaydedilmiştir, maskeli değer platform listesinden okunur. Yalnız
    // değişim başarısızsa eski elle bağlama için yetki kodu gelir.
    const kickYetkiSonucu = (veri: any) => {
      if (veri?.ok) {
        setKickFeedback({
          type: 'success',
          text: 'Kick yetkilendirmesi başarılı — token kaydedildi ve bağlanıldı. Bot artık sohbete yazabilir.'
        });
      } else if (veri?.code) {
        setKickTokenInput(String(veri.code));
        setKickFeedback({
          type: 'success',
          text: 'Kick OAuth kodu alındı! "Kick API Bağla ve Aktifleştir" butonuna tıklayarak işlemi tamamlayabilirsiniz.'
        });
      } else {
        return;
      }
      setTimeout(() => setKickFeedback(null), 7000);
      loadPlatforms();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'KICK_AUTH_SUCCESS') kickYetkiSonucu(event.data);
    };
    window.addEventListener('message', handleMessage);

    // Also connect to WebSocket to receive OAuth events from incognito/private windows
    let ws: WebSocket | null = null;
    try {
      // Eskiden 3001'e sabitti: sunucu başka portta çalışınca gizli pencereden
      // yapılan Kick yetkilendirmesi panele hiç ulaşmıyordu
      const wsUrl = wsAdresi('dashboard');
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'kick_auth_success') kickYetkiSonucu(payload);
        } catch {}
      };
    } catch {}

    return () => {
      window.removeEventListener('message', handleMessage);
      if (ws) {
        try { ws.close(); } catch {}
      }
    };
  }, []);

  const loadPlatforms = () => {
    fetch('/api/platforms')
      .then(r => r.json())
      .then(d => {
        const map: Record<string, ChannelConfig> = {};
        for (const ch of d.channels || []) {
          map[ch.platform] = ch;
        }
        setChannels(map);
        setCanliKick(d.liveStatuses?.kick || null);

        // Pre-fill Kick state if exists
        if (map['kick']) {
          setKickChannelInput(map['kick'].channel_name || '');
          setKickTokenInput(map['kick'].token || '');
          // Trigger verify check
          if (map['kick'].channel_name) {
            verifyKickChannel(map['kick'].channel_name, map['kick'].token);
          }
        }
      })
      .catch(() => {});
  };

  const verifyKickChannel = async (channel: string, token?: string) => {
    try {
      const res = await fetch('/api/platforms/kick/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelSlug: channel, token })
      });
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        setKickResult(data);
      } catch {}
    } catch {}
  };

  // Trovo'nun her ucu Client-ID ister (sohbeti OKUMAK dahil). Kanal
  // tablosunda yeri yok; bot_settings'e `trovo_client_id` olarak yazılır.
  const [trovoClientId, setTrovoClientId] = useState('');
  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => setTrovoClientId(String(d?.trovo_client_id || '')))
      .catch(() => {});
  }, []);

  const handleChange = (platform: string, field: string, value: any) => {
    setChannels(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform],
        id: prev[platform]?.id || '',
        platform: platform as any,
        [field]: value
      }
    }));
  };

  const handleSave = async (platform: string) => {
    const config = channels[platform];
    if (!config || !config.channel_name) {
      alert('Lütfen kanal/kullanıcı adı girin!');
      return;
    }

    if (platform === 'trovo' && !trovoClientId.trim()) {
      alert('Trovo için Client-ID gerekli (developer.trovo.live → uygulamanız).');
      return;
    }

    setLoading(true);
    try {
      if (platform === 'trovo') {
        // Bağlanmadan ÖNCE yazılmalı: adaptör connect() içinde okuyor
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trovo_client_id: trovoClientId.trim() })
        });
      }
      const res = await fetch('/api/platforms/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          channelName: config.channel_name,
          accountId: config.account_id,
          token: config.token,
          refreshToken: config.refresh_token,
          isActive: config.is_active !== 0
        })
      });
      if (res.ok) {
        setSavedPlatform(platform);
        setTimeout(() => setSavedPlatform(null), 3000);
        if (platform === 'kick') {
          verifyKickChannel(config.channel_name, config.token);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Complete Kick API Connect Handler (Used by the Kick Wizard)
   */
  const handleKickConnect = async () => {
    if (!kickChannelInput.trim()) {
      setKickFeedback({ type: 'error', text: 'Lütfen Kick kanal adınızı girin!' });
      return;
    }

    setKickConnecting(true);
    setKickFeedback(null);

    try {
      const res = await fetch('/api/platforms/kick/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName: kickChannelInput.trim(),
          token: kickTokenInput.trim(),
          clientId: kickClientIdInput.trim(),
          clientSecret: kickClientSecretInput.trim()
        })
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          res.status === 404
            ? 'API uç noktası bulunamadı. Lütfen çalışan eski AxBoT pencerelerini kapatıp AxthrowA Studio ile yeniden başlatın.'
            : `Sunucu geçersiz yanıt verdi (HTTP ${res.status}).`
        );
      }

      if (data.success) {
        setKickFeedback({ type: 'success', text: data.message });
        setKickResult(data.verification);
        loadPlatforms();
      } else {
        setKickFeedback({ type: 'error', text: data.error || 'Kick API bağlantısı başarısız oldu.' });
      }
    } catch (err: any) {
      setKickFeedback({ type: 'error', text: err.message || 'Bağlantı hatası oluştu' });
    } finally {
      setKickConnecting(false);
      setTimeout(() => {
        if (kickFeedback?.type === 'success') setKickFeedback(null);
      }, 8000);
    }
  };

  const handleKickTestMessage = async () => {
    const hasToken = (kickTokenInput || '').trim() || (channels.kick?.token || '').trim();
    if (!hasToken) {
      setKickTestFeedback('ℹ️ Kanalınız canlı dinleme modunda bağlı! İzleyici sohbeti, takipçi, abone ve şarkı istekleri aktif çalışmaktadır. Botun chate kendisinin mesaj yazabilmesi için lütfen yukarıdaki "Developer OAuth" veya "Manuel Bot Tokeni" sekmesinden bir token girin.');
      setTimeout(() => setKickTestFeedback(null), 9000);
      return;
    }

    setKickTestSending(true);
    setKickTestFeedback(null);
    try {
      const res = await fetch('/api/platforms/kick/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '🟢 [AxBoT] Kick API ve sohbet bağlantısı başarıyla doğrulandı! Bot aktif.'
        })
      });
      const data = await res.json();
      setKickTestFeedback(data.message || (data.success ? 'Mesaj gönderildi!' : 'Mesaj gönderilemedi.'));
    } catch (err: any) {
      setKickTestFeedback('Test hatası: ' + err.message);
    } finally {
      setKickTestSending(false);
      setTimeout(() => setKickTestFeedback(null), 8000);
    }
  };

  const handleKickOAuth = async () => {
    if (!kickClientIdInput.trim()) {
      setKickFeedback({
        type: 'error',
        text: 'Lütfen önce Kick App Client ID alanını doldurun! Boş veya geçersiz Client ID girildiğinde Kick 404 hatası verir. (kick.com/settings/developer adresinden alabilirsiniz)'
      });
      setTimeout(() => setKickFeedback(null), 9000);
      return;
    }
    try {
      const clientId = kickClientIdInput.trim();
      const res = await fetch(`/api/platforms/kick/auth-url?clientId=${encodeURIComponent(clientId)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setKickFeedback({ type: 'error', text: data.error || 'Kick OAuth URL alınamadı.' });
        return;
      }
      if (data.authUrl) {
        await izinSayfasiniAc(data.authUrl, true);
      }
    } catch (err: any) {
      setKickFeedback({ type: 'error', text: 'OAuth hatası: ' + err.message });
    }
  };

  /** Bot girişi gizli pencerede: tarayıcıda açık yayıncı hesabı karışmasın. Yüklü tarayıcı bulunamazsa normal pencere. */
  const izinSayfasiniAc = async (authUrl: string, gizli: boolean) => {
    const r = gizli
      ? await fetch('/api/platforms/kick/gizli-ac', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: authUrl })
        }).then((y) => y.json()).catch(() => null)
      : null;
    if (!r?.acildi) {
      openLink(authUrl, 'width=600,height=720');
      return;
    }
    setKickFeedback({ type: 'success', text: 'Giriş sayfası gizli pencerede açıldı. Bot hesabınla giriş yap; bitince burası kendiliğinden güncellenir.' });
    // Gizli pencere ayrı süreç, panele mesaj gönderemez: bağlantı 2 dk yoklanır
    let kalan = 40;
    const t = setInterval(() => {
      loadPlatforms();
      if (--kalan <= 0) clearInterval(t);
    }, 3000);
  };

  /** Kick'in izin sayfasını açar; Client ID sunucuda kayıtlı değilse alandaki kullanılır. */
  const kickGirisi = async (hedef: 'bot' | 'kanal') => {
    const clientId = kickClientIdInput.trim();
    const res = await fetch(`/api/platforms/kick/auth-url?hedef=${hedef}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok || !data.authUrl) {
      setKickMethod('oauth');
      setKickFeedback({ type: 'error', text: data.error || 'Kick giriş adresi alınamadı.' });
      return;
    }
    await izinSayfasiniAc(data.authUrl, hedef === 'bot');
  };

  const handleCopyOAuthLink = async () => {
    if (!kickClientIdInput.trim()) {
      setKickFeedback({
        type: 'error',
        text: 'Lütfen önce Kick App Client ID alanını doldurun! (kick.com/settings/developer adresinden alabilirsiniz)'
      });
      setTimeout(() => setKickFeedback(null), 9000);
      return;
    }
    try {
      const clientId = kickClientIdInput.trim();
      const res = await fetch(`/api/platforms/kick/auth-url?clientId=${encodeURIComponent(clientId)}`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || data.error) {
        setKickFeedback({ type: 'error', text: data.error || 'Kick OAuth URL alınamadı.' });
        return;
      }
      if (data.authUrl) {
        await navigator.clipboard.writeText(data.authUrl);
        setOauthUrlForCopy(data.authUrl);
        setCopiedLink(true);
        setKickFeedback({
          type: 'success',
          text: 'Kick Giriş Linki Panoya Kopyalandı! Şimdi Gizli Sekmede (Ctrl+Shift+N) açarak Bot hesabınızla giriş yapabilirsiniz.'
        });
        setTimeout(() => setCopiedLink(false), 8000);
      }
    } catch (err: any) {
      setKickFeedback({ type: 'error', text: 'Link kopyalama hatası: ' + err.message });
    }
  };

  const otherPlatforms = [
    {
      key: 'twitch',
      name: 'Twitch.tv',
      badgeColor: 'bg-[#9146ff] text-white',
      description: 'Twitch EventSub ve IRC sohbeti, Bits, Abone ve Raids.',
      nameLabel: 'Kanal Adı (Örn: yayinci)',
      tokenLabel: 'OAuth Token (Örn: oauth:xxxxxxx - Boş bırakılırsa anonim okuma)',
      helpText: 'Bot hesabınızın OAuth anahtarını TwitchTokenGenerator ile alabilirsiniz.'
    },
    {
      key: 'youtube',
      name: 'YouTube Canlı',
      badgeColor: 'bg-[#ff0000] text-white',
      description: 'YouTube canlı yayın sohbeti ve SuperChat bildirimleri.',
      nameLabel: 'Canlı Yayın Video ID veya LiveChat ID',
      tokenLabel: 'Google Cloud YouTube API Anahtarı',
      helpText: 'Canlı yayınınızın linkindeki "v=xxxx" kodunu kanal adı alanına yazın.'
    },
    {
      key: 'discord',
      name: 'Discord Bot',
      badgeColor: 'bg-[#5865f2] text-white',
      description: 'Yayın sohbeti ile Discord kanalı arasında çift yönlü köprü.',
      nameLabel: 'Hedef Metin Kanalı ID (Örn: 112233445566)',
      tokenLabel: 'Discord Bot Token (Discord Developer Portal)',
      helpText: 'Discord botunuz sohbetteki mesajları yayın chatine, yayındaki mesajları Discorda aktarır.'
    },
    {
      key: 'tiktok',
      name: 'TikTok Live',
      badgeColor: 'bg-[#00f2fe] text-black font-black',
      description: 'TikTok canlı yayın hediyeleri (Gifts), elmaslar ve canlı sohbet.',
      nameLabel: 'TikTok Kullanıcı Adı (@ olmadan, örn: yayinci)',
      tokenLabel: 'Şifre/Token gerekmez (Açık canlı yayın bağlantısı)',
      helpText: 'TikTok canlı yayınınız başladığında bot otomatik bağlanır ve hediyeleri ekrana basar.'
    },
    {
      key: 'trovo',
      name: 'Trovo',
      badgeColor: 'bg-[#19d66c] text-black font-black',
      description: 'Trovo sohbeti, takip, abone, hediye abone, spell ve raid olayları.',
      nameLabel: 'Trovo Kullanıcı Adı (kanal linkinin son kısmı, örn: leafinsummer)',
      tokenLabel: 'OAuth Erişim Jetonu — YALNIZ mesaj göndermek için gerekir',
      helpText:
        'Sohbeti OKUMAK için yalnız Client-ID yeterli, jeton gerekmez. Mesaj GÖNDERMEK için chat_send_self izinli bir OAuth jetonu gerekir.'
    }
  ];
  return { canliKick, channels, copiedLink, handleChange, handleCopyOAuthLink, handleKickConnect, handleKickOAuth, handleKickTestMessage, handleSave, kickChannelInput, kickClientIdInput, kickClientSecretInput, kickConnecting, kickFeedback, kickGirisi, kickMethod, kickResult, kickTestFeedback, kickTestSending, kickTokenInput, loading, oauthUrlForCopy, otherPlatforms, savedPlatform, setCopiedLink, setKickChannelInput, setKickClientIdInput, setKickClientSecretInput, setKickMethod, setKickTokenInput, setTrovoClientId, trovoClientId };
}
