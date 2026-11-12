import { describe, expect, it } from 'vitest';
import { db } from '../../db/index.js';
import { settingsCache } from '../../core/settings-cache.js';
import { commandManager } from './command-manager.js';
import { saveExtrasSettings } from '../extras/extras.js';

const ileti = (text: string, username = 'izleyici') =>
  ({ platform: 'kick', message: text, user: { username, displayName: username, isMod: false, isBroadcaster: false } }) as any;

describe('reddedilen komutlara yanıt (B1)', () => {
  it('!clip kapalıyken tek satır yazar; panelde sessiz seçilince yazmaz', async () => {
    saveExtrasSettings({ clip_enabled: false });
    expect(await commandManager.processMessage(ileti('!clip'))).toMatch(/!clip kapalı/);
    settingsCache.set('yerlesik_komut_ayarlari', JSON.stringify({ clip: { sessiz: true } }));
    expect(await commandManager.processMessage(ileti('!clip'))).toBeFalsy();
    settingsCache.set('yerlesik_komut_ayarlari', '{}');
  });

  it('özel komut beklemedeyken bekleme süresi içinde bir kez uyarır, kapatılınca sessiz kalır', async () => {
    db.prepare("INSERT INTO commands (id, name, response, user_level, cooldown, is_enabled) VALUES ('t1', 'dcx', 'discord', 'everyone', 60, 1)").run();
    commandManager.reload();
    expect(await commandManager.processMessage(ileti('!dcx', 'a'))).toBe('discord');
    expect(await commandManager.processMessage(ileti('!dcx', 'b'))).toMatch(/!dcx için \d+ sn bekle/);
    expect(await commandManager.processMessage(ileti('!dcx', 'c'))).toBeFalsy();

    db.prepare("INSERT INTO commands (id, name, response, user_level, cooldown, is_enabled, refusal_reply) VALUES ('t2', 'dcy', 'x', 'everyone', 60, 1, 0)").run();
    commandManager.reload();
    await commandManager.processMessage(ileti('!dcy', 'a'));
    expect(await commandManager.processMessage(ileti('!dcy', 'b'))).toBeFalsy();
  });
});
