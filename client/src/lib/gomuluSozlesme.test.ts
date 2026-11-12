import { describe, expect, it } from 'vitest';
import { ayarAdayiSec, studioIstegiCoz } from './gomuluSozlesme';

describe('gömülü sayfa sözleşmesi (T2)', () => {
  it('ayara-git: ayar ve sekmeyi alır, bozuk metni reddeder', () => {
    expect(studioIstegiCoz({ tur: 'ayara-git', ayar: 'Komutları içe aktar', sekme: 'Komut Aktarma' })).toEqual({ tur: 'ayara-git', ayar: 'Komutları içe aktar', sekme: 'Komut Aktarma' });
    expect(studioIstegiCoz({ tur: 'ayara-git', ayar: 'Bekleme', sekme: '<x>' })).toEqual({ tur: 'ayara-git', ayar: 'Bekleme' });
    expect(studioIstegiCoz({ tur: 'ayara-git', ayar: '' })).toBeNull();
    expect(studioIstegiCoz({ tur: 'ayara-git', ayar: 'a'.repeat(81) })).toBeNull();
  });

  it('geri-al iletisini tanır, başka iletileri yok sayar', () => {
    expect(studioIstegiCoz({ tur: 'geri-al' })).toEqual({ tur: 'geri-al' });
    expect(studioIstegiCoz({ tur: 'studio-tema' })).toBeNull();
    expect(studioIstegiCoz('geri-al')).toBeNull();
  });

  it('ayarı yazısıyla bulur, boşlukları önemsemez', () => {
    const adaylar = [{ textContent: 'Genel' }, { textContent: ' Komutları\n  içe aktar ' }, { textContent: 'Komutları içe aktar' }];
    expect(ayarAdayiSec(adaylar, 'Komutları içe aktar')).toBe(adaylar[1]);
    expect(ayarAdayiSec(adaylar, 'Yok')).toBeUndefined();
  });
});
