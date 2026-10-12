/**
 * StreamAxT API — Sesli komutlar
 * Developed by AxthrowA
 *
 * Yazma uçları (komut çalıştırma dahil) genel köken denetiminden geçer (index.ts): yalnız bu panel ve yerel
 * dinleyici sayfası çağırabilir. Model dosyası salt okunur sunulur (tarayıcıdaki Vosk işçisi indirir).
 */
import { Router, Request, Response } from 'express';
import fs from 'node:fs';
import { sesliKomutlar, MODEL_DOSYASI, eylemAciklamasi } from '../../modules/sesli/sesli.js';

const router = Router();

router.get('/sesli', (_req: Request, res: Response) => {
  res.json({
    ayarlar: sesliKomutlar.ayarlar(),
    komutlar: sesliKomutlar.komutlar().map((k) => ({ ...k, aciklama: eylemAciklamasi(k.eylem) })),
    model: sesliKomutlar.modelDurumu()
  });
});

router.post('/sesli/ayarlar', (req: Request, res: Response) => {
  res.json({ ok: true, ayarlar: sesliKomutlar.ayarlariYaz(req.body || {}) });
});

router.post('/sesli/komut', (req: Request, res: Response) => {
  const r = sesliKomutlar.komutYaz(req.body || {});
  res.status(r.ok ? 200 : 400).json(r);
});

router.delete('/sesli/komut/:id', (req: Request, res: Response) => {
  res.json({ ok: sesliKomutlar.komutSil(String(req.params.id || '')) });
});

/** Dinleyicinin tanıdığı cümle (ya da panelin "dene" kutusu) */
router.post('/sesli/calistir', async (req: Request, res: Response) => {
  const metin = String(req.body?.metin ?? '');
  const sonuc = await sesliKomutlar.isle(metin, { basKonus: !!req.body?.basKonus, dene: !!req.body?.dene });
  res.json(sonuc);
});

/** Tanıyıcıya verilecek ifade listesi; serbest tanımada `null` */
router.get('/sesli/dilbilgisi', async (_req: Request, res: Response) => {
  res.json({ ifadeler: await sesliKomutlar.dilbilgisi() });
});

router.get('/sesli/gecmis', (req: Request, res: Response) => {
  res.json({ gecmis: sesliKomutlar.gecmis(Number(req.query.adet) || 50) });
});

router.get('/sesli/model', (_req: Request, res: Response) => {
  res.json(sesliKomutlar.modelDurumu());
});

/** Yayıncının açık eylemiyle bir kez indirilir (Vosk Türkçe küçük model, Apache-2.0, ~37 MB) */
router.post('/sesli/model/indir', (_req: Request, res: Response) => {
  res.json(sesliKomutlar.modelIndir());
});

router.get('/sesli/model.tar.gz', (_req: Request, res: Response) => {
  if (!fs.existsSync(MODEL_DOSYASI)) return res.status(404).json({ hata: 'Model indirilmemiş' });
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(MODEL_DOSYASI);
});

export default router;
