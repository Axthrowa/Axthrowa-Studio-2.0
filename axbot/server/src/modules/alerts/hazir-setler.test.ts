import { describe, expect, it } from 'vitest';
import { setleriListele, setPaketi, rozet, wavYaz } from './hazir-setler.js';
import { imzadanTur, IZINLI } from '../media/validate.js';
import { medyaKimligi, yedekGecerliMi } from './backup.js';

describe('hazır uyarı setleri (WID-3)', () => {
  it('üretilen görsel PNG, ses WAV olarak medya doğrulamasından geçer', () => {
    expect(imzadanTur(rozet('kalp', '#ff0000', '#000000', '#ffffff', 32))).toBe('image/png');
    expect(imzadanTur(wavYaz([[440, 0, 0.1]], 'zil'))).toBe('audio/wav');
  });

  it('üç set; her paket geçerli yedek, her uyarının görseli ve sesi pakette gömülü (dış adres yok)', () => {
    const setler = setleriListele();
    expect(setler).toHaveLength(3);
    for (const s of setler) {
      expect(s.onizleme).toMatch(/^data:image\/png;base64,/);
      const p = setPaketi(s.id)!;
      expect(yedekGecerliMi(p).ok).toBe(true);
      const gomulu = new Set(p.medya!.map((m) => m.eskiId));
      for (const m of p.medya!) expect(IZINLI[imzadanTur(Buffer.from(m.veri, 'base64'))!]).toBeTruthy();
      expect(p.presets.length).toBeGreaterThanOrEqual(8);
      for (const pr of p.presets) {
        expect(gomulu.has(medyaKimligi(pr.image_url))).toBe(true);
        expect(gomulu.has(medyaKimligi(pr.sound_url))).toBe(true);
      }
      expect(JSON.stringify(p.presets)).not.toMatch(/https?:/);
    }
    expect(setPaketi('yok')).toBeNull();
  });
});
