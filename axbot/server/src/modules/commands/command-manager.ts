import { triviaArgumanlari } from '../games/trivia-mesaj.js';
import { db } from '../../db/index.js';
import { ChatMessagePayload, eventBus } from '../../core/event-bus.js';
import { parseVariables } from '../../core/variable-parser.js';
import { baglamOlustur, degiskenleriCoz } from '../../core/variables/index.js';
import { randomUUID } from 'node:crypto';
import { cuzdanAdi, economy } from '../economy/economy.js';
import { getStreamUptime, yayinAcikMi } from '../../core/variable-parser.js';
import { sayacAl, sayacAyarla, sayacDegistir } from '../../core/variables/store.js';
import { sayacIfadesi } from '../../core/variables/pure.js';
import { seviyeler } from '../levels/levels.js';
import { tahminler } from '../engagement/predictions.js';
import { kuyruk } from '../engagement/queue.js';
import { puanDususu } from '../engagement/point-drops.js';
import { songRequest } from '../songrequest/songrequest.js';
import { yayinOzeti } from '../ai/yayin-ozeti.js';
import { muzikHost } from '../muzik/index.js';
import { sesYuzdesi } from '../muzik/spotify-saf.js';
import { baslangicDuyurusu, giveaway, kazananDuyurusu } from '../giveaways/giveaways.js';
import { acikAnket, anketBaslat, anketBitir, anketOyuCoz, anketOyuKaydet, anketKomutuCoz, anketSonucMetni } from '../engagement/anket.js';
import { sohbetIstatistik } from '../community/sohbet-istatistik.js';
import { hatirlatmaKur, kisaSure, lurkBasla, lurkBitir, skorKomutu, skorMetni, skorOku, skorYaz, sureCoz } from '../community/sohbet-araclari.js';
import { kelimeKuraliDerle, kelimeEslesmesi } from '../automod/kelime-kurali.js';
import { geminiCoHost } from '../ai/gemini.js';
import { gamesEngine } from '../games/games.js';
import { triviaEngine } from '../games/trivia-engine.js';
import { kingSystemService } from '../games/king-system.js';
import { settingsCache } from '../../core/settings-cache.js';
import { extras } from '../extras/extras.js';
import { canliDurum } from '../../core/live-status.js';
import { anahtarKomutuSec, erisimAciklamasi, erisimUygunMu } from './command-input.js';
import { hataMetni, seyrekUyar } from '../../core/logger.js';
import { trKatla } from '../../core/text.js';
import { klipYoneticisi } from '../clips/klip.js';
import { klipSuresi } from '../clips/klip-saf.js';
import { shoutoutGonder, shoutoutMetni } from '../otomasyon/shoutout.js';
import { kendiMesajlari, nukeArgumanlari, nukeHedefleri, sonMesajlar } from '../moderation/son-mesajlar.js';
import { sureyiYaz } from '../automod/enforcement.js';
import { rastgeleIzleyici } from '../../core/variables/registry.js';
import { ciftParantezCevir } from '../../core/variables/cift-parantez-uyum.js';
import { duzenliler } from '../community/regulars.js';
import { votekick, bingo, ayarSayi, kappagenGonder, metindenEmoteler } from '../community/topluluk.js';
import { emoteAdlari } from '../community/oyunlar.js';
import { yediTv } from '../emotes/yedi-tv.js';
import { kickTakipciSayisi } from './takipci.js';
import { beklemeSuresi, komutlarMetni, oyunlarMetni, sansSayi, yanitSablonu, yerlesikAyarlariCoz, yerlesikBul, yetkiYeterli } from './yerlesik-komutlar.js';

interface CooldownEntry {
  expiresAt: number;
}

function parseTriviaCategory(raw: string): string {
  if (!raw) return 'all';
  const r = raw.toLowerCase().trim();
  if (r === 'all' || r === 'hepsi' || r === 'karışık' || r === 'karisik') return 'all';
  if (r.includes('basket')) return 'Basketbol';
  if (r.includes('spor')) return 'Spor';
  if (r.includes('cograf') || r.includes('coğraf')) return 'Coğrafya';
  if (r.includes('osmanli') || r.includes('osmanlı')) return 'Osmanlı Tarihi';
  if (r.includes('tarih')) return 'Tarih';
  if (r.includes('sanat')) return 'Sanat';
  if (r.includes('sinema') || r.includes('tv')) return 'Film ve Dizi';
  if (r.includes('film') || r.includes('dizi')) return 'Film ve Dizi';
  if (r.includes('tib') || r.includes('tıb') || r.includes('sağlık') || r.includes('saglik') || r.includes('doktor')) return 'Tıbbi Terimler';
  if (r.includes('azer') || r.includes('türkçe') || r.includes('turkce')) return 'Azerbaycan Türkçesi';
  if (r.includes('gundem') || r.includes('gündem') || r.includes('2000')) return 'Gündem 2000/26';
  if (r.includes('ekonomi') || r.includes('para') || r.includes('finans')) return 'Ekonomi';
  if (r.includes('mutfak') || r.includes('yemek')) return 'Türk Mutfağı';
  if (r.includes('tekno')) return 'Teknoloji';
  if (r.includes('bilim')) return 'Bilim';
  if (r.includes('bilgi')) return 'Bilgi';
  if (r.includes('oyun') || r.includes('game')) return 'Oyun';
  if (r.includes('iz') || r.includes('bırakan') || r.includes('birakan')) return 'İz Bırakanlar';
  if (r.includes('gecmis') || r.includes('geçmiş')) return 'Geçmişten Günümüze';
  if (r.includes('islem') || r.includes('işlem') || r.includes('matematik') || r.includes('4')) return '4 İşlem';
  if (r.includes('yazim') || r.includes('yazım') || r.includes('imla')) return 'Yazım Yanlışları';
  if (r.includes('soz') || r.includes('söz') || r.includes('deyis') || r.includes('deyiş') || r.includes('atasöz')) return 'Söz ve Deyiş';
  if (r.includes('mitoloji') || r.includes('efsane')) return 'Mitoloji';
  if (r.includes('muzik') || r.includes('müzik') || r.includes('nota')) return 'Müzik';
  if (r.includes('futbol') || r.includes('soccer')) return 'Futbol';
  if (r.includes('edebiyat') || r.includes('kitap') || r.includes('roman')) return 'Edebiyat';
  if (r.includes('uzay') || r.includes('astro') || r.includes('gezegen')) return 'Uzay';
  if (r.includes('hayvan') || r.includes('doğa') || r.includes('doga')) return 'Hayvanlar';
  if (r.includes('internet') || r.includes('meme') || r.includes('sosyal')) return 'İnternet Kültürü';
  if (r.includes('icat') || r.includes('mucit') || r.includes('buluş') || r.includes('bulus')) return 'İcatlar';
  if (r.includes('genel') || r.includes('kultur') || r.includes('kültür')) return 'Genel Kültür';
  return 'all';
}

/** `!modul kapat <ad>`: bu adlardaki yerleşik komutlar yanıt vermez */
export const MODULLER: Record<string, string[]> = {
  oyunlar: ['atla', 'jump', 'drop', 'zipla', 'parasut', 'topluatla', 'groupjump', 'atlat', 'atlaiptal', 'atlaskor', 'jumpscore', 'atlaenler', 'jumptop', 'atlatop', 'slot', 'slots', 'rulet', 'roulette', 'duello', 'duel', 'soygun', 'heist', 'yaris', 'race', 'drag', 'balik', 'avla', 'fish', 'kasaac', 'kasa', 'case', 'bomba', 'c4', 'kes', 'cut', 'yazitura', 'cf', 'coinflip', 'zar', 'dice', 'kral', 'taht', 'king', 'tahtikap', 'claimthrone', 'claimking', 'cark', 'wheel'],
  sarki: ['sr', 'songrequest', 'sarkiiste', 'klip', 'klipiste', 'songpause', 'sarkidur', 'songresume', 'sarkidevam', 'songvol', 'sarkises', 'songlike', 'sarkibegen', 'oncekisarki', 'lastsong'],
  yapayzeka: ['sor', 'ask', 'ai', 'cevir', 'translate', 'tr'],
  bilgi: ['soru', 'trivia', 'bilgi', 'bilgiyarismasi', 'yarisma', 'kelime', 'anagram'],
  market: ['market', 'magaza', 'store', 'shop', 'al', 'buy', 'redeem']
};

/** `!permit` süresi: Bot Moderasyonu > Link'teki ayar (10–3600 sn; eskiden hep 60 sn yazılıyordu). */
export function permitSuresi(): number {
  try {
    const r = db.prepare("SELECT value FROM bot_settings WHERE key = 'automod_advanced'").get() as { value: string } | undefined;
    const sn = Number(r?.value ? JSON.parse(r.value).links_permit_seconds : NaN);
    return Number.isFinite(sn) && sn > 0 ? Math.min(3600, Math.max(10, Math.round(sn))) : 60;
  } catch {
    return 60;
  }
}

export class CommandManager {
  private userCooldowns: Map<string, CooldownEntry> = new Map();
  private globalCooldowns: Map<string, CooldownEntry> = new Map();
  private commandsCache: Map<string, any> = new Map();
  private aliasesCache: Map<string, any> = new Map();
  /** Ad ve takma adların Türkçe→ASCII katlanmış hâli ("!şarkı" = "!sarki"). */
  private katliCache: Map<string, any> = new Map();
  /** "Sohbet anahtar kelimesi" ile etkinleşen komutlar. */
  private anahtarKomutlar: any[] = [];
  private permits: Map<string, number> = new Map();
  private clipLast = 0;
  /** Şans çarkının son çevrilişi (izleyici seli için genel bekleme) */
  private carkSon = 0;
  private initialized: boolean = false;

  isPermitted(username: string) {
    const until = this.permits.get(username.toLowerCase()) || 0;
    return until > Date.now();
  }

  reload() {
    this.commandsCache.clear();
    this.aliasesCache.clear();
    this.katliCache.clear();
    this.anahtarKomutlar = [];
    try {
      const rows = db.prepare('SELECT * FROM commands WHERE is_enabled = 1').all() as any[];
      for (const row of rows) {
        this.commandsCache.set(row.name.toLowerCase(), row);
        // Türkçe küçük harfle de bul ("İstek" kaydı "!istek" ile çalışsın)
        if (!this.commandsCache.has(row.name.toLocaleLowerCase('tr-TR'))) this.commandsCache.set(row.name.toLocaleLowerCase('tr-TR'), row);
        if (!this.katliCache.has(trKatla(row.name))) this.katliCache.set(trKatla(row.name), row);
        if (String(row.trigger_type || 'command') === 'keyword') this.anahtarKomutlar.push(row);
        if (row.aliases) {
          try {
            const aliases: string[] = JSON.parse(row.aliases);
            for (const alias of aliases) {
              if (alias && alias.trim()) {
                this.aliasesCache.set(alias.trim().toLowerCase(), row);
                if (!this.katliCache.has(trKatla(alias))) this.katliCache.set(trKatla(alias), row);
              }
            }
          } catch (e) {
            console.warn(`[Komut] !${row.name} takma adları okunamadı (bozuk kayıt):`, hataMetni(e));
          }
        }
      }
      this.initialized = true;
    } catch (err) {
      console.warn('[CommandManager] Error caching commands:', err);
    }
  }

  private ensureLoaded() {
    if (!this.initialized) {
      this.reload();
    }
  }

  /** Yerleşik komut yanıtlarının son zamanı ve metni: kişi + komut */
  private yerlesikSonYanit = new Map<string, { zaman: number; metin: string }>();

  /**
   * Yerleşik komutların bekleme süresi yoktu: bir izleyici aynı komutu
   * art arda yazıp botu sohbette sele zorlayabiliyordu. Komut YİNE çalışır;
   * yalnız 3 sn içinde AYNI yanıtın tekrarı yazılmaz. Farklı yanıt (ör.
   * "gönderildi" ardından "yetersiz bakiye") her zaman yazılır — yapılan
   * işlemin onayı yutulmaz. Mod ve yayıncı muaf. '' döner: özel komuta düşülmez.
   */
  /** Panelden bekleme verilen yerleşik komutun son yanıtı. !şans kişi başınadır. */
  private yerlesikBeklemeSon: Map<string, number> = new Map();

  /** Bekleme uyarısı verilenler: aynı kişiye bekleme bitene kadar ikinci kez yazılmaz (sohbet dolmasın). */
  private beklemeUyarilari: Map<string, number> = new Map();

  /** `anahtar` için bekleme `bitis` anına kadar uyarı verilmediyse true döner ve kaydeder. */
  private birKezUyar(anahtar: string, bitis: number): boolean {
    const simdi = Date.now();
    if ((this.beklemeUyarilari.get(anahtar) || 0) > simdi) return false;
    if (this.beklemeUyarilari.size > 2000) for (const [k, t] of this.beklemeUyarilari) if (t <= simdi) this.beklemeUyarilari.delete(k);
    this.beklemeUyarilari.set(anahtar, bitis);
    return true;
  }

  private beklemeAnahtari(ad: string, message: ChatMessagePayload): string {
    if (ad !== 'sans') return ad;
    return `sans:${message.platform}:${message.user.username.toLowerCase()}`;
  }

  private yerlesikSeli(ad: string, message: ChatMessagePayload, sonuc: string): string {
    const kayit = yerlesikBul(ad);
    const sablon = kayit && yerlesikAyarlariCoz(settingsCache.get('yerlesik_komut_ayarlari', '{}'))[kayit.ad]?.yanit;
    if (sablon && sonuc) sonuc = yanitSablonu(sablon, sonuc, message.user.displayName);
    if (kayit && !sonuc.includes(' bekle.')) this.yerlesikBeklemeSon.set(this.beklemeAnahtari(kayit.ad, message), Date.now());
    if (!sonuc || message.user.isMod || message.user.isBroadcaster) return sonuc;
    const k = `${message.platform}:${message.user.username.toLowerCase()}:${ad}`;
    const simdi = Date.now();
    const son = this.yerlesikSonYanit.get(k);
    if (son && son.metin === sonuc && simdi - son.zaman < 3000) return '';
    this.yerlesikSonYanit.delete(k);
    this.yerlesikSonYanit.set(k, { zaman: simdi, metin: sonuc });
    if (this.yerlesikSonYanit.size > 2000) this.yerlesikSonYanit.delete(this.yerlesikSonYanit.keys().next().value as string);
    return sonuc;
  }

  async processMessage(message: ChatMessagePayload): Promise<string | null> {
    const text = message.message.trim();
    const prefix = settingsCache.get('prefix', '!');

    if (!text.startsWith(prefix)) {
      // Award active chatter points
      economy.getUser(message.platform, message.user.username, message.user.displayName);
      // Açık ankette komut gerekmez: sohbete yalnız numara ("2") ya da şıkkın adı yazılınca oy sayılır.
      // Sessiz kaydedilir (yüzlerce oya tek tek yanıt sohbeti boğar); ikinci oy yok sayılır.
      const anket = acikAnket();
      if (anket && !message.user.isSelf) {
        const sira = anketOyuCoz(text, JSON.parse(anket.options || '[]'));
        if (sira !== null) {
          await anketOyuKaydet(anket, message.user.username, sira);
          return null;
        }
      }
      // Önek yoksa yalnız "Sohbet anahtar kelimesi" komutları bakılır
      return this.anahtarKelimeIsle(message, text);
    }

    const withoutPrefix = text.slice(prefix.length).trim();
    if (!withoutPrefix) return null;

    const parts = withoutPrefix.split(/\s+/);
    const args = parts.slice(1);
    this.ensureLoaded();

    // Komut adı adayları. Yerleşik adlar ASCII ("sarki", "sira", "yazitura");
    // izleyici "!şarkı", "!sıra", "!YAZITURA", "!İzleme" yazınca eskiden bot
    // SESSİZ kalıyordu. Önce birebir (eski davranış, özel komut gölgelenmesin),
    // sonra Türkçe küçük harf, en son ASCII'ye katlanmış ad denenir.
    const ham = parts[0];
    const adaylar = [...new Set([ham.toLowerCase(), ham.toLocaleLowerCase('tr-TR')])];
    for (const ad of adaylar) {
      const builtInResult = await this.executeBuiltIn(ad, args, message);
      if (builtInResult !== null) return this.yerlesikSeli(ad, message, builtInResult);
      const cmdRow = this.commandsCache.get(ad) || this.aliasesCache.get(ad);
      if (cmdRow) return this.executeCustomCommand(cmdRow, args, message, true);
    }
    const katli = trKatla(ham);
    if (!adaylar.includes(katli)) {
      const builtInResult = await this.executeBuiltIn(katli, args, message);
      if (builtInResult !== null) return this.yerlesikSeli(katli, message, builtInResult);
    }
    const katliKomut = this.katliCache.get(katli);
    if (katliKomut) return this.executeCustomCommand(katliKomut, args, message, true);
    return null;
  }

  /**
   * Anahtar kelime komutları: mesajın herhangi bir yerinde bütün kelime
   * olarak geçince çalışır (örnek alınan bot "Etkinleştirme: Sohbet anahtar kelimesi").
   *
   * Döngü koruması: botun kendi mesajı ASLA tetiklemez — yanıt metninde
   * anahtar kelime geçiyorsa bot kendine sonsuza dek cevap verirdi.
   */
  private async anahtarKelimeIsle(message: ChatMessagePayload, text: string): Promise<string | null> {
    this.ensureLoaded();
    if (!this.anahtarKomutlar.length) return null;
    if (message.user.isSelf) return null;
    try {
      const { platformManager } = await import('../../platforms/manager.js');
      if (platformManager.botKullaniciAdlari().has(String(message.user.username).toLowerCase())) return null;
    } catch {
      /* yönetici yüklenemediyse yalnız isSelf korur */
    }
    const k = anahtarKomutuSec(text, this.anahtarKomutlar);
    if (!k) return null;
    return this.executeCustomCommand(k, [], message, false);
  }

  /** `!title` / `!game`: göster veya (mod/yayıncı) değiştir. */
  private async yayinBilgisi(tur: 'baslik' | 'kategori', yeni: string, message: ChatMessagePayload): Promise<string> {
    const ayricalikli = message.user.isMod || message.user.isBroadcaster;
    const durum = canliDurum.platform(message.platform);

    if (!yeni || !ayricalikli) {
      const deger = tur === 'baslik' ? durum?.baslik : durum?.kategori;
      if (deger) return tur === 'baslik' ? `📺 Yayın başlığı: ${deger}` : `🎮 Kategori: ${deger}`;
      return `@${message.user.displayName}, ${tur === 'baslik' ? 'başlık' : 'kategori'} şu an bilinmiyor (yayın kapalı olabilir).`;
    }

    const { platformManager } = await import('../../platforms/manager.js');
    const p = platformManager.getPlatform(message.platform);
    if (tur === 'baslik') {
      if (!p?.baslikDegistir) return `@${message.user.displayName}, ${message.platform} başlık değiştirmeyi desteklemiyor.`;
      const r = await p.baslikDegistir(yeni);
      return r.ok ? `✅ Başlık güncellendi: ${yeni}` : `❌ Başlık değiştirilemedi: ${r.hata}`;
    }
    if (!p?.kategoriDegistir) return `@${message.user.displayName}, ${message.platform} kategori değiştirmeyi desteklemiyor.`;
    const r = await p.kategoriDegistir(yeni);
    return r.ok ? `✅ Kategori: ${r.kategori || yeni}` : `❌ Kategori değiştirilemedi: ${r.hata}`;
  }

  /** `!accountage`: hesabın açılış tarihi platform destekliyorsa. */
  private async hesapYasi(hedefHam: string, message: ChatMessagePayload): Promise<string> {
    const hedef = String(hedefHam || '').replace(/^@/, '');
    const { platformManager } = await import('../../platforms/manager.js');
    const p: any = platformManager.getPlatform(message.platform);
    if (typeof p?.hesapOlusturma !== 'function') {
      return `@${message.user.displayName}, ${message.platform} hesap açılış tarihini paylaşmıyor.`;
    }
    const t: number | null = await p.hesapOlusturma(hedef);
    if (!t) return `@${message.user.displayName}, ${hedef} için hesap tarihi bulunamadı.`;
    const gun = Math.floor((Date.now() - t) / 86400000);
    const yil = Math.floor(gun / 365);
    const metin = yil > 0 ? `${yil} yıl ${gun % 365} gün` : `${gun} gün`;
    return `📅 ${hedef} hesabı ${metin} önce açılmış (${new Date(t).toLocaleDateString('tr-TR')}).`;
  }

  /** Kanalın takipçi sayısı. Kick v2 kanal yanıtı; Twitch Helix `moderator:read:followers`. */
  private async takipciSayisi(message: ChatMessagePayload): Promise<string> {
    const { platformManager } = await import('../../platforms/manager.js');
    const yaz = (kanal: string, n: number) => `👥 ${kanal} kanalının ${n.toLocaleString('tr-TR')} takipçisi var.`;
    if (message.platform === 'kick') {
      const kick = platformManager.getPlatform('kick') as { getStatus?: () => { channel?: string }; profil?: (s: string) => Promise<unknown> } | undefined;
      if (!kick) return 'Kick kanalı bağlı değil.';
      const kanal = kick.getStatus?.().channel || '';
      if (!kanal || typeof kick.profil !== 'function') return 'Kick kanalı bağlı değil.';
      const n = kickTakipciSayisi(await kick.profil(kanal));
      return n == null ? 'Kick takipçi sayısı alınamadı.' : yaz(kanal, n);
    }
    if (message.platform === 'twitch') {
      const tw = platformManager.getPlatform('twitch') as { takipciSayisi?: () => Promise<{ ok: true; sayi: number } | { ok: false; hata: string }>; getStatus?: () => { channel?: string } } | undefined;
      if (!tw) return 'Twitch bağlı değil.';
      const r = await tw.takipciSayisi?.();
      if (!r) return 'Twitch bağlı değil.';
      if (!r.ok) return `Twitch takipçi sayısı alınamadı: ${r.hata}`;
      return yaz(tw.getStatus?.().channel || 'kanal', r.sayi);
    }
    return 'Bu platformda takipçi sayısı yok.';
  }

  /** Panelden kapatılan yerleşik komutlar (asıl ya da eski kayıtlarda takma ad) */
  private kapaliYerlesikler(): string[] {
    try {
      const v = JSON.parse(settingsCache.get('default_commands_disabled', '[]'));
      return Array.isArray(v) ? v.map(String) : [];
    } catch (e) {
      seyrekUyar('ayar:default_commands_disabled', '[Komut] Kapalı varsayılan komut listesi okunamadı', e);
      return [];
    }
  }

  /** `!modul kapat <ad>` ile kapatılan modüllerin komutları */
  private modulKapaliYerlesikler(): string[] {
    return Object.entries(MODULLER)
      .filter(([m]) => settingsCache.getBoolean(`modul_kapali_${m}`, false))
      .flatMap(([, adlar]) => adlar.map((a) => yerlesikBul(a)?.ad || a));
  }

  /** `!anketac [süre] Soru | A | B` → anket açılır, seçenekler sohbete yazılır */
  private async anketAc(args: string[]): Promise<string> {
    const c = anketKomutuCoz(args);
    if ('hata' in c) return c.hata;
    const r = await anketBaslat({ title: c.soru, options: c.secenekler, durationSeconds: c.sure });
    if (!r.ok) return r.hata;
    const liste = r.options.map((o, i) => `${i + 1}) ${o}`).join('  ');
    return `📊 ANKET: ${r.title} — ${liste} · Oy vermek için sohbete numarasını (1-${r.options.length}) ya da şıkkın adını yaz (${r.durationSeconds} sn)`;
  }

  private async sarkiKomutu(eylem: string, tamam: string): Promise<string> {
    try {
      await muzikHost.komut(eylem);
      return tamam;
    } catch (e) {
      return hataMetni(e) || 'Müzik komutu başarısız.';
    }
  }

  private async executeBuiltIn(name: string, args: string[], message: ChatMessagePayload): Promise<string | null> {
    // Kapatma asıl adla tutulur ve takma adları da kapsar (eskiden !puan kapalıyken !bakiye çalışıyordu)
    const kayit = yerlesikBul(name);
    const kim = message.user.displayName;
    const ayar = kayit ? yerlesikAyarlariCoz(settingsCache.get('yerlesik_komut_ayarlari', '{}'))[kayit.ad] : undefined;
    // Panelde "reddedince sessiz kal" seçiliyse kapalı / yetki / bekleme yanıtı yazılmaz
    const ret = (metin: string) => (ayar?.sessiz ? null : metin);
    if (kayit && this.kapaliYerlesikler().some((x) => x === name || x === kayit.ad)) {
      return ret(`@${kim}, !${kayit.ad} kapalı.`);
    }
    if (kayit) {
      if (!yetkiYeterli(ayar?.yetki || kayit.yetki, message.user)) return ret(`@${kim}, !${kayit.ad} için yetkin yok.`);
      const ayricalikli = message.user.isMod || message.user.isBroadcaster;
      const sn = beklemeSuresi(kayit, ayar);
      const anahtar = this.beklemeAnahtari(kayit.ad, message);
      const son = this.yerlesikBeklemeSon.get(anahtar) || 0;
      if (sn && !ayricalikli && Date.now() - son < sn * 1000) {
        return this.birKezUyar(`y:${anahtar}`, son + sn * 1000) ? ret(`@${kim}, !${kayit.ad} için ${sn} sn bekle.`) : null;
      }
    }
    const modul = Object.entries(MODULLER).find(([, adlar]) => adlar.includes(name))?.[0];
    if (modul && settingsCache.getBoolean(`modul_kapali_${modul}`, false)) return ret(`@${kim}, !${name} kapalı.`);

    switch (name) {
      case 'puan':
      case 'bakiye':
      case 'points':
        return economy.handlePointsCommand(message);

      case 'profil':
      case 'seviye':
      case 'rank':
      case 'sadakat':
      case 'level':
        return economy.handleProfileCommand(message);

      case 'market':
      case 'magaza':
      case 'store':
      case 'shop':
        return economy.handleStoreCommand();

      case 'al':
      case 'buy':
      case 'redeem':
        return economy.handleRedeemCommand(message, args);

      // Ses/video panosu (Blerp tarzı): !ses <ad>, !sesler, !sesgec (mod: çalanı atla)
      case 'ses':
      case 'blerp': {
        const { sesPanosu } = await import('../pano/pano.js');
        return sesPanosu.sohbetIstegi(message, args.join(' '));
      }
      case 'sesler': {
        const { sesPanosu } = await import('../pano/pano.js');
        return sesPanosu.listeMetni();
      }
      case 'sesgec': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const { sesPanosu } = await import('../pano/pano.js');
        sesPanosu.kontrol('atla');
        return '⏭️ Ses atlandı.';
      }

      case 'liderlik':
      case 'top':
      case 'siralamasi':
      case 'leaderboard':
        return economy.handleLeaderboardCommand();

      case 'rulet':
      case 'roulette':
        return economy.handleRoulette(message, args);

      case 'slot':
      case 'slots':
        return economy.handleSlots(message, args);

      case 'duello':
      case 'duel':
        // Düello kendi motorunda olduğundan panel ayarı burada uygulanır
        {
          const ayar = gamesEngine.getSettings();
          if (!ayar.enabledGames.duel) return `@${message.user.displayName}, Düello şu anda devre dışı bırakılmış. ⏸️`;
          const miktar = parseInt(args[1], 10);
          if (miktar < ayar.duel.minBet) return `@${message.user.displayName}, minimum düello bahsi: ${ayar.duel.minBet} Puan!`;
          if (miktar > ayar.duel.maxBet) return `@${message.user.displayName}, maksimum düello bahsi: ${ayar.duel.maxBet} Puan!`;
        }
        return economy.handleDuel(message, args);

      case '8ball':
      case 'kure':
        return economy.handle8Ball(message, args);

      case 'sans':
      case 'şans':
      case 'luck':
      case 'chance':
        return `🎲 @${message.user.displayName} şansın: ${sansSayi()}`;

      case 'sr':
      case 'songrequest':
      case 'sarkiiste':
        return await songRequest.handleSongRequest(message, args);

      case 'klip':
      case 'klipiste':
        return await songRequest.handleSongRequest(message, args, { klip: true });

      case 'sarki':
      case 'song':
      case 'currentsong':
        return songRequest.calanYaniti();

      case 'songlike':
      case 'sarkibegen':
        return songRequest.begen(message.user.username, message.user.displayName);

      case 'oncekisarki':
      case 'lastsong': {
        const o = yayinOzeti.onceki(songRequest.calanAdi());
        return o ? `⏮️ Önceki şarkı: "${o.ad}"` : 'Bu yayında henüz önceki bir şarkı yok.';
      }

      case 'songpause':
      case 'sarkidur':
        return this.sarkiKomutu('pause', '⏸️ Şarkı duraklatıldı.');

      case 'songresume':
      case 'sarkidevam':
        return this.sarkiKomutu('play', '▶️ Şarkı devam ediyor.');

      case 'songvol':
      case 'sarkises': {
        const y = sesYuzdesi(args[0] || '');
        if (y === null) return 'Kullanım: !songvol 0-100';
        return this.sarkiKomutu(`volume:${y}`, `🔊 Şarkı sesi %${y}.`);
      }

      case 'skip':
      case 'voteskip':
      case 'sarkiatla':
      case 'sarkigec': {
        const isMod = message.user.isBroadcaster || message.user.isMod;
        const res = songRequest.skipSong(isMod, message.user.username);
        return res.message;
      }

      // !atla oyunu: paraşütle hedefe atlama (sonuç katmandan gelir, bkz. modules/games/atla-oyunu.ts)
      case 'atla':
      case 'jump':
      case 'drop':
      case 'zipla':
      case 'parasut': {
        const { atlaOyunu } = await import('../games/atla-oyunu.js');
        const emote = metindenEmoteler(args.join(' '), 1)[0];
        return atlaOyunu.atla(message, emote);
      }

      case 'topluatla':
      case 'groupjump': {
        if (!message.user.isMod && !message.user.isBroadcaster) return '';
        const { atlaOyunu } = await import('../games/atla-oyunu.js');
        return atlaOyunu.topluAc(Number(args[0]) || undefined);
      }

      case 'atlat': {
        if (!message.user.isMod && !message.user.isBroadcaster) return '';
        const { atlaOyunu } = await import('../games/atla-oyunu.js');
        return atlaOyunu.birak();
      }

      case 'atlaiptal': {
        if (!message.user.isMod && !message.user.isBroadcaster) return '';
        const { atlaOyunu } = await import('../games/atla-oyunu.js');
        return atlaOyunu.iptal();
      }

      case 'atlaskor':
      case 'jumpscore': {
        const { atlaOyunu } = await import('../games/atla-oyunu.js');
        return atlaOyunu.skor(message);
      }

      case 'atlaenler':
      case 'jumptop':
      case 'atlatop': {
        const { atlaOyunu } = await import('../games/atla-oyunu.js');
        return atlaOyunu.enler();
      }

      case 'atlasifirla': {
        if (!message.user.isBroadcaster) return '';
        if ((args[0] || '').toLowerCase() !== 'onay') return `@${message.user.displayName}, skor tablosunu silmek için: !atlasifirla onay`;
        const { atlaOyunu } = await import('../games/atla-oyunu.js');
        return atlaOyunu.sifirla();
      }

      case 'sira':
      case 'queue': {
        const queue = songRequest.getQueueList();
        if (queue.length === 0) return '🎵 Şarkı sırası şu an boş.';
        const list = queue.map((s, i) => `${i + 1}. ${s.title}`).slice(0, 4).join(' | ');
        return `🎵 Sıradaki Şarkılar: ${list}`;
      }

      case 'katil':
      case 'join':
        return giveaway.handleJoin(message);

      // Yayıncı/mod: !cekilis [dk] [ödül]  ·  !cekilisbitir (kazananı çeker)  ·  !cekilisiptal
      case 'cekilis':
      case 'cekilisac':
      case 'giveaway': {
        if (!message.user.isMod && !message.user.isBroadcaster) return `@${message.user.displayName}, çekilişi yalnız yayıncı ve moderatörler açabilir. Katılmak için: !katil`;
        let sozcukler = [...args];
        let dakika = 10;
        if (/^\d{1,3}$/.test(sozcukler[0] || '')) {
          dakika = Math.min(600, Math.max(0, Number(sozcukler[0])));
          sozcukler = sozcukler.slice(1);
        }
        const odul = sozcukler.join(' ').trim().slice(0, 120) || 'Çekiliş';
        const r = giveaway.baslat({ title: odul, durationMinutes: dakika });
        if (!r.giveaway) return `@${message.user.displayName}, çekiliş açılamadı.`;
        const { wsHub } = await import('../../ws/server.js');
        wsHub.broadcastTo(['all'], { type: 'giveaway_started', giveaway: r.giveaway });
        return baslangicDuyurusu(r.giveaway);
      }

      case 'cekilisbitir':
      case 'cekiliscek': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const acik = giveaway.getActiveGiveaway();
        if (!acik) return `@${message.user.displayName}, açık çekiliş yok.`;
        const kazanan = giveaway.pickWinner();
        if (!kazanan) return `@${message.user.displayName}, "${acik.title}" çekilişine henüz kimse katılmadı.`;
        const { wsHub } = await import('../../ws/server.js');
        wsHub.broadcastTo(['wheel', 'dashboard', 'all'], { type: 'giveaway_winner', winner: kazanan });
        return kazananDuyurusu(acik.title, kazanan);
      }

      case 'cekilisiptal': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const kapanan = giveaway.iptal();
        return kapanan ? `🛑 "${kapanan.title}" çekilişi iptal edildi${Number(kapanan.cost_points) > 0 ? '; katılım puanları iade edildi' : ''}.` : `@${message.user.displayName}, açık çekiliş yok.`;
      }

      // Yayıncı/mod: !anketac [süre] Soru | A | B  ·  !anketbitir
      case 'anketac':
      case 'poll': {
        if (!message.user.isMod && !message.user.isBroadcaster) return `@${message.user.displayName}, anketi yalnız yayıncı ve moderatörler açabilir.`;
        return await this.anketAc(args);
      }

      case 'anketbitir':
      case 'anketkapat':
      case 'endpoll': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const sonuc = await anketBitir();
        return sonuc ? anketSonucMetni(sonuc) : `@${message.user.displayName}, açık anket yok.`;
      }

      // ── Sohbet araçları ──────────────────────────────────────────────────
      case 'cevir':
      case 'translate':
      case 'tr': {
        const metin = args.join(' ').trim().slice(0, 400);
        if (!metin) return 'Kullanım: !cevir <metin> (Türkçeyse İngilizceye, değilse Türkçeye çevrilir) · !cevir de <metin> (istenen dile)';
        const dil = /^[a-z]{2}$/i.test(args[0] || '') && args.length > 1 ? args[0].toLowerCase() : '';
        const kaynak = dil ? args.slice(1).join(' ') : metin;
        const istem = dil
          ? `Aşağıdaki metni "${dil}" dil koduna karşılık gelen dile çevir. Yalnız çeviriyi yaz, açıklama ekleme.\n\n${kaynak}`
          : `Aşağıdaki metin Türkçeyse İngilizceye, değilse Türkçeye çevir. Yalnız çeviriyi yaz, açıklama ekleme.\n\n${kaynak}`;
        try {
          const c = await geminiCoHost.yardimciUret(istem, 20_000, 'çeviri');
          if (!c) return `@${message.user.displayName}, çeviri için Yapay Zekâ sayfasından bir sağlayıcı bağlanmalı.`;
          return `🌐 ${c.replace(/\s+/g, ' ').slice(0, 450)}`;
        } catch (e: any) {
          return `@${message.user.displayName}, çeviri yapılamadı: ${String(e?.message || e).slice(0, 120)}`;
        }
      }

      case 'lurk':
        lurkBasla(message.user.username);
        return `👀 ${message.user.displayName} arka planda izlemeye geçti. İyi seyirler!`;

      case 'unlurk': {
        const sn = lurkBitir(message.user.username);
        return sn === null ? `👋 Hoş geldin ${message.user.displayName}!` : `👋 ${message.user.displayName} geri döndü (${kisaSure(sn)} arka plandaydı).`;
      }

      case 'hatirlat':
      case 'remindme': {
        const sn = sureCoz(args[0] || '');
        const not = args.slice(1).join(' ').trim().slice(0, 200);
        if (!sn || !not) return 'Kullanım: !hatirlat <süre> <not> (örn: !hatirlat 15dk su iç · !hatirlat 1sa30dk mola)';
        const dn = message.user.displayName;
        const hata = hatirlatmaKur(message.user.username, sn, () =>
          eventBus.emitBotMessage({ platform: message.platform, channel: message.channel, message: `⏰ @${dn} hatırlatma: ${not}` })
        );
        // Hatırlatma bellekte durur: arada uygulama yeniden başlarsa iptal olur, izleyici bunu baştan bilsin
        return hata ? `@${dn}, ${hata}.` : `⏰ @${dn}, ${kisaSure(sn)} sonra hatırlatacağım (bot yeniden başlarsa iptal olur).`;
      }

      case 'timer':
      case 'zamanlayici': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const islem = trKatla(args[0] || '');
        const ad = args.slice(1).join(' ').trim();
        const liste = db.prepare('SELECT name, is_enabled FROM timers ORDER BY name').all() as Array<{ name: string; is_enabled: number }>;
        if (!['ac', 'kapat', 'on', 'off'].includes(islem) || !ad) {
          if (!liste.length) return 'Hiç zamanlayıcı yok (Zamanlayıcılar sayfasından ekle).';
          return '⏱️ Zamanlayıcılar: ' + liste.map((t) => `${t.name} ${t.is_enabled ? '✅' : '⛔'}`).join(' · ') + ' — !timer ac|kapat <ad>';
        }
        const hedef = liste.find((t) => trKatla(t.name) === trKatla(ad)) || liste.find((t) => trKatla(t.name).startsWith(trKatla(ad)));
        if (!hedef) return `@${message.user.displayName}, "${ad}" adlı zamanlayıcı yok.`;
        const acik = islem === 'ac' || islem === 'on';
        db.prepare('UPDATE timers SET is_enabled = ? WHERE name = ?').run(acik ? 1 : 0, hedef.name);
        const { timerManager } = await import('../timers/timers.js');
        timerManager.reload();
        return `⏱️ "${hedef.name}" zamanlayıcısı ${acik ? 'açıldı' : 'kapatıldı'}.`;
      }

      case 'modul':
      case 'module': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const islem = trKatla(args[0] || '');
        const ad = trKatla(args[1] || '');
        const durum = () => Object.keys(MODULLER).map((m) => `${m} ${settingsCache.getBoolean(`modul_kapali_${m}`, false) ? '⛔' : '✅'}`).join(' · ');
        if (!['ac', 'kapat', 'on', 'off'].includes(islem) || !(ad in MODULLER)) return `🧩 Modüller: ${durum()} — !modul ac|kapat <ad>`;
        const kapali = islem === 'kapat' || islem === 'off';
        settingsCache.set(`modul_kapali_${ad}`, kapali ? 'true' : 'false');
        return `🧩 "${ad}" modülü ${kapali ? 'kapatıldı (komutları yanıt vermez)' : 'açıldı'}.`;
      }

      case 'nukeusername':
      case 'adnuke': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const kalip = (args[0] || '').trim();
        const ceza = (args[1] || '').toLowerCase();
        const kural = kalip ? kelimeKuraliDerle(kalip) : null;
        if (!kural) return 'Kullanım: !nukeusername <ad | bot* | ~/regex/> [saniye | ban] — son 10 dakikada yazanlardan adı uyanlara uygulanır.';
        const simdi = Date.now();
        const adaylar = new Map<string, boolean>();
        for (const m of sonMesajlar.tumu()) {
          if (m.platform !== message.platform || simdi - m.zaman > 10 * 60_000) continue;
          if (kelimeEslesmesi([kural], m.kullanici)) adaylar.set(m.kullanici, (adaylar.get(m.kullanici) ?? false) || m.muaf);
        }
        const hedefler = [...adaylar].filter(([, muaf]) => !muaf).map(([k]) => k).slice(0, 25);
        if (!hedefler.length) return `🧹 Son 10 dakikada adı "${kalip}" ile eşleşen kimse yazmamış.`;
        const { platformManager } = await import('../../platforms/manager.js');
        const p: any = platformManager.getPlatform(message.platform);
        const ban = ceza === 'ban';
        const sure = ban ? 0 : Math.min(1_209_600, Math.max(1, Number(ceza) || 600));
        if (typeof (ban ? p?.banUser : p?.timeoutUser) !== 'function') return `@${message.user.displayName}, ${message.platform} bunu desteklemiyor.`;
        let tamam = 0;
        let hata = '';
        for (const k of hedefler) {
          const r = ban ? await p.banUser(k, `!nukeusername: ${kalip}`) : await p.timeoutUser(k, sure, `!nukeusername: ${kalip}`);
          if (r?.ok) tamam++;
          else hata = r?.hata || hata;
        }
        return `🧹 !nukeusername: ${tamam} hesap ${ban ? 'banlandı' : `${sureyiYaz(sure)} susturuldu`}.${hata ? ` (bazıları uygulanamadı: ${hata})` : ''}`;
      }

      case 'srclear':
      case 'sirabosalt': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const calan = songRequest.getCurrentSong();
        const r = db.prepare('DELETE FROM song_queue WHERE is_played = 0 AND id != ?').run(calan?.id ?? '');
        return `🎵 Şarkı sırası temizlendi (${Number(r.changes) || 0} istek silindi${calan ? '; çalan şarkı sürüyor' : ''}).`;
      }

      case 'emotecount':
      case 'kackez': {
        const s = (args[0] || '').trim();
        if (!s) return 'Kullanım: !emotecount <emote ya da kelime>';
        return `📈 "${s}" bu oturumda ${sohbetIstatistik.say(s)} mesajda geçti.`;
      }

      case 'chatstats':
      case 'sohbetistatistik': {
        if (trKatla(args[0] || '') === 'sifirla' && (message.user.isMod || message.user.isBroadcaster)) {
          sohbetIstatistik.sifirla();
          return '📊 Sohbet istatistikleri sıfırlandı.';
        }
        const o = sohbetIstatistik.ozet();
        if (!o.mesajSayisi) return '📊 Bu oturumda henüz mesaj sayılmadı.';
        const top = o.enCokYazanlar.slice(0, 3).map((k, i) => `${i + 1}. ${k.ad} (${k.sayi})`).join(' ');
        const kelime = o.bulut.slice(0, 3).map((b) => b.sozcuk).join(', ');
        return `📊 ${o.mesajSayisi} mesaj, ${o.kisiSayisi} kişi · En çok yazanlar: ${top}${kelime ? ` · Popüler: ${kelime}` : ''}`;
      }

      case 'skortablo':
      case 'takimskor': {
        const t = skorOku();
        const yetkili = message.user.isMod || message.user.isBroadcaster;
        if (!args.length || !yetkili) return skorMetni(t);
        let yeni: typeof t | null;
        if (trKatla(args[0]) === 'sifirla') yeni = { ...t, takimlar: t.takimlar.map((x) => ({ ...x, skor: 0 })) };
        else if (trKatla(args[0]) === 'ad' && args[1] && args[2]) {
          const i = Number(args[1]) - 1;
          yeni = i >= 0 && i < t.takimlar.length ? { ...t, takimlar: t.takimlar.map((x, j) => (j === i ? { ...x, ad: args.slice(2).join(' ') } : x)) } : null;
        } else yeni = skorKomutu(t, args[0], args[1] || '+1');
        if (!yeni) return 'Kullanım: !skortablo <takım no|adı> [+N|-N|=N] · !skortablo ad <no> <yeni ad> · !skortablo sifirla';
        const kayit = skorYaz(yeni);
        const { wsHub } = await import('../../ws/server.js');
        wsHub.broadcastTo(['all'], { type: 'skor_tablosu', data: kayit });
        return skorMetni(kayit);
      }

      case 'marker':
      case 'isaret': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        // U6: Studio'da an işareti (her platform) + Twitch'te platform işareti
        const not = args.join(' ').slice(0, 120) || `${message.user.displayName} işareti`;
        const { isaretYaniti, studioIsareti } = await import('./isaret.js');
        const twitchIsareti = async () => {
          if (message.platform !== 'twitch') return null;
          const { platformManager } = await import('../../platforms/manager.js');
          const r = await (platformManager.getPlatform('twitch') as any)?.isaretKoy?.(not);
          return r?.ok ? { ok: true as const } : { ok: false as const, hata: String(r?.hata || 'Twitch bağlı değil') };
        };
        const [studio, twitch] = await Promise.all([studioIsareti(not), twitchIsareti()]);
        return isaretYaniti(studio, twitch);
      }

      case 'commercial':
      case 'reklam': {
        if (!message.user.isBroadcaster && !message.user.isMod) return null;
        if (message.platform !== 'twitch') return 'Reklam komutu yalnız Twitch\'te var.';
        const sn = Number(args[0]) || 30;
        const { platformManager } = await import('../../platforms/manager.js');
        const r = await (platformManager.getPlatform('twitch') as any)?.reklamBaslat?.(sn);
        return r?.ok ? `📺 ${Math.min(180, Math.max(30, Math.round(sn / 30) * 30))} sn reklam başladı. Birazdan dönüyoruz!` : `Reklam başlatılamadı: ${r?.hata || 'Twitch bağlı değil'}`;
      }

      case 'oy':
      case 'vote':
      case 'anket': {
        // Mod "!anket Soru | A | B" yazarsa oy değil yeni anket
        if (name === 'anket' && args.join(' ').includes('|') && (message.user.isMod || message.user.isBroadcaster)) return await this.anketAc(args);
        const poll = db.prepare('SELECT * FROM polls WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as any;
        if (!poll) return `@${message.user.displayName}, aktif anket yok.`;
        // Süresi dolmuş ankete oy yok (kapatıcı 5 sn'de bir kapatır; arada gelen oy sayılmasın)
        if (Number(poll.ends_at) > 0 && Date.now() > Number(poll.ends_at)) return `@${message.user.displayName}, anket sona erdi.`;
        const opts = JSON.parse(poll.options || '[]');
        // Komutla da numara ya da şıkkın adı yazılabilir
        const sira = anketOyuCoz(args.join(' '), opts);
        if (sira === null) return `@${message.user.displayName}, oy için sohbete 1-${opts.length} ya da şıkkın adını yaz.`;
        if (!(await anketOyuKaydet(poll, message.user.username, sira))) return `@${message.user.displayName}, zaten oy verdin.`;
        return `@${message.user.displayName}, oyun kaydedildi: ${opts[sira]}`;
      }

      case 'clip': {
        const cfg = extras.getExtrasSettings();
        if (!cfg.clip_enabled) return ayar?.sessiz ? null : `@${message.user.displayName}, !clip kapalı.`;
        if (Date.now() - this.clipLast < (cfg.clip_cooldown || 30) * 1000) return `@${message.user.displayName}, clip komutu beklemede.`;
        const dn = message.user.displayName;
        if (message.platform === 'twitch') {
          const { platformManager } = await import('../../platforms/manager.js');
          const r = await (platformManager.getPlatform('twitch') as any)?.klipOlustur?.();
          if (r?.ok) {
            this.clipLast = Date.now();
            return `🎬 @${dn} klip: ${r.url}`;
          }
          return `@${dn}, klip alınamadı: ${r?.hata || 'Twitch bağlı değil'}`;
        }
        if (message.platform !== 'kick') return `@${dn}, klip şu an Kick ve Twitch'te var.`;
        // Kick: canlı yayının HLS'inden yerel ffmpeg (data/klipler). Bekleme yalnız kayıt başlayınca.
        const sure = klipSuresi(args[0], Number(cfg.clip_default_sec) || 30, Number(cfg.clip_max_sec) || 60);
        const klip = await klipYoneticisi.baslat(message.platform, dn, sure, (metin, dosya) => {
          eventBus.emitBotMessage({ platform: message.platform, channel: message.channel, message: `@${dn} ${metin}` });
          if (!dosya) return;
          try {
            db.prepare(`
              INSERT INTO stream_events (id, platform, event_type, username, display_name, message, metadata, timestamp)
              VALUES (?, ?, 'klip', ?, ?, ?, ?, ?)
            `).run(randomUUID(), message.platform, message.user.username, dn, `🎬 Klip (${sure} sn) — ${dn}`, JSON.stringify({ dosya }), Date.now());
          } catch (e) {
            seyrekUyar('komut:clip', '[Komut] Klip kaydı olaylara yazılamadı', e);
          }
        });
        if (klip.ok) {
          this.clipLast = Date.now();
          return `🎬 @${dn} son ${sure} sn kaydediliyor…`;
        }
        if (klip.sebep === 'mesgul') return `@${dn}, şu an başka bir klip kaydediliyor; birkaç saniye sonra tekrar dene.`;
        if (klip.sebep === 'yayin-yok') return `@${dn}, klip yalnız yayın açıkken alınabilir.`;
        if (klip.sebep === 'ffmpeg-yok') return `@${dn}, klip için ffmpeg yok. Kur: winget install Gyan.FFmpeg`;
        if (klip.sebep === 'adres-yok') return `@${dn}, yayın açık ama Kick klip adresi gelmedi. Biraz sonra tekrar dene.`;
        return `@${dn}, klip alınamadı${klip.hata ? `: ${klip.hata}` : ''}.`;
      }

      // Yayıncı (kanal sahibi) elle puan verir/alır.
      case 'puanver':
      case 'puanekle':
      case 'givepoints': {
        if (!message.user.isBroadcaster) {
          return `@${message.user.displayName}, bu komutu yalnız kanal sahibi kullanabilir.`;
        }
        const target = (args[0] || '').replace('@', '').trim();
        const amount = parseInt(args[1], 10);
        if (!target || isNaN(amount) || amount === 0) {
          return 'Kullanım: !puanver @kullanıcı 100  (eksi vermek için: !puanver @kullanıcı -50)';
        }
        const { user, total } = economy.grantPoints(cuzdanAdi(message.platform, target), amount);
        const yon = amount > 0 ? `+${amount}` : String(amount);
        return `💰 @${user} için ${yon} puan işlendi. Yeni bakiye: ${total}`;
      }

      case 'permit': {
        if (!message.user.isMod && !message.user.isBroadcaster) return `@${message.user.displayName}, permit yalnızca modlar.`;
        const target = (args[0] || '').replace('@', '').toLowerCase();
        if (!target) return 'Kullanım: !permit kullanıcı';
        const sn = permitSuresi();
        this.permits.set(target, Date.now() + sn * 1000);
        return `@${target} ${sn} saniye link paylaşabilir.`;
      }

      case 'quote': {
        const q = extras.randomQuote();
        return q ? `💬 #${String(q.id).slice(0, 6)} ${q.text}` : 'Henüz alıntı yok. !addquote ile ekle.';
      }
      case 'addquote': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const text = args.join(' ');
        if (!text) return 'Kullanım: !addquote metin';
        extras.addQuote(text, message.user.displayName);
        return 'Alıntı eklendi.';
      }
      case 'count':
      case 'sayac': {
        // `!count ölüm reset` sıfırlar (eskiden 0 ekliyordu, sıfırlamıyordu); sıfırlama mod işi
        if (args[1] === 'reset' || args[1] === 'sifirla') {
          if (!message.user.isMod && !message.user.isBroadcaster) return null;
          return `🔢 ${args[0] || 'count'}: ${sayacAyarla(args[0] || 'count', 0)}`;
        }
        const n = extras.bumpCounter(args[0] || 'count', 1) as any;
        return `🔢 ${n.name}: ${n.count}`;
      }

      case 'gerisayim':
      case 'countdown': {
        // Argümansız: herkes kalan süreyi görür. Değiştirmek mod işi
        if (args.length && !message.user.isMod && !message.user.isBroadcaster) return null;
        const { geriSayim } = await import('../engagement/geri-sayim.js');
        return geriSayim.komut(args);
      }
      // NOT: Burada eskiden `watchtime`/`izleme` ve `followage` için SAHTE
      // vakalar vardı; aşağıdaki gerçek uygulamaları GÖLGELİYORDU (switch ilk
      // eşleşeni çalıştırır). Kaldırıldı. Tekrar olmasın diye
      // command-manager.test.ts yinelenen `case` etiketini yakalar.

      // Yayın başlığı / kategorisi. Argümansız: gösterir. Mod/yayıncı
      // argüman verirse komutun geldiği platformda değiştirir.
      case 'title':
      case 'baslik':
        return this.yayinBilgisi('baslik', args.join(' ').trim(), message);
      case 'game':
      case 'category':
      case 'kategori':
        return this.yayinBilgisi('kategori', args.join(' ').trim(), message);

      case 'accountage':
      case 'hesapyasi':
        return this.hesapYasi(args[0] || message.user.username, message);
      case 'cark':
      case 'wheel': {
        // İzleyici çevirebilir; art arda çevirme seli olmasın diye genel bekleme. Bekleme ve puan maliyeti
        // çark widget'ının ayarlarından (eskiden `wheel_cooldown`un panelde ayarı yoktu)
        let carkAyar: { cevirmeBeklemeSn?: unknown; cevirmeMaliyeti?: unknown } = {};
        try {
          // Doğrudan veritabanından: widget ayarı kaydedilince ayar önbelleği yenilenmiyor
          carkAyar = JSON.parse((db.prepare("SELECT value FROM bot_settings WHERE key = 'widget_settings_wheel-of-fortune'").get() as { value?: string } | undefined)?.value || '{}');
        } catch {
          /* bozuk ayar: varsayılanlar */
        }
        const beklemeSn = carkAyar.cevirmeBeklemeSn ?? settingsCache.get('wheel_cooldown', '30');
        const bekleme = Math.min(3600, Math.max(0, Number(beklemeSn) || 0)) * 1000;
        const maliyet = Math.max(0, Math.floor(Number(carkAyar.cevirmeMaliyeti) || 0));
        const yetkili = message.user.isMod || message.user.isBroadcaster;
        if (!yetkili && Date.now() - this.carkSon < bekleme) {
          return `@${message.user.displayName}, çark ${Math.ceil((bekleme - (Date.now() - this.carkSon)) / 1000)} sn sonra yeniden çevrilebilir.`;
        }
        if (!yetkili && maliyet > 0) {
          const cuzdan = cuzdanAdi(message.platform, message.user.username);
          const bakiye = economy.getUserPoints(cuzdan);
          if (bakiye < maliyet) return `@${message.user.displayName}, çarkı çevirmek ${maliyet} puan (bakiyen: ${bakiye}).`;
          economy.removePoints(cuzdan, maliyet);
        }
        this.carkSon = Date.now();
        const { carkCevir } = await import('../engagement/cark.js');
        const sonuc = carkCevir();
        const { wsHub } = await import('../../ws/server.js');
        wsHub.broadcastTo(['all', 'wheel'], { type: 'wheel_spin', payload: { index: sonuc.index, label: sonuc.etiket } });
        if (sonuc.etiket) {
          const zamanlayici = setTimeout(() => {
            eventBus.emitBotMessage({ platform: message.platform, channel: message.channel, message: `🎡 Çark durdu: ${sonuc.etiket}!` });
          }, sonuc.donusMs + 300);
          zamanlayici.unref?.();
        }
        return `🎡 @${message.user.displayName} şans çarkını çevirdi!`;
      }

      case 'sor':
      case 'ask':
      case 'ai': {
        const query = args.join(' ');
        if (!query) return `@${message.user.displayName}, bana ne sormak istiyorsun? Örnek: !sor En iyi oyun hangisi?`;
        return await geminiCoHost.ask(query, message.user.displayName);
      }

      // --- CHAT MINIGAMES ---
      case 'oyunlar':
      case 'games':
        return oyunlarMetni([...this.kapaliYerlesikler(), ...this.modulKapaliYerlesikler()]);

      case 'soygun':
      case 'heist':
        return gamesEngine.handleHeist(message, args);

      case 'yaris':
      case 'race':
      case 'drag':
        return gamesEngine.handleRace(message, args);

      // --- BİL BAKALIM TRIVIA BİLGİ YARIŞMASI ---
      case 'soru':
      case 'trivia':
      case 'bilgi':
      case 'bilgiyarismasi': {
        const oyunAyari = gamesEngine.getSettings();
        if (!oyunAyari.enabledGames.trivia) return `@${message.user.displayName}, Bil Bakalım şu anda devre dışı bırakılmış. ⏸️`;
        const sureSn = oyunAyari.trivia.durationSeconds;
        const state = triviaEngine.getState();
        if (state.status === 'question_active') {
          return `@${message.user.displayName}, zaten aktif bir soru devam ediyor! Kalan süre: ${state.remainingSeconds} sn. Cevap için sohbete A, B, C veya D yazın!`;
        }

        // Sıradaki soruyu bekleyen yarışma bozulmasın (yeni soru onun zamanlayıcısını siliyordu)
        if (state.mode === 'tournament') {
          return `@${message.user.displayName}, bilgi yarışması devam ediyor. Bitmesini bekle ya da moderatör !yarisma durdur yazsın.`;
        }

        // !soru tarih 5: kategori ve soru sayısı. Birden çok soru, !yarisma ile aynı yetkide (izleyici yayını kilitlemesin)
        const { kategori, adet } = triviaArgumanlari(args, parseTriviaCategory);
        const yetkili = message.user.isBroadcaster || message.user.isMod;
        if (adet > 1 && yetkili) {
          triviaEngine.startTournament(kategori, adet, sureSn);
          return null;
        }
        const q = triviaEngine.startQuestion({ category: kategori, durationSec: sureSn });
        if (!q) return `@${message.user.displayName}, soru havuzunda uygun soru bulunamadı.`;
        return adet > 1 ? `@${message.user.displayName}, birden çok soruyu yalnız yayıncı ve moderatörler açabilir; tek soru açıldı.` : null;
      }

      case 'yarisma':
      case 'turnuva': {
        const subCmd = (args[0] || '').toLowerCase();
        const isMod = message.user.isBroadcaster || message.user.isMod;

        if (subCmd === 'durdur' || subCmd === 'bitir' || subCmd === 'iptal') {
          if (!isMod) return `@${message.user.displayName}, yarışmayı yalnızca moderatörler durdurabilir.`;
          triviaEngine.stopGame();
          return `⏹️ Bilgi yarışması yayıncı/moderatör tarafından durduruldu.`;
        }

        if (!isMod) {
          return `@${message.user.displayName}, turnuva başlatmak için moderatör veya yayıncı olmalısınız. Tek soru için: !soru`;
        }

        const secim = triviaArgumanlari(args, parseTriviaCategory, 5);
        triviaEngine.startTournament(secim.kategori, secim.adet, gamesEngine.getSettings().trivia.durationSeconds);
        return null;
      }

      case 'soruatla':
      case 'sorubitir':
      case 'pas': {
        const isMod = message.user.isBroadcaster || message.user.isMod;
        if (!isMod) return `@${message.user.displayName}, soruyu yalnızca moderatörler atlayabilir.`;
        const skipped = triviaEngine.skipQuestion();
        return skipped ? `⏭️ Aktif soru atlandı!` : `Aktif bir soru yok.`;
      }

      case 'triviaskor':
      case 'skor': {
        try {
          const row = db.prepare('SELECT * FROM trivia_scores WHERE username = ?').get(message.user.username.toLowerCase()) as any;
          if (!row || row.total_score === 0) {
            return `@${message.user.displayName}, henüz Bil Bakalım yarışmasında puanın yok. Hemen bir sonraki soruya katıl! 🧠`;
          }
          const fastestSec = row.fastest_ms < 900000 ? (row.fastest_ms / 1000).toFixed(1) + ' sn' : '-';
          return `🧠 @${message.user.displayName} Trivia İstatistiği: Toplam Puan: ${row.total_score} | Doğru: ${row.correct_count} | Yanlış: ${row.wrong_count} | En Hızlı: ${fastestSec} | Mevcut Seri: ${row.current_streak} 🔥 | En İyi Seri: ${row.best_streak} 🏆`;
        } catch {
          return `@${message.user.displayName}, skorun getirilirken hata oluştu.`;
        }
      }

      case 'triviatop':
      case 'bilgitop': {
        try {
          const rows = db.prepare('SELECT display_name, total_score, correct_count, best_streak FROM trivia_scores ORDER BY total_score DESC LIMIT 5').all() as any[];
          if (!rows || rows.length === 0) return 'Henüz trivia sıralamasında kimse yok. İlk puanı sen kap!';
          const list = rows.map((r, i) => `${i + 1}. ${r.display_name} (${r.total_score} Puan - ${r.correct_count} Doğru)`).join(' | ');
          return `🏆 BİL BAKALIM EN İYİLER (TOP 5): ${list}`;
        } catch {
          return 'Liderlik tablosu alınamadı.';
        }
      }

      case 'kelime':
      case 'anagram':
        return gamesEngine.handleAnagram(message);

      case 'balik':
      case 'avla':
      case 'fish':
        return gamesEngine.handleFishing(message);

      case 'kasaac':
      case 'kasa':
      case 'case':
        return gamesEngine.handleCaseOpen(message);

      case 'bomba':
      case 'c4':
        return gamesEngine.handleBomb(message, args);

      case 'kes':
      case 'cut':
        return gamesEngine.handleBomb(message, ['kes', args[0]]);

      case 'yazitura':
      case 'cf':
      case 'coinflip':
        return gamesEngine.handleCoinFlip(message, args);

      case 'zar':
      case 'dice':
        return gamesEngine.handleDice(message, args);

      // --- MISSXSS KRALLIK (KING SYSTEM) ---
      case 'kral':
      case 'taht':
      case 'king': {
        const state = kingSystemService.getKingState();
        if (state.bos) return '👑 Taht şu an boş! Kapmak için: !tahtikap <puan>';
        const mins = Math.floor(state.reignSeconds / 60);
        return `👑 Tahtın Sahibi: @${state.displayName} (${state.pointsBid} puan) | Hüküm Süresi: ${mins} dakika | Tahtı kapmak için: !tahtikap <puan>`;
      }

      case 'tahtikap':
      case 'claimthrone':
      case 'claimking': {
        const bid = parseInt(args[0], 10);
        if (isNaN(bid) || bid <= 0) {
          return `@${message.user.displayName}, tahtı kapmak için puan girmelisiniz: !tahtikap <puan>`;
        }
        const res = await kingSystemService.claimThrone(
          cuzdanAdi(message.platform, message.user.username),
          message.user.displayName,
          bid,
          message.user.avatarUrl,
          undefined,
          message.user.isBroadcaster
        );
        return res.message;
      }

      case 'tahttan_in':
      case 'abdicate': {
        if (message.user.isBroadcaster || message.user.isMod) {
          kingSystemService.resetThrone(message.user.displayName);
          return '👑 Yayın tahtı sıfırlandı!';
        }
        return null;
      }

      case 'komutlar':
      case 'commands':
      case 'yardim':
      case 'help': {
        // Yaygın biçim: !commands add|edit|delete !ad yanıt (mod)
        const altKomut: Record<string, string> = { add: 'addcom', ekle: 'addcom', edit: 'editcom', duzenle: 'editcom', delete: 'delcom', del: 'delcom', remove: 'delcom', sil: 'delcom' };
        const yonlen = altKomut[trKatla(args[0] || '')];
        if (yonlen) return this.executeBuiltIn(yonlen, args.slice(1), message);
        // Yerleşik komutlar tek listeden (yerlesik-komutlar.ts), kapalı olanlar ve kapalı modüllerinkiler çıkarılır;
        // eskiden 7 sabit ad yazılıyordu. `!komutlar oyunlar`: o kategorinin tümü kullanımlarıyla.
        const ozel = db
          .prepare("SELECT name FROM commands WHERE is_enabled = 1 AND COALESCE(trigger_type, 'command') = 'command' ORDER BY use_count DESC, name LIMIT 40")
          .all() as Array<{ name: string }>;
        return komutlarMetni({ kategori: args.join(' ').trim() || undefined, kapali: [...this.kapaliYerlesikler(), ...this.modulKapaliYerlesikler()], ozel: ozel.map((c) => String(c.name)) });
      }

      // ---- Topluluk tahminleri: !tahmin (eski adı !bahis da çalışır) --------
      case 'tahmin':
      case 'bahis': {
        const alt = (args[0] || '').toLowerCase();
        const mod = message.user.isBroadcaster || message.user.isMod;

        if (alt === 'create' || alt === 'ac') {
          if (!mod) return null;
          const kalan = args.slice(1).join(' ');
          const [baslik, ...sec] = kalan.split('|').map((x) => x.trim());
          const t = tahminler.olustur(baslik || 'Tahmin', sec.length ? sec : ['Evet', 'Hayır']);
          if ('hata' in t) return `@${message.user.displayName}, ${t.hata}`;
          return `🎲 Tahmin açıldı: ${t.baslik} → ${t.secenekler.map((x, i) => `${i + 1}) ${x}`).join(' ')} · Katıl: !tahmin <seçenek> <puan>`;
        }

        if (alt === 'result' || alt === 'sonuc') {
          if (!mod) return null;
          const r = tahminler.sonuclandir(args.slice(1).join(' '));
          if (!r.ok) return `@${message.user.displayName}, ${r.hata}`;
          return `🏆 Kazanan: ${r.secenek} · ${r.kazananlar} kişiye toplam ${r.dagitilan} puan dağıtıldı!`;
        }

        if (alt === 'lock' || alt === 'kilit') {
          if (!mod) return null;
          return tahminler.kilitle() ? '🔒 Bahisler kapandı.' : 'Açık tahmin yok.';
        }

        if (alt === 'cancel' || alt === 'iptal') {
          if (!mod) return null;
          const r = tahminler.iptal();
          return r.ok ? `↩️ Tahmin iptal edildi, ${r.iade} puan iade edildi.` : 'Açık tahmin yok.';
        }

        if (!alt) {
          const d = tahminler.durum();
          if (!d.tahmin) return 'Şu an açık bir tahmin yok.';
          return `🎲 ${d.tahmin.baslik} · ${d.tahmin.secenekler.map((x, i) => `${x}: ${d.secenekToplam[i]}p`).join(' · ')} · Havuz: ${d.havuz}`;
        }

        const r = tahminler.bahisKoy(cuzdanAdi(message.platform, message.user.username), message.user.displayName, alt, Number(args[1]));
        if (!r.ok) return `@${message.user.displayName}, ${r.hata}`;
        return `✅ @${message.user.displayName} "${r.secenek}" için ${r.puan} puan yatırdı.`;
      }

      // ---- Izleyici kuyrugu (örnek alınan bot: !joinq ailesi) ------------------------
      case 'joinq':
      case 'sirayagir': {
        const r = kuyruk.katil(message.user.username, message.user.displayName, message.platform, {
          isSub: message.user.isSub,
          isVip: message.user.isVip,
          isMod: message.user.isMod,
          isBroadcaster: message.user.isBroadcaster
        });
        return r.ok ? `🎟️ @${message.user.displayName} kuyruğa girdi · Sıra: ${r.sira}` : `@${message.user.displayName}, ${r.hata}`;
      }

      case 'leaveq':
      case 'siradancik':
        return kuyruk.ayril(message.user.username)
          ? `👋 @${message.user.displayName} kuyruktan çıktı.`
          : `@${message.user.displayName}, kuyrukta değilsin.`;

      case 'posq':
      case 'siram': {
        const n = kuyruk.sira(message.user.username);
        return n > 0 ? `🎟️ @${message.user.displayName}, sıran: ${n}` : `@${message.user.displayName}, kuyrukta değilsin.`;
      }

      // NOT: `!queue` ve `!sira` ZATEN sarki istegi kuyruguna ait (yukarida,
      // satir ~217). Izleyici kuyruguna ayri adlar verildi; aksi halde
      // switch ilk esleseni calistirdigi icin bu dal hic calismiyordu.
      case 'listq':
      case 'siradakiler':
      case 'kuyruk': {
        const l = kuyruk.liste();
        if (!l.length) return 'Kuyruk boş.';
        return `🎟️ Kuyruk (${l.length}): ${l.slice(0, 10).map((k, i) => `${i + 1}. ${k.gorunenAd}`).join(' · ')}`;
      }

      case 'openq':
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        kuyruk.ac();
        return '🎟️ Kuyruk açıldı! Katılmak için: !joinq';

      case 'closeq':
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        kuyruk.kapat();
        return '🔒 Kuyruk yeni katılımlara kapatıldı.';

      case 'nextq': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const k = kuyruk.sonraki();
        return k ? `➡️ Sıradaki: @${k.gorunenAd}` : 'Kuyruk boş.';
      }

      case 'removeq': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const hedef = (args[0] || '').replace(/^@/, '');
        if (!hedef) return 'Kullanım: !removeq <kullanıcı>';
        return kuyruk.ayril(hedef) ? `🗑️ ${hedef} kuyruktan çıkarıldı.` : `${hedef} kuyrukta değil.`;
      }

      case 'clearq': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const n = kuyruk.temizle();
        return `🧹 Kuyruk temizlendi (${n} kişi).`;
      }

      // ---- Puan dususu (örnek alınan bot: !pdrops) ----------------------------------
      case 'pdrops':
      case 'puandususu': {
        const ayar = puanDususu.ayarOku();
        const yetkili = message.user.isBroadcaster || (message.user.isMod && ayar.modBaslatabilir);
        const alt = (args[0] || 'status').toLowerCase();

        if (alt === 'status' || alt === 'durum') {
          const d = puanDususu.durum();
          return d.aktif
            ? `🎁 Puan düşüşü açık! "${d.anahtar}" yaz · ${d.katilanlar.length} kişi · ${d.kalanSaniye} sn kaldı`
            : 'Şu an açık bir puan düşüşü yok.';
        }

        if (!yetkili) return null;

        if (alt === 'start' || alt === 'basla') {
          const r = puanDususu.baslat();
          if (!r.ok) return `@${message.user.displayName}, ${r.hata}`;
          return `🎁 PUAN DÜŞÜŞÜ! İlk ${ayar.maksKisi || '∞'} kişi "${ayar.anahtar}" yazsın · ${ayar.toplamPuan} puan dağıtılacak!`;
        }

        if (alt === 'stop' || alt === 'dur') {
          return puanDususu.durdur().iptal ? '🛑 Puan düşüşü iptal edildi.' : 'Açık düşüş yok.';
        }

        return null;
      }

      // ---- Seviye sistemi ------------------------------------------------
      case 'seviye2':
      case 'xp': {
        const hedef = (args[0] || message.user.username).replace(/^@/, '');
        const k = seviyeler.kullanici(cuzdanAdi(message.platform, hedef));
        if (!seviyeler.ayarOku().aktif) return `@${message.user.displayName}, seviye sistemi kapalı.`;
        return `⭐ ${k.displayName} · Seviye ${k.seviye} · ${k.buSeviyedeXp}/${k.sonrakiIcinXp} XP (%${k.yuzde})`;
      }

      case 'seviyeler':
      case 'toplevel': {
        const liste = seviyeler.siralama(5);
        if (!liste.length) return 'Henüz seviye kaydı yok.';
        return `🏆 Seviye sıralaması: ${liste.map((u, i) => `${i + 1}. ${u.displayName} (Sv.${u.seviye})`).join(' · ')}`;
      }

      // ---- örnek alınan bot karsiligi olan yerlesik komutlar (rakip incelemesi) -------------
      case 'uptime':
      case 'yayinsuresi':
        // Yayın kapalıyken "X önce başladı" demek yanlış bilgiydi
        if (yayinAcikMi() === false) return '📴 Yayın şu an kapalı.';
        return `⏱️ Yayın ${getStreamUptime()} önce başladı.`;

      case 'watchtime':
      case 'izleme': {
        const hedef = (args[0] || message.user.username).replace(/^@/, '');
        const r = db
          .prepare('SELECT display_name, watch_time_minutes FROM economy WHERE LOWER(username) = LOWER(?)')
          .get(cuzdanAdi(message.platform, hedef)) as { display_name?: string; watch_time_minutes?: number } | undefined;
        if (!r) return `@${message.user.displayName}, ${hedef} için izleme kaydı yok.`;
        const dk = Number(r.watch_time_minutes) || 0;
        const sa = Math.floor(dk / 60);
        return `⏳ ${r.display_name || hedef} bu kanalı ${sa > 0 ? `${sa} saat ` : ''}${dk % 60} dakika izledi.`;
      }

      case 'followers':
      case 'takipci':
      case 'takipciler':
        return await this.takipciSayisi(message);

      case 'followage':
      case 'takipsuresi': {
        const hedef = (args[0] || message.user.username).replace(/^@/, '');
        const r = db
          .prepare(
            "SELECT timestamp FROM stream_events WHERE event_type = 'follow' AND LOWER(username) = LOWER(?) ORDER BY timestamp ASC LIMIT 1"
          )
          .get(hedef) as { timestamp?: number } | undefined;
        if (!r?.timestamp) {
          return `@${message.user.displayName}, ${hedef} için takip kaydı bulunamadı.`;
        }
        const gun = Math.floor((Date.now() - Number(r.timestamp)) / 86400000);
        return `💜 ${hedef} bu kanalı ${gun} gündür takip ediyor.`;
      }

      case 'so':
      case 'promo': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const kanal = (args[0] || '').replace(/^@/, '').trim();
        if (!kanal) return `@${message.user.displayName}, kullanim: !so <kanal>`;
        // Overlay'deki Shoutout widget'ini da tetikle
        void shoutoutGonder(kanal, message.platform).catch((e) => seyrekUyar('shoutout:widget', '[Komut] Shoutout widget bildirimi başarısız', e));
        return shoutoutMetni(kanal, message.platform);
      }

      // `sayac` burada da vardı ama yukarıdaki `count`/`sayac` onu gölgeliyordu
      case 'editcounter':
      case 'sayacduzenle': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const ad = (args[0] || '').trim();
        if (!ad) return `@${message.user.displayName}, kullanim: !editcounter <ad> <deger>`;
        if (args[1] === undefined) return `🔢 ${ad}: ${sayacAl(ad)}`;
        const ifade = sayacIfadesi(args[1]);
        const yeniDeger =
          ifade.tur === 'fark' ? sayacDegistir(ad, ifade.deger) : sayacAyarla(ad, ifade.deger);
        return `🔢 ${ad}: ${yeniDeger}`;
      }

      case 'addcom':
      case 'komutekle': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const ad = (args[0] || '').replace(/^!/, '').trim().toLowerCase();
        const yanit = args.slice(1).join(' ').trim();
        if (!ad || !yanit) return `@${message.user.displayName}, kullanim: !addcom !merhaba Selam $(sender)`;
        const var_ = db.prepare('SELECT id FROM commands WHERE LOWER(name) = ?').get(ad);
        if (var_) return `@${message.user.displayName}, !${ad} zaten var. !editcom kullan.`;
        db.prepare(
          'INSERT INTO commands (id, name, response, user_level, cooldown, is_enabled) VALUES (?, ?, ?, ?, ?, 1)'
        ).run(randomUUID(), ad, yanit, 'everyone', 5);
        this.reload();
        return `✅ !${ad} komutu eklendi.`;
      }

      case 'editcom':
      case 'komutduzenle': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const ad = (args[0] || '').replace(/^!/, '').trim().toLowerCase();
        const yanit = args.slice(1).join(' ').trim();
        if (!ad || !yanit) return `@${message.user.displayName}, kullanim: !editcom !merhaba Yeni yanit`;
        const sonuc = db.prepare('UPDATE commands SET response = ? WHERE LOWER(name) = ?').run(yanit, ad);
        if (!sonuc.changes) return `@${message.user.displayName}, !${ad} bulunamadı.`;
        this.reload();
        return `✅ !${ad} güncellendi.`;
      }

      case 'delcom':
      case 'komutsil': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const ad = (args[0] || '').replace(/^!/, '').trim().toLowerCase();
        if (!ad) return `@${message.user.displayName}, kullanim: !delcom merhaba`;
        const sonuc = db.prepare('DELETE FROM commands WHERE LOWER(name) = ?').run(ad);
        if (!sonuc.changes) return `@${message.user.displayName}, !${ad} bulunamadı.`;
        this.reload();
        return `🗑️ !${ad} silindi.`;
      }

      // ---- Yaygın botlarda gözlenen, AxBoT'da eksik komutlar (2026-10) ----

      // Toplu moderasyon: son 3 dk'da kalıba uyan mesajları sil / yazanları sustur
      case 'nuke': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const { kalip, sureSn } = nukeArgumanlari(args);
        if (!kalip) {
          return 'Kullanım: !nuke <kelime | test* | ~/regex/> [saniye] — saniye verirsen yazanlar susturulur, vermezsen mesajlar silinir.';
        }
        const { hedefler, gecersiz } = nukeHedefleri(sonMesajlar.tumu(), kalip, Date.now(), undefined, message.platform);
        if (gecersiz) return `@${message.user.displayName}, kalıp geçersiz ya da riskli (iç içe niceleyici).`;
        if (!hedefler.length) return `🧹 Son 3 dakikada "${kalip}" ile eşleşen mesaj yok.`;
        const { platformManager } = await import('../../platforms/manager.js');
        const p: any = platformManager.getPlatform(message.platform);
        const kisiler = new Set<string>();
        let silinen = 0;
        let hata = '';
        if (sureSn > 0) {
          if (typeof p?.timeoutUser !== 'function') return `@${message.user.displayName}, ${message.platform} zaman aşımını desteklemiyor.`;
          for (const k of new Set(hedefler.map((h) => h.kullanici))) {
            if (kisiler.size >= 20) break;
            const r = await p.timeoutUser(k, sureSn, `!nuke: ${kalip}`.slice(0, 100));
            if (r?.ok) kisiler.add(k);
            else hata = r?.hata || hata;
          }
        } else {
          if (typeof p?.deleteMessage !== 'function') return `@${message.user.displayName}, ${message.platform} mesaj silmeyi desteklemiyor.`;
          // Tek komutla en çok 100 silme isteği (platform hız sınırına takılmasın)
          for (const h of hedefler.slice(-100)) {
            const r = await p.deleteMessage(h.id);
            if (r?.ok) {
              silinen++;
              kisiler.add(h.kullanici);
            } else hata = r?.hata || hata;
          }
        }
        sonMesajlar.cikar(new Set(hedefler.map((h) => h.id)));
        const ek = hata ? ` (bazıları uygulanamadı: ${hata})` : '';
        return sureSn > 0
          ? `🧹 !nuke: ${kisiler.size} kişi ${sureyiYaz(sureSn)} susturuldu.${ek}`
          : `🧹 !nuke: ${silinen} mesaj silindi (${kisiler.size} kişi).${ek}`;
      }

      // İzleyici kendi son mesajlarını sildirir
      case 'vanish':
      case 'kaybol': {
        if (message.user.isMod || message.user.isBroadcaster) return null;
        const { platformManager } = await import('../../platforms/manager.js');
        const p: any = platformManager.getPlatform(message.platform);
        if (typeof p?.deleteMessage !== 'function') return null;
        const kendi = kendiMesajlari(sonMesajlar.tumu(), message.user.username, message.platform, Date.now());
        for (const m of kendi) await p.deleteMessage(m.id);
        if (message.id) await p.deleteMessage(String(message.id));
        sonMesajlar.cikar(new Set(kendi.map((m) => m.id)));
        return null;
      }

      // Düzenli izleyiciler: !regulars add|remove|list @kişi
      case 'regulars':
      case 'duzenli': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const alt = (args[0] || 'list').toLowerCase();
        const hedef = (args[1] || '').replace(/^@+/, '');
        if (alt === 'add' || alt === 'ekle') {
          const r = duzenliler.ekle(message.platform, hedef, message.user.username);
          if (r === 'gecersiz') return 'Kullanım: !regulars add @kullanıcı';
          return r === 'zaten' ? `@${hedef} zaten düzenli izleyici.` : `✅ @${hedef} düzenli izleyicilere eklendi.`;
        }
        if (alt === 'remove' || alt === 'delete' || alt === 'sil' || alt === 'cikar') {
          if (!hedef) return 'Kullanım: !regulars remove @kullanıcı';
          return duzenliler.cikar(message.platform, hedef) ? `🗑️ @${hedef} düzenli izleyicilerden çıkarıldı.` : `@${hedef} listede yok.`;
        }
        const liste = duzenliler.listele(message.platform).map((r) => r.username);
        return liste.length
          ? `Düzenli izleyiciler (${liste.length}): ${liste.slice(0, 25).join(', ')}${liste.length > 25 ? ' …' : ''}`
          : 'Henüz düzenli izleyici yok. Eklemek için: !regulars add @kullanıcı';
      }

      // Oylu susturma (yaygın !votekick) — ayar votekick_enabled (varsayılan kapalı)
      case 'votekick':
      case 'oylasustur': {
        if (!settingsCache.getBoolean('votekick_enabled', false)) return null;
        const ilk = (args[0] || '').toLowerCase();
        if ((ilk === 'iptal' || ilk === 'cancel') && (message.user.isMod || message.user.isBroadcaster)) {
          const h = votekick.iptal();
          return h ? `🛑 @${h} için oylama iptal edildi.` : 'Açık oylama yok.';
        }
        const simdi = Date.now();
        votekick.zamanAsimi(simdi);
        const hedefAd = (args[0] || '').replace(/^@+/, '').toLowerCase();
        // Yeni oylama açılırken hedef korunur: son 3 dk'da yazmış olmalı, mod/yayıncı/bot olamaz
        if (hedefAd && !votekick.durum()) {
          const { platformManager } = await import('../../platforms/manager.js');
          if ([...platformManager.botKullaniciAdlari()].some((b) => b.toLowerCase() === hedefAd)) {
            return `@${message.user.displayName}, bota oylama açılamaz.`;
          }
          const sonMesaj = [...sonMesajlar.tumu()]
            .reverse()
            .find((m) => m.platform === message.platform && m.kullanici.toLowerCase() === hedefAd && simdi - m.zaman < 180_000);
          if (!sonMesaj) return `@${message.user.displayName}, @${hedefAd} son 3 dakikada yazmamış; oylama açılamaz.`;
          if (sonMesaj.muaf) return `@${message.user.displayName}, moderatör/yayıncı için oylama açılamaz.`;
        }
        const r = votekick.oyVer(message.platform, message.user.username, args[0], simdi);
        const sure = ayarSayi('votekick_timeout', 300, 10, 86_400);
        // (iç switch yerine if: yerleşik komut etiketi testi `case` adlarını sayar)
        if (r.tur === 'gecersiz') {
          return `Kullanım: !votekick @kullanıcı — ${ayarSayi('votekick_threshold', 5, 1, 100)} oy toplanırsa ${sureyiYaz(sure)} susturulur.`;
        }
        if (r.tur === 'baska-oylama') return `Şu an @${r.hedef} için oylama açık; oy vermek için !votekick yaz.`;
        if (r.tur === 'bekleme') return `@${r.hedef} için yeni oylama ${Math.ceil(r.kalanMs / 60_000)} dk sonra açılabilir.`;
        if (r.tur === 'zaten-oy') return null;
        if (r.tur === 'oy') return `🗳️ @${r.hedef}: ${r.oy}/${r.esik} oy.`;
        if (r.tur === 'basladi') {
          const pencere = ayarSayi('votekick_window', 60, 10, 600);
          const zamanlayici = setTimeout(() => {
            const kapanan = votekick.zamanAsimi(Date.now());
            if (kapanan) {
              eventBus.emitBotMessage({
                platform: message.platform,
                channel: message.channel,
                message: `⌛ @${kapanan} için oylama yetersiz oyla kapandı.`
              });
            }
          }, pencere * 1000 + 50);
          zamanlayici.unref?.();
          return `🗳️ @${message.user.displayName}, @${r.hedef} için susturma oylaması başlattı (${r.oy}/${r.esik}). Katılmak için ${pencere} sn içinde !votekick yaz.`;
        }
        // r.tur === 'tamam'
        const { platformManager } = await import('../../platforms/manager.js');
        const p: any = platformManager.getPlatform(message.platform);
        if (typeof p?.timeoutUser !== 'function') return `${message.platform} zaman aşımını desteklemiyor.`;
        const t = await p.timeoutUser(r.hedef, sure, `!votekick (${r.oy} oy)`);
        return t?.ok
          ? `🔨 Topluluk karar verdi: @${r.hedef} ${sureyiYaz(sure)} susturuldu (${r.oy} oy).`
          : `Oylama tamamlandı ama susturulamadı: ${t?.hata || 'bilinmeyen hata'}`;
      }

      // Emote bingo: !bingo start [emote …] [ödül] · !bingo stop · !bingo
      case 'bingo': {
        const alt = (args[0] || '').toLowerCase();
        const yetkili = message.user.isMod || message.user.isBroadcaster;
        if ((alt === 'start' || alt === 'baslat') && yetkili) {
          const girilen = args.slice(1).map((a) => emoteAdlari(a));
          const odul = girilen.length && /^\d+$/.test(girilen[girilen.length - 1]) ? Number(girilen.pop()) : 0;
          const secenekler = girilen.length ? girilen : [...yediTv.adlar()].sort(() => Math.random() - 0.5).slice(0, 8);
          const r = bingo.baslat(secenekler, odul, Date.now());
          if (!r.ok) return `Bingo başlamadı: ${r.sebep}. Örnek: !bingo start KEKW PogU LUL 500`;
          const d = bingo.durum();
          return `🎲 EMOTE BINGO! Gizli emote şunlardan biri: ${d?.secenekler.join(' ')} — ilk bilen kazanır${d?.odul ? ` (${d.odul} puan)` : ''}!`;
        }
        if ((alt === 'stop' || alt === 'durdur') && yetkili) {
          const g = bingo.durdur();
          return g ? `🛑 Bingo bitti. Gizli emote: ${g}` : 'Açık bingo yok.';
        }
        const d = bingo.durum();
        return d ? `🎲 Bingo sürüyor: ${d.secenekler.join(' ')}` : 'Şu an bingo yok.';
      }

      // Kappagen: overlay'de emote patlaması. Mod ücretsiz; izleyici kappagen_cost puan öder (0 = yalnız mod)
      case 'kappagen':
      case 'emotepatlat': {
        const yetkili = message.user.isMod || message.user.isBroadcaster;
        const ucret = ayarSayi('kappagen_cost', 0, 0, 1_000_000);
        if (!yetkili && ucret <= 0) return null;
        let emoteler = metindenEmoteler(args.join(' '), 5);
        if (!emoteler.length) {
          const h = yediTv.harita();
          const adlar = [...h.keys()].sort(() => Math.random() - 0.5).slice(0, 5);
          emoteler = adlar.length ? adlar.map((ad) => ({ ad, url: h.get(ad) })) : [{ ad: '🎉' }, { ad: '🔥' }, { ad: '💜' }];
        }
        if (!yetkili) {
          if (economy.getUserPoints(cuzdanAdi(message.platform, message.user.username)) < ucret) {
            return `@${message.user.displayName}, kappagen için ${ucret} puan gerekli.`;
          }
          economy.removePoints(cuzdanAdi(message.platform, message.user.username), ucret);
        }
        kappagenGonder(emoteler, true);
        return null;
      }

      // Sohbetten rastgele bir kazanan (son aktif izleyiciler)
      case 'winner':
      case 'kazanan': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const kazanan = rastgeleIzleyici();
        return kazanan ? `🎉 Kazanan: @${kazanan}!` : 'Sohbette henüz seçilebilecek izleyici yok.';
      }

      // İzleyiciden izleyiciye puan gönderme
      case 'puangonder':
      case 'transfer':
      case 'gonder': {
        const hedef = (args[0] || '').replace(/^@/, '').trim();
        const miktar = Math.floor(Number(args[1]));
        // Ad doğrulanır: rastgele metinle (boşluk, işaret) yeni izleyici kaydı açılmasın
        if (!/^[\p{L}\p{N}_.-]{1,40}$/u.test(hedef) || !Number.isFinite(miktar) || miktar <= 0) {
          return `@${message.user.displayName}, kullanım: !puangonder @kullanıcı 100`;
        }
        if (hedef.toLowerCase() === message.user.username.toLowerCase()) {
          return `@${message.user.displayName}, kendine puan gönderemezsin.`;
        }
        if (miktar > 1_000_000) return `@${message.user.displayName}, tek seferde en çok 1.000.000 puan gönderilebilir.`;
        const bakiye = economy.getUserPoints(cuzdanAdi(message.platform, message.user.username));
        if (bakiye < miktar) return `@${message.user.displayName}, yetersiz puan (bakiye: ${bakiye}).`;
        economy.removePoints(cuzdanAdi(message.platform, message.user.username), miktar);
        economy.addPoints(cuzdanAdi(message.platform, hedef), miktar);
        return `💸 @${message.user.displayName} → @${hedef}: ${miktar} puan gönderildi.`;
      }

      // Şarkı kuyruğu: sıram / yanlış şarkı / şarkı sil
      case 'when':
      case 'sarkisiram': {
        const satirlar = db
          .prepare('SELECT requested_by FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC')
          .all() as Array<{ requested_by: string }>;
        const sira = satirlar.findIndex((s) => String(s.requested_by).toLowerCase() === message.user.username.toLowerCase());
        if (sira < 0) return `@${message.user.displayName}, kuyrukta şarkın yok.`;
        return sira === 0
          ? `@${message.user.displayName}, şarkın şu an çalıyor 🎵`
          : `@${message.user.displayName}, şarkın kuyrukta ${sira + 1}. sırada (önünde ${sira} şarkı var).`;
      }

      case 'wrongsong':
      case 'yanlissarki': {
        const satirlar = db
          .prepare('SELECT id, title, requested_by FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC')
          .all() as Array<{ id: string; title: string; requested_by: string }>;
        const benim = satirlar
          .map((s, i) => ({ ...s, i }))
          .filter((s) => String(s.requested_by).toLowerCase() === message.user.username.toLowerCase());
        const son = benim[benim.length - 1];
        if (!son) return `@${message.user.displayName}, kuyrukta şarkın yok.`;
        if (son.i === 0) return `@${message.user.displayName}, şarkın şu an çalıyor; atlamak için !skip.`;
        db.prepare('DELETE FROM song_queue WHERE id = ?').run(son.id);
        return `🗑️ @${message.user.displayName}, "${son.title}" kuyruktan çıkarıldı.${await songRequest.iadeEt(son.id)}`;
      }

      case 'removesong':
      case 'sarkisil': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const hedef = (args[0] || '').trim();
        if (!hedef) return 'Kullanım: !removesong <sıra no | @kullanıcı>';
        const satirlar = db
          .prepare('SELECT id, title, requested_by FROM song_queue WHERE is_played = 0 ORDER BY created_at ASC')
          .all() as Array<{ id: string; title: string; requested_by: string }>;
        if (/^\d+$/.test(hedef)) {
          const s = satirlar[Number(hedef) - 1];
          if (!s) return `Kuyrukta ${hedef}. sıra yok.`;
          if (Number(hedef) === 1) return 'Çalan şarkı için !skip kullan.';
          db.prepare('DELETE FROM song_queue WHERE id = ?').run(s.id);
          return `🗑️ ${hedef}. sıradaki "${s.title}" çıkarıldı.`;
        }
        const kim = hedef.replace(/^@/, '').toLowerCase();
        const silinecek = satirlar.slice(1).filter((s) => String(s.requested_by).toLowerCase() === kim);
        for (const s of silinecek) db.prepare('DELETE FROM song_queue WHERE id = ?').run(s.id);
        return silinecek.length ? `🗑️ @${kim} kullanıcısının ${silinecek.length} şarkısı çıkarıldı.` : `@${kim} kuyrukta şarkısı yok.`;
      }

      // Uyarı denemeleri (OBS'te ve sohbette örnek uyarı)
      case 'followtest':
      case 'subtest':
      case 'tiptest':
      case 'raidtest': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const tur = name.replace('test', '');
        const { widgetTesti } = await import('../../api/rotalar/widgetlar.js');
        widgetTesti(tur, { username: 'TestIzleyici', amount: 50, currency: 'TL', viewers: 25 });
        return null;
      }

      // Uyarı kutusunu sohbetten yönet
      case 'alerts':
      case 'uyarilar': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const esle: Record<string, string> = {
          mute: 'mute', sustur: 'mute', unmute: 'unmute', ac: 'unmute', skip: 'skip', atla: 'skip',
          pause: 'pause', duraklat: 'pause', resume: 'resume', devam: 'resume'
        };
        const eylem = esle[trKatla(args[0] || '')];
        if (!eylem) return 'Kullanım: !alerts mute | unmute | skip | pause | resume';
        const { wsHub } = await import('../../ws/server.js');
        const r = wsHub.uyariKontrolEt(eylem, message.user.displayName);
        const ad: Record<string, string> = {
          mute: '🔇 Uyarı sesi kapatıldı', unmute: '🔊 Uyarı sesi açıldı', skip: '⏭️ Uyarı atlandı',
          pause: '⏸️ Uyarılar duraklatıldı', resume: '▶️ Uyarılar devam ediyor'
        };
        return r.ok ? ad[eylem] : `Uyarı denetimi uygulanamadı: ${(r as any).mesaj}`;
      }

      // Botu geçici sustur (komut yanıtları ve otomatik mesajlar sohbete gitmez)
      case 'bot': {
        if (!message.user.isMod && !message.user.isBroadcaster) return null;
        const alt = trKatla(args[0] || '');
        if (alt === 'mute' || alt === 'sustur') {
          eventBus.emitBotMessage({ platform: message.platform, channel: message.channel, message: '🔇 Bot susturuldu — açmak için !bot unmute', sessizdeBile: true });
          settingsCache.set('bot_sessiz', '1');
          return null;
        }
        if (alt === 'unmute' || alt === 'ac') {
          settingsCache.set('bot_sessiz', '0');
          eventBus.emitBotMessage({ platform: message.platform, channel: message.channel, message: '🔊 Bot yeniden konuşuyor.', sessizdeBile: true });
          return null;
        }
        return 'Kullanım: !bot mute | unmute';
      }

      default:
        return null;
    }
  }

  /**
   * @param acikCagri `!komut` ile mi çağrıldı? Anahtar kelimeyle
   *   tetiklenince reddetmeler SESSİZ olur — sohbette bir kelime yazan
   *   izleyiciye "yetkin yok" diye cevap verilmez.
   */
  private async executeCustomCommand(
    cmd: any,
    args: string[],
    message: ChatMessagePayload,
    acikCagri = true
  ): Promise<string | null> {
    // Reddetme yanıtı yalnız `!komut` ile çağrılınca ve komutta kapatılmamışsa yazılır
    const yanitla = acikCagri && Number(cmd.refusal_reply ?? 1) !== 0;
    // 1) Yetki
    if (!this.hasPermission(cmd.user_level, message)) {
      if (!yanitla) return null;
      return `@${message.user.displayName}, bu komutu kullanma yetkiniz yok (${cmd.user_level}).`;
    }

    // 1b) Erişim kipi: her zaman / yalnız yayında / yalnız yayın kapalıyken
    const kip = String(cmd.access_mode || 'always');
    if (!erisimUygunMu(kip, canliDurum.genel().canli)) {
      return yanitla ? `@${message.user.displayName}, ${erisimAciklamasi(kip)}.` : null;
    }

    // 1c) Seviye şartı (Seviye / XP sistemi açıksa)
    const minSeviye = Math.max(0, Number(cmd.min_level) || 0);
    if (minSeviye > 0 && !message.user.isBroadcaster && seviyeler.ayarOku().aktif) {
      const sv = seviyeler.kullanici(cuzdanAdi(message.platform, message.user.username)).seviye;
      if (sv < minSeviye) {
        return yanitla
          ? `@${message.user.displayName}, bu komut için seviye ${minSeviye} gerekiyor (seninki ${sv}).`
          : null;
      }
    }

    const ayricalikli = message.user.isBroadcaster || message.user.isMod;

    // 2) Platform filtresi — komut yalnız secili platformlarda calisir.
    //    Bos liste "tum platformlar" demektir (geriye uyum).
    const platformlar = String(cmd.platforms || '').trim();
    if (platformlar) {
      const izinli = platformlar.split(',').map((p: string) => p.trim().toLowerCase()).filter(Boolean);
      if (izinli.length && !izinli.includes(String(message.platform).toLowerCase())) {
        return null;
      }
    }

    // 3) Bekleme suresi. `cooldown_mode` = 'global' | 'user'
    const now = Date.now();
    const cdKey = `${cmd.id}_${message.user.username}`;
    const globalKey = `${cmd.id}_global`;
    const beklemeKipi = String(cmd.cooldown_mode || 'global');
    // Eskiden `Number(cmd.cooldown) || 5` idi: kayıtlı 0 bile 5 sn'ye
    // dönüyordu, "beklemesiz komut" yazılamıyordu. Artık 0 = beklemesiz.
    // Anahtar kelime tetiklemesinde sel olmasın diye en az 3 sn uygulanır.
    const hamBekleme = Number(cmd.cooldown);
    const tabanSn = Number.isFinite(hamBekleme) && hamBekleme >= 0 ? hamBekleme : 5;
    const genelSn = acikCagri ? tabanSn : Math.max(3, tabanSn);
    const kisiSn = Number(cmd.user_cooldown) || genelSn;

    if (!ayricalikli) {
      const mevcut = beklemeKipi === 'user' ? this.userCooldowns.get(cdKey) : this.globalCooldowns.get(globalKey);
      if (mevcut && mevcut.expiresAt > now) {
        const kalan = Math.ceil((mevcut.expiresAt - now) / 1000);
        return yanitla && this.birKezUyar(`o:${beklemeKipi === 'user' ? cdKey : globalKey}`, mevcut.expiresAt)
          ? `@${message.user.displayName}, !${cmd.name} için ${kalan} sn bekle.`
          : null;
      }
    }

    // 4) Puan maliyeti — bekleme yazilmadan ONCE tahsil edilir ki yetersiz
    //    bakiyede komut bekleme suresini tuketmesin.
    // Anahtar kelimeyle tetiklenince puan ALINMAZ: izleyici yalnız bir kelime
    // yazdı diye ücretlendirilmemeli. `!komut` biçimi normal ücretlenir.
    const maliyet = acikCagri ? Math.max(0, Number(cmd.cost_points) || 0) : 0;
    if (maliyet > 0 && !message.user.isBroadcaster) {
      const bakiye = economy.getUserPoints(cuzdanAdi(message.platform, message.user.username));
      if (bakiye < maliyet) {
        return `@${message.user.displayName}, bu komut ${maliyet} puan gerektiriyor (bakiyen: ${bakiye}).`;
      }
      economy.addPoints(cuzdanAdi(message.platform, message.user.username), -maliyet);
    }

    this.globalCooldowns.set(globalKey, { expiresAt: now + genelSn * 1000 });
    this.userCooldowns.set(cdKey, { expiresAt: now + kisiSn * 1000 });

    // 5) Degiskenler: once ESKI `{user}` bicimi (geriye uyum), sonra yeni
    //    `$(...)` motoru. Eski sablonlar oldugu gibi calismaya devam eder.
    // `{{...}}` (çift süslü parantez) söz dizimi eski `{user}` ayrıştırıcısından ÖNCE çevrilir;
    // yoksa `{{username}}` içindeki `{username}` yarım yerleştirilir.
    const eskiBicim = await parseVariables(ciftParantezCevir(cmd.response), {
      message,
      commandName: cmd.name,
      args,
      geminiCaller: async (prompt) => {
        return await geminiCoHost.ask(prompt, message.user.displayName);
      }
    });

    const ctx = baglamOlustur(message, args, cmd.name);
    return await degiskenleriCoz(eskiBicim, ctx);
  }

  private hasPermission(level: string, message: ChatMessagePayload): boolean {
    if (message.user.isBroadcaster) return true;
    switch (level) {
      case 'broadcaster':
        return message.user.isBroadcaster;
      case 'mod':
        return message.user.isMod;
      case 'vip':
        return message.user.isVip || message.user.isMod;
      case 'sub':
        return message.user.isSub || message.user.isMod || message.user.isVip;
      // "regular": elle eklenen güvenilir izleyici (+ VIP, mod)
      case 'regular':
        return message.user.isMod || message.user.isVip || duzenliler.mi(message.platform, message.user.username);
      case 'everyone':
      default:
        return true;
    }
  }
}

export const commandManager = new CommandManager();
export default commandManager;
