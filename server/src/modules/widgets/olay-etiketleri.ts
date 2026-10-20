/**
 * StreamAxT — Olay Etiketleri verisi (son takipçi, son abone, son bağış…)
 * Developed by AxthrowA
 *
 * Widget eskiden yalnız açıkken gelen canlı olayları biliyordu: OBS sayfası
 * açılınca (ya da yenilenince) bütün etiketler "—" görünüyordu. Son olaylar
 * artık veritabanından okunur; canlı olaylar üstüne yazar.
 */
import { db } from '../../db/index.js';

export interface EtiketVerisi {
  sonTakip: string | null;
  sonAbone: string | null;
  sonBagis: { ad: string; tutar: number; birim: string } | null;
  enBuyukBagis: { ad: string; tutar: number; birim: string } | null;
  sonRaid: { ad: string; izleyici: number } | null;
  sonKicks: { ad: string; tutar: number } | null;
}

interface Satir {
  event_type: string;
  username: string;
  display_name: string | null;
  amount: number | null;
  currency: string | null;
  metadata: string | null;
  timestamp: number;
}

const ad = (s: Satir) => String(s.display_name || s.username || '').slice(0, 60);

/** Satırlardan (yeniden eskiye) etiket verisi — saf, testli. */
export function etiketleriCikar(satirlar: Satir[]): EtiketVerisi {
  const v: EtiketVerisi = { sonTakip: null, sonAbone: null, sonBagis: null, enBuyukBagis: null, sonRaid: null, sonKicks: null };
  for (const s of satirlar) {
    let meta: any = null;
    try {
      meta = s.metadata ? JSON.parse(s.metadata) : null;
    } catch {
      meta = null;
    }
    if (meta?.isTest) continue; // test uyarıları etiketlere yazılmaz
    const t = s.event_type;
    if ((t === 'follow' || t === 'follower') && !v.sonTakip) v.sonTakip = ad(s);
    else if ((t === 'sub' || t === 'gift_sub' || t === 'subscription') && !v.sonAbone) v.sonAbone = ad(s);
    else if (t === 'tip' || t === 'donation') {
      const b = { ad: ad(s), tutar: Number(s.amount) || 0, birim: String(s.currency || 'TL') };
      if (!v.sonBagis) v.sonBagis = b;
      if (!v.enBuyukBagis || b.tutar > v.enBuyukBagis.tutar) v.enBuyukBagis = b;
    } else if (t === 'raid' && !v.sonRaid) v.sonRaid = { ad: ad(s), izleyici: Number(meta?.viewers ?? s.amount) || 0 };
    else if (t === 'kicks' && !v.sonKicks) v.sonKicks = { ad: ad(s), tutar: Number(s.amount) || 0 };
  }
  return v;
}

export function etiketVerisi(): EtiketVerisi {
  const satirlar = db
    .prepare(
      `SELECT event_type, username, display_name, amount, currency, metadata, timestamp FROM stream_events
       WHERE event_type IN ('follow','follower','sub','gift_sub','subscription','tip','donation','raid','kicks')
       ORDER BY timestamp DESC LIMIT 2000`
    )
    .all() as unknown as Satir[];
  return etiketleriCikar(satirlar);
}
