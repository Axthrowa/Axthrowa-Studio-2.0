/**
 * Yayın Sonu Özeti: yayın kapanınca sayısal rapor panele düşer. Sohbet dış bir servise gideceği için
 * yapay zekâ özeti yalnız ayar açıksa istenir. Sohbete hiçbir şey yazılmaz.
 * shortcut: defter bellekte, yayın ortasında bot yeniden başlarsa önceki kısım rapora girmez; gerekirse DB'ye taşınır.
 */
import { eventBus, type ChatMessagePayload } from '../../core/event-bus.js';
import { settingsCache } from '../../core/settings-cache.js';
import { seyrekUyar } from '../../core/logger.js';
import { geminiCoHost } from './gemini.js';
import { maddeleriAyikla, ozetIstemi, YayinDefteri, type YayinRaporu } from './yayin-ozeti-saf.js';

const RAPORLAR = 'yayin_ozetleri';
const AI_AYARI = 'ai_yayin_ozeti';
const RAPOR_SINIRI = 10;

export class YayinOzeti {
  private defter = new YayinDefteri();
  private canlilar = new Set<string>();
  private bagli = false;

  raporlar(): YayinRaporu[] {
    try {
      const l = JSON.parse(settingsCache.get(RAPORLAR, '[]'));
      return Array.isArray(l) ? l : [];
    } catch {
      return [];
    }
  }

  aiAcik(): boolean {
    return settingsCache.get(AI_AYARI, 'false') === 'true';
  }

  aiAyarla(acik: boolean): void {
    settingsCache.set(AI_AYARI, acik ? 'true' : 'false');
  }

  sohbet(m: ChatMessagePayload): void {
    if (!m.user.isSelf) this.defter.sohbet(m.user.displayName || m.user.username, String(m.message ?? ''));
  }

  /** Defterden rapor üretip saklar; defter boşsa null */
  async olustur(bitis = Date.now()): Promise<YayinRaporu | null> {
    const defter = this.defter;
    if (defter.bosMu()) return null;
    const rapor = defter.rapor(bitis);
    if (this.aiAcik()) {
      try {
        const yanit = await geminiCoHost.yardimciUret(ozetIstemi(rapor, defter.ornekMetni()), 30_000, 'Yayın özeti');
        rapor.maddeler = maddeleriAyikla(yanit ?? '');
        if (!rapor.maddeler.length) rapor.aiHatasi = 'Yapay zekâ yanıt vermedi; anahtarı kontrol edin';
      } catch (e: any) {
        seyrekUyar('yayin-ozeti:ai', '[Yayın özeti] Yapay zekâ özeti alınamadı', e);
        rapor.aiHatasi = 'Yapay zekâ özeti alınamadı';
      }
    }
    settingsCache.set(RAPORLAR, JSON.stringify([rapor, ...this.raporlar()].slice(0, RAPOR_SINIRI)));
    return rapor;
  }

  baslat(): void {
    if (this.bagli) return;
    this.bagli = true;
    const ad = (p: any) => String(p?.displayName || p?.username || '');
    eventBus.on('follow', (p: any) => void (p?.isTest || this.defter.takipEkle()));
    eventBus.on('sub', (p: any) => void (p?.isTest || this.defter.aboneEkle(p?.count)));
    eventBus.on('tip', (p: any) => void (p?.isTest || this.defter.bagisEkle(p?.amount, p?.currency)));
    eventBus.on('raid', (p: any) => void (p?.isTest || this.defter.baskinEkle(ad(p), p?.viewers)));
    eventBus.on('stream_online', (p: any) => {
      // Çok platformlu yayında defter ilk açılışta başlar, son kapanışta biter
      if (!this.canlilar.size) this.defter = new YayinDefteri();
      this.canlilar.add(String(p?.platform));
    });
    eventBus.on('stream_offline', (p: any) => {
      if (!this.canlilar.delete(String(p?.platform)) || this.canlilar.size) return;
      void this.olustur()
        .catch((e) => seyrekUyar('yayin-ozeti:kayit', '[Yayın özeti] Rapor kaydedilemedi', e))
        .finally(() => {
          // Yeni yayın bu arada başladıysa onun defterine dokunma
          if (!this.canlilar.size) this.defter = new YayinDefteri();
        });
    });
  }
}

export const yayinOzeti = new YayinOzeti();
export default yayinOzeti;
