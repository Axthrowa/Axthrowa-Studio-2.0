import { describe, expect, it } from 'vitest';
import { AYAR_DEGER_SINIRI, ayarGuncellemesiniCoz } from './settings-input.js';

describe('ayarGuncellemesiniCoz', () => {
  it('panelin gönderdiği metin/sayı/mantıksal değerleri kabul eder', () => {
    const r = ayarGuncellemesiniCoz({ cross_chat_enabled: 'true', tts_volume: 0.8, 'widget_settings_chat-overlay': '{"a":1}', x: true });
    expect(r).toEqual({
      ok: true,
      degerler: [
        ['cross_chat_enabled', 'true'],
        ['tts_volume', '0.8'],
        ['widget_settings_chat-overlay', '{"a":1}'],
        ['x', 'true']
      ]
    });
  });

  it('nesne olmayan gövdeyi reddeder (eskiden 500 ya da çöp anahtarlar)', () => {
    expect(ayarGuncellemesiniCoz(null).ok).toBe(false);
    expect(ayarGuncellemesiniCoz(['a', 'b']).ok).toBe(false);
    expect(ayarGuncellemesiniCoz('metin').ok).toBe(false);
  });

  it('nesne değeri "[object Object]" olarak yazılmaz, reddedilir', () => {
    expect(ayarGuncellemesiniCoz({ prefix: { a: 1 } }).ok).toBe(false);
    expect(ayarGuncellemesiniCoz({ prefix: ['!'] }).ok).toBe(false);
  });

  it('geçersiz anahtar ve aşırı uzun değeri reddeder', () => {
    expect(ayarGuncellemesiniCoz({ 'bir anahtar': '1' }).ok).toBe(false);
    expect(ayarGuncellemesiniCoz({ ['a'.repeat(81)]: '1' }).ok).toBe(false);
    expect(ayarGuncellemesiniCoz({ a: 'x'.repeat(AYAR_DEGER_SINIRI + 1) }).ok).toBe(false);
  });

  it('null değer boş metin olarak yazılır', () => {
    expect(ayarGuncellemesiniCoz({ a: null })).toEqual({ ok: true, degerler: [['a', '']] });
  });
});
