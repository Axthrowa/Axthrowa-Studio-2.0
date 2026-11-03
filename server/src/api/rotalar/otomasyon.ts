import { Router, type Request, type Response } from 'express';
import { otomasyon } from '../../modules/otomasyon/otomasyon.js';

const router = Router();

router.get('/otomasyon', (_req: Request, res: Response) => {
  res.json({ kurallar: otomasyon.kurallar(), gunluk: otomasyon.gunlukOku() });
});

router.put('/otomasyon', (req: Request, res: Response) => {
  const r = otomasyon.kaydet(req.body?.kurallar);
  if (!r.ok) return res.status(400).json({ error: r.hata });
  res.json({ kurallar: r.kurallar });
});

// Hiçbir eylemi çalıştırmaz: koşul sonucu ve adımların dökümü
router.post('/otomasyon/dene', async (req: Request, res: Response) => {
  const r = await otomasyon.dene(req.body?.kural);
  if (!r.ok) return res.status(400).json({ error: r.hata });
  res.json(r);
});

export default router;
