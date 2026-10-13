/**
 * StreamAxT — widget tema kütüphanesi
 * Developed by AxthrowA
 *
 * BOTRIX_GAP_ANALYSIS §8'deki ana örüntü şuydu: *ayar sayısında biz öndeyiz,
 * tema çeşitliliğinde BotRix açık ara önde* — widget başına 13-28 tema
 * sunuyor (Chat 24, Çark 28, Anket 13, Şu An Çalan 16, Sayaç 9). Bizde
 * widget başına 4-5 vardı.
 *
 * Buradaki temalar **kendi tasarımlarımız**: BotRix'in görselleri, renk
 * paletleri veya CSS'i kopyalanmadı. İsimler kategoriktir (Neon, Cam,
 * Minimal gibi) ve sektörde yaygındır.
 *
 * Bir tema, widget'ın ayar değerlerinin hazır bir kümesidir: seçilince
 * ilgili alanlar doldurulur, kullanıcı sonra tek tek değiştirebilir.
 */

export interface TemaTanimi {
  id: string;
  etiket: string;
  /** Hangi widget'lara uygulanabilir; boşsa hepsi. */
  widgetlar?: string[];
  /** Uygulanacak ayar değerleri. */
  degerler: Record<string, unknown>;
  /** Panelde küçük önizleme kartı için. */
  onizleme: { arka: string; vurgu: string; metin: string; kenar?: string };
}

/** Temel palet — tüm temalar bundan türetilir. */
const P = {
  siyah: '#000000',
  koyu: '#0b0f17',
  turkuaz: '#22d3ee',
  yesil: '#34d399',
  mor: '#a78bfa',
  pembe: '#f472b6',
  amber: '#fbbf24',
  kirmizi: '#ef4444',
  beyaz: '#ffffff',
  gri: '#94a3b8',
  kick: '#53fc18'
};

function tema(
  id: string,
  etiket: string,
  degerler: Record<string, unknown>,
  onizleme: TemaTanimi['onizleme'],
  widgetlar?: string[]
): TemaTanimi {
  return { id, etiket, degerler, onizleme, widgetlar };
}

/**
 * Tüm widget'lara uygulanabilen genel temalar.
 *
 * Ortak anahtarlar kullanılır (`bgColor`, `accentColor`, `textColor`,
 * `radius`, `bgOpacity`); bir widget o anahtarı tanımıyorsa yok sayılır.
 */
export const GENEL_TEMALAR: TemaTanimi[] = [
  tema(
    'klasik',
    'Klasik',
    { theme: 'classic', bgColor: P.siyah, bgOpacity: 0.85, accentColor: P.turkuaz, textColor: P.beyaz, radius: 16 },
    { arka: 'rgba(0,0,0,.85)', vurgu: P.turkuaz, metin: P.beyaz }
  ),
  tema(
    'minimal',
    'Minimal',
    { theme: 'minimal', bgColor: P.siyah, bgOpacity: 0, accentColor: P.beyaz, textColor: P.beyaz, radius: 0 },
    { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz }
  ),
  tema(
    'cam',
    'Cam',
    { theme: 'glass', bgColor: '#0f172a', bgOpacity: 0.45, accentColor: P.turkuaz, textColor: P.beyaz, radius: 20 },
    { arka: 'rgba(15,23,42,.45)', vurgu: P.turkuaz, metin: P.beyaz, kenar: 'rgba(255,255,255,.22)' }
  ),
  tema(
    'neon',
    'Neon',
    { theme: 'neon', bgColor: '#05010f', bgOpacity: 0.9, accentColor: '#ff2bd6', textColor: P.beyaz, radius: 14 },
    { arka: '#05010f', vurgu: '#ff2bd6', metin: P.beyaz, kenar: '#ff2bd6' }
  ),
  tema(
    'karbon',
    'Karbon',
    { theme: 'classic', bgColor: '#141414', bgOpacity: 0.95, accentColor: '#9ca3af', textColor: '#e5e7eb', radius: 8 },
    { arka: '#141414', vurgu: '#9ca3af', metin: '#e5e7eb' }
  ),
  tema(
    'aurora',
    'Aurora',
    { theme: 'glass', bgColor: '#0b1220', bgOpacity: 0.6, accentColor: '#6ee7b7', accentColor2: '#818cf8', textColor: P.beyaz, radius: 22 },
    { arka: 'linear-gradient(135deg,#0b1220,#1e1b4b)', vurgu: '#6ee7b7', metin: P.beyaz }
  ),
  tema(
    'gunbatimi',
    'Gün Batımı',
    { theme: 'classic', bgColor: '#2a0f1e', bgOpacity: 0.9, accentColor: '#fb7185', accentColor2: P.amber, textColor: '#fff7ed', radius: 18 },
    { arka: 'linear-gradient(135deg,#2a0f1e,#7c2d12)', vurgu: '#fb7185', metin: '#fff7ed' }
  ),
  tema(
    'gokyuzu',
    'Gökyüzü',
    { theme: 'glass', bgColor: '#082f49', bgOpacity: 0.55, accentColor: '#38bdf8', textColor: P.beyaz, radius: 20 },
    { arka: 'rgba(8,47,73,.55)', vurgu: '#38bdf8', metin: P.beyaz }
  ),
  tema(
    'hacker',
    'Hacker',
    { theme: 'neon', bgColor: '#000900', bgOpacity: 0.92, accentColor: '#22c55e', textColor: '#bbf7d0', radius: 4, fontFamily: 'Orbitron' },
    { arka: '#000900', vurgu: '#22c55e', metin: '#bbf7d0', kenar: '#22c55e' }
  ),
  tema(
    'retro',
    'Retro',
    { theme: 'classic', bgColor: '#1a1423', bgOpacity: 0.95, accentColor: '#f7b32b', accentColor2: '#ef476f', textColor: '#fdf0d5', radius: 6, fontFamily: 'Russo One' },
    { arka: '#1a1423', vurgu: '#f7b32b', metin: '#fdf0d5' }
  ),
  tema(
    'pastel',
    'Pastel',
    { theme: 'glass', bgColor: '#fdf2f8', bgOpacity: 0.85, accentColor: '#c084fc', textColor: '#3b0764', radius: 24 },
    { arka: 'rgba(253,242,248,.85)', vurgu: '#c084fc', metin: '#3b0764' }
  ),
  tema(
    'beyaz',
    'Beyaz',
    { theme: 'classic', bgColor: P.beyaz, bgOpacity: 0.92, accentColor: '#0ea5e9', textColor: '#0f172a', radius: 14 },
    { arka: 'rgba(255,255,255,.92)', vurgu: '#0ea5e9', metin: '#0f172a' }
  ),
  tema(
    'kick',
    'Kick Yeşili',
    { theme: 'neon', bgColor: '#0a0a0a', bgOpacity: 0.9, accentColor: P.kick, textColor: P.beyaz, radius: 12 },
    { arka: '#0a0a0a', vurgu: P.kick, metin: P.beyaz, kenar: P.kick }
  ),
  tema(
    'kadife',
    'Kadife',
    { theme: 'glass', bgColor: '#1b0b2e', bgOpacity: 0.8, accentColor: '#c4b5fd', textColor: '#f5f3ff', radius: 20 },
    { arka: 'rgba(27,11,46,.8)', vurgu: '#c4b5fd', metin: '#f5f3ff' }
  ),
  tema(
    'kor',
    'Kor',
    { theme: 'neon', bgColor: '#1c0701', bgOpacity: 0.92, accentColor: '#f97316', accentColor2: P.kirmizi, textColor: '#ffedd5', radius: 10 },
    { arka: '#1c0701', vurgu: '#f97316', metin: '#ffedd5', kenar: '#f97316' }
  ),
  tema(
    'buz',
    'Buz',
    { theme: 'glass', bgColor: '#0c1a2b', bgOpacity: 0.5, accentColor: '#a5f3fc', textColor: '#ecfeff', radius: 18 },
    { arka: 'rgba(12,26,43,.5)', vurgu: '#a5f3fc', metin: '#ecfeff' }
  ),
  tema(
    'kagit',
    'Kâğıt',
    { theme: 'minimal', bgColor: '#f5f1e8', bgOpacity: 0.95, accentColor: '#8b5e34', textColor: '#3b2f2f', radius: 10 },
    { arka: 'rgba(245,241,232,.95)', vurgu: '#8b5e34', metin: '#3b2f2f' }
  ),
  tema(
    'gece',
    'Gece Yarısı',
    { theme: 'classic', bgColor: '#020617', bgOpacity: 0.95, accentColor: '#818cf8', textColor: '#e0e7ff', radius: 16 },
    { arka: '#020617', vurgu: '#818cf8', metin: '#e0e7ff' }
  ),
  tema(
    'seker',
    'Şeker',
    { theme: 'classic', bgColor: '#3b0764', bgOpacity: 0.88, accentColor: '#f0abfc', accentColor2: '#67e8f9', textColor: P.beyaz, radius: 26 },
    { arka: '#3b0764', vurgu: '#f0abfc', metin: P.beyaz }
  ),
  tema(
    'altin',
    'Altın',
    { theme: 'neon', bgColor: '#1c1917', bgOpacity: 0.9, accentColor: P.amber, textColor: '#fef3c7', radius: 14 },
    { arka: '#1c1917', vurgu: P.amber, metin: '#fef3c7', kenar: P.amber }
  )
];

/** Widget'a özel ek temalar. */
export const WIDGET_TEMALARI: Record<string, TemaTanimi[]> = {
  'wheel-of-fortune': [
    tema('gokkusagi', 'Gökkuşağı', { borderColor: P.beyaz, fontColor: P.beyaz, outlineEnabled: true }, { arka: 'conic-gradient(red,orange,yellow,green,blue,violet,red)', vurgu: P.beyaz, metin: P.beyaz }),
    tema('vegas', 'Vegas', { borderColor: P.amber, fontColor: P.beyaz, pointerColor: P.kirmizi, outlineEnabled: true }, { arka: '#7f1d1d', vurgu: P.amber, metin: P.beyaz }),
    tema('slot', 'Slot Makinesi', { borderColor: '#334155', fontColor: '#f8fafc', pointerColor: P.amber }, { arka: '#1e293b', vurgu: P.amber, metin: '#f8fafc' })
  ],
  'chat-overlay': [
    tema('baloncuk', 'Baloncuk', { messageBgColor: '#1e293b', messageBgOpacity: 0.9, borderRadius: 22 }, { arka: '#1e293b', vurgu: P.turkuaz, metin: P.beyaz }),
    tema('yanmenu', 'Yan Şerit', { messageBgColor: P.siyah, messageBgOpacity: 0.55, borderRadius: 4 }, { arka: 'rgba(0,0,0,.55)', vurgu: P.mor, metin: P.beyaz }),
    tema('seffaf', 'Tamamen Şeffaf', { transparentBg: true, messageBgOpacity: 0, textShadow: true }, { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz })
  ],
  polls: [
    tema('savas', 'Düello', { barColor: P.kirmizi, barBackground: '#1e40af', showVotes: true }, { arka: '#1e293b', vurgu: P.kirmizi, metin: P.beyaz }),
    tema('yayin', 'Yayın Bandı', { barColor: P.turkuaz, barBackground: '#0f172a', borderRadius: 4 }, { arka: '#0f172a', vurgu: P.turkuaz, metin: P.beyaz })
  ]
};

/** Bir widget için kullanılabilir tüm temalar. */
export function temalar(widgetId: string): TemaTanimi[] {
  const ozel = WIDGET_TEMALARI[widgetId] || [];
  const genel = GENEL_TEMALAR.filter((t) => !t.widgetlar || t.widgetlar.includes(widgetId));
  return [...genel, ...ozel];
}

/**
 * Temayı mevcut ayarların üstüne uygular.
 *
 * Widget'ın TANIMADIĞI anahtarlar atlanır: tema, o widget'ta olmayan bir
 * alan yaratmamalı — ayar formu bilinmeyen anahtarı ham adıyla gösterirdi.
 */
export function temayiUygula(
  mevcut: Record<string, unknown>,
  tema: TemaTanimi,
  tanimliAnahtarlar: string[]
): Record<string, unknown> {
  const izinli = new Set(tanimliAnahtarlar);
  const yeni = { ...mevcut };
  for (const [k, v] of Object.entries(tema.degerler)) {
    if (izinli.has(k)) yeni[k] = v;
  }
  return yeni;
}

