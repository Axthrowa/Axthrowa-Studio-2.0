import { Router, type Request, type Response } from 'express';
import { yayinOzeti } from '../../modules/ai/yayin-ozeti.js';
import { raporCsv, sarkiListesiMetni } from '../../modules/ai/yayin-ozeti-saf.js';
import { discordDuyuru } from '../../modules/integrations/discord-announce.js';

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

// B10: raporun tabloları CSV olarak indirilir
router.get('/yayin-ozetleri/:id/csv', (req: Request, res: Response) => {
  const rapor = yayinOzeti.raporlar().find((r) => r.id === req.params.id);
  if (!rapor) return res.status(404).json({ error: 'Rapor bulunamadı' });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="yayin-raporu-${new Date(rapor.baslangic).toISOString().slice(0, 10)}.csv"`);
  res.send(raporCsv(rapor));
});

// Yayıncı düğmeye basınca raporun şarkı listesi Discord duyuru webhook'una yazılır (kendiliğinden gitmez)
router.post('/yayin-ozetleri/:id/discord', async (req: Request, res: Response) => {
  const rapor = yayinOzeti.raporlar().find((r) => r.id === req.params.id);
  if (!rapor?.sarkilar?.length) return res.status(404).json({ error: 'Bu raporda şarkı yok' });
  try {
    await discordDuyuru.metinGonder(sarkiListesiMetni(rapor));
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message || e).slice(0, 200) });
  }
});

export default router;
