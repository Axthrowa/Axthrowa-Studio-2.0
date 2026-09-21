import { db } from '../../db/index.js';
import { ChatMessagePayload } from '../../core/event-bus.js';
import { parseVariables } from '../../core/variable-parser.js';
import { economy } from '../economy/economy.js';
import { songRequest } from '../songrequest/songrequest.js';
import { giveaway } from '../giveaways/giveaways.js';
import { geminiCoHost } from '../ai/gemini.js';
import { gamesEngine } from '../games/games.js';
import { triviaEngine } from '../games/trivia-engine.js';
import { kingSystemService } from '../games/king-system.js';
import { settingsCache } from '../../core/settings-cache.js';
import { extras } from '../extras/extras.js';

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

export class CommandManager {
  private userCooldowns: Map<string, CooldownEntry> = new Map();
  private globalCooldowns: Map<string, CooldownEntry> = new Map();
  private commandsCache: Map<string, any> = new Map();
  private aliasesCache: Map<string, any> = new Map();
  private permits: Map<string, number> = new Map();
  private clipLast = 0;
  private initialized: boolean = false;

  isPermitted(username: string) {
    const until = this.permits.get(username.toLowerCase()) || 0;
    return until > Date.now();
  }

  reload() {
    this.commandsCache.clear();
    this.aliasesCache.clear();
    try {
      const rows = db.prepare('SELECT * FROM commands WHERE is_enabled = 1').all() as any[];
      for (const row of rows) {
        this.commandsCache.set(row.name.toLowerCase(), row);
        if (row.aliases) {
          try {
            const aliases: string[] = JSON.parse(row.aliases);
            for (const alias of aliases) {
              if (alias && alias.trim()) {
                this.aliasesCache.set(alias.trim().toLowerCase(), row);
              }
            }
          } catch {}
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

  async processMessage(message: ChatMessagePayload): Promise<string | null> {
    const text = message.message.trim();
    const prefix = settingsCache.get('prefix', '!');

    if (!text.startsWith(prefix)) {
      // Award active chatter points
      economy.getUser(message.platform, message.user.username, message.user.displayName);
      return null;
    }

    const withoutPrefix = text.slice(prefix.length).trim();
    if (!withoutPrefix) return null;

    const parts = withoutPrefix.split(/\s+/);
    const commandName = parts[0].toLowerCase();
    const args = parts.slice(1);

    // 1. Check Built-in Commands First
    const builtInResult = await this.executeBuiltIn(commandName, args, message);
    if (builtInResult !== null) {
      return builtInResult;
    }

    // 2. Check Custom Commands in Memory (Ultra-fast O(1) lookup)
    this.ensureLoaded();
    const cmdRow = this.commandsCache.get(commandName) || this.aliasesCache.get(commandName);
    if (!cmdRow) {
      return null;
    }

    return this.executeCustomCommand(cmdRow, args, message);
  }

  private async executeBuiltIn(name: string, args: string[], message: ChatMessagePayload): Promise<string | null> {
    try {
      const disabled = JSON.parse(settingsCache.get('default_commands_disabled', '[]'));
      if (Array.isArray(disabled) && disabled.includes(name)) return null;
    } catch {}

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
        return (cfg.clip_message || 'Klip alındı.').replace('{user}', message.user.displayName);
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
          return 'Kullanım: !puanver @kullanici 100  (eksi vermek için: !puanver @kullanici -50)';
        }
        const { user, total } = economy.grantPoints(target, amount);
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
      case 'watchtime':
      case 'izleme': {
        const u = economy.getUser(message.platform, message.user.username, message.user.displayName);
        return `@${message.user.displayName} izleme süresi: ${u.watch_time_minutes || 0} dakika.`;
      }
      case 'title':
        return 'Yayın başlığı panelden güncellenir.';
      case 'game':
        return 'Yayın kategorisi panelden güncellenir.';
      case 'followage':
        return `@${message.user.displayName}, takip süren yayın kaydından hesaplanır.`;
      case 'accountage':
        return `@${message.user.displayName}, hesap yaşın platform API'sinden gelir.`;
      case 'cark':
      case 'wheel': {
        const { wsHub } = await import('../../ws/server.js');
        wsHub.broadcastTo(['all', 'wheel'], { type: 'wheel_spin', payload: { index: Math.floor(Math.random() * 8) } });
        return `🎡 Şans çarkı çevrildi!`;
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
          message.user.username,
          message.user.displayName,
          bid,
          message.user.avatarUrl
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
      case 'help':
        return '📌 Komutlar: !puan, !liderlik, !kral, !tahtikap <puan>, !oyunlar, !sr <şarkı>, !sarki, !atla, !sor <soru>, !katil';

      default:
        return null;
    }
  }

  private async executeCustomCommand(cmd: any, args: string[], message: ChatMessagePayload): Promise<string | null> {
    // Check permission level
    if (!this.hasPermission(cmd.user_level, message)) {
      return `@${message.user.displayName}, bu komutu kullanma yetkiniz yok (${cmd.user_level}).`;
    }

    // Check cooldown
    const cdKey = `${cmd.id}_${message.user.id}`;
    const globalKey = `${cmd.id}_global`;
    const now = Date.now();

    const cd = cmd.cooldown || 5;
    const existingCd = this.globalCooldowns.get(globalKey);
    if (existingCd && existingCd.expiresAt > now && !message.user.isBroadcaster && !message.user.isMod) {
      return null; // Silent cooldown ignore
    }

    this.globalCooldowns.set(globalKey, { expiresAt: now + cd * 1000 });
    this.userCooldowns.set(cdKey, { expiresAt: now + cd * 1000 });

    // Parse variables in response template
    const parsedResponse = await parseVariables(cmd.response, {
      message,
      commandName: cmd.name,
      args,
      geminiCaller: async (prompt) => {
        return await geminiCoHost.ask(prompt, message.user.displayName);
      }
    });

    return parsedResponse;
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
      case 'everyone':
      default:
        return true;
    }
  }
}

export const commandManager = new CommandManager();
export default commandManager;
