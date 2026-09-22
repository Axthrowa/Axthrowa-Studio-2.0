/**
 * StreamAxT — puan düşüşü hesapları (saf)
 * Developed by AxthrowA
 */

export interface DususAyarlari {
  /** Sohbete yazılacak kelime. */
  anahtar: string;
  /** Dağıtılacak toplam puan. */
  toplamPuan: number;
  /** En fazla kaç kişi alabilir. 0 = sınırsız (puan bölüşülür). */
  maksKisi: number;
  /** Düşüş kaç saniye açık kalır. */
  sureSn: number;
  /** Moderatörler başlatabilsin mi? */
  modBaslatabilir: boolean;
  /** Her katılana sabit puan mı, havuz bölüşümü mü? */
  paylasim: 'sabit' | 'bolusum';
}

export const VARSAYILAN_DUSUS: DususAyarlari = {
  anahtar: '!kap',
  toplamPuan: 1000,
  maksKisi: 20,
  sureSn: 60,
  modBaslatabilir: true,
  paylasim: 'bolusum'
};

export interface DususDurumu {
  aktif: boolean;
  anahtar: string;
  bitisAni: number;
  katilanlar: string[];
  kalanSaniye: number;
  ayar: DususAyarlari;
}

/**
 * Kişi başına düşen puan.
 * `sabit`: herkese `toplamPuan / maksKisi` (maksKisi 0 ise toplam)
 * `bolusum`: katılan sayısına bölünür — az katılan çok kazanır
 */
export function kisiBasiPuan(ayar: DususAyarlari, katilanSayisi: number): number {
  const toplam = Math.max(0, Number(ayar.toplamPuan) || 0);
  if (katilanSayisi <= 0) return 0;
  if (ayar.paylasim === 'sabit') {
    const bolen = ayar.maksKisi > 0 ? ayar.maksKisi : katilanSayisi;
    return Math.floor(toplam / Math.max(1, bolen));
  }
  return Math.floor(toplam / katilanSayisi);
}

