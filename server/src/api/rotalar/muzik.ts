/**
 * AxBoT — müzik host API'sinin AxBoT örneği
 * Developed by AxthrowA
 *
 * Uçların kendisi modules/muzik/rotalar.ts'te (bağımsız Resonance sunucusu da
 * aynısını kullanır); burada yalnız AxBoT'un deposu ve yayınları bağlanır.
 */
import WebSocket from 'ws';
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

/** YYA'daki Resonance'ta tema değişince Tek URL'deki Resonance da hemen güncellensin */
function yyaTemaKoprusu() {
  const tekrar = () => setTimeout(yyaTemaKoprusu, 10_000).unref?.();
  const uzak = muzikHost.hariciAdres();
  if (!uzak) return void tekrar();
  const ws = new WebSocket(`${uzak.replace(/^http/, 'ws')}/ws/overlay-sync`);
  ws.on('message', (ham) => {
    try {
      if (JSON.parse(String(ham))?.type === 'overlay-config') senkronYayinla({ type: 'overlay-config' });
    } catch {
      /* ilgisiz mesaj */
    }
  });
  ws.on('error', () => {}); // YYA kapalı: `close` yeniden dener
  ws.on('close', tekrar);
}
yyaTemaKoprusu();

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
  uzakHost: () => muzikHost.hariciAdres(),
  durumDegisti: () => wsHub.broadcastTo(['all'], { type: 'player-status' })
});

export { spotifyDonusu };
export default router;
