/**
 * Bildirim standardı (A5). Bütün bildirimler buradan geçer:
 * - Bilgi 4 sn, uyarı 8 sn görünür; hata kapatılana kadar köşede durur.
 * - Hepsi oturum boyunca bildirim merkezinde (üst şeritteki zil) saklanır.
 * - Ekranın ortasında pencere açılmaz; yayın akışı bölünmez.
 * Görünüm: components/ui/Bildirim.tsx.
 */
import { useSyncExternalStore } from "react";
import { formatAppError, isErrorLike } from "./appAlert";

export type BildirimTuru = "bilgi" | "uyari" | "hata";

export type Bildirim = {
  id: number;
  tur: BildirimTuru;
  metin: string;
  baslik?: string;
  ipucu?: string;
  zaman: number;
  /** Köşede görünüyor mu (kapanınca yalnız merkezde kalır) */
  acik: boolean;
  okundu: boolean;
};

/** Görünme süresi; `null` kapatılana kadar */
export const BILDIRIM_SURESI: Record<BildirimTuru, number | null> = { bilgi: 4000, uyari: 8000, hata: null };
/** Oturum geçmişinin üst sınırı (en eskiler düşer) */
export const GECMIS_SINIRI = 200;

type Durum = { liste: Bildirim[] };
let durum: Durum = { liste: [] };
let sonId = 0;
const dinleyiciler = new Set<() => void>();
const zamanlayicilar = new Map<number, ReturnType<typeof setTimeout>>();

function yay(yeni: Bildirim[]) {
  durum = { liste: yeni };
  for (const f of dinleyiciler) f();
}

/** Tür verilmezse metinden çıkarılır (eski `showToast(metin)` çağrıları için) */
export function turTahmini(metin: string): BildirimTuru {
  return isErrorLike(metin) ? "hata" : "bilgi";
}

/**
 * Bildirim gösterir. Aynı metin köşede zaten açıksa yenisi eklenmez, süresi baştan başlar.
 * Döner: bildirimin kimliği (boş metinde `null`).
 */
export function bildir(metin: string, tur?: BildirimTuru, ek?: { baslik?: string; ipucu?: string }): number | null {
  const ham = String(metin ?? "").trim();
  if (!ham) return null;
  const t = tur ?? turTahmini(ham);
  const yazi = t === "hata" ? formatAppError(ham) : ham;
  const ayni = durum.liste.find((b) => b.acik && b.tur === t && b.metin === yazi && b.ipucu === ek?.ipucu);
  const id = ayni?.id ?? ++sonId;
  if (!ayni) {
    const b: Bildirim = { id, tur: t, metin: yazi, baslik: ek?.baslik, ipucu: ek?.ipucu, zaman: Date.now(), acik: true, okundu: false };
    yay([...durum.liste, b].slice(-GECMIS_SINIRI));
  }
  const sure = BILDIRIM_SURESI[t];
  if (sure !== null) {
    clearTimeout(zamanlayicilar.get(id));
    zamanlayicilar.set(id, setTimeout(() => kapat(id), sure));
  }
  return id;
}

/** Köşeden kaldırır; merkezde kalır */
export function kapat(id: number) {
  clearTimeout(zamanlayicilar.get(id));
  zamanlayicilar.delete(id);
  if (!durum.liste.some((b) => b.id === id && b.acik)) return;
  yay(durum.liste.map((b) => (b.id === id ? { ...b, acik: false } : b)));
}

/** Merkez açılınca hepsi okunmuş sayılır */
export function hepsiniOku() {
  if (durum.liste.every((b) => b.okundu)) return;
  yay(durum.liste.map((b) => (b.okundu ? b : { ...b, okundu: true })));
}

/** Oturum geçmişini siler (köşedeki açık hatalar dahil) */
export function gecmisiTemizle() {
  for (const t of zamanlayicilar.values()) clearTimeout(t);
  zamanlayicilar.clear();
  yay([]);
}

export function bildirimleriAl(): Bildirim[] {
  return durum.liste;
}

function abone(f: () => void) {
  dinleyiciler.add(f);
  return () => {
    dinleyiciler.delete(f);
  };
}

export function useBildirimler(): Bildirim[] {
  return useSyncExternalStore(abone, bildirimleriAl, bildirimleriAl);
}
