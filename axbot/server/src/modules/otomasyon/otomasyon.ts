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
import { EN_COK_DAL_DERINLIGI, EN_COK_KURAL, EN_COK_KUYRUK, EN_COK_SIRA, eylemAciklamasi, jsonKodla, kosulEngeli, kuralDuzelt, kuyrukDuzelt, metniDoldur, ONCEKI_SAHNE, PatlamaSayaci, tetikUyar, tumEylemler, urlKodla, type Eylem, type Kural, type Kuyruk, type Olay } from './kural.js';
import { shoutoutGonder } from './shoutout.js';

const ANAHTAR = 'otomasyon_kurallari';
const KUYRUK_ANAHTARI = 'otomasyon_kuyruklari';
/** HTTP eyleminin {yanit} olarak sonraki adımlara geçen kısmı */
const YANIT_SINIRI = 300;
/** Studio'ya giden OBS eylemleri: yalnız bunlar (yayını bitirme gibi onaylılar yok) */
const YYA_EYLEMLERI = new Set(['scene.switch', 'replay.save', 'filter.enable', 'filter.disable', 'filter.toggle', 'source.show', 'source.hide', 'source.toggle', 'source.transform']);
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
  /** BOT-1: adlı kuyrukların çalışan ve bekleyen işleri */
  private kuyrukDurumu = new Map<string, { calisan: number; bekleyen: (() => void)[] }>();
  private sonKuyrukHam: string | null = null;
  private kuyrukListesi: Kuyruk[] = [];

  kuyruklar(): Kuyruk[] {
    const ham = settingsCache.get(KUYRUK_ANAHTARI, '[]');
    if (ham === this.sonKuyrukHam) return this.kuyrukListesi;
    this.sonKuyrukHam = ham;
    try {
      const okunan = JSON.parse(ham);
      this.kuyrukListesi = (Array.isArray(okunan) ? okunan : []).flatMap((k) => kuyrukDuzelt(k) ?? []);
    } catch {
      this.kuyrukListesi = [];
    }
    return this.kuyrukListesi;
  }

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
  kaydet(ham: unknown, hamKuyruk?: unknown): { ok: true; kurallar: Kural[]; kuyruklar: Kuyruk[] } | { ok: false; hata: string } {
    if (!Array.isArray(ham)) return { ok: false, hata: 'Kural listesi geçersiz' };
    if (ham.length > EN_COK_KURAL) return { ok: false, hata: `En çok ${EN_COK_KURAL} kural olabilir` };
    // Kuyruk listesi gönderilmezse olduğu gibi kalır
    let kuyruklar = this.kuyruklar();
    if (hamKuyruk !== undefined) {
      if (!Array.isArray(hamKuyruk) || hamKuyruk.length > EN_COK_KUYRUK) return { ok: false, hata: `En çok ${EN_COK_KUYRUK} kuyruk olabilir` };
      kuyruklar = [];
      for (const q of hamKuyruk) {
        const k = kuyrukDuzelt(q);
        if (!k) return { ok: false, hata: 'Kuyruk adı geçersiz (harf, rakam, boşluk, - _; en çok 40)' };
        if (kuyruklar.some((x) => x.ad.toLocaleLowerCase('tr') === k.ad.toLocaleLowerCase('tr'))) return { ok: false, hata: `Aynı adla iki kuyruk: ${k.ad}` };
        kuyruklar.push(k);
      }
    }
    const kurallar: Kural[] = [];
    for (const k of ham) {
      const r = kuralDuzelt(k);
      if (!r.ok) return r;
      kurallar.push(r.kural);
    }
    const idler = new Set(kurallar.map((k) => k.id));
    for (const k of kurallar) {
      if (k.kuyruk && !kuyruklar.some((q) => q.ad === k.kuyruk)) return { ok: false, hata: `${k.ad}: "${k.kuyruk}" adlı kuyruk yok` };
      const yok = tumEylemler(k.eylemler).find((e) => e.tur === 'kural_calistir' && !idler.has(e.kuralId));
      if (yok) return { ok: false, hata: `${k.ad}: çalıştırılacak kural bulunamadı` };
    }
    settingsCache.set(KUYRUK_ANAHTARI, JSON.stringify(kuyruklar));
    settingsCache.set(ANAHTAR, JSON.stringify(kurallar));
    this.patlamalar.clear();
    return { ok: true, kurallar: this.kurallar(), kuyruklar: this.kuyruklar() };
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
      adimlar: tumEylemler(k.eylemler).map((e) => eylemAciklamasi(e, olay)),
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
    const baglam: Baglam = { derinlik: 0, yigin: [k.id] };
    const eylemler = secilenEylemler(k);
    try {
      await this.eylemListesi(eylemler, o, baglam);
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

  private async eylemListesi(eylemler: Eylem[], o: Olay, baglam: Baglam): Promise<void> {
    for (const e of eylemler) await this.eylem(e, o, baglam);
  }

  /** Tek eylem. Hata fırlatabilir: kuralın kalan adımları o zaman çalışmaz. */
  private async eylem(e: Eylem, o: Olay, baglam: Baglam): Promise<void> {
    const platform = o.platform || 'all';
    const doldur = (sablon: string) => metniDoldur(sablon, o, { yanit: baglam.yanit });
    switch (e.tur) {
      case 'sohbet':
        eventBus.emitBotMessage({ platform: platform as any, message: doldur(e.metin) });
        return;
      case 'tts':
      case 'pano_oynat':
      case 'sarki_atla':
      case 'sohbet_temizle':
      case 'kalkan':
      case 'komut': {
        const { sesliKomutlar } = await import('../sesli/sesli.js');
        await sesliKomutlar.calistir(e.tur === 'tts' ? { tur: 'tts', metin: doldur(e.metin) } : e);
        return;
      }
      case 'shoutout':
        await shoutoutGonder(doldur(e.kanal).replace(/^@/, ''), o.platform || ilkKanal()?.platform || 'kick');
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
        await discordDuyuru.metinGonder(doldur(e.metin));
        return;
      }
      case 'bekle':
        await new Promise((r) => setTimeout(r, e.saniye * 1000));
        return;
      case 'obs_filtre':
        return this.yyaEylemi(`filter.${{ ac: 'enable', kapat: 'disable', degistir: 'toggle' }[e.durum]}`, { source: e.kaynak, filter: e.filtre });
      case 'obs_kaynak':
        return this.yyaEylemi(`source.${{ goster: 'show', gizle: 'hide', degistir: 'toggle' }[e.durum]}`, { ...(e.sahne ? { scene: e.sahne } : {}), source: e.kaynak });
      case 'obs_donusum':
        return this.yyaEylemi('source.transform', { ...(e.sahne ? { scene: e.sahne } : {}), source: e.kaynak, x: e.x, y: e.y, scale: e.olcek, rotation: e.aci });
      case 'http': {
        const adres = metniDoldur(e.adres, o, { yanit: baglam.yanit, kodla: urlKodla });
        const govde = /^\s*[[{]/.test(e.govde) ? metniDoldur(e.govde, o, { yanit: baglam.yanit, kodla: jsonKodla }) : doldur(e.govde);
        try {
          const r = await axios.request({
            method: e.yontem,
            url: adres,
            data: e.yontem === 'POST' ? govde : undefined,
            headers: e.yontem === 'POST' ? { 'Content-Type': /^\s*[[{]/.test(govde) ? 'application/json' : 'text/plain' } : undefined,
            timeout: 10_000,
            maxContentLength: 64 * 1024,
            maxRedirects: 3,
            responseType: 'text',
            transformResponse: (v) => v
          });
          baglam.yanit = String(r.data ?? '').slice(0, YANIT_SINIRI);
        } catch (h: any) {
          throw new Error(`HTTP isteği başarısız: ${h?.response?.status ? `durum ${h.response.status}` : String(h?.message || h)}`.slice(0, 160));
        }
        return;
      }
      case 'degisken': {
        const deger = doldur(e.deger);
        if (e.hedef === 'kanal') {
          const { kvYaz } = await import('../../core/variables/store.js');
          kvYaz('global', '', e.ad, deger);
          return;
        }
        const n = Number(deger.replace(',', '.'));
        if (!Number.isFinite(n)) throw new Error(`Sayaç ${e.ad}: "${deger.slice(0, 40)}" sayı değil`);
        const { sayacAyarla, sayacDegistir } = await import('../../core/variables/store.js');
        if (e.islem === 'ekle') sayacDegistir(e.ad, n);
        else sayacAyarla(e.ad, n);
        return;
      }
      case 'rastgele_dal':
        return this.eylemListesi(Math.random() * 100 < e.yuzde ? e.evet : e.hayir, o, baglam);
      case 'kural_calistir': {
        const hedef = this.kurallar().find((k) => k.id === e.kuralId);
        if (!hedef) throw new Error('Çalıştırılacak kural bulunamadı');
        if (baglam.yigin.includes(hedef.id)) throw new Error(`Döngü: ${hedef.ad} zaten çalışıyor`);
        if (baglam.derinlik + 1 > EN_COK_DAL_DERINLIGI) throw new Error(`İç içe kural çağrısı en çok ${EN_COK_DAL_DERINLIGI}`);
        // Çağrılan kuralın tetiği, koşulu ve beklemesi atlanır; sahne ve yanıt kendi bağlamında
        return this.eylemListesi(secilenEylemler(hedef), o, { derinlik: baglam.derinlik + 1, yigin: [...baglam.yigin, hedef.id] });
      }
    }
  }

  /**
   * BOT-1 adlı kuyruk: aynı kuyruktaki kuralların eylemleri en çok `ayniAnda` tanesi birlikte çalışır,
   * kalanlar sırayla bekler; bekleyen sınırı dolunca yeni olay atılır. Kuyruğu silinmiş kural doğrudan çalışır.
   */
  private async kuyrukla(k: Kural, is: () => Promise<unknown>): Promise<void> {
    const q = k.kuyruk ? this.kuyruklar().find((x) => x.ad === k.kuyruk) : undefined;
    if (!q) {
      await is();
      return;
    }
    const d = this.kuyrukDurumu.get(q.ad) ?? { calisan: 0, bekleyen: [] };
    this.kuyrukDurumu.set(q.ad, d);
    if (d.calisan >= q.ayniAnda) {
      if (d.bekleyen.length >= q.enCokBekleyen) {
        this.yaz(k.ad, false, `Kuyruk "${q.ad}" dolu (${q.enCokBekleyen}); olay atıldı`);
        return;
      }
      await new Promise<void>((r) => d.bekleyen.push(r));
    } else d.calisan++;
    try {
      await is();
    } finally {
      // Sıradaki iş yuvayı devralır: çalışan sayısı düşmeden geçer
      const sonraki = d.bekleyen.shift();
      if (sonraki) sonraki();
      else d.calisan--;
    }
  }

  /** OBS denetimi AxthrowA Studio'da: yalnız bu bilinçli seçilmiş eylemler gönderilir (yayını bitirme gibi onaylılar yok) */
  private async yyaEylemi(id: string, params: Record<string, unknown>): Promise<void> {
    if (!YYA_EYLEMLERI.has(id)) throw new Error(`İzin verilmeyen Studio eylemi: ${id}`);
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
    await this.kuyrukla(k, () => this.eylemleriCalistir(k, o));
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
        await this.kuyrukla(k, () => this.eylemleriCalistir(k, o));
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
    eventBus.on('izleme_serisi', (p: any) => void (p?.isTest ? 0 : this.olay({ tur: 'izleme_serisi', platform: p.platform, kullanici: ad(p), miktar: p.seri })));
    eventBus.on('power_up', (p: any) => void (p?.isTest ? 0 : this.olay({ tur: 'power_up', platform: p.platform, kullanici: ad(p), odul: p.guc, mesaj: p.message })));
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

/** Bir kural çalışmasının durumu: önceki sahne, son HTTP yanıtı, iç içe kural çağrısı yığını */
type Baglam = { onceki?: string; yanit?: string; derinlik: number; yigin: string[] };

/** Sıralı kipte hepsi, rastgele kipte biri */
function secilenEylemler(k: Kural): Eylem[] {
  return k.kip === 'rastgele' ? [k.eylemler[Math.floor(Math.random() * k.eylemler.length)]] : k.eylemler;
}

/** "Dene" ve "Çalıştır" için tetiğe uygun örnek olay */
function ornekOlay(k: Kural, ornek: Partial<Olay>): Olay {
  return { kullanici: 'ornek_izleyici', platform: 'kick', miktar: 100, mesaj: k.tetik.tur === 'komut' ? `!${k.tetik.komut} merhaba` : 'merhaba', odul: k.tetik.tur === 'odul' ? k.tetik.odul : '', ...ornek, tur: k.tetik.tur };
}

export const otomasyon = new Otomasyon();
export default otomasyon;
