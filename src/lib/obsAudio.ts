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
