/**
 * StreamAxT — YouTube Canlı adaptörü
 * Developed by AxthrowA
 *
 * Kaynak: YouTube Data API v3 (CONFIRMED_IN_PUBLIC_DOCS)
 *   • liveChatMessages.list   GET    /liveChat/messages   (API anahtarı yeter)
 *   • liveChatMessages.insert POST   /liveChat/messages   (OAuth)
 *   • liveChatMessages.delete DELETE /liveChat/messages?id=   (OAuth, youtube.force-ssl)
 *   • liveChatBans.insert     POST   /liveChat/bans?part=snippet  (OAuth)
 *                             {snippet:{liveChatId, type:"temporary"|"permanent",
 *                              banDurationSeconds, bannedUserDetails:{channelId}}}
 *   • videos.list             liveStreamingDetails: actualStartTime,
 *                             actualEndTime, concurrentViewers, activeLiveChatId
 *
 * Bu sürümde düzeltilenler (canlı denemede / kod okumasında bulundu):
 *   1. Platformlar kartı "linkteki v=xxxx kodunu yazın" diyordu ama adaptör
 *      yalnız 20+ karakterli liveChatId kabul ediyordu: VİDEO KİMLİĞİ ile
 *      sohbet HİÇ okunmuyordu. Artık video kimliği (veya adresi) verilince
 *      `activeLiveChatId` otomatik bulunuyor.
 *   2. İlk yoklama sohbet GEÇMİŞİNİ yeni mesaj gibi veriyordu: bot açılınca
 *      eski komutlara yeniden yanıt verebiliyordu. İlk sayfa artık yalnız
 *      imleç için okunuyor.
 *   3. Yoklama sabit 4,5 sn'de bir yapılıyordu ve hatalar SESSİZCE
 *      yutuluyordu. Artık API'nin önerdiği `pollingIntervalMillis`
 *      uygulanıyor (kota daha geç biter) ve kota/izin hatası panelde
 *      görünüyor.
 */
import axios from 'axios';
import { BasePlatform, PlatformStatus, ModerasyonSonucu } from './base.js';
import { eventBus } from '../core/event-bus.js';
import { db } from '../db/index.js';
import { isoZamani, youtubeKimlikTuru, youtubeVideoKimligi, type YayinBilgisi } from '../core/live-status-math.js';

const API = 'https://www.googleapis.com/youtube/v3';

/** Google hata gövdesinden kısa açıklama. */
function googleHatasi(e: any): string {
  const durum = e?.response?.status;
  const neden = e?.response?.data?.error?.errors?.[0]?.reason || '';
  const mesaj = String(e?.response?.data?.error?.message || e?.message || e).slice(0, 140);
  if (neden === 'quotaExceeded' || neden === 'dailyLimitExceeded') {
    return 'YouTube API günlük kotası doldu — yarın sıfırlanır (Google Cloud konsolundan artırılabilir)';
  }
  if (durum === 401) return 'YouTube OAuth jetonu geçersiz veya süresi dolmuş';
  if (durum === 403) return `YouTube izin hatası: ${mesaj}`;
  if (durum === 404) return 'YouTube: sohbet veya video bulunamadı (yayın bitmiş olabilir)';
  return `YouTube hatası${durum ? ` ${durum}` : ''}: ${mesaj}`;
}

export class YouTubePlatform extends BasePlatform {
  readonly name = 'youtube' as const;
  private connected: boolean = false;
  private currentChannel: string = '';
  private liveChatId: string = '';
  private videoId: string = '';
  private apiKey: string = '';
  private oauthToken: string = '';
  private nextPageToken: string = '';
  private zamanlayici: NodeJS.Timeout | null = null;
  private ilkSayfa = true;
  private sonHata = '';
  /** Görünen ad → kanal kimliği (yasaklama için gerekir). */
  private kanalKimlikleri: Map<string, string> = new Map();

  async connect(): Promise<boolean> {
    const channelRow = db.prepare("SELECT * FROM channels WHERE platform = 'youtube' AND is_active = 1 LIMIT 1").get() as any;
    if (!channelRow || !channelRow.channel_name) {
      this.connected = false;
      return false;
    }

    this.currentChannel = channelRow.channel_name.trim();
    this.apiKey = channelRow.token || '';
    this.oauthToken = channelRow.refresh_token || '';
    this.nextPageToken = '';
    this.ilkSayfa = true;
    this.liveChatId = '';
    this.videoId = '';

    if (!this.apiKey) {
      this.sonHata = 'YouTube API anahtarı girilmemiş';
      this.connected = false;
      return false;
    }

    const tur = youtubeKimlikTuru(this.currentChannel);
    if (tur === 'sohbet') {
      this.liveChatId = this.currentChannel;
    } else if (tur === 'video') {
      this.videoId = youtubeVideoKimligi(this.currentChannel);
      const r = await this.videoBilgisi();
      if (!r.ok) {
        this.sonHata = r.hata;
        console.warn('[YouTube]', r.hata);
      } else if (!r.sohbetId) {
        this.sonHata = 'Bu videonun etkin canlı sohbeti yok (yayın başlamamış veya bitmiş)';
        console.warn('[YouTube]', this.sonHata);
      } else {
        this.liveChatId = r.sohbetId;
      }
    } else {
      this.sonHata = 'Kanal alanına canlı yayın video kimliği (v=...) veya liveChatId girin';
    }

    this.connected = true;
    this.yoklamaPlanla(0);
    console.log(`[YouTube] Listening for live chat on channel/video: ${this.currentChannel}`);
    return true;
  }

  /** videos.list → sohbet kimliği + yayın durumu (API anahtarı yeter). */
  private async videoBilgisi(): Promise<
    | { ok: true; sohbetId: string; bilgi: YayinBilgisi }
    | { ok: false; hata: string }
  > {
    if (!this.videoId) return { ok: false, hata: 'Video kimliği yok' };
    try {
      const r = await axios.get(`${API}/videos`, {
        params: { part: 'liveStreamingDetails,snippet', id: this.videoId, key: this.apiKey },
        timeout: 8000
      });
      const v = r.data?.items?.[0];
      if (!v) return { ok: false, hata: `YouTube'da "${this.videoId}" videosu bulunamadı` };
      const d = v.liveStreamingDetails || {};
      const basladi = isoZamani(d.actualStartTime);
      const bitti = isoZamani(d.actualEndTime);
      const canli = !!basladi && !bitti;
      return {
        ok: true,
        sohbetId: String(d.activeLiveChatId || ''),
        bilgi: {
          canli,
          baslangic: canli ? basladi : null,
          izleyici: Number(d.concurrentViewers) || 0,
          baslik: String(v.snippet?.title || ''),
          yayinId: this.videoId,
          kanal: String(v.snippet?.channelTitle || this.currentChannel)
        }
      };
    } catch (e: any) {
      return { ok: false, hata: googleHatasi(e) };
    }
  }

  private yoklamaPlanla(gecikme: number) {
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = setTimeout(() => void this.yokla(), gecikme);
  }

  private async yokla() {
    if (!this.connected) return;

    // Sohbet kimliği yoksa video yeniden sorgulanır (yayın sonradan başlayabilir)
    if (!this.liveChatId) {
      if (this.videoId) {
        const r = await this.videoBilgisi();
        if (r.ok && r.sohbetId) {
          this.liveChatId = r.sohbetId;
          this.sonHata = '';
        }
      }
      this.yoklamaPlanla(60_000);
      return;
    }

    let sonraki = 6000;
    try {
      const params: Record<string, string> = {
        liveChatId: this.liveChatId,
        part: 'snippet,authorDetails',
        key: this.apiKey
      };
      if (this.nextPageToken) params.pageToken = this.nextPageToken;
      const res = await axios.get(`${API}/liveChat/messages`, { params, timeout: 8000 });
      this.nextPageToken = res.data?.nextPageToken || this.nextPageToken;
      sonraki = Math.max(5000, Number(res.data?.pollingIntervalMillis) || 6000);
      this.sonHata = '';

      const items: any[] = res.data?.items || [];
      // İlk sayfa GEÇMİŞTİR: yalnız imleç için okunur, olay üretmez
      if (this.ilkSayfa) {
        this.ilkSayfa = false;
      } else {
        for (const item of items) this.ogeIsle(item);
      }
    } catch (e: any) {
      const hata = googleHatasi(e);
      if (hata !== this.sonHata) console.warn('[YouTube] Sohbet yoklaması başarısız:', hata);
      this.sonHata = hata;
      // Kota bittiyse sık denemek anlamsız
      sonraki = /kota/i.test(hata) ? 15 * 60_000 : 30_000;
      // Sohbet kapandıysa (404) yeni sohbet kimliği aranır
      if (e?.response?.status === 404 && this.videoId) {
        this.liveChatId = '';
        this.nextPageToken = '';
        this.ilkSayfa = true;
      }
    }
    this.yoklamaPlanla(sonraki);
  }

  private ogeIsle(item: any) {
    const author = item.authorDetails || {};
    const snippet = item.snippet || {};

    if (author.displayName && author.channelId) {
      this.kanalKimlikleri.set(String(author.displayName).toLowerCase(), String(author.channelId));
      if (this.kanalKimlikleri.size > 5000) {
        const ilk = this.kanalKimlikleri.keys().next().value;
        if (ilk) this.kanalKimlikleri.delete(ilk);
      }
    }

    if (snippet.type === 'superChatEvent') {
      const sc = snippet.superChatDetails || {};
      eventBus.emitTip({
        platform: 'youtube',
        channel: this.currentChannel,
        username: author.displayName,
        displayName: author.displayName,
        amount: parseFloat(sc.amountMicros) / 1000000,
        currency: sc.currency,
        message: sc.userComment,
        timestamp: new Date(snippet.publishedAt).getTime()
      });
    }

    const text = snippet.displayMessage || snippet.textMessageDetails?.messageText;
    if (text) {
      eventBus.emitChat({
        id: item.id,
        platform: 'youtube',
        channel: this.currentChannel,
        user: {
          id: author.channelId,
          username: author.displayName,
          displayName: author.displayName,
          badges: author.isChatModerator ? ['moderator'] : [],
          isMod: Boolean(author.isChatModerator),
          isSub: Boolean(author.isChatSponsor),
          isVip: false,
          isBroadcaster: Boolean(author.isChatOwner),
          avatarUrl: author.profileImageUrl
        },
        message: text,
        timestamp: new Date(snippet.publishedAt).getTime()
      });
    }
  }

  async disconnect(): Promise<void> {
    if (this.zamanlayici) {
      clearTimeout(this.zamanlayici);
      this.zamanlayici = null;
    }
    this.connected = false;
  }

  async sendMessage(channel: string, message: string): Promise<boolean> {
    if (!this.oauthToken || !this.liveChatId) {
      console.log(`[YouTube Mock-Send]: ${message} (OAuth token required for YouTube live chat writing)`);
      return false;
    }

    try {
      await axios.post(
        `${API}/liveChat/messages?part=snippet`,
        {
          snippet: {
            liveChatId: this.liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message
            }
          }
        },
        {
          headers: {
            Authorization: `Bearer ${this.oauthToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return true;
    } catch (err: any) {
      console.error('[YouTube] Failed to send live chat message:', googleHatasi(err));
      return false;
    }
  }

  // ------------------------------------------------------- moderasyon ------

  async timeoutUser(username: string, saniye: number, _sebep?: string): Promise<ModerasyonSonucu> {
    if (!this.oauthToken) return { ok: false, hata: 'YouTube moderasyonu için OAuth jetonu gerekir' };
    if (!this.liveChatId) return { ok: false, hata: 'Etkin YouTube canlı sohbeti yok' };
    const kanalId = this.kanalKimlikleri.get(String(username || '').replace(/^@/, '').toLowerCase());
    if (!kanalId) return { ok: false, hata: `${username} bu oturumda sohbette görülmedi (kanal kimliği yok)` };
    try {
      await axios.post(
        `${API}/liveChat/bans?part=snippet`,
        {
          snippet: {
            liveChatId: this.liveChatId,
            type: 'temporary',
            banDurationSeconds: Math.max(1, Math.round(Number(saniye) || 60)),
            bannedUserDetails: { channelId: kanalId }
          }
        },
        { headers: { Authorization: `Bearer ${this.oauthToken}`, 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      return { ok: true };
    } catch (e: any) {
      const hata = googleHatasi(e);
      console.warn(`[YouTube] timeout başarısız (${username}):`, hata);
      return { ok: false, hata };
    }
  }

  async deleteMessage(messageId: string): Promise<ModerasyonSonucu> {
    if (!this.oauthToken) return { ok: false, hata: 'YouTube moderasyonu için OAuth jetonu gerekir' };
    try {
      await axios.delete(`${API}/liveChat/messages`, {
        params: { id: messageId },
        headers: { Authorization: `Bearer ${this.oauthToken}` },
        timeout: 8000
      });
      return { ok: true };
    } catch (e: any) {
      const hata = googleHatasi(e);
      console.warn('[YouTube] mesaj silme başarısız:', hata);
      return { ok: false, hata };
    }
  }

  /**
   * `!accountage` için: kanalın açılış tarihi (channels.list, API anahtarı).
   * Kullanıcının kanal kimliği bu oturumda sohbetten öğrenilmiş olmalı.
   */
  async hesapOlusturma(adHam: string): Promise<number | null> {
    const kanalId = this.kanalKimlikleri.get(String(adHam || '').replace(/^@/, '').toLowerCase());
    if (!kanalId || !this.apiKey) return null;
    try {
      const r = await axios.get(`${API}/channels`, {
        params: { part: 'snippet', id: kanalId, key: this.apiKey },
        timeout: 8000
      });
      return isoZamani(r.data?.items?.[0]?.snippet?.publishedAt);
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------- yayın durumu -------

  async yayinDurumu(): Promise<YayinBilgisi | null> {
    // Yalnız liveChatId verildiyse video bilinmez: durum da bilinemez
    if (!this.connected || !this.videoId) return null;
    const r = await this.videoBilgisi();
    if (!r.ok) return null;
    if (r.sohbetId && !this.liveChatId) this.liveChatId = r.sohbetId;
    return r.bilgi;
  }

  /**
   * Yayın başlığı (videos.update, OAuth).
   * DİKKAT: update isteğinde gönderilmeyen snippet alanları SİLİNİR (Google
   * belgesi). Bu yüzden mevcut snippet OLDUĞU GİBİ alınıp yalnız başlık
   * değiştirilir — açıklama ve etiketler kaybolmasın.
   */
  async baslikDegistir(baslik: string): Promise<ModerasyonSonucu> {
    if (!this.oauthToken) return { ok: false, hata: 'YouTube başlığı için OAuth jetonu gerekir' };
    if (!this.videoId) return { ok: false, hata: 'Video kimliği bilinmiyor (kanal alanına v=... girin)' };
    const b = String(baslik || '').trim();
    if (!b) return { ok: false, hata: 'Başlık boş olamaz' };
    try {
      const h = { Authorization: `Bearer ${this.oauthToken}` };
      const r = await axios.get(`${API}/videos`, { params: { part: 'snippet', id: this.videoId }, headers: h, timeout: 8000 });
      const sn = r.data?.items?.[0]?.snippet;
      if (!sn) return { ok: false, hata: 'Video bulunamadı' };
      const yeni = { ...sn, title: b.slice(0, 100) };
      await axios.put(
        `${API}/videos?part=snippet`,
        { id: this.videoId, snippet: yeni },
        { headers: { ...h, 'Content-Type': 'application/json' }, timeout: 10000 }
      );
      return { ok: true };
    } catch (e: any) {
      return { ok: false, hata: googleHatasi(e) };
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

export const youtubePlatform = new YouTubePlatform();
export default youtubePlatform;
