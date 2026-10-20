/**
 * StreamAxT — Bil Bakalım sohbet mesajları (saf; testli)
 * Developed by AxthrowA
 *
 * Eskiden soru kutu çizgileri (╔═══╗), kategori/süre/ödül satırları ve
 * açıklamayla 6 satır olarak gönderiliyordu; Kick satır sonlarını yok
 * saydığı için hepsi tek, okunmaz bir satıra dönüşüyordu. Artık sohbete
 * YALNIZ soru ve şıklar gider (ayrıntılar OBS overlay'inde).
 */

const SINIR = 480; // Kick tek mesaj sınırı 500

interface Soru {
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}

const tek = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim();

export function soruMesaji(q: Soru, sira?: { no: number; toplam: number }): string {
  const on = sira ? `(${sira.no}/${sira.toplam}) ` : '';
  const m = `🧠 ${on}${tek(q.question)}  A) ${tek(q.optionA)}  B) ${tek(q.optionB)}  C) ${tek(q.optionC)}  D) ${tek(q.optionD)}`;
  return m.length > SINIR ? `${m.slice(0, SINIR - 1)}…` : m;
}

export function cevapMesaji(harf: string, metin: string, bilen?: { ad: string; puan: number; kisi: number }): string {
  const temel = `✅ Doğru cevap: ${harf}) ${tek(metin)}`;
  const ek = bilen ? ` — ilk bilen @${bilen.ad} (+${bilen.puan})${bilen.kisi > 1 ? `, toplam ${bilen.kisi} kişi bildi` : ''}` : ' — kimse bilemedi';
  const m = temel + ek;
  return m.length > SINIR ? `${m.slice(0, SINIR - 1)}…` : m;
}
