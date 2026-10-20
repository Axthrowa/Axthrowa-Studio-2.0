/**
 * StreamAxT — zamanlayıcılar (aralıklı sohbet mesajları)
 * Developed by AxthrowA
 *
 * Tek bir 5 sn'lik tik tüm zamanlayıcıları denetler; kararlar zamanlama.ts'te.
 */
import { db } from '../../db/index.js';
import { eventBus } from '../../core/event-bus.js';
import { seyrekUyar } from '../../core/logger.js';
import {
  aralikMs,
  baslangicZamani,
  gonderilmeli,
  mesajlariAyikla,
  minSatir,
  type ZamanlayiciDurumu,
  type ZamanlayiciKaydi
} from './zamanlama.js';

interface Calisan extends ZamanlayiciKaydi {
  ad: string;
  mesajlar: string[];
  durum: ZamanlayiciDurumu;
}

const TIK_MS = 5000;

export class TimerManager {
  private calisanlar = new Map<string, Calisan>();
  private tik: NodeJS.Timeout | null = null;

  constructor() {
    // Her zamanlayıcı kendi satır sayacını tutar; botun kendi mesajı sayılmaz
    eventBus.on('chat', (p: any) => {
      if (p?.user?.isSelf) return;
      for (const c of this.calisanlar.values()) c.durum.satir++;
    });
  }

  startAll() {
    const simdi = Date.now();
    const eski = this.calisanlar;
    this.calisanlar = new Map();
    let satirlar: any[] = [];
    try {
      satirlar = db.prepare('SELECT * FROM timers WHERE is_enabled = 1').all() as any[];
    } catch (e) {
      seyrekUyar('timers:oku', '[Zamanlayıcı] Zamanlayıcılar okunamadı', e);
    }
    for (const t of satirlar) {
      const mesajlar = mesajlariAyikla(t.messages);
      if (!mesajlar.length) continue;
      const onceki = eski.get(t.id);
      this.calisanlar.set(t.id, {
        id: t.id,
        ad: String(t.name || ''),
        aralikDk: t.interval_minutes,
        minSatir: t.min_chat_lines,
        yalnizYayinda: Number(t.only_live) === 1,
        mesajlar,
        // Panelden kaydetmek (reload) sayaç ve sırayı sıfırlamasın
        durum: onceki
          ? { ...onceki.durum, sira: onceki.durum.sira % mesajlar.length }
          : { son: baslangicZamani(t.last_run_at, t.interval_minutes, simdi), satir: 0, sira: 0 }
      });
    }
    if (!this.tik) {
      this.tik = setInterval(() => void this.denetle(), TIK_MS);
      this.tik.unref?.();
    }
  }

  stopAll() {
    if (this.tik) clearInterval(this.tik);
    this.tik = null;
    this.calisanlar.clear();
  }

  private async canliMi(): Promise<boolean | null> {
    try {
      const { canliDurum } = await import('../../core/live-status.js');
      return canliDurum.genel().canli;
    } catch {
      return null;
    }
  }

  private async denetle() {
    if (!this.calisanlar.size) return;
    const simdi = Date.now();
    const canli = await this.canliMi();
    for (const c of this.calisanlar.values()) {
      if (!gonderilmeli(c, c.durum, simdi, canli)) continue;
      const ham = c.mesajlar[c.durum.sira % c.mesajlar.length];
      c.durum = { son: simdi, satir: 0, sira: (c.durum.sira + 1) % c.mesajlar.length };
      try {
        eventBus.emitBotMessage({ platform: 'all', message: await this.degiskenleriCoz(ham, c.ad) });
        db.prepare('UPDATE timers SET last_run_at = ? WHERE id = ?').run(simdi, c.id);
      } catch (e) {
        seyrekUyar('timers:gonder', `[Zamanlayıcı] "${c.ad}" gönderilemedi`, e);
      }
    }
  }

  /** `$(...)` değişkenleri eskiden çözülmüyordu, olduğu gibi gönderiliyordu. */
  private async degiskenleriCoz(metin: string, ad: string): Promise<string> {
    if (!metin.includes('$(')) return metin;
    try {
      const { baglamOlustur, degiskenleriCoz } = await import('../../core/variables/index.js');
      const sahte: any = {
        platform: 'kick',
        channel: '',
        user: { username: 'zamanlayici', displayName: 'Zamanlayıcı', isBroadcaster: true },
        message: '',
        timestamp: Date.now()
      };
      return (await degiskenleriCoz(metin, baglamOlustur(sahte, [], `timer:${ad}`))) || metin;
    } catch {
      return metin;
    }
  }

  /** Panel için: sonraki gönderime kalan süre ve bekleyen satır sayısı */
  durumlar(): Array<{ id: string; kalanSn: number; satir: number; minSatir: number }> {
    const simdi = Date.now();
    return [...this.calisanlar.values()].map((c) => ({
      id: c.id,
      kalanSn: Math.max(0, Math.ceil((c.durum.son + aralikMs(c.aralikDk) - simdi) / 1000)),
      satir: c.durum.satir,
      minSatir: minSatir(c.minSatir)
    }));
  }

  reload() {
    this.startAll();
  }
}

export const timerManager = new TimerManager();
export default timerManager;
