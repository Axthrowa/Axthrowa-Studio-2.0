/**
 * AxBoT — tasarım sistemi
 * Developed by AxthrowA
 *
 * Denetimde bulundu (CURRENT_SYSTEM_AUDIT §15): ortak bileşen yoktu, her
 * sayfa kendi Tailwind sınıflarını tekrarlıyordu — `bg-purple-600
 * hover:bg-purple-500` deseni **47 farklı yerde** elle yazılmıştı. Toast
 * bildirimi, onay diyaloğu ve alan seviyesinde form hatası hiç yoktu;
 * silme işlemleri doğrudan yapılıyordu.
 *
 * Kural: aynı işi yapan ikinci bir bileşen yazılmaz. Mevcut sayfalar
 * kademeli taşınır — tek seferde 2.500 satırlık sayfa yeniden yazılmaz.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { kirliIsaretle } from '../lib/kaydedilmemis.js';
import type { KayitDurumuTuru } from '../hooks/useOtoKayit.js';

// ---- Buton -----------------------------------------------------------------

type ButonTonu = 'birincil' | 'ikincil' | 'tehlike' | 'sade';

// UI-1: görünüm ortak/tasarim.css içindeki 4 düğme türünden gelir (Studio ve Resonance ile aynı)
const TON: Record<ButonTonu, string> = {
  birincil: 'axt-dugme-birincil',
  ikincil: 'axt-dugme-ikincil',
  tehlike: 'axt-dugme-tehlike',
  sade: 'axt-dugme-sessiz'
};

export function Buton({
  ton = 'birincil',
  ikon,
  children,
  className = '',
  ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { ton?: ButonTonu; ikon?: ReactNode }) {
  return (
    <button
      {...p}
      className={`axt-dugme ${TON[ton]} ${className}`}
    >
      {ikon}
      {children}
    </button>
  );
}

// ---- Form alanı ------------------------------------------------------------

export function Alan({
  etiket,
  ipucu,
  hata,
  children
}: {
  etiket: string;
  ipucu?: string;
  hata?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] font-bold text-gray-300 mb-1">{etiket}</span>
      {children}
      {/* Hata alan SEVİYESİNDE gösterilir — eskiden hiç gösterilmiyordu */}
      {hata ? (
        <span className="block text-[10px] text-red-400 mt-1">{hata}</span>
      ) : ipucu ? (
        <span className="block text-[10px] text-gray-500 mt-1">{ipucu}</span>
      ) : null}
    </label>
  );
}

const GIRDI_SINIF =
  'w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 transition-colors';

export function Girdi({ hataVar, className = '', ...p }: React.InputHTMLAttributes<HTMLInputElement> & { hataVar?: boolean }) {
  return <input {...p} className={`${GIRDI_SINIF} ${hataVar ? 'border-red-500/60' : ''} ${className}`} />;
}

export function AlanMetni({ className = '', ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${GIRDI_SINIF} min-h-[70px] ${className}`} />;
}

export function Secim({
  secenekler,
  className = '',
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement> & { secenekler: Array<{ value: string; label: string }> }) {
  return (
    <select {...p} className={`${GIRDI_SINIF} ${className}`}>
      {secenekler.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Anahtar({
  acik,
  onChange,
  etiket,
  ad
}: {
  acik: boolean;
  onChange: (v: boolean) => void;
  etiket?: string;
  /** Görünür etiketi olmayan anahtarın ekran okuyucu adı */
  ad?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={acik}
      aria-label={etiket ? undefined : ad}
      onClick={() => onChange(!acik)}
      className="inline-flex items-center gap-2 group"
    >
      <span
        className={`w-9 h-5 rounded-full transition-colors relative ${acik ? 'bg-emerald-500' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${acik ? 'left-[18px]' : 'left-0.5'}`}
        />
      </span>
      {etiket && <span className="text-[11px] font-bold text-gray-300 group-hover:text-white">{etiket}</span>}
    </button>
  );
}

// ---- Kart ve durumlar ------------------------------------------------------

/** Açılır ayar grubu. Tarayıcının kendi `details` öğesi: klavye ve ekran okuyucu hazır gelir. */
export function Katlanir({
  baslik,
  aciklama,
  sayi,
  acik = false,
  children
}: {
  baslik: string;
  aciklama?: string;
  sayi?: number;
  acik?: boolean;
  children: ReactNode;
}) {
  // Yalnız ilk açılışta geçerli: içindeki alan değişince grup kullanıcının elinde kapanmasın
  const [ilkAcik] = useState(acik);
  return (
    <details open={ilkAcik} className="group rounded-xl border border-white/10 bg-black/20">
      <summary className="flex items-center gap-2 cursor-pointer select-none px-3 py-2.5 list-none [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-[10px] text-gray-400 transition-transform group-open:rotate-90">▶</span>
        <span className="text-xs font-bold text-white">{baslik}</span>
        {sayi !== undefined && <span className="text-[10px] text-gray-500">{sayi}</span>}
        {aciklama && <span className="ml-auto pl-3 text-[10px] text-gray-500 truncate">{aciklama}</span>}
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-3">{children}</div>
    </details>
  );
}

export function Kart({
  baslik,
  aciklama,
  sag,
  children,
  className = ''
}: {
  baslik?: string;
  aciklama?: string;
  sag?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-black/30 border border-white/10 rounded-2xl p-4 space-y-3 ${className}`}>
      {(baslik || sag) && (
        <header className="flex items-start justify-between gap-3 pb-2 border-b border-white/10">
          <div>
            {baslik && <h3 className="text-sm font-extrabold text-white">{baslik}</h3>}
            {aciklama && <p className="text-[11px] text-gray-400 mt-0.5">{aciklama}</p>}
          </div>
          {sag}
        </header>
      )}
      {children}
    </section>
  );
}

export function BosDurum({ baslik, aciklama, eylem }: { baslik: string; aciklama?: string; eylem?: ReactNode }) {
  return (
    <div className="text-center py-8 px-4">
      <p className="text-sm font-bold text-gray-300">{baslik}</p>
      {aciklama && <p className="text-[11px] text-gray-500 mt-1">{aciklama}</p>}
      {eylem && <div className="mt-3 inline-block">{eylem}</div>}
    </div>
  );
}

export function HataDurumu({ mesaj, yenidenDene }: { mesaj: string; yenidenDene?: () => void }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
      <span className="text-[11px] text-red-200">{mesaj}</span>
      {yenidenDene && (
        <Buton ton="ikincil" onClick={yenidenDene}>
          Yeniden dene
        </Buton>
      )}
    </div>
  );
}

export function Iskelet({ satir = 3 }: { satir?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: satir }).map((_, i) => (
        <div key={i} className="h-8 bg-white/5 rounded-lg" />
      ))}
    </div>
  );
}

// ---- Toast -----------------------------------------------------------------

type ToastTuru = 'bilgi' | 'basari' | 'uyari' | 'hata';
/** Bildirim standardı (Studio ile aynı, A5): bilgi 4 sn, uyarı 8 sn, hata kapatılana kadar durur */
export const TOAST_SURESI: Record<ToastTuru, number | null> = { bilgi: 4000, basari: 4000, uyari: 8000, hata: null };
interface Toast {
  id: number;
  tur: ToastTuru;
  metin: string;
}

const ToastBaglam = createContext<{ toast: (metin: string, tur?: ToastTuru) => void }>({
  toast: () => {}
});

export function useToast() {
  return useContext(ToastBaglam).toast;
}

const TOAST_RENK: Record<ToastTuru, string> = {
  bilgi: 'bg-slate-800 border-white/15 text-gray-100',
  basari: 'bg-emerald-600/90 border-emerald-400/40 text-white',
  uyari: 'bg-amber-600/90 border-amber-400/40 text-white',
  hata: 'bg-red-600/90 border-red-400/40 text-white'
};

export function ToastSaglayici({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Toast[]>([]);

  const kapat = useCallback((id: number) => setListe((p) => p.filter((t) => t.id !== id)), []);
  const toast = useCallback((metin: string, tur: ToastTuru = 'bilgi') => {
    const id = Date.now() + Math.random();
    // Aynı açık bildirim çoğalmaz
    setListe((p) => (p.some((t) => t.metin === metin && t.tur === tur) ? p : [...p.slice(-4), { id, tur, metin }]));
    const sure = TOAST_SURESI[tur];
    if (sure !== null) setTimeout(() => kapat(id), sure);
  }, [kapat]);

  const deger = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastBaglam.Provider value={deger}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 right-4 z-[9999] space-y-2 pointer-events-none">
        {liste.map((t) => (
          <div
            key={t.id}
            role={t.tur === 'hata' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-2.5 rounded-xl border shadow-2xl text-xs font-bold max-w-sm animate-fadeIn ${TOAST_RENK[t.tur]}`}
          >
            <span className="flex-1">{t.metin}</span>
            {TOAST_SURESI[t.tur] === null && (
              <button type="button" aria-label="Kapat" onClick={() => kapat(t.id)} className="-mr-1 px-1 opacity-80 hover:opacity-100">
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastBaglam.Provider>
  );
}

// ---- Onay diyaloğu ---------------------------------------------------------

export function OnayDiyalogu({
  acik,
  baslik,
  mesaj,
  onayMetni = 'Evet, devam et',
  tehlikeli = false,
  onOnay,
  onIptal
}: {
  acik: boolean;
  baslik: string;
  mesaj: string;
  onayMetni?: string;
  tehlikeli?: boolean;
  onOnay: () => void;
  onIptal: () => void;
}) {
  // Escape ile kapanabilmeli
  useEffect(() => {
    if (!acik) return;
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onIptal();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [acik, onIptal]);

  if (!acik) return null;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#14161f] border border-white/15 rounded-2xl max-w-sm w-full p-5 space-y-3 shadow-2xl">
        <h3 className="text-base font-extrabold text-white">{baslik}</h3>
        <p className="text-xs text-gray-300 leading-relaxed">{mesaj}</p>
        <div className="flex justify-end gap-2 pt-1">
          <Buton ton="ikincil" onClick={onIptal}>
            Vazgeç
          </Buton>
          <Buton ton={tehlikeli ? 'tehlike' : 'birincil'} onClick={onOnay}>
            {onayMetni}
          </Buton>
        </div>
      </div>
    </div>
  );
}

/** Onay diyaloğunu tek satırda kullanmak için. */
export function useOnay() {
  const [durum, setDurum] = useState<{
    acik: boolean;
    baslik: string;
    mesaj: string;
    tehlikeli: boolean;
    is: () => void;
  }>({ acik: false, baslik: '', mesaj: '', tehlikeli: false, is: () => {} });

  const sor = useCallback((baslik: string, mesaj: string, is: () => void, tehlikeli = true) => {
    setDurum({ acik: true, baslik, mesaj, tehlikeli, is });
  }, []);

  const eleman = (
    <OnayDiyalogu
      acik={durum.acik}
      baslik={durum.baslik}
      mesaj={durum.mesaj}
      tehlikeli={durum.tehlikeli}
      onIptal={() => setDurum((d) => ({ ...d, acik: false }))}
      onOnay={() => {
        durum.is();
        setDurum((d) => ({ ...d, acik: false }));
      }}
    />
  );

  return { sor, eleman };
}

// ---- Anlık kayıt durumu (A4) ------------------------------------------------

/** Kaydet düğmesinin yerini alır: değişiklikler anında kaydedilir, burada yalnız durum görünür. */
export function KayitDurumu({ durum, onYeniden }: { durum: KayitDurumuTuru; onYeniden?: () => void }) {
  const metin =
    durum === 'bekliyor' || durum === 'kaydediliyor'
      ? 'Kaydediliyor…'
      : durum === 'kaydedildi'
        ? 'Kaydedildi'
        : durum === 'hata'
          ? 'Kaydedilemedi'
          : 'Değişiklikler anında kaydedilir · Ctrl+Z geri alır';
  const renk = durum === 'kaydedildi' ? 'text-emerald-400' : durum === 'hata' ? 'text-red-400' : 'text-gray-500';
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-[11px] font-bold ${renk}`}>
      {metin}
      {durum === 'hata' && onYeniden && (
        <Buton ton="ikincil" onClick={onYeniden}>
          Yeniden dene
        </Buton>
      )}
    </span>
  );
}

// ---- Kaydedilmemiş değişiklik uyarısı --------------------------------------

/**
 * Kaydedilmemiş değişiklik varken kalıcı şerit gösterir; sekme değişiminde
 * (App → gecisOnayla) ve sayfa kapanırken/yenilenirken sorar.
 */
export function KaydedilmemisUyari({ varMi, onKaydet }: { varMi: boolean; onKaydet?: () => void }) {
  const kimlik = useId();
  useEffect(() => {
    kirliIsaretle(kimlik, varMi);
    return () => kirliIsaretle(kimlik, false);
  }, [kimlik, varMi]);

  useEffect(() => {
    if (!varMi) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', f);
    return () => window.removeEventListener('beforeunload', f);
  }, [varMi]);

  if (!varMi) return null;

  return (
    <div className="sticky top-2 z-40 bg-amber-500/15 border border-amber-500/40 rounded-xl px-3 py-2 flex items-center justify-between gap-3">
      <span className="text-[11px] font-bold text-amber-200">Kaydedilmemiş değişiklikleriniz var.</span>
      {onKaydet && (
        <Buton ton="birincil" onClick={onKaydet}>
          Kaydet
        </Buton>
      )}
    </div>
  );
}

/** Ana kontrol ekranının mekanik tuşu: basınca fiziksel olarak içeri girer */
export const DONANIM_TUSU =
  'rounded-md border border-zinc-800 bg-zinc-900 text-zinc-200 transition-all hover:bg-zinc-800 active:scale-[0.97] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-400';

/** Ana kontrol ekranının bento modülü */
export function Modul({
  etiket,
  sag,
  className = '',
  children
}: {
  etiket: string;
  sag?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={etiket} className={`rounded-md border border-zinc-800 bg-zinc-900/50 p-3 ${className}`}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{etiket}</h2>
        {sag}
      </header>
      {children}
    </section>
  );
}
