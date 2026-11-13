/**
 * Otomasyon motoru: olayları dinler, uyan kuralların eylemlerini sırayla çalıştırır.
 * Kurallar `bot_settings`te tutulur. "Dene" hiçbir eylemi çalıştırmaz, yalnız ne olacağını söyler.
 */
import axios from 'axios';
import { db } from '../../db/index.js';
import { eventBus, type ChatMessagePayload } from '../../core/event-bus.js';
import { settingsCache } from '../../core/settings-cache.js';
import { seyrekUyar } from '../../core/logger.js';
import { muzikHost } from '../muzik/index.js';
import { EN_COK_KURAL, EN_COK_SIRA, eylemAciklamasi, kosulEngeli, kuralDuzelt, metniDoldur, ONCEKI_SAHNE, PatlamaSayaci, tetikUyar, type Eylem, type Kural, type Olay } from './kural.js';
import { shoutoutGonder } from './shoutout.js';

const ANAHTAR = 'otomasyon_kurallari';
const GUNLUK_SINIRI = 50;

export interface GunlukSatiri {
  zaman: number;
  kural: string;
  ok: boolean;
  mesaj: string;
}

/** Sohbette ve ekranda görünen platform: olaydan, yoksa ilk etkin kanaldan */
function ilkKanal(): { platform: string; kanal: string } | null {
  const r = db.prepare('SELECT platform, channel_name FROM channels WHERE is_active = 1 LIMIT 1').get() as { platform: string; channel_name: string } | undefined;
  return r ? { platform: r.platform, kanal: r.channel_name } : null;
}

export class Otomasyon {
  private sonHam: string | null = null;
  private liste: Kural[] = [];
  private sonCalisma = new Map<string, number>();
  private patlamalar = new Map<string, PatlamaSayaci>();
  private gunluk: GunlukSatiri[] = [];
  private bagli = false;
  /** B7: sıralı kuralların bekleyen işleri */
  private siralar = new Map<string, { bekleyen: number; zincir: Promise<void> }>();

  kurallar(): Kural[] {
    const ham = settingsCache.get(ANAHTAR, '[]');
    if (ham === this.sonHam) return this.liste;
    this.sonHam = ham;
    try {
      const okunan = JSON.parse(ham);
      this.liste = (Array.isArray(okunan) ? okunan : []).flatMap((k) => {
        const r = kuralDuzelt(k);
        return r.ok ? [r.kural] : [];
      });
    } catch (e) {
      seyrekUyar('otomasyon:okuma', '[Otomasyon] Kurallar okunamadı', e);
      this.liste = [];
    }
    return this.liste;
  }

  /** Bütün listeyi doğrulayıp yazar; bozuk kural varsa hiçbiri yazılmaz */
  kaydet(ham: unknown): { ok: true; kurallar: Kural[] } | { ok: false; hata: string } {
    if (!Array.isArray(ham)) return { ok: false, hata: 'Kural listesi geçersiz' };
    if (ham.length > EN_COK_KURAL) return { ok: false, hata: `En çok ${EN_COK_KURAL} kural olabilir` };
    const kurallar: Kural[] = [];
    for (const k of ham) {
      const r = kuralDuzelt(k);
      if (!r.ok) return r;
      kurallar.push(r.kural);
    }
    settingsCache.set(ANAHTAR, JSON.stringify(kurallar));
    this.patlamalar.clear();
    return { ok: true, kurallar: this.kurallar() };
  }

  gunlukOku(): GunlukSatiri[] {
    return this.gunluk;
  }

  private yaz(kural: string, ok: boolean, mesaj: string) {
    this.gunluk = [{ zaman: Date.now(), kural, ok, mesaj: mesaj.slice(0, 300) }, ...this.gunluk].slice(0, GUNLUK_SINIRI);
  }

  /** Hiçbir yan etki yok: koşul sonucu ve çalışacak adımlar */
  async dene(ham: unknown, ornek: Partial<Olay> = {}): Promise<{ ok: true; uyar: boolean; engel: string | null; adimlar: string[] } | { ok: false; hata: string }> {
    const r = kuralDuzelt(ham);
    if (!r.ok) return r;
    const k = r.kural;
    const olay = ornekOlay(k, ornek);
    return {
      ok: true,
      uyar: tetikUyar(k.tetik, olay),
      engel: kosulEngeli(k.kosullar, olay, await this.durum(k, olay)),
      adimlar: k.eylemler.map((e) => eylemAciklamasi(e, olay)),
    };
  }

  private async durum(k: Kural, o: Olay): Promise<{ puan: number; canli: boolean | null }> {
    let puan = 0;
    let canli: boolean | null = null;
    if (k.kosullar.some((c) => c.tur === 'en_az_puan') && o.kullanici) {
      const { economy } = await import('../economy/economy.js');
      puan = Number(economy.getUser(o.platform || 'kick', o.kullanici)?.points) || 0;
    }
    if (k.kosullar.some((c) => c.tur === 'canli')) {
      const { yayinAcikMi } = await import('../../core/variable-parser.js');
      canli = yayinAcikMi();
    }
    return { puan, canli };
  }

  /**
   * B7 "Çalıştır": kuralı örnek olayla GERÇEKTEN çalıştırır (koşul ve bekleme atlanır). Kaydedilmemiş kural da olur.
   * Sohbet, OBS, Discord eylemleri gerçekten yapılır; panel bunu onayla sorar.
   */
  async calistir(ham: unknown, ornek: Partial<Olay> = {}): Promise<{ ok: boolean; mesaj: string }> {
    const r = kuralDuzelt(ham);
    if (!r.ok) return { ok: false, mesaj: r.hata };
    return this.eylemleriCalistir(r.kural, ornekOlay(r.kural, ornek));
  }

  /** Kuralın eylemleri (sıralı ya da rastgele biri); sonuç günlüğe yazılır */
  private async eylemleriCalistir(k: Kural, o: Olay): Promise<{ ok: boolean; mesaj: string }> {
    const baglam: Baglam = {};
    const eylemler = k.kip === 'rastgele' ? [k.eylemler[Math.floor(Math.random() * k.eylemler.length)]] : k.eylemler;
    try {
      for (const e of eylemler) await this.eylem(e, o, baglam);
      const mesaj = k.kip === 'rastgele' ? `Rastgele seçilen: ${eylemAciklamasi(eylemler[0], o)}` : `${eylemler.length} eylem çalıştı`;
      this.yaz(k.ad, true, mesaj);
      return { ok: true, mesaj };
    } catch (e: any) {
      const mesaj = String(e?.message || e);
      this.yaz(k.ad, false, mesaj);
      return { ok: false, mesaj };
    }
  }

  /** Studio'daki o anki program sahnesi; okunamazsa boş */
  private async simdikiSahne(): Promise<string> {
    const adres = muzikHost.hariciAdres();
    if (!adres) return '';
    try {
      const r = await axios.get(`${adres}/api/obs/kumanda`, { timeout: 5000 });
      return String(r.data?.currentScene || '');
    } catch {
      return '';
    }
  }

  /** Tek eylem. Hata fırlatabilir: kuralın kalan adımları o zaman çalışmaz. */
  private async eylem(e: Eylem, o: Olay, baglam: Baglam = {}): Promise<void> {
    const platform = o.platform || 'all';
    switch (e.tur) {
      case 'sohbet':
        eventBus.emitBotMessage({ platform: platform as any, message: metniDoldur(e.metin, o) });
        return;
      case 'tts':
      case 'pano_oynat':
      case 'sarki_atla':
      case 'sohbet_temizle':
      case 'kalkan':
      case 'komut': {
        const { sesliKomutlar } = await import('../sesli/sesli.js');
        await sesliKomutlar.calistir(e.tur === 'tts' ? { tur: 'tts', metin: metniDoldur(e.metin, o) } : e);
        return;
      }
      case 'shoutout':
        await shoutoutGonder(metniDoldur(e.kanal, o).replace(/^@/, ''), o.platform || ilkKanal()?.platform || 'kick');
        return;
      case 'obs_sahne': {
        if (e.sahne.trim() === ONCEKI_SAHNE) {
          if (!baglam.onceki) throw new Error('Önceki sahne bilinmiyor: kuralda önce bir sahneye geçilmeli (Studio sahneyi okuyamadı)');
          return this.yyaEylemi('scene.switch', { scene: baglam.onceki });
        }
        // Kuralın ilk sahne değişiminden önceki sahne hatırlanır: "10 sn sonra geri dön"
        if (baglam.onceki === undefined) baglam.onceki = await this.simdikiSahne();
        return this.yyaEylemi('scene.switch', { scene: metniDoldur(e.sahne, o) });
      }
      case 'replay':
        return this.yyaEylemi('replay.save', {});
      case 'klip': {
        const { klipYoneticisi } = await import('../clips/klip.js');
        const r = await klipYoneticisi.baslat(o.platform || ilkKanal()?.platform || 'kick', 'Otomasyon', e.saniye, (m) => this.yaz('Klip', true, m));
        if (!r.ok) throw new Error(r.sebep === 'yayin-yok' ? 'Klip yalnız yayın açıkken alınır' : r.sebep === 'mesgul' ? 'Başka bir klip kaydediliyor' : r.sebep === 'ffmpeg-yok' ? 'ffmpeg bulunamadı' : r.hata || 'Klip alınamadı');
        return;
      }
      case 'discord': {
        const { discordDuyuru } = await import('../integrations/discord-announce.js');
        await discordDuyuru.metinGonder(metniDoldur(e.metin, o));
        return;
      }
      case 'bekle':
        await new Promise((r) => setTimeout(r, e.saniye * 1000));
        return;
    }
  }

  /** OBS denetimi AxthrowA Studio'da: yalnız bu bilinçli seçilmiş eylemler gönderilir (yayını bitirme gibi onaylılar yok) */
  private async yyaEylemi(id: 'scene.switch' | 'replay.save', params: Record<string, string>): Promise<void> {
    const adres = muzikHost.hariciAdres();
    if (!adres) throw new Error("OBS için AxthrowA Studio açık olmalı");
    try {
      await axios.post(`${adres}/api/actions/run`, { id, params, confirm: false }, { timeout: 10_000 });
    } catch (e: any) {
      throw new Error(String(e?.response?.data?.error || e?.response?.data || e?.message || e).slice(0, 160));
    }
  }

  /** Olay kuralların hepsine sorulur; uyanlar birbirini beklemeden çalışır */
  async olay(o: Olay, simdi = Date.now()): Promise<void> {
    await Promise.all(
      this.kurallar()
        .filter((k) => k.etkin && tetikUyar(k.tetik, o))
        .map((k) => this.dene1(k, o, simdi))
    );
  }

  private async dene1(k: Kural, o: Olay, simdi: number): Promise<void> {
    if (k.tetik.tur === 'patlama') {
      const s = this.patlamalar.get(k.id) ?? new PatlamaSayaci();
      this.patlamalar.set(k.id, s);
      if (!s.ekle(simdi, k.tetik.mesaj, k.tetik.saniye)) return;
    }
    if (k.sira) return this.sirayaKoy(k, o);
    if (simdi - (this.sonCalisma.get(k.id) ?? -Infinity) < k.beklemeSn * 1000) return;
    // Bekleme önce yazılır: koşul okunurken gelen ikinci olay kuralı iki kez çalıştırmasın
    const onceki = this.sonCalisma.get(k.id);
    this.sonCalisma.set(k.id, simdi);
    try {
      const engel = kosulEngeli(k.kosullar, o, await this.durum(k, o));
      if (engel) {
        // Koşulu tutmayan olay beklemeyi harcamaz
        if (onceki === undefined) this.sonCalisma.delete(k.id);
        else this.sonCalisma.set(k.id, onceki);
        return;
      }
    } catch (e: any) {
      this.yaz(k.ad, false, String(e?.message || e));
      return;
    }
    await this.eylemleriCalistir(k, o);
  }

  /**
   * B7 kural sırası: olaylar atılmaz, birbirinin üstüne binmez. Her iş öncekinin bitmesini ve
   * bekleme süresini bekler; sırada en çok EN_COK_SIRA iş durur, fazlası atılır.
   */
  private sirayaKoy(k: Kural, o: Olay): Promise<void> {
    const s = this.siralar.get(k.id) ?? { bekleyen: 0, zincir: Promise.resolve() };
    this.siralar.set(k.id, s);
    if (s.bekleyen >= EN_COK_SIRA) {
      this.yaz(k.ad, false, `Sıra dolu (${EN_COK_SIRA}); olay atıldı`);
      return Promise.resolve();
    }
    s.bekleyen++;
    const is = s.zincir.then(async () => {
      try {
        const engel = kosulEngeli(k.kosullar, o, await this.durum(k, o));
        if (engel) return;
        const kalan = (this.sonCalisma.get(k.id) ?? -Infinity) + k.beklemeSn * 1000 - Date.now();
        if (kalan > 0) await new Promise((r) => setTimeout(r, kalan));
        this.sonCalisma.set(k.id, Date.now());
        await this.eylemleriCalistir(k, o);
      } catch (e: any) {
        this.yaz(k.ad, false, String(e?.message || e));
      } finally {
        s.bekleyen--;
      }
    });
    s.zincir = is;
    return is;
  }

  /** Süzgeçlerden geçmiş sohbet mesajı (pipeline çağırır); botun kendi yazdığı sayılmaz */
  sohbet(m: ChatMessagePayload): void {
    if (m.user.isSelf) return;
    const ortak = { platform: m.platform, kullanici: m.user.displayName || m.user.username, mesaj: m.message, mod: m.user.isMod || m.user.isBroadcaster, abone: m.user.isSub };
    void this.olay({ ...ortak, tur: 'patlama' });
    if (String(m.message).trim().startsWith('!')) void this.olay({ ...ortak, tur: 'komut' });
  }

  baslat(): void {
    if (this.bagli) return;
    this.bagli = true;
    const ad = (p: any) => p?.displayName || p?.username;
    eventBus.on('follow', (p: any) => void (p?.isTest ? 0 : this.olay({ tur: 'takip', platform: p.platform, kullanici: ad(p) })));
    eventBus.on('sub', (p: any) => void (p?.isTest ? 0 : this.olay({ tur: 'abone', platform: p.platform, kullanici: ad(p), miktar: p.count ?? p.months })));
    eventBus.on('tip', (p: any) => void (p?.isTest ? 0 : this.olay({ tur: 'bagis', platform: p.platform, kullanici: ad(p), miktar: p.amount, mesaj: p.message })));
    eventBus.on('raid', (p: any) => void (p?.isTest ? 0 : this.olay({ tur: 'baskin', platform: p.platform, kullanici: ad(p), miktar: p.viewers })));
    eventBus.on('loyalty_redeemed', (p: any) => void this.olay({ tur: 'odul', kullanici: p?.user, odul: p?.rewardTitle, miktar: p?.cost, mesaj: p?.payload }));
    // Süreli kurallar: ilk çalışma bir aralık sonra, açılışta hepsi birden çalışmasın
    const acilis = Date.now();
    setInterval(() => {
      const simdi = Date.now();
      for (const k of this.kurallar()) {
        if (!k.etkin || k.tetik.tur !== 'sure') continue;
        const son = this.sonCalisma.get(k.id) ?? acilis;
        if (simdi - son >= k.tetik.dakika * 60_000) void this.dene1(k, { tur: 'sure' }, simdi);
      }
    }, 15_000).unref?.();
  }
}

type Baglam = { onceki?: string };

/** "Dene" ve "Çalıştır" için tetiğe uygun örnek olay */
function ornekOlay(k: Kural, ornek: Partial<Olay>): Olay {
  return { kullanici: 'ornek_izleyici', platform: 'kick', miktar: 100, mesaj: k.tetik.tur === 'komut' ? `!${k.tetik.komut} merhaba` : 'merhaba', odul: k.tetik.tur === 'odul' ? k.tetik.odul : '', ...ornek, tur: k.tetik.tur };
}

export const otomasyon = new Otomasyon();
export default otomasyon;
