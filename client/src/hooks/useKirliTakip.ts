import { useCallback, useState } from 'react';
import { anlikGoruntu } from '../lib/kaydedilmemis.js';

/**
 * Formun kaydedilmiş hâline göre kirli mi? Sayfa yüklendiğinde ve her başarılı
 * kayıttan sonra `taban(deger)` çağrılır; o ana kadar form kirli sayılmaz
 * (yükleme sırasında "değişiklik var" şeridi yanıp sönmesin).
 */
export function useKirliTakip(deger: unknown): { kirli: boolean; taban: (kaydedilen: unknown) => void } {
  const [tabanDegeri, setTabanDegeri] = useState<string | null>(null);
  const taban = useCallback((kaydedilen: unknown) => setTabanDegeri(anlikGoruntu(kaydedilen)), []);
  return { kirli: tabanDegeri !== null && anlikGoruntu(deger) !== tabanDegeri, taban };
}
