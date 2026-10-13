/**
 * StreamAxT — Sesli komutlar: bas-konuş kapısı ve sayfalar arası kanal (saf, birim testli)
 * Developed by AxthrowA
 */

export type DinlemeKipi = 'uyandirma' | 'bas_konus' | 'ikisi';

/** Tuş bırakıldıktan sonra sesin akmaya devam ettiği süre (cümlenin sonu kesilmesin) */
export const KUYRUK_MS = 600;
/** Tanıyıcı sonucu tuş bırakıldıktan biraz sonra verir; bu süre içindeki sonuç bas-konuş sayılır */
export const SONUC_PAYI_MS = 2500;

/**
 * Bas-konuş tuşu durumu. Tuş basılıyken söylenen cümle uyandırma sözcüğü gerektirmez; `bas_konus` kipinde
 * tuş basılı değilken ses tanıyıcıya hiç gitmez (yanlış tetiklenme ve gereksiz işlem olmasın).
 */
export class BasKonusKapisi {
  basili = false;
  private basma = 0;
  private birakma = -Infinity;

  bas(simdi = Date.now()) {
    if (!this.basili) this.basma = simdi;
    this.basili = true;
  }

  birak(simdi = Date.now()) {
    if (this.basili) this.birakma = simdi;
    this.basili = false;
  }

  /** Bu ses parçası tanıyıcıya gönderilsin mi? */
  sesGecsin(kip: DinlemeKipi, simdi = Date.now()): boolean {
    if (kip !== 'bas_konus') return true;
    return this.basili || simdi - this.birakma < KUYRUK_MS;
  }

  /** Şimdi gelen sonuç bas-konuşla mı söylendi? (tuş basılı ya da az önce bırakıldı) */
  basKonusMu(simdi = Date.now()): boolean {
    return this.basili || (simdi - this.birakma < SONUC_PAYI_MS && this.birakma >= this.basma);
  }
}

/** Dinleyici durumunu panelin her sekmesine/penceresine yayan kanal (aynı köken) */
export const KANAL_ADI = 'streamaxt-sesli';
/** Mikrofonu aynı anda tek dinleyici tutsun (Web Locks) */
export const KILIT_ADI = 'streamaxt-sesli-dinleyici';

export type DinleyiciDurumu = 'kapali' | 'model-yok' | 'yukleniyor' | 'dinliyor' | 'hata' | 'baska-pencerede';

export type KanalMesaji =
  | { tur: 'durum'; durum: DinleyiciDurumu; mesaj?: string; seviye?: number; basili?: boolean }
  | { tur: 'kismi'; metin: string }
  | { tur: 'sonuc'; metin: string; basKonus: boolean; yanit?: { ok: boolean; mesaj: string } }
  | { tur: 'ptt'; basili: boolean }
  | { tur: 'durum-sor' };

/** Üst pencereden (panel / YYA) gelen bas-konuş iletisinin biçimi */
export function pttIletisi(veri: unknown): boolean | null {
  if (!veri || typeof veri !== 'object') return null;
  const v = veri as Record<string, unknown>;
  if (v.tur !== 'sesli-ptt' || typeof v.basili !== 'boolean') return null;
  return v.basili;
}

/** RMS → 0..1 seviye (ölçer için, -60..0 dBFS) */
export function seviye(ornekler: Float32Array): number {
  if (!ornekler.length) return 0;
  let t = 0;
  for (let i = 0; i < ornekler.length; i++) t += ornekler[i] * ornekler[i];
  const rms = Math.sqrt(t / ornekler.length);
  const db = 20 * Math.log10(Math.max(rms, 1e-6));
  return Math.min(1, Math.max(0, (db + 60) / 60));
}
