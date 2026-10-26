/**
 * Kendi kendine yeniden bağlanmayan platformlar (Twitch, TikTok) için bekleme kararı.
 * Kick ve Trovo kendi yeniden bağlanmalarını yürütür; onlara dokunulmaz (iki katman çakışırdı).
 *
 * İlk deneme kopuştan 1 dk sonra; her başarısızlıkta bekleme iki katına çıkar, en fazla 10 dk.
 */
export const BEKCI_PLATFORMLARI = ['twitch', 'tiktok'] as const;

export interface BekciDurumu {
  hata: number;
  sonDeneme: number;
}

export function beklemeMs(hata: number): number {
  return Math.min(10 * 60_000, 60_000 * 2 ** Math.max(0, hata));
}

export function denenmeli(d: BekciDurumu | undefined, simdi: number): boolean {
  if (!d) return true;
  return simdi - d.sonDeneme >= beklemeMs(d.hata);
}
