/**
 * AxBoT API — Uyarı şablonları, varyantlar, yedek/geri yükleme, medya kütüphanesi
 * Developed by AxthrowA
 *
 * B1: eski tek parça api/routes.ts'den (2.300+ satır, 154 rota) ayrıldı;
 * rota gövdeleri DEĞİŞMEDİ, özgün sırayla kayıtlıdır. Bağlama sırası
 * api/routes.ts toplayıcısındadır.
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db/index.js';
import { wsHub } from '../../ws/server.js';
import { medya, MAKS_BOYUT, MAKS_VIDEO, MAKS_TOPLAM } from '../../modules/media/media.js';
import { varyantlar } from '../../modules/alerts/variants.js';
import { uyariYedegi } from '../../modules/alerts/backup.js';
import { shieldModeService } from '../../modules/moderation/shield-mode.js';

const router = Router();

// 9. Alert Presets (OBS AlertBox)
router.get('/alerts', (req: Request, res: Response) => {
  const presets = db.prepare('SELECT * FROM alert_presets').all();
  res.json(presets);
});

router.post('/alerts/save', (req: Request, res: Response) => {
  const { id, eventType, titleTemplate, messageTemplate, soundUrl, imageUrl, durationMs, fontFamily, textColor, accentColor, animation, soundVolume, isEnabled, layoutMode, textEffect } = req.body;
  const alertId = id || `alert-${eventType || 'custom'}-${Date.now()}`;
  db.prepare(`
    INSERT INTO alert_presets (id, event_type, title_template, message_template, sound_url, image_url, duration_ms, font_family, text_color, accent_color, animation, sound_volume, is_enabled, layout_mode, text_effect)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      event_type = excluded.event_type,
      title_template = excluded.title_template,
      message_template = excluded.message_template,
      sound_url = excluded.sound_url,
      image_url = excluded.image_url,
      duration_ms = excluded.duration_ms,
      font_family = excluded.font_family,
      text_color = excluded.text_color,
      accent_color = excluded.accent_color,
      animation = excluded.animation,
      sound_volume = excluded.sound_volume,
      is_enabled = excluded.is_enabled,
      layout_mode = excluded.layout_mode,
      text_effect = excluded.text_effect
  `).run(
    alertId, eventType || 'follow', titleTemplate, messageTemplate, soundUrl || '', imageUrl || '',
    durationMs || 5000, fontFamily || 'Plus Jakarta Sans', textColor || '#ffffff', accentColor || '#8b5cf6',
    animation || 'bounce', soundVolume ?? 0.7, isEnabled ? 1 : 0, layoutMode || 'stacked', textEffect || 'shine'
  );
  res.json({ success: true, id: alertId });
});

// Ekip çapında uyarı kuyruğu denetimi: duraklat / sürdür / sustur / sesi aç / atla / temizle / yeniden oynat.
// İyimser kilit: istemci gördüğü `version`'ı gönderir; arada başka biri değiştirdiyse 409 + güncel durum.
router.get('/alerts/control', (_req: Request, res: Response) => {
  res.json(wsHub.uyariKontrolDurumu());
});

const EYLEM_ETIKETI: Record<string, string> = {
  pause: 'duraklattı',
  resume: 'sürdürdü',
  mute: 'sessize aldı',
  unmute: 'sesini açtı',
  skip: 'geçerli uyarıyı atladı',
  clear: 'bekleyen uyarıları temizledi',
  replay: 'uyarıyı yeniden oynattı',
  play_now: 'sıradaki uyarıyı hemen oynattı',
  move_last: 'sıradaki uyarıyı sona aldı',
  remove: 'sıradaki uyarıyı sildi'
};

router.post('/alerts/control', (req: Request, res: Response) => {
  const { action, version, alertId, actor } = req.body || {};
  // Yalnız yerel kökenler ulaşabilir (local-guard); ad yalnız denetim kaydında etiket olarak kullanılır
  const kim = String(actor || 'Panel').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 40) || 'Panel';
  const surum = version === undefined || version === null || version === '' ? null : Number(version);
  if (surum !== null && !Number.isInteger(surum)) {
    return res.status(400).json({ error: 'Geçersiz sürüm' });
  }
  const sonuc = wsHub.uyariKontrolEt(String(action || ''), kim, surum, alertId ? String(alertId).slice(0, 80) : undefined);
  if (!sonuc.ok) {
    return res.status(sonuc.kod === 'conflict' ? 409 : 400).json({ error: sonuc.mesaj, ...wsHub.uyariKontrolDurumu() });
  }
  shieldModeService.addAuditLog(
    `ALERT_${String(action).toUpperCase()}`,
    kim,
    `Uyarı kuyruğunu ${EYLEM_ETIKETI[String(action)] || String(action)}`,
    alertId ? String(alertId).slice(0, 80) : undefined,
    'info'
  );
  res.json(wsHub.uyariKontrolDurumu());
});

router.post('/alerts/test', (req: Request, res: Response) => {
  const { eventType, deger } = req.body || {};
  wsHub.triggerTestAlert(eventType || 'follow', deger === undefined ? undefined : Number(deger));
  res.json({ success: true });
});

// 8.8 Uyari varyantlari — ayni olay her geldiginde farkli gorsel/ses.
// Tutara gore de secilir: 1000 TL bagis "0+" varyantina dusmez.
router.get('/alerts/variants', (req: Request, res: Response) => {
  res.json(varyantlar.listele(req.query.eventType ? String(req.query.eventType) : undefined));
});

router.post('/alerts/variants/:eventType', (req: Request, res: Response) => {
  res.json(varyantlar.kaydet(String(req.params.eventType || ''), req.body || {}));
});

router.delete('/alerts/variants/:id', (req: Request, res: Response) => {
  res.json({ ok: varyantlar.sil(String(req.params.id || '')) });
});

// 8.85 Uyari yedegi — makine degistirince emek kaybolmasin.
// Icinde token/sifre YOK; paylasilabilir bir dosyadir.
router.get('/alerts/backup', (req: Request, res: Response) => {
  // ?medya=1 → uyarıların kullandığı yerel görsel/ses dosyaları da gömülür
  const yedek = uyariYedegi.disaAktar(String(req.query.medya || '') === '1');
  res.setHeader('Content-Disposition', 'attachment; filename="axbot-uyarilar.json"');
  res.json(yedek);
});

router.post('/alerts/backup/import', (req: Request, res: Response) => {
  const sonuc = uyariYedegi.iceAktar(req.body?.veri, Boolean(req.body?.uzerineYaz));
  res.status(sonuc.ok ? 200 : 400).json(sonuc);
});

// 8.9 Medya kutuphanesi — uyari gorseli ve sesi artik yerel dosyadan
// gelebilir. Onceden yalniz harici URL vardi: internet kesilince uyarilar
// bozuluyordu.
router.get('/media', (req: Request, res: Response) => {
  const tur = req.query.tur ? String(req.query.tur) : undefined;
  res.json({
    ogeler: medya.listele(tur as any),
    toplamBoyut: medya.toplamBoyut(),
    maksBoyut: MAKS_BOYUT,
    maksVideo: MAKS_VIDEO,
    maksToplam: MAKS_TOPLAM
  });
});

router.post('/media', (req: Request, res: Response) => {
  const ad = String(req.body?.ad || 'dosya');
  const veri = String(req.body?.veri || '');
  if (!veri) return res.status(400).json({ ok: false, hata: 'veri (base64) gerekli' });
  const sonuc = medya.ekle(ad, veri);
  res.status(sonuc.ok ? 200 : 400).json(sonuc);
});

router.delete('/media/:id', (req: Request, res: Response) => {
  res.json({ ok: medya.sil(String(req.params.id || '')) });
});

/** Dosyanin kendisi. Yol gezinmesi imkansiz: kimlik ile arayip diskten okur. */
router.get('/media/:id/dosya', (req: Request, res: Response) => {
  const oge = medya.bul(String(req.params.id || ''));
  if (!oge) return res.status(404).json({ error: 'Bulunamadı' });
  res.setHeader('Content-Type', oge.mime);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  // SVG izinli listede yok; yine de tarayici tur tahmini yapmasin
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.sendFile(medya.dosyaYolu(oge));
});

export default router;
