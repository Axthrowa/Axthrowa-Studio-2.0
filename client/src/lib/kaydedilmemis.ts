/**
 * AxBoT — kaydedilmemiş değişiklik kaydı
 * Developed by AxthrowA
 *
 * Panel tek sayfalık bir uygulama: kenar çubuğundan sekme değiştirmek
 * `beforeunload` tetiklemez, yani yalnız tarayıcı uyarısı yetmez. Açık bir
 * formu kirli olan her bileşen burada kayıtlıdır; sekme geçişi (App) önce sorar.
 */

const kirliKaynaklar = new Set<string>();

export function kirliIsaretle(kimlik: string, kirli: boolean): void {
  if (kirli) kirliKaynaklar.add(kimlik);
  else kirliKaynaklar.delete(kimlik);
}

export function kaydedilmemisVar(): boolean {
  return kirliKaynaklar.size > 0;
}

export const AYRILMA_SORUSU = 'Kaydedilmemiş değişiklikleriniz var. Kaydetmeden ayrılırsanız kaybolur. Yine de ayrılmak istiyor musunuz?';

/** Kullanıcı kaydetmeden ayrılmayı onayladı: sayfa kapanacak, değişiklikler atılır. */
export function kirlileriBirak(): void {
  kirliKaynaklar.clear();
}

/** Karşılaştırma için kararlı anlık görüntü (anahtar sırası farkı kirlilik sayılmaz). */
export function anlikGoruntu(deger: unknown): string {
  return JSON.stringify(deger, (_k, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}
