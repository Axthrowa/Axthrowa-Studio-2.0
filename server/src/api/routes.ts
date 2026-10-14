/**
 * StreamAxT — REST API toplayıcısı
 * Developed by AxthrowA
 *
 * B1: Bu dosya eskiden 2.300+ satırlık tek parçaydı (154 rota). Rotalar
 * artık alan modüllerinde: api/rotalar/*.ts.
 *
 * SIRA ÖNEMLİ: Express bir isteğe uyan İLK rotayı çalıştırır. Modüller,
 * özgün dosyadaki ilk bölümlerinin sırasıyla bağlanır; bölme sırasında
 * çalışma anı rota listesi önce/sonra karşılaştırıldı (aynı 154
 * yöntem+yol+işleyici zinciri; aynı isteğe uyabilen her rota çiftinde
 * öncelik aynı). Yeni rota eklerken aynı yolu iki modülde tanımlamayın.
 */
import { Router } from 'express';
import sistem from './rotalar/sistem.js';
import platformlar from './rotalar/platformlar.js';
import komutlar from './rotalar/komutlar.js';
import moderasyon from './rotalar/moderasyon.js';
import ses from './rotalar/ses.js';
import ekonomi from './rotalar/ekonomi.js';
import etkilesim from './rotalar/etkilesim.js';
import uyarilar from './rotalar/uyarilar.js';
import entegrasyonlar from './rotalar/entegrasyonlar.js';
import sohbet from './rotalar/sohbet.js';
import widgetlar from './rotalar/widgetlar.js';
import oyunlar from './rotalar/oyunlar.js';
import bagislar from './rotalar/bagislar.js';
import pano from './rotalar/pano.js';
import sesli from './rotalar/sesli.js';
import klipler from './rotalar/klipler.js';

const router = Router();

router.use(sistem);
router.use(platformlar);
router.use(komutlar);
router.use(moderasyon);
router.use(ses);
router.use(ekonomi);
router.use(etkilesim);
router.use(uyarilar);
router.use(entegrasyonlar);
router.use(sohbet);
router.use(widgetlar);
router.use(oyunlar);
router.use(bagislar);
router.use(pano);
router.use(sesli);
router.use(klipler);

export default router;
