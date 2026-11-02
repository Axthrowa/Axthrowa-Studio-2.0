import { describe, expect, it, vi } from 'vitest';
import { platformlardaTemizle, type TemizlenenPlatform } from './sohbet-temizle.js';

const baglam = (p: TemizlenenPlatform | undefined, ids: string[]) => {
  const kalan = [...ids];
  return {
    kalan,
    platform: () => p,
    kimlikler: () => [...kalan],
    temizlendi: vi.fn(() => void kalan.splice(0)),
    silindi: vi.fn((_: string, m: string) => void kalan.splice(kalan.indexOf(m), 1))
  };
};

describe('platformlardaTemizle', () => {
  it('toplu temizleme tüm sohbeti ekrandan kaldırır', async () => {
    const b = baglam({ isConnected: () => true, sohbetiTemizle: async () => ({ ok: true, yontem: 'komut' }) }, ['a', 'b']);
    const s: any = await platformlardaTemizle(['kick'], b);
    expect(s.kick).toMatchObject({ ok: true, yontem: 'komut' });
    expect(b.temizlendi).toHaveBeenCalledWith('kick');
  });

  it('tek tek silmede platformda kalan iletiler ekranda kalır', async () => {
    const b = baglam({ isConnected: () => true, sohbetiTemizle: async () => ({ ok: true, yontem: 'tek-tek', silinenIdler: ['a'] }) }, ['a', 'b', 'c']);
    const s: any = await platformlardaTemizle(['kick'], b);
    expect(b.temizlendi).not.toHaveBeenCalled();
    expect(b.kalan).toEqual(['b', 'c']);
    expect(s.kick).toMatchObject({ silinen: 1, kalan: 2 });
  });

  it('başarısızlıkta ekrana dokunmaz; bağlı olmayan denenmez', async () => {
    const b = baglam({ isConnected: () => true, deleteMessage: async () => ({ ok: false, hata: '403' }) }, ['a']);
    expect(((await platformlardaTemizle(['youtube'], b)) as any).youtube).toEqual(expect.objectContaining({ ok: false, hata: '403' }));
    expect(b.kalan).toEqual(['a']);
    const kapali = baglam({ isConnected: () => false }, ['a']);
    expect(((await platformlardaTemizle(['kick'], kapali)) as any).kick.ok).toBe(false);
  });
});
