/**
 * Veritabanı dosyası yeniden adlandırıldı. Eski sürümün dosyası (ve WAL/SHM eşleri) ilk açılışta yeni ada taşınır.
 * Önce WAL/SHM, sonra ana dosya: yarıda kesilirse sonraki açılış ana dosyayı taşıyıp eşleşmeyi tamamlar.
 */
import fs from 'fs';
import path from 'path';

export const VERITABANI_DOSYASI = 'axbot.sqlite';
const ESKI_DOSYA = 'streamaxt.sqlite';

export function eskiVeritabaniniTasi(klasor: string): boolean {
  const yeni = path.join(klasor, VERITABANI_DOSYASI);
  const eski = path.join(klasor, ESKI_DOSYA);
  if (fs.existsSync(yeni) || !fs.existsSync(eski)) return false;
  for (const ek of ['-wal', '-shm']) {
    if (fs.existsSync(eski + ek) && !fs.existsSync(yeni + ek)) fs.renameSync(eski + ek, yeni + ek);
  }
  fs.renameSync(eski, yeni);
  return true;
}
