/**
 * Sohbet avatarı ucu: yalnız güvenli adlar sorulur, bulunan resme yönlendirilir, bulunamayan 404 döner.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

const { avatarBul } = vi.hoisted(() => ({ avatarBul: vi.fn() }));
vi.mock('../../platforms/manager.js', () => ({ platformManager: { getPlatform: () => ({ avatarBul }) } }));
vi.mock('../../db/index.js', () => ({ db: { prepare: () => ({ get: () => undefined, run: () => undefined, all: () => [] }), exec: () => undefined } }));
vi.mock('../../ws/server.js', () => ({ wsHub: { broadcastTo: vi.fn() } }));
vi.mock('./widgetlar.js', () => ({ widgetAyariOku: vi.fn(), widgetAyariYaz: vi.fn() }));
vi.mock('../../modules/moderation/shield-mode.js', () => ({ shieldModeService: {} }));
vi.mock('../../modules/ai/gemini.js', () => ({ geminiCoHost: {} }));
vi.mock('../../modules/chat-alerts/chat-alerts.js', () => ({ sohbetUyarilari: {} }));
vi.mock('../../modules/chat-alerts/temalar.js', () => ({}));

import rotalar from './sohbet.js';

let sunucu: Server;
let kok = '';
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

const iste = (yol: string) => fetch(`${kok}/chat/avatar/${yol}`, { redirect: 'manual' });

describe('GET /chat/avatar', () => {
  it('bulunan resme yönlendirir ve tarayıcıya saklatır', async () => {
    avatarBul.mockResolvedValueOnce('https://files.kick.com/a.webp');
    const r = await iste('kick/bulunan');
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://files.kick.com/a.webp');
    expect(r.headers.get('cache-control')).toContain('max-age=3600');
  });

  it('bulunamayan 404 döner', async () => {
    avatarBul.mockResolvedValueOnce(null);
    expect((await iste('twitch/yok')).status).toBe(404);
  });

  it('platform hatasında da 404 döner, istek düşmez', async () => {
    avatarBul.mockRejectedValueOnce(new Error('403'));
    expect((await iste('kick/hatali')).status).toBe(404);
  });

  it('desteklenmeyen platformu ve güvensiz adı platforma sormaz', async () => {
    avatarBul.mockClear();
    expect((await iste('youtube/ali')).status).toBe(400);
    expect((await iste('kick/a%3Fb')).status).toBe(400);
    expect(avatarBul).not.toHaveBeenCalled();
  });
});
