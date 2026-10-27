import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const ayarlar: Record<string, string> = {};
vi.mock('../../db/index.js', () => ({
  db: { prepare: () => ({ get: (k: string) => (k in ayarlar ? { value: ayarlar[k] } : undefined) }) }
}));

import { metinUret, saglayiciAyari, saglayiciDurumu, seciliSaglayici } from './saglayicilar.js';

// Sahte OpenAI uyumlu sunucu
let sunucu: http.Server;
let son: any = null;
beforeAll(async () => {
  sunucu = http.createServer((req, res) => {
    let g = '';
    req.on('data', (c) => (g += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.headers.authorization !== 'Bearer test-anahtar') {
        res.statusCode = 401;
        return res.end('{"error":{"message":"bad key"}}');
      }
      if (req.url === '/v1/models') return res.end('{"data":[{"id":"m1"},{"id":"m2"}]}');
      son = JSON.parse(g);
      res.end(JSON.stringify({ choices: [{ message: { content: ' Merhaba! ' } }] }));
    });
  });
  await new Promise<void>((r) => sunucu.listen(0, '127.0.0.1', r));
  Object.assign(ayarlar, {
    ai_provider: 'custom',
    ai_custom_base_url: `http://127.0.0.1:${(sunucu.address() as AddressInfo).port}/v1`,
    ai_custom_api_key: 'test-anahtar',
    ai_custom_model: 'm1'
  });
});
afterAll(() => sunucu.close());

describe('AI sağlayıcıları', () => {
  it('OpenAI uyumlu uca yönerge + soru gönderir', async () => {
    expect(seciliSaglayici()).toBe('custom');
    expect(await metinUret('custom', 'kısa ol', 'ali: selam')).toBe('Merhaba!');
    expect(son.model).toBe('m1');
    expect(son.messages).toEqual([
      { role: 'system', content: 'kısa ol' },
      { role: 'user', content: 'ali: selam' }
    ]);
  });

  it('durum model listesini döner, yanlış anahtarı anlaşılır söyler', async () => {
    expect((await saglayiciDurumu('custom')).modeller).toEqual(['m1', 'm2']);
    ayarlar.ai_custom_api_key = 'yanlis';
    const d = await saglayiciDurumu('custom');
    expect(d.hazir).toBe(false);
    expect(d.hata).toMatch(/geçersiz/);
    expect(d.hata).not.toContain('yanlis');
    ayarlar.ai_custom_api_key = 'test-anahtar';
  });

  it('Güncel bilgi açıkken Groq internette arayan modeli kullanır (elle model girilmediyse)', () => {
    expect(saglayiciAyari('groq').model).toBe('openai/gpt-oss-120b');
    ayarlar.ai_web_arama = 'true';
    expect(saglayiciAyari('groq').model).toBe('groq/compound');
    ayarlar.ai_groq_model = 'benim-modelim';
    expect(saglayiciAyari('groq').model).toBe('benim-modelim');
    delete ayarlar.ai_web_arama;
    delete ayarlar.ai_groq_model;
  });

  it('gemini ya da boş seçim varsayılan yola düşer', () => {
    ayarlar.ai_provider = 'gemini';
    expect(seciliSaglayici()).toBeNull();
    ayarlar.ai_provider = 'custom';
  });
});
