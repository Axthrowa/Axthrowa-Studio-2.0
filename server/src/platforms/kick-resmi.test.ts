import { describe, expect, it } from 'vitest';
import { kickYayinKimligi, resmiKullaniciKimligi, resmiYayinBilgisi } from './kick-resmi.js';

describe('Kick resmi API yanıtları (T5)', () => {
  it('canlı yayın: başlık, kategori, izleyici, başlangıç', () => {
    const v = resmiYayinBilgisi(
      { data: [{ id: 'u-1', title: 'Selam', started_at: '2026-11-13T18:00:00Z', viewer_count: 42, category: { name: 'Just Chatting' } }] },
      'axthrowa'
    );
    expect(v).toEqual({ canli: true, baslangic: Date.UTC(2026, 10, 13, 18), izleyici: 42, baslik: 'Selam', kategori: 'Just Chatting', yayinId: `kick-${Date.UTC(2026, 10, 13, 18) / 1000}`, kanal: 'axthrowa' });
  });
  it('boş liste yayın kapalı; beklenmeyen biçim durumu değiştirmez', () => {
    expect(resmiYayinBilgisi({ data: [] }, 'k')).toEqual({ canli: false, kanal: 'k' });
    expect(resmiYayinBilgisi({ hata: 1 }, 'k')).toBeNull();
  });
  it('kanal sayfası ve resmi uç aynı yayına aynı kimliği verir', () => {
    expect(kickYayinKimligi(Date.parse('2026-11-13T18:00:00Z'), 99)).toBe(kickYayinKimligi(Date.parse('2026-11-13T18:00:00.400Z'), 'uuid'));
    expect(kickYayinKimligi(null, 99)).toBe('99');
  });
  it('kanal yanıtından yalnız kullanıcı kimliği', () => {
    expect(resmiKullaniciKimligi({ data: [{ broadcaster_user_id: 123, stream: { key: 'x' } }] })).toBe(123);
    expect(resmiKullaniciKimligi({ data: [] })).toBeUndefined();
  });
});
