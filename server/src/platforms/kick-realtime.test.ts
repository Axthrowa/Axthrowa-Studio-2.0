/**
 * StreamAxT — Kick gerçek zamanlı protokol testleri
 * Developed by AxthrowA
 *
 * Örnek çerçevelerin ANAHTARLARI 2026-10-14'te oturumsuz bir istemciyle
 * Kick'in herkese açık bir sohbetinden gözlendi (içerikler uydurma). Amaç:
 * Kick sohbeti okuma yolunun sessizce bozulmasını (Pusher anahtarı gibi)
 * birim düzeyinde yakalamak.
 */
import { describe, it, expect } from 'vitest';
import {
  abonelikKanallari,
  olayAdi,
  baglantiSec,
  belirtecSec,
  BELIRTEC_DOLDU,
  cerceveCoz,
  guvenliRealtimeUrl,
  kickAnketi,
  pazarlikGovdesi,
  satirlar,
  sessizlikSiniriMs,
  yenidenDenemeMs,
  yenilemeGecikmesiMs
} from './kick-realtime-protokol.js';

describe('Kick gerçek zamanlı pazarlık', () => {
  it('istek gövdesi web istemcisi biçiminde', () => {
    expect(pazarlikGovdesi('abc')).toEqual({
      client: { id: 'abc', type: 'web' },
      capabilities: { accepted_providers: [{ provider: 'centrifugo' }, { provider: 'pusher' }] }
    });
  });

  it('gözlenen Centrifugo yanıtını seçer', () => {
    const yanit = {
      data: {
        connections: [{ credentials: { url: 'wss://realtime.us-west-2.platform.kick.com/connection/websocket' }, provider: 'centrifugo' }],
        mode: 'websocket'
      },
      message: 'success'
    };
    expect(baglantiSec(yanit)).toEqual({
      saglayici: 'centrifugo',
      url: 'wss://realtime.us-west-2.platform.kick.com/connection/websocket'
    });
  });

  it('Pusher önerilirse anahtar ve küme alınır; bozuk küme us2 olur', () => {
    expect(baglantiSec({ data: { connections: [{ provider: 'pusher', credentials: { app_key: 'ab12', cluster: 'eu' } }] } })).toEqual({
      saglayici: 'pusher',
      appKey: 'ab12',
      cluster: 'eu'
    });
    expect(baglantiSec({ data: { connections: [{ provider: 'pusher', credentials: { app_key: 'ab12', cluster: 'x/../y' } }] } })?.cluster).toBe('us2');
  });

  it('desteklenmeyen sağlayıcı ve kötü adres atlanır', () => {
    expect(baglantiSec({ data: { connections: [{ provider: 'ably', credentials: {} }] } })).toBeNull();
    expect(baglantiSec({ data: { connections: [{ provider: 'centrifugo', credentials: { url: 'wss://evil.example/ws' } }] } })).toBeNull();
    expect(baglantiSec({ data: { connections: [{ provider: 'centrifugo', credentials: { url: 'ws://realtime.kick.com/x' } }] } })).toBeNull();
    expect(baglantiSec(null)).toBeNull();
    expect(baglantiSec({ data: {} })).toBeNull();
  });

  it('kick.com dışı adres yalnız açıkça izin verilen kökle geçer (yerel sınama)', () => {
    expect(guvenliRealtimeUrl('wss://kick.com.evil.example/ws')).toBe(false);
    expect(guvenliRealtimeUrl('ws://127.0.0.1:9000/ws')).toBe(false);
    expect(guvenliRealtimeUrl('ws://127.0.0.1:9000/ws', ['ws://127.0.0.1:9000/'])).toBe(true);
  });

  it('belirteç iki biçimde de okunur', () => {
    expect(belirtecSec({ data: { token: 't1' }, message: 'success' })).toBe('t1');
    expect(belirtecSec({ token: 't2' })).toBe('t2');
    expect(belirtecSec({ data: { token: '' } })).toBeNull();
  });
});

describe('Centrifugo çerçeveleri', () => {
  it('boş nesne yoklamadır (pong gerekir)', () => {
    expect(cerceveCoz('{}')).toEqual({ tur: 'ping' });
  });

  it('connect yanıtı ping/ttl taşır', () => {
    const c = cerceveCoz('{"id":1,"connect":{"client":"x","version":"6","expires":true,"ttl":2700,"ping":25,"pong":true}}');
    expect(c).toEqual({ tur: 'yanit', id: 1, connect: { ping: 25, expires: true, ttl: 2700 } });
  });

  it('sohbet yayını çözülür; veri JSON metninden nesneye döner', () => {
    const ic = JSON.stringify({
      id: 'm1',
      chatroom_id: 42,
      content: '!komutlar',
      type: 'message',
      created_at: '2026-10-14T12:00:00Z',
      sender: { id: 7, username: 'izleyici', slug: 'izleyici', identity: { color: '#fff', badges: [] } },
      metadata: {}
    });
    const satir = JSON.stringify({ push: { channel: 'chatrooms.42.v2', pub: { data: { event: 'App\\Events\\ChatMessageEvent', data: ic }, tags: {} } } });
    const c = cerceveCoz(satir);
    expect(c.tur).toBe('yayin');
    if (c.tur !== 'yayin') return;
    expect(c.kanal).toBe('chatrooms.42.v2');
    expect(c.olay).toBe('App\\Events\\ChatMessageEvent');
    expect((c.veri as any).content).toBe('!komutlar');
    expect((c.veri as any).sender.username).toBe('izleyici');
  });

  it('hata yanıtı kodla gelir (109 = belirteç doldu)', () => {
    const c = cerceveCoz('{"id":3,"error":{"code":109,"message":"token expired"}}');
    expect(c).toEqual({ tur: 'yanit', id: 3, hata: { code: BELIRTEC_DOLDU, message: 'token expired' } });
  });

  it('abonelik onayı ve bozuk satır', () => {
    expect(cerceveCoz('{"id":2,"subscribe":{}}')).toEqual({ tur: 'yanit', id: 2 });
    expect(cerceveCoz('bozuk')).toEqual({ tur: 'bilinmeyen' });
    expect(cerceveCoz('{"push":{"channel":"x","pub":{"data":{"no":"event"}}}}')).toEqual({ tur: 'bilinmeyen' });
  });

  it('tek iletide birden çok çerçeve satırlara ayrılır', () => {
    expect(satirlar('{"id":2,"subscribe":{}}\n{"id":3,"subscribe":{}}\n')).toEqual(['{"id":2,"subscribe":{}}', '{"id":3,"subscribe":{}}']);
  });
});

describe('zamanlama ve kanallar', () => {
  it('sohbet + eski sohbet + kanal olayları', () => {
    expect(abonelikKanallari(18001571, 18259385)).toEqual(['chatrooms.18001571.v2', 'chatrooms.18001571', 'chatroom_18001571', 'channel.18259385', 'channel_18259385']);
    expect(abonelikKanallari(5)).toEqual(['chatrooms.5.v2', 'chatrooms.5', 'chatroom_5']);
  });

  it('olay adı önekli de öneksiz de aynı', () => {
    expect(olayAdi('App\\Events\\SubscriptionEvent')).toBe('SubscriptionEvent');
    expect(olayAdi('GiftedSubscriptionsEvent')).toBe('GiftedSubscriptionsEvent');
  });

  it('belirteç süresi bitmeden 15 sn önce yenilenir', () => {
    expect(yenilemeGecikmesiMs(2700)).toBe(2_685_000);
    expect(yenilemeGecikmesiMs(10)).toBe(5_000);
    expect(yenilemeGecikmesiMs(undefined)).toBeNull();
  });

  it('sessizlik sınırı ping + 10 sn', () => {
    expect(sessizlikSiniriMs(25)).toBe(35_000);
    expect(sessizlikSiniriMs(undefined)).toBe(35_000);
  });

  it('yeniden deneme artarak 60 sn’de durur', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(yenidenDenemeMs)).toEqual([1000, 2000, 5000, 10000, 30000, 60000, 60000]);
  });
});

describe('Kick anketi', () => {
  it('PollUpdateEvent katman biçimine çevrilir (süre saniye)', () => {
    const a = kickAnketi({ poll: { title: 'Hangi oyun?', options: [{ id: 0, label: 'CS2', votes: 3 }, { id: 1, label: 'LoL', votes: 1 }], duration: 60, remaining: 30 } }, 1000);
    expect(a).toEqual({ question: 'Hangi oyun?', options: ['CS2', 'LoL'], votes: { '1': 3, '2': 1 }, endsAt: 31_000 });
  });
  it('seçeneksiz veri yok sayılır', () => {
    expect(kickAnketi({ poll: { title: 'x', options: [] } })).toBeNull();
  });
});
