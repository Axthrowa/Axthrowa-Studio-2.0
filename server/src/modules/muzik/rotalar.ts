/**
 * StreamAxT — müzik host API'si (Resonance arayüzü + panel + OBS)
 * Developed by AxthrowA
 *
 * Uçlar Yayın Yönetim Aracı'ndaki Rust host'uyla aynı biçimdedir; Resonance
 * değiştirilmeden hem orada, hem StreamAxT'te (/resonance/), hem de bağımsız
 * Resonance sunucusunda (resonance-bagimsiz.ts) çalışır. Bu dosya veritabanı
 * ve StreamAxT'e özgü modül kullanmaz: depolama ve yayın dışarıdan verilir.
 */
import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import type { MuzikHost } from './muzik.js';
import { donusAdresiSec, SPOTIFY_DONUS_YOLLARI } from './spotify-saf.js';

export interface MuzikRotaSecenekleri {
  host: MuzikHost;
  /** Resonance tema/profil ayarları (OBS adresi kısa kalsın diye sunucuda) */
  ayarlarOku: () => Record<string, unknown>;
  ayarlarYaz: (tum: Record<string, unknown>) => void;
  /** /ws/overlay-sync istemcilerine ham mesaj */
  senkronYayinla: (m: unknown) => void;
  /** Spotify bağlantısı değişti (panelleri tazele) */
  durumDegisti?: () => void;
}

const DISARIDA_ACILABILIR = ['https://accounts.spotify.com/', 'https://developer.spotify.com/', 'https://accounts.google.com/'];

export function muzikRotalari(o: MuzikRotaSecenekleri): { router: Router; spotifyDonusu: (req: Request, res: Response) => Promise<void> } {
  const { host } = o;
  const router = Router();
  const kok = (req: Request) => `http://${req.headers.host}`;
  const hataYaz = (res: Response, e: unknown, kod = 502) => {
    res.status(kod).type('text/plain').send(String((e as Error)?.message || e));
  };

  router.get('/health', (_req, res) => {
    res.type('text/plain').send('ok');
  });

  router.get('/now-playing', (_req, res) => {
    res.json(host.simdiCalan());
  });
  router.post('/now-playing', (req, res) => {
    host.ytmdCalanYaz(req.body);
    res.json({ ok: true });
  });

  router.get('/player/status', (_req, res) => {
    res.json(host.durum());
  });
  router.post('/player/source', (req, res) => {
    host.kaynakSec(String(req.body?.source || ''));
    res.json(host.durum());
  });
  router.post('/player/command', async (req, res) => {
    try {
      await host.komut(String(req.body?.action || ''), req.body?.source ? String(req.body.source) : undefined);
      res.json({ ok: true });
    } catch (e) {
      hataYaz(res, e);
    }
  });

  router.post('/player/request', async (req, res) => {
    try {
      const p = await host.parcaAra(String(req.body?.query || ''));
      if (!p) return hataYaz(res, "Spotify'da sonuç yok", 404);
      await host.parcayiCal(p.uri, true);
      res.json({ ok: true, title: p.title, artist: p.artist, id: p.uri });
    } catch (e) {
      hataYaz(res, e);
    }
  });

  router.post('/player/spotify/authorize', (req, res) => {
    try {
      const donus = donusAdresiSec(kok(req), req.body?.redirectUri);
      const url = host.yetkiBaslat(String(req.body?.clientId || ''), donus);
      res.json({ url, redirectUri: donus, allowedRedirectUris: SPOTIFY_DONUS_YOLLARI.map((y) => `${kok(req)}${y}`) });
    } catch (e) {
      host.notYaz(String((e as Error).message));
      hataYaz(res, e, 400);
    }
  });

  /** Spotify onayı buraya (ve /callback, /resonance/callback'e) döner. */
  async function spotifyDonusu(req: Request, res: Response): Promise<void> {
    const kacis = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const sayfa = (mesaj: string, ok: boolean) => {
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
    };
    const q = req.query as Record<string, string | undefined>;
    if (q.error) {
      host.notYaz(`Spotify yetkilendirmeyi reddetti: ${q.error}`);
      return sayfa(`Spotify yetkilendirmeyi reddetti: ${q.error}`, false);
    }
    if (!q.code) return sayfa("Spotify'dan kod gelmedi.", false);
    try {
      const ad = await host.koduTakasEt(String(q.code), q.state ? String(q.state) : undefined);
      o.durumDegisti?.();
      return sayfa(`${ad || 'Spotify hesabınız'} bağlandı. Bu sekmeyi kapatıp uygulamaya dönebilirsiniz.`, true);
    } catch (e) {
      return sayfa(String((e as Error).message), false);
    }
  }
  router.get('/player/spotify/callback', spotifyDonusu);

  router.post('/player/spotify/manual', async (req, res) => {
    try {
      res.json({ ok: true, displayName: await host.koduTakasEt(String(req.body?.value || '')) });
    } catch (e) {
      hataYaz(res, e, 400);
    }
  });
  router.post('/player/spotify/token', async (req, res) => {
    try {
      res.json({ ok: true, displayName: await host.refreshIleBaglan(String(req.body?.clientId || ''), String(req.body?.refreshToken || '')) });
    } catch (e) {
      hataYaz(res, e);
    }
  });
  router.post('/player/spotify/disconnect', (_req, res) => {
    host.baglantiyiKes();
    res.json(host.durum());
  });
  router.get('/player/spotify/recently-played', async (req, res) => {
    try {
      res.json(await host.sonCalinanlar(Number(req.query.limit) || 50));
    } catch (e) {
      hataYaz(res, e);
    }
  });

  router.post('/player/ytmd/session', (req, res) => {
    try {
      host.ytmdOturumu(req.body);
      res.json(host.durum());
    } catch (e) {
      hataYaz(res, e, 400);
    }
  });

  // Yalnız OAuth onay sayfaları açılabilir (yerel sayfa rastgele adres açtıramasın)
  router.post('/open-external', (req, res) => {
    const url = String(req.body?.url || '').trim();
    if (!DISARIDA_ACILABILIR.some((x) => url.startsWith(x)) || /[\s"]/.test(url)) {
      return hataYaz(res, 'Bu adres bu uçtan açılamaz', 400);
    }
    const komut = process.platform === 'win32' ? 'explorer.exe' : 'xdg-open';
    const c = spawn(komut, [url], { detached: true, stdio: 'ignore', windowsHide: true });
    c.on('error', () => {});
    c.unref();
    res.status(204).end();
  });

  const kimlikGecerli = (id: string) => /^[A-Za-z0-9_-]{1,64}$/.test(id);
  router.get('/overlay-config', (req, res) => {
    const id = String(req.query.id || '');
    if (!kimlikGecerli(id)) return hataYaz(res, 'geçersiz id', 400);
    const v = o.ayarlarOku()[id];
    return v === undefined ? hataYaz(res, 'kayıt yok', 404) : res.json(v);
  });
  router.post('/overlay-config', (req, res) => {
    const id = String(req.body?.id || '');
    if (!kimlikGecerli(id)) return hataYaz(res, 'geçersiz id', 400);
    const veri = req.body?.data ?? null;
    if (JSON.stringify(veri).length > 256_000) return hataYaz(res, 'ayar çok büyük', 413);
    const tum = o.ayarlarOku();
    tum[id] = veri;
    if (id !== 'aktif') tum.aktif = veri;
    // En çok 50 profil
    const anahtarlar = Object.keys(tum);
    for (const k of anahtarlar.slice(0, Math.max(0, anahtarlar.length - 50))) if (k !== 'aktif') delete tum[k];
    o.ayarlarYaz(tum);
    o.senkronYayinla({ type: 'overlay-config' });
    res.json({ ok: true, id });
  });

  return { router, spotifyDonusu };
}
