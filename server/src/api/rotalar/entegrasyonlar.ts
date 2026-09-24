/**
 * StreamAxT API — Discord duyurusu, Nightbot içe aktarma
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { commandManager } from '../../modules/commands/command-manager.js';
import { temizle, yeniSirDegeri } from '../../core/security/redact.js';
import { discordDuyuru } from '../../modules/integrations/discord-announce.js';
import { nightbot } from '../../modules/integrations/nightbot-import.js';

const router = Router();

// 8.6 Entegrasyonlar: Discord duyurusu + Nightbot ice aktarma
router.get('/integrations/discord', (req: Request, res: Response) => {
  // Webhook adresi SIR sayilir: icinde token var, maskelenerek doner.
  res.json(temizle(discordDuyuru.ayarOku()));
});

router.post('/integrations/discord', (req: Request, res: Response) => {
  // Maskeli webhook geri gonderilirse mevcut deger korunur.
  const gelen = req.body || {};
  const mevcut = discordDuyuru.ayarOku();
  for (const k of Object.keys(gelen)) {
    if (gelen[k] && typeof gelen[k] === 'object') {
      gelen[k].webhook = yeniSirDegeri(gelen[k].webhook, (mevcut as any)[k]?.webhook ?? '');
    }
  }
  res.json(temizle(discordDuyuru.ayarYaz(gelen)));
});

/** Test duyurusu — bekleme suresini atlar. */
router.post('/integrations/discord/test', async (req: Request, res: Response) => {
  const kaynak = String(req.body?.kaynak || 'kick') as any;
  const kanal = String(req.body?.kanal || '');
  res.json(await discordDuyuru.duyur(kaynak, kanal, true));
});

router.post('/integrations/nightbot/import', (req: Request, res: Response) => {
  const veri = req.body?.veri;
  if (!veri) return res.status(400).json({ error: 'veri gerekli (Nightbot JSON)' });
  try {
    res.json(nightbot.aktar(veri, Boolean(req.body?.uzerineYaz)));
    commandManager.reload();
  } catch (e: any) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

export default router;
