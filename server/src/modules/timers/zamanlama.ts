/**
 * AxBoT — zamanlayıcı kararları (saf; testli)
 * Developed by AxthrowA
 *
 * Eski sürümdeki hatalar:
 *  • Tüm zamanlayıcılar TEK sohbet satırı sayacını paylaşıyordu; biri mesaj
 *    atınca sayacı sıfırlıyor, diğerlerinin "en az N satır" şartı dolmuyordu.
 *  • Süre dolduğunda satır yetersizse tur atlanıyor ve bir TAM süre daha
 *    bekleniyordu (15 dk'lık zamanlayıcı 30–45 dk sonra yazıyordu).
 *  • Botun kendi mesajları da satır sayılıyordu.
 * Artık her zamanlayıcının kendi sayacı var; süre dolunca satır şartı
 * sağlandığı ANDA gönderilir.
 */

export interface ZamanlayiciKaydi {
  id: string;
  aralikDk: number;
  minSatir: number;
  yalnizYayinda: boolean;
}

export interface ZamanlayiciDurumu {
  /** Son gönderim (ya da başlangıç) zamanı */
  son: number;
  /** Son gönderimden beri gelen izleyici satırı */
  satir: number;
  /** Sıradaki mesaj */
  sira: number;
}

/** Ayardan güvenli süre: 1–1440 dk (NaN/negatif/çok büyük değer seli olmasın). */
export function aralikMs(aralikDk: unknown): number {
  const n = Math.floor(Number(aralikDk));
  return (Number.isFinite(n) ? Math.min(1440, Math.max(1, n)) : 15) * 60_000;
}

export function minSatir(deger: unknown): number {
  const n = Math.floor(Number(deger));
  return Number.isFinite(n) ? Math.min(1000, Math.max(0, n)) : 5;
}

/** Bu zamanlayıcı şimdi mesaj atmalı mı? `canli` null = bilinmiyor (engellemez). */
export function gonderilmeli(k: ZamanlayiciKaydi, d: ZamanlayiciDurumu, simdi: number, canli: boolean | null): boolean {
  if (k.yalnizYayinda && canli === false) return false;
  return simdi - d.son >= aralikMs(k.aralikDk) && d.satir >= minSatir(k.minSatir);
}

/**
 * Açılışta başlangıç zamanı: son gönderim yakınsa ondan devam edilir (yeniden
 * başlatma sırayı bozmaz), eskiyse şimdiden bir tam süre beklenir.
 */
export function baslangicZamani(sonCalisma: number | null | undefined, aralikDk: unknown, simdi: number): number {
  const s = Number(sonCalisma) || 0;
  return s > 0 && simdi - s < aralikMs(aralikDk) ? s : simdi;
}

/** Mesaj listesi: JSON dizi ya da düz metin; boşlar atılır, en çok 50. */
export function mesajlariAyikla(ham: unknown): string[] {
  let liste: unknown[] = [];
  if (Array.isArray(ham)) liste = ham;
  else {
    try {
      const j = JSON.parse(String(ham ?? ''));
      liste = Array.isArray(j) ? j : [j];
    } catch {
      liste = [ham];
    }
  }
  return liste
    .map((m) => String(m ?? '').trim())
    .filter(Boolean)
    .map((m) => m.slice(0, 500))
    .slice(0, 50);
}
