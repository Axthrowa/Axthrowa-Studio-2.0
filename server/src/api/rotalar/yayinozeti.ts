import { Router, type Request, type Response } from 'express';
import { yayinOzeti } from '../../modules/ai/yayin-ozeti.js';

const router = Router();

router.get('/yayin-ozetleri', (_req: Request, res: Response) => {
  res.json({ ozetler: yayinOzeti.raporlar(), aiAcik: yayinOzeti.aiAcik() });
});

router.post('/yayin-ozetleri/ayar', (req: Request, res: Response) => {
  yayinOzeti.aiAyarla(req.body?.aiAcik === true);
  res.json({ aiAcik: yayinOzeti.aiAcik() });
});

// Yayını beklemeden o ana kadarki rapor
router.post('/yayin-ozetleri/olustur', async (_req: Request, res: Response) => {
  const rapor = await yayinOzeti.olustur();
  if (!rapor) return res.status(400).json({ error: 'Özetlenecek kadar sohbet yok' });
  res.json(rapor);
});

export default router;
