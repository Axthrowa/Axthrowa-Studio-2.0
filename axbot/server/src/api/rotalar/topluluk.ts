/**
 * AxBoT — topluluk: 7TV emote'ları, düzenli izleyiciler
 * Developed by AxthrowA
 */
import { Router, Request, Response } from 'express';
import { kanallarlaGetir } from '../../modules/emotes/yedi-tv.js';
import { kullaniciBoyasi } from '../../modules/emotes/yedi-tv-boya.js';
import { duzenliler } from '../../modules/community/regulars.js';
import { settingsCache } from '../../core/settings-cache.js';
import { bingo, votekick } from '../../modules/community/topluluk.js';

const router = Router();
const PLATFORMLAR = new Set(['kick', 'twitch', 'youtube', 'tiktok', 'discord', 'trovo', 'tum']);

// Sohbet katmanı ve panel 7TV adlarını görsele çevirmek için okur
router.get('/emotes', async (req: Request, res: Response) => {
  const d = await kanallarlaGetir(req.query.yenile === '1');
  // 7TV kapalıyken de BTTV ve FFZ gelir (eskiden tarayıcı onları ayrıca çekiyordu)
  if (!settingsCache.getBoolean('seventv_enabled', true)) {
    return res.json({ yediTv: { ...d, kanal: [], genel: [], kanalDurum: 'kapali' } });
  }
  res.json({ yediTv: d });
});

// WID-4: sohbet katmanında kullanıcı adının 7TV boyası (katman 7TV'ye gitmez; sunucu önbellekte tutar)
router.get('/emotes/boya', async (req: Request, res: Response) => {
  const platform = req.query.platform === 'twitch' ? 'twitch' : req.query.platform === 'kick' ? 'kick' : null;
  const kimlik = String(req.query.id ?? '');
  if (!platform || !settingsCache.getBoolean('seventv_enabled', true)) return res.json({ boya: null });
  res.setHeader('Cache-Control', 'max-age=1800');
  res.json({ boya: await kullaniciBoyasi(platform, kimlik) });
});

router.get('/regulars', (req: Request, res: Response) => {
  const p = String(req.query.platform || '');
  res.json({ regulars: duzenliler.listele(PLATFORMLAR.has(p) ? p : undefined) });
});

router.post('/regulars', (req: Request, res: Response) => {
  const platform = String(req.body?.platform || 'kick');
  if (!PLATFORMLAR.has(platform)) return res.status(400).json({ error: 'Geçersiz platform' });
  const r = duzenliler.ekle(platform, String(req.body?.username || ''), 'panel');
  if (r === 'gecersiz') return res.status(400).json({ error: 'Geçersiz kullanıcı adı' });
  res.json({ success: true, sonuc: r });
});

router.delete('/regulars/:platform/:username', (req: Request, res: Response) => {
  const ok = duzenliler.cikar(String(req.params.platform), String(req.params.username));
  res.status(ok ? 200 : 404).json({ success: ok });
});

// Panelde anlık durum (gizli bingo emote'u verilmez)
router.get('/topluluk/durum', (_req: Request, res: Response) => {
  res.json({ bingo: bingo.durum(), votekick: votekick.durum() });
});

export default router;
