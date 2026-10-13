import { describe, expect, it } from 'vitest';
import { konumStili, sohbetAdi } from './pano.js';

describe('ses panosu istemci yardımcıları', () => {
  it('konum stilleri', () => {
    expect(konumStili({ konum: 'orta', genislikYuzde: 40, adGoster: true })).toEqual({ width: '40%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
    expect(konumStili({ konum: 'alt-sag', genislikYuzde: 25, adGoster: true })).toEqual({ width: '25%', bottom: '3%', right: '3%' });
    expect(konumStili({ konum: 'ust-orta', genislikYuzde: 200, adGoster: false })).toEqual({ width: '100%', top: '3%', left: '50%', transform: 'translate(-50%, 0)' });
  });

  it('sohbet adı sunucu kuralıyla aynı', () => {
    expect(sohbetAdi('  Davul SESİ!! ')).toBe('davul-sesi');
  });
});
