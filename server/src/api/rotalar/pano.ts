/**
 * AxBoT API — Ses/Video Panosu (Blerp tarzı)
 * Developed by AxthrowA
 *
 * Öğeler ve kovalar medya kütüphanesindeki (/api/media) yayıncının kendi dosyalarını kullanır. Yazma uçları
 * genel köken denetiminden geçer (index.ts); oynatma panelden bedelsiz, sohbetten bedelli (!ses).
 */
import { Router, Request, Response } from 'express';
import { sesPanosu } from '../../modules/pano/pano.js';

const router = Router();

router.get('/pano', (_req: Request, res: Response) => {
  res.json({ ogeler: sesPanosu.ogeler(), kovalar: sesPanosu.kovalar(), girisSesleri: sesPanosu.girisSesleri(), ...sesPanosu.durum() });
});

router.post('/pano/oge', (req: Request, res: Response) => {
  const r = sesPanosu.ogeYaz(req.body || {});
  res.status(r.ok ? 200 : 400).json(r);
});

router.delete('/pano/oge/:id', (req: Request, res: Response) => {
  res.json({ ok: sesPanosu.ogeSil(String(req.params.id || '')) });
});

router.post('/pano/kova', (req: Request, res: Response) => {
  const r = sesPanosu.kovaYaz(req.body || {});
  res.status(r.ok ? 200 : 400).json(r);
});

router.delete('/pano/kova/:id', (req: Request, res: Response) => {
  res.json({ ok: sesPanosu.kovaSil(String(req.params.id || '')) });
});

router.post('/pano/ayarlar', (req: Request, res: Response) => {
  res.json({ ok: true, ayarlar: sesPanosu.ayarlariYaz(req.body || {}) });
});

router.post('/pano/giris', (req: Request, res: Response) => {
  const ok = sesPanosu.girisSesiYaz(String(req.body?.kullanici || ''), req.body?.ogeId ? String(req.body.ogeId) : null);
  res.status(ok ? 200 : 400).json({ ok });
});

router.post('/pano/oynat', (req: Request, res: Response) => {
  const r = sesPanosu.panelOynat(String(req.body?.ogeId || ''));
  res.status(r.ok ? 200 : 404).json(r);
});

router.post('/pano/kontrol', (req: Request, res: Response) => {
  const r = sesPanosu.kontrol(String(req.body?.eylem || ''));
  res.status(r.ok ? 200 : 400).json(r);
});

/** Katman açılınca çalanı yeniden alabilsin diye (WebSocket'e ek) */
router.get('/pano/durum', (_req: Request, res: Response) => {
  res.json(sesPanosu.durum());
});

router.get('/pano/gecmis', (req: Request, res: Response) => {
  res.json({ gecmis: sesPanosu.gecmis(Number(req.query.adet) || 50) });
});

export default router;
