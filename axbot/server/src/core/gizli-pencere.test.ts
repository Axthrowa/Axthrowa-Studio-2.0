

import { describe, expect, it } from 'vitest';
import { izinAdresiMi, tarayiciAdaylari } from './gizli-pencere.js';

describe('gizli pencere', () => {
  it('yalnız Kick izin sayfası kabul edilir', () => {
    expect(izinAdresiMi('https://id.kick.com/oauth/authorize?client_id=x')).toBe(true);
    for (const a of ['http://id.kick.com/oauth/authorize', 'https://id.kick.com.evil.com/oauth/authorize', 'https://kick.com/', 'file:///c:/x', 'cmd.exe', '']) {
      expect(izinAdresiMi(a)).toBe(false);
    }
  });
  it('her tarayıcı kendi gizli bayrağıyla denenir', () => {
    const a = tarayiciAdaylari({ ProgramFiles: 'C:\\P' });
    expect(a.find((x) => x.yol.includes('chrome'))?.bayrak).toBe('--incognito');
    expect(a.find((x) => x.yol.includes('msedge'))?.bayrak).toBe('--inprivate');
    expect(a.find((x) => x.yol.includes('firefox'))?.bayrak).toBe('-private-window');
  });
});
