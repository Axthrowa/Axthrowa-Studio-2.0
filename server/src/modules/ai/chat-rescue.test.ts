import { describe, expect, it, vi } from 'vitest';

const { ayarlar } = vi.hoisted(() => ({ ayarlar: {
  chat_rescue_settings: JSON.stringify({ isEnabled: true, inactivityMinutes: 5, personality: 'friendly' }),
  gemini_enabled: 'true'
} as Record<string, string> }));
vi.mock('../../db/index.js', () => ({
  db: {
    prepare: (sql: string) => ({
      get: () => {
        const k = sql.match(/key = '([a-z_]+)'/)?.[1];
        return k && k in ayarlar ? { value: ayarlar[k] } : undefined;
      },
      run: () => ({})
    })
  }
}));
const { uret, durum } = vi.hoisted(() => ({ uret: vi.fn(async () => 'Bugün en sevdiğiniz oyun hangisi?'), durum: { canli: false as boolean | null } }));
vi.mock('./gemini.js', () => ({ geminiCoHost: { yardimciUret: uret } }));
vi.mock('../../core/live-status.js', () => ({ canliDurum: { genel: () => ({ canli: durum.canli }) } }));

import { chatRescueService } from './chat-rescue.js';

describe('sohbet kurtarma', () => {
  it('seçili yapay zekâyı geçmişe yazmadan kullanır; yapay zekâ kapalıysa şablona düşer', async () => {
    expect(await chatRescueService.triggerRescue('manual')).toBe('Bugün en sevdiğiniz oyun hangisi?');
    ayarlar.gemini_enabled = 'false';
    uret.mockClear();
    const m = await chatRescueService.triggerRescue('manual');
    expect(uret).not.toHaveBeenCalled();
    expect(m.length).toBeGreaterThan(0);
    ayarlar.gemini_enabled = 'true';
  });

  it('yayın kapalıyken otomatik tetiklenmez', async () => {
    vi.useFakeTimers();
    const tetik = vi.spyOn(chatRescueService, 'triggerRescue');
    (chatRescueService as any).lastMessageTime = Date.now() - 10 * 60_000;
    (chatRescueService as any).startWatcher();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tetik).not.toHaveBeenCalled();
    durum.canli = true;
    (chatRescueService as any).lastMessageTime = Date.now() - 10 * 60_000;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(tetik).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
