/** OBS girişi ses taşıyor mu? (toplu susturma ve Kontrol Merkezi ses paneli aynı kuralı kullanır) */
const AUDIO_KIND = /wasapi|coreaudio|pulse|alsa|audio|vlc_source|ffmpeg_source|browser_source|mediassource|soundtrack/i;
const AUDIO_NAME = /ses|audio|mic|masaüstü|desktop/i;

export function isAudioInput(kind: string, name: string): boolean {
  return AUDIO_KIND.test(kind) || AUDIO_NAME.test(name);
}

/** Ölçer ölçeği: OBS karıştırıcısı gibi -60 dBFS'ten 0'a. */
export const METER_MIN_DB = -60;

/** dBFS → çubuk doluluğu (0–100). Taban altı 0, kırpılma 100. */
export function meterPercent(db: number): number {
  if (!Number.isFinite(db) || db <= METER_MIN_DB) return 0;
  if (db >= 0) return 100;
  return Math.round(((db - METER_MIN_DB) / -METER_MIN_DB) * 1000) / 10;
}

/** Ölçer bölgesi (OBS'in yeşil / sarı / kırmızı eşikleri: -20 ve -9 dBFS). */
export function meterZone(db: number): "ok" | "hot" | "clip" {
  return db >= -9 ? "clip" : db >= -20 ? "hot" : "ok";
}

/** Kaydırıcı: OBS karıştırıcısı gibi -60..0 dB. Tamamen sola çekince OBS'in sessiz sınırı (-100 dB). */
export function sesDbdenYuzde(db: number): number {
  return Math.round(meterPercent(db));
}

export function sesYuzdedenDb(yuzde: number): number {
  return yuzde <= 0 ? -100 : Math.round((yuzde - 100) * 0.6 * 10) / 10;
}

/** -60..0 dB → ölçer genişliği (%) */
export function olcerYuzdesi(db: number): number {
  return meterPercent(db);
}

export function dbYazisi(db: number): string {
  return db <= -100 ? "-inf dB" : `${db.toFixed(1)} dB`;
}

export type OlcerDurumu = { deger: number; tepe: number; tepeAn: number };
export const OLCER_BOSTA: OlcerDurumu = { deger: METER_MIN_DB, tepe: METER_MIN_DB, tepeAn: 0 };

/** OBS ölçeri gibi: yükselince hemen çıkar, düşerken 23,5 dB/sn iner. Tepe çizgisi 1,5 sn bekler. */
const DUSUS_DB_SN = 23.53;
const TEPE_BEKLEME_MS = 1500;

export function olcerAdimi(o: OlcerDurumu, db: number, dtMs: number, simdi: number): OlcerDurumu {
  const yeni = Number.isFinite(db) ? db : METER_MIN_DB;
  const deger = Math.max(METER_MIN_DB, yeni, o.deger - (DUSUS_DB_SN * dtMs) / 1000);
  if (deger >= o.tepe) return { deger, tepe: deger, tepeAn: simdi };
  if (simdi - o.tepeAn < TEPE_BEKLEME_MS) return { ...o, deger };
  return { deger, tepe: Math.max(deger, o.tepe - (DUSUS_DB_SN * dtMs) / 1000), tepeAn: o.tepeAn };
}

/** Önizleme: en çok ~15 kare/sn. OBS yavaşsa bekleme de uzar, OBS zamanının en fazla yarısı kare almaya gider. */
const ONIZLEME_HEDEF_MS = 66;
export function onizlemeBeklemesi(sureMs: number): number {
  return Math.min(1000, Math.max(ONIZLEME_HEDEF_MS - sureMs, sureMs));
}
