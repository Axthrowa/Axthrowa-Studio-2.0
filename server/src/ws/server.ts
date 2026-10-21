import { WebSocketServer, WebSocket } from 'ws';
import { izinliHostMu, kokenKabulEdilir } from '../core/security/origin-guard.js';
import { arayuzAdresleri, ekIzinliHostlar } from '../core/security/host-list.js';
import { Server as HttpServer } from 'http';
import { hediyeAdedi, eventBus, ChatMessagePayload, FollowPayload, SubPayload, TipPayload, RaidPayload, TikTokGiftPayload, BotMessagePayload } from '../core/event-bus.js';
import { db } from '../db/index.js';
import { ttsEngine, TTSItem } from '../modules/tts/tts.js';
import { songRequest } from '../modules/songrequest/songrequest.js';
import { platformManager } from '../platforms/manager.js';
import { economy } from '../modules/economy/economy.js';
import { varyantlar } from '../modules/alerts/variants.js';
import { hataMetni, seyrekUyar } from '../core/logger.js';
import { shieldModeService } from '../modules/moderation/shield-mode.js';
import { BASLANGIC, kontrolUygula, KontrolDurumu, SonUyari, SonUyarilar, uyariKimligi } from '../modules/alerts/control.js';
import { kupa } from '../modules/engagement/kupa.js';

interface ClientConnection {
  ws: WebSocket;
  type: 'dashboard' | 'alertbox' | 'chatbox' | 'goals' | 'wheel' | 'audio' | 'pano' | 'sesli' | 'all';
}

/**
 * Köken + Host doğrulaması (Cross-Site WebSocket Hijacking). Tarayıcılar el
 * sıkışmasında Origin'i her zaman gönderir; tarayıcı dışı istemciler (Origin
 * yok) etkilenmez.
 */
export function kokenDogrula(info: { origin?: string; req: { headers: Record<string, any> } }): boolean {
  const host = info.req.headers.host as string | undefined;
  const tamam = izinliHostMu(host, arayuzAdresleri(), ekIzinliHostlar()) && kokenKabulEdilir(info.origin, host);
  if (!tamam) console.warn(`[Guvenlik] WebSocket reddedildi: origin=${info.origin} host=${host}`);
  return tamam;
}

export class WebSocketHub {
  private wss: WebSocketServer | null = null;
  private clients: Set<ClientConnection> = new Set();
  /** Ekip çapında uyarı kuyruğu denetimi (modules/alerts/control.ts) */
  private uyariKontrol: KontrolDurumu = { ...BASLANGIC };
  private sonUyarilar = new SonUyarilar(50);

  uyariKontrolDurumu(): { state: KontrolDurumu; recent: Omit<SonUyari, 'alert'>[] } {
    return {
      state: this.uyariKontrol,
      recent: this.sonUyarilar.hepsi().map(({ alert: _a, ...geri }) => geri)
    };
  }

  /**
   * Denetim eylemini uygular ve tüm uyarı widget'larına / panellere yayınlar.
   * `replay`: son uyarılardan birini YENİ kimlikle yeniden oynatır (hedef, hype treni gibi sayaçlara işlemez).
   */
  uyariKontrolEt(eylem: string, kim: string, surum?: number | null, alertId?: string) {
    let tekrar: SonUyari | undefined;
    if (eylem === 'replay') {
      tekrar = alertId ? this.sonUyarilar.bul(String(alertId)) : undefined;
      if (!tekrar) return { ok: false as const, kod: 'invalid' as const, mesaj: 'Yeniden oynatılacak uyarı bulunamadı', durum: this.uyariKontrol };
    }
    const sonuc = kontrolUygula(this.uyariKontrol, eylem, kim, surum);
    if (!sonuc.ok) return sonuc;
    this.uyariKontrol = sonuc.durum;
    this.broadcastTo(['dashboard', 'alertbox', 'all'], {
      type: 'alert_control',
      action: eylem,
      state: this.uyariKontrol,
      ...(alertId ? { alertId: String(alertId) } : {})
    });
    if (tekrar) {
      this.broadcastTo(['dashboard', 'alertbox', 'all'], {
        type: 'alert',
        subType: tekrar.eventType,
        replay: true,
        alert: { ...tekrar.alert, id: uyariKimligi(`replay${tekrar.eventType}`), isReplay: true }
      });
    }
    return sonuc;
  }

  /** /ws dışındaki WebSocket yolları (ör. Resonance /ws/overlay-sync) */
  private ekYollar = new Map<string, WebSocketServer>();

  /** Ek bir yol için WebSocket sunucusu (köken doğrulaması aynı). */
  ekYol(yol: string): WebSocketServer {
    const mevcut = this.ekYollar.get(yol);
    if (mevcut) return mevcut;
    const w = new WebSocketServer({ noServer: true, verifyClient: kokenDogrula });
    w.on('error', () => {});
    this.ekYollar.set(yol, w);
    return w;
  }

  init(server: HttpServer) {
    // Köken + Host doğrulaması (Cross-Site WebSocket Hijacking). Eskiden YOKTU:
    // herhangi bir web sitesi bağlanıp bota sohbet mesajı yazdırabiliyor,
    // TTS okutabiliyor, canlı sohbeti dinleyebiliyordu. Tarayıcılar WebSocket
    // el sıkışmasında Origin'i her zaman gönderir; tarayıcı dışı istemciler
    // (Origin yok) etkilenmez.
    this.wss = new WebSocketServer({ noServer: true, verifyClient: kokenDogrula });

    // Yükseltme istekleri yola göre dağıtılır. `ws` aynı HTTP sunucusuna
    // `path` ile bağlanan ikinci bir sunucuyu desteklemiyor: eşleşmeyen yolu
    // 400 ile kesiyor. Resonance'ın /ws/overlay-sync yolu bu yüzden buradan.
    server.on('upgrade', (req, socket, head) => {
      const yol = String(req.url || '').split('?')[0];
      const hedef = yol === '/ws' ? this.wss : this.ekYollar.get(yol);
      if (!hedef) {
        socket.destroy();
        return;
      }
      hedef.handleUpgrade(req, socket, head, (ws) => hedef.emit('connection', ws, req));
    });

    // HTTP sunucusunun hatası (ör. EADDRINUSE) buraya da yansır; dinleyici yoksa
    // Node süreci "Unhandled 'error' event" ile çökertiyordu. Asıl işleme app.ts'te.
    this.wss.on('error', () => {});

    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const type = (url.searchParams.get('type') || 'all') as any;

      const clientConn: ClientConnection = { ws, type };
      this.clients.add(clientConn);

      // Send initial state
      this.sendToClient(clientConn, {
        type: 'init',
        data: {
          platformStatuses: platformManager.getAllStatuses(),
          currentSong: songRequest.getCurrentSong(),
          queue: songRequest.getQueueList()
        }
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          this.handleClientMessage(msg);
        } catch (err) {
          console.error('[WS] Malformed message from client:', err);
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientConn);
      });

      ws.on('error', () => {
        this.clients.delete(clientConn);
      });
    });

    this.setupEventForwarding();
    // Ses panosu: oynatma/durum iletileri pano katmanına ve panele (döngüsel içe aktarma olmasın diye geç yüklenir)
    void import('../modules/pano/pano.js').then((m) => m.sesPanosu.yayinciBagla((p) => this.broadcastTo(['pano', 'dashboard'], p)));
    // Sesli komutlar: sonuç/ayar/model iletileri panele ve dinleyici sayfasına
    void import('../modules/sesli/sesli.js').then((m) => m.sesliKomutlar.yayinciBagla((p) => this.broadcastTo(['sesli', 'dashboard'], p)));
    console.log('[StreamAxT] WebSocket Hub active on /ws');
  }

  private handleClientMessage(msg: any) {
    if (msg.action === 'pano_bitti') {
      // Katman oynatmayı bitirdi (aynı istek için birden çok katman bildirebilir; hizmet yinelemeyi yok sayar)
      void import('../modules/pano/pano.js').then((m) => m.sesPanosu.bitti(String(msg.id || '')));
      return;
    }
    if (msg.action === 'test_alert') {
      this.triggerTestAlert(msg.eventType);
    } else if (msg.action === 'send_chat') {
      const { platform, message } = msg;
      if (platform === 'all') {
        eventBus.emitBotMessage({ platform: 'all', message });
      } else {
        eventBus.emitBotMessage({ platform, message });
      }
    } else if (msg.action === 'trigger_tts') {
      ttsEngine.enqueue(msg.text || 'Test TTS', 'Yayıncı');
    } else if (msg.action === 'clear_chat') {
      this.broadcastTo(['dashboard', 'chatbox', 'all'], {
        type: 'clear_chat'
      });
    }
  }

  private setupEventForwarding() {
    // 1. Chat Event -> Send to Dashboard & ChatBox Overlay
    eventBus.on('chat', (payload: ChatMessagePayload) => {
      // Ortak kara listedeki kullanıcı: panelde işaretli görünür, OBS sohbet
      // widget'ları göstermez. Eskiden liste yalnız botun işleme hattındaydı;
      // mesajlar yayında görünmeye devam ediyordu.
      const karaListede = !!shieldModeService.karaListeKaydi(payload.user?.username, payload.platform);
      // Kalkan kuralına takılan mesaj da OBS'te gösterilmez (panelde işaretli görünür)
      const kalkanda = !karaListede && payload.user ? shieldModeService.ihlal(payload) : null;
      this.broadcastTo(['dashboard', 'chatbox', 'all'], {
        type: 'chat',
        data: karaListede ? { ...payload, karaListede: true } : kalkanda ? { ...payload, kalkanda } : payload
      });
    });

    // 1.0 Moderasyon: silinen ileti / yasaklanan kullanıcı / temizlenen sohbet
    eventBus.on('chat_deleted', (veri: { platform: string; id: string }) => {
      this.broadcastTo(['dashboard', 'chatbox', 'all'], { type: 'chat_deleted', data: veri });
    });
    eventBus.on('chat_user_removed', (veri: { platform: string; username: string }) => {
      this.broadcastTo(['dashboard', 'chatbox', 'all'], { type: 'chat_user_removed', data: veri });
    });
    eventBus.on('chat_cleared', () => {
      this.broadcastTo(['dashboard', 'chatbox', 'all'], { type: 'clear_chat' });
    });

    // 1.1 Bot Message Event -> Forward as Chat Message to Dashboard & ChatBox Overlay
    eventBus.on('bot_message', (payload: BotMessagePayload) => {
      const botPlatform = payload.platform === 'all' ? 'kick' : payload.platform;
      const botMsg: ChatMessagePayload = {
        id: 'bot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        platform: botPlatform as any,
        channel: payload.channel || 'stream',
        user: {
          id: 'streamaxt_bot',
          username: 'StreamAxT_Bot',
          displayName: '🤖 StreamAxT Bot',
          color: '#53fc18',
          badges: ['moderator'],
          isBroadcaster: false,
          isMod: true,
          isSub: false,
          isVip: false
        },
        message: payload.message,
        timestamp: Date.now()
      };
      this.broadcastTo(['dashboard', 'chatbox', 'all'], {
        type: 'chat',
        data: botMsg
      });
    });

    // 1.1 Platform bağlantı durumu değişti (ör. Kick sohbet okuma koptu/geldi)
    eventBus.on('platform_status_changed', () => {
      this.broadcastTo(['dashboard', 'all'], { type: 'platform_statuses', data: platformManager.getAllStatuses() });
    });

    // 1.2 Gönderim hatası -> sohbet akışında kırmızı sistem satırı olarak görünür
    eventBus.on('bot_send_error', ({ platform, reason }: { platform: string; reason: string }) => {
      const errMsg: ChatMessagePayload = {
        id: 'err_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        platform: (platform === 'all' ? 'kick' : platform) as any,
        channel: 'stream',
        user: {
          id: 'streamaxt_system',
          username: 'StreamAxT',
          displayName: '⚠️ Gönderilemedi',
          color: '#f87171',
          badges: [],
          isBroadcaster: false,
          isMod: false,
          isSub: false,
          isVip: false
        },
        message: reason,
        timestamp: Date.now()
      };
      this.broadcastTo(['dashboard', 'all'], { type: 'chat', data: errMsg });
    });

    // 2. Follow Event -> AlertBox & Dashboard & Goals
    eventBus.on('follow', (payload: FollowPayload) => {
      const alertData = this.buildAlertPayload('follow', { user: payload.displayName || payload.username }, (payload as any)?.isTest === true);
      this.broadcastTo(['dashboard', 'alertbox', 'goals', 'all'], {
        type: 'alert',
        subType: 'follow',
        data: payload,
        alert: alertData
      });
    });

    // 3. Sub Event -> AlertBox & Dashboard & Goals & Loyalty Tracking
    eventBus.on('sub', (payload: SubPayload) => {
      // Record in Loyalty Engine
      try {
        economy.recordSub(payload.username, payload.platform, payload.isGift, 1, payload.recipient);
      } catch (e) {
        console.warn('[Ekonomi] Abonelik sadakat kaydına işlenemedi:', hataMetni(e));
      }

      // Hediye abonelik KENDİ türüyle gösterilir: Alert Box'taki "Hediye
      // Abone" ayarı ve varyantları eskiden yalnız test düğmesinde
      // çalışıyordu, gerçek hediyeler düz abone uyarısı olarak çıkıyordu.
      const hediye = !!payload.isGift;
      const tur = hediye ? 'gift_sub' : 'sub';
      const alertData = this.buildAlertPayload(tur, {
        user: payload.displayName || payload.username,
        tier: payload.tier,
        months: payload.months,
        ...(hediye ? { count: hediyeAdedi(payload) } : {})
      }, (payload as any)?.isTest === true);
      this.broadcastTo(['dashboard', 'alertbox', 'goals', 'all'], {
        type: 'alert',
        subType: tur,
        data: payload,
        alert: alertData
      });

      // Bağış Kupası: hediye abonelik adediyle düşer (eskiden düz "sub" sayılıyordu)
      this.kupayaDusur(tur, { user: payload.displayName || payload.username, count: hediye ? hediyeAdedi(payload) : 1 });
    });

    // 4. Tip / SuperChat Event -> AlertBox & Dashboard & Goals & Loyalty Tracking
    eventBus.on('tip', (payload: TipPayload) => {
      // Record in Loyalty Engine
      try {
        economy.recordTip(payload.username, payload.platform, payload.amount);
      } catch (e) {
        console.warn('[Ekonomi] Bağış sadakat kaydına işlenemedi:', hataMetni(e));
      }

      const alertData = this.buildAlertPayload('tip', {
        user: payload.displayName || payload.username,
        amount: payload.amount,
        currency: payload.currency,
        message: payload.message || ''
      }, (payload as any)?.isTest === true);
      this.broadcastTo(['dashboard', 'alertbox', 'goals', 'all'], {
        type: 'alert',
        subType: 'tip',
        data: payload,
        alert: alertData
      });

      // The Cup drop & subathon
      this.kupayaDusur('tip', { user: payload.displayName || payload.username, amount: payload.amount });
      this.sohbetOlayi('bagis', payload.displayName || payload.username, `${payload.amount} ${payload.currency || ''} bağışladı${payload.message ? ': ' + payload.message : ''}`);

      // Also trigger TTS if tip contains message
      if (payload.message) {
        ttsEngine.enqueue(payload.message, payload.displayName || payload.username);
      }
    });

    // 4.5 KICKs — Kick'in kendi para birimi. Veri yolunda karsiligi YOKTU:
    // `alert_presets` tablosunda satiri vardi ama gercek yayinda hic
    // tetiklenmiyordu.
    eventBus.on('kicks', (payload: any) => {
      try {
        // KICKs de bagis sayilir: ekonomi ve hedefler beslensin
        economy.recordTip(payload.username, 'kick', Number(payload.amount) || 0);
      } catch (e) {
        console.warn('[Ekonomi] KICKs sadakat kaydına işlenemedi:', hataMetni(e));
      }

      const alertData = this.buildAlertPayload('kicks', {
        user: payload.displayName || payload.username,
        amount: payload.amount
      }, (payload as any)?.isTest === true);
      this.broadcastTo(['dashboard', 'alertbox', 'goals', 'all'], {
        type: 'alert',
        subType: 'kicks',
        data: payload,
        alert: alertData
      });

      this.kupayaDusur('kicks', { user: payload.displayName || payload.username, amount: payload.amount });
    });

    // 4.6 Host
    eventBus.on('host', (payload: any) => {
      const alertData = this.buildAlertPayload('host', {
        user: payload.displayName || payload.username,
        viewers: payload.viewers
      }, (payload as any)?.isTest === true);
      this.broadcastTo(['dashboard', 'alertbox', 'all'], {
        type: 'alert',
        subType: 'host',
        data: payload,
        alert: alertData
      });
    });

    // 5. Raid Event -> AlertBox & Dashboard
    eventBus.on('raid', (payload: RaidPayload) => {
      const alertData = this.buildAlertPayload('raid', {
        user: payload.displayName || payload.username,
        viewers: payload.viewers
      }, (payload as any)?.isTest === true);
      this.broadcastTo(['dashboard', 'alertbox', 'all'], {
        type: 'alert',
        subType: 'raid',
        data: payload,
        alert: alertData
      });
    });

    // 6. TikTok Gift Event -> AlertBox & Dashboard
    eventBus.on('gift_tiktok', (payload: TikTokGiftPayload) => {
      try {
        economy.recordTip(payload.username, payload.platform, (payload.diamonds || 10) * 0.1);
      } catch (e) {
        console.warn('[Ekonomi] TikTok hediyesi sadakat kaydına işlenemedi:', hataMetni(e));
      }

      const alertData = this.buildAlertPayload('gift_tiktok', {
        user: payload.displayName || payload.username,
        giftName: payload.giftName,
        count: payload.count,
        diamonds: payload.diamonds
      }, (payload as any)?.isTest === true);
      this.broadcastTo(['dashboard', 'alertbox', 'all'], {
        type: 'alert',
        subType: 'gift_tiktok',
        data: payload,
        alert: alertData
      });

      this.kupayaDusur('gift_tiktok', { user: payload.displayName || payload.username, count: payload.count });
    });

    // 7. TTS Queued Event -> OBS Audio Player & Dashboard
    ttsEngine.on('tts_queued', (item: TTSItem) => {
      this.broadcastTo(['dashboard', 'audio', 'all'], {
        type: 'tts',
        data: item
      });
    });

    // 8. Loyalty Reward Redeemed Event -> OBS Overlay & Dashboard
    eventBus.on('loyalty_redeemed', (data: any) => {
      this.broadcastTo(['dashboard', 'alertbox', 'all'], {
        type: 'loyalty_redeemed',
        data
      });
      this.sohbetOlayi('odul', data?.user, `"${data?.rewardTitle || 'ödül'}" ödülünü aldı`);
    });

    // 9. Emote Used Event -> Emote Combo & Floating Emotes Widget
    eventBus.on('emote_used', (data: any) => {
      this.broadcastTo(['all'], {
        type: 'emote_used',
        data
      });
    });

    // 10. Generic Broadcast Forwarder
    eventBus.on('widget_update', (payload: any) => {
      this.broadcastTo(['all'], payload);
    });
  }

  buildAlertPayload(eventType: string, variables: Record<string, any>, isTest: boolean = false) {
    let preset: any = null;
    try {
      preset = db.prepare('SELECT * FROM alert_presets WHERE event_type = ?').get(eventType) as any;
    } catch (e) {
      console.warn('[AlertBox] Error querying alert_presets table:', e);
    }

    if (preset && !preset.is_enabled && !isTest) return null;

    // Varyant secimi: ayni olay her geldiginde farkli gorsel/ses gosterilsin
    // ve tutara gore daha gorkemli varyant secilebilsin. Varyant yoksa
    // preset oldugu gibi kullanilir (geriye uyum).
    try {
      // Abonelikte eşik AY sayısıdır (panel "ay sayısı" diyor); eskiden
      // months hiç okunmuyordu, abone varyant eşikleri hiç tutmuyordu.
      const deger =
        Number(variables?.amount ?? variables?.viewers ?? variables?.count ?? variables?.months ?? 0) || 0;
      const v = varyantlar.sec(eventType, deger);
      if (v) {
        // Temel preset YOKSA (olay için hiç kayıt açılmamışsa) eskiden
        // `preset.title_template` null üzerinde patlıyor, hata yakalanıp
        // varyant SESSİZCE atlanıyordu. Artık varyant tek başına da çalışır;
        // eksik alanlar aşağıdaki varsayılanlardan tamamlanır.
        const taban = preset || {};
        preset = {
          ...taban,
          event_type: eventType,
          title_template: v.baslikSablonu || taban.title_template || '',
          message_template: v.mesajSablonu || taban.message_template || '',
          image_url: v.gorselUrl || taban.image_url || '',
          sound_url: v.sesUrl || taban.sound_url || '',
          sound_volume: v.sesSeviyesi ?? taban.sound_volume,
          duration_ms: v.sureMs || taban.duration_ms,
          animation: v.animasyon || taban.animation,
          accent_color: v.vurguRengi || taban.accent_color,
          text_color: v.metinRengi || taban.text_color,
          is_enabled: taban.is_enabled ?? 1,
          variant_id: v.id,
          variant_name: v.ad
        };
      }
    } catch (e) {
      console.warn('[AlertBox] Varyant secimi basarisiz:', e);
    }

    if (!preset) {
      const defaults: Record<string, any> = {
        follow: { title: 'YENİ TAKİPÇİ!', message: '{user} aileye katıldı!', color: '#8b5cf6', sound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', img: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
        sub: { title: 'YENİ ABONE!', message: '{user} {tier} seviye ile abone oldu! ({months} ay)', color: '#ec4899', sound: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', img: 'https://media.giphy.com/media/l41lT4n6ylgW2hh04/giphy.gif' },
        tip: { title: 'BAĞIŞ GELDİ!', message: '{user} {amount} {currency} gönderdi: "{message}"', color: '#10b981', sound: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', img: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif' },
        raid: { title: 'RAİD BASKINI!', message: '{user} {viewers} izleyici ile baskın yaptı! Hoş geldiniz!', color: '#f59e0b', sound: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3', img: 'https://media.giphy.com/media/26FPqAH60GLQM8i76/giphy.gif' },
        gift_tiktok: { title: 'TIKTOK HEDİYESİ!', message: '{user} x{count} {giftName} gönderdi!', color: '#06b6d4', sound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', img: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif' },
        gift_sub: { title: 'HEDİYE ABONE!', message: '{user} {count} hediye abone gönderdi!', color: '#f472b6', sound: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', img: 'https://media.giphy.com/media/l41lT4n6ylgW2hh04/giphy.gif' },
        host: { title: 'HOST!', message: '{user} kanalı host etti ({viewers})', color: '#38bdf8', sound: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3', img: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif' },
        kicks: { title: 'KICKS!', message: '{user} {amount} Kick gönderdi!', color: '#53fc18', sound: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3', img: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif' }
      };
      const def = defaults[eventType] || defaults.follow;
      preset = {
        id: `alert-${eventType}`,
        event_type: eventType,
        title_template: def.title,
        message_template: def.message,
        sound_url: def.sound,
        image_url: def.img,
        duration_ms: 5000,
        text_color: '#ffffff',
        accent_color: def.color,
        animation: 'bounce',
        sound_volume: 0.7,
        is_enabled: 1
      };
    }

    let title = preset.title_template || 'BİLDİRİM!';
    let message = preset.message_template || '';

    for (const [key, val] of Object.entries(variables)) {
      const reg = new RegExp(`\\{${key}\\}`, 'gi');
      // İşlevle yerine koy: izleyici adı/mesajındaki `$&` kalıpları metni bozmasın
      title = title.replace(reg, () => String(val));
      message = message.replace(reg, () => String(val));
    }

    return {
      // Olay başına benzersiz: ön ayar kimliği türe göre sabitti, widget ikinci uyarıyı "tekrar" sayıp atıyordu
      id: uyariKimligi(eventType),
      presetId: preset.id,
      isTest,
      eventType: preset.event_type,
      title,
      message,
      soundUrl: preset.sound_url,
      imageUrl: preset.image_url,
      durationMs: preset.duration_ms,
      textColor: preset.text_color,
      accentColor: preset.accent_color,
      animation: preset.animation,
      soundVolume: preset.sound_volume,
      layoutMode: preset.layout_mode || 'stacked',
      textEffect: preset.text_effect || 'shine',
      fontFamily: preset.font_family
    };
  }

  /**
   * Test uyarısı. `deger` verilirse sabit örnek tutar yerine o kullanılır —
   * tutara göre seçilen varyantlar (ör. 500+ bağış) panelden denenebilsin.
   */
  triggerTestAlert(eventType: string = 'follow', deger?: number) {
    const d = Number.isFinite(Number(deger)) && Number(deger) > 0 ? Number(deger) : undefined;
    const mockUsers = ['ProGamer34', 'StreamQueen', 'ApexLegend', 'YildizKullanici', 'GamerBoy'];
    const randomUser = mockUsers[Math.floor(Math.random() * mockUsers.length)];

    let alertData: any = null;
    // Olay veri yoluna (eventBus) da basılan türlerde AYRICA doğrudan yayın
    // yapılıyordu: her test iki alarm tetikliyor, Subathon sayacına süre iki
    // kez ekleniyordu. Veri yolundan geçenler burada ikinci kez yayınlanmaz.
    let veriYolunaBasildi = false;
    let dataPayload: any = null;

    switch (eventType) {
      case 'follow':
        dataPayload = {
          platform: 'kick',
          channel: 'test',
          username: randomUser,
          displayName: randomUser,
          timestamp: Date.now(),
          isTest: true
        };
        alertData = this.buildAlertPayload('follow', { user: randomUser }, true);
        eventBus.emitFollow(dataPayload);
        veriYolunaBasildi = true;
        break;

      case 'sub':
        dataPayload = {
          platform: 'twitch',
          channel: 'test',
          username: randomUser,
          displayName: randomUser,
          tier: 'Tier 1',
          months: d ?? 3,
          isGift: false,
          timestamp: Date.now(),
          isTest: true
        };
        alertData = this.buildAlertPayload('sub', { user: randomUser, tier: 'Tier 1', months: d ?? 3 }, true);
        eventBus.emitSub(dataPayload);
        veriYolunaBasildi = true;
        break;

      case 'tip':
        dataPayload = {
          platform: 'youtube',
          channel: 'test',
          username: randomUser,
          displayName: randomUser,
          amount: d ?? 50,
          currency: '₺',
          message: 'Harika yayınlar, seviliyorsun!',
          timestamp: Date.now(),
          isTest: true
        };
        alertData = this.buildAlertPayload('tip', { user: randomUser, amount: d ?? 50, currency: '₺', message: 'Harika yayınlar, seviliyorsun!' }, true);
        eventBus.emitTip(dataPayload);
        veriYolunaBasildi = true;
        break;

      case 'raid':
        dataPayload = {
          platform: 'twitch',
          channel: 'test',
          username: randomUser,
          displayName: randomUser,
          viewers: d ?? 128,
          timestamp: Date.now(),
          isTest: true
        };
        alertData = this.buildAlertPayload('raid', { user: randomUser, viewers: d ?? 128 }, true);
        eventBus.emitRaid(dataPayload);
        veriYolunaBasildi = true;
        break;

      case 'gift_tiktok':
        dataPayload = {
          platform: 'tiktok',
          channel: 'test',
          username: randomUser,
          displayName: randomUser,
          giftName: 'Asa & Taç',
          count: 5,
          diamonds: 500,
          timestamp: Date.now(),
          isTest: true
        };
        alertData = this.buildAlertPayload('gift_tiktok', { user: randomUser, giftName: 'Asa & Taç', count: 5, diamonds: 500 }, true);
        eventBus.emitTikTokGift(dataPayload);
        veriYolunaBasildi = true;
        break;

      case 'gift_sub':
        dataPayload = { platform: 'twitch', channel: 'test', username: randomUser, displayName: randomUser, count: d ?? 5, timestamp: Date.now(), isTest: true };
        alertData = this.buildAlertPayload('gift_sub', { user: randomUser, count: d ?? 5 }, true);
        break;
      case 'host':
        dataPayload = { platform: 'twitch', channel: 'test', username: randomUser, displayName: randomUser, viewers: d ?? 42, timestamp: Date.now(), isTest: true };
        alertData = this.buildAlertPayload('host', { user: randomUser, viewers: d ?? 42 }, true);
        break;
      case 'kicks':
        dataPayload = { platform: 'kick', channel: 'test', username: randomUser, displayName: randomUser, amount: d ?? 100, timestamp: Date.now(), isTest: true };
        alertData = this.buildAlertPayload('kicks', { user: randomUser, amount: d ?? 100 }, true);
        break;
    }

    // Yalnız veri yolunda karşılığı OLMAYAN türler (gift_sub, host, kicks) için.
    if (alertData && !veriYolunaBasildi) {
      this.broadcastTo(['dashboard', 'alertbox', 'all'], {
        type: 'alert',
        subType: eventType,
        data: dataPayload,
        alert: alertData
      });

      // Kupa yalnız `cup_drop` dinler (çift sayımı önlemek için). Veri
      // yolundan geçen türlerde bu yayın zaten yapılıyor; burada yalnız
      // test amaçlı gift_sub / kicks için ekleniyor.
      if (eventType === 'gift_sub' || eventType === 'kicks') {
        this.kupayaDusur(eventType, {
          user: dataPayload?.displayName || dataPayload?.username,
          count: dataPayload?.count,
          amount: dataPayload?.amount
        });
      }
    }
  }

  /**
   * Bağış Kupası: kurallar (hangi olaylar, eşikler) ve kalıcı durum sunucuda
   * (modules/engagement/kupa.ts); widget yalnız düşen adedi çizer.
   */
  kupayaDusur(tur: string, veri: { user?: string; amount?: number; count?: number }) {
    try {
      const adet = kupa.dus(tur, veri);
      if (adet) this.broadcastTo(['all'], { type: 'cup_drop', data: { type: tur, adet, user: veri.user, amount: veri.amount } });
    } catch (e) {
      seyrekUyar('kupa:dus', '[Kupa] Olay işlenemedi', e);
    }
  }

  /** Sohbet katmanında bağış / puan ödülü satırı (widget ayarı açıksa gösterir). */
  sohbetOlayi(tur: 'bagis' | 'odul', kullanici: string, metin: string) {
    this.broadcastTo(['chatbox'], { type: 'chat_event', data: { tur, kullanici: String(kullanici || '').slice(0, 60), metin: String(metin || '').slice(0, 200) } });
  }

  broadcastTo(types: Array<'dashboard' | 'alertbox' | 'chatbox' | 'goals' | 'wheel' | 'audio' | 'pano' | 'sesli' | 'all'>, payload: any) {
    // Yayınlanan her uyarı sunucu içi dinleyicilere de bildirilir (Hype Treni
    // eskiden tarayıcıda tam olarak bu mesajı dinliyordu; anlam korunur).
    if (payload?.type === 'alert' && payload.alert && !payload.replay) {
      const a = payload.alert;
      this.sonUyarilar.ekle({
        id: String(a.id || uyariKimligi(payload.subType)),
        eventType: String(payload.subType || a.eventType || 'alert'),
        title: String(a.title || ''),
        message: String(a.message || ''),
        at: Date.now(),
        isTest: !!a.isTest,
        alert: a
      });
    }
    // Yeniden oynatma sayaçlara (hype treni, hedef) ikinci kez işlemez
    if (payload?.type === 'alert' && !payload.replay) {
      try {
        eventBus.emit('uyari_yayinlandi', { subType: payload.subType, data: payload.data });
      } catch (e) {
        /* dinleyici hatası yayını bozmasın — ama sessiz de kalmasın */
        seyrekUyar('ws:uyari_yayinlandi', '[WS] Uyarı dinleyicisi hata verdi', e);
      }
    }
    const raw = JSON.stringify(payload);
    for (const client of this.clients) {
      if (types.includes(client.type) || types.includes('all') || client.type === 'all') {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(raw);
        }
      }
    }
  }

  private sendToClient(client: ClientConnection, payload: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(payload));
    }
  }
}

export const wsHub = new WebSocketHub();
export default wsHub;
