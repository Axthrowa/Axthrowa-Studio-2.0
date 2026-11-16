import { Router, type Request, type Response } from 'express';
import { otomasyon } from '../../modules/otomasyon/otomasyon.js';
import { eventBus } from '../../core/event-bus.js';

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

// B7: kuralı örnek olayla gerçekten çalıştırır (panel onay sorar)
router.post('/otomasyon/calistir', async (req: Request, res: Response) => {
  res.json(await otomasyon.calistir(req.body?.kural));
});

// Y12/Y7: AxthrowA Studio'nun bağlantı koruması ve Twitch reklam olayları. Yalnız bu türler kabul edilir; isteğe bağlı tek satır sohbete gider.
const STUDIO_OLAYLARI = new Set(['bit_hizi_dustu', 'baglanti_duzeldi', 'kare_dususu', 'reklam_yaklasiyor', 'reklam_basliyor', 'reklam_bitti']);
router.post('/otomasyon/olay', async (req: Request, res: Response) => {
  const tur = String(req.body?.tur || '');
  if (!STUDIO_OLAYLARI.has(tur)) return res.status(400).json({ error: 'Bilinmeyen olay' });
  const sohbet = String(req.body?.sohbet ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200);
  if (sohbet) eventBus.emitBotMessage({ platform: 'all', message: sohbet });
  const miktar = Number(req.body?.miktar);
  await otomasyon.olay({ tur: tur as 'bit_hizi_dustu', miktar: Number.isFinite(miktar) ? miktar : undefined });
  res.json({ ok: true });
});

export default router;
