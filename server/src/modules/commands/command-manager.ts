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
import { giveaway } from '../giveaways/giveaways.js';
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
import { kendiMesajlari, nukeArgumanlari, nukeHedefleri, sonMesajlar } from '../moderation/son-mesajlar.js';
import { sureyiYaz } from '../automod/enforcement.js';
import { rastgeleIzleyici } from '../../core/variables/registry.js';
import { kickbotCevir } from '../../core/variables/kickbot-uyum.js';
import { duzenliler } from '../community/regulars.js';
import { votekick, bingo, ayarSayi, kappagenGonder, metindenEmoteler } from '../community/topluluk.js';
import { emoteAdlari } from '../community/oyunlar.js';
import { yediTv } from '../emotes/yedi-tv.js';

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
  if (r.includes('sinema') || r.includes('tv')) return 'Sinema TV';
  if (r.includes('film') || r.includes('dizi')) return 'Film ve Dizi';
  if (r.includes('tib') || r.includes('tıb') || r.includes('sağlık') || r.includes('saglik') || r.includes('doktor')) return 'Tıbbi Terimler';
  if (r.includes('azer') || r.includes('türkçe') || r.includes('turkce')) return 'Azerbaycan Türkçesi';
  if (r.includes('gundem') || r.includes('gündem') || r.includes('2000')) return 'Gündem 2000/26';
  if (r.includes('ekonomi') || r.includes('para') || r.includes('finans')) return 'Ekonomi';
  if (r.includes('mutfak') || r.includes('yemek')) return 'Türk Mutfağı';
  if (r.includes('tekno')) return 'Teknoloji';
  if (r.includes('bilim')) return 'Bilim';
  if (r.includes('bilgi')) return 'Bilgi';
  if (r.includes('oyunlar')) return 'Oyunlar';
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

/** Eski varsayılan `!clip` yanıtı — klip alınmadığı hâlde "alındı" diyordu. */
const ESKI_KLIP_MESAJI = 'Klip alındı — yayıncı panosundan paylaşılabilir.';
const KLIP_MESAJI = '📌 @{user} klip anını işaretledi ({zaman}) — yayıncı panelden görecek.';

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
  private yerlesikSeli(ad: string, message: ChatMessagePayload, sonuc: string): string {
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
   * olarak geçince çalışır (BotRix "Etkinleştirme: Sohbet anahtar kelimesi").
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

  private async executeBuiltIn(name: string, args: string[], message: ChatMessagePayload): Promise<string | null> {
    try {
      const disabled = JSON.parse(settingsCache.get('default_commands_disabled', '[]'));
      if (Array.isArray(disabled) && disabled.includes(name)) return null;
    } catch (e) {
      seyrekUyar('ayar:default_commands_disabled', '[Komut] Kapalı varsayılan komut listesi okunamadı', e);
    }

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
        return economy.handleDuel(message, args);

      case '8ball':
      case 'kure':
        return economy.handle8Ball(message, args);

      case 'sr':
      case 'songrequest':
      case 'sarkiiste':
        return await songRequest.handleSongRequest(message, args);

      case 'sarki':
      case 'song':
      case 'currentsong': {
        const current = songRequest.getCurrentSong();
        return current 
          ? `🎶 Şu anda çalan: "${current.title}" (İsteyen: ${current.requestedBy})`
          : 'Şu anda kuyrukta çalan bir şarkı yok. Şarkı istemek için: !sr <şarkı adı>';
      }

      case 'atla':
      case 'skip':
      case 'voteskip': {
        const isMod = message.user.isBroadcaster || message.user.isMod;
        const res = songRequest.skipSong(isMod, message.user.username);
        return res.message;
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

      case 'oy':
      case 'vote':
      case 'anket': {
        const poll = db.prepare('SELECT * FROM polls WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as any;
        if (!poll) return `@${message.user.displayName}, aktif anket yok.`;
        // Süresi dolmuş ankete oy yok (kapatıcı 5 sn'de bir kapatır; arada gelen oy sayılmasın)
        if (Number(poll.ends_at) > 0 && Date.now() > Number(poll.ends_at)) return `@${message.user.displayName}, anket sona erdi.`;
        const choice = parseInt(args[0], 10);
        const opts = JSON.parse(poll.options || '[]');
        if (!choice || choice < 1 || choice > opts.length) return `@${message.user.displayName}, ${poll.command || '!oy'} 1-${opts.length} yaz.`;
        try {
          db.prepare('INSERT INTO poll_votes (id, poll_id, username, option_index, voted_at) VALUES (?, ?, ?, ?, ?)').run(`vote-${Date.now()}-${message.user.username}`, poll.id, message.user.username.toLowerCase(), choice - 1, Date.now());
        } catch {
          return `@${message.user.displayName}, zaten oy verdin.`;
        }
        const votes = db.prepare('SELECT option_index, COUNT(*) as count FROM poll_votes WHERE poll_id = ? GROUP BY option_index').all(poll.id);
        const { wsHub } = await import('../../ws/server.js');
        wsHub.broadcastTo(['all'], { type: 'poll_update', poll: { ...poll, options: opts, votes, endsAt: poll.ends_at } });
        return `@${message.user.displayName}, oyun kaydedildi: ${opts[choice - 1]}`;
      }

      case 'clip': {
        const cfg = extras.getExtrasSettings();
        if (!cfg.clip_enabled) return null;
        if (Date.now() - this.clipLast < (cfg.clip_cooldown || 30) * 1000) return `@${message.user.displayName}, clip komutu beklemede.`;
        this.clipLast = Date.now();
        // Gerçek klip: canlı yayının son ~30 sn'si + istenen süreye kadar ileri
        // (yerel ffmpeg, data/klipler). Kayıt arka planda; bitince sohbete haber.
        const sure = klipSuresi(args[0], Number(cfg.clip_default_sec) || 30, Number(cfg.clip_max_sec) || 60);
        const dn = message.user.displayName;
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
        if (klip.ok) return `🎬 @${dn} son ${sure} sn kaydediliyor…`;
        if (klip.sebep === 'mesgul') return `@${dn}, şu an başka bir klip kaydediliyor; birkaç saniye sonra tekrar dene.`;
        if (klip.sebep === 'yayin-yok') return `@${dn}, klip yalnız yayın açıkken alınabilir.`;
        // ffmpeg yok ya da kayıt başlatılamadı → anı işaretle (eski davranış)
        // Bu yolda platformda klip OLUŞTURULMAZ. Eskiden "Klip alındı — yayıncı
        // panosundan paylaşılabilir" deniyordu ama hiçbir yere kayıt düşmüyordu.
        // Artık an, panelin "Son Etkinlikler" listesine işaretlenir; yayıncı
        // kayıttan/VOD'dan keser.
        const zaman = yayinAcikMi() === false ? '' : getStreamUptime();
        try {
          db.prepare(`
            INSERT INTO stream_events (id, platform, event_type, username, display_name, message, timestamp)
            VALUES (?, ?, 'klip', ?, ?, ?, ?)
          `).run(
            randomUUID(),
            message.platform,
            message.user.username,
            message.user.displayName,
            `📌 Klip anı — ${message.user.displayName}${zaman ? ` (yayın başlayalı ${zaman})` : ''}`,
            Date.now()
          );
        } catch (e) {
          seyrekUyar('komut:clip', '[Komut] Klip anı kaydedilemedi', e);
        }
        // Eski varsayılanlar (biri hiç doldurulmayan `{url}` içeriyordu) yeni metne döner
        const eskiMi = !cfg.clip_message || cfg.clip_message === ESKI_KLIP_MESAJI || cfg.clip_message.includes('{url}');
        const sablon = eskiMi ? KLIP_MESAJI : cfg.clip_message;
        return sablon
          .replace('{user}', () => message.user.displayName)
          .replace('{zaman}', () => zaman || 'yayın kapalı');
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
        this.permits.set(target, Date.now() + 60000);
        return `@${target} 60 saniye link paylaşabilir.`;
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
        const n = extras.bumpCounter(args[0] || 'count', args[1] === 'reset' ? 0 : 1) as any;
        return `🔢 ${n.name}: ${n.count}`;
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
        return gamesEngine.handleGamesHelp();

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
        const state = triviaEngine.getState();
        if (state.status === 'question_active') {
          return `@${message.user.displayName}, zaten aktif bir soru devam ediyor! Kalan süre: ${state.remainingSeconds} sn. Cevap için sohbete A, B, C veya D yazın!`;
        }

        const cat = parseTriviaCategory(args[0] || '');
        const q = triviaEngine.startQuestion({ category: cat });
        if (!q) return `@${message.user.displayName}, soru havuzunda uygun soru bulunamadı.`;
        return null;
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

        let cat = 'all';
        let count = 5;
        for (let i = 0; i < args.length; i++) {
          const a = args[i].toLowerCase();
          const parsedNum = parseInt(a, 10);
          if (!isNaN(parsedNum) && parsedNum >= 3 && parsedNum <= 20) {
            count = parsedNum;
          } else {
            const parsedCat = parseTriviaCategory(a);
            if (parsedCat !== 'all') {
              cat = parsedCat;
            }
          }
        }

        triviaEngine.startTournament(cat, count, 20);
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
        // Nightbot biçimi: !commands add|edit|delete !ad yanıt (mod)
        const altKomut: Record<string, string> = { add: 'addcom', ekle: 'addcom', edit: 'editcom', duzenle: 'editcom', delete: 'delcom', del: 'delcom', remove: 'delcom', sil: 'delcom' };
        const yonlen = altKomut[trKatla(args[0] || '')];
        if (yonlen) return this.executeBuiltIn(yonlen, args.slice(1), message);
        // Sabit liste yerine gercekten TANIMLI komutlar listelenir; kullanici
        // komut ekleyince liste kendiliginden guncellenir.
        const ozel = db
          .prepare('SELECT name FROM commands WHERE is_enabled = 1 ORDER BY name LIMIT 25')
          .all() as Array<{ name: string }>;
        const yerlesik = ['!puan', '!liderlik', '!uptime', '!izleme', '!oyunlar', '!sr', '!sor'];
        const hepsi = [...yerlesik, ...ozel.map((c) => `!${String(c.name).replace(/^!/, '')}`)];
        return `📌 Komutlar: ${[...new Set(hepsi)].join(', ')}`;
      }

      // ---- Topluluk bahisleri (BotRix: !bet) -------------------------------
      case 'bahis':
      case 'bet': {
        const alt = (args[0] || '').toLowerCase();
        const mod = message.user.isBroadcaster || message.user.isMod;

        if (alt === 'create' || alt === 'ac') {
          if (!mod) return null;
          const kalan = args.slice(1).join(' ');
          const [baslik, ...sec] = kalan.split('|').map((x) => x.trim());
          const t = tahminler.olustur(baslik || 'Tahmin', sec.length ? sec : ['Evet', 'Hayır']);
          if ('hata' in t) return `@${message.user.displayName}, ${t.hata}`;
          return `🎲 Tahmin açıldı: ${t.baslik} → ${t.secenekler.map((x, i) => `${i + 1}) ${x}`).join(' ')} · Katıl: !bet <seçenek> <puan>`;
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

      // ---- Izleyici kuyrugu (BotRix: !joinq ailesi) ------------------------
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

      // ---- Puan dususu (BotRix: !pdrops) ----------------------------------
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

      // ---- BotRix karsiligi olan yerlesik komutlar (GAP §2.1) -------------
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
          .get(hedef) as { display_name?: string; watch_time_minutes?: number } | undefined;
        if (!r) return `@${message.user.displayName}, ${hedef} için izleme kaydı yok.`;
        const dk = Number(r.watch_time_minutes) || 0;
        const sa = Math.floor(dk / 60);
        return `⏳ ${r.display_name || hedef} bu kanalı ${sa > 0 ? `${sa} saat ` : ''}${dk % 60} dakika izledi.`;
      }

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
        const adresler: Record<string, string> = {
          kick: 'https://kick.com',
          twitch: 'https://twitch.tv',
          youtube: 'https://youtube.com/@'
        };
        const kok = adresler[String(message.platform).toLowerCase()] || 'https://kick.com';
        // Overlay'deki Shoutout widget'ini da tetikle
        try {
          eventBus.emit('widget_update', { type: 'shoutout', data: { channel: kanal, platform: message.platform } });
        } catch (e) {
          seyrekUyar('shoutout:widget', '[Komut] Shoutout widget bildirimi başarısız', e);
        }
        return `📢 ${kanal} kanalına göz atın: ${kok}/${kanal}`;
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

      // ---- Yaygın botlarda gözlenen, StreamAxT'de eksik komutlar (2026-10) ----

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

      // Düzenli izleyiciler (Nightbot "regulars"): !regulars add|remove|list @kişi
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

      // Oylu susturma (StreamElements !votekick) — ayar votekick_enabled (varsayılan kapalı)
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
        return `🗑️ @${message.user.displayName}, "${son.title}" kuyruktan çıkarıldı.`;
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
    // 1) Yetki
    if (!this.hasPermission(cmd.user_level, message)) {
      if (!acikCagri) return null;
      return `@${message.user.displayName}, bu komutu kullanma yetkiniz yok (${cmd.user_level}).`;
    }

    // 1b) Erişim kipi: her zaman / yalnız yayında / yalnız yayın kapalıyken
    const kip = String(cmd.access_mode || 'always');
    if (!erisimUygunMu(kip, canliDurum.genel().canli)) {
      return acikCagri ? `@${message.user.displayName}, ${erisimAciklamasi(kip)}.` : null;
    }

    // 1c) Seviye şartı (Seviye / XP sistemi açıksa)
    const minSeviye = Math.max(0, Number(cmd.min_level) || 0);
    if (minSeviye > 0 && !message.user.isBroadcaster && seviyeler.ayarOku().aktif) {
      const sv = seviyeler.kullanici(cuzdanAdi(message.platform, message.user.username)).seviye;
      if (sv < minSeviye) {
        return acikCagri
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
      if (beklemeKipi === 'user') {
        const mevcut = this.userCooldowns.get(cdKey);
        if (mevcut && mevcut.expiresAt > now) return null;
      } else {
        const mevcut = this.globalCooldowns.get(globalKey);
        if (mevcut && mevcut.expiresAt > now) return null;
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
    // `{{...}}` (KickBot) söz dizimi eski `{user}` ayrıştırıcısından ÖNCE çevrilir;
    // yoksa `{{username}}` içindeki `{username}` yarım yerleştirilir.
    const eskiBicim = await parseVariables(kickbotCevir(cmd.response), {
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
      // Nightbot "regular": elle eklenen güvenilir izleyici (+ VIP, mod)
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
