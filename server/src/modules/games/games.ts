import { ChatMessagePayload, eventBus } from '../../core/event-bus.js';
import { economy } from '../economy/economy.js';
import { db } from '../../db/index.js';
import { triviaEngine } from './trivia-engine.js';

// --- TYPES ---
type PlatformType = 'twitch' | 'kick' | 'youtube' | 'discord' | 'tiktok' | 'trovo' | 'all';

export interface GameSettings {
  enabledGames: {
    heist: boolean;
    race: boolean;
    trivia: boolean;
    anagram: boolean;
    fishing: boolean;
    lootbox: boolean;
    bomb: boolean;
    dice: boolean;
    coinflip: boolean;
    duel: boolean;
  };
  heist: { minBet: number; maxBet: number; countdownSeconds: number; payoutMultiplier: number };
  race: { minBet: number; maxBet: number; countdownSeconds: number; payoutMultiplier: number };
  trivia: { rewardPoints: number; durationSeconds: number };
  anagram: { rewardPoints: number; durationSeconds: number };
  fishing: { cooldownSeconds: number; catchChancePercent: number };
  lootbox: { cost: number; jackpotMultiplier: number };
  bomb: { cooldownSeconds: number; multiplier: number };
  dice: { minBet: number; maxBet: number };
  coinflip: { minBet: number; maxBet: number };
}

const DEFAULT_GAME_SETTINGS: GameSettings = {
  enabledGames: {
    heist: true,
    race: true,
    trivia: true,
    anagram: true,
    fishing: true,
    lootbox: true,
    bomb: true,
    dice: true,
    coinflip: true,
    duel: true
  },
  heist: { minBet: 20, maxBet: 5000, countdownSeconds: 35, payoutMultiplier: 2.2 },
  race: { minBet: 20, maxBet: 5000, countdownSeconds: 30, payoutMultiplier: 2.5 },
  trivia: { rewardPoints: 150, durationSeconds: 40 },
  anagram: { rewardPoints: 150, durationSeconds: 40 },
  fishing: { cooldownSeconds: 45, catchChancePercent: 75 },
  lootbox: { cost: 100, jackpotMultiplier: 10 },
  bomb: { cooldownSeconds: 30, multiplier: 2.0 },
  dice: { minBet: 10, maxBet: 2500 },
  coinflip: { minBet: 10, maxBet: 2500 }
};

interface HeistLobby {
  startedAt: number;
  platform: PlatformType;
  channel: string;
  initiator: string;
  participants: Map<string, { displayName: string; amount: number }>;
  timer: NodeJS.Timeout | null;
}

interface RaceLobby {
  startedAt: number;
  platform: PlatformType;
  channel: string;
  initiator: string;
  participants: Map<string, { displayName: string; amount: number }>;
  timer: NodeJS.Timeout | null;
}

interface ActiveBomb {
  user: string;
  wire: 'kirmizi' | 'mavi' | 'yesil';
  amount: number;
  expiresAt: number;
}

interface TriviaQuestion {
  question: string;
  answers: string[]; // lowercase accepted answers
  reward: number;
  category: string;
}

const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  { question: "Grand Theft Auto V'in (GTA 5) kurgusal şehri hangisidir?", answers: ['los santos', 'lossantos'], reward: 150, category: 'Oyun' },
  { question: "Minecraft'ın son ve en güçlü boss canavarının adı nedir?", answers: ['ender dragon', 'enderdragron', 'ender ejderhasi', 'ender ejderhası'], reward: 150, category: 'Oyun' },
  { question: "League of Legends oyununda 'Rüzgarın Kılıcı' olarak bilinen şampiyon kimdir?", answers: ['yasuo'], reward: 120, category: 'Oyun' },
  { question: "Counter-Strike'ın en meşhur çöl temalı haritası hangisidir?", answers: ['dust 2', 'dust2', 'de_dust2'], reward: 120, category: 'Oyun' },
  { question: "Witcher serisinin ana karakteri olan ak saçlı canavar avcısının adı nedir?", answers: ['geralt', 'rivyali geralt', 'geralt of rivia'], reward: 150, category: 'Oyun' },
  { question: "Valorant'ta diriltme (revive) yeteneğine sahip şifacı ajanın adı nedir?", answers: ['sage'], reward: 120, category: 'Oyun' },
  { question: "Kırmızı şapkalı, bıyıklı ünlü Nintendo tesisatçısı kahramanın adı nedir?", answers: ['mario', 'super mario'], reward: 100, category: 'Oyun' },
  { question: "Güneş sistemimizdeki en büyük gezegen hangisidir?", answers: ['jupiter', 'jüpiter'], reward: 150, category: 'Genel Kültür' },
  { question: "Dostoyevski'nin Raskolnikov karakterini anlattığı ünlü romanı hangisidir?", answers: ['suc ve ceza', 'suç ve ceza'], reward: 200, category: 'Edebiyat' },
  { question: "Yüzüklerin Efendisi serisinde 'Tek Yüzük'ün eritildiği volkanik dağın adı nedir?", answers: ['hukum dagi', 'hüküm dağı', 'mount doom'], reward: 200, category: 'Sinema' },
  { question: "Matrix filminde gerçeği gösteren hap ne renktir?", answers: ['kirmizi', 'kırmızı', 'red'], reward: 120, category: 'Sinema' },
  { question: "Periyodik tabloda altın elementinin simgesi nedir?", answers: ['au'], reward: 150, category: 'Bilim' }
];

const ANAGRAM_WORDS: Array<{ word: string; scrambled: string; hint: string }> = [
  { word: 'yayin', scrambled: 'Y - N - A - I', hint: 'Canlı yapılan şey' },
  { word: 'yayinci', scrambled: 'Y - A - Y - I - N - C - I', hint: 'Ekrandaki kişi' },
  { word: 'kulaklik', scrambled: 'K - U - L - A - K - L - I - K', hint: 'Ses dinleme ekipmanı' },
  { word: 'klavye', scrambled: 'K - L - A - V - Y - E', hint: 'Yazı yazma aygıtı' },
  { word: 'mikrofon', scrambled: 'M - K - R - O - F - O - N - I', hint: 'Ses ileten aygıt' },
  { word: 'abonelik', scrambled: 'A - B - O - N - E - L - I - K', hint: 'Destek yöntemi' },
  { word: 'oyuncu', scrambled: 'O - Y - U - N - C - U', hint: 'Gamer' },
  { word: 'twitch', scrambled: 'T - W - I - T - C - H', hint: 'Mor platform' },
  { word: 'kick', scrambled: 'K - I - C - K', hint: 'Yeşil platform' },
  { word: 'duello', scrambled: 'D - U - E - L - L - O', hint: 'Kılıç savaşı' },
  { word: 'discord', scrambled: 'D - I - S - C - O - R - D', hint: 'Topluluk sunucusu' }
];

export class GamesEngine {
  private activeHeist: HeistLobby | null = null;
  private activeRace: RaceLobby | null = null;
  private activeTrivia: { question: TriviaQuestion; expiresAt: number } | null = null;
  private activeAnagram: { word: string; scrambled: string; hint: string; reward: number; expiresAt: number } | null = null;
  private activeBombs: Map<string, ActiveBomb> = new Map();
  private fishCooldowns: Map<string, number> = new Map();
  private settings: GameSettings = DEFAULT_GAME_SETTINGS;

  constructor() {
    this.loadSettings();
  }

  loadSettings() {
    try {
      const row = db.prepare("SELECT value FROM bot_settings WHERE key = 'game_settings'").get() as any;
      if (row?.value) {
        const parsed = JSON.parse(row.value);
        this.settings = { ...DEFAULT_GAME_SETTINGS, ...parsed };
      }
    } catch {
      this.settings = DEFAULT_GAME_SETTINGS;
    }
  }

  getSettings(): GameSettings {
    return this.settings;
  }

  updateSettings(patch: Partial<GameSettings>): GameSettings {
    this.settings = {
      ...this.settings,
      ...patch,
      enabledGames: {
        ...this.settings.enabledGames,
        ...(patch.enabledGames || {})
      }
    };
    try {
      db.prepare("INSERT OR REPLACE INTO bot_settings (key, value) VALUES ('game_settings', ?)").run(JSON.stringify(this.settings));
    } catch (err) {
      console.warn('[GamesEngine] Error saving settings to DB:', err);
    }
    return this.settings;
  }

  getActiveLobbies() {
    return {
      heist: this.activeHeist ? {
        startedAt: this.activeHeist.startedAt,
        initiator: this.activeHeist.initiator,
        platform: this.activeHeist.platform,
        participantsCount: this.activeHeist.participants.size,
        participants: Array.from(this.activeHeist.participants.values()),
        remainingMs: Math.max(0, (this.activeHeist.startedAt + (this.settings.heist.countdownSeconds || 35) * 1000) - Date.now())
      } : null,
      race: this.activeRace ? {
        startedAt: this.activeRace.startedAt,
        initiator: this.activeRace.initiator,
        platform: this.activeRace.platform,
        participantsCount: this.activeRace.participants.size,
        participants: Array.from(this.activeRace.participants.values()),
        remainingMs: Math.max(0, (this.activeRace.startedAt + (this.settings.race.countdownSeconds || 30) * 1000) - Date.now())
      } : null,
      trivia: (() => {
        const tState = triviaEngine.getState();
        if (tState.status === 'question_active' && tState.question) {
          return {
            question: tState.question.question,
            category: tState.question.category,
            reward: tState.question.points,
            remainingMs: tState.remainingSeconds * 1000,
            votesCount: tState.votes.total
          };
        }
        return null;
      })(),
      anagram: this.activeAnagram ? {
        scrambled: this.activeAnagram.scrambled,
        hint: this.activeAnagram.hint,
        reward: this.activeAnagram.reward,
        expiresAt: this.activeAnagram.expiresAt,
        remainingMs: Math.max(0, this.activeAnagram.expiresAt - Date.now())
      } : null
    };
  }

  cancelLobby(type: 'heist' | 'race' | 'trivia' | 'anagram'): boolean {
    if (type === 'heist' && this.activeHeist) {
      if (this.activeHeist.timer) clearTimeout(this.activeHeist.timer);
      this.activeHeist = null;
      eventBus.emitBotMessage({ platform: 'all', message: '❌ Aktif banka soygunu yayıncı tarafından iptal edildi.' });
      return true;
    }
    if (type === 'race' && this.activeRace) {
      if (this.activeRace.timer) clearTimeout(this.activeRace.timer);
      this.activeRace = null;
      eventBus.emitBotMessage({ platform: 'all', message: '❌ Aktif sokak yarışı yayıncı tarafından iptal edildi.' });
      return true;
    }
    if (type === 'trivia') {
      triviaEngine.stopGame();
      return true;
    }
    if (type === 'anagram') {
      this.activeAnagram = null;
      eventBus.emitBotMessage({ platform: 'all', message: '❌ Aktif kelime bulmacası iptal edildi.' });
      return true;
    }
    return false;
  }

  triggerGame(gameName: string): string {
    switch (gameName) {
      case 'trivia': {
        const q = triviaEngine.startQuestion();
        return q ? `🧠 Bil Bakalım sorusu başlatıldı: "${q.question}"` : 'Soru havuzunda soru bulunamadı!';
      }
      case 'anagram': {
        const item = ANAGRAM_WORDS[Math.floor(Math.random() * ANAGRAM_WORDS.length)];
        const reward = this.settings.anagram.rewardPoints || 120;
        const dur = (this.settings.anagram.durationSeconds || 40) * 1000;
        this.activeAnagram = { word: item.word.toLowerCase(), scrambled: item.scrambled, hint: item.hint, reward, expiresAt: Date.now() + dur };
        const msg = `🔤 KELİME BULMACASI: Harfleri doğru sıraya dizip ilk yazan ${reward} Puanı kapar! 👉 [ ${item.scrambled} ] (İpucu: ${item.hint}) 🕒`;
        eventBus.emitBotMessage({ platform: 'all', message: msg });
        return msg;
      }
      case 'heist': {
        if (this.activeHeist) return 'Zaten aktif bir soygun lobisi var!';
        const dur = (this.settings.heist.countdownSeconds || 35) * 1000;
        this.activeHeist = {
          startedAt: Date.now(),
          platform: 'all',
          channel: 'stream',
          initiator: 'Yayıncı',
          participants: new Map([['yayinci', { displayName: 'Yayıncı', amount: 100 }]]),
          timer: setTimeout(() => this.executeHeist(), dur)
        };
        const msg = `🚨 BÜYÜK BANKA SOYGUNU BAŞLADI! Yayıncı soygunu başlattı! Çeteye katılmak için ${Math.round(dur / 1000)} saniyeniz var: !soygun <miktar> 💼💥`;
        eventBus.emitBotMessage({ platform: 'all', message: msg });
        return msg;
      }
      default:
        return 'Bilinmeyen oyun türü';
    }
  }

  // 1. BANK HEIST (SOYGUN)
  handleHeist(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.heist) {
      return `@${message.user.displayName}, Banka Soygunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    const amountStr = args[0]?.toLowerCase();

    let amount = 50;
    if (amountStr === 'hepsi' || amountStr === 'all') {
      amount = Math.max(10, user.points);
    } else if (amountStr) {
      amount = parseInt(amountStr, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      return `@${message.user.displayName}, soygun için miktar belirlemelisin! Örnek: !soygun 50 veya !soygun hepsi`;
    }

    if (amount < (this.settings.heist.minBet || 20)) {
      return `@${message.user.displayName}, minimum soygun bahsi: ${this.settings.heist.minBet || 20} Puan!`;
    }
    if (amount > (this.settings.heist.maxBet || 5000)) {
      return `@${message.user.displayName}, maksimum soygun bahsi: ${this.settings.heist.maxBet || 5000} Puan!`;
    }

    if (user.points < amount) {
      return `@${message.user.displayName}, yeterli puanın yok! Bakiyen: ${user.points} 💰`;
    }

    const username = message.user.username.toLowerCase();

    // If heist is already running in countdown
    if (this.activeHeist) {
      if (this.activeHeist.participants.has(username)) {
        return `@${message.user.displayName}, zaten bu soygun çetesindesin! Hazırda bekle! 🥷`;
      }

      this.activeHeist.participants.set(username, { displayName: message.user.displayName, amount });
      const totalCount = this.activeHeist.participants.size;
      return `🥷 @${message.user.displayName}, ${amount} puan ile soygun çetesine katıldı! (Toplam: ${totalCount} Kişi) Katılmak için: !soygun <miktar>`;
    }

    // Start a new heist lobby
    const countSec = this.settings.heist.countdownSeconds || 35;
    this.activeHeist = {
      startedAt: Date.now(),
      platform: message.platform,
      channel: message.channel,
      initiator: message.user.displayName,
      participants: new Map([[username, { displayName: message.user.displayName, amount }]]),
      timer: setTimeout(() => this.executeHeist(), countSec * 1000)
    };

    return `🚨 BÜYÜK BANKA SOYGUNU BAŞLADI! @${message.user.displayName} soygun planını kurdu (${amount} Puan)! Çeteye katılmak için ${countSec} saniyeniz var: !soygun <miktar> 💼💥`;
  }

  private executeHeist() {
    if (!this.activeHeist) return;

    const heist = this.activeHeist;
    this.activeHeist = null;

    const count = heist.participants.size;
    const targets = [
      { name: 'Kuyumcu Dükkanı', multiplier: 1.6, baseSuccess: 0.75 },
      { name: 'Merkez Bankası Kasası', multiplier: 2.2, baseSuccess: 0.60 },
      { name: 'Zırhlı Para Taşıma Aracı', multiplier: 1.9, baseSuccess: 0.68 },
      { name: 'Şehir Kumarhanesi', multiplier: 2.5, baseSuccess: 0.52 },
      { name: 'Dünya Elmas Borsası', multiplier: 3.2, baseSuccess: 0.40 }
    ];

    const target = targets[Math.floor(Math.random() * targets.length)];
    // Gang synergy bonus: +4% chance per member
    const successRate = Math.min(0.85, target.baseSuccess + (count * 0.04));

    const winners: string[] = [];
    const losers: string[] = [];

    for (const [uname, info] of heist.participants.entries()) {
      const survived = Math.random() < successRate;
      if (survived) {
        const winAmount = Math.round(info.amount * target.multiplier);
        economy.addPoints(uname, winAmount);
        winners.push(`@${info.displayName} (+${winAmount})`);
      } else {
        economy.removePoints(uname, info.amount);
        losers.push(`@${info.displayName}`);
      }
    }

    let summary = `🏛️ [HEDEF: ${target.name}] `;
    if (winners.length > 0) {
      summary += `🎉 Başarıyla kaçanlar: ${winners.join(', ')}! 💰 `;
    }
    if (losers.length > 0) {
      summary += `🚔 Polise yakalananlar: ${losers.join(', ')} (-Puan)! 🚨`;
    }
    if (winners.length === 0) {
      summary = `💀 FELAKET! ${target.name} soygununda polis tüm çeteyi köşeye kıstırdı ve herkes tutuklandı!`;
    }

    eventBus.emitBotMessage({
      platform: heist.platform,
      channel: heist.channel,
      message: summary
    });
  }

  // 2. STREET DRAG RACE (SOKAK YARIŞI)
  handleRace(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.race) {
      return `@${message.user.displayName}, Sokak Yarışı şu anda devre dışı bırakılmış. ⏸️`;
    }
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    const amountStr = args[0]?.toLowerCase();

    let amount = 50;
    if (amountStr === 'hepsi' || amountStr === 'all') {
      amount = Math.max(10, user.points);
    } else if (amountStr) {
      amount = parseInt(amountStr, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      return `@${message.user.displayName}, yarışa katılmak için bahis belirle! Örnek: !yaris 50`;
    }

    if (amount < (this.settings.race.minBet || 20)) {
      return `@${message.user.displayName}, minimum yarış bahsi: ${this.settings.race.minBet || 20} Puan!`;
    }
    if (amount > (this.settings.race.maxBet || 5000)) {
      return `@${message.user.displayName}, maksimum yarış bahsi: ${this.settings.race.maxBet || 5000} Puan!`;
    }

    if (user.points < amount) {
      return `@${message.user.displayName}, yeterli puanın yok! Bakiyen: ${user.points} 💰`;
    }

    const username = message.user.username.toLowerCase();

    if (this.activeRace) {
      if (this.activeRace.participants.has(username)) {
        return `@${message.user.displayName}, zaten yarış çizgisindesin! Gaz pedalını hazırla! 🏎️`;
      }
      this.activeRace.participants.set(username, { displayName: message.user.displayName, amount });
      return `🏁 @${message.user.displayName} ${amount} puan ile piste çıktı! (Toplam: ${this.activeRace.participants.size} Yarışçı) Katılmak için: !yaris <miktar>`;
    }

    // Start race lobby
    const countSec = this.settings.race.countdownSeconds || 30;
    this.activeRace = {
      startedAt: Date.now(),
      platform: message.platform,
      channel: message.channel,
      initiator: message.user.displayName,
      participants: new Map([[username, { displayName: message.user.displayName, amount }]]),
      timer: setTimeout(() => this.executeRace(), countSec * 1000)
    };

    return `🏎️💨 SOKAK YARIŞI BAŞLIYOR! @${message.user.displayName} pisti açtı (${amount} Puan)! Katılmak için ${countSec} saniyeniz var: !yaris <miktar> 🚦🏁`;
  }

  private executeRace() {
    if (!this.activeRace) return;

    const race = this.activeRace;
    this.activeRace = null;

    const drivers = Array.from(race.participants.entries()).map(([uname, data]) => ({
      username: uname,
      displayName: data.displayName,
      amount: data.amount
    }));

    if (drivers.length === 1) {
      // Solo race against the drift bot
      const solo = drivers[0];
      const win = Math.random() >= 0.45;
      if (win) {
        economy.addPoints(solo.username, solo.amount);
        eventBus.emitBotMessage({
          platform: race.platform,
          channel: race.channel,
          message: `🏎️💨 @${solo.displayName} pist rekorunu kırdı ve yarışı 1. bitirdi! +${solo.amount} Puan kazandı! 🏆`
        });
      } else {
        economy.removePoints(solo.username, solo.amount);
        eventBus.emitBotMessage({
          platform: race.platform,
          channel: race.channel,
          message: `💥 @${solo.displayName} son virajda bariyerlere çarptı ve -${solo.amount} puan kaybetti! 🛠️`
        });
      }
      return;
    }

    // Multi-driver race
    const totalPool = drivers.reduce((sum, d) => sum + d.amount, 0);
    const ranked = drivers
      .map(d => ({ ...d, score: Math.random() * 100 }))
      .sort((a, b) => b.score - a.score);

    const first = ranked[0];
    const second = ranked[1];

    // 1st place takes 65%, 2nd place takes 35% of total pool
    const prize1 = Math.round(totalPool * 0.65);
    const prize2 = Math.round(totalPool * 0.35);

    for (const d of drivers) {
      economy.removePoints(d.username, d.amount);
    }
    economy.addPoints(first.username, prize1);
    economy.addPoints(second.username, prize2);

    const announce = `🏁 YARIŞ BİTTİ! Toplam Ödül Havuzu: ${totalPool} Puan! ` +
      `🥇 1. @${first.displayName} (+${prize1} Puan 🏆) | ` +
      `🥈 2. @${second.displayName} (+${prize2} Puan 🥈) | ` +
      `Diğer yarışçılar lastik yaktı! 🔥`;

    eventBus.emitBotMessage({
      platform: race.platform,
      channel: race.channel,
      message: announce
    });
  }

  // 3. TRIVIA (BİLGİ YARIŞMASI)
  handleTrivia(message: ChatMessagePayload): string {
    if (!this.settings.enabledGames.trivia) {
      return `@${message.user.displayName}, Bilgi Yarışması şu anda devre dışı bırakılmış. ⏸️`;
    }
    if (this.activeTrivia && Date.now() < this.activeTrivia.expiresAt) {
      return `🧠 Zaten devam eden bir soru var: "${this.activeTrivia.question.question}"`;
    }

    const q = TRIVIA_QUESTIONS[Math.floor(Math.random() * TRIVIA_QUESTIONS.length)];
    const reward = this.settings.trivia.rewardPoints || q.reward;
    const durSec = this.settings.trivia.durationSeconds || 40;
    this.activeTrivia = {
      question: { ...q, reward },
      expiresAt: Date.now() + durSec * 1000
    };

    return `🧠 BİLGİ YARIŞMASI (${q.category}) [Ödül: ${reward} Puan] 👉 "${q.question}" (Cevabı chat'e direkt yazın, ilk bilen kazanır! Süre: ${durSec} sn) ⚡`;
  }

  // 4. ANAGRAM / KELİME AVI
  handleAnagram(message: ChatMessagePayload): string {
    if (!this.settings.enabledGames.anagram) {
      return `@${message.user.displayName}, Kelime Bulmacası şu anda devre dışı bırakılmış. ⏸️`;
    }
    if (this.activeAnagram && Date.now() < this.activeAnagram.expiresAt) {
      return `🔤 Zaten devam eden bir kelime bulmacası var: [ ${this.activeAnagram.scrambled} ]`;
    }

    const item = ANAGRAM_WORDS[Math.floor(Math.random() * ANAGRAM_WORDS.length)];
    const reward = this.settings.anagram.rewardPoints || 120;
    const durSec = this.settings.anagram.durationSeconds || 40;
    this.activeAnagram = {
      word: item.word.toLowerCase(),
      scrambled: item.scrambled,
      hint: item.hint,
      reward,
      expiresAt: Date.now() + durSec * 1000
    };

    return `🔤 KELİME BULMACASI: Karışık harfleri doğru sıraya dizip ilk yazan ${reward} Puanı kapar! 👉 [ ${item.scrambled} ] (İpucu: ${item.hint} | Süre: ${durSec} sn) 🕒`;
  }

  // Check incoming chat messages for trivia / anagram answers
  checkChatMessage(message: ChatMessagePayload): string | null {
    const raw = (message.message || '').trim().toLowerCase();
    const now = Date.now();

    // 1. Check Trivia
    if (this.activeTrivia && now < this.activeTrivia.expiresAt) {
      const q = this.activeTrivia.question;
      const isCorrect = q.answers.some(a => raw.includes(a) || raw === a);
      if (isCorrect) {
        this.activeTrivia = null;
        economy.addPoints(message.user.username, q.reward);
        return `🎉 TEBRİKLER @${message.user.displayName}! Doğru cevabı ilk sen verdin ve ${q.reward} Puan kazandın! 🧠🏆`;
      }
    } else if (this.activeTrivia && now >= this.activeTrivia.expiresAt) {
      this.activeTrivia = null;
    }

    // 2. Check Anagram
    if (this.activeAnagram && now < this.activeAnagram.expiresAt) {
      const target = this.activeAnagram.word;
      if (raw === target || raw.startsWith(target)) {
        const reward = this.activeAnagram.reward;
        this.activeAnagram = null;
        economy.addPoints(message.user.username, reward);
        return `🎉 BİLDİN @${message.user.displayName}! Doğru kelime "${target.toUpperCase()}" idi! +${reward} Puan kazandın! 🔤✨`;
      }
    } else if (this.activeAnagram && now >= this.activeAnagram.expiresAt) {
      this.activeAnagram = null;
    }

    return null;
  }

  // 5. FISHING (BALIK TUTMA)
  handleFishing(message: ChatMessagePayload): string {
    if (!this.settings.enabledGames.fishing) {
      return `@${message.user.displayName}, Balık Tutma oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const username = message.user.username.toLowerCase();
    const now = Date.now();
    const cdMs = (this.settings.fishing.cooldownSeconds || 45) * 1000;
    const lastTime = this.fishCooldowns.get(username) || 0;

    if (now - lastTime < cdMs) {
      const left = Math.ceil((cdMs - (now - lastTime)) / 1000);
      return `@${message.user.displayName}, balıklar ürktü! Tekrar olta atmak için ${left} saniye beklemelisin. ⏳`;
    }

    this.fishCooldowns.set(username, now);

    const roll = Math.random() * 100;

    if (roll < 12) {
      return `👞 @${message.user.displayName} oltayı çekti ve içinden su damlayan eski bir çizme çıktı! (0 Puan) 😂`;
    } else if (roll < 45) {
      economy.addPoints(username, 20);
      return `🐟 @${message.user.displayName} oltasını çekti ve parlak bir Gümüş Hamsi yakaladı! (+20 Puan) 🌊`;
    } else if (roll < 75) {
      economy.addPoints(username, 45);
      return `🐠 @${message.user.displayName} berrak sulardan lezzetli bir Mercan Balığı çekti! (+45 Puan) 🌊`;
    } else if (roll < 90) {
      economy.addPoints(username, 90);
      return `🐡 @${message.user.displayName} oltaya koca göbekli bir Dikenli Balon Balığı takıldı! (+90 Puan) 🐡`;
    } else if (roll < 98) {
      economy.addPoints(username, 250);
      return `🦈 İNANILMAZ! @${message.user.displayName} tek hamlede dev bir Mako Köpekbalığı çıkardı! (+250 Puan) 🦈💥`;
    } else {
      // 2% Legendary
      economy.addPoints(username, 750);
      return `👑🌊 EFSANEVİ KRAKEN ÇIKTI! @${message.user.displayName} denizin en derinlerinden Altın Sandıklı Efsanevi Kraken yakaladı ve tam 750 Puan kazandı! 👑🐙`;
    }
  }

  // 6. CS/STEAM CRATE UNBOXING (KASA AÇMA)
  handleCaseOpen(message: ChatMessagePayload): string {
    if (!this.settings.enabledGames.lootbox) {
      return `@${message.user.displayName}, Kasa Açma oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    const cost = this.settings.lootbox.cost || 100;

    if (user.points < cost) {
      return `@${message.user.displayName}, kasa açmak için ${cost} puana ihtiyacın var! Bakiyen: ${user.points} 💰`;
    }

    economy.removePoints(message.user.username, cost);
    const roll = Math.random() * 100;

    if (roll < 50) {
      // Common
      const prize = Math.round(cost * 0.35);
      economy.addPoints(message.user.username, prize);
      return `📦 [KASA AÇILDI] ⚪ Sıradan Drop: @${message.user.displayName} [Paslı Çakı | Sahada Test Edilmiş] çıkardı! (+${prize} Puan) 💸`;
    } else if (roll < 80) {
      // Rare
      const prize = Math.round(cost * 1.5);
      economy.addPoints(message.user.username, prize);
      return `📦 [KASA AÇILDI] 🔵 Nadir Drop: @${message.user.displayName} [AK-47 | Neon Devrimi] çıkardı! (+${prize} Puan)! ✨`;
    } else if (roll < 95) {
      // Epic
      const prize = Math.round(cost * 3.5);
      economy.addPoints(message.user.username, prize);
      return `📦 [KASA AÇILDI] 🟣 EPİK DROP! @${message.user.displayName} [AWP | Ejderha Ateşi] düşürdü! (+${prize} Puan) 🐉🔥`;
    } else {
      // Legendary Gold
      const mult = this.settings.lootbox.jackpotMultiplier || 10;
      const prize = cost * mult;
      economy.addPoints(message.user.username, prize);
      return `📦✨ [ALTIN DROP!] 🟡 EFSANEVİ BIÇAK! @${message.user.displayName} kasadan [★ KARAMBİT | FADE (Fabrikadan Yeni Çıkmış)] çıkardı! TAM +${prize} PUAN! 🏆👑`;
    }
  }

  // 7. BOMB DEFUSAL (BOMBA İMHA)
  handleBomb(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.bomb) {
      return `@${message.user.displayName}, Bomba İmha oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const username = message.user.username.toLowerCase();
    const action = args[0]?.toLowerCase();

    // If cutting a wire
    if (action === 'kes' || action === 'cut' || ['kirmizi', 'mavi', 'yesil'].includes(action)) {
      const chosenColor = (action === 'kes' || action === 'cut' ? args[1] : action)?.toLowerCase() as 'kirmizi' | 'mavi' | 'yesil';
      const bomb = this.activeBombs.get(username);

      if (!bomb || Date.now() > bomb.expiresAt) {
        this.activeBombs.delete(username);
        return `@${message.user.displayName}, şu an aktif bir bomban yok! Bomba kurmak için: !bomba`;
      }

      this.activeBombs.delete(username);

      if (chosenColor === bomb.wire) {
        const mult = this.settings.bomb.multiplier || 2.5;
        const reward = Math.round(bomb.amount * mult);
        economy.addPoints(username, reward);
        return `✂️ TIK... KABLO KESİLDİ! 🟢 @${message.user.displayName} doğru kabloyu (${chosenColor.toUpperCase()}) keserek C4 bombasını imha etti! +${reward} Puan kazandı! 🎖️`;
      } else {
        return `💥 B O O O O M ! Yanlış kabloyu kestin! (@${chosenColor || 'Bilinmeyen'}). Bomba patladı, -${bomb.amount} puan yandı! 💀`;
      }
    }

    // Start a new bomb game
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    const cost = 40;

    if (user.points < cost) {
      return `@${message.user.displayName}, bomba kurmak için en az 40 puanın olmalı! Bakiyen: ${user.points} 💰`;
    }

    economy.removePoints(username, cost);
    const wires: Array<'kirmizi' | 'mavi' | 'yesil'> = ['kirmizi', 'mavi', 'yesil'];
    const safeWire = wires[Math.floor(Math.random() * wires.length)];

    this.activeBombs.set(username, {
      user: username,
      wire: safeWire,
      amount: cost,
      expiresAt: Date.now() + (this.settings.bomb.cooldownSeconds || 30) * 1000
    });

    return `💣 DİKKAT! C4 SAATLİ BOMBA KURULDU! 3 kablo var: 🔴 Kırmızı, 🔵 Mavi, 🟢 Yeşil. 30 saniye içinde doğru kabloyu kes: !kes kirmizi / !kes mavi / !kes yesil ⏱️`;
  }

  // 8. COIN FLIP (YAZI TURA)
  handleCoinFlip(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.coinflip) {
      return `@${message.user.displayName}, Yazı-Tura oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    const choice = args[0]?.toLowerCase();
    const amountStr = args[1]?.toLowerCase();

    if (!choice || !['yazi', 'tura', 'yazı'].includes(choice)) {
      return `@${message.user.displayName}, kullanım: !yazitura <yazi/tura> <miktar> (Örnek: !yazitura tura 50)`;
    }

    const normalizedChoice = choice === 'yazı' ? 'yazi' : choice;

    let amount = 50;
    if (amountStr === 'hepsi' || amountStr === 'all') {
      amount = user.points;
    } else if (amountStr) {
      amount = parseInt(amountStr, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      return `@${message.user.displayName}, lütfen geçerli bir bahis gir! Örnek: !yazitura tura 50`;
    }

    if (amount < (this.settings.coinflip.minBet || 10)) {
      return `@${message.user.displayName}, minimum bahis: ${this.settings.coinflip.minBet || 10} Puan!`;
    }
    if (amount > (this.settings.coinflip.maxBet || 2500)) {
      return `@${message.user.displayName}, maksimum bahis: ${this.settings.coinflip.maxBet || 2500} Puan!`;
    }

    if (user.points < amount) {
      return `@${message.user.displayName}, yeterli puanın yok! Bakiyen: ${user.points} 💰`;
    }

    const outcome = Math.random() >= 0.5 ? 'yazi' : 'tura';
    const won = outcome === normalizedChoice;

    if (won) {
      economy.addPoints(message.user.username, amount);
      const newTotal = user.points + amount;
      return `🪙 Para havaya atıldı... Döndü ve [${outcome.toUpperCase()}] GELDİ! 🎉 @${message.user.displayName} kazandı (+${amount} Puan)! Yeni bakiyen: ${newTotal} 💰`;
    } else {
      economy.removePoints(message.user.username, amount);
      const newTotal = Math.max(0, user.points - amount);
      return `🪙 Para havaya atıldı... [${outcome.toUpperCase()}] geldi! 😢 @${message.user.displayName} kaybetti (-${amount} Puan). Yeni bakiyen: ${newTotal} 💸`;
    }
  }

  // 9. DICE (ZAR ATMA)
  handleDice(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.dice) {
      return `@${message.user.displayName}, Zar oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    const amountStr = args[0]?.toLowerCase();

    let amount = 50;
    if (amountStr === 'hepsi' || amountStr === 'all') {
      amount = user.points;
    } else if (amountStr) {
      amount = parseInt(amountStr, 10);
    }

    if (isNaN(amount) || amount <= 0) {
      return `@${message.user.displayName}, zar bahsi için miktar belirle! Örnek: !zar 50`;
    }

    if (amount < (this.settings.dice.minBet || 10)) {
      return `@${message.user.displayName}, minimum zar bahsi: ${this.settings.dice.minBet || 10} Puan!`;
    }
    if (amount > (this.settings.dice.maxBet || 2500)) {
      return `@${message.user.displayName}, maksimum zar bahsi: ${this.settings.dice.maxBet || 2500} Puan!`;
    }

    if (user.points < amount) {
      return `@${message.user.displayName}, yeterli puanın yok! Bakiyen: ${user.points} 💰`;
    }

    const userD1 = Math.floor(Math.random() * 6) + 1;
    const userD2 = Math.floor(Math.random() * 6) + 1;
    const userTotal = userD1 + userD2;

    const botD1 = Math.floor(Math.random() * 6) + 1;
    const botD2 = Math.floor(Math.random() * 6) + 1;
    const botTotal = botD1 + botD2;

    if (userTotal > botTotal) {
      economy.addPoints(message.user.username, amount);
      return `🎲 ZAR DÜELLOSU: @${message.user.displayName} [${userD1}+${userD2} = ${userTotal}] attı! Bot [${botD1}+${botD2} = ${botTotal}] attı. 🎉 KAZANDIN (+${amount} Puan)!`;
    } else if (userTotal < botTotal) {
      economy.removePoints(message.user.username, amount);
      return `🎲 ZAR DÜELLOSU: @${message.user.displayName} [${userD1}+${userD2} = ${userTotal}] attı! Bot [${botD1}+${botD2} = ${botTotal}] attı. 💀 KAYBETTİN (-${amount} Puan)!`;
    } else {
      return `🎲 ZAR DÜELLOSU: İki taraf da [${userTotal}] attı! BERABERE! Puanın iade edildi. 🤝`;
    }
  }

  // 10. LIST ALL GAMES
  handleGamesHelp(): string {
    return '🎮 STREAMAXT OYUNLARI: ' +
      '!soygun (Çete Banka Soygunu) | ' +
      '!yaris (Sokak Yarışı) | ' +
      '!trivia (Bilgi Yarışması) | ' +
      '!kelime (Kelime Avı) | ' +
      '!balik (Balık Tutma) | ' +
      '!kasaac (CS Kasa Açma) | ' +
      '!bomba (Bomba İmha) | ' +
      '!rulet (Rulet) | ' +
      '!slot (Slot Çevir) | ' +
      '!duello (Kılıç Düellosu) | ' +
      '!yazitura (Yazı-Tura) | ' +
      '!zar (Zar At)';
  }
}

export const gamesEngine = new GamesEngine();
export default gamesEngine;
