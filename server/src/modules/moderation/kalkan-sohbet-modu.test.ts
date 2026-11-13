import { describe, expect, it, vi } from 'vitest';
import type { ShieldModeSettings } from '../../db/schema.js';
import { kalkanAcilisGovdesi, kalkanKapanisGovdesi, kalkanSohbetModlariniUygula, type MevcutModlar } from './kalkan-sohbet-modu.js';

const AYAR: ShieldModeSettings = {
  isActive: true, autoClearRaidMessages: true, minAccountAgeDays: 3, blockLinks: true, blockCaps: true, blockEmotes: true, followerOnly: true, subOnly: false
};

function sahte(mevcut: MevcutModlar | null, ok = true) {
  const gonderilen: Array<Record<string, unknown>> = [];
  return {
    gonderilen,
    twitch: { isConnected: () => true, sohbetAyarlari: async () => mevcut, sohbetModu: vi.fn(async (g: Record<string, unknown>) => (gonderilen.push(g), ok ? { ok: true } : { ok: false, hata: 'izin yok' })) }
  };
}

function depo(ayar: Partial<ShieldModeSettings> = {}) {
  let s: ShieldModeSettings = { ...AYAR, ...ayar };
  const gunluk: string[] = [];
  return { gunluk, getSettings: () => s, saveSettings: (y: Partial<ShieldModeSettings>) => (s = { ...s, ...y }), addAuditLog: (_a: string, _m: string, d?: string) => void gunluk.push(String(d)) };
}

describe('kalkan ↔ Twitch sohbet modları', () => {
  it('kalkan açılınca Twitch takipçi modu açılır (varsayılan en az 10 dk takip)', () => {
    expect(kalkanAcilisGovdesi(AYAR, {})).toEqual({ govde: { follower_mode: true, follower_mode_duration: 10 }, acilan: ['follower_mode'] });
  });

  it('abone ve yavaş mod ayara göre; zaten açık moda dokunulmaz; platform modları kapalıysa hiçbiri', () => {
    const r = kalkanAcilisGovdesi({ ...AYAR, subOnly: true, yavasModSn: 30, takipSuresiDk: 0 }, { follower_mode: true });
    expect(r).toEqual({ govde: { subscriber_mode: true, slow_mode: true, slow_mode_wait_time: 30 }, acilan: ['subscriber_mode', 'slow_mode'] });
    expect(kalkanAcilisGovdesi({ ...AYAR, platformModlari: false }, {}).acilan).toEqual([]);
  });

  it('kapanışta yalnız kalkanın açtıkları kapanır', () => {
    expect(kalkanKapanisGovdesi(['follower_mode', 'bilinmeyen'])).toEqual({ follower_mode: false });
    expect(kalkanKapanisGovdesi([])).toBeNull();
  });

  it('aç-kapat akışı: açılan kaydedilir, kapanınca o mod kapatılır ve liste boşalır', async () => {
    const d = depo();
    const { twitch, gonderilen } = sahte({ follower_mode: false });
    await kalkanSohbetModlariniUygula(true, twitch, d);
    expect(d.getSettings().twitchAcilanModlar).toEqual(['follower_mode']);
    await kalkanSohbetModlariniUygula(false, twitch, d);
    expect(gonderilen).toEqual([{ follower_mode: true, follower_mode_duration: 10 }, { follower_mode: false }]);
    expect(d.getSettings().twitchAcilanModlar).toEqual([]);
    expect(d.gunluk).toEqual(['Twitch: takipçi modu açıldı', 'Twitch: takipçi modu kapatıldı']);
  });

  it('yayıncı takipçi modunu zaten açık tutuyorsa kalkan kapanınca da açık kalır', async () => {
    const d = depo();
    const { twitch, gonderilen } = sahte({ follower_mode: true });
    await kalkanSohbetModlariniUygula(true, twitch, d);
    await kalkanSohbetModlariniUygula(false, twitch, d);
    expect(gonderilen).toEqual([]);
  });

  it('Twitch reddederse liste yazılmaz, günlüğe hata düşer', async () => {
    const d = depo();
    const { twitch } = sahte({}, false);
    await kalkanSohbetModlariniUygula(true, twitch, d);
    expect(d.getSettings().twitchAcilanModlar).toBeUndefined();
    expect(d.gunluk[0]).toContain('açılamadı — izin yok');
  });
});
