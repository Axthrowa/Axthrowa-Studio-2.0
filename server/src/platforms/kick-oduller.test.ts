import { describe, it, expect } from 'vitest';
import { odulGovdesi, odulKimligiGecerli, odulKullanimi, odulListesi } from './kick-oduller.js';

describe('B8 Kick kanal ödülleri', () => {
  it('yeni ödülde başlık ve bedel zorunlu, sınırlar denetlenir', () => {
    expect(odulGovdesi({ baslik: 'Sahne değiştir', bedel: 500, girdiGerekli: true }, true)).toEqual({
      ok: true,
      govde: { title: 'Sahne değiştir', cost: 500, is_user_input_required: true }
    });
    expect(odulGovdesi({ baslik: 'x' }, true).ok).toBe(false);
    expect(odulGovdesi({ baslik: 'a'.repeat(51), bedel: 1 }, true).ok).toBe(false);
    expect(odulGovdesi({ bedel: 0 }, false).ok).toBe(false);
    expect(odulGovdesi({ renk: 'red' }, false).ok).toBe(false);
    expect(odulGovdesi({ etkin: false }, false)).toEqual({ ok: true, govde: { is_enabled: false } });
    expect(odulGovdesi({}, false).ok).toBe(false);
  });

  it('kimlik ULID olmalı (yol parçasına başka şey girmez)', () => {
    expect(odulKimligiGecerli('01HZX3Y4K5M6N7P8Q9R0S1T2V3')).toBe(true);
    expect(odulKimligiGecerli('../redemptions')).toBe(false);
  });

  it('liste ve gerçek zamanlı kullanım yükü ayıklanır', () => {
    expect(odulListesi({ data: [{ id: 'a', title: 'T', cost: 10, is_enabled: false }] })[0]).toMatchObject({ id: 'a', baslik: 'T', bedel: 10, etkin: false });
    expect(odulKullanimi({ reward_title: 'Sahne değiştir', username: 'izleyici1', user_input: 'oyun' })).toEqual({ kullanici: 'izleyici1', baslik: 'Sahne değiştir', girdi: 'oyun' });
    expect(odulKullanimi({ username: 'x' })).toBeNull();
  });
});
