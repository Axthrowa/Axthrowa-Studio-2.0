import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { anlikGoruntu, kirliIsaretle } from '../lib/kaydedilmemis.js';
import { geriAlHedefi, kayitEkle, yaziAlaniMi } from '../lib/geriAlma.js';
import { GERI_AL_OLAYI } from '../lib/gomuluSozlesme.js';

export type KayitDurumuTuru = 'bos' | 'bekliyor' | 'kaydediliyor' | 'kaydedildi' | 'hata';

/** Son değişiklikten sonra beklenen süre (yazarken her tuşta kaydetmesin) */
const GECIKME_MS = 700;
/** "Kaydedildi" yazısının görünme süresi */
const GORUNME_MS = 1500;

/**
 * Anlık kaydetme ve geri alma (A4). Sayfa yükleyince `taban(deger)` çağırır; sonraki her değişiklik
 * kısa bir beklemeden sonra `kaydet()` ile kaydedilir. Ctrl+Z (yazı alanı dışında) ya da Studio'dan gelen
 * `geri-al` önce kaydedilmemiş değişikliği atar, yoksa son kaydı `geriYukle` ile geri getirir (o da kaydedilir).
 * `kaydet` ekrandaki son hâli kaydeder ve başarıyı döner; hata iletisini kendisi gösterir.
 */
export function useOtoKayit<T>(deger: T, kaydet: () => Promise<boolean>, geriYukle: (v: T) => void) {
  const [kayitli, setKayitli] = useState<T | null>(null);
  const [durum, setDurum] = useState<KayitDurumuTuru>('bos');
  const [deneme, setDeneme] = useState(0);
  const yigin = useRef<T[]>([]);
  const geriAliniyor = useRef(false);
  const kimlik = useId();

  const anlik = anlikGoruntu(deger);
  const kaydedilmemis = kayitli !== null && anlik !== anlikGoruntu(kayitli);

  // Zamanlayıcı ve olay dinleyicileri hep son hâli görsün
  const son = useRef({ deger, kayitli, kaydedilmemis, kaydet, geriYukle });
  son.current = { deger, kayitli, kaydedilmemis, kaydet, geriYukle };

  const taban = useCallback((v: T) => {
    setKayitli(v);
    yigin.current = [];
  }, []);

  useEffect(() => {
    if (!kaydedilmemis) {
      setDurum((d) => (d === 'bekliyor' || d === 'hata' ? 'bos' : d));
      return;
    }
    setDurum('bekliyor');
    const zaman = window.setTimeout(async () => {
      const { kayitli: onceki, deger: simdi } = son.current;
      setDurum('kaydediliyor');
      const tamam = await son.current.kaydet().catch(() => false);
      if (!tamam) {
        setDurum('hata');
        return;
      }
      if (!geriAliniyor.current && onceki !== null) yigin.current = kayitEkle(yigin.current, onceki);
      geriAliniyor.current = false;
      setKayitli(simdi);
      setDurum('kaydedildi');
    }, GECIKME_MS);
    return () => window.clearTimeout(zaman);
  }, [anlik, kaydedilmemis, deneme]);

  useEffect(() => {
    if (durum !== 'kaydedildi') return;
    const t = window.setTimeout(() => setDurum((d) => (d === 'kaydedildi' ? 'bos' : d)), GORUNME_MS);
    return () => window.clearTimeout(t);
  }, [durum]);

  // Kaydedilemeyen değişiklik varken sayfadan ayrılmak yine sorulur
  useEffect(() => {
    kirliIsaretle(kimlik, durum === 'hata');
    return () => kirliIsaretle(kimlik, false);
  }, [kimlik, durum]);

  useEffect(() => {
    if (!kaydedilmemis) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [kaydedilmemis]);

  // Sayfadan bekleme bitmeden çıkılırsa değişiklik kaybolmasın
  useEffect(() => () => void (son.current.kaydedilmemis && son.current.kaydet().catch(() => false)), []);

  useEffect(() => {
    const geriAl = () => {
      const { kayitli: k, kaydedilmemis: km, geriYukle: yukle } = son.current;
      const h = geriAlHedefi(yigin.current, k, km);
      if (!h) return false;
      yigin.current = h.yigin;
      if (!km) geriAliniyor.current = true;
      yukle(h.hedef);
      return true;
    };
    const tus = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'z') return;
      if (e.defaultPrevented || yaziAlaniMi(document.activeElement as HTMLInputElement | null)) return;
      if (geriAl()) e.preventDefault();
    };
    const olay = () => void geriAl();
    window.addEventListener('keydown', tus);
    window.addEventListener(GERI_AL_OLAYI, olay);
    return () => {
      window.removeEventListener('keydown', tus);
      window.removeEventListener(GERI_AL_OLAYI, olay);
    };
  }, []);

  const yeniden = useCallback(() => setDeneme((d) => d + 1), []);
  return { taban, durum, yeniden };
}
