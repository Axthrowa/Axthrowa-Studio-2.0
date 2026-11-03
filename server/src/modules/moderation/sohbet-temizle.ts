/**
 * Seçilen platformlarda sohbeti temizler (saf: platform, geçmiş ve olaylar dışarıdan verilir).
 *
 * Toplu temizleme yapılabildiyse o platformun tüm iletileri ekrandan kalkar. Yalnız tek tek silinebildiyse
 * yalnız silinenler kalkar: sınır yüzünden platformda kalanlar panelde de görünmeye devam eder.
 */
export interface SohbetTemizlemeSonucu {
  ok: boolean;
  /** komut: tüm sohbet temizlendi; tek-tek: yalnız `silinenIdler` */
  yontem?: 'komut' | 'tek-tek';
  silinenIdler?: string[];
  hata?: string;
}

export interface TemizlenenPlatform {
  isConnected?(): boolean;
  sohbetiTemizle?(silinecekler: () => string[]): Promise<SohbetTemizlemeSonucu>;
  deleteMessage?(id: string): Promise<{ ok: boolean; hata?: string }>;
}

export interface TemizlemeBaglami {
  platform(id: string): TemizlenenPlatform | undefined;
  /** Platformun sohbette duran iletileri (sistem satırları hariç) */
  kimlikler(id: string): string[];
  temizlendi(id: string): void;
  silindi(id: string, mesajId: string): void;
}

/** Tek tek silmede sınır: YouTube'da her silme kota harcar */
const TEK_TEK_EN_COK = 50;

export async function platformlardaTemizle(secilen: string[], b: TemizlemeBaglami): Promise<Record<string, unknown>> {
  const sonuclar: Record<string, unknown> = {};
  for (const id of secilen) {
    const p = b.platform(id);
    if (!p?.isConnected?.()) {
      sonuclar[id] = { ok: false, hata: 'Bağlı değil.' };
      continue;
    }
    let s: SohbetTemizlemeSonucu;
    if (p.sohbetiTemizle) {
      s = await p.sohbetiTemizle(() => b.kimlikler(id));
    } else if (p.deleteMessage) {
      const silinenIdler: string[] = [];
      let hata = '';
      for (const mesajId of b.kimlikler(id).slice(-TEK_TEK_EN_COK)) {
        const r = await p.deleteMessage(mesajId);
        if (r.ok) silinenIdler.push(mesajId);
        else hata = r.hata || 'silinemedi';
      }
      s = silinenIdler.length ? { ok: true, yontem: 'tek-tek', silinenIdler } : { ok: false, hata: hata || 'Silinecek ileti yok.' };
    } else {
      s = { ok: false, hata: 'Bu platform sohbet silmeyi desteklemiyor.' };
    }
    if (s.ok && s.yontem === 'komut') b.temizlendi(id);
    for (const mesajId of s.silinenIdler || []) b.silindi(id, mesajId);
    sonuclar[id] = {
      ok: s.ok,
      yontem: s.yontem,
      hata: s.hata,
      silinen: s.silinenIdler?.length,
      kalan: s.yontem === 'tek-tek' ? b.kimlikler(id).length : undefined
    };
  }
  return sonuclar;
}
