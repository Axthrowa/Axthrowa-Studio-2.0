import { ChatMessagePayload, eventBus } from '../../core/event-bus.js';
import { cuzdanAdi, economy } from '../economy/economy.js';
import { trKatla } from '../../core/text.js';
import { db } from '../../db/index.js';
import { triviaEngine } from './trivia-engine.js';
import { kelimeTuttuMu } from './cevap-eslestir.js';
import { karisikMetin, kelimeSec } from './kelime-havuzu.js';
import { panelden, PANEL_OYUNU } from './oyun-ayarlari.js';
import { bahisOku, YARIS_TEK_KAZANMA, BOMBA_CARPANI, SOYGUN_HEDEFLERI, SOYGUN_EKIP_BONUSU, SOYGUN_EKIP_UST, KASA_DILIMLERI } from './bahis.js';

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
  anagram: { rewardPoints: number; durationSeconds: number; showHint?: boolean };
  fishing: { cooldownSeconds: number; catchChancePercent: number };
  lootbox: { cost: number; jackpotMultiplier: number };
  bomb: { cooldownSeconds: number };
  dice: { minBet: number; maxBet: number };
  coinflip: { minBet: number; maxBet: number };
  duel: { minBet: number; maxBet: number };
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
  trivia: { rewardPoints: 150, durationSeconds: 20 },
  anagram: { rewardPoints: 150, durationSeconds: 40 },
  fishing: { cooldownSeconds: 45, catchChancePercent: 75 },
  lootbox: { cost: 100, jackpotMultiplier: 10 },
  bomb: { cooldownSeconds: 30 },
  dice: { minBet: 10, maxBet: 2500 },
  coinflip: { minBet: 10, maxBet: 2500 },
  duel: { minBet: 1, maxBet: 100000 }
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
  timer: NodeJS.Timeout;
}

/** Panelden başlatılan oyunlarda yazan ad: botun bağlı olduğu yayın hesabı */
function yayinciAdi(): string {
  try {
    const r = db.prepare("SELECT channel_name FROM channels WHERE is_active = 1 AND channel_name <> '' LIMIT 1").get() as { channel_name?: string } | undefined;
    return r?.channel_name?.trim() || 'Yayıncı';
  } catch {
    return 'Yayıncı';
  }
}

const OYUN_DUYURULARI: Record<string, string> = {
  balik: '🎣 Olta zamanı! Şansını denemek için: !balik',
  kasa: '📦 Kasalar hazır! Açmak için: !kasaac',
  bomba: '💣 Bombayı imha edebilir misin? Kurmak için: !bomba',
  zar: '🎲 Bota karşı zar at: !zar <miktar>',
  yazi_tura: '🪙 Yazı mı tura mı? !yazitura <yazi/tura> <miktar>',
  duello: '⚔️ Birine meydan oku: !duello @kisi <miktar>'
};

const KABLOLAR = ['kirmizi', 'mavi', 'yesil'];
/** Bu kadar tur aynı kelime yeniden sorulmaz */
const SON_KELIME_SAYISI = 40;

export class GamesEngine {
  private activeHeist: HeistLobby | null = null;
  private activeRace: RaceLobby | null = null;
  private activeAnagram: { word: string; scrambled: string; hint: string; reward: number; expiresAt: number; timer: NodeJS.Timeout } | null = null;
  private sonKelimeler: string[] = [];
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
        this.settings = {
          ...DEFAULT_GAME_SETTINGS,
          ...parsed,
          // Sonradan eklenen oyun kayıtlı listede yoksa kapalı sayılmasın
          enabledGames: { ...DEFAULT_GAME_SETTINGS.enabledGames, ...parsed.enabledGames }
        };
        // Eski panel kayıtları kendi adlarıyla duruyor (soygun, zar…): yayıncının seçtiği değerler uygulanır
        if (parsed.soygun) this.settings = panelden(this.settings, parsed);
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

  /** Panelin canlı lobi listesi: bekleyen soygun ve yarış lobileri. */
  panelLobileri() {
    const lobi = (game: string, l: HeistLobby | RaceLobby | null) =>
      l
        ? [{ game, participants: Array.from(l.participants.values()), totalPot: Array.from(l.participants.values()).reduce((t, k) => t + k.amount, 0) }]
        : [];
    return [...lobi('soygun', this.activeHeist), ...lobi('yaris', this.activeRace)];
  }

  /** İptal edilen lobide katılırken çekilen bahisleri geri verir. */
  private bahisleriIadeEt(katilimcilar: Map<string, { amount: number }>) {
    for (const [ad, k] of katilimcilar) economy.addPoints(ad, k.amount);
  }

  cancelLobby(tur: string): boolean {
    const type = PANEL_OYUNU[tur] || tur;
    if (type === 'heist' && this.activeHeist) {
      if (this.activeHeist.timer) clearTimeout(this.activeHeist.timer);
      this.bahisleriIadeEt(this.activeHeist.participants);
      this.activeHeist = null;
      eventBus.emitBotMessage({ platform: 'all', message: `❌ Aktif banka soygunu ${yayinciAdi()} tarafından iptal edildi.` });
      return true;
    }
    if (type === 'race' && this.activeRace) {
      if (this.activeRace.timer) clearTimeout(this.activeRace.timer);
      this.bahisleriIadeEt(this.activeRace.participants);
      this.activeRace = null;
      eventBus.emitBotMessage({ platform: 'all', message: `❌ Aktif sokak yarışı ${yayinciAdi()} tarafından iptal edildi.` });
      return true;
    }
    if (type === 'trivia') {
      triviaEngine.stopGame();
      return true;
    }
    if (type === 'anagram' && this.activeAnagram) {
      clearTimeout(this.activeAnagram.timer);
      this.activeAnagram = null;
      eventBus.emitBotMessage({ platform: 'all', message: '❌ Aktif kelime bulmacası iptal edildi.' });
      return true;
    }
    return false;
  }

  triggerGame(oyun: string): string {
    switch (PANEL_OYUNU[oyun] || oyun) {
      case 'trivia': {
        if (!this.settings.enabledGames.trivia) return 'Bil Bakalım kapalı: önce ayarlardan açın.';
        const q = triviaEngine.startQuestion({ durationSec: this.settings.trivia.durationSeconds });
        return q ? `🧠 Bil Bakalım sorusu başlatıldı: "${q.question}"` : 'Soru havuzunda soru bulunamadı!';
      }
      case 'anagram': {
        if (!this.settings.enabledGames.anagram) return 'Kelime Bulmacası kapalı: önce ayarlardan açın.';
        if (this.anagramAcikMi()) return `Zaten devam eden bir kelime bulmacası var: [ ${this.activeAnagram!.scrambled} ]`;
        const msg = this.anagramBaslat('all');
        eventBus.emitBotMessage({ platform: 'all', message: msg });
        return msg;
      }
      case 'heist': {
        if (!this.settings.enabledGames.heist) return 'Banka Soygunu kapalı: önce ayarlardan açın.';
        if (this.activeHeist) return 'Zaten aktif bir soygun lobisi var!';
        const dur = (this.settings.heist.countdownSeconds || 35) * 1000;
        this.activeHeist = {
          startedAt: Date.now(),
          platform: 'all',
          channel: 'stream',
          initiator: 'Yayıncı',
          // Boş başlar: eskiden hiç çekilmeyen 100 puanlık "Yayıncı" ekleniyor, kazanınca bedava puan yazılıyordu
          participants: new Map(),
          timer: setTimeout(() => this.executeHeist(), dur)
        };
        const msg = `🚨 BÜYÜK BANKA SOYGUNU BAŞLADI! ${yayinciAdi()} soygunu başlattı! Çeteye katılmak için ${Math.round(dur / 1000)} saniyeniz var: !soygun <miktar> 💼💥`;
        eventBus.emitBotMessage({ platform: 'all', message: msg });
        return msg;
      }
      case 'race': {
        if (!this.settings.enabledGames.race) return 'Sokak Yarışı kapalı: önce ayarlardan açın.';
        if (this.activeRace) return 'Zaten aktif bir yarış lobisi var!';
        const dur = (this.settings.race.countdownSeconds || 30) * 1000;
        this.activeRace = {
          startedAt: Date.now(),
          platform: 'all',
          channel: 'stream',
          initiator: 'Yayıncı',
          participants: new Map(),
          timer: setTimeout(() => this.executeRace(), dur)
        };
        const msg = `🏎️💨 SOKAK YARIŞI BAŞLIYOR! ${yayinciAdi()} pisti açtı! Katılmak için ${Math.round(dur / 1000)} saniyeniz var: !yaris <miktar> 🚦🏁`;
        eventBus.emitBotMessage({ platform: 'all', message: msg });
        return msg;
      }
      default: {
        // Panelin "Chate Gönder" düğmesi: lobisi olmayan oyunlar sohbete duyurulur (eskiden "Bilinmeyen oyun türü")
        const duyuru = OYUN_DUYURULARI[oyun];
        if (!duyuru) return 'Bilinmeyen oyun türü';
        eventBus.emitBotMessage({ platform: 'all', message: duyuru });
        return duyuru;
      }
    }
  }

  // 1. BANK HEIST (SOYGUN)
  handleHeist(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.heist) {
      return `@${message.user.displayName}, Banka Soygunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    const bahis = bahisOku(args[0], user.points, {
      kisi: message.user.displayName,
      ornek: 'soygun için miktar belirlemelisin! Örnek: !soygun 50 veya !soygun hepsi',
      ad: 'soygun bahsi',
      varsayilan: 50,
      min: this.settings.heist.minBet || 20,
      max: this.settings.heist.maxBet || 5000,
      hepsiEnAz: 10
    });
    if ('hata' in bahis) return bahis.hata;
    const amount = bahis.miktar;

    const username = cuzdanAdi(message.platform, message.user.username);
    if (this.activeHeist?.participants.has(username)) {
      return `@${message.user.displayName}, zaten bu soygun çetesindesin! Hazırda bekle! 🥷`;
    }
    // Bahis katılırken çekilir: sonuçta çekilseydi, bekleme sırasında puanını harcayan
    // izleyici kaybedince bakiye 0'da durur ve hiçbir şey kaybetmezdi.
    economy.removePoints(username, amount);

    // If heist is already running in countdown
    if (this.activeHeist) {
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
    if (count === 0) {
      eventBus.emitBotMessage({ platform: heist.platform, channel: heist.channel, message: '🏦 Soygun lobisi kapandı: kimse katılmadı.' });
      return;
    }
    const target = SOYGUN_HEDEFLERI[Math.floor(Math.random() * SOYGUN_HEDEFLERI.length)];
    const successRate = target.baseSuccess + Math.min(count, SOYGUN_EKIP_UST) * SOYGUN_EKIP_BONUSU;

    const winners: string[] = [];
    const losers: string[] = [];

    for (const [uname, info] of heist.participants.entries()) {
      const survived = Math.random() < successRate;
      if (survived) {
        const winAmount = Math.round(info.amount * target.multiplier);
        // Bahis katılırken çekildi: geri ver + kazanç
        economy.addPoints(uname, info.amount + winAmount);
        winners.push(`@${info.displayName} (+${winAmount})`);
      } else {
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
    const bahis = bahisOku(args[0], user.points, {
      kisi: message.user.displayName,
      ornek: 'yarışa katılmak için bahis belirle! Örnek: !yaris 50',
      ad: 'yarış bahsi',
      varsayilan: 50,
      min: this.settings.race.minBet || 20,
      max: this.settings.race.maxBet || 5000,
      hepsiEnAz: 10
    });
    if ('hata' in bahis) return bahis.hata;
    const amount = bahis.miktar;

    const username = cuzdanAdi(message.platform, message.user.username);
    if (this.activeRace?.participants.has(username)) {
      return `@${message.user.displayName}, zaten yarış çizgisindesin! Gaz pedalını hazırla! 🏎️`;
    }
    // Bahis katılırken çekilir (bkz. soygun); ödül havuzu gerçekten çekilen puanlardan oluşur.
    economy.removePoints(username, amount);

    if (this.activeRace) {
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

    if (drivers.length === 0) {
      eventBus.emitBotMessage({ platform: race.platform, channel: race.channel, message: '🏁 Yarış lobisi kapandı: kimse katılmadı.' });
      return;
    }

    if (drivers.length === 1) {
      // Solo race against the drift bot
      const solo = drivers[0];
      const win = Math.random() < YARIS_TEK_KAZANMA;
      if (win) {
        // Bahis katılırken çekildi: geri ver + aynı miktar kazanç
        economy.addPoints(solo.username, solo.amount * 2);
        eventBus.emitBotMessage({
          platform: race.platform,
          channel: race.channel,
          message: `🏎️💨 @${solo.displayName} pist rekorunu kırdı ve yarışı 1. bitirdi! +${solo.amount} Puan kazandı! 🏆`
        });
      } else {
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
    // Yuvarlama havuzdan fazla ya da eksik dağıtmasın
    const prize2 = totalPool - prize1;

    // Bahisler katılırken çekildi; havuz yalnız dağıtılır.
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

  // 4. ANAGRAM / KELİME AVI
  handleAnagram(message: ChatMessagePayload): string {
    if (!this.settings.enabledGames.anagram) {
      return `@${message.user.displayName}, Kelime Bulmacası şu anda devre dışı bırakılmış. ⏸️`;
    }
    if (this.anagramAcikMi()) {
      return `🔤 Zaten devam eden bir kelime bulmacası var: [ ${this.activeAnagram!.scrambled} ]`;
    }
    return this.anagramBaslat(message.platform, message.channel);
  }

  private anagramAcikMi(): boolean {
    return !!this.activeAnagram && Date.now() < this.activeAnagram.expiresAt;
  }

  private anagramBaslat(platform: string, channel?: string): string {
    const item = kelimeSec(this.sonKelimeler);
    this.sonKelimeler = [...this.sonKelimeler, item.kelime].slice(-SON_KELIME_SAYISI);
    const reward = this.settings.anagram.rewardPoints || 120;
    const durSec = this.settings.anagram.durationSeconds || 40;
    const scrambled = karisikMetin(item.kelime);
    if (this.activeAnagram) clearTimeout(this.activeAnagram.timer);
    this.activeAnagram = {
      word: item.kelime,
      scrambled,
      hint: item.ipucu,
      reward,
      expiresAt: Date.now() + durSec * 1000,
      // Kimse bilemezse cevap söylenir; eskiden bulmaca sessizce kapanıyordu
      timer: setTimeout(() => {
        this.activeAnagram = null;
        eventBus.emitBotMessage({ platform: platform as PlatformType, channel, message: `⌛ Süre doldu! Kelime "${item.kelime.toLocaleUpperCase('tr-TR')}" idi.` });
      }, durSec * 1000)
    };
    return `🔤 KELİME BULMACASI: Karışık harfleri doğru sıraya dizip ilk yazan ${reward} Puanı kapar! 👉 [ ${scrambled} ] (${this.settings.anagram.showHint === false ? '' : `İpucu: ${item.ipucu} | `}Süre: ${durSec} sn) 🕒`;
  }

  // Check incoming chat messages for trivia / anagram answers
  checkChatMessage(message: ChatMessagePayload): string | null {
    const now = Date.now();

    if (this.activeAnagram && now < this.activeAnagram.expiresAt) {
      const target = this.activeAnagram.word;
      // Kelimeler ASCII tutuluyor ("yayin"); "yayın" yazan da bilsin
      if (kelimeTuttuMu(message.message || '', target)) {
        const reward = this.activeAnagram.reward;
        clearTimeout(this.activeAnagram.timer);
        this.activeAnagram = null;
        economy.addPoints(cuzdanAdi(message.platform, message.user.username), reward);
        return `🎉 BİLDİN @${message.user.displayName}! Doğru kelime "${target.toLocaleUpperCase('tr-TR')}" idi! +${reward} Puan kazandın! 🔤✨`;
      }
    }

    return null;
  }

  // 5. FISHING (BALIK TUTMA)
  handleFishing(message: ChatMessagePayload): string {
    if (!this.settings.enabledGames.fishing) {
      return `@${message.user.displayName}, Balık Tutma oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const username = cuzdanAdi(message.platform, message.user.username);
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

    economy.removePoints(cuzdanAdi(message.platform, message.user.username), cost);
    const roll = Math.random() * 100;

    if (roll < KASA_DILIMLERI.siradan[0]) {
      // Common
      const prize = Math.round(cost * KASA_DILIMLERI.siradan[1]);
      economy.addPoints(cuzdanAdi(message.platform, message.user.username), prize);
      return `📦 [KASA AÇILDI] ⚪ Sıradan Drop: @${message.user.displayName} [Paslı Çakı | Sahada Test Edilmiş] çıkardı! (+${prize} Puan) 💸`;
    } else if (roll < KASA_DILIMLERI.nadir[0]) {
      // Rare
      const prize = Math.round(cost * KASA_DILIMLERI.nadir[1]);
      economy.addPoints(cuzdanAdi(message.platform, message.user.username), prize);
      return `📦 [KASA AÇILDI] 🔵 Nadir Drop: @${message.user.displayName} [AK-47 | Neon Devrimi] çıkardı! (+${prize} Puan)! ✨`;
    } else if (roll < KASA_DILIMLERI.epik[0]) {
      // Epic
      const prize = Math.round(cost * KASA_DILIMLERI.epik[1]);
      economy.addPoints(cuzdanAdi(message.platform, message.user.username), prize);
      return `📦 [KASA AÇILDI] 🟣 EPİK DROP! @${message.user.displayName} [AWP | Ejderha Ateşi] düşürdü! (+${prize} Puan) 🐉🔥`;
    } else {
      // Legendary Gold
      const mult = this.settings.lootbox.jackpotMultiplier || 10;
      const prize = cost * mult;
      economy.addPoints(cuzdanAdi(message.platform, message.user.username), prize);
      return `📦✨ [ALTIN DROP!] 🟡 EFSANEVİ BIÇAK! @${message.user.displayName} kasadan [★ KARAMBİT | FADE (Fabrikadan Yeni Çıkmış)] çıkardı! TAM +${prize} PUAN! 🏆👑`;
    }
  }

  // 7. BOMB DEFUSAL (BOMBA İMHA)
  handleBomb(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.bomb) {
      return `@${message.user.displayName}, Bomba İmha oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const username = cuzdanAdi(message.platform, message.user.username);
    const action = trKatla(args[0] || '');

    // If cutting a wire
    if (action === 'kes' || action === 'cut' || KABLOLAR.includes(action)) {
      // Türkçe yazım da geçerli: "!kes kırmızı" eskiden tanınmıyor, doğru kablo olsa bile bomba patlıyordu
      const chosenColor = trKatla((action === 'kes' || action === 'cut' ? args[1] : action) || '');
      const bomb = this.activeBombs.get(username);

      if (!bomb || Date.now() > bomb.expiresAt) {
        return `@${message.user.displayName}, şu an aktif bir bomban yok! Bomba kurmak için: !bomba`;
      }

      // Renk yazılmadıysa ya da yanlış yazıldıysa bomba patlamaz, yeniden sorulur
      if (!KABLOLAR.includes(chosenColor)) {
        return `@${message.user.displayName}, hangi kablo? !kes kirmizi / !kes mavi / !kes yesil`;
      }

      clearTimeout(bomb.timer);
      this.activeBombs.delete(username);

      if (chosenColor === bomb.wire) {
        const reward = Math.round(bomb.amount * BOMBA_CARPANI);
        economy.addPoints(username, reward);
        return `✂️ TIK... KABLO KESİLDİ! 🟢 @${message.user.displayName} doğru kabloyu (${chosenColor.toUpperCase()}) keserek C4 bombasını imha etti! +${reward} Puan kazandı! 🎖️`;
      } else {
        return `💥 B O O O O M ! @${message.user.displayName} yanlış kabloyu (${chosenColor.toUpperCase()}) kesti! Doğrusu ${bomb.wire.toUpperCase()} idi, -${bomb.amount} puan yandı! 💀`;
      }
    }

    // Bomba zaten kuruluysa ikinci kez ücret alınmaz (eskiden eskisinin üstüne yazılıyordu)
    if (this.activeBombs.has(username)) {
      return `@${message.user.displayName}, bomban zaten kurulu! Kablo seç: !kes kirmizi / !kes mavi / !kes yesil`;
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

    const sureSn = this.settings.bomb.cooldownSeconds || 30;
    this.activeBombs.set(username, {
      user: username,
      wire: safeWire,
      amount: cost,
      expiresAt: Date.now() + sureSn * 1000,
      // Süre dolunca oyuncu ne olduğunu görsün; eskiden puanı sessizce gidiyordu
      timer: setTimeout(() => {
        this.activeBombs.delete(username);
        eventBus.emitBotMessage({ platform: message.platform, channel: message.channel, message: `💥 @${message.user.displayName}, süre doldu ve bomba patladı! -${cost} puan yandı.` });
      }, sureSn * 1000)
    });

    return `💣 DİKKAT! C4 SAATLİ BOMBA KURULDU! 3 kablo var: 🔴 Kırmızı, 🔵 Mavi, 🟢 Yeşil. ${sureSn} saniye içinde doğru kabloyu kes: !kes kirmizi / !kes mavi / !kes yesil ⏱️`;
  }

  // 8. COIN FLIP (YAZI TURA)
  handleCoinFlip(message: ChatMessagePayload, args: string[]): string {
    if (!this.settings.enabledGames.coinflip) {
      return `@${message.user.displayName}, Yazı-Tura oyunu şu anda devre dışı bırakılmış. ⏸️`;
    }
    const user = economy.getUser(message.platform, message.user.username, message.user.displayName);
    // Sıra fark etmesin: "!yazitura 50 tura" da geçerli
    const sayiOnde = /^\d+$/.test(args[0] || '') || trKatla(args[0] || '') === 'hepsi';
    const choice = trKatla((sayiOnde ? args[1] : args[0]) || '');
    const amountStr = (sayiOnde ? args[0] : args[1])?.toLowerCase();

    if (!choice || !['yazi', 'tura'].includes(choice)) {
      return `@${message.user.displayName}, kullanım: !yazitura <yazi/tura> <miktar> (Örnek: !yazitura tura 50)`;
    }

    const bahis = bahisOku(amountStr, user.points, {
      kisi: message.user.displayName,
      ornek: 'lütfen geçerli bir bahis gir! Örnek: !yazitura tura 50',
      varsayilan: 50,
      min: this.settings.coinflip.minBet || 10,
      max: this.settings.coinflip.maxBet || 2500
    });
    if ('hata' in bahis) return bahis.hata;
    const amount = bahis.miktar;

    const outcome = Math.random() >= 0.5 ? 'yazi' : 'tura';
    const won = outcome === choice;

    if (won) {
      economy.addPoints(cuzdanAdi(message.platform, message.user.username), amount);
      const newTotal = user.points + amount;
      return `🪙 Para havaya atıldı... Döndü ve [${outcome.toUpperCase()}] GELDİ! 🎉 @${message.user.displayName} kazandı (+${amount} Puan)! Yeni bakiyen: ${newTotal} 💰`;
    } else {
      economy.removePoints(cuzdanAdi(message.platform, message.user.username), amount);
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
    const bahis = bahisOku(args[0], user.points, {
      kisi: message.user.displayName,
      ornek: 'zar bahsi için miktar belirle! Örnek: !zar 50',
      ad: 'zar bahsi',
      varsayilan: 50,
      min: this.settings.dice.minBet || 10,
      max: this.settings.dice.maxBet || 2500
    });
    if ('hata' in bahis) return bahis.hata;
    const amount = bahis.miktar;

    const userD1 = Math.floor(Math.random() * 6) + 1;
    const userD2 = Math.floor(Math.random() * 6) + 1;
    const userTotal = userD1 + userD2;

    const botD1 = Math.floor(Math.random() * 6) + 1;
    const botD2 = Math.floor(Math.random() * 6) + 1;
    const botTotal = botD1 + botD2;

    if (userTotal > botTotal) {
      economy.addPoints(cuzdanAdi(message.platform, message.user.username), amount);
      return `🎲 ZAR DÜELLOSU: @${message.user.displayName} [${userD1}+${userD2} = ${userTotal}] attı! Bot [${botD1}+${botD2} = ${botTotal}] attı. 🎉 KAZANDIN (+${amount} Puan)!`;
    } else if (userTotal < botTotal) {
      economy.removePoints(cuzdanAdi(message.platform, message.user.username), amount);
      return `🎲 ZAR DÜELLOSU: @${message.user.displayName} [${userD1}+${userD2} = ${userTotal}] attı! Bot [${botD1}+${botD2} = ${botTotal}] attı. 💀 KAYBETTİN (-${amount} Puan)!`;
    } else {
      return `🎲 ZAR DÜELLOSU: İki taraf da [${userTotal}] attı! BERABERE! Puanın iade edildi. 🤝`;
    }
  }
}

export const gamesEngine = new GamesEngine();
export default gamesEngine;
