/**
 * AxBoT — Kick gerçek zamanlı sohbet bağlantısı
 * Developed by AxthrowA
 *
 * Kick'in sunucusunun pazarlıkta verdiği sağlayıcıya (Centrifugo; önerilirse
 * Pusher) bağlanır, sohbet/kanal olaylarını `olay` ile yayar ve kopunca kendi
 * kendine yeniden bağlanır. Protokol ayrıntıları ve gözlem notları:
 * `kick-realtime-protokol.ts`. Bağlantı yalnız OKUR; belirteç oturumsuzdur
 * (kullanıcı hesabı ya da bot tokenı GÖNDERİLMEZ).
 */
import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import axios from 'axios';
import WebSocket from 'ws';
import Pusher from 'pusher-js';
import {
  BELIRTEC_DOLDU,
  VARSAYILAN_REALTIME_API,
  baglantiSec,
  belirtecSec,
  cerceveCoz,
  pazarlikGovdesi,
  satirlar,
  sessizlikSiniriMs,
  yenidenDenemeMs,
  yenilemeGecikmesiMs,
  type KickSaglayici
} from './kick-realtime-protokol.js';
import { hataMetni, seyrekUyar } from '../core/logger.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export type KickRealtimeDurumu = 'kapali' | 'baglaniyor' | 'bagli' | 'hata';

export interface KickRealtimeOzet {
  durum: KickRealtimeDurumu;
  saglayici?: KickSaglayici;
  hata?: string;
  /** Son olayın zamanı (ms) — "bağlı ama hiç mesaj gelmiyor" teşhisi için. */
  sonOlay?: number;
}

/**
 * Sınama için Kick API kökü ortamdan değiştirilebilir (yalnız yerel adres).
 * Üretimde her zaman `web.kick.com`.
 */
function apiKoku(): { kok: string; ekIzinli: string[] } {
  const ortam = String(process.env.STREAMAXT_KICK_REALTIME_API || '').trim().replace(/\/+$/, '');
  if (ortam && /^http:\/\/127\.0\.0\.1:\d+(\/|$)/.test(ortam)) {
    const port = new URL(ortam).port;
    return { kok: ortam, ekIzinli: [`ws://127.0.0.1:${port}/`] };
  }
  return { kok: VARSAYILAN_REALTIME_API, ekIzinli: [] };
}

export class KickRealtime extends EventEmitter {
  private kanallar: string[] = [];
  private durduruldu = true;
  private ws: WebSocket | null = null;
  private pusher: Pusher | null = null;
  private istemciId = randomUUID();
  private komutNo = 1;
  private deneme = 0;
  private yenidenZamanlayici: NodeJS.Timeout | null = null;
  private yenilemeZamanlayici: NodeJS.Timeout | null = null;
  private sessizlikZamanlayici: NodeJS.Timeout | null = null;
  private sessizlikMs = sessizlikSiniriMs(undefined);
  /** Her bağlantı denemesine artan numara: eski soketin geç gelen olayları yok sayılır. */
  private nesil = 0;
  private ozet: KickRealtimeOzet = { durum: 'kapali' };

  durum(): KickRealtimeOzet {
    return { ...this.ozet };
  }

  baslat(kanallar: string[]): void {
    this.durdur();
    this.kanallar = [...kanallar];
    this.durduruldu = false;
    this.deneme = 0;
    void this.baglan();
  }

  durdur(): void {
    this.durduruldu = true;
    this.nesil++;
    this.zamanlayicilariTemizle();
    if (this.ws) {
      try {
        this.ws.removeAllListeners();
        this.ws.on('error', () => {}); // kapanırken gelen hata süreci düşürmesin
        this.ws.close(1000);
      } catch {
        /* zaten kapalı */
      }
      this.ws = null;
    }
    if (this.pusher) {
      try {
        this.pusher.disconnect();
      } catch {
        /* zaten kapalı */
      }
      this.pusher = null;
    }
    this.durumAyarla({ durum: 'kapali' });
  }

  private zamanlayicilariTemizle() {
    for (const z of [this.yenidenZamanlayici, this.yenilemeZamanlayici, this.sessizlikZamanlayici]) if (z) clearTimeout(z);
    this.yenidenZamanlayici = this.yenilemeZamanlayici = this.sessizlikZamanlayici = null;
  }

  private durumAyarla(yeni: KickRealtimeOzet) {
    const onceki = this.ozet;
    this.ozet = { ...yeni, sonOlay: yeni.sonOlay ?? onceki.sonOlay };
    if (onceki.durum !== yeni.durum || onceki.hata !== yeni.hata) this.emit('durum', this.durum());
  }

  private async postJson(yol: string, govde: unknown): Promise<unknown> {
    const { kok } = apiKoku();
    const r = await axios.post(`${kok}${yol}`, govde, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
      timeout: 8000
    });
    return r.data;
  }

  private yenidenBaglanmayiPlanla(sebep: string) {
    if (this.durduruldu) return;
    this.zamanlayicilariTemizle();
    const bekle = yenidenDenemeMs(this.deneme++);
    this.durumAyarla({ durum: 'hata', saglayici: this.ozet.saglayici, hata: sebep });
    seyrekUyar('kick-realtime', `[Kick Realtime] Sohbet bağlantısı koptu (${sebep}); ${Math.round(bekle / 1000)} sn sonra yeniden denenecek`, undefined, 120_000);
    this.yenidenZamanlayici = setTimeout(() => void this.baglan(), bekle);
  }

  private async baglan(): Promise<void> {
    if (this.durduruldu) return;
    const nesil = ++this.nesil;
    this.durumAyarla({ durum: 'baglaniyor', saglayici: this.ozet.saglayici });
    try {
      const { ekIzinli } = apiKoku();
      const secim = baglantiSec(await this.postJson('/connection', pazarlikGovdesi(this.istemciId)), ekIzinli);
      if (nesil !== this.nesil) return;
      if (!secim) {
        this.yenidenBaglanmayiPlanla('Kick desteklenen bir sohbet bağlantısı önermedi');
        return;
      }
      if (secim.saglayici === 'pusher') {
        this.pusherBaglan(secim.appKey!, secim.cluster!, nesil);
        return;
      }
      const belirtec = belirtecSec(await this.postJson('/auth/connection', { client_id: this.istemciId }));
      if (nesil !== this.nesil) return;
      if (!belirtec) {
        this.yenidenBaglanmayiPlanla('Kick sohbet belirteci alınamadı');
        return;
      }
      this.centrifugoBaglan(secim.url!, belirtec, nesil);
    } catch (e) {
      if (nesil !== this.nesil) return;
      const durum = (e as any)?.response?.status;
      this.yenidenBaglanmayiPlanla(durum ? `Kick bağlantı API'si HTTP ${durum}` : hataMetni(e));
    }
  }

  // ── Centrifugo ──────────────────────────────────────────────────────────

  private gonder(cerceve: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(cerceve));
  }

  private sessizlikKur(nesil: number) {
    if (this.sessizlikZamanlayici) clearTimeout(this.sessizlikZamanlayici);
    this.sessizlikZamanlayici = setTimeout(() => {
      if (nesil !== this.nesil || !this.ws) return;
      // Yarı açık soket: sunucu yoklamayı kesti — zorla kapat, yeniden bağlan
      try {
        this.ws.terminate();
      } catch {
        /* yok say */
      }
    }, this.sessizlikMs);
  }

  private centrifugoBaglan(url: string, belirtec: string, nesil: number) {
    const ws = new WebSocket(url, { headers: { 'User-Agent': UA }, handshakeTimeout: 10_000 });
    this.ws = ws;
    this.komutNo = 1;
    const baglanId = this.komutNo++;

    ws.on('open', () => {
      if (nesil !== this.nesil) return;
      ws.send(JSON.stringify({ connect: { token: belirtec, name: 'js' }, id: baglanId }));
      this.sessizlikKur(nesil);
    });

    ws.on('message', (ham) => {
      if (nesil !== this.nesil) return;
      this.sessizlikKur(nesil);
      for (const satir of satirlar(String(ham))) {
        const c = cerceveCoz(satir);
        if (c.tur === 'ping') {
          ws.send('{}');
        } else if (c.tur === 'yayin') {
          this.ozet.sonOlay = Date.now();
          this.emit('olay', c.kanal, c.olay, c.veri);
        } else if (c.tur === 'yanit') {
          if (c.hata) {
            if (c.hata.code === BELIRTEC_DOLDU) {
              try {
                ws.terminate(); // kapanış yeniden bağlanmayı (yeni belirteçle) başlatır
              } catch {
                /* yok say */
              }
              return;
            }
            seyrekUyar(`kick-realtime-hata-${c.hata.code}`, `[Kick Realtime] Sunucu hatası ${c.hata.code}: ${c.hata.message}`);
            if (c.id === baglanId) {
              try {
                ws.close(1000);
              } catch {
                /* yok say */
              }
            }
            continue;
          }
          if (c.id === baglanId && c.connect) {
            this.deneme = 0;
            this.sessizlikMs = sessizlikSiniriMs(c.connect.ping);
            for (const kanal of this.kanallar) this.gonder({ subscribe: { channel: kanal, flag: 1 }, id: this.komutNo++ });
            this.durumAyarla({ durum: 'bagli', saglayici: 'centrifugo' });
            console.log(`[Kick Realtime] Sohbete bağlanıldı (${this.kanallar.length} kanal, ${new URL(url).hostname})`);
            if (c.connect.expires) this.yenilemePlanla(c.connect.ttl, nesil);
          } else if (c.refresh?.expires) {
            this.yenilemePlanla(c.refresh.ttl, nesil);
          }
        }
      }
    });

    ws.on('close', (kod) => {
      if (nesil !== this.nesil) return;
      this.ws = null;
      this.yenidenBaglanmayiPlanla(`soket kapandı (${kod})`);
    });

    ws.on('error', (e) => {
      // 'close' ardından gelir; yeniden bağlanma orada planlanır
      if (nesil === this.nesil) seyrekUyar('kick-realtime-soket', '[Kick Realtime] Soket hatası', e, 120_000);
    });
  }

  private yenilemePlanla(ttl: number | undefined, nesil: number) {
    const gecikme = yenilemeGecikmesiMs(ttl);
    if (gecikme == null) return;
    if (this.yenilemeZamanlayici) clearTimeout(this.yenilemeZamanlayici);
    this.yenilemeZamanlayici = setTimeout(async () => {
      if (nesil !== this.nesil) return;
      try {
        const belirtec = belirtecSec(await this.postJson('/auth/connection', { client_id: this.istemciId }));
        if (nesil !== this.nesil) return;
        if (belirtec) this.gonder({ refresh: { token: belirtec }, id: this.komutNo++ });
        else this.ws?.terminate();
      } catch {
        // Belirteç alınamadı: süre dolunca sunucu kapatır; yeniden bağlanma devreye girer
      }
    }, gecikme);
  }

  // ── Pusher (sunucu önerirse) ────────────────────────────────────────────

  private pusherBaglan(appKey: string, cluster: string, nesil: number) {
    const p = new Pusher(appKey, { cluster, forceTLS: true, enabledTransports: ['ws', 'wss'] });
    this.pusher = p;
    p.connection.bind('state_change', (d: { current: string }) => {
      if (nesil !== this.nesil) return;
      if (d.current === 'connected') {
        this.deneme = 0;
        this.durumAyarla({ durum: 'bagli', saglayici: 'pusher' });
      } else if (d.current === 'unavailable' || d.current === 'failed') {
        // Pusher kendi yeniden bağlanmasını dener; kalıcı hatada pazarlığı tazele
        try {
          p.disconnect();
        } catch {
          /* yok say */
        }
        this.pusher = null;
        this.yenidenBaglanmayiPlanla(`Pusher ${d.current}`);
      }
    });
    p.connection.bind('error', (err: any) => {
      if (nesil !== this.nesil) return;
      const kod = err?.error?.data?.code;
      if (kod >= 4000 && kod < 4100) {
        try {
          p.disconnect();
        } catch {
          /* yok say */
        }
        this.pusher = null;
        this.yenidenBaglanmayiPlanla(`Pusher ${kod}: ${err?.error?.data?.message || ''}`.trim());
      }
    });
    for (const kanal of this.kanallar) {
      p.subscribe(kanal).bind_global((olay: string, veri: unknown) => {
        if (nesil !== this.nesil || !olay || olay.startsWith('pusher:') || olay.startsWith('pusher_internal:')) return;
        let v = veri;
        if (typeof v === 'string') {
          try {
            v = JSON.parse(v);
          } catch {
            /* düz metin */
          }
        }
        this.ozet.sonOlay = Date.now();
        this.emit('olay', kanal, olay, v);
      });
    }
  }
}
