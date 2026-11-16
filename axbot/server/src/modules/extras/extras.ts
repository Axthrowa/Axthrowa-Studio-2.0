/**
 * AxBoT extras — chat alerts, quotes, counters, clip, levels
 * Developed by AxthrowA
 */
import { db } from '../../db/index.js';
import { eventBus } from '../../core/event-bus.js';
import { randomUUID as uuidv4 } from 'crypto';
import { settingsCache } from '../../core/settings-cache.js';
import { hataMetni } from '../../core/logger.js';

const KEY = 'extras_settings';

export const EXTRAS_DEFAULTS = {
  chat_alerts_enabled: true,
  chat_alert_follow: '{user} takip etti! Hoş geldin 💜',
  chat_alert_sub: '{user} abone oldu! ⭐',
  chat_alert_gift_sub: '{user} {count} hediye abone gönderdi!',
  chat_alert_tip: '{user} {amount} {currency} bağışladı!',
  chat_alert_raid: '{user} {viewers} kişiyle raid yaptı!',
  chat_alert_host: '{user} host etti!',
  chat_alert_kicks: '{user} {amount} Kick gönderdi!',
  clip_enabled: true,
  clip_command: '!clip',
  clip_cooldown: 30,
  /** !clip saniye verilmezse ve en çok kaç saniye (gerçek klip, ffmpeg). */
  clip_default_sec: 30,
  clip_max_sec: 60,
  clip_message: '📌 @{user} klip anını işaretledi ({zaman}) — yayıncı panelden görecek.',
  levels_enabled: true,
  xp_per_message: 5,
  xp_per_minute: 2,
  announce_levelup: true,
  levelup_message: '{user} seviye {level} oldu! 🎉'
};

function getJson(key: string, fallback: any) {
  try {
    const row = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ? JSON.parse(row.value) : fallback;
  } catch {
    return fallback;
  }
}

export function getExtrasSettings() {
  return { ...EXTRAS_DEFAULTS, ...getJson(KEY, {}) };
}

export function saveExtrasSettings(patch: Record<string, any>) {
  const next = { ...getExtrasSettings(), ...patch };
  db.prepare(`INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run(KEY, JSON.stringify(next));
  try {
    settingsCache.reload();
  } catch (e) {
    console.warn('[Ayar] Önbellek yenilenemedi — değişiklik yeniden başlatmada geçerli olur:', hataMetni(e));
  }
  return next;
}

function tpl(template: string, vars: Record<string, any>) {
  return (template || '').replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

function announce(platform: string, channel: string | undefined, message: string) {
  // Test uyarıları 'test' kanalıyla gelir: gerçek sohbete sahte olay duyurusu yazılmaz
  if (channel === 'test') return;
  eventBus.emitBotMessage({ platform: platform as any, channel, message });
}

export function listQuotes() {
  try {
    return db.prepare('SELECT * FROM quotes ORDER BY id DESC LIMIT 100').all();
  } catch {
    return [];
  }
}

export function addQuote(text: string, author = 'chat') {
  const id = uuidv4();
  db.prepare('INSERT INTO quotes (id, text, author, created_at) VALUES (?, ?, ?, ?)').run(id, text, author, Date.now());
  return { id, text, author };
}

export function randomQuote() {
  const rows = listQuotes() as any[];
  if (!rows.length) return null;
  return rows[Math.floor(Math.random() * rows.length)];
}

export function listCounters() {
  return db.prepare('SELECT * FROM counters ORDER BY name').all();
}

export function bumpCounter(name: string, delta = 1) {
  const key = name.toLowerCase();
  db.prepare(`INSERT INTO counters (name, count, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET count = count + ?, updated_at = excluded.updated_at`).run(key, delta, Date.now(), delta);
  return db.prepare('SELECT * FROM counters WHERE name = ?').get(key);
}

export function initExtras() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      author TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  const s = () => getExtrasSettings();
  // Yeni sohbet uyarıları (Gelişmiş Bot > Sohbet uyarıları) aynı olayda açıksa eski
  // sistem SUSAR — ikisi birden açıkken her takipte sohbete iki mesaj gidiyordu.
  const yeniAcik = (olay: string): boolean => {
    try {
      const r = db.prepare("SELECT value FROM bot_settings WHERE key = 'chat_alert_settings'").get() as { value: string } | undefined;
      return Boolean(r?.value && JSON.parse(r.value)?.[olay]?.aktif);
    } catch {
      return false;
    }
  };

  eventBus.on('follow', (p: any) => {
    const cfg = s();
    if (cfg.chat_alerts_enabled && !p?.anonim && !yeniAcik('follow')) announce(p.platform, p.channel, tpl(cfg.chat_alert_follow, { user: p.displayName || p.username }));
  });
  eventBus.on('sub', (p: any) => {
    const cfg = s();
    if (!cfg.chat_alerts_enabled || yeniAcik(p.isGift ? 'gift_sub' : Number(p.months) > 1 ? 'resub' : 'sub')) return;
    const msg = p.isGift ? cfg.chat_alert_gift_sub : cfg.chat_alert_sub;
    announce(p.platform, p.channel, tpl(msg, { user: p.displayName || p.username, count: p.months || 1, tier: p.tier }));
  });
  eventBus.on('tip', (p: any) => {
    const cfg = s();
    if (cfg.chat_alerts_enabled && !yeniAcik('tip')) announce(p.platform, p.channel, tpl(cfg.chat_alert_tip, { user: p.displayName || p.username, amount: p.amount, currency: p.currency }));
  });
  eventBus.on('raid', (p: any) => {
    const cfg = s();
    if (cfg.chat_alerts_enabled && !yeniAcik('raid')) announce(p.platform, p.channel, tpl(cfg.chat_alert_raid, { user: p.displayName || p.username, viewers: p.viewers }));
  });

  console.log('[Extras] Chat alerts, quotes and counters ready.');
}

export const extras = { getExtrasSettings, saveExtrasSettings, listQuotes, addQuote, randomQuote, listCounters, bumpCounter, initExtras };
export default extras;
