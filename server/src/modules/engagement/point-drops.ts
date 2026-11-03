/**
 * AxBoT — Puan Düşüşleri (Point Drops)
 * Developed by AxthrowA
 *
 * BotRix belgelerinde `!pdrops start / stop / status` komutları var ve
 * "genel talep komutu ayarların içinde ayrıca yapılandırılır" deniyor
 * (BOTRIX_UI_INVENTORY §13.1). Panelde bu bölüm bulunamadı, bu yüzden
 * ayar yüzeyi `UNVERIFIED`; davranış belgelenen komutlardan türetildi.
 *
 * Nasıl çalışır: yayıncı bir "düşüş" başlatır, sohbete anahtar kelime
 * yazan ilk N kişi puanı paylaşır. Amaç izleyiciyi ekran başında tutmak.
 */
import { db } from '../../db/index.js';
import { degisinceBildir, durumYayinci } from '../../core/state-push.js';
import { economy } from '../economy/economy.js';

export * from './drop-math.js';
import { kisiBasiPuan, VARSAYILAN_DUSUS, type DususAyarlari, type DususDurumu } from './drop-math.js';
import { seyrekUyar } from '../../core/logger.js';

const AYAR_ANAHTARI = 'point_drop_settings';

class DususMotoru {
  private aktif = false;
  private bitisAni = 0;
  private katilanlar = new Set<string>();
  private gorunenAdlar = new Map<string, string>();
  private zaman: NodeJS.Timeout | null = null;
  private bitince: ((sonuc: { katilan: number; kisiBasi: number; anahtar: string }) => void) | null = null;

  ayarOku(): DususAyarlari {
    try {
      const r = db.prepare('SELECT value FROM bot_settings WHERE key = ?').get(AYAR_ANAHTARI) as
        | { value: string }
        | undefined;
      if (r?.value) return { ...VARSAYILAN_DUSUS, ...JSON.parse(r.value) };
    } catch {
      /* bozuk JSON */
    }
    return { ...VARSAYILAN_DUSUS };
  }

  ayarYaz(yeni: Partial<DususAyarlari>): DususAyarlari {
    const birlesik = { ...this.ayarOku(), ...yeni };
    db.prepare(
      'INSERT INTO bot_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ).run(AYAR_ANAHTARI, JSON.stringify(birlesik));
    return birlesik;
  }

  bitisiDinle(fn: (sonuc: { katilan: number; kisiBasi: number; anahtar: string }) => void) {
    this.bitince = fn;
  }

  durum(): DususDurumu {
    const ayar = this.ayarOku();
    return {
      aktif: this.aktif,
      anahtar: ayar.anahtar,
      bitisAni: this.bitisAni,
      katilanlar: [...this.katilanlar].map((k) => this.gorunenAdlar.get(k) || k),
      kalanSaniye: this.aktif ? Math.max(0, Math.round((this.bitisAni - Date.now()) / 1000)) : 0,
      ayar
    };
  }

  baslat(): { ok: boolean; hata?: string; durum?: DususDurumu } {
    if (this.aktif) return { ok: false, hata: 'Zaten açık bir puan düşüşü var.' };
    const ayar = this.ayarOku();
    if (ayar.toplamPuan <= 0) return { ok: false, hata: 'Dağıtılacak puan sıfır.' };

    this.aktif = true;
    this.katilanlar.clear();
    this.gorunenAdlar.clear();
    this.bitisAni = Date.now() + Math.max(5, ayar.sureSn) * 1000;

    if (this.zaman) clearTimeout(this.zaman);
    this.zaman = setTimeout(() => this.bitir(), Math.max(5, ayar.sureSn) * 1000);

    return { ok: true, durum: this.durum() };
  }

  /** Sohbetten katılma. Anahtar kelime eşleşmezse yok sayılır. */
  katil(kullanici: string, gorunenAd: string, metin: string): boolean {
    if (!this.aktif) return false;
    const ayar = this.ayarOku();
    if (String(metin || '').trim().toLowerCase() !== ayar.anahtar.toLowerCase()) return false;

    const ad = String(kullanici || '').toLowerCase();
    if (!ad || this.katilanlar.has(ad)) return false;
    if (ayar.maksKisi > 0 && this.katilanlar.size >= ayar.maksKisi) return false;

    this.katilanlar.add(ad);
    this.gorunenAdlar.set(ad, gorunenAd || kullanici);

    // Kontenjan dolduysa beklemeden bitir
    if (ayar.maksKisi > 0 && this.katilanlar.size >= ayar.maksKisi) this.bitir();
    return true;
  }

  bitir(): { katilan: number; kisiBasi: number; anahtar: string } {
    if (this.zaman) {
      clearTimeout(this.zaman);
      this.zaman = null;
    }
    const ayar = this.ayarOku();
    const katilan = this.katilanlar.size;
    const kisiBasi = kisiBasiPuan(ayar, katilan);

    for (const k of this.katilanlar) {
      if (kisiBasi > 0) economy.addPoints(k, kisiBasi);
    }

    this.aktif = false;
    this.bitisAni = 0;
    const sonuc = { katilan, kisiBasi, anahtar: ayar.anahtar };
    this.katilanlar.clear();

    try {
      this.bitince?.(sonuc);
    } catch (e) {
      /* dinleyici hatası düşüşü bozmasın — ama sessiz de kalmasın */
      seyrekUyar('puan-dususu:bitince', '[Puan düşüşü] Bitiş dinleyicisi hata verdi', e);
    }
    return sonuc;
  }

  durdur(): { iptal: boolean } {
    if (!this.aktif) return { iptal: false };
    if (this.zaman) clearTimeout(this.zaman);
    this.zaman = null;
    this.aktif = false;
    this.katilanlar.clear();
    return { iptal: true };
  }
}

export const puanDususu = new DususMotoru();

degisinceBildir(
  puanDususu,
  ['baslat', 'katil', 'bitir', 'durdur', 'ayarYaz'],
  durumYayinci('dusus_durumu', () => puanDususu.durum())
);
export default puanDususu;
