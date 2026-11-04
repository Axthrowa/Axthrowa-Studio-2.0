import { describe, expect, it, vi } from 'vitest';

vi.mock('../../ws/server.js', () => ({ wsHub: { broadcastTo: vi.fn() } }));
import { normalizeAllInOneConfig } from './widgetlar.js';

describe('emote kombo yerleşim göçü', () => {
  it('izleyici sayacının eski varsayılan kutusu şeridin altına iner, elle ayarlanan değişmez', () => {
    const eski = { enabled: true, x: 1660, y: 20, width: 220, height: 60, scale: 1 };
    expect(normalizeAllInOneConfig({ viewerCounter: eski }).viewerCounter).toMatchObject({ y: 140, height: 110 });
    expect(normalizeAllInOneConfig({ viewerCounter: { ...eski, x: 100 } }).viewerCounter).toMatchObject({ x: 100, y: 20, height: 60 });
  });
  it('eski tam ekran kaydı kutuya iner, kapalılık korunur', () => {
    const r = normalizeAllInOneConfig({ emoteCombo: { enabled: false, x: 0, y: 0, width: 1920, height: 1080, scale: 2 } });
    expect(r.emoteCombo).toMatchObject({ enabled: false, x: 760, y: 340, width: 400, height: 400, scale: 1, etkiTamEkran: false });
  });
  it('kullanıcının seçtiği tam ekran kutu ve yeni kayıt değişmez', () => {
    const tam = { enabled: true, x: 0, y: 0, width: 1920, height: 1080, scale: 1, etkiTamEkran: true };
    expect(normalizeAllInOneConfig({ emoteCombo: tam }).emoteCombo).toMatchObject(tam);
    const kutu = { enabled: true, x: 10, y: 20, width: 300, height: 300, scale: 1 };
    expect(normalizeAllInOneConfig({ emoteCombo: kutu }).emoteCombo).toMatchObject(kutu);
  });
});
