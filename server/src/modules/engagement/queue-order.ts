/**
 * AxBoT — kuyruk sıralaması (saf)
 * Developed by AxthrowA
 */

export interface KuyrukKaydi {
  kullanici: string;
  gorunenAd: string;
  platform: string;
  katilma: number;
  /** Öncelikli (abone/VIP) sıraya önden girer. */
  oncelikli: boolean;
}

export interface KuyrukAyarlari {
  acik: boolean;
  /** 0 = sınırsız. */
  maksKisi: number;
  /** Abone ve VIP öne alınsın mı? */
  oncelikVar: boolean;
  /** Yalnız aboneler girebilsin. */
  soloAbone: boolean;
  /** Moderatörler kuyruğu yönetebilsin. */
  modYonetir: boolean;
}

export const VARSAYILAN_KUYRUK: KuyrukAyarlari = {
  acik: false,
  maksKisi: 0,
  oncelikVar: true,
  soloAbone: false,
  modYonetir: true
};

/**
 * Sıralama: önce öncelikliler (katılma sırasına göre), sonra ötekiler.
 * Böylece abone öne geçer ama kendi aralarında adalet korunur.
 */
export function sirala(kayitlar: KuyrukKaydi[], oncelikVar: boolean): KuyrukKaydi[] {
  const k = [...kayitlar];
  if (!oncelikVar) return k.sort((a, b) => a.katilma - b.katilma);
  return k.sort((a, b) => {
    if (a.oncelikli !== b.oncelikli) return a.oncelikli ? -1 : 1;
    return a.katilma - b.katilma;
  });
}

