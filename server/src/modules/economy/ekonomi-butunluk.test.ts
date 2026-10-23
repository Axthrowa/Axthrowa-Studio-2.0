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
  `);
  return { db };
});
vi.mock('../tts/tts.js', () => ({ ttsEngine: { enqueue: () => {} } }));
vi.mock('../games/trivia-engine.js', () => ({ triviaEngine: { stopGame: () => {} } }));

// vi.mock çağrıları içe aktarmalardan önceye taşınır: bunlar sahte veritabanını görür.
import { db } from '../../db/index.js';
import { cuzdanAdi, economy } from './economy.js';
import { gamesEngine } from '../games/games.js';
import { seviyeler } from '../levels/levels.js';
import { ttsEngine } from '../tts/tts.js';

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
    vi.spyOn(Math, 'random').mockReturnValue(0); // ilk hedef (x1.6), herkes kaçar
    vi.advanceTimersByTime(60_000);
    expect(economy.getUserPoints('ali')).toBe(500 + 800);
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
