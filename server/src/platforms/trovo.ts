/**
 * StreamAxT — Trovo adaptörü
 * Developed by AxthrowA
 *
 * BOTRIX_GAP_ANALYSIS'te eksik olarak işaretlenmişti: BotRix Trovo'yu
 * destekliyor, bizde hiç yoktu.
 *
 * KAYNAK: Trovo Chat Service ve Trovo APIs resmi belgeleri
 * (CONFIRMED_IN_PUBLIC_DOCS). Protokol ayrıntıları tahmin edilmedi:
 *   • WebSocket:  wss://open-chat.trovo.live/chat
 *   • AUTH → RESPONSE, PING → PONG (data.gap saniye)
 *   • CHAT gövdesi: data.chats[] — tür kodları trovo-map.ts'te
 *   • Kanal kimliği: POST /openplatform/getusers   {"user":["ad"]}
 *   • Sohbet jetonu: GET  /openplatform/chat/channel-token/{channelId}
 *     — erişim jetonu GEREKTİRMEZ, yalnız Client-ID ister. Bu yüzden
 *       OKUMA, OAuth kurmadan da çalışır.
 *   • Mesaj GÖNDERME: POST /openplatform/chat/send — `chat_send_self`
 *     kapsamlı OAuth erişim jetonu ZORUNLU. Jeton yoksa gönderme sessizce
 *     başarısız olmaz, sebebi söylenir.
 *
 * DOĞRULAMA DURUMU: Bu adaptörün saf eşleme katmanı testlidir. Canlı
 * bağlantı, elimizde Trovo hesabı ve Client-ID olmadığı için bu turda
 * çalıştırılarak DOĞRULANAMADI — docs/KNOWN_LIMITATIONS.md'de böyle
 * işaretlendi. Yetenek tablosu da yalnız gerçekten uyguladığımızı ilan eder.
 */
import crypto from 'node:crypto';
import WebSocket from 'ws';
import { BasePlatform, PlatformStatus, ModerasyonSonucu } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';
import { settingsCache } from '../core/settings-cache.js';
import { canliDurum } from '../core/live-status.js';
import {
  kalpAtisiAraligi,
  rolleriCoz,
  sohbetOlayi,
  yenidenBaglanmaGecikmesi,
  type TrovoSohbeti,
  trovoKomutAdi
} from './trovo-map.js';

export * from './trovo-map.js';

const API = 'https://open-api.trovo.live/openplatform';
const WS_ADRES = 'wss://open-chat.trovo.live/chat';

export class TrovoPlatform extends BasePlatform {
  readonly name = 'trovo' as const;

  private ws: WebSocket | null = null;
  private connected = false;
  private currentChannel = '';
  private channelId = '';
  private sonHata = '';
  private kalpAtisi: NodeJS.Timeout | null = null;
  private yenidenBagla: NodeJS.Timeout | null = null;
  private deneme = 0;
  /** Kullanıcı bilerek kapattıysa yeniden bağlanma. */
  private kapatiliyor = false;
  /**
   * Kullanıcı adı → kanal kimliği. Veritabanına (`account_id`) YAZILMAZ:
   * panelin genel kaydetme ucu eski `account_id`'yi geri gönderiyor; kullanıcı
   * kanal adını değiştirirse bayat kimlikle ESKİ kanala bağlanırdık.
   */
  private kimlikler = new Map<string, string>();
  /**
   * Mesaj kimliği → gönderenin uid'si. Trovo mesaj silme ucu gönderenin
   * uid'sini de istiyor (`/channels/{c}/messages/{m}/users/{u}`).
   */
  private mesajSahipleri = new Map<string, string>();
  /** Trovo bağlanınca son mesajların geçmişini yollar; bundan eskiler yeniden işlenmez. */
  private baglandiAn = 0;

  // ------------------------------------------------------------- yardımcı --

  private clientId(): string {
    return settingsCache.get('trovo_client_id') || '';
  }

  private erisimJetonu(): string {
    const r = db
      .prepare("SELECT token FROM channels WHERE platform = 'trovo' AND is_active = 1 LIMIT 1")
      .get() as { token?: string } | undefined;
    return r?.token || '';
  }

  private baslik(jetonlu = false): Record<string, string> {
    const h: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Client-ID': this.clientId()
    };
    const t = jetonlu ? this.erisimJetonu() : '';
    if (t) h.Authorization = `OAuth ${t}`;
    return h;
  }

  /** Kanal adından kanal kimliği. Belge: §5.4 Get Users. */
  private async kanalKimligi(kullaniciAdi: string): Promise<string> {
    const r = await fetch(`${API}/getusers`, {
      method: 'POST',
      headers: this.baslik(),
      body: JSON.stringify({ user: [kullaniciAdi] }),
      signal: AbortSignal.timeout(10_000)
    });
    if (!r.ok) throw new Error(`getusers ${r.status}`);
    const j: any = await r.json();
    const k = j?.users?.[0]?.channel_id;
    if (!k) {
      const e: any = new Error(`"${kullaniciAdi}" adlı Trovo kanalı bulunamadı.`);
      e.kalici = true; // yeniden denemek düzeltmez: kanal adı yanlış
      throw e;
    }
    return String(k);
  }

  /**
   * Sohbet jetonu. Belge: §4.2 — erişim jetonu gerektirmez.
   * Jeton 20 saniyede geçersizleşir, bu yüzden HER bağlantıda yeniden alınır.
   */
  private async sohbetJetonu(channelId: string): Promise<string> {
    const r = await fetch(`${API}/chat/channel-token/${encodeURIComponent(channelId)}`, {
      headers: this.baslik(),
      signal: AbortSignal.timeout(10_000)
    });
    if (!r.ok) throw new Error(`chat token ${r.status}`);
    const j: any = await r.json();
    if (!j?.token) throw new Error('Trovo sohbet jetonu boş döndü.');
    return String(j.token);
  }

  // -------------------------------------------------------------- bağlantı --

  async connect(): Promise<boolean> {
    const kanal = db
      .prepare("SELECT * FROM channels WHERE platform = 'trovo' AND is_active = 1 LIMIT 1")
      .get() as any;

    if (!kanal?.channel_name) {
      this.sonHata = 'Trovo kanal adı girilmemiş.';
      this.connected = false;
      return false;
    }
    if (!this.clientId()) {
      // Client-ID olmadan hiçbir Trovo ucu çalışmaz; sessizce denemeyelim.
      this.sonHata = 'Trovo Client-ID girilmemiş (Platformlar → Trovo kartı).';
      this.connected = false;
      return false;
    }

    this.kapatiliyor = false;
    this.currentChannel = String(kanal.channel_name).trim().replace(/^@/, '');

    try {
      const anahtar = this.currentChannel.toLowerCase();
      this.channelId = this.kimlikler.get(anahtar) || (await this.kanalKimligi(this.currentChannel));
      this.kimlikler.set(anahtar, this.channelId);

      const jeton = await this.sohbetJetonu(this.channelId);
      await this.wsAc(jeton);
      return this.connected;
    } catch (e: any) {
      this.sonHata = String(e?.message || e).slice(0, 160);
      this.connected = false;
      console.error('[Trovo] Bağlantı hatası:', this.sonHata);
      if (!e?.kalici) this.yenidenDene();
      return false;
    }
  }

  private wsAc(jeton: string): Promise<void> {
    return new Promise((coz, at) => {
      // connect() iki kez çağrılırsa (açılış + yeniden bağlan) iki soket
      // açılır ve her sohbet mesajı İKİ KEZ işlenirdi. Eskisi sessizce
      // kapatılır; kapanış olayı aşağıdaki "güncel mi" denetimiyle yok sayılır.
      const eski = this.ws;
      this.ws = null;
      if (eski) {
        try {
          eski.terminate();
        } catch {
          /* zaten kapalı */
        }
      }

      const ws = new WebSocket(WS_ADRES);
      this.ws = ws;
      let yanitlandi = false;

      const zamanAsimi = setTimeout(() => {
        if (!yanitlandi) {
          yanitlandi = true;
          try {
            ws.close();
          } catch {
            /* zaten kapalı */
          }
          at(new Error('Trovo AUTH yanıtı gelmedi (10 sn).'));
        }
      }, 10_000);

      const nonce = crypto.randomUUID();

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'AUTH', nonce, data: { token: jeton } }));
      });

      ws.on('message', (ham: WebSocket.RawData) => {
        if (this.ws !== ws) return; // eski soket
        let p: any;
        try {
          p = JSON.parse(String(ham));
        } catch {
          return; // JSON değilse yok say
        }

        if (p?.type === 'RESPONSE' && p?.nonce === nonce) {
          clearTimeout(zamanAsimi);
          if (p?.error) {
            if (!yanitlandi) {
              yanitlandi = true;
              at(new Error(`Trovo AUTH reddedildi: ${p.error}`));
            }
            return;
          }
          this.connected = true;
          this.baglandiAn = Date.now();
          this.sonHata = '';
          this.deneme = 0;
          console.log(`[Trovo] Bağlandı: ${this.currentChannel} (${this.channelId})`);
          this.kalpAtisiBaslat(30_000);
          if (!yanitlandi) {
            yanitlandi = true;
            coz();
          }
          return;
        }

        if (p?.type === 'PONG') {
          this.kalpAtisiBaslat(kalpAtisiAraligi(p));
          return;
        }

        if (p?.type === 'CHAT') this.sohbetleriIsle(p);
      });

      ws.on('close', () => {
        if (this.ws !== ws) return; // yeni bağlantı devraldı
        this.connected = false;
        this.kalpAtisiDurdur();
        if (!this.kapatiliyor) this.yenidenDene();
      });

      ws.on('error', (e: Error) => {
        this.sonHata = String(e?.message || e).slice(0, 160);
        if (!yanitlandi) {
          yanitlandi = true;
          clearTimeout(zamanAsimi);
          at(e);
        }
      });
    });
  }

  private kalpAtisiBaslat(aralik: number) {
    this.kalpAtisiDurdur();
    this.kalpAtisi = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'PING', nonce: crypto.randomUUID() }));
      }
    }, aralik);
  }

  private kalpAtisiDurdur() {
    if (this.kalpAtisi) clearInterval(this.kalpAtisi);
    this.kalpAtisi = null;
  }

  private yenidenDene() {
    if (this.kapatiliyor || this.yenidenBagla) return;
    const gecikme = yenidenBaglanmaGecikmesi(this.deneme++);
    this.yenidenBagla = setTimeout(() => {
      this.yenidenBagla = null;
      void this.connect();
    }, gecikme);
  }

  // ----------------------------------------------------------- olay işleme --

  private sohbetleriIsle(paket: any) {
    const liste: TrovoSohbeti[] = Array.isArray(paket?.data?.chats) ? paket.data.chats : [];
    for (const c of liste) {
      try {
        this.tekSohbet(c);
      } catch (e) {
        console.error('[Trovo] Mesaj işlenemedi:', e);
      }
    }
  }

  private tekSohbet(c: TrovoSohbeti) {
    const olay = sohbetOlayi(c);
    if (olay.tur === 'yoksay') return;

    const rol = rolleriCoz(c.roles, c.medals);
    const kullanici = String(c.user_name || c.nick_name || '').trim();
    const gorunen = String(c.nick_name || kullanici).trim();
    if (!kullanici) return;

    const zaman = Number(c.send_time) ? Number(c.send_time) * 1000 : Date.now();
    // Geçmiş: her yeniden bağlanmada komutlar, puanlar ve uyarılar ikinci kez çalışıyordu (5 sn saat payı)
    if (zaman < this.baglandiAn - 5_000) return;
    const kanal = this.currentChannel;

    switch (olay.tur) {
      case 'chat':
        if (c.message_id && (c.uid ?? c.sender_id) !== undefined) {
          this.mesajSahipleri.set(String(c.message_id), String(c.uid ?? c.sender_id));
          if (this.mesajSahipleri.size > 2000) {
            const ilk = this.mesajSahipleri.keys().next().value;
            if (ilk) this.mesajSahipleri.delete(ilk);
          }
        }
        eventBus.emitChat({
          id: String(c.message_id || `${zaman}-${kullanici}`),
          platform: 'trovo',
          channel: kanal,
          user: {
            id: String(c.uid ?? c.sender_id ?? kullanici),
            username: kullanici,
            displayName: gorunen,
            badges: rol.rozetler,
            isMod: rol.isMod,
            isSub: rol.isSub,
            isVip: rol.isVip,
            isBroadcaster: rol.isBroadcaster,
            avatarUrl: c.avatar ? String(c.avatar) : undefined
          },
          message: olay.metin,
          timestamp: zaman
        });
        break;

      case 'follow':
        eventBus.emitFollow({
          platform: 'trovo',
          channel: kanal,
          username: kullanici,
          displayName: gorunen,
          timestamp: zaman
        });
        break;

      case 'sub':
        eventBus.emitSub({
          platform: 'trovo',
          channel: kanal,
          username: kullanici,
          displayName: gorunen,
          // Trovo abone katmanını sohbet olayında vermez; sub_lv en yakın bilgi
          tier: String(c.sub_lv || 'L1'),
          months: 1,
          isGift: false,
          timestamp: zaman
        });
        break;

      case 'gift_sub':
        eventBus.emitSub({
          platform: 'trovo',
          channel: kanal,
          username: kullanici,
          displayName: gorunen,
          tier: String(c.sub_lv || 'L1'),
          months: 1,
          isGift: true,
          count: Math.max(1, olay.adet),
          recipient: olay.hedef || undefined,
          timestamp: zaman
        });
        break;

      case 'raid':
        eventBus.emitRaid({
          platform: 'trovo',
          channel: kanal,
          username: kullanici,
          displayName: gorunen,
          viewers: olay.adet,
          timestamp: zaman
        });
        break;

      case 'gift':
        // Spell'ler para birimiyle satın alınır; bizde en yakın karşılık
        // bağıştır. Tutar BİLİNMEDİĞİ için 0 verilir, adet mesajda taşınır —
        // uydurma bir para değeri üretmek yanlış uyarı demek olurdu.
        eventBus.emitTip({
          platform: 'trovo',
          channel: kanal,
          username: kullanici,
          displayName: gorunen,
          amount: 0,
          currency: 'SPELL',
          message: olay.hedef ? `${olay.hedef} x${olay.adet}` : olay.metin,
          timestamp: zaman
        });
        break;

      // Olay doğrudan yayılmaz: canlı durum servisi geçişi yönetir, Discord
      // duyurusu ve erişim kipli komutlar oradan beslenir.
      case 'stream_online':
        canliDurum.bildir('trovo', {
          canli: true,
          baslangic: zaman,
          yayinId: `${this.channelId}:${Math.floor(zaman / 60_000)}`,
          kanal
        });
        break;

      case 'stream_offline':
        canliDurum.bildir('trovo', { canli: false, kanal });
        break;
    }
  }

  // --------------------------------------------------------------- sözleşme --

  async disconnect(): Promise<void> {
    this.kapatiliyor = true;
    this.kalpAtisiDurdur();
    if (this.yenidenBagla) clearTimeout(this.yenidenBagla);
    this.yenidenBagla = null;
    try {
      this.ws?.close();
    } catch {
      /* zaten kapalı */
    }
    this.ws = null;
    this.connected = false;
    canliDurum.unut('trovo');
  }

  // ------------------------------------------------------- moderasyon ------

  /** Resmi uç: `POST /openplatform/channels/command` (kapsam manage_messages). */
  private async komutCalistir(komut: string): Promise<ModerasyonSonucu> {
    if (!this.erisimJetonu()) return { ok: false, hata: 'Trovo moderasyonu için OAuth jetonu gerekir (manage_messages)' };
    if (!this.channelId) return { ok: false, hata: 'Trovo kanalı bağlı değil' };
    try {
      const r = await fetch(`${API}/channels/command`, {
        method: 'POST',
        headers: this.baslik(true),
        body: JSON.stringify({ command: komut, channel_id: Number(this.channelId) }),
        signal: AbortSignal.timeout(10_000)
      });
      const g: any = await r.json().catch(() => ({}));
      if (!r.ok) return { ok: false, hata: `Trovo ${r.status}: ${String(g?.message || g?.error || '').slice(0, 120)}` };
      // Belge: 200 dönse de `is_success:false` olabilir, sebep `display_msg`
      if (g?.is_success === false) return { ok: false, hata: `Trovo: ${String(g?.display_msg || 'komut reddedildi')}` };
      return { ok: true };
    } catch (e: any) {
      return { ok: false, hata: String(e?.message || e).slice(0, 120) };
    }
  }

  /**
   * Mesaj silme: `DELETE /channels/{channelID}/messages/{messageID}/users/{uID}`
   * (kapsam manage_messages). uid, sohbetten öğrenilmiş olmalı.
   */
  async deleteMessage(messageId: string): Promise<ModerasyonSonucu> {
    if (!this.erisimJetonu()) return { ok: false, hata: 'Trovo moderasyonu için OAuth jetonu gerekir (manage_messages)' };
    const uid = this.mesajSahipleri.get(String(messageId));
    if (!uid) return { ok: false, hata: 'Mesajın göndereni bilinmiyor (bu oturumda görülmedi)' };
    try {
      const r = await fetch(
        `${API}/channels/${encodeURIComponent(this.channelId)}/messages/${encodeURIComponent(messageId)}/users/${encodeURIComponent(uid)}`,
        { method: 'DELETE', headers: this.baslik(true), signal: AbortSignal.timeout(10_000) }
      );
      if (!r.ok) {
        const g: any = await r.json().catch(() => ({}));
        return { ok: false, hata: `Trovo ${r.status}: ${String(g?.message || g?.error || '').slice(0, 120)}` };
      }
      return { ok: true };
    } catch (e: any) {
      return { ok: false, hata: String(e?.message || e).slice(0, 120) };
    }
  }

  /**
   * Kalıcı ban: resmi belgedeki örnek komut `ban xxx`
   * (developer.trovo.live — "Perform chat commands").
   *
   * Zaman aşımı BİLEREK YOK: üçüncü taraf listeler `/ban [@ad] [süre]`
   * yazıyor ama sürenin BİRİMİ (saniye mi dakika mı) hiçbir kaynakta yok.
   * Tahmin etmek gerçek bir izleyiciye 10 dakika yerine 10 saat ceza
   * verebilirdi; yetenek tablosunda `timeout: false`.
   */
  async banUser(username: string, _sebep?: string): Promise<ModerasyonSonucu> {
    const ad = trovoKomutAdi(username);
    if (!ad) return { ok: false, hata: 'Geçersiz Trovo kullanıcı adı (boşluk/özel karakter komuta karışabilirdi)' };
    return this.komutCalistir(`ban ${ad}`);
  }

  async unbanUser(username: string): Promise<ModerasyonSonucu> {
    const ad = trovoKomutAdi(username);
    if (!ad) return { ok: false, hata: 'Geçersiz Trovo kullanıcı adı' };
    return this.komutCalistir(`unban ${ad}`);
  }

  /**
   * Başlık: resmi belgedeki örnek komut `settitle xxx`.
   * Trovo zaman aşımı komutunun süre birimi belgede YOK — uydurmamak için
   * `timeoutUser` bilerek tanımlanmadı (yetenek tablosunda false).
   */
  async baslikDegistir(baslik: string): Promise<ModerasyonSonucu> {
    const b = String(baslik || '').replace(/[\r\n]+/g, ' ').trim();
    if (!b) return { ok: false, hata: 'Başlık boş olamaz' };
    return this.komutCalistir(`settitle ${b.slice(0, 140)}`);
  }

  async sendMessage(_channel: string, message: string): Promise<boolean> {
    const jeton = this.erisimJetonu();
    if (!jeton) {
      // Sessizce false dönmek "neden yazmıyor" sorusunu doğuruyordu.
      this.sonHata = 'Trovo mesaj göndermek için OAuth bağlantısı gerekir (chat_send_self izni).';
      console.warn('[Trovo]', this.sonHata);
      return false;
    }
    try {
      const r = await fetch(`${API}/chat/send`, {
        method: 'POST',
        headers: this.baslik(true),
        body: JSON.stringify({ content: String(message).slice(0, 300) }),
        signal: AbortSignal.timeout(10_000)
      });
      if (!r.ok) {
        this.sonHata = `Trovo gönderme hatası ${r.status}`;
        return false;
      }
      return true;
    } catch (e: any) {
      this.sonHata = String(e?.message || e).slice(0, 160);
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): PlatformStatus {
    return {
      connected: this.connected,
      channel: this.currentChannel,
      error: this.sonHata || undefined
    };
  }
}

export const trovoPlatform = new TrovoPlatform();
export default trovoPlatform;
