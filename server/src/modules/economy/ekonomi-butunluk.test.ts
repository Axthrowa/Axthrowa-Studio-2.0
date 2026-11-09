/**
 * Puan ekonomisinin bütünlüğü: bahisler, düello, market iadesi ve sıfırlama önbellek
 * toplu yazımından (flushAll) sonra da doğru kalmalı. Gerçek veritabanı yerine bellek içi SQLite.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE economy (id TEXT PRIMARY KEY, platform TEXT NOT NULL, username TEXT NOT NULL, display_name TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 100, watch_time_minutes INTEGER NOT NULL DEFAULT 0, messages_count INTEGER NOT NULL DEFAULT 0,
      subs_count INTEGER NOT NULL DEFAULT 0, gifted_subs_count INTEGER NOT NULL DEFAULT 0, tips_amount REAL NOT NULL DEFAULT 0,
      loyalty_tier TEXT NOT NULL DEFAULT 'Çaylak', last_active INTEGER NOT NULL, xp INTEGER DEFAULT 0, level INTEGER DEFAULT 0);
    CREATE TABLE bot_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE loyalty_rewards (id TEXT PRIMARY KEY, title TEXT NOT NULL, cost INTEGER NOT NULL, reward_type TEXT NOT NULL,
      payload TEXT, is_enabled INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE loyalty_redemptions (id TEXT PRIMARY KEY, platform TEXT, username TEXT, display_name TEXT, reward_id TEXT,
      reward_title TEXT, cost INTEGER, custom_input TEXT, status TEXT, created_at INTEGER);
    CREATE TABLE giveaways (id TEXT PRIMARY KEY, title TEXT, keyword TEXT, is_active INTEGER DEFAULT 1, sub_bonus_multiplier REAL DEFAULT 2,
      cost_points INTEGER DEFAULT 0, winner TEXT, winner_platform TEXT, created_at INTEGER, closed_at INTEGER);
    CREATE TABLE giveaway_entries (id TEXT PRIMARY KEY, giveaway_id TEXT, username TEXT, platform TEXT, tickets INTEGER DEFAULT 1, entered_at INTEGER);
  `);
  return { db };
});
vi.mock('../tts/tts.js', () => ({ ttsEngine: { enqueue: () => {} } }));
vi.mock('../games/trivia-engine.js', () => ({ triviaEngine: { stopGame: () => {} } }));

// vi.mock çağrıları içe aktarmalardan önceye taşınır: bunlar sahte veritabanını görür.
import { db } from '../../db/index.js';
import { cuzdanAdi, DUELLO_SURESI_MS, economy } from './economy.js';
import { gamesEngine } from '../games/games.js';
import { panelAyari, panelden } from '../games/oyun-ayarlari.js';
import { seviyeler } from '../levels/levels.js';
import { ttsEngine } from '../tts/tts.js';
import { giveaway } from '../giveaways/giveaways.js';
import { canliDurum } from '../../core/live-status.js';

const mesaj = (ad: string) =>
  ({
    id: 'm', platform: 'kick', channel: 'kanal',
    user: { id: ad, username: ad, displayName: ad, badges: [], isMod: false, isSub: false, isVip: false, isBroadcaster: false },
    message: ''
  }) as any;

function bakiyeYap(ad: string, puan: number) {
  economy.getUser('kick', ad, ad);
  economy.addPoints(ad, puan - economy.getUserPoints(ad));
}
const diskteki = (ad: string) =>
  (db.prepare('SELECT points FROM economy WHERE username = ?').get(ad) as { points: number }).points;

beforeEach(() => {
  vi.useFakeTimers();
  economy.tabloyuDegistir(() => db.exec('DELETE FROM economy; DELETE FROM loyalty_redemptions; DELETE FROM loyalty_rewards;'));
});
afterEach(() => {
  gamesEngine.cancelLobby('heist');
  gamesEngine.cancelLobby('race');
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('soygun/yarış bahsi katılırken çekilir', () => {
  it('katılıp puanını harcayan kaybedince bedava oynamış olmaz', () => {
    bakiyeYap('ali', 500);
    expect(gamesEngine.handleHeist(mesaj('ali'), ['500'])).toContain('SOYGUNU BAŞLADI');
    expect(economy.getUserPoints('ali')).toBe(0); // bahis hemen çekildi, harcanacak puan kalmadı
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // herkes yakalanır
    vi.advanceTimersByTime(60_000);
    expect(economy.getUserPoints('ali')).toBe(0);
  });

  it('kazanan bahsini ve kazancını alır', () => {
    bakiyeYap('ali', 500);
    gamesEngine.handleHeist(mesaj('ali'), ['500']);
    vi.spyOn(Math, 'random').mockReturnValue(0); // ilk hedef (kâr x0.5), herkes kaçar
    vi.advanceTimersByTime(60_000);
    expect(economy.getUserPoints('ali')).toBe(500 + 250);
  });

  it('iptal edilen lobi bahisleri iade eder', () => {
    bakiyeYap('ali', 500);
    bakiyeYap('veli', 400);
    gamesEngine.handleRace(mesaj('ali'), ['300']);
    gamesEngine.handleRace(mesaj('veli'), ['400']);
    expect(economy.getUserPoints('ali')).toBe(200);
    gamesEngine.cancelLobby('race');
    expect(economy.getUserPoints('ali')).toBe(500);
    expect(economy.getUserPoints('veli')).toBe(400);
  });

  it('çok oyunculu yarış yalnız çekilen havuzu dağıtır (puan basılmaz)', () => {
    bakiyeYap('ali', 300);
    bakiyeYap('veli', 300);
    gamesEngine.handleRace(mesaj('ali'), ['300']);
    gamesEngine.handleRace(mesaj('veli'), ['300']);
    vi.advanceTimersByTime(60_000);
    expect(economy.getUserPoints('ali') + economy.getUserPoints('veli')).toBe(600);
  });
});

describe('cüzdan platforma göre ayrılır', () => {
  it('Discord’daki aynı adlı kişi Kick izleyicisinin puanını harcayamaz', () => {
    bakiyeYap('ali', 5000); // Kick
    const discordAli = { ...mesaj('ali'), platform: 'discord' };
    expect(economy.getUser('discord', 'ali', 'ali').points).toBe(100); // ayrı, yeni cüzdan (başlangıç puanı)
    gamesEngine.handleHeist(discordAli, ['hepsi']);
    expect(economy.getUserPoints('ali')).toBe(5000);
    expect(economy.getUserPoints('discord:ali')).toBe(0);
  });

  it('cuzdanAdi: Kick düz ad, diğerleri platform önekli, önekli ad değişmez', () => {
    expect(cuzdanAdi('kick', '@Ali')).toBe('ali');
    expect(cuzdanAdi(undefined, 'Ali')).toBe('ali');
    expect(cuzdanAdi('discord', 'Ali')).toBe('discord:ali');
    expect(cuzdanAdi('twitch', 'twitch:ali')).toBe('twitch:ali');
  });
});

describe('düello', () => {
  it('düellonun miktarı kabul edenin yazdığıyla değil, kendi miktarıyla denetlenir', () => {
    bakiyeYap('ali', 5000);
    bakiyeYap('veli', 5000);
    economy.handleDuel(mesaj('ali'), ['@veli', '5000']);
    economy.removePoints('veli', 4990); // veli bekleme sırasında harcadı
    expect(economy.handleDuel(mesaj('veli'), ['@ali', '1'])).toContain('yeterli puanın yok');
    expect(economy.getUserPoints('ali')).toBe(5000);
    expect(economy.getUserPoints('veli')).toBe(10);
  });

  it('süresi geçmiş davet kabul edilmez, yeni davet olur', () => {
    bakiyeYap('ali', 5000);
    bakiyeYap('veli', 5000);
    economy.handleDuel(mesaj('ali'), ['@veli', '5000']);
    vi.advanceTimersByTime(DUELLO_SURESI_MS + 1);
    expect(economy.handleDuel(mesaj('veli'), ['@ali', '5'])).toContain('MEYDAN OKUMA');
    expect(economy.getUserPoints('veli')).toBe(5000);
  });
});

describe('önbellek toplu yazımından sonra', () => {
  it('market iadesi kalır ve iki kez iade edilemez', () => {
    bakiyeYap('ali', 1000);
    db.prepare("INSERT INTO loyalty_rewards (id, title, cost, reward_type) VALUES ('reward-sapka', 'Şapka', 500, 'custom')").run();
    economy.handleRedeemCommand(mesaj('ali'), ['sapka']);
    expect(economy.getUserPoints('ali')).toBe(500);
    const { id } = db.prepare('SELECT id FROM loyalty_redemptions').get() as { id: string };
    expect(economy.talepDurumu(id, 'refunded')).toEqual({ ok: true });
    economy.flushAll();
    expect(diskteki('ali')).toBe(1000);
    expect(economy.talepDurumu(id, 'refunded')).toMatchObject({ ok: false, kod: 409 });
    expect(economy.talepDurumu(id, 'pending')).toMatchObject({ ok: false, kod: 400 });
  });

  it('puan sıfırlama geri alınmaz', () => {
    bakiyeYap('ali', 700);
    seviyeler.sifirla('puan');
    economy.getUser('kick', 'ali', 'ali');
    economy.flushAll();
    expect(diskteki('ali')).toBe(0);
    expect(economy.getUserPoints('ali')).toBe(0);
  });
});

describe('izleme süresi', () => {
  it('sıralama sayfası sık sık toplu yazım yapsa da sohbet eden izleyici aktif sayılır', () => {
    vi.setSystemTime(1_000_000_000);
    economy.getUser('kick', 'ali', 'ali');
    for (let dk = 1; dk <= 15; dk++) {
      vi.setSystemTime(1_000_000_000 + dk * 60_000);
      economy.getUser('kick', 'ali', 'ali'); // sohbet
      economy.flushAll(); // Sıralama sayfası 5 sn'de bir yazar
    }
    expect(economy.recordWatchTime(5)).toBe(1);
  });
});

describe('seviye XP cüzdanı', () => {
  it('Twitch izleyicisinin XP’si aynı adlı Kick izleyicisine yazılmaz', () => {
    economy.getUser('kick', 'ali', 'ali');
    economy.getUser('twitch', 'ali', 'ali');
    seviyeler.xpEkle(cuzdanAdi('twitch', 'ali'), 40);
    expect(seviyeler.kullanici('twitch:ali').xp).toBe(40);
    expect(seviyeler.kullanici('ali').xp).toBe(0);
  });
});

describe('market TTS', () => {
  it('özel talebin metni yayında okunmaz, TTS ödülününki okunur', () => {
    const oku = vi.spyOn(ttsEngine, 'enqueue');
    bakiyeYap('ali', 1000);
    db.prepare("INSERT INTO loyalty_rewards (id, title, cost, reward_type) VALUES ('reward-talep', 'Talep', 10, 'custom')").run();
    db.prepare("INSERT INTO loyalty_rewards (id, title, cost, reward_type) VALUES ('reward-oku', 'Oku', 10, 'tts')").run();
    economy.handleRedeemCommand(mesaj('ali'), ['talep', 'bunu', 'oku']);
    expect(oku).not.toHaveBeenCalled();
    economy.handleRedeemCommand(mesaj('ali'), ['oku', 'merhaba']);
    expect(oku).toHaveBeenCalledWith('merhaba', 'ali');
  });
});

describe('ücretli çekiliş', () => {
  it('kazanan çekilmeden yenisi açılırsa katılım puanları iade edilir', () => {
    bakiyeYap('ali', 500);
    const g = giveaway.createGiveaway('Eski', '!katil', 1, 100);
    economy.removePoints('ali', 100); // katılımda düşülen
    db.prepare("INSERT INTO giveaway_entries (id, giveaway_id, username, platform, entered_at) VALUES ('e1', ?, 'ali', 'kick', 1)").run(g.id);
    giveaway.createGiveaway('Yeni', '!katil', 1, 0);
    expect(economy.getUserPoints('ali')).toBe(500);
  });
});

describe('oyun düzeltmeleri', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('!kes kırmızı Türkçe yazımla tanınır, renksiz kes bombayı patlatmaz', () => {
    economy.addPoints('bombaci', 1000);
    vi.spyOn(Math, 'random').mockReturnValue(0); // doğru kablo: kirmizi
    expect(gamesEngine.handleBomb(mesaj('bombaci'), [])).toContain('BOMBA KURULDU');
    expect(gamesEngine.handleBomb(mesaj('bombaci'), [])).toContain('zaten kurulu');
    expect(gamesEngine.handleBomb(mesaj('bombaci'), ['kes', undefined as unknown as string])).toContain('hangi kablo');
    expect(gamesEngine.handleBomb(mesaj('bombaci'), ['kes', 'kırmızı'])).toContain('imha etti');
    vi.restoreAllMocks();
  });

  it('süresi dolan bomba sohbete yazılır ve yenisi kurulabilir', () => {
    economy.addPoints('gec', 1000);
    gamesEngine.handleBomb(mesaj('gec'), []);
    vi.advanceTimersByTime(31_000);
    expect(gamesEngine.handleBomb(mesaj('gec'), [])).toContain('BOMBA KURULDU');
    gamesEngine.handleBomb(mesaj('gec'), ['kes', 'mavi']);
  });

  it('yazı-tura miktar önce yazılınca da çalışır', () => {
    economy.addPoints('para', 1000);
    expect(gamesEngine.handleCoinFlip(mesaj('para'), ['50', 'TURA'])).toContain('Para havaya atıldı');
  });

  it('panelden başlatılan soygun kimseye bedava puan yazmaz, boş lobi kapanır', () => {
    const once = economy.getUserPoints('yayinci');
    gamesEngine.triggerGame('soygun');
    expect(gamesEngine.panelLobileri()[0]).toMatchObject({ game: 'soygun', totalPot: 0 });
    vi.advanceTimersByTime(60_000);
    expect(gamesEngine.panelLobileri()).toEqual([]);
    expect(economy.getUserPoints('yayinci')).toBe(once);
  });

  it('panel kelime oyununu adıyla başlatır, harfler kelimenin kendisi değildir', () => {
    const m = gamesEngine.triggerGame('kelime');
    expect(m).toContain('KELİME BULMACASI');
    const karisik = m.match(/\[ (.+?) \]/)?.[1] || '';
    expect(karisik).toMatch(/ - /);
    expect(gamesEngine.cancelLobby('kelime')).toBe(true);
    expect(gamesEngine.cancelLobby('kelime')).toBe(false);
  });

  it('!slot hepsi kabul edilir', () => {
    economy.addPoints('slotcu', 100);
    expect(economy.handleSlots(mesaj('slotcu'), ['hepsi'])).toContain('🎰');
  });
});

describe('panel ayarları oyuna ulaşır', () => {
  it('kapalı oyun panelden de başlamaz', () => {
    const s = gamesEngine.getSettings();
    gamesEngine.updateSettings(panelden(s, { soygun: { enabled: false } }));
    expect(gamesEngine.triggerGame('soygun')).toContain('kapalı');
    expect(gamesEngine.panelLobileri()).toEqual([]);
    gamesEngine.updateSettings(panelden(gamesEngine.getSettings(), { soygun: { enabled: true } }));
  });

  it('kapatma ve sınırlar motora yazılır, panele aynı döner', () => {
    const s = gamesEngine.getSettings();
    const y = panelden(s, { soygun: { enabled: false, minBet: 30, maxBet: 10, cooldownSec: 60 }, kelime: { rewardPoints: 75, timeoutSec: 25 } });
    expect(y.enabledGames.heist).toBe(false);
    expect(y.heist).toMatchObject({ minBet: 30, maxBet: 30, countdownSeconds: 60 });
    expect(y.anagram).toEqual({ rewardPoints: 75, durationSeconds: 25 });
    expect(panelAyari(y).soygun).toEqual({ enabled: false, minBet: 30, maxBet: 30, cooldownSec: 60 });
    expect(y.enabledGames.dice).toBe(s.enabledGames.dice);
  });
});

describe('kapanışa dayanıklılık', () => {
  it('mesaj puanı en geç 30 saniyede diske yazılır (süreç öldürülünce kaybolmaz)', () => {
    bakiyeYap('ali', 100);
    economy.startWatchTimeLoop(5);
    economy.recordMessage(mesaj('ali'));
    expect(diskteki('ali')).toBe(100);
    vi.advanceTimersByTime(30_000);
    expect(diskteki('ali')).toBe(102);
  });
});

describe('izleme puanı', () => {
  const izleme = () =>
    (db.prepare('SELECT watch_time_minutes w FROM economy WHERE username = ?').get('ali') as { w: number }).w;

  it('yayın kapalıyken verilmez', () => {
    bakiyeYap('ali', 100);
    vi.spyOn(canliDurum, 'genel').mockReturnValue({ canli: false } as any);
    expect(economy.recordWatchTime(5)).toBe(0);
    economy.flushAll();
    expect(izleme()).toBe(0);
    expect(diskteki('ali')).toBe(100);
  });

  it('yayın açıkken ve durum bilinmiyorken verilir', () => {
    bakiyeYap('ali', 100);
    vi.spyOn(canliDurum, 'genel').mockReturnValue({ canli: true } as any);
    expect(economy.recordWatchTime(5)).toBe(1);
    vi.spyOn(canliDurum, 'genel').mockReturnValue({ canli: null } as any);
    expect(economy.recordWatchTime(5)).toBe(1);
    expect(izleme()).toBe(10);
  });
});

describe('düello hedefi', () => {
  const satirSayisi = () => (db.prepare('SELECT COUNT(*) c FROM economy').get() as { c: number }).c;

  it('uydurma ada cüzdan açmaz', () => {
    bakiyeYap('ali', 1000);
    const once = satirSayisi();
    expect(economy.handleDuel(mesaj('ali'), ['@hayalet_kisi', '1'])).toContain('yeterli puanı yok');
    expect(satirSayisi()).toBe(once);
  });

  it('geçersiz ad reddedilir', () => {
    bakiyeYap('ali', 1000);
    expect(economy.handleDuel(mesaj('ali'), ['<script>', '1'])).toContain('düello başlatmak için');
  });
});

describe('toplu ödeme', () => {
  it('hata olursa disk ve önbellek eski bakiyeye döner; ödenmemiş mesaj puanı korunur', () => {
    bakiyeYap('ali', 100);
    economy.recordMessage(mesaj('ali'));
    expect(() =>
      economy.topluOde([{ kullanici: 'ali', puan: 50 }], () => {
        throw new Error('kayıt yazılamadı');
      })
    ).toThrow('kayıt yazılamadı');
    expect(economy.getUserPoints('ali')).toBe(102);
    expect(diskteki('ali')).toBe(102);
  });
});

describe('önbellek uzun yayında sınırsız büyümez', () => {
  it('1 saattir sessiz kullanıcı diske yazılıp bellekten düşer, puanı korunur', () => {
    const onbellek = (economy as any).userCache as Map<string, unknown>;
    bakiyeYap('sessiz', 700);
    vi.advanceTimersByTime(61 * 60_000);
    bakiyeYap('aktif', 300);
    economy.flushAll();
    expect(onbellek.has('sessiz')).toBe(false);
    expect(onbellek.has('aktif')).toBe(true);
    expect(diskteki('sessiz')).toBe(700);
    expect(economy.getUserPoints('sessiz')).toBe(700); // yeniden okununca diskteki bakiye gelir
  });
});
