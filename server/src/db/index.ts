import { DatabaseSync } from 'node:sqlite';
import { satiriCoz } from '../core/security/vault.js';
import path from 'path';
import fs from 'fs';
import { syncTriviaBank, triviaBankasiniOnar } from '../modules/games/trivia-sync.js';
import { gocleriUygula } from './migrations.js';
import { hataMetni } from '../core/logger.js';

const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'streamaxt.sqlite');
// Kilit beklemesi İLK iş: başka bir kopya veritabanını tutarken açılış hemen
// "database is locked" ile çöküyordu (journal_mode PRAGMA'sı beklemeden önce koşuyordu).
const db = new DatabaseSync(dbPath, { timeout: 15000 } as any);
db.exec('PRAGMA busy_timeout = 15000;');

// High-performance SQLite configuration for ultra-low latency bot operations
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');
db.exec('PRAGMA cache_size = -8000;'); // 8 MB optimized cache (saves ~56MB RAM)
db.exec('PRAGMA mmap_size = 33554432;'); // 32 MB memory-mapped I/O
db.exec('PRAGMA temp_store = MEMORY;');
db.exec('PRAGMA wal_autocheckpoint = 100;'); // Keeps WAL file compact
// busy_timeout yukarıda (açılışta) ayarlandı

// S6 — şifreli sırlar (`dpapi:v1:...`) TEK NOKTADAN, okurken çözülür:
// 29 ayrı okuma yerine dokunmadan tüm `get/all/iterate` sonuçlarındaki
// önekli değerler düz metne çevrilir. Öneksiz değerler AYNEN geçer
// (geriye uyum). Bkz. core/security/vault.ts
const asilPrepare = db.prepare.bind(db);
/** Şifre ÇÖZMEDEN okuma — yalnız sır geçişi (vault-migrate) için. */
export function hamSorgu(sql: string) {
  return asilPrepare(sql);
}
{
  (db as any).prepare = (sql: string) => {
    const st: any = asilPrepare(sql);
    const asilGet = st.get.bind(st);
    const asilAll = st.all.bind(st);
    st.get = (...a: any[]) => satiriCoz(asilGet(...a));
    st.all = (...a: any[]) => (asilAll(...a) as any[]).map((r) => satiriCoz(r));
    if (typeof st.iterate === 'function') {
      const asilIterate = st.iterate.bind(st);
      st.iterate = function* (...a: any[]) {
        for (const r of asilIterate(...a)) yield satiriCoz(r);
      };
    }
    return st;
  };
}
db.exec('PRAGMA optimize;');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS channels (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    account_id TEXT,
    token TEXT,
    refresh_token TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS commands (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    response TEXT NOT NULL,
    user_level TEXT NOT NULL DEFAULT 'everyone',
    cooldown INTEGER NOT NULL DEFAULT 5,
    aliases TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    use_count INTEGER NOT NULL DEFAULT 0,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS timers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    messages TEXT NOT NULL,
    interval_minutes INTEGER NOT NULL DEFAULT 15,
    min_chat_lines INTEGER NOT NULL DEFAULT 5,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    last_run_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS automod_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    caps_enabled INTEGER NOT NULL DEFAULT 1,
    caps_min_length INTEGER NOT NULL DEFAULT 10,
    caps_max_percent INTEGER NOT NULL DEFAULT 70,
    emotes_enabled INTEGER NOT NULL DEFAULT 1,
    emotes_max INTEGER NOT NULL DEFAULT 8,
    links_enabled INTEGER NOT NULL DEFAULT 1,
    links_whitelist TEXT NOT NULL DEFAULT '[]',
    symbols_enabled INTEGER NOT NULL DEFAULT 1,
    symbols_max_percent INTEGER NOT NULL DEFAULT 60,
    blacklist_words TEXT NOT NULL DEFAULT '[]',
    ai_moderation_enabled INTEGER NOT NULL DEFAULT 0,
    ai_toxicity_threshold INTEGER NOT NULL DEFAULT 7
  );

  CREATE TABLE IF NOT EXISTS economy (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 100,
    watch_time_minutes INTEGER NOT NULL DEFAULT 0,
    messages_count INTEGER NOT NULL DEFAULT 0,
    subs_count INTEGER NOT NULL DEFAULT 0,
    gifted_subs_count INTEGER NOT NULL DEFAULT 0,
    tips_amount REAL NOT NULL DEFAULT 0,
    loyalty_tier TEXT NOT NULL DEFAULT 'Çaylak',
    last_active INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS loyalty_rewards (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    cost INTEGER NOT NULL,
    reward_type TEXT NOT NULL,
    payload TEXT,
    is_enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS polls (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    options TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    closed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    id TEXT PRIMARY KEY,
    poll_id TEXT NOT NULL,
    username TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    voted_at INTEGER NOT NULL,
    UNIQUE(poll_id, username)
  );

  CREATE TABLE IF NOT EXISTS pinned_messages (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    message TEXT NOT NULL,
    color TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS song_queue (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    duration INTEGER NOT NULL DEFAULT 0,
    requested_by TEXT NOT NULL,
    platform TEXT NOT NULL,
    thumbnail TEXT,
    created_at INTEGER NOT NULL,
    is_played INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    keyword TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    sub_bonus_multiplier REAL NOT NULL DEFAULT 2.0,
    cost_points INTEGER NOT NULL DEFAULT 0,
    winner TEXT,
    winner_platform TEXT,
    created_at INTEGER NOT NULL,
    closed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS giveaway_entries (
    id TEXT PRIMARY KEY,
    giveaway_id TEXT NOT NULL,
    username TEXT NOT NULL,
    platform TEXT NOT NULL,
    tickets INTEGER NOT NULL DEFAULT 1,
    entered_at INTEGER NOT NULL,
    FOREIGN KEY(giveaway_id) REFERENCES giveaways(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS alert_presets (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL UNIQUE,
    title_template TEXT NOT NULL,
    message_template TEXT NOT NULL,
    sound_url TEXT NOT NULL,
    image_url TEXT NOT NULL,
    duration_ms INTEGER NOT NULL DEFAULT 5000,
    font_family TEXT NOT NULL DEFAULT 'Plus Jakarta Sans',
    text_color TEXT NOT NULL DEFAULT '#ffffff',
    accent_color TEXT NOT NULL DEFAULT '#8b5cf6',
    animation TEXT NOT NULL DEFAULT 'bounce',
    sound_volume REAL NOT NULL DEFAULT 0.7,
    is_enabled INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS stream_events (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    event_type TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    message TEXT,
    amount REAL,
    currency TEXT,
    avatar_url TEXT,
    metadata TEXT,
    timestamp INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_commands_name ON commands(name);
  CREATE INDEX IF NOT EXISTS idx_economy_username ON economy(username);
  CREATE INDEX IF NOT EXISTS idx_song_queue_is_played ON song_queue(is_played, created_at);
  CREATE INDEX IF NOT EXISTS idx_channels_platform ON channels(platform);
  CREATE INDEX IF NOT EXISTS idx_stream_events_ts ON stream_events(timestamp DESC);
`);

// Safe column migrations for existing SQLite databases
// Sütun zaten varsa ALTER hata verir: bu satırlardaki boş catch BİLİNÇLİ.
// Yeni sütunlar buraya değil, sürümlü db/migrations.ts'ye eklenir.
try { db.exec('ALTER TABLE economy ADD COLUMN messages_count INTEGER NOT NULL DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE economy ADD COLUMN subs_count INTEGER NOT NULL DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE economy ADD COLUMN gifted_subs_count INTEGER NOT NULL DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE economy ADD COLUMN tips_amount REAL NOT NULL DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE economy ADD COLUMN loyalty_tier TEXT NOT NULL DEFAULT \'Çaylak\';'); } catch {}
try { db.exec('ALTER TABLE channels ADD COLUMN token_expires_at INTEGER;'); } catch {}
try { db.exec('ALTER TABLE polls ADD COLUMN duration_seconds INTEGER NOT NULL DEFAULT 60;'); } catch {}
try { db.exec('ALTER TABLE polls ADD COLUMN ends_at INTEGER;'); } catch {}
try { db.exec('ALTER TABLE polls ADD COLUMN command TEXT DEFAULT \'!oy\';'); } catch {}
try { db.exec('ALTER TABLE giveaways ADD COLUMN duration_minutes INTEGER DEFAULT 10;'); } catch {}
try { db.exec('ALTER TABLE giveaways ADD COLUMN winner_count INTEGER DEFAULT 1;'); } catch {}
try { db.exec('ALTER TABLE giveaways ADD COLUMN max_entries INTEGER DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE giveaways ADD COLUMN follower_only INTEGER DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE giveaways ADD COLUMN sub_only INTEGER DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE giveaways ADD COLUMN min_watch_minutes INTEGER DEFAULT 0;'); } catch {}
try { db.exec('ALTER TABLE alert_presets ADD COLUMN layout_mode TEXT DEFAULT \'stacked\';'); } catch {}
try { db.exec('ALTER TABLE alert_presets ADD COLUMN text_effect TEXT DEFAULT \'shine\';'); } catch {}

// Loyalty Redemptions Table
db.exec(`
  CREATE TABLE IF NOT EXISTS loyalty_redemptions (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    reward_id TEXT NOT NULL,
    reward_title TEXT NOT NULL,
    cost INTEGER NOT NULL,
    custom_input TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_redemptions_status ON loyalty_redemptions(status);
  CREATE INDEX IF NOT EXISTS idx_redemptions_created ON loyalty_redemptions(created_at DESC);

  CREATE TABLE IF NOT EXISTS all_in_one_overlay_settings (
    id TEXT PRIMARY KEY,
    config_json TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    action TEXT NOT NULL,
    moderator TEXT NOT NULL,
    target TEXT,
    details TEXT,
    severity TEXT NOT NULL DEFAULT 'info'
  );
  CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);

  CREATE TABLE IF NOT EXISTS viewer_notes (
    username TEXT PRIMARY KEY,
    note TEXT NOT NULL,
    tags TEXT,
    sentiment TEXT NOT NULL DEFAULT 'neutral',
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS king_state (
    id TEXT PRIMARY KEY,
    current_king TEXT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    points_bid INTEGER NOT NULL DEFAULT 0,
    crown_time INTEGER NOT NULL,
    reign_seconds INTEGER NOT NULL DEFAULT 0,
    title TEXT NOT NULL DEFAULT 'Yayın Hükümdarı',
    history TEXT
  );

  CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    donor_name TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'TL',
    message TEXT,
    platform TEXT NOT NULL DEFAULT 'bynogame',
    created_at INTEGER NOT NULL,
    alert_shown INTEGER NOT NULL DEFAULT 1,
    jumpscare_triggered INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_donations_created ON donations(created_at DESC);

  CREATE TABLE IF NOT EXISTS counters (
    name TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kick_shared_bans (
    username TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    added_by TEXT NOT NULL,
    added_at INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS trivia_questions (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 100,
    explanation TEXT,
    difficulty TEXT NOT NULL DEFAULT 'medium',
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_trivia_cat ON trivia_questions(category);

  CREATE TABLE IF NOT EXISTS trivia_scores (
    username TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    platform TEXT NOT NULL,
    total_score INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    wrong_count INTEGER NOT NULL DEFAULT 0,
    fastest_ms INTEGER DEFAULT 999999,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    last_played INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_trivia_scores_total ON trivia_scores(total_score DESC);
`);

// Surumlu gocler: yeni tablo ve sutunlar buradan gelir (db/migrations.ts).
// Yikici gocler yasak; yalniz CREATE IF NOT EXISTS ve varsayilanli ADD COLUMN.
gocleriUygula(db);

// Seed default settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) as cnt FROM bot_settings').get() as { cnt: number };
if (settingsCount.cnt === 0) {
  const defaultSettings: Record<string, string> = {
    prefix: '!',
    // Varsayılan KAPALI: açıkken her izleyici mesajı bot hesabıyla diğer tüm
    // bağlı platformlara yazılır; yayıncı bunu bilerek seçmeli.
    cross_chat_enabled: 'false',
    cross_chat_format: '[$platform] $user: $message',
    tts_enabled: 'true',
    tts_voice: 'tr-TR-AhmetNeural',
    tts_volume: '0.8',
    tts_min_bits_or_points: '0',
    sr_desktop_target: 'none',
    gemini_api_key: '',
    gemini_prompt: 'Sen AxBot adında neşeli, esprili, yayıncıya ve izleyicilere sadık, oyunları ve internet kültürünü iyi bilen zeki bir yayın asistanısın. Kısa, canlı ve samimi cevaplar ver.',
    gemini_enabled: 'true',
    currency_name: 'Puan',
    points_per_interval: '10',
    interval_minutes: '5',
    sub_points_multiplier: '2'
  };

  const insertSetting = db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }
}

// Seed AutoMod default
const automodCount = db.prepare('SELECT COUNT(*) as cnt FROM automod_settings').get() as { cnt: number };
if (automodCount.cnt === 0) {
  db.prepare(`
    INSERT INTO automod_settings (
      id, caps_enabled, caps_min_length, caps_max_percent,
      emotes_enabled, emotes_max, links_enabled, links_whitelist,
      symbols_enabled, symbols_max_percent, blacklist_words,
      ai_moderation_enabled, ai_toxicity_threshold
    ) VALUES (
      1, 1, 10, 70,
      1, 8, 1, '["youtube.com","twitch.tv","kick.com","discord.gg"]',
      1, 60, '["küfür","hakaret","discord.gg/scam"]',
      0, 7
    )
  `).run();
}

// Seed default commands
const commandsCount = db.prepare('SELECT COUNT(*) as cnt FROM commands').get() as { cnt: number };
if (commandsCount.cnt === 0) {
  const defaultCommands = [
    {
      id: 'cmd-discord',
      name: 'discord',
      response: 'Topluluğumuza katılmak ve etkinliklerden haberdar olmak için Discord sunucumuza gel! 👉 https://discord.gg/streamaxt',
      userLevel: 'everyone',
      cooldown: 5,
      description: 'Discord sunucu bağlantısını gösterir'
    },
    {
      id: 'cmd-uptime',
      name: 'uptime',
      response: 'Yayın $(uptime) süredir kesintisiz devam ediyor! 🔥',
      userLevel: 'everyone',
      cooldown: 5,
      description: 'Yayının açık olduğu süreyi gösterir'
    },
    {
      id: 'cmd-commands',
      name: 'komutlar',
      response: 'Kullanabileceğin başlıca komutlar: !discord, !uptime, !puan, !rulet, !slot, !sr, !duello, !yardim, !sor',
      userLevel: 'everyone',
      cooldown: 5,
      description: 'Mevcut komutları listeler'
    },
    {
      id: 'cmd-socials',
      name: 'sosyal',
      response: 'Beni diğer platformlardan da takip et: Kick: /yayinci | YouTube: /yayinci | TikTok: @yayinci | Instagram: @yayinci',
      userLevel: 'everyone',
      cooldown: 5,
      description: 'Sosyal medya hesaplarını listeler'
    },
    {
      id: 'cmd-sor',
      name: 'sor',
      response: '$(ai $(query))',
      userLevel: 'everyone',
      cooldown: 10,
      description: 'Yapay Zeka (Gemini) asistanına soru sorar'
    }
  ];

  const insertCmd = db.prepare(`
    INSERT INTO commands (id, name, response, user_level, cooldown, aliases, is_enabled, use_count, description)
    VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?)
  `);

  for (const cmd of defaultCommands) {
    insertCmd.run(cmd.id, cmd.name, cmd.response, cmd.userLevel, cmd.cooldown, '[]', cmd.description);
  }
}

// Seed default alert presets
const alertsCount = db.prepare('SELECT COUNT(*) as cnt FROM alert_presets').get() as { cnt: number };
if (alertsCount.cnt === 0) {
  const defaultAlerts = [
    {
      id: 'alert-follow',
      eventType: 'follow',
      titleTemplate: 'YENİ TAKİPÇİ!',
      messageTemplate: '{user} aileye katıldı!',
      soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
      imageUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
      durationMs: 5000,
      accentColor: '#8b5cf6'
    },
    {
      id: 'alert-sub',
      eventType: 'sub',
      titleTemplate: 'YENİ ABONE!',
      messageTemplate: '{user} {tier} seviye ile abone oldu! ({months} ay)',
      soundUrl: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
      imageUrl: 'https://media.giphy.com/media/l41lT4n6ylgW2hh04/giphy.gif',
      durationMs: 6500,
      accentColor: '#ec4899'
    },
    {
      id: 'alert-tip',
      eventType: 'tip',
      titleTemplate: 'BAĞIŞ GELDİ!',
      messageTemplate: '{user} {amount} {currency} gönderdi: "{message}"',
      soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3',
      imageUrl: 'https://media.giphy.com/media/3o7TKMt1VVNkHV2PaE/giphy.gif',
      durationMs: 7000,
      accentColor: '#10b981'
    },
    {
      id: 'alert-raid',
      eventType: 'raid',
      titleTemplate: 'RAİD BASKINI!',
      messageTemplate: '{user} {viewers} izleyici ile baskın yaptı! Hoş geldiniz!',
      soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3',
      imageUrl: 'https://media.giphy.com/media/26FPqAH60GLQM8i76/giphy.gif',
      durationMs: 8000,
      accentColor: '#f59e0b'
    },
    {
      id: 'alert-tiktok',
      eventType: 'gift_tiktok',
      titleTemplate: 'TIKTOK HEDİYESİ!',
      messageTemplate: '{user} x{count} {giftName} gönderdi!',
      soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
      imageUrl: 'https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif',
      durationMs: 5000,
      accentColor: '#06b6d4'
    }
  ];

  const insertAlert = db.prepare(`
    INSERT INTO alert_presets (
      id, event_type, title_template, message_template, sound_url, image_url,
      duration_ms, font_family, text_color, accent_color, animation, sound_volume, is_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Plus Jakarta Sans', '#ffffff', ?, 'bounce', 0.7, 1)
  `);

  for (const a of defaultAlerts) {
    insertAlert.run(a.id, a.eventType, a.titleTemplate, a.messageTemplate, a.soundUrl, a.imageUrl, a.durationMs, a.accentColor);
  }
}

const extraAlerts = [
  { id: 'alert-gift-sub', eventType: 'gift_sub', title: 'HEDİYE ABONE!', msg: '{user} {count} hediye abone gönderdi!', color: '#f472b6' },
  { id: 'alert-host', eventType: 'host', title: 'HOST!', msg: '{user} kanalı host etti ({viewers})', color: '#38bdf8' },
  { id: 'alert-kicks', eventType: 'kicks', title: 'KICKS!', msg: '{user} {amount} Kick gönderdi!', color: '#53fc18' }
];
for (const a of extraAlerts) {
  try {
    db.prepare(`INSERT OR IGNORE INTO alert_presets (id, event_type, title_template, message_template, sound_url, image_url, duration_ms, font_family, text_color, accent_color, animation, sound_volume, is_enabled) VALUES (?, ?, ?, ?, '', '', 6000, 'Plus Jakarta Sans', '#ffffff', ?, 'bounce', 0.7, 1)`).run(a.id, a.eventType, a.title, a.msg, a.color);
  } catch (e) {
    console.warn('[DB] Varsayılan uyarı şablonu eklenemedi:', a.id, hataMetni(e));
  }
}

// Seed sample announcement timer
const timersCount = db.prepare('SELECT COUNT(*) as cnt FROM timers').get() as { cnt: number };
if (timersCount.cnt === 0) {
  db.prepare(`
    INSERT INTO timers (id, name, messages, interval_minutes, min_chat_lines, is_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'timer-social',
    'Sosyal Medya Hatırlatıcısı',
    JSON.stringify([
      'Discord sunucumuza gelmeyi unutmayın! 👉 !discord',
      'Yayınları kaçırmamak için bildirimleri açın ve bizi sosyal medyadan takip edin! 👉 !sosyal'
    ]),
    15,
    5,
    1
  );
}

// Seed default loyalty rewards
const rewardsCount = db.prepare('SELECT COUNT(*) as cnt FROM loyalty_rewards').get() as { cnt: number };
if (rewardsCount.cnt === 0) {
  const defaultRewards = [
    { id: 'reward-tts', title: 'TTS Sesli Okuma', cost: 150, rewardType: 'tts', payload: '' },
    { id: 'reward-airhorn', title: 'Havalı Korna Efekti', cost: 100, rewardType: 'sound', payload: 'airhorn' },
    { id: 'reward-applause', title: 'Canlı Alkış Sesi', cost: 75, rewardType: 'sound', payload: 'applause' },
    { id: 'reward-cat', title: 'Dans Eden Kedi GIF', cost: 120, rewardType: 'gif', payload: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif' },
    { id: 'reward-vip', title: '24 Saatlik VIP Rolü', cost: 2500, rewardType: 'vip', payload: '24h' },
    { id: 'reward-priority', title: 'Şarkı Sırasında Öncelik', cost: 300, rewardType: 'priority_song', payload: '' }
  ];

  const insertReward = db.prepare(`
    INSERT INTO loyalty_rewards (id, title, cost, reward_type, payload, is_enabled)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  for (const r of defaultRewards) {
    insertReward.run(r.id, r.title, r.cost, r.rewardType, r.payload);
  }
}

// Ensure chat overlay settings and loyalty rates in bot_settings
const ensureSetting = (key: string, defaultValue: string) => {
  const row = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(key) as any;
  if (!row) {
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?)').run(key, defaultValue);
  }
};

ensureSetting('chat_overlay_settings', JSON.stringify({
  maxMessages: 40,
  fontSize: 22,
  showPlatformLogo: true,
  showBadges: true,
  showTimestamp: true,
  highlightSpecial: true,
  fadeMessages: true,
  fadeTimeout: 17,
  smoothMask: true,
  textShadow: true,
  transparentBg: true
}));
ensureSetting('points_per_message', '2');
ensureSetting('points_per_sub', '500');
ensureSetting('points_per_gifted_sub', '1000');
ensureSetting('points_per_tip_unit', '50');

// Seed default Chat Game settings in bot_settings
ensureSetting('game_settings', JSON.stringify({
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
}));

// Seed default All-in-One Overlay configuration
const overlayRow = db.prepare("SELECT id FROM all_in_one_overlay_settings WHERE id = 'default'").get();
if (!overlayRow) {
  const defaultOverlayConfig = {
    canvasWidth: 1920,
    canvasHeight: 1080,
    testMode: false,
    chat: { enabled: true, x: 40, y: 430, width: 420, height: 610, scale: 1, fontSize: 18, transparent: true, mask: true },
    alerts: { enabled: true, x: 660, y: 60, width: 600, height: 260, scale: 1, durationMs: 5000, soundVolume: 0.7, animation: 'bounce', layoutMode: 'stacked', textEffect: 'wiggle' },
    goals: { enabled: true, x: 40, y: 60, width: 380, height: 60, scale: 1, type: 'follower', target: 100, current: 24, title: 'Takipçi Hedefi' },
    subathon: { enabled: false, x: 1560, y: 60, width: 320, height: 70, scale: 1 },
    trivia: { enabled: false, x: 660, y: 700, width: 600, height: 320, scale: 1 },
    eventLabels: { enabled: true, x: 0, y: 0, width: 1920, height: 44, scale: 1 },
    emoteCombo: { enabled: true, x: 1560, y: 460, width: 320, height: 140, scale: 1 },
    nowPlaying: { enabled: false, x: 1460, y: 960, width: 420, height: 90, scale: 1 },
    theCup: { enabled: false, x: 1580, y: 610, width: 300, height: 430, scale: 1 },
    polls: { enabled: false, x: 1540, y: 180, width: 340, height: 260, scale: 1 },
    wheel: { enabled: false, x: 760, y: 340, width: 400, height: 400, scale: 1 },
    hypeTrain: { enabled: false, x: 685, y: 350, width: 550, height: 85, scale: 1 },
    lyrics: { enabled: false, x: 460, y: 880, width: 1000, height: 150, scale: 1, fontSize: 24, glowColor: '#00f2fe' },
    jumpScare: { enabled: true, x: 0, y: 0, width: 1920, height: 1080, scale: 1 },
    king: { enabled: false, x: 1560, y: 180, width: 320, height: 120, scale: 1 }
  };
  db.prepare("INSERT INTO all_in_one_overlay_settings (id, config_json, updated_at) VALUES ('default', ?, ?)").run(
    JSON.stringify(defaultOverlayConfig),
    Date.now()
  );
}

// Seed StreamAxT feature settings
ensureSetting('tts_advanced_settings', JSON.stringify({
  primaryEngine: 'edge',
  fallbackChain: ['edge', 'google', 'gemini', 'elevenlabs', 'webspeech'],
  language: 'tr-TR',
  edgeVoice: 'tr-TR-AhmetNeural',
  googleLang: 'tr',
  geminiVoice: 'Puck',
  speed: 1.0,
  pitch: 1.0,
  volume: 0.8,
  profanityFilter: true,
  removeUrls: true,
  maxLength: 300,
  minPointsOrDonation: 0
}));

ensureSetting('shield_mode_settings', JSON.stringify({
  isActive: false,
  autoClearRaidMessages: true,
  minAccountAgeDays: 3,
  blockLinks: true,
  blockCaps: true,
  blockEmotes: true,
  followerOnly: true,
  subOnly: false
}));

ensureSetting('chat_rescue_settings', JSON.stringify({
  isEnabled: true,
  inactivityMinutes: 5,
  personality: 'friendly',
  customPrompt: '',
  allowPolls: true,
  allowTrivia: true
}));

ensureSetting('jumpscare_settings', JSON.stringify({
  isEnabled: true,
  minAmount: 50,
  mediaType: 'video',
  mediaUrl: 'https://assets.mixkit.co/videos/preview/mixkit-creepy-monster-in-dark-room-41717-large.mp4',
  audioUrl: 'https://cdn.freesound.org/previews/387/387232_1474204-lq.mp3',
  durationMs: 4000,
  volume: 1.0
}));

// Initialize King state if empty
const kingCount = db.prepare('SELECT COUNT(*) as cnt FROM king_state').get() as { cnt: number };
if (kingCount.cnt === 0) {
  db.prepare(`
    INSERT INTO king_state (id, current_king, display_name, avatar_url, points_bid, crown_time, reign_seconds, title, history)
    VALUES ('current', 'Yayıncı', 'Yayıncı', '', 100, ?, 0, 'Tahtın Kurucusu', '[]')
  `).run(Date.now());
}

// Seed or Sync Trivia Questions into database
try {
  const result = syncTriviaBank(db);
  if (result.added > 0) {
    console.log(`[Database] Synced ${result.added} new trivia questions (total ${result.total}).`);
  }
  // Soru bankası kalite onarımı (yeni soru geldiyse ya da kurallar değiştiyse)
  const onarim = triviaBankasiniOnar(db, result.added > 0);
  if (onarim.onarildi || onarim.atildi) {
    console.log(`[Bil Bakalım] Soru bankası onarıldı: ${onarim.onarildi} soru düzeltildi, ${onarim.atildi} bozuk soru çıkarıldı.`);
  }
} catch (err) {
  console.warn('[Database] Error checking or seeding trivia questions:', err);
}

export { db };
export default db;
