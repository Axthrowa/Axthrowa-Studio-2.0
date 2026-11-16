/**
 * Kutlama efektleri (uyarı kutusu): konfeti, havai fişek, yıldız, kalp, yan toplar, yağmur, emoji yağmuru;
 * ekran efektleri (kanal emote yağmuru, sarsıntı, ışık süpürmesi) uyarı kutusunda CSS ile çizilir (EkranEfekti).
 * `kutlamaPlani` saftır (sınanır); `kutla` planı canvas-confetti ile oynatır.
 * Tüm efektler ekranın tam ortasını (0.5, 0.5) merkez alır.
 */
import confetti from 'canvas-confetti';
import { EFEKT_VARSAYILANLARI } from './widget-defaults.js';

export const KUTLAMA_SECENEKLERI = [
  { value: 'konfeti', label: 'Konfeti patlaması' },
  { value: 'havaiFisek', label: 'Havai fişek' },
  { value: 'yildiz', label: 'Yıldız patlaması' },
  { value: 'kalp', label: 'Kalp yağmuru' },
  { value: 'toplar', label: 'Yan konfeti topları' },
  { value: 'yagmur', label: 'Konfeti yağmuru' },
  { value: 'emoji', label: 'Emoji yağmuru' },
  { value: 'emote', label: 'Kanal emote yağmuru' },
  { value: 'sarsinti', label: 'Ekran sarsıntısı' },
  { value: 'isik', label: 'Işık süpürmesi' },
  { value: 'rastgele', label: 'Rastgele' }
] as const;

/** Konfeti tuvaliyle değil, uyarı kutusunun kendisinde çizilen efektler */
export const EKRAN_EFEKTLERI: readonly string[] = ['emote', 'sarsinti', 'isik'];

export type KutlamaTuru = (typeof KUTLAMA_SECENEKLERI)[number]['value'];

/** `sekil` (emoji) oynatılırken şekle çevrilir (şekil üretimi tuval ister, plan saf kalır) */
export type Atis = { gecikmeMs: number; sekil?: string; secenek: confetti.Options };

// "Rastgele" yalnız konfeti efektlerinden seçer
const SABIT_TURLER = KUTLAMA_SECENEKLERI.map((s) => s.value).filter((v) => v !== 'rastgele' && !EKRAN_EFEKTLERI.includes(v));
const EMOJILER = ['🎉', '💜', '⭐', '🔥'];
const ORTA = { x: 0.5, y: 0.5 };
const BUYUK_BAGIS = 100;

/** Uyarı kutusu ayarında olay grupları: `efekt<Grup>` ve `guc<Grup>` anahtarları */
const OLAY_GRUBU: Record<string, string> = {
  follow: 'Takip', sub: 'Abone', gift_sub: 'Abone', tip: 'Bagis', kicks: 'Bagis', gift_tiktok: 'Bagis', raid: 'Raid', host: 'Raid'
};

export const EFEKT_SECENEKLERI = [
  { value: 'genel', label: 'Genel kutlama efekti' },
  { value: 'yok', label: 'Efekt yok' },
  ...KUTLAMA_SECENEKLERI
];

export const GUC_SECENEKLERI = [
  { value: '0.55', label: 'Hafif' },
  { value: '0.8', label: 'Orta' },
  { value: '1', label: 'Güçlü' },
  { value: '1.5', label: 'Çok güçlü' }
];

/** Olayın efekti ve gücü; `null` = efekt yok ya da bu olay kutlanmaz. */
export function olayEfekti(olay: string, tutar: number, ayar: Record<string, unknown>): { tur: string; guc: number } | null {
  const grup = OLAY_GRUBU[olay];
  if (!grup) return null;
  const anahtar = (olay === 'tip' || olay === 'kicks') && Number(tutar) >= BUYUK_BAGIS ? 'BuyukBagis' : grup;
  const v = EFEKT_VARSAYILANLARI as Record<string, string>;
  const secilen = String(ayar[`efekt${anahtar}`] || v[`efekt${anahtar}`]);
  if (secilen === 'yok') return null;
  const guc = Number(ayar[`guc${anahtar}`] ?? v[`guc${anahtar}`]);
  return {
    tur: secilen === 'genel' ? String(ayar.celebration || 'konfeti') : secilen,
    guc: Number.isFinite(guc) ? Math.min(1.5, Math.max(0.3, guc)) : 1
  };
}
// Havai fişeklerin patlama noktaları: ortanın çevresinde, her çalışta aynı (yayında öngörülebilir)
const FISEK_NOKTALARI = [ORTA, { x: 0.25, y: 0.35 }, { x: 0.75, y: 0.3 }, { x: 0.4, y: 0.6 }, { x: 0.65, y: 0.55 }, ORTA];

/** `guc`: 0.5 (takip gibi küçük olay) – 1 (abone, bağış) */
export function kutlamaPlani(tur: string, guc = 1, rastgele: () => number = Math.random): Atis[] {
  const secilen = tur === 'rastgele' ? SABIT_TURLER[Math.floor(rastgele() * SABIT_TURLER.length)] : tur;
  if (EKRAN_EFEKTLERI.includes(secilen)) return [];
  const n = (adet: number) => Math.max(8, Math.round(adet * guc));
  switch (secilen) {
    case 'havaiFisek':
      return FISEK_NOKTALARI.map((origin, i) => ({
        gecikmeMs: i * 320,
        secenek: { particleCount: n(70), spread: 360, startVelocity: 28, gravity: 0.7, ticks: 70, scalar: 0.9, origin }
      }));
    case 'yildiz':
      return [0, 180].map((gecikmeMs) => ({
        gecikmeMs,
        secenek: { particleCount: n(45), spread: 360, startVelocity: 32, gravity: 0.5, ticks: 90, scalar: 1.3, shapes: ['star'], colors: ['#fde047', '#facc15', '#fff7c2', '#f59e0b'], origin: ORTA }
      }));
    case 'kalp':
      return [0, 250, 500].map((gecikmeMs) => ({
        gecikmeMs,
        sekil: '❤️',
        secenek: { particleCount: n(22), spread: 360, startVelocity: 26, gravity: 0.45, ticks: 110, scalar: 2.2, origin: ORTA }
      }));
    case 'toplar':
      return [0, 220, 440].flatMap((gecikmeMs) => [
        { gecikmeMs, secenek: { particleCount: n(40), angle: 55, spread: 60, startVelocity: 60, origin: { x: 0, y: 0.75 } } },
        { gecikmeMs, secenek: { particleCount: n(40), angle: 125, spread: 60, startVelocity: 60, origin: { x: 1, y: 0.75 } } }
      ]);
    case 'yagmur':
      return [0, 1, 2, 3, 4, 5].map((i) => ({
        gecikmeMs: i * 180,
        secenek: { particleCount: n(30), angle: 270, spread: 150, startVelocity: 12, gravity: 1.1, ticks: 220, origin: { x: 0.1 + ((i * 3) % 6) * 0.16, y: -0.05 } }
      }));
    case 'emoji':
      return [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({
        gecikmeMs: i * 160,
        sekil: EMOJILER[i % EMOJILER.length],
        secenek: { particleCount: n(14), angle: 270, spread: 140, startVelocity: 10, gravity: 0.9, ticks: 240, scalar: 2.4, flat: true, origin: { x: 0.1 + ((i * 5) % 8) * 0.11, y: -0.05 } }
      }));
    default:
      return [{ gecikmeMs: 0, secenek: { particleCount: n(110), spread: 360, startVelocity: 34, ticks: 120, origin: ORTA } }];
  }
}

const sekiller = new Map<string, confetti.Shape>();

/** Planı oynatır; dönen işlev bekleyen atışları iptal eder. Tuval yoksa (sınama, eski tarayıcı) sessizce geçer. */
export function kutla(tur: string, guc = 1): () => void {
  const zamanlayicilar = kutlamaPlani(tur, guc).map((a) =>
    setTimeout(() => {
      try {
        // Yayın katmanı izleyiciye gider: yayıncının Windows "animasyonları azalt" ayarı efekti kapatmamalı
        const secenek = { ...a.secenek };
        if (a.sekil) {
          let sekil = sekiller.get(a.sekil);
          if (!sekil) {
            sekil = confetti.shapeFromText({ text: a.sekil, scalar: Number(a.secenek.scalar) || 2.2 });
            sekiller.set(a.sekil, sekil);
          }
          secenek.shapes = [sekil];
        }
        void confetti(secenek);
      } catch {
        /* kutlama süs: hata uyarıyı durdurmasın */
      }
    }, a.gecikmeMs)
  );
  return () => zamanlayicilar.forEach(clearTimeout);
}
