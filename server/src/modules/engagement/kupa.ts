/**
 * StreamAxT — Bağış Kupası durumu (sunucuda; OBS yenilense de korunur)
 * Developed by AxthrowA
 *
 * Kupaya bağış, abone, hediye abonelik ve KICKs düşer (panelde hangilerinin
 * sayılacağı ve eşikler seçilir). Eskiden durum yalnız OBS sayfasının
 * belleğindeydi: sayfa yenilenince kupa boşalıyordu, panelden sıfırlanamıyordu
 * ve hediye abonelikler adetsiz, sıradan abone gibi düşüyordu.
 */
import { db } from '../../db/index.js';

export type KupaTuru = 'tip' | 'sub' | 'gift_sub' | 'kicks' | 'gift_tiktok';

export interface KupaAyari {
  fromTip: boolean;
  fromSub: boolean;
  fromGift: boolean;
  fromKicks: boolean;
  minTipAmount: number;
  minKicks: number;
  maxItems: number;
}

const DURUM = 'kupa_durumu';
const AYAR = 'widget_settings_the-cup';

export function kupaAyari(ham: any): KupaAyari {
  const s = ham && typeof ham === 'object' ? ham : {};
  const evet = (v: unknown) => v !== false && v !== 'false' && v !== 0;
  return {
    fromTip: evet(s.fromTip),
    fromSub: evet(s.fromSub),
    fromGift: evet(s.fromGift),
    fromKicks: evet(s.fromKicks),
    minTipAmount: Math.max(0, Number(s.minTipAmount) || 0),
    minKicks: Math.max(0, Number(s.minKicks) || 0),
    maxItems: Math.min(300, Math.max(5, Number(s.maxItems) || 45))
  };
}

/** Bu olay kupaya kaç öğe düşürür? (0 = düşmez) */
export function dusenAdet(tur: string, veri: { amount?: number; count?: number }, a: KupaAyari): number {
  switch (tur) {
    case 'tip':
      return a.fromTip && Number(veri.amount || 0) >= a.minTipAmount ? 1 : 0;
    case 'kicks':
      return a.fromKicks && Number(veri.amount || 0) >= a.minKicks ? 1 : 0;
    case 'sub':
      return a.fromSub ? 1 : 0;
    case 'gift_sub':
    case 'gift_tiktok':
      return a.fromGift ? Math.min(20, Math.max(1, Math.floor(Number(veri.count) || 1))) : 0;
    default:
      return 0;
  }
}

class Kupa {
  private ogeler: KupaTuru[] | null = null;

  private ayarOku(): KupaAyari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR) as { value?: string } | undefined;
      return kupaAyari(JSON.parse(r?.value || '{}'));
    } catch {
      return kupaAyari({});
    }
  }

  liste(): KupaTuru[] {
    if (this.ogeler) return this.ogeler;
    const gecerli = new Set<string>(['tip', 'sub', 'gift_sub', 'kicks', 'gift_tiktok']);
    let l: KupaTuru[] = [];
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(DURUM) as { value?: string } | undefined;
      const j = JSON.parse(r?.value || '[]');
      if (Array.isArray(j)) l = j.filter((x): x is KupaTuru => typeof x === 'string' && gecerli.has(x)).slice(-300);
    } catch {
      /* bozuk kayıt: boş kupa */
    }
    this.ogeler = l;
    return l;
  }

  private yaz() {
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(
      DURUM,
      JSON.stringify(this.liste())
    );
  }

  /** Olayı işler; düşen öğe sayısını döndürür (yayını çağıran yapar). */
  dus(tur: string, veri: { amount?: number; count?: number }): number {
    const a = this.ayarOku();
    const adet = dusenAdet(tur, veri, a);
    if (!adet) return 0;
    const l = this.liste();
    for (let i = 0; i < adet; i++) l.push(tur as KupaTuru);
    this.ogeler = l.slice(-a.maxItems);
    this.yaz();
    return adet;
  }

  sifirla() {
    this.ogeler = [];
    this.yaz();
  }
}

export const kupa = new Kupa();
