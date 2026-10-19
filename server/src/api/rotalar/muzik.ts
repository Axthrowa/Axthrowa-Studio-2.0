/**
 * StreamAxT — müzik host API'si (Resonance arayüzü + panel + OBS)
 * Developed by AxthrowA
 *
 * Uçlar Yayın Yönetim Aracı'ndaki Rust host'uyla aynı biçimdedir; Resonance
 * değiştirilmeden hem orada hem StreamAxT'te (/resonance/) çalışır.
 */
import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import { db } from '../../db/index.js';
import { muzikHost, muzikYayiniBagla } from '../../modules/muzik/index.js';
import { donusAdresiSec, SPOTIFY_DONUS_YOLLARI } from '../../modules/muzik/spotify-saf.js';
import { wsHub } from '../../ws/server.js';

const router = Router();

// Resonance canlı güncellemeyi /ws/overlay-sync'ten alır; OBS widget'ları ana /ws'ten
const senkron = wsHub.ekYol('/ws/overlay-sync');
muzikYayiniBagla((m) => {
  const ham = JSON.stringify(m);
  for (const c of senkron.clients) if (c.readyState === 1) c.send(ham);
  wsHub.broadcastTo(['all'], { type: 'muzik_calan', data: (m as any)?.data ?? null });
});
muzikHost.yoklamayiBaslat();

const kok = (req: Request) => `http://${req.headers.host}`;
const hataYaz = (res: Response, e: unknown, kod = 502) => res.status(kod).type('text/plain').send(String((e as Error)?.message || e));

router.get('/health', (_req, res) => res.type('text/plain').send('ok'));

router.get('/now-playing', (_req, res) => res.json(muzikHost.simdiCalan()));
router.post('/now-playing', (req, res) => {
  muzikHost.ytmdCalanYaz(req.body);
  res.json({ ok: true });
});

router.get('/player/status', (_req, res) => res.json(muzikHost.durum()));
router.post('/player/source', (req, res) => {
  muzikHost.kaynakSec(String(req.body?.source || ''));
  res.json(muzikHost.durum());
});
router.post('/player/command', async (req, res) => {
  try {
    await muzikHost.komut(String(req.body?.action || ''), req.body?.source ? String(req.body.source) : undefined);
    res.json({ ok: true });
  } catch (e) {
    hataYaz(res, e);
  }
});

router.post('/player/request', async (req, res) => {
  try {
    const p = await muzikHost.parcaAra(String(req.body?.query || ''));
    if (!p) return hataYaz(res, "Spotify'da sonuç yok", 404);
    await muzikHost.parcayiCal(p.uri, true);
    res.json({ ok: true, title: p.title, artist: p.artist, id: p.uri });
  } catch (e) {
    hataYaz(res, e);
  }
});

router.post('/player/spotify/authorize', (req, res) => {
  try {
    const donus = donusAdresiSec(kok(req), req.body?.redirectUri);
    const url = muzikHost.yetkiBaslat(String(req.body?.clientId || ''), donus);
    res.json({ url, redirectUri: donus, allowedRedirectUris: SPOTIFY_DONUS_YOLLARI.map((y) => `${kok(req)}${y}`) });
  } catch (e) {
    muzikHost.notYaz(String((e as Error).message));
    hataYaz(res, e, 400);
  }
});

/** Spotify onayı buraya (ve /callback, /resonance/callback'e) döner. */
export async function spotifyDonusu(req: Request, res: Response) {
  const kacis = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sayfa = (mesaj: string, ok: boolean) =>
    res
      .status(200)
      .type('html')
      .setHeader('Cache-Control', 'no-store')
      .send(
        `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>Spotify — ${ok ? 'Bağlandı' : 'Bağlanamadı'}</title>` +
          `<style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#0b0d13;color:#e7eaf3;font:16px/1.6 "Segoe UI",system-ui,sans-serif}` +
          `.k{max-width:30rem;padding:2.5rem;text-align:center}h1{margin:0 0 .75rem;font-size:1.5rem;color:${ok ? '#22d3b8' : '#f87171'}}p{margin:0;color:#a7aec0}</style></head>` +
          `<body><div class="k"><h1>${ok ? 'Bağlandı' : 'Bağlanamadı'}</h1><p>${kacis(mesaj)}</p></div>` +
          (ok ? '<script>setTimeout(function(){window.close()},2500)</script>' : '') +
          `</body></html>`
      );
  const q = req.query as Record<string, string | undefined>;
  if (q.error) {
    muzikHost.notYaz(`Spotify yetkilendirmeyi reddetti: ${q.error}`);
    return sayfa(`Spotify yetkilendirmeyi reddetti: ${q.error}`, false);
  }
  if (!q.code) return sayfa("Spotify'dan kod gelmedi.", false);
  try {
    const ad = await muzikHost.koduTakasEt(String(q.code), q.state ? String(q.state) : undefined);
    wsHub.broadcastTo(['all'], { type: 'player-status' });
    return sayfa(`${ad || 'Spotify hesabınız'} bağlandı. Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.`, true);
  } catch (e) {
    return sayfa(String((e as Error).message), false);
  }
}
router.get('/player/spotify/callback', spotifyDonusu);

router.post('/player/spotify/manual', async (req, res) => {
  try {
    res.json({ ok: true, displayName: await muzikHost.koduTakasEt(String(req.body?.value || '')) });
  } catch (e) {
    hataYaz(res, e, 400);
  }
});
router.post('/player/spotify/token', async (req, res) => {
  try {
    res.json({ ok: true, displayName: await muzikHost.refreshIleBaglan(String(req.body?.clientId || ''), String(req.body?.refreshToken || '')) });
  } catch (e) {
    hataYaz(res, e);
  }
});
router.post('/player/spotify/disconnect', (_req, res) => {
  muzikHost.baglantiyiKes();
  res.json(muzikHost.durum());
});
router.get('/player/spotify/recently-played', async (req, res) => {
  try {
    res.json(await muzikHost.sonCalinanlar(Number(req.query.limit) || 50));
  } catch (e) {
    hataYaz(res, e);
  }
});

router.post('/player/ytmd/session', (req, res) => {
  try {
    muzikHost.ytmdOturumu(req.body);
    res.json(muzikHost.durum());
  } catch (e) {
    hataYaz(res, e, 400);
  }
});

// Yalnız OAuth onay sayfaları açılabilir (yerel sayfa rastgele adres açtıramasın)
const DISARIDA_ACILABILIR = ['https://accounts.spotify.com/', 'https://developer.spotify.com/', 'https://accounts.google.com/'];
router.post('/open-external', (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!DISARIDA_ACILABILIR.some((o) => url.startsWith(o)) || /[\s"]/.test(url)) {
    return hataYaz(res, 'Bu adres bu uçtan açılamaz', 400);
  }
  const komut = process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
  const c = spawn(komut, [url], { detached: true, stdio: 'ignore', windowsHide: true });
  c.on('error', () => {});
  c.unref();
  res.status(204).end();
});

// Resonance tema/profil ayarı (OBS adresi kısa kalsın diye sunucuda)
const AYAR = 'resonance_overlay_configs';
const kimlikGecerli = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);
function ayarlarOku(): Record<string, unknown> {
  try {
    const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR) as { value?: string } | undefined;
    const j = JSON.parse(r?.value || '{}');
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {};
  } catch {
    return {};
  }
}
router.get('/overlay-config', (req, res) => {
  const id = String(req.query.id || '');
  if (!kimlikGecerli(id)) return hataYaz(res, 'geçersiz id', 400);
  const v = ayarlarOku()[id];
  return v === undefined ? hataYaz(res, 'kayıt yok', 404) : res.json(v);
});
router.post('/overlay-config', (req, res) => {
  const id = String(req.body?.id || '');
  if (!kimlikGecerli(id)) return hataYaz(res, 'geçersiz id', 400);
  const veri = req.body?.data ?? null;
  if (JSON.stringify(veri).length > 256_000) return hataYaz(res, 'ayar çok büyük', 413);
  const tum = ayarlarOku();
  tum[id] = veri;
  if (id !== 'aktif') tum.aktif = veri;
  // En çok 50 profil
  const anahtarlar = Object.keys(tum);
  for (const k of anahtarlar.slice(0, Math.max(0, anahtarlar.length - 50))) if (k !== 'aktif') delete tum[k];
  db.prepare('INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(AYAR, JSON.stringify(tum));
  for (const c of senkron.clients) if (c.readyState === 1) c.send(JSON.stringify({ type: 'overlay-config' }));
  res.json({ ok: true, id });
});

export default router;
