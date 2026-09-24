import { BasePlatform } from './base.js';
import { twitchPlatform } from './twitch.js';
import { kickPlatform } from './kick.js';
import { youtubePlatform } from './youtube.js';
import { discordPlatform } from './discord.js';
import { tiktokPlatform } from './tiktok.js';
import { trovoPlatform } from './trovo.js';
import { eventBus, BotMessagePayload } from '../core/event-bus.js';
import { seyrekUyar } from '../core/logger.js';

export class PlatformManager {
  private platforms: Map<string, BasePlatform> = new Map();

  constructor() {
    this.register(twitchPlatform);
    this.register(kickPlatform);
    this.register(youtubePlatform);
    this.register(discordPlatform);
    this.register(tiktokPlatform);
    this.register(trovoPlatform);

    this.setupMessageRouting();
  }

  register(platform: BasePlatform) {
    this.platforms.set(platform.name, platform);
  }

  getPlatform(name: string): BasePlatform | undefined {
    return this.platforms.get(name);
  }

  /** Tüm kayıtlı adaptörler (yoklayıcı ve yetenek sorguları için). */
  tumu(): BasePlatform[] {
    return [...this.platforms.values()];
  }

  /**
   * Bağlı platformlardaki BOT hesaplarının adları (küçük harf).
   * Anahtar kelime komutunun kendi yanıtıyla yeniden tetiklenmemesi için.
   */
  botKullaniciAdlari(): Set<string> {
    const k = new Set<string>();
    for (const p of this.platforms.values()) {
      const fn = (p as any).botKullaniciAdi;
      if (typeof fn === 'function' && p.isConnected()) {
        const ad = String(fn.call(p) || '').toLowerCase();
        if (ad) k.add(ad);
      }
    }
    return k;
  }

  getAllStatuses(): Record<string, any> {
    const statuses: Record<string, any> = {};
    for (const [name, p] of this.platforms.entries()) {
      statuses[name] = p.getStatus();
    }
    return statuses;
  }

  async connectAll() {
    console.log('[StreamAxT] Initializing active platform connections...');
    for (const [name, platform] of this.platforms.entries()) {
      try {
        await platform.connect();
      } catch (err: any) {
        console.warn(`[StreamAxT] Could not connect platform ${name}:`, err?.message || err);
      }
    }
  }

  async reconnect(name: string): Promise<boolean> {
    const p = this.platforms.get(name);
    if (!p) return false;
    await p.disconnect();
    return await p.connect();
  }

  async disconnect(name: string): Promise<void> {
    const p = this.platforms.get(name);
    if (p) await p.disconnect();
  }

  private setupMessageRouting() {
    // 1. Route bot replies
    eventBus.on('bot_message', async (payload: BotMessagePayload) => {
      // Gönderim sonucu eskiden yutuluyordu: sohbete yazılamadığında panelde
      // hiçbir şey görünmüyor, kullanıcı "mesaj gitmiyor" diyordu. Artık her
      // başarısızlık sebebiyle birlikte panele bildirilir.
      const trySend = async (name: string, p: BasePlatform) => {
        try {
          const ok = await p.sendMessage(payload.channel || '', payload.message);
          if (ok === false) {
            eventBus.emitSendError(name, (p as any).lastSendError || 'Mesaj gönderilemedi.');
          }
        } catch (e: any) {
          eventBus.emitSendError(name, String(e?.message || e));
        }
      };
      if (payload.platform === 'all') {
        const connected = [...this.platforms.entries()].filter(([, p]) => p.isConnected());
        if (!connected.length) {
          eventBus.emitSendError('all', 'Hiçbir platforma bağlı değil — Platformlar sekmesinden bağlan.');
          return;
        }
        for (const [name, p] of connected) await trySend(name, p);
      } else {
        const targetPlatform = this.platforms.get(payload.platform);
        if (!targetPlatform) {
          eventBus.emitSendError(payload.platform, 'Platform tanımlı değil.');
          return;
        }
        if (!targetPlatform.isConnected()) {
          eventBus.emitSendError(payload.platform, 'Platform bağlı değil.');
          return;
        }
        await trySend(payload.platform, targetPlatform);
      }
    });

    // 2. Cross-Chat Relay (broadcasting chat across connected platforms)
    eventBus.on('cross_chat_relay', async ({ originPlatform, text }: { originPlatform: string; originChannel: string; text: string }) => {
      for (const [name, p] of this.platforms.entries()) {
        if (name !== originPlatform && p.isConnected()) {
          try {
            await p.sendMessage('', text);
          } catch (e) {
            seyrekUyar(`aktarim:${name}`, `[Sohbet aktarımı] ${name} kanalına iletilemedi`, e);
          }
        }
      }
    });
  }
}

export const platformManager = new PlatformManager();
export default platformManager;
