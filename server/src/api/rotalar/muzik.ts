/**
 * StreamAxT — müzik host API'sinin StreamAxT örneği
 * Developed by AxthrowA
 *
 * Uçların kendisi modules/muzik/rotalar.ts'te (bağımsız Resonance sunucusu da
 * aynısını kullanır); burada yalnız StreamAxT'in deposu ve yayınları bağlanır.
 */
import { db } from '../../db/index.js';
import { muzikHost, muzikYayiniBagla } from '../../modules/muzik/index.js';
import { muzikRotalari } from '../../modules/muzik/rotalar.js';
import { wsHub } from '../../ws/server.js';

// Resonance canlı güncellemeyi /ws/overlay-sync'ten alır; OBS widget'ları ana /ws'ten
const senkron = wsHub.ekYol('/ws/overlay-sync');
const senkronYayinla = (m: unknown) => {
  const ham = JSON.stringify(m);
  for (const c of senkron.clients) if (c.readyState === 1) c.send(ham);
};
muzikYayiniBagla((m) => {
  senkronYayinla(m);
  wsHub.broadcastTo(['all'], { type: 'muzik_calan', data: (m as any)?.data ?? null });
});
muzikHost.yoklamayiBaslat();

const AYAR = 'resonance_overlay_configs';

const { router, spotifyDonusu } = muzikRotalari({
  host: muzikHost,
  ayarlarOku: () => {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR) as { value?: string } | undefined;
      const j = JSON.parse(r?.value || '{}');
      return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
    } catch {
      return {};
    }
  },
  ayarlarYaz: (tum) => {
    db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(AYAR, JSON.stringify(tum));
  },
  senkronYayinla,
  durumDegisti: () => wsHub.broadcastTo(['all'], { type: 'player-status' })
});

export { spotifyDonusu };
export default router;
