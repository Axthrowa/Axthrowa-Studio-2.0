/**
 * Kick girişinin dönüşü: yayın kanalı girişi bot hesabına dokunmaz; ad okunamasa da jeton kaybolmaz.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const { post, get, reconnect } = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), reconnect: vi.fn(async () => true) }));
vi.mock('axios', () => ({ default: { post, get } }));
vi.mock('../../db/index.js', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE channels (id TEXT, platform TEXT, channel_name TEXT, account_id TEXT, token TEXT, refresh_token TEXT,
    token_expires_at INTEGER, is_active INTEGER, created_at INTEGER, kanal_token TEXT, kanal_refresh_token TEXT, kanal_token_expires_at INTEGER)`);
  return { db };
});
vi.mock('../../platforms/manager.js', () => ({ platformManager: { reconnect, disconnect: vi.fn(), getAllStatuses: () => ({}) } }));
vi.mock('../../platforms/kick.js', () => ({ kickPlatform: {} }));
vi.mock('../../ws/server.js', () => ({ wsHub: { broadcastTo: vi.fn() } }));
vi.mock('../../core/settings-cache.js', () => ({ settingsCache: { get: (k: string) => (k === 'kick_client_id' ? 'kimlik' : 'sir'), set: vi.fn() } }));
vi.mock('../../core/security/vault.js', () => ({ sifrele: (x: unknown) => x, sifreleHepsi: (x: unknown) => x }));

import { db } from '../../db/index.js';
import rotalar from './platformlar.js';

let sunucu: Server;
let kok = '';
const satir = () => db.prepare("SELECT * FROM channels WHERE platform = 'kick'").get() as any;

const girisYap = async (hedef: string) => {
  const a: any = await (await fetch(`${kok}/platforms/kick/auth-url?hedef=${hedef}`, { method: 'POST' })).json();
  return fetch(`${kok}/auth/kick/callback?code=kod&state=${encodeURIComponent(a.state)}`);
};

beforeAll(async () => {
  const app = express();
  app.use(rotalar);
  await new Promise<void>((coz) => {
    sunucu = app.listen(0, '127.0.0.1', () => coz());
  });
  kok = `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}`;
});
afterAll(() => {
  sunucu.close();
});

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  reconnect.mockClear();
  post.mockResolvedValue({ data: { access_token: 'YENI', refresh_token: 'YENILE', expires_in: 3600 } });
  db.exec('DELETE FROM channels');
  db.prepare("INSERT INTO channels (id, platform, channel_name, token, is_active, created_at) VALUES ('1', 'kick', 'eski', 'BOT', 1, 0)").run();
});

describe('Kick girişi', () => {
  it('kanal girişi kanalı değiştirir, kayıtlı bot hesabına dokunmaz', async () => {
    get.mockResolvedValue({ data: { data: [{ name: 'YayinKanali' }] } });
    await girisYap('kanal');
    expect(satir()).toMatchObject({ token: 'BOT', kanal_token: 'YENI', channel_name: 'yayinkanali' });
    expect(reconnect).toHaveBeenCalledWith('kick');
  });

  it('hesap adı okunamasa da kanal girişi kaydedilir', async () => {
    get.mockRejectedValue(new Error('zaman aşımı'));
    await girisYap('kanal');
    expect(satir()).toMatchObject({ token: 'BOT', kanal_token: 'YENI', channel_name: 'eski' });
  });

  it('bot girişi kanala dokunmaz', async () => {
    await girisYap('bot');
    expect(satir()).toMatchObject({ token: 'YENI', channel_name: 'eski', kanal_token: null });
  });
});
