import { describe, it, expect } from 'vitest';
import { kickYonlendirmeAdresi, stateGecerliMi, STATE_OMRU_MS, sunucuPortu, yeniState } from './oauth-state.js';

describe('sunucuPortu', () => {
  it('PORT ortam değişkenini izler, geçersizse 3001', () => {
    expect(sunucuPortu({ PORT: '3011' } as NodeJS.ProcessEnv)).toBe(3011);
    expect(sunucuPortu({} as NodeJS.ProcessEnv)).toBe(3001);
    expect(sunucuPortu({ PORT: 'abc' } as NodeJS.ProcessEnv)).toBe(3001);
    expect(sunucuPortu({ PORT: '70000' } as NodeJS.ProcessEnv)).toBe(3001);
    expect(sunucuPortu({ PORT: '0' } as NodeJS.ProcessEnv)).toBe(3001);
  });

  it('Kick geri dönüş adresi sunucunun gerçek portunu kullanır (eskiden 3001 sabitti)', () => {
    expect(kickYonlendirmeAdresi(3001)).toBe('http://localhost:3001/api/auth/kick/callback');
    expect(kickYonlendirmeAdresi(3011)).toBe('http://localhost:3011/api/auth/kick/callback');
  });
});

describe('stateGecerliMi', () => {
  const simdi = 1_000_000;
  const bekleyen = yeniState(simdi);

  it('yalnız bekleyen değerle eşleşir', () => {
    expect(bekleyen.deger).toMatch(/^[0-9a-f]{32}$/);
    expect(stateGecerliMi(bekleyen, bekleyen.deger, simdi + 1000)).toBe(true);
    expect(stateGecerliMi(bekleyen, 'baska', simdi)).toBe(false);
    expect(stateGecerliMi(bekleyen, bekleyen.deger.slice(0, -1) + 'x', simdi)).toBe(false);
  });

  it('bekleyen yoksa, değer eksik/dizi değilse ya da süresi geçmişse reddeder', () => {
    expect(stateGecerliMi(null, bekleyen.deger, simdi)).toBe(false);
    expect(stateGecerliMi(bekleyen, undefined, simdi)).toBe(false);
    expect(stateGecerliMi(bekleyen, '', simdi)).toBe(false);
    expect(stateGecerliMi(bekleyen, [bekleyen.deger], simdi)).toBe(false);
    expect(stateGecerliMi(bekleyen, bekleyen.deger, simdi + STATE_OMRU_MS + 1)).toBe(false);
  });

  it('her çağrı yeni, tahmin edilemez değer üretir', () => {
    expect(yeniState().deger).not.toBe(yeniState().deger);
  });
});
