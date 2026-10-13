import { describe, expect, it } from 'vitest';
import { AKTARIM_UZUNLUK_SINIRI, aktarimMetni, aktarimYankisiMi } from './cross-chat.js';

const VARSAYILAN = '[$platform] $user: $message';

describe('aktarimMetni', () => {
  it('varsayılan biçimi doldurur', () => {
    expect(aktarimMetni(VARSAYILAN, { platform: 'kick', user: 'ali', message: 'selam' })).toBe('[KICK] ali: selam');
  });

  it('izleyici metnindeki $ kalıpları yerine koyma sözdizimi sayılmaz', () => {
    // Eskiden `$&` eşleşen yer tutucuyu, `$'` biçimin geri kalanını ekliyordu
    expect(aktarimMetni(VARSAYILAN, { platform: 'kick', user: 'ali', message: "fiyat $& ve $' ve $$" })).toBe(
      "[KICK] ali: fiyat $& ve $' ve $$"
    );
  });

  it('kullanıcı adındaki yer tutucu ikinci kez değiştirilmez', () => {
    expect(aktarimMetni(VARSAYILAN, { platform: 'youtube', user: '$message', message: 'x' })).toBe('[YOUTUBE] $message: x');
  });

  it('komut gibi başlayan metni etkisizleştirir', () => {
    expect(aktarimMetni('$message', { platform: 'kick', user: 'ali', message: '/ban yayinci' })).toBe('» /ban yayinci');
    expect(aktarimMetni('$message', { platform: 'kick', user: 'ali', message: '!sr şarkı' })).toBe('» !sr şarkı');
  });

  it('satır sonlarını tek satıra indirir ve uzunluğu sınırlar', () => {
    const uzun = 'a'.repeat(2000);
    const m = aktarimMetni(VARSAYILAN, { platform: 'kick', user: 'ali', message: `bir\nsatır ${uzun}` });
    expect(m).not.toContain('\n');
    expect(m.length).toBe(AKTARIM_UZUNLUK_SINIRI);
  });
});

describe('aktarimYankisiMi', () => {
  it('kendi ürettiğimiz metni (kesilmiş olsa bile) tanır', () => {
    const giden = aktarimMetni(VARSAYILAN, { platform: 'kick', user: 'ali', message: 'selam' });
    expect(aktarimYankisiMi(VARSAYILAN, giden)).toBe(true);
    // Hedef platform metni kesmiş olabilir
    expect(aktarimYankisiMi(VARSAYILAN, '[TWITCH] veli: çok uzun bir mesajın ba')).toBe(true);
    // İç içe yankı (döngünün ikinci turu)
    expect(aktarimYankisiMi(VARSAYILAN, '[YOUTUBE] Axthrowa: [KICK] ali: selam')).toBe(true);
  });

  it('sıradan izleyici mesajını yankı saymaz', () => {
    expect(aktarimYankisiMi(VARSAYILAN, 'selam millet')).toBe(false);
    expect(aktarimYankisiMi(VARSAYILAN, '[haber] bugün yayın var')).toBe(false);
  });

  it('özel biçimde de çalışır; ayırt edici iz yoksa false döner', () => {
    const bicim = '($platform) $user » $message';
    expect(aktarimYankisiMi(bicim, aktarimMetni(bicim, { platform: 'trovo', user: 'x', message: 'y' }))).toBe(true);
    expect(aktarimYankisiMi('$message', 'herhangi bir metin')).toBe(false);
  });
});
