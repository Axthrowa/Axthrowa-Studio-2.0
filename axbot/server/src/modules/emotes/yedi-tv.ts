/**
 * AxBoT — 7TV emote'ları (herkese açık 7tv.io v3 API'si)
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
  /** Hareketli emote'un ilk karesi ("animasyonlu emote'u dondur", WID-4) */
  statik?: string;
}

export interface YediTvDurum {
  kanal: YediTvEmote[];
  genel: YediTvEmote[];
  /** BTTV ve FFZ genel setleri: katmanlar dış adrese gitmesin diye sunucuda önbellekte (F0-4) */
  bttv: YediTvEmote[];
  ffz: YediTvEmote[];
  /** Kanala özgü BTTV (kanal + paylaşılan) ve FFZ setleri (WID-4; Twitch kanalı gerekir) */
  bttvKanal: YediTvEmote[];
  ffzKanal: YediTvEmote[];
  /** 7TV kanal setinin kimliği: set değişince EventAPI'den haber gelir */
  kanalSetId: string | null;
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
    const animasyonlu = Boolean(e?.data?.animated);
    out.push({ ad, url: `https://cdn.7tv.app/emote/${m[1]}/2x.webp`, animasyonlu, ...(animasyonlu ? { statik: `https://cdn.7tv.app/emote/${m[1]}/2x_static.webp` } : {}) });
  }
  return out;
}

/** BTTV genel seti: [{ id, code }] → yalnız cdn.betterttv.net adresleri */
export function bttvAyikla(liste: unknown): YediTvEmote[] {
  return (Array.isArray(liste) ? liste : [])
    .filter((e) => typeof e?.code === 'string' && e.code.length <= 60 && /^[0-9a-f]{24}$/.test(String(e?.id)))
    .slice(0, EN_COK)
    .map((e) => {
      const animasyonlu = e.imageType === 'gif' || Boolean(e.animated);
      // static/ yalnız hareketli emote'ta var (durağanda 404)
      return { ad: e.code, url: `https://cdn.betterttv.net/emote/${e.id}/2x`, animasyonlu, ...(animasyonlu ? { statik: `https://cdn.betterttv.net/emote/${e.id}/static/2x.webp` } : {}) };
    });
}

/** BTTV kanal yanıtı: { channelEmotes, sharedEmotes } */
export function bttvKanalAyikla(d: any): YediTvEmote[] {
  return bttvAyikla([...(Array.isArray(d?.channelEmotes) ? d.channelEmotes : []), ...(Array.isArray(d?.sharedEmotes) ? d.sharedEmotes : [])]);
}

/** Twitch kullanıcı adı (adrese yazılır: yalnız Twitch'in izin verdiği karakterler) */
export const TWITCH_ADI = /^[a-z0-9_]{2,25}$/;

/** FFZ seti: { sets: { <kimlik>: { emoticons: [{ name, urls: { '2': adres } }] } } } → yalnız cdn.frankerfacez.com (genel ve oda yanıtı aynı biçim) */
export function ffzAyikla(g: any): YediTvEmote[] {
  const out: YediTvEmote[] = [];
  for (const set of Object.values(g?.sets || {}) as any[]) {
    for (const e of Array.isArray(set?.emoticons) ? set.emoticons : []) {
      if (out.length >= EN_COK) return out;
      const url = String(e?.urls?.['2'] || e?.urls?.['1'] || '');
      if (typeof e?.name === 'string' && e.name.length <= 60 && /^https:\/\/cdn\.frankerfacez\.com\/[\w/.-]+$/.test(url)) out.push({ ad: e.name, url, animasyonlu: Boolean(e?.animated) });
    }
  }
  return out;
}

class YediTv {
  private durum: YediTvDurum = { kanal: [], genel: [], bttv: [], ffz: [], bttvKanal: [], ffzKanal: [], kanalSetId: null, kanalDurum: 'kapali', guncellendi: 0 };
  private twitchAdi: string | null = null;
  private yukleniyor: Promise<YediTvDurum> | null = null;

  /** Önbellekten döner; süresi dolduysa arka planda yeniler. */
  async getir(kanalSlug: string | null, zorla = false, twitchAdi?: string | null): Promise<YediTvDurum> {
    if (twitchAdi !== undefined) {
      const ad = twitchAdi ? twitchAdi.replace(/^#/, '').toLowerCase() : null;
      if (ad !== this.twitchAdi) zorla = true;
      this.twitchAdi = ad && TWITCH_ADI.test(ad) ? ad : null;
    }
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

  /** Son bilinen durum (EventAPI aboneliği ve sınama için) */
  sonDurum(): YediTvDurum {
    return this.durum;
  }

  /** ad → görsel adresi (kanal seti genel seti ezer). */
  harita(): ReadonlyMap<string, string> {
    return this.haritaOnbellek;
  }

  private async yukle(kanalSlug: string | null): Promise<YediTvDurum> {
    const opts = { timeout: 15_000, httpsAgent: AJAN, headers: { Accept: 'application/json' } };
    // Genel setler alınamazsa eldekiyle devam
    const [genel, bttv, ffz] = await Promise.all([
      axios.get(`${API}/emote-sets/global`, opts).then((r) => yediTvAyikla(r.data), () => this.durum.genel),
      axios.get('https://api.betterttv.net/3/cached/emotes/global', opts).then((r) => bttvAyikla(r.data), () => this.durum.bttv),
      axios.get('https://api.frankerfacez.com/v1/set/global', opts).then((r) => ffzAyikla(r.data), () => this.durum.ffz)
    ]);

    // Twitch kanalı: FFZ odası Twitch kimliğini de verir; BTTV ve (Kick yoksa) 7TV kanal seti bununla bulunur
    let ffzKanal: YediTvEmote[] = this.durum.ffzKanal;
    let bttvKanal: YediTvEmote[] = this.durum.bttvKanal;
    let twitchKimlik = '';
    if (this.twitchAdi) {
      const oda = await axios.get(`https://api.frankerfacez.com/v1/room/${this.twitchAdi}`, { ...opts, validateStatus: (s) => s === 200 || s === 404 }).catch(() => null);
      if (oda?.status === 200) {
        ffzKanal = ffzAyikla(oda.data);
        twitchKimlik = /^\d{1,20}$/.test(String(oda.data?.room?.twitch_id)) ? String(oda.data.room.twitch_id) : '';
      } else if (oda?.status === 404) ffzKanal = [];
      if (twitchKimlik) {
        const b = await axios.get(`https://api.betterttv.net/3/cached/users/twitch/${twitchKimlik}`, { ...opts, validateStatus: (s) => s === 200 || s === 404 }).catch(() => null);
        if (b?.status === 200) bttvKanal = bttvKanalAyikla(b.data);
        else if (b?.status === 404) bttvKanal = [];
      }
    } else {
      ffzKanal = [];
      bttvKanal = [];
    }

    let kanal: YediTvEmote[] = [];
    let kanalSetId: string | null = null;
    let kanalDurum = 'kanal-yok';
    if (!kanalSlug && twitchKimlik) {
      try {
        const r = await axios.get(`${API}/users/twitch/${twitchKimlik}`, { ...opts, validateStatus: (s) => s === 200 || s === 404 });
        if (r.status === 404) kanalDurum = 'hesap-yok';
        else {
          kanal = yediTvAyikla(r.data?.emote_set);
          kanalSetId = typeof r.data?.emote_set?.id === 'string' ? r.data.emote_set.id : null;
          kanalDurum = 'ok';
        }
      } catch {
        kanalDurum = 'hata';
      }
    }
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
            kanalSetId = typeof r.data?.emote_set?.id === 'string' ? r.data.emote_set.id : null;
            kanalDurum = 'ok';
          }
        }
      } catch {
        kanalDurum = 'hata';
      }
    }
    this.durum = { kanal, genel, bttv, ffz, bttvKanal, ffzKanal, kanalSetId, kanalDurum, guncellendi: Date.now() };
    // Öncelik (sonra gelen ezer): FFZ < BTTV < FFZ kanal < BTTV kanal < 7TV genel < 7TV kanal
    const h = new Map<string, string>();
    for (const e of [...ffz, ...bttv, ...ffzKanal, ...bttvKanal, ...genel, ...kanal]) h.set(e.ad, e.url);
    this.haritaOnbellek = h;
    return this.durum;
  }
}

export const yediTv = new YediTv();

/** Bağlı Kick ve Twitch kanallarıyla getirir (Kick 7TV seti, Twitch BTTV/FFZ kanal setleri) */
export async function kanallarlaGetir(zorla = false): Promise<YediTvDurum> {
  const [{ kickPlatform }, { twitchPlatform }] = await Promise.all([import('../../platforms/kick.js'), import('../../platforms/twitch.js')]);
  const d = await yediTv.getir(kickPlatform.getStatus().channel || null, zorla, twitchPlatform.getStatus().channel || null);
  // Set değişikliği canlı izlenir (sınamada dış bağlantı açılmaz)
  if (!process.env.VITEST) void import('./yedi-tv-canli.js').then((m) => m.yediTvSetiniIzle(d.kanalSetId)).catch(() => {});
  return d;
}
