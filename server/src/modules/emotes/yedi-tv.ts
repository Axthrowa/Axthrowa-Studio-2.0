/**
 * StreamAxT — 7TV emote'ları (herkese açık 7tv.io v3 API'si)
 * Developed by AxthrowA
 *
 * Kanalın 7TV seti (Kick kullanıcı kimliğiyle) + 7TV genel seti okunur;
 * sohbet katmanı, panel sohbeti ve kappagen bu adları görsele çevirir.
 * Yalnız okuma; anahtar/giriş gerekmez. Adres yalnız sabit 7tv.io'dur
 * (kullanıcı girdisinden URL kurulmaz → SSRF yok). Görsel adresi yalnız
 * `cdn.7tv.app/emote/<kimlik>` biçimindeyse kabul edilir.
 */
import axios from 'axios';
import https from 'https';

export interface YediTvEmote {
  ad: string;
  url: string;
  animasyonlu: boolean;
}

export interface YediTvDurum {
  kanal: YediTvEmote[];
  genel: YediTvEmote[];
  /** Kanal setinin durumu: 'ok' | 'hesap-yok' | 'kanal-yok' | 'hata' | 'kapali' */
  kanalDurum: string;
  guncellendi: number;
}

const API = 'https://7tv.io/v3';
const ONBELLEK_MS = 30 * 60_000;
const HATA_ONBELLEK_MS = 5 * 60_000;
const EN_COK = 2000;
// Bu makinede 7tv.io'ya IPv6 yolu ~15 sn sürüyor (IPv4 ~3 sn); arka plan isteği IPv4'e sabit
const AJAN = new https.Agent({ family: 4, keepAlive: false });

/** 7TV set yanıtından güvenli emote listesi. */
export function yediTvAyikla(set: any): YediTvEmote[] {
  const liste = Array.isArray(set?.emotes) ? set.emotes : [];
  const out: YediTvEmote[] = [];
  const gorulen = new Set<string>();
  for (const e of liste) {
    if (out.length >= EN_COK) break;
    const ad = String(e?.name ?? '').trim();
    const host = String(e?.data?.host?.url ?? '');
    const m = host.match(/^(?:https?:)?\/\/cdn\.7tv\.app\/emote\/([A-Za-z0-9]{10,40})$/);
    if (!ad || ad.length > 60 || /\s/.test(ad) || !m || gorulen.has(ad)) continue;
    gorulen.add(ad);
    out.push({ ad, url: `https://cdn.7tv.app/emote/${m[1]}/2x.webp`, animasyonlu: Boolean(e?.data?.animated) });
  }
  return out;
}

class YediTv {
  private durum: YediTvDurum = { kanal: [], genel: [], kanalDurum: 'kapali', guncellendi: 0 };
  private yukleniyor: Promise<YediTvDurum> | null = null;

  /** Önbellekten döner; süresi dolduysa arka planda yeniler. */
  async getir(kanalSlug: string | null, zorla = false): Promise<YediTvDurum> {
    const yas = Date.now() - this.durum.guncellendi;
    const sure = this.durum.kanalDurum === 'hata' ? HATA_ONBELLEK_MS : ONBELLEK_MS;
    if (!zorla && this.durum.guncellendi && yas < sure) return this.durum;
    if (!this.yukleniyor) {
      this.yukleniyor = this.yukle(kanalSlug).finally(() => (this.yukleniyor = null));
    }
    return this.yukleniyor;
  }

  private haritaOnbellek: Map<string, string> = new Map();

  /** Son bilinen ad kümesi (eşzamanlı; bingo için). */
  adlar(): string[] {
    return [...this.haritaOnbellek.keys()];
  }

  /** ad → görsel adresi (kanal seti genel seti ezer). */
  harita(): ReadonlyMap<string, string> {
    return this.haritaOnbellek;
  }

  private async yukle(kanalSlug: string | null): Promise<YediTvDurum> {
    const opts = { timeout: 15_000, httpsAgent: AJAN, headers: { Accept: 'application/json' } };
    let genel = this.durum.genel;
    try {
      genel = yediTvAyikla((await axios.get(`${API}/emote-sets/global`, opts)).data);
    } catch {
      /* genel set alınamadı: eldekiyle devam */
    }

    let kanal: YediTvEmote[] = [];
    let kanalDurum = 'kanal-yok';
    if (kanalSlug) {
      try {
        const { kickPlatform } = await import('../../platforms/kick.js');
        const profil: any = await kickPlatform.profil(kanalSlug);
        const kimlik = Number(profil?.user_id ?? profil?.user?.id);
        if (!Number.isInteger(kimlik) || kimlik <= 0) {
          kanalDurum = 'kanal-yok';
        } else {
          const r = await axios.get(`${API}/users/kick/${kimlik}`, { ...opts, validateStatus: (s) => s === 200 || s === 404 });
          if (r.status === 404) kanalDurum = 'hesap-yok';
          else {
            kanal = yediTvAyikla(r.data?.emote_set);
            kanalDurum = 'ok';
          }
        }
      } catch {
        kanalDurum = 'hata';
      }
    }
    this.durum = { kanal, genel, kanalDurum, guncellendi: Date.now() };
    const h = new Map<string, string>();
    for (const e of [...genel, ...kanal]) h.set(e.ad, e.url);
    this.haritaOnbellek = h;
    return this.durum;
  }
}

export const yediTv = new YediTv();
