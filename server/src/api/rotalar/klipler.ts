/**
 * AxBoT — !clip ile kaydedilen klipler (yerel dosyalar)
 * Developed by AxthrowA
 */
import { Router, Request, Response } from 'express';
import { klipYoneticisi, ffmpegVarMi } from '../../modules/clips/klip.js';

const router = Router();

router.get('/klipler', async (_req: Request, res: Response) => {
  res.json({ klipler: klipYoneticisi.listele(), ffmpeg: await ffmpegVarMi(), mesgul: klipYoneticisi.mesgulMu() });
});

// Video: dosya adı sıkı desenle doğrulanır (yol geçişi yok); Range desteği sendFile'da
router.get('/klipler/:dosya', (req: Request, res: Response) => {
  const yol = klipYoneticisi.yol(String(req.params.dosya));
  if (!yol) return res.status(404).json({ error: 'Klip bulunamadı' });
  if (req.query.indir === '1') return res.download(yol);
  res.sendFile(yol);
});

router.delete('/klipler/:dosya', (req: Request, res: Response) => {
  const ok = klipYoneticisi.sil(String(req.params.dosya));
  res.status(ok ? 200 : 404).json({ success: ok });
});

export default router;
