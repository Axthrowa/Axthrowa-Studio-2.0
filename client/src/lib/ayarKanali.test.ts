/**
 * StreamAxT — ayar kanalı yardımcı testleri
 * Developed by AxthrowA
 */
import { describe, it, expect } from 'vitest';
import { anaPaketAdresi, obsSayfasiMi } from './ayarKanali.js';
import { hedefWidgetKimligi } from './widget-defaults.js';

describe('sürüm bekçisi', () => {
  it('Vite index.html içinden ana paket adresini bulur', () => {
    const html = '<script type="module" crossorigin src="/assets/index-CI-65S5k.js"></script><link rel="modulepreload" href="/assets/vendor-x.js">';
    expect(anaPaketAdresi(html)).toBe('/assets/index-CI-65S5k.js');
    expect(anaPaketAdresi('<script src="/src/main.tsx"></script>')).toBeNull();
  });
  it('yalnız OBS sayfaları kendini yeniler (panel formları kaybolmasın)', () => {
    expect(obsSayfasiMi('/widgets/overlay')).toBe(true);
    expect(obsSayfasiMi('/widgets/chatbox')).toBe(true);
    expect(obsSayfasiMi('/overlay')).toBe(true);
    expect(obsSayfasiMi('/')).toBe(false);
    expect(obsSayfasiMi('/overlay-studio')).toBe(false);
    expect(obsSayfasiMi('/widgetsx')).toBe(false);
  });
});

describe('tek tuvaldeki hedef çubuğu', () => {
  it('yerleşimdeki tür → stüdyo formu ve OBS aynı hedef kaydını kullanır', () => {
    expect(hedefWidgetKimligi('follower')).toBe('follower-goal');
    expect(hedefWidgetKimligi('sub')).toBe('subscriber-goal');
    expect(hedefWidgetKimligi('tip')).toBe('donation-goal');
    expect(hedefWidgetKimligi('donation')).toBe('donation-goal');
    expect(hedefWidgetKimligi('kicks')).toBe('kicks-goal');
    expect(hedefWidgetKimligi(undefined)).toBe('follower-goal');
  });
});
