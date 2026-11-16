/**
 * Bağlı Kick kanalının takipçi sayısı (kick.com'un herkese açık kanal bilgisinden).
 * Etiket widget'ı birkaç saniyede bir sorduğu için 60 sn önbellek; hata olursa son değer.
 * Eşzamanlı istekler tek ağ çağrısını paylaşır.
 */
import { db } from '../../db/index.js';
import { kickPlatform } from '../../platforms/kick.js';
import { seyrekUyar } from '../../core/logger.js';

const durum: { deger: number | null; an: number; bekleyen: Promise<void> | null } = { deger: null, an: 0, bekleyen: null };

export async function takipciSayisi(taze = false): Promise<number | null> {
  if (!taze && durum.an !== 0 && Date.now() - durum.an < 60_000) return durum.deger;
  if (taze) {
    durum.an = 0;
    durum.bekleyen = null;
  }
  durum.bekleyen ??= (async () => {
    try {
      const kanal = db.prepare("SELECT channel_name FROM channels WHERE platform = 'kick' AND is_active = 1").get() as
        | { channel_name?: string }
        | undefined;
      if (!kanal?.channel_name) {
        durum.deger = null;
        return;
      }
      const v: any = await kickPlatform.verifyChannel(kanal.channel_name);
      const n = Number(v?.followersCount);
      if (Number.isFinite(n) && n > 0) durum.deger = n;
    } catch (e) {
      seyrekUyar('etiket:takipci', '[Etiketler] Takipçi sayısı alınamadı', e);
    } finally {
      durum.an = Date.now();
      durum.bekleyen = null;
    }
  })();
  // Eski değer varken beklenmez (yenileme arka planda): kick.com yavaşsa etiket isteği
  // dakikada bir 6 sn'ye kadar takılıyordu. Yalnız ilk istek sonucu bekler.
  if (taze || durum.an === 0) await durum.bekleyen;
  return durum.deger;
}
