import { describe, expect, it } from 'vitest';
import { disAktarimiCoz, seSablonu } from './disa-aktarim-bicimleri.js';

describe('disAktarimiCoz', () => {
  it('StreamElements komut ve zamanlayıcısını Nightbot biçimine çevirir', () => {
    const c = disAktarimiCoz({
      commands: [{ command: 'dc', reply: '${sender} → discord.gg/x ${random.pick a b}', cooldown: { global: 10, user: 30 }, accessLevel: 500, aliases: ['discord'] }],
      timers: [{ name: 'tanitim', messages: ['Takip et ${channel}'], online: { enabled: true, interval: 15 }, chatLines: 4 }],
    });
    expect(c.kaynak).toBe('streamelements');
    expect(c.komutlar[0]).toMatchObject({ name: 'dc', message: '$(user) → discord.gg/x ${random.pick a b}', coolDown: 10, userLevel: 'moderator', alias: 'discord' });
    expect(c.zamanlayicilar[0]).toMatchObject({ name: 'tanitim', message: 'Takip et $(channel)', interval: 900, lines: 4, enabled: true });
    expect(c.uyarilar).toEqual(['!dc: ${random.pick a b} — karşılığı yok, elle düzenleyin']);
  });

  it('Fossabot dosyasını response alanından tanır, Nightbot dosyasını olduğu gibi bırakır', () => {
    expect(disAktarimiCoz({ commands: [{ name: '!kural', response: '$(user) kurallar', cooldown: 5 }] }).komutlar[0]).toMatchObject({ name: 'kural', message: '$(user) kurallar', coolDown: 5 });
    const nb = disAktarimiCoz({ commands: [{ name: '!a', message: 'b' }] });
    expect(nb.kaynak).toBe('nightbot');
    expect(nb.komutlar[0]).toEqual({ name: '!a', message: 'b' });
    expect(disAktarimiCoz({ kaynak: 'axbot', commands: [] }).kaynak).toBe('axbot');
  });

  it('SE zamanlayıcısındaki ek mesajlar sessizce düşmez, uyarı olur', () => {
    const c = disAktarimiCoz({ commands: [{ command: 'a', reply: 'b' }], timers: [{ name: 't', messages: ['bir', 'iki', ' ', 'üç'], online: { interval: 5 } }] });
    expect(c.zamanlayicilar[0].message).toBe('bir');
    expect(c.uyarilar).toEqual(['t: 2 ek mesaj aktarılmadı (yalnız ilki alındı), elle ekleyin']);
  });

  it('SE argüman ve özel API değişkenleri', () => {
    expect(seSablonu('${1} ${customapi.https://ornek.com/a?b=1}').metin).toBe('{1} $(urlfetch https://ornek.com/a?b=1)');
  });
});
