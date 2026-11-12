import { describe, expect, it } from 'vitest';
import { db } from '../../db/index.js';
import { nightbot } from './nightbot-import.js';

describe('içe / dışa aktarma (B11)', () => {
  it('StreamElements dosyası aktarılır; ikinci kez yüklenince zamanlayıcı çoğalmaz', () => {
    const se = {
      commands: [{ command: 'sedc', reply: '${sender} selam', cooldown: { global: 7 }, accessLevel: 100 }],
      timers: [{ name: 'se-tanitim', messages: ['takip et'], online: { enabled: true, interval: 10 }, chatLines: 3 }],
    };
    const ilk = nightbot.aktar(se);
    expect(ilk.kaynak).toBe('streamelements');
    expect(ilk.komut.eklenen).toBe(1);
    expect(db.prepare("SELECT response, cooldown FROM commands WHERE name = 'sedc'").get()).toMatchObject({ response: '$(sender) selam', cooldown: 7 });
    expect(db.prepare("SELECT interval_minutes FROM timers WHERE name = 'se-tanitim'").get()).toMatchObject({ interval_minutes: 10 });
    const ikinci = nightbot.aktar(se);
    expect(ikinci.zamanlayici).toEqual({ eklenen: 0, atlanan: 1 });
    expect((db.prepare("SELECT COUNT(*) AS n FROM timers WHERE name = 'se-tanitim'").get() as { n: number }).n).toBe(1);
  });

  it('kendi dışa aktarımı silinen veriyi tüm alanlarıyla geri yükler', () => {
    db.prepare("INSERT INTO commands (id, name, response, user_level, cooldown, is_enabled, cost_points) VALUES ('k1', 'yedekli', 'merhaba', 'mod', 9, 1, 50)").run();
    const dosya = JSON.parse(JSON.stringify(nightbot.disaAktar()));
    db.prepare('DELETE FROM commands').run();
    db.prepare('DELETE FROM timers').run();
    const s = nightbot.aktar(dosya);
    expect(s.kaynak).toBe('axbot');
    expect(db.prepare("SELECT response, user_level, cooldown, cost_points FROM commands WHERE name = 'yedekli'").get()).toMatchObject({ response: 'merhaba', user_level: 'mod', cooldown: 9, cost_points: 50 });
    expect(db.prepare("SELECT 1 AS v FROM timers WHERE name = 'se-tanitim'").get()).toBeTruthy();
    // Aynı dosya yeniden: üzerine yazmadan atlanır
    expect(nightbot.aktar(dosya).komut.eklenen).toBe(0);
  });
});
