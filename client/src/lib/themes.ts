/**
 * AxBoT — widget tema kütüphanesi
 * Developed by AxthrowA
 *
 * rakip incelemesindeki ana örüntü şuydu: *ayar sayısında biz öndeyiz,
 * tema çeşitliliğinde örnek alınan bot açık ara önde* — widget başına 13-28 tema
 * sunuyor (Chat 24, Çark 28, Anket 13, Şu An Çalan 16, Sayaç 9). Bizde
 * widget başına 4-5 vardı.
 *
 * Buradaki temalar **kendi tasarımlarımız**: örnek alınan botun görselleri, renk
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
  onizleme: { arka: string; vurgu: string; metin: string; kenar?: string; yazi?: string };
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
  // Yapısal temalar: kutunun biçimini, dokusunu ve hareketini değiştirir (lib/kabuklar.ts)
  tema('yapi_holo', 'Hologram', { kabuk: 'holo', chatStyle: 'holo', bgColor: '#0b1020', bgOpacity: 0.96, accentColor: '#a78bfa', textColor: '#ffffff' }, { arka: '#0b1020', vurgu: '#a78bfa', metin: '#ffffff' }),
  tema('yapi_crt', 'CRT Ekran', { kabuk: 'crt', chatStyle: 'crt', bgColor: '#03140a', bgOpacity: 0.97, accentColor: '#22c55e', textColor: '#86efac' }, { arka: '#03140a', vurgu: '#22c55e', metin: '#86efac' }),
  tema('yapi_brutal', 'Brutalist', { kabuk: 'brutal', chatStyle: 'brutal', bgColor: '#fde047', bgOpacity: 1, accentColor: '#1e3a8a', textColor: '#000000' }, { arka: '#fde047', vurgu: '#1e3a8a', metin: '#000000' }),
  tema('yapi_defter', 'Karalama Defteri', { kabuk: 'defter', chatStyle: 'defter', bgColor: '#fdf6e3', bgOpacity: 1, accentColor: '#be185d', textColor: '#3b2f1a' }, { arka: '#fdf6e3', vurgu: '#be185d', metin: '#3b2f1a' }),
  tema('yapi_ampul', 'Sahne Ampulleri', { kabuk: 'ampul', chatStyle: 'ampul', bgColor: '#1c0a2e', bgOpacity: 0.97, accentColor: '#fbbf24', textColor: '#fef3c7' }, { arka: '#1c0a2e', vurgu: '#fbbf24', metin: '#fef3c7' }),
  tema('yapi_siber', 'Siber HUD', { kabuk: 'siber', chatStyle: 'siber', bgColor: '#020617', bgOpacity: 0.92, accentColor: '#22d3ee', textColor: '#e0f2fe' }, { arka: '#020617', vurgu: '#22d3ee', metin: '#e0f2fe' }),
  tema('yapi_kil', 'Kil', { kabuk: 'kil', chatStyle: 'kil', bgColor: '#6d4aff', bgOpacity: 1, accentColor: '#ffb86b', textColor: '#ffffff' }, { arka: '#6d4aff', vurgu: '#ffb86b', metin: '#ffffff' }),
  tema('yapi_krom', 'Y2K Krom', { kabuk: 'krom', chatStyle: 'krom', bgColor: '#111827', bgOpacity: 0.96, accentColor: '#e2e8f0', textColor: '#f8fafc' }, { arka: '#111827', vurgu: '#e2e8f0', metin: '#f8fafc' }),
  tema('yapi_plan', 'Mavi Plan', { kabuk: 'plan', chatStyle: 'plan', bgColor: '#0b3a75', bgOpacity: 1, accentColor: '#7dd3fc', textColor: '#e0f2fe' }, { arka: '#0b3a75', vurgu: '#7dd3fc', metin: '#e0f2fe' }),
  tema('yapi_bilet', 'Bilet', { kabuk: 'bilet', chatStyle: 'bilet', bgColor: '#1f2937', bgOpacity: 1, accentColor: '#fbbf24', textColor: '#fef3c7' }, { arka: '#1f2937', vurgu: '#fbbf24', metin: '#fef3c7' }),
  tema('yapi_origami', 'Origami', { kabuk: 'origami', chatStyle: 'origami', bgColor: '#0f766e', bgOpacity: 1, accentColor: '#99f6e4', textColor: '#f0fdfa' }, { arka: '#0f766e', vurgu: '#99f6e4', metin: '#f0fdfa' }),
  tema('yapi_vapor', 'Vaporwave', { kabuk: 'vapor', chatStyle: 'vapor', bgColor: '#12062e', bgOpacity: 1, accentColor: '#f472b6', textColor: '#fdf4ff' }, { arka: '#12062e', vurgu: '#f472b6', metin: '#fdf4ff' }),
  tema('yapi_manga', 'Manga', { kabuk: 'manga', chatStyle: 'manga', bgColor: '#ffffff', bgOpacity: 1, accentColor: '#111111', textColor: '#111111' }, { arka: '#ffffff', vurgu: '#111111', metin: '#111111' }),
  tema('yapi_vitray', 'Vitray', { kabuk: 'vitray', chatStyle: 'vitray', bgColor: '#0a0a0a', bgOpacity: 0.9, accentColor: '#fbbf24', textColor: '#ffffff' }, { arka: '#0a0a0a', vurgu: '#fbbf24', metin: '#ffffff' }),
  tema('yapi_lav', 'Lav Lambası', { kabuk: 'lav', chatStyle: 'lav', bgColor: '#1a0b2e', bgOpacity: 0.97, accentColor: '#fb923c', textColor: '#fff7ed' }, { arka: '#1a0b2e', vurgu: '#fb923c', metin: '#fff7ed' }),
  tema('yapi_perde', 'Tiyatro Perdesi', { kabuk: 'perde', chatStyle: 'perde', bgColor: '#1c0606', bgOpacity: 0.97, accentColor: '#d4a843', textColor: '#fef3c7' }, { arka: '#1c0606', vurgu: '#d4a843', metin: '#fef3c7' }),
  tema('yapi_arcade', 'Arcade Dolabı', { kabuk: 'arcade', chatStyle: 'arcade', bgColor: '#0d0221', bgOpacity: 0.96, accentColor: '#00f0ff', textColor: '#ffffff', fontFamily: 'Pixelify Sans' }, { arka: '#0d0221', vurgu: '#00f0ff', metin: '#ffffff', kenar: '#111111', yazi: 'Pixelify Sans' }),
  tema('yapi_kaset', 'Kaset', { kabuk: 'kaset', chatStyle: 'kaset', bgColor: '#292524', bgOpacity: 1, accentColor: '#fb923c', textColor: '#fafaf9' }, { arka: '#292524', vurgu: '#fb923c', metin: '#fafaf9', kenar: '#1c1917' }),
  tema('yapi_terminal', 'Terminal', { kabuk: 'terminal', chatStyle: 'terminal', bgColor: '#0a0f0a', bgOpacity: 0.96, accentColor: '#4ade80', textColor: '#d1fae5', fontFamily: 'Fira Code' }, { arka: '#0a0f0a', vurgu: '#4ade80', metin: '#d1fae5', kenar: '#1f2937' }),
  tema('yapi_gazete', 'Gazete', { kabuk: 'gazete', chatStyle: 'gazete', bgColor: '#f5f1e6', bgOpacity: 1, accentColor: '#b91c1c', textColor: '#1c1917', fontFamily: 'Playfair Display' }, { arka: '#f5f1e6', vurgu: '#b91c1c', metin: '#1c1917', kenar: '#1c1917' }),
  tema('yapi_neontabela', 'Neon Tabela', { kabuk: 'neontabela', chatStyle: 'neon', bgColor: '#0a0014', bgOpacity: 0.9, accentColor: '#ff2bd6', textColor: '#ffe4fa' }, { arka: '#0a0014', vurgu: '#ff2bd6', metin: '#ffe4fa', kenar: '#ff2bd6' }),
  tema('yapi_karton', 'Karton Kutu', { kabuk: 'karton', chatStyle: 'karton', bgColor: '#c89b63', bgOpacity: 1, accentColor: '#7c2d12', textColor: '#2b1a0a', fontFamily: 'Gloria Hallelujah' }, { arka: '#c89b63', vurgu: '#7c2d12', metin: '#2b1a0a' }),
  tema('yapi_mermer', 'Mermer', { kabuk: 'mermer', chatStyle: 'mermer', bgColor: '#1f1d24', bgOpacity: 0.97, accentColor: '#d4af37', textColor: '#f5f5f4', fontFamily: 'Cinzel' }, { arka: '#1f1d24', vurgu: '#d4af37', metin: '#f5f5f4', kenar: '#d4af37' }),
  tema('yapi_sakiz', 'Sakız Balonu', { kabuk: 'sakiz', chatStyle: 'sakiz', bgColor: '#f472b6', bgOpacity: 1, accentColor: '#500724', textColor: '#3b0a24', fontFamily: 'Fredoka' }, { arka: '#f472b6', vurgu: '#500724', metin: '#3b0a24' }),
  tema('yapi_polaroid', 'Polaroid', { kabuk: 'polaroid', chatStyle: 'polaroid', bgColor: '#1c1917', bgOpacity: 1, accentColor: '#fbbf24', textColor: '#fafaf9', fontFamily: 'Kalam' }, { arka: '#1c1917', vurgu: '#fbbf24', metin: '#fafaf9', kenar: '#fafaf9', yazi: 'Kalam' }),
  tema('yapi_postit', 'Post-it', { kabuk: 'postit', chatStyle: 'postit', bgColor: '#fde047', bgOpacity: 1, accentColor: '#9a3412', textColor: '#3b2f06', fontFamily: 'Caveat' }, { arka: '#fde047', vurgu: '#9a3412', metin: '#3b2f06', yazi: 'Caveat' }),
  tema('yapi_piksel', 'Piksel Çerçeve', { kabuk: 'piksel', chatStyle: 'piksel', bgColor: '#1e1b4b', bgOpacity: 1, accentColor: '#facc15', textColor: '#ffffff', fontFamily: 'Pixelify Sans' }, { arka: '#1e1b4b', vurgu: '#facc15', metin: '#ffffff', kenar: '#facc15', yazi: 'Pixelify Sans' }),
  tema('yapi_ahsap', 'Ahşap Tabela', { kabuk: 'ahsap', chatStyle: 'ahsap', bgColor: '#6b4019', bgOpacity: 1, accentColor: '#fcd34d', textColor: '#fff7e6', fontFamily: 'Rye' }, { arka: 'linear-gradient(180deg,#8a5426,#55320f)', vurgu: '#fcd34d', metin: '#fff7e6', kenar: '#3b2410', yazi: 'Rye' }),
  tema('yapi_film', 'Sinema Şeridi', { kabuk: 'film', chatStyle: 'film', bgColor: '#0a0a0a', bgOpacity: 0.97, accentColor: '#fbbf24', textColor: '#f5f5f5', fontFamily: 'Bebas Neue' }, { arka: '#0a0a0a', vurgu: '#fbbf24', metin: '#f5f5f5', yazi: 'Bebas Neue' }),
  tema('yapi_buz', 'Kristal Buz', { kabuk: 'buz', chatStyle: 'buz', bgColor: '#0c2a43', bgOpacity: 0.92, accentColor: '#7dd3fc', textColor: '#f0f9ff' }, { arka: 'linear-gradient(135deg,#1e4a6e,#0c2a43)', vurgu: '#7dd3fc', metin: '#f0f9ff', kenar: '#e0f2fe' }),
  tema('yapi_washi', 'Washi Bant', { kabuk: 'washi', chatStyle: 'washi', bgColor: '#fffbf0', bgOpacity: 1, accentColor: '#0f766e', textColor: '#1f2937' }, { arka: '#fffbf0', vurgu: '#0f766e', metin: '#1f2937' }),
  tema('yapi_rozet', 'Rozet', { kabuk: 'rozet', chatStyle: 'rozet', bgColor: '#1e1b4b', bgOpacity: 0.97, accentColor: '#f5c518', textColor: '#fef9c3' }, { arka: '#1e1b4b', vurgu: '#f5c518', metin: '#fef9c3', kenar: '#f5c518' }),
  tema('kutu_sivicam', 'Sıvı Cam', { kabuk: 'sivicam', bgColor: '#ffffff', bgOpacity: 0.1, accentColor: P.beyaz, textColor: P.beyaz }, { arka: 'rgba(255,255,255,.12)', vurgu: P.beyaz, metin: P.beyaz, kenar: 'rgba(255,255,255,.35)' }),
  tema('kutu_pencere', 'Eski Pencere', { kabuk: 'pencere', bgColor: '#c0c0c0', bgOpacity: 1, accentColor: '#000080', textColor: '#000000' }, { arka: '#c0c0c0', vurgu: '#000080', metin: '#000000' }),
  tema('kutu_gameboy', 'El Konsolu', { kabuk: 'gameboy', bgColor: '#9bbc0f', bgOpacity: 1, accentColor: '#306230', textColor: '#0f380f' }, { arka: '#9bbc0f', vurgu: '#306230', metin: '#0f380f' }),
  tema('kutu_not', 'Yapışkan Not', { kabuk: 'yapiskan', bgColor: '#fde68a', bgOpacity: 1, accentColor: '#92400e', textColor: '#3f2d06' }, { arka: '#fde68a', vurgu: '#92400e', metin: '#3f2d06' }),
  tema('kutu_parsomen', 'Parşömen', { kabuk: 'parsomen', bgColor: '#e8d3a6', bgOpacity: 1, accentColor: '#8a6a3b', textColor: '#3b2a14' }, { arka: '#e8d3a6', vurgu: '#8a6a3b', metin: '#3b2a14' }),
  tema('kutu_cizgi', 'Çizgi Roman Kutu', { kabuk: 'cizgiroman', bgColor: '#ffffff', bgOpacity: 1, accentColor: '#111111', textColor: '#111111' }, { arka: '#ffffff', vurgu: '#111111', metin: '#111111' }),
  tema('kutu_gecedalga', 'Gece Dalgası', { kabuk: 'gecedalga', bgColor: '#2b0a4d', bgOpacity: 0.95, accentColor: '#ff8ad8', textColor: P.beyaz }, { arka: '#2b0a4d', vurgu: '#ff8ad8', metin: P.beyaz }),
  tema('kutu_altin', 'Altın Kenar', { kabuk: 'altin', bgColor: '#14100a', bgOpacity: 0.95, accentColor: '#d4a843', textColor: '#f5e6c4' }, { arka: '#14100a', vurgu: '#d4a843', metin: '#f5e6c4' }),
  tema('kutu_koseli', 'Köşeli Yayın', { kabuk: 'koseli', bgColor: '#0b0f17', bgOpacity: 0.8, accentColor: P.turkuaz, textColor: P.beyaz }, { arka: '#0b0f17', vurgu: P.turkuaz, metin: P.beyaz }),
  tema('kutu_kupon', 'Kupon', { kabuk: 'kupon', bgColor: '#111827', bgOpacity: 0.9, accentColor: P.pembe, textColor: P.beyaz }, { arka: '#111827', vurgu: P.pembe, metin: P.beyaz }),
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
    { theme: 'glass', bgColor: '#0b3b5c', bgOpacity: 0.55, accentColor: '#fcd34d', textColor: P.beyaz, radius: 20 },
    { arka: 'rgba(11,59,92,.55)', vurgu: '#fcd34d', metin: P.beyaz }
  ),
  tema(
    'hacker',
    'Hacker',
    { theme: 'neon', bgColor: '#000900', bgOpacity: 0.92, accentColor: '#22c55e', textColor: '#bbf7d0', radius: 4, fontFamily: 'Oxanium' },
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
    { theme: 'glass', bgColor: '#fdf2f8', bgOpacity: 0.85, accentColor: '#9333ea', textColor: '#3b0764', radius: 24 },
    { arka: 'rgba(253,242,248,.85)', vurgu: '#9333ea', metin: '#3b0764' }
  ),
  tema(
    'beyaz',
    'Beyaz',
    { theme: 'classic', bgColor: P.beyaz, bgOpacity: 0.92, accentColor: '#0369a1', textColor: '#0f172a', radius: 14 },
    { arka: 'rgba(255,255,255,.92)', vurgu: '#0369a1', metin: '#0f172a' }
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
  ),
  // Oyun & film temaları: tür çağrışımlı kendi renk/yazı tipi birleşimlerimiz (marka, logo, görsel yok)
  tema(
    'arcade',
    '🎮 Retro Arcade',
    { theme: 'neon', bgColor: '#0d0221', bgOpacity: 0.92, accentColor: '#00f0ff', accentColor2: '#ff2a6d', textColor: '#ffffff', radius: 0, fontFamily: 'Press Start 2P' },
    { arka: 'linear-gradient(135deg,#0d0221,#ff2a6d)', vurgu: '#00f0ff', metin: '#ffffff', kenar: '#00f0ff' }
  ),
  tema(
    'piksel',
    '🎮 Piksel Macera',
    { theme: 'neon', bgColor: '#22301a', bgOpacity: 0.92, accentColor: '#7cc242', accentColor2: '#8b5a2b', textColor: '#f1f8e9', radius: 0, fontFamily: 'VT323' },
    { arka: 'linear-gradient(135deg,#22301a,#8b5a2b)', vurgu: '#7cc242', metin: '#f1f8e9', kenar: '#7cc242' }
  ),
  tema(
    'siberpunk',
    '🎮 Siberpunk',
    { theme: 'neon', bgColor: '#0a0014', bgOpacity: 0.92, accentColor: '#fcee0a', accentColor2: '#00f0ff', textColor: '#ffffff', radius: 2, fontFamily: 'Audiowide' },
    { arka: 'linear-gradient(135deg,#0a0014,#00f0ff)', vurgu: '#fcee0a', metin: '#ffffff', kenar: '#fcee0a' }
  ),
  tema(
    'taktik',
    '🎮 Taktik / Battle Royale',
    { theme: 'neon', bgColor: '#1b1f14', bgOpacity: 0.92, accentColor: '#c5b358', accentColor2: '#ff6b00', textColor: '#e8e4d0', radius: 2, fontFamily: 'Black Ops One' },
    { arka: 'linear-gradient(135deg,#1b1f14,#ff6b00)', vurgu: '#c5b358', metin: '#e8e4d0', kenar: '#c5b358' }
  ),
  tema(
    'fantastik',
    '🎮 Fantastik RPG',
    { theme: 'neon', bgColor: '#1a1208', bgOpacity: 0.92, accentColor: '#d4af37', accentColor2: '#7b1e1e', textColor: '#f3e5c0', radius: 10, fontFamily: 'Cinzel' },
    { arka: 'linear-gradient(135deg,#1a1208,#7b1e1e)', vurgu: '#d4af37', metin: '#f3e5c0', kenar: '#d4af37' }
  ),
  tema(
    'yaris',
    '🎮 Yarış',
    { theme: 'neon', bgColor: '#0f0f0f', bgOpacity: 0.92, accentColor: '#ff1e1e', accentColor2: '#3f3f46', textColor: '#ffffff', radius: 4, fontFamily: 'Russo One' },
    { arka: 'linear-gradient(135deg,#0f0f0f,#3f3f46)', vurgu: '#ff1e1e', metin: '#ffffff', kenar: '#ff1e1e' }
  ),
  tema(
    'zombi',
    '🎮 Zombi Kıyameti',
    { theme: 'neon', bgColor: '#121a0c', bgOpacity: 0.92, accentColor: '#8bc34a', accentColor2: '#7f1d1d', textColor: '#dcedc8', radius: 4, fontFamily: 'Special Elite' },
    { arka: 'linear-gradient(135deg,#121a0c,#7f1d1d)', vurgu: '#8bc34a', metin: '#dcedc8', kenar: '#8bc34a' }
  ),
  tema(
    'uzay',
    '🎬 Uzay Destanı',
    { theme: 'neon', bgColor: '#020818', bgOpacity: 0.92, accentColor: '#4fc3f7', accentColor2: '#312e81', textColor: '#e3f2fd', radius: 6, fontFamily: 'Oxanium' },
    { arka: 'linear-gradient(135deg,#020818,#312e81)', vurgu: '#4fc3f7', metin: '#e3f2fd', kenar: '#4fc3f7' }
  ),
  tema(
    'korku',
    '🎬 Korku',
    { theme: 'neon', bgColor: '#0a0000', bgOpacity: 0.92, accentColor: '#dc2626', accentColor2: '#450a0a', textColor: '#fde8e8', radius: 4, fontFamily: 'Metal Mania' },
    { arka: 'linear-gradient(135deg,#0a0000,#450a0a)', vurgu: '#dc2626', metin: '#fde8e8', kenar: '#dc2626' }
  ),
  tema(
    'vahsibati',
    '🎬 Vahşi Batı',
    { theme: 'neon', bgColor: '#3e2412', bgOpacity: 0.92, accentColor: '#e0a458', accentColor2: '#8c1c13', textColor: '#fbe9d0', radius: 4, fontFamily: 'Rye' },
    { arka: 'linear-gradient(135deg,#3e2412,#8c1c13)', vurgu: '#e0a458', metin: '#fbe9d0', kenar: '#e0a458' }
  ),
  tema(
    'noir',
    '🎬 Kara Film',
    { theme: 'neon', bgColor: '#0b0b0b', bgOpacity: 0.92, accentColor: '#e5e5e5', accentColor2: '#404040', textColor: '#f5f5f5', radius: 0, fontFamily: 'Special Elite' },
    { arka: 'linear-gradient(135deg,#0b0b0b,#404040)', vurgu: '#e5e5e5', metin: '#f5f5f5', kenar: '#e5e5e5' }
  ),
  tema(
    'gala',
    '🎬 Sinema Galası',
    { theme: 'neon', bgColor: '#2a0505', bgOpacity: 0.92, accentColor: '#e6b422', accentColor2: '#991b1b', textColor: '#fff8e1', radius: 8, fontFamily: 'Bebas Neue' },
    { arka: 'linear-gradient(135deg,#2a0505,#991b1b)', vurgu: '#e6b422', metin: '#fff8e1', kenar: '#e6b422' }
  ),
  tema(
    'cizgiroman',
    '🎬 Çizgi Roman',
    { theme: 'neon', bgColor: '#1e3a8a', bgOpacity: 0.92, accentColor: '#facc15', accentColor2: '#dc2626', textColor: '#ffffff', radius: 6, fontFamily: 'Bangers', outlineEnabled: true, outlineColor: '#000000' },
    { arka: 'linear-gradient(135deg,#1e3a8a,#dc2626)', vurgu: '#facc15', metin: '#ffffff', kenar: '#facc15' }
  ),
  tema(
    'anime',
    '🎬 Anime',
    { theme: 'neon', bgColor: '#1a0f2e', bgOpacity: 0.92, accentColor: '#ff6ec7', accentColor2: '#7df9ff', textColor: '#ffffff', radius: 18, fontFamily: 'Poppins' },
    { arka: 'linear-gradient(135deg,#1a0f2e,#7df9ff)', vurgu: '#ff6ec7', metin: '#ffffff', kenar: '#ff6ec7' }
  ),
  // Bilinen renk şemaları (Nord, Dracula, Catppuccin, Gruvbox, Solarized, Tokyo Night) ve yayın stilleri
  ...(
    [
      ['nord', '❄️ Nord', '#2e3440', '#88c0d0', '#eceff4', 'Inter'],
      ['dracula', '🧛 Dracula', '#282a36', '#ff79c6', '#f8f8f2', 'Fira Code'],
      ['catppuccin', '🐈 Catppuccin', '#1e1e2e', '#cba6f7', '#cdd6f4', 'Lexend'],
      ['gruvbox', '🍂 Gruvbox', '#282828', '#fabd2f', '#ebdbb2', 'Fira Code'],
      ['solarized', '☀️ Solarized', '#002b36', '#b58900', '#eee8d5', 'Ubuntu'],
      ['tokyo', '🌃 Tokyo Gecesi', '#1a1b26', '#7aa2f7', '#c0caf5', 'Space Grotesk'],
      ['synthwave', '🌆 Synthwave', '#241b2f', '#36f9f6', '#fefeff', 'Audiowide'],
      ['vaporwave', '🌴 Vaporwave', '#2d1b4e', '#01cdfe', '#fffb96', 'Righteous'],
      ['lofi', '☕ Lo-fi Kafe', '#3b2f2f', '#d4a373', '#fefae0', 'Caveat'],
      ['sakura', '🌸 Sakura', '#2b1b24', '#ffb7c5', '#fff0f5', 'Comfortaa'],
      ['okyanus', '🌊 Okyanus', '#03203c', '#22d3ee', '#e0f7ff', 'Quicksand'],
      ['orman', '🌲 Orman', '#14281d', '#7cb518', '#f1f8e9', 'Kanit'],
      ['col', '🏜️ Çöl', '#3d2817', '#e9a23b', '#fff4e0', 'Rajdhani'],
      ['altin-luks', '👑 Altın Lüks', '#121212', '#d4af37', '#f5f0e1', 'Playfair Display'],
      ['espor-kirmizi', '🎯 E-spor Kırmızı', '#0d0d0d', '#ff2e4c', '#ffffff', 'Saira'],
      ['espor-mavi', '🛡️ E-spor Mavi', '#050b1a', '#2f80ff', '#ffffff', 'Barlow Condensed'],
      ['tek-renk', '⚫ Tek Renk', '#000000', '#ffffff', '#ffffff', 'Space Grotesk'],
      ['seker-pop', '🍭 Şeker Pop', '#43105e', '#ff8fd8', '#ffffff', 'Fredoka'],
      ['matrix', '🟢 Matrix', '#000000', '#00ff41', '#b6ffbf', 'Fira Code'],
      ['piksel-mor', '👾 Piksel Gece', '#1b1035', '#a78bfa', '#ffffff', 'Pixelify Sans'],
      // Popüler film, oyun ve dizilerin havası: kendi renk ve yazı tipi birleşimlerimiz (marka adı, logo, görsel yok)
      ['f-karanlik-sehir', '🦇 Film: Karanlık Şehir', '#0b0d12', '#f5c518', '#e5e7eb', 'Bebas Neue'],
      ['f-galaktik', '🌌 Film: Galaktik Savaş', '#05060f', '#ffe81f', '#f8fafc', 'Michroma'],
      ['f-buyucu', '🪄 Film: Büyücü Okulu', '#2a0b12', '#d3a625', '#f5ecd7', 'Cinzel Decorative'],
      ['f-orta-diyar', '💍 Film: Yüzük Diyarı', '#1a2114', '#c9a227', '#f2ead3', 'MedievalSharp'],
      ['f-mavi-gezegen', '🌿 Film: Mavi Gezegen', '#120a33', '#38e8d4', '#e6fffb', 'Exo 2'],
      ['f-dinozor', '🦖 Film: Dinozor Adası', '#13240f', '#f59e0b', '#fef3c7', 'Anton'],
      ['f-neon-yagmur', '🌧️ Film: Neon Yağmur', '#10091f', '#ff5ea0', '#ffe9f3', 'Oxanium'],
      ['f-korsan', '🏴‍☠️ Film: Korsan Denizi', '#14202b', '#d9a441', '#f4ead5', 'Pirata One'],
      ['f-orumcek', '🕸️ Film: Örümcek Kahraman', '#0a1a4a', '#ff3b4a', '#ffffff', 'Bangers'],
      ['f-zirh', '🤖 Film: Zırhlı Dahi', '#2a0a0a', '#f5b301', '#fff7e0', 'Russo One'],
      ['o-blok', '⛏️ Oyun: Blok Dünyası', '#3b2a1a', '#7bc043', '#f0f7e6', 'Pixelify Sans'],
      ['o-suc-sehri', '🚗 Oyun: Suç Şehri', '#0e1712', '#57c26b', '#ffffff', 'Oswald'],
      ['o-nisanci', '🎯 Oyun: Taktik Nişancı', '#0f1923', '#ff4655', '#ece8e1', 'Tektur'],
      ['o-karsi-saldiri', '💣 Oyun: Karşı Saldırı', '#1b1f23', '#de9b35', '#f5f5f5', 'Rajdhani'],
      ['o-gece-kenti', '🌃 Oyun: Gece Kenti', '#0a0a12', '#ff2a6d', '#e8fdff', 'Oxanium'],
      ['o-cadi-avcisi', '🐺 Oyun: Canavar Avcısı', '#15120e', '#b8c4cc', '#e9dfc7', 'Grenze Gotisch'],
      ['o-kul', '🔥 Oyun: Kül ve Ruhlar', '#100d0b', '#e8742b', '#eadfce', 'New Rocker'],
      ['o-uzay-haini', '🔺 Oyun: Uzayda Hain', '#1a0f2e', '#ff5c5c', '#ffffff', 'Luckiest Guy'],
      ['o-haydut', '🤠 Oyun: Vahşi Haydutlar', '#2a1a10', '#e0634f', '#f5e6c8', 'Rye'],
      ['o-son-kalan', '🪂 Oyun: Son Kalan', '#13233f', '#f7c948', '#ffffff', 'Lilita One'],
      ['d-demir-taht', '🐉 Dizi: Demir Taht', '#101418', '#8fb8d6', '#e8eef2', 'Cinzel'],
      ['d-kimya', '🧪 Dizi: Kimya Öğretmeni', '#0e2a1a', '#6fd08c', '#f2fff5', 'Courier Prime'],
      ['d-ters-dunya', '🚲 Dizi: Ters Dünya', '#0b0506', '#ff2a33', '#f9d6d6', 'Metal Mania'],
      ['d-soygun', '🎭 Dizi: Büyük Soygun', '#5a0a0a', '#f5d7b5', '#ffffff', 'Anton'],
      ['d-olumcul-oyun', '🟢 Dizi: Ölümcül Oyun', '#0d2b2a', '#ff5c97', '#fdf6ec', 'Fredoka'],
      ['d-yuruyen', '🧟 Dizi: Yürüyen Ölüler', '#1a1c14', '#a3b56b', '#e3e3d3', 'Eater'],
      ['d-siyah-ayna', '📱 Dizi: Siyah Ayna', '#000000', '#7dd3fc', '#f1f5f9', 'Space Grotesk'],
      ['d-kasket', '🎩 Dizi: Kasketli Çete', '#14110d', '#c9a26b', '#efe6d5', 'Playfair Display']
    ] as const
  ).map(([id, ad, arka, vurgu, metin, yazi]) =>
    tema(
      id,
      ad,
      { bgColor: arka, bgOpacity: 0.9, accentColor: vurgu, textColor: metin, radius: 14, fontFamily: yazi },
      { arka: `linear-gradient(135deg,${arka},${vurgu}55)`, vurgu, metin, kenar: vurgu, yazi }
    )
  )
];

/**
 * Hedef çubuğu temaları: dolgu stili, iki renk, çerçeve ve dolgunun ucundaki simge birlikte değişir.
 * Kendi renk/emoji birleşimlerimiz (oyun/film türü çağrışımı; marka, logo ya da görsel yok).
 * Yazılar hepsinde gölgeli ve geniş harf aralıklı: renkli sahnede de okunur.
 */
function hedefTema(
  id: string,
  etiket: string,
  renk: string,
  renk2: string,
  simge: string,
  ek: Record<string, unknown> = {}
): TemaTanimi {
  return tema(
    id,
    etiket,
    {
      barStyle: 'gradient',
      barColor: renk,
      barColor2: renk2,
      barBackground: '#1a1a1a',
      barBorderColor: '#ffffff',
      barBorderWidth: 3,
      barIcon: simge,
      barIconFlip: false,
      barHeight: 26,
      barRadius: 999,
      fontColor: '#ffffff',
      fontWeight: 900,
      fontSize: 18,
      letterSpacing: 2,
      textTransform: 'uppercase',
      textShadow: true,
      backgroundOpacity: 0,
      showGlow: true,
      ...ek
    },
    { arka: `linear-gradient(90deg,${renk},${renk2})`, vurgu: renk2, metin: '#ffffff', kenar: String(ek.barBorderColor || '#ffffff') }
  );
}

const HEDEF_TEMALARI: TemaTanimi[] = [
  hedefTema('h-cadilar', '🎃 Cadılar Bayramı', '#6d28d9', '#f97316', '🎃', { fontFamily: 'Montserrat' }),
  hedefTema('h-hayalet', '👻 Hayalet', '#7c3aed', '#c084fc', '👻', { fontFamily: 'Montserrat' }),
  hedefTema('h-korku', '🩸 Korku Gecesi', '#450a0a', '#dc2626', '🩸', { fontFamily: 'Metal Mania', barBorderColor: '#7f1d1d', letterSpacing: 3 }),
  hedefTema('h-zombi', '🧟 Zombi', '#365314', '#84cc16', '🧟', { fontFamily: 'Special Elite', barBorderColor: '#a3e635', barStyle: 'striped' }),
  hedefTema('h-arcade', '👾 Retro Arcade', '#ff2a6d', '#00f0ff', '👾', { fontFamily: 'Press Start 2P', fontSize: 12, barRadius: 0, barBorderColor: '#00f0ff', barStyle: 'striped' }),
  hedefTema('h-piksel', '⛏️ Piksel Madenci', '#5b8731', '#8b5a2b', '⛏️', { fontFamily: 'VT323', fontSize: 22, barRadius: 0, barBorderColor: '#3b2a1a', barBackground: '#2b2b2b' }),
  hedefTema('h-siberpunk', '⚡ Siberpunk', '#fcee0a', '#00f0ff', '⚡', { fontFamily: 'Audiowide', barRadius: 4, barBorderColor: '#fcee0a', barStyle: 'glossy' }),
  hedefTema('h-taktik', '🎯 Taktik', '#4d5d2a', '#ff6b00', '🎯', { fontFamily: 'Black Ops One', barRadius: 2, barBorderColor: '#c5b358' }),
  hedefTema('h-fantastik', '🗡️ Fantastik RPG', '#7b1e1e', '#d4af37', '🗡️', { fontFamily: 'Cinzel', barBorderColor: '#d4af37', barRadius: 8 }),
  hedefTema('h-ejderha', '🐉 Ejderha Ateşi', '#0f766e', '#fbbf24', '🐉', { barIconFlip: true, fontFamily: 'Cinzel', barBorderColor: '#fbbf24', barStyle: 'glossy' }),
  hedefTema('h-yaris', '🏎️ Yarış', '#dc2626', '#f5f5f5', '🏎️', { barIconFlip: true, fontFamily: 'Russo One', barRadius: 4, barStyle: 'striped', barBorderColor: '#e5e5e5' }),
  hedefTema('h-futbol', '⚽ Futbol', '#15803d', '#4ade80', '⚽', { fontFamily: 'Oswald', barBorderColor: '#ffffff', barStyle: 'striped' }),
  hedefTema('h-uzay', '🚀 Uzay Destanı', '#312e81', '#4fc3f7', '🚀', { fontFamily: 'Oxanium', barBorderColor: '#93c5fd', barStyle: 'glossy' }),
  hedefTema('h-vahsibati', '🤠 Vahşi Batı', '#8c1c13', '#e0a458', '🤠', { fontFamily: 'Rye', barBorderColor: '#e0a458', barRadius: 6 }),
  hedefTema('h-noir', '🎬 Kara Film', '#404040', '#e5e5e5', '🎬', { fontFamily: 'Special Elite', barBorderColor: '#e5e5e5', barRadius: 0 }),
  hedefTema('h-gala', '🍿 Sinema Galası', '#991b1b', '#e6b422', '🍿', { fontFamily: 'Bebas Neue', fontSize: 22, barBorderColor: '#e6b422', barStyle: 'glossy' }),
  hedefTema('h-cizgiroman', '💥 Çizgi Roman', '#dc2626', '#facc15', '💥', { fontFamily: 'Bangers', fontSize: 22, barBorderColor: '#000000', outlineEnabled: true, outlineColor: '#000000', outlineWidth: 1 }),
  hedefTema('h-anime', '🌸 Anime', '#ff6ec7', '#7df9ff', '🌸', { fontFamily: 'Poppins', barBorderColor: '#ffffff', barStyle: 'glossy' }),
  hedefTema('h-okyanus', '🐠 Okyanus', '#0369a1', '#2dd4bf', '🐠', { barIconFlip: true, fontFamily: 'Nunito', barBorderColor: '#a5f3fc' }),
  hedefTema('h-lav', '🌋 Lav', '#7c2d12', '#facc15', '🌋', { fontFamily: 'Anton', barBorderColor: '#fb923c', barStyle: 'striped' }),
  hedefTema('h-kis', '❄️ Kış', '#1e3a8a', '#e0f2fe', '❄️', { fontFamily: 'Nunito', barBorderColor: '#e0f2fe', barStyle: 'glossy' }),
  hedefTema('h-yilbasi', '🎄 Yılbaşı', '#b91c1c', '#16a34a', '🎄', { fontFamily: 'Montserrat', barBorderColor: '#fde68a', barStyle: 'striped' }),
  hedefTema('h-altin', '🏆 Altın Kupa', '#a16207', '#fde047', '🏆', { fontFamily: 'Oswald', barBorderColor: '#fef08a', barStyle: 'glossy' }),
  hedefTema('h-kick', '💚 Yeşil Neon', '#14532d', '#53fc18', '💚', { fontFamily: 'Russo One', barBorderColor: '#53fc18' }),
  hedefTema('h-batarya', '🔋 Batarya', '#16a34a', '#a3e635', '🔋', { fontFamily: 'Oxanium', barStyle: 'segment', barRadius: 6, barBorderColor: '#d9f99d', barHeight: 28 }),
  hedefTema('h-can', '❤️ Can Barı', '#b91c1c', '#f87171', '❤️', { fontFamily: 'Press Start 2P', fontSize: 12, barStyle: 'segment', barRadius: 0, barBorderColor: '#fecaca', barHeight: 28 }),
  hedefTema('h-mana', '🔮 Mana', '#1d4ed8', '#a78bfa', '🔮', { fontFamily: 'Cinzel', barStyle: 'parilti', barBorderColor: '#c7d2fe' }),
  hedefTema('h-galaksi', '🌌 Galaksi', '#4c1d95', '#22d3ee', '🌌', { fontFamily: 'Audiowide', barStyle: 'parilti', barBorderColor: '#a5f3fc' }),
  hedefTema('h-sakura', '🌸 Sakura', '#f472b6', '#fbcfe8', '🌸', { fontFamily: 'Nunito', barStyle: 'parilti', barBorderColor: '#ffffff', barBackground: '#500724' }),
  hedefTema('h-matrix', '💻 Matrix', '#003b00', '#00ff41', '💻', { fontFamily: 'VT323', fontSize: 22, barStyle: 'segment', barRadius: 0, barBorderColor: '#00ff41', barBackground: '#000000', fontColor: '#00ff41' }),
  hedefTema('h-vapor', '🌴 Vaporwave', '#ff71ce', '#01cdfe', '🌴', { fontFamily: 'Audiowide', barStyle: 'glossy', barBorderColor: '#fffb96', barBackground: '#2d1b4e' }),
  hedefTema('h-bakir', '🥉 Bakır', '#7c3f1d', '#e0a070', '🥉', { fontFamily: 'Oswald', barStyle: 'glossy', barRadius: 6, barBorderColor: '#f3c9a5' }),
  hedefTema('h-cikolata', '🍫 Çikolata', '#3f2412', '#a0693d', '🍫', { fontFamily: 'Baloo 2', barStyle: 'segment', barRadius: 8, barBorderColor: '#e7c9a9', barHeight: 28 }),
  hedefTema('h-tropik', '🍹 Tropik', '#f97316', '#2dd4bf', '🍹', { fontFamily: 'Kalam', barBorderColor: '#fef3c7' }),
  hedefTema('h-monokrom', '⬛ Siyah Beyaz', '#ffffff', '#a3a3a3', '', { fontFamily: 'Archivo Black', barRadius: 0, barBorderColor: '#ffffff', barBackground: '#000000', barBorderWidth: 2 }),
  hedefTema('h-sade', 'Sade (okunaklı)', '#10b981', '#10b981', '', { barStyle: 'flat', barBorderWidth: 0, barHeight: 20, fontFamily: 'Inter', fontSize: 16, letterSpacing: 1, backgroundOpacity: 0.85 })
];

/** Subathon sayacı temaları: görünüm (kart/dijital/çevirmeli/neon/hap), renkler, yazı tipleri ve simge birlikte. */
function sayacTema(id: string, etiket: string, gorunum: string, vurgu: string, vurgu2: string, arka: string, simge: string, ek: Record<string, unknown> = {}): TemaTanimi {
  return tema(
    id,
    etiket,
    { theme: gorunum, accentColor: vurgu, accentColor2: vurgu2, bgColor: arka, bgOpacity: 0.9, textColor: '#ffffff', icon: simge, radius: 16, ...ek },
    { arka: `linear-gradient(135deg,${arka},${vurgu2})`, vurgu, metin: '#ffffff', kenar: vurgu }
  );
}

const SAYAC_TEMALARI: TemaTanimi[] = [
  sayacTema('s-dijital', '📟 Dijital Saat', 'digital', '#39ff14', '#16a34a', '#030a03', '⏱️', { timeFontFamily: 'VT323', timeFontSize: 64, radius: 6 }),
  sayacTema('s-flip', '🗓️ Çevirmeli Kartlar', 'flip', '#f8fafc', '#94a3b8', '#1f2937', '⏳', { timeFontFamily: 'Oswald', timeFontSize: 56 }),
  sayacTema('s-neon', '💡 Neon', 'neon', '#ff2bd6', '#22d3ee', '#0b0420', '✨', { timeFontFamily: 'Audiowide', timeFontSize: 56 }),
  sayacTema('s-hap', '💊 Tek Satır', 'pill', '#22d3ee', '#34d399', '#000000', '⏳', { timeFontFamily: 'Oxanium', timeFontSize: 48 }),
  sayacTema('s-minimal', 'Minimal (yalnız süre)', 'minimal', '#ffffff', '#94a3b8', '#000000', '', { timeFontFamily: 'Bebas Neue', timeFontSize: 80, showRules: false }),
  sayacTema('s-arcade', '👾 Retro Arcade', 'digital', '#00f0ff', '#ff2a6d', '#0d0221', '👾', { fontFamily: 'Press Start 2P', timeFontFamily: 'Press Start 2P', timeFontSize: 36, radius: 0 }),
  sayacTema('s-siberpunk', '⚡ Siberpunk', 'neon', '#fcee0a', '#00f0ff', '#0a0014', '⚡', { fontFamily: 'Audiowide', timeFontFamily: 'Oxanium', radius: 2 }),
  sayacTema('s-bomba', '💣 Saatli Bomba', 'digital', '#ef4444', '#7f1d1d', '#0a0000', '💣', { timeFontFamily: 'VT323', timeFontSize: 68, radius: 4 }),
  sayacTema('s-taktik', '🎯 Taktik', 'card', '#c5b358', '#ff6b00', '#1b1f14', '🎯', { fontFamily: 'Black Ops One', timeFontFamily: 'Black Ops One', radius: 2 }),
  sayacTema('s-fantastik', '🗡️ Fantastik RPG', 'card', '#d4af37', '#7b1e1e', '#1a1208', '📜', { fontFamily: 'Cinzel', timeFontFamily: 'Cinzel', radius: 10 }),
  sayacTema('s-uzay', '🚀 Uzay Görevi', 'flip', '#4fc3f7', '#312e81', '#020818', '🚀', { fontFamily: 'Oxanium', timeFontFamily: 'Oxanium' }),
  sayacTema('s-korku', '🩸 Korku', 'neon', '#dc2626', '#450a0a', '#0a0000', '🕯️', { fontFamily: 'Metal Mania', timeFontFamily: 'Metal Mania', timeFontSize: 64 }),
  sayacTema('s-cadilar', '🎃 Cadılar Bayramı', 'card', '#f97316', '#6d28d9', '#1a0b2e', '🎃', { fontFamily: 'Montserrat', timeFontFamily: 'Bangers', timeFontSize: 64 }),
  sayacTema('s-vahsibati', '🤠 Vahşi Batı', 'card', '#e0a458', '#8c1c13', '#3e2412', '🤠', { fontFamily: 'Rye', timeFontFamily: 'Rye', radius: 4 }),
  sayacTema('s-gala', '🎬 Sinema', 'flip', '#e6b422', '#991b1b', '#2a0505', '🎬', { fontFamily: 'Bebas Neue', timeFontFamily: 'Bebas Neue', timeFontSize: 64 }),
  sayacTema('s-cizgiroman', '💥 Çizgi Roman', 'card', '#facc15', '#dc2626', '#1e3a8a', '💥', { fontFamily: 'Bangers', timeFontFamily: 'Bangers', timeFontSize: 64 }),
  sayacTema('s-anime', '🌸 Anime', 'pill', '#ff6ec7', '#7df9ff', '#1a0f2e', '🌸', { fontFamily: 'Poppins', timeFontFamily: 'Poppins' }),
  sayacTema('s-yilbasi', '🎄 Yılbaşı', 'card', '#fde68a', '#16a34a', '#7f1d1d', '🎄', { fontFamily: 'Montserrat', timeFontFamily: 'Oswald' }),
  sayacTema('s-cam', '🫧 Buzlu Cam', 'cam', '#e0f2fe', '#7dd3fc', '#0f172a', '🫧', { timeFontFamily: 'Jost', radius: 20 }),
  sayacTema('s-plaka', '📺 Yayın Plakası', 'plaka', '#ef4444', '#f97316', '#111827', '🔴', { fontFamily: 'Oswald', timeFontFamily: 'Oswald', timeFontSize: 60 }),
  sayacTema('s-serit', '🎗️ Şerit', 'serit', '#a855f7', '#22d3ee', '#0b0420', '⏳', { fontFamily: 'Montserrat', timeFontFamily: 'Oxanium', timeFontSize: 48 }),
  sayacTema('s-yaris', '🏁 Yarış Pisti', 'serit', '#dc2626', '#f5f5f5', '#111111', '🏁', { fontFamily: 'Russo One', timeFontFamily: 'Russo One', timeFontSize: 48 }),
  sayacTema('s-matrix', '💻 Matrix', 'digital', '#00ff41', '#003b00', '#000000', '💻', { fontFamily: 'VT323', timeFontFamily: 'VT323', timeFontSize: 68, radius: 0 }),
  sayacTema('s-altin', '🏆 Altın Kupa', 'plaka', '#fde047', '#a16207', '#1c1403', '🏆', { fontFamily: 'Cinzel', timeFontFamily: 'Cinzel' }),
  sayacTema('s-kick', '💚 Yeşil Neon', 'neon', '#53fc18', '#14532d', '#050f02', '💚', { fontFamily: 'Russo One', timeFontFamily: 'Russo One' }),
  sayacTema('s-okyanus', '🐠 Okyanus', 'cam', '#2dd4bf', '#0369a1', '#042f4b', '🐠', { fontFamily: 'Nunito', timeFontFamily: 'Nunito', radius: 24 }),
  sayacTema('s-sakura', '🌸 Sakura', 'cam', '#fbcfe8', '#f472b6', '#500724', '🌸', { fontFamily: 'Nunito', timeFontFamily: 'Baloo 2', radius: 24 }),
  sayacTema('s-kagit', '📄 Kâğıt', 'plaka', '#b91c1c', '#7c2d12', '#fef3c7', '📄', { fontFamily: 'Special Elite', timeFontFamily: 'Special Elite', textColor: '#1f2937' }),
  sayacTema('s-lav', '🌋 Lav', 'flip', '#fb923c', '#7c2d12', '#1c0a02', '🌋', { fontFamily: 'Anton', timeFontFamily: 'Anton', timeFontSize: 60 })
];

/** Widget'a özel ek temalar. */
/** Tahtın Kralı temaları: görünüm, renkler ve yazı tipi birlikte */
function kralTema(id: string, etiket: string, gorunum: string, vurgu: string, arka: string, metin: string, ek: Record<string, unknown> = {}): TemaTanimi {
  return tema(
    id,
    etiket,
    { theme: gorunum, accentColor: vurgu, borderColor: vurgu, bgColor: arka, bgOpacity: 0.9, textColor: metin, ...ek },
    { arka, vurgu, metin, kenar: vurgu }
  );
}

const KRAL_TEMALARI: TemaTanimi[] = [
  kralTema('k-taht', '👑 Taht Odası', 'taht', '#d4af37', '#2a0f12', '#fff7e0', { fontFamily: 'Cinzel' }),
  kralTema('k-altin', '🏆 Altın Levha', 'altin', '#7c4a03', '#d4af37', '#2b1a00', { fontFamily: 'Cinzel', bgOpacity: 1 }),
  kralTema('k-gumus', '🥈 Gümüş', 'plate', '#475569', '#e5e7eb', '#111827', { fontFamily: 'Oswald', bgOpacity: 0.95 }),
  kralTema('k-alev', '🔥 Alev Kralı', 'alev', '#f97316', '#1c0a02', '#fff7ed', { fontFamily: 'Anton' }),
  kralTema('k-buz', '❄️ Buz Kralı', 'buz', '#7dd3fc', '#082f49', '#f0f9ff', { fontFamily: 'Jost' }),
  kralTema('k-zehir', '🐍 Zehir', 'neon', '#84cc16', '#0a1402', '#ecfccb', { fontFamily: 'Russo One' }),
  kralTema('k-gece', '🌙 Gece Sarayı', 'glass', '#c4b5fd', '#1e1b4b', '#ffffff', { fontFamily: 'Montserrat' }),
  kralTema('k-kick', '💚 Yeşil Neon', 'neon', '#53fc18', '#050f02', '#ffffff', { fontFamily: 'Russo One' }),
  kralTema('k-arcade', '👾 Retro Arcade', 'kart', '#ff2a6d', '#0d0221', '#00f0ff', { fontFamily: 'Press Start 2P', fontSize: 13, radius: 0 }),
  kralTema('k-cizgi', '💥 Çizgi Roman', 'kart', '#dc2626', '#facc15', '#111827', { fontFamily: 'Bangers', fontSize: 24, radius: 4, bgOpacity: 1 }),
  kralTema('k-siberpunk', '⚡ Siberpunk', 'serit', '#fcee0a', '#0a0014', '#ffffff', { fontFamily: 'Audiowide', radius: 2 }),
  kralTema('k-sade', 'Yalnız yazı', 'minimal', '#fbbf24', '#000000', '#ffffff', { fontFamily: 'Plus Jakarta Sans' })
];

const cekilisTema = (id: string, etiket: string, kasaTema: string, kabuk: string, arka: string, vurgu: string, metin: string, yazi: string, ek: Record<string, unknown> = {}): TemaTanimi =>
  tema(id, etiket, { kasaTema, kabuk, backgroundColor: arka, backgroundOpacity: 0.92, accentColor: vurgu, fontColor: metin, fontFamily: yazi, ...ek }, { arka, vurgu, metin, yazi });

const CEKILIS_TEMALARI: TemaTanimi[] = [
  cekilisTema('c-kasa', '🎁 Kasa Açılışı', 'kart', 'softcard', '#111827', '#f59e0b', '#ffffff', 'Rajdhani'),
  cekilisTema('c-neon', '⚡ Neon Arena', 'neon', 'stage', '#0a0118', '#e879f9', '#ffffff', 'Audiowide'),
  cekilisTema('c-hazine', '👑 Altın Hazine', 'altin', 'altin', '#14100a', '#d4a843', '#f5e6c4', 'Cinzel'),
  cekilisTema('c-piksel', '👾 Piksel Arcade', 'piksel', 'compact', '#0b1020', '#22d3ee', '#ffffff', 'VT323', { fontSize: 22 }),
  cekilisTema('c-bilet', '🎟️ Şanslı Bilet', 'bilet', 'guestpass', '#1c1208', '#fb923c', '#fff7ed', 'Bebas Neue', { fontSize: 22 }),
  cekilisTema('c-kumarhane', '🎰 Kumarhane', 'kumarhane', 'horizon', '#1a0505', '#fbbf24', '#fef3c7', 'Playfair Display'),
  cekilisTema('c-uzay', '🚀 Uzay Kapsülü', 'neon', 'prism', '#05060f', '#38bdf8', '#f8fafc', 'Oxanium'),
  cekilisTema('c-sade', '⬜ Sade Yayın', 'sade', 'borderline', '#000000', '#ffffff', '#ffffff', 'Oswald', { backgroundOpacity: 0.6 })
];

export const WIDGET_TEMALARI: Record<string, TemaTanimi[]> = {
  giveaways: CEKILIS_TEMALARI,
  king: KRAL_TEMALARI,
  subathon: SAYAC_TEMALARI,
  'donation-goal': HEDEF_TEMALARI,
  'follower-goal': HEDEF_TEMALARI,
  'subscriber-goal': HEDEF_TEMALARI,
  'kicks-goal': HEDEF_TEMALARI,
  'wheel-of-fortune': [
    tema('gokkusagi', 'Gökkuşağı', { borderColor: P.beyaz, fontColor: P.beyaz, outlineEnabled: true }, { arka: 'conic-gradient(red,orange,yellow,green,blue,violet,red)', vurgu: P.beyaz, metin: P.beyaz }),
    tema('vegas', 'Vegas', { borderColor: P.amber, fontColor: P.beyaz, pointerColor: P.kirmizi, outlineEnabled: true }, { arka: '#7f1d1d', vurgu: P.amber, metin: P.beyaz }),
    tema('slot', 'Slot Makinesi', { borderColor: '#334155', fontColor: '#f8fafc', pointerColor: P.amber, palette: 'slot' }, { arka: '#1e293b', vurgu: P.amber, metin: '#f8fafc' }),
    // Her renk paleti bir tema: çerçeve ve ibre palete uyar (palet: WheelWidget CARK_PALETLERI)
    ...(
      [
        ['rainbow', '🌈 Gökkuşağı', '#ffffff', '#ef4444'],
        ['red', 'Kırmızı', '#fecaca', '#fbbf24'],
        ['green', 'Yeşil', '#bbf7d0', '#fbbf24'],
        ['blue', 'Mavi', '#bfdbfe', '#f43f5e'],
        ['yellow', 'Sarı', '#fef9c3', '#1f2937'],
        ['cyan', 'Turkuaz', '#a5f3fc', '#f43f5e'],
        ['magenta', 'Macenta', '#f5d0fe', '#22d3ee'],
        ['orange', 'Turuncu', '#fed7aa', '#1f2937'],
        ['purple', 'Mor', '#ddd6fe', '#fbbf24'],
        ['pink', 'Pembe', '#fbcfe8', '#22d3ee'],
        ['brown', 'Kahve', '#e7c9a9', '#facc15'],
        ['white', 'Beyaz', '#94a3b8', '#ef4444'],
        ['confetti', '🎉 Konfeti', '#ffffff', '#f43f5e'],
        ['kart', '🃏 Kart Oyunu', '#111827', '#111827'],
        ['kagit', '✂️ Kâğıt İşi', '#a8a29e', '#ef4444'],
        ['piksel', '🟩 Piksel Macera', '#1f2937', '#facc15'],
        ['noir', '🖤 Kara Lüks', '#ca8a04', '#ca8a04'],
        ['candy', '🍬 Şeker', '#ffffff', '#fb7185'],
        ['aurora', '🌌 Kutup Işığı', '#a5f3fc', '#f0abfc'],
        ['slate', 'Arduvaz', '#94a3b8', '#22d3ee'],
        ['inferno', '🔥 Cehennem', '#facc15', '#facc15'],
        ['neon', '💡 Neon Işıltı', '#ffffff', '#ff2bd6'],
        ['carnival', '🎪 Karnaval', '#facc15', '#dc2626'],
        ['hacker', '💻 Hacker', '#22c55e', '#22c55e'],
        ['retro8', '👾 Retro 8-bit', '#ffffff', '#ffec27'],
        ['vegas', '🎰 Vegas', '#facc15', '#facc15'],
        ['matrix', '🟢 Matrix', '#00ff41', '#00ff41']
      ] as const
    ).map(([palet, ad, kenar, ibre]) =>
      tema(`p-${palet}`, ad, { palette: palet, borderColor: kenar, pointerColor: ibre, outlineEnabled: true, outlineColor: '#000000' }, // Önizleme yazısı zeminde okunsun: çerçeve rengi zemine yakınsa düz yazı rengi
      { arka: palet === 'white' ? '#e2e8f0' : '#1e293b', vurgu: ibre, metin: palet === 'white' ? '#0f172a' : palet === 'kart' || palet === 'piksel' ? '#ffffff' : kenar, kenar })
    )
  ],
  'chat-overlay': [
    tema('sohbetseffaf', 'Saf Şeffaf', { chatStyle: 'klasik', messageBgTransparent: true, transparentBg: true, textShadow: true, outlineEnabled: true }, { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz }),
    tema('pencere95', 'Eski Pencere', { chatStyle: 'pencere', messageBgTransparent: false, textShadow: false, fontFamily: 'Silkscreen' }, { arka: '#c0c0c0', vurgu: '#000080', metin: '#000000' }),
    tema('sivicam', 'Sıvı Cam', { chatStyle: 'sivicam', messageBgTransparent: false, textColor: P.beyaz, textShadow: true, fontFamily: 'Outfit' }, { arka: 'rgba(255,255,255,.14)', vurgu: P.beyaz, metin: P.beyaz }),
    tema('komutsatiri', 'Komut Satırı', { chatStyle: 'terminal', messageBgTransparent: false, textShadow: false, showAvatars: false, showBadges: false }, { arka: '#020b05', vurgu: '#22c55e', metin: '#86efac', yazi: 'Fira Code' }),
    tema('notkagidi', 'Not Kağıdı', { chatStyle: 'yapiskan', messageBgTransparent: false, textShadow: false, fontFamily: 'Kalam' }, { arka: '#fde68a', vurgu: '#92400e', metin: '#3f2d06', yazi: 'Kalam' }),
    tema('oyundiyalogu', 'Oyun Diyaloğu', { chatStyle: 'rpg', messageBgTransparent: false, textColor: P.beyaz, textShadow: false, fontFamily: 'Pixelify Sans' }, { arka: '#0f1535', vurgu: '#fde68a', metin: P.beyaz, yazi: 'Pixelify Sans' }),
    tema('cizgibalon', 'Çizgi Balon', { chatStyle: 'cizgiroman', messageBgTransparent: false, textShadow: false, fontFamily: 'Bangers' }, { arka: '#ffffff', vurgu: '#111111', metin: '#111111', yazi: 'Bangers' }),
    tema('yayinbandi', 'Yayın Bandı', { chatStyle: 'yayinbandi', messageBgTransparent: false, platformColors: true, messageBgColor: '#0b0f17', messageBgOpacity: 0.92, textColor: P.beyaz, textShadow: false, fontFamily: 'Barlow Condensed' }, { arka: '#0b0f17', vurgu: P.kick, metin: P.beyaz, yazi: 'Barlow Condensed' }),
    tema('renkgecisi', 'Renk Geçişi', { chatStyle: 'gecis', messageBgTransparent: false, borderRadius: 14, textColor: P.beyaz, textShadow: true, fontFamily: 'Poppins' }, { arka: 'linear-gradient(100deg,#a78bfa,transparent)', vurgu: P.mor, metin: P.beyaz }),
    tema('altcizgi', 'Alt Çizgi', { chatStyle: 'altcizgi', messageBgTransparent: true, textColor: P.beyaz, textShadow: true, fontFamily: 'Jost' }, { arka: 'transparent', vurgu: P.pembe, metin: P.beyaz }),
    tema('buyukyazi', 'Büyük Okunur', { chatStyle: 'klasik', messageBgTransparent: true, fontSize: 30, fontWeight: 800, outlineEnabled: true, outlineWidth: 1, outlineColor: '#000000', textShadow: true, fontFamily: 'Rubik', showTimestamp: false }, { arka: 'transparent', vurgu: P.amber, metin: P.beyaz, yazi: 'Rubik' }),
    tema('yayinci', 'Temiz Satır', { chatStyle: 'klasik', messageBgTransparent: true, nameOnOwnLine: true, fontFamily: 'Open Sans', textShadow: true, showTimestamp: false, showBadges: true }, { arka: 'transparent', vurgu: P.turkuaz, metin: P.beyaz, yazi: 'Open Sans' }),
    tema('baloncuk', 'Baloncuk', { messageBubbles: true, messageBgColor: '#1e293b', messageBgOpacity: 0.9, borderRadius: 22 }, { arka: '#1e293b', vurgu: P.turkuaz, metin: P.beyaz }),
    tema('yanmenu', 'Yan Şerit', { messageBubbles: true, messageBgColor: '#1e1033', messageBgOpacity: 0.7, borderRadius: 4, textColor: P.beyaz, highlightColor: P.mor, highlightSpecial: true }, { arka: 'rgba(30,16,51,.7)', vurgu: P.mor, metin: P.beyaz }),
    tema('seffaf', 'Tamamen Şeffaf', { transparentBg: true, messageBgOpacity: 0, textShadow: true }, { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz }),
    // Örnek alınan botta 24 hazır sohbet tasarımı gözlemlendi; bizdekiler kendi renk/ayar birleşimlerimiz
    tema('neon', 'Neon', { messageBubbles: true, messageBgColor: '#0b0420', messageBgOpacity: 0.85, borderRadius: 10, textColor: P.beyaz, highlightColor: P.pembe, highlightSpecial: true, outlineEnabled: false, textShadow: true }, { arka: '#0b0420', vurgu: P.pembe, metin: P.beyaz }),
    tema('karbon', 'Karbon', { messageBubbles: true, messageBgColor: '#111827', messageBgOpacity: 0.92, borderRadius: 6, textColor: '#e5e7eb', highlightColor: P.gri, textShadow: false }, { arka: '#111827', vurgu: P.gri, metin: '#e5e7eb' }),
    tema('beyazkart', 'Beyaz Kart', { messageBubbles: true, messageBgColor: P.beyaz, messageBgOpacity: 0.95, borderRadius: 14, textColor: '#111827', usernameColorMode: 'user', textShadow: false, outlineEnabled: false }, { arka: P.beyaz, vurgu: P.mor, metin: '#111827' }),
    tema('hacker', 'Hacker', { messageBubbles: true, messageBgColor: P.siyah, messageBgOpacity: 0.8, borderRadius: 0, textColor: P.kick, fontFamily: 'Consolas, monospace', usernameColorMode: 'custom', customUsernameColor: P.kick, textShadow: false }, { arka: P.siyah, vurgu: P.kick, metin: P.kick }),
    tema('gunbatimi', 'Gün Batımı', { messageBubbles: true, messageBgColor: '#7c2d12', messageBgOpacity: 0.75, borderRadius: 16, textColor: '#fff7ed', highlightColor: P.amber, highlightSpecial: true }, { arka: 'linear-gradient(135deg,#7c2d12,#be185d)', vurgu: P.amber, metin: '#fff7ed' }),
    tema('pastel', 'Pastel', { messageBubbles: true, messageBgColor: '#fce7f3', messageBgOpacity: 0.92, borderRadius: 18, textColor: '#4c1d95', usernameColorMode: 'custom', customUsernameColor: '#be185d', textShadow: false }, { arka: '#fce7f3', vurgu: '#be185d', metin: '#4c1d95' }),
    tema('cam', 'Buzlu Cam', { messageBubbles: true, messageBgColor: P.beyaz, messageBgOpacity: 0.12, borderRadius: 12, textColor: P.beyaz, textShadow: true }, { arka: 'rgba(255,255,255,.12)', vurgu: P.turkuaz, metin: P.beyaz }),
    tema('aurora', 'Kutup Işığı', { messageBubbles: true, messageBgColor: '#0f172a', messageBgOpacity: 0.7, borderRadius: 14, textColor: '#e0f2fe', highlightColor: '#2dd4bf', highlightSpecial: true, textShadow: true }, { arka: 'linear-gradient(135deg,#0f766e,#6366f1)', vurgu: '#2dd4bf', metin: '#e0f2fe' }),
    tema('pasta', 'Pasta', { messageBubbles: true, messageBgColor: '#fff1f2', messageBgOpacity: 0.95, borderRadius: 20, textColor: '#831843', usernameColorMode: 'custom', customUsernameColor: '#db2777', textShadow: false }, { arka: '#fff1f2', vurgu: '#db2777', metin: '#831843' }),
    tema('akis', 'Akış Çizgisi', { messageBubbles: true, messageBgColor: '#000000', messageBgOpacity: 0.6, borderRadius: 2, textColor: P.beyaz, highlightColor: P.turkuaz, highlightSpecial: true, gap: 4 }, { arka: 'rgba(0,0,0,.6)', vurgu: P.turkuaz, metin: P.beyaz }),
    tema('neonkart', 'Neon Kartlar', { messageBubbles: true, messageBgColor: '#12002b', messageBgOpacity: 0.9, borderRadius: 12, textColor: P.beyaz, highlightColor: '#22d3ee', highlightSpecial: true, textShadow: true }, { arka: '#12002b', vurgu: '#22d3ee', metin: P.beyaz, kenar: '#ff2bd6' }),
    tema('pikselsohbet', 'Piksel Macera', { messageBubbles: true, messageBgColor: '#1f2937', messageBgOpacity: 0.9, borderRadius: 0, textColor: '#f1f8e9', fontFamily: 'VT323', fontSize: 26, highlightColor: '#7cc242' }, { arka: '#1f2937', vurgu: '#7cc242', metin: '#f1f8e9' }),
    tema('yuvarlak', 'Yuvarlak', { messageBubbles: true, messageBgColor: '#2e1065', messageBgOpacity: 0.85, borderRadius: 999, textColor: P.beyaz, highlightColor: P.mor, gap: 8 }, { arka: '#2e1065', vurgu: P.mor, metin: P.beyaz }),
    tema('gokyuzu', 'Gökyüzü', { messageBubbles: true, messageBgColor: '#e0f2fe', messageBgOpacity: 0.92, borderRadius: 16, textColor: '#0c4a6e', usernameColorMode: 'custom', customUsernameColor: '#0284c7', textShadow: false }, { arka: '#e0f2fe', vurgu: '#0284c7', metin: '#0c4a6e' }),
    tema('pencerecami', 'Pencere Camı', { messageBubbles: true, messageBgColor: '#ffffff', messageBgOpacity: 0.18, borderRadius: 6, textColor: P.beyaz, textShadow: true }, { arka: 'rgba(255,255,255,.18)', vurgu: P.beyaz, metin: P.beyaz, kenar: 'rgba(255,255,255,.5)' }),
    tema('mesajlasma', 'Mesajlaşma Uygulaması', { messageBubbles: true, messageBgColor: '#dcf8c6', messageBgOpacity: 0.97, borderRadius: 14, textColor: '#111b21', usernameColorMode: 'custom', customUsernameColor: '#075e54', textShadow: false }, { arka: '#dcf8c6', vurgu: '#075e54', metin: '#111b21' }),
    tema('retro', 'Retro', { messageBubbles: true, messageBgColor: '#2b1d0e', messageBgOpacity: 0.9, borderRadius: 4, textColor: '#fde68a', fontFamily: 'Special Elite', highlightColor: '#f97316' }, { arka: '#2b1d0e', vurgu: '#f97316', metin: '#fde68a' }),
    tema('kadife', 'Kadife', { messageBubbles: true, messageBgColor: '#3b0a1f', messageBgOpacity: 0.88, borderRadius: 14, textColor: '#fce7f3', highlightColor: '#e11d48', highlightSpecial: true }, { arka: 'linear-gradient(135deg,#3b0a1f,#7f1d1d)', vurgu: '#e11d48', metin: '#fce7f3' }),
    tema('kickyesili', 'Kick Yeşili', { messageBubbles: true, messageBgColor: '#0f1a0a', messageBgOpacity: 0.88, borderRadius: 8, textColor: P.beyaz, highlightColor: P.kick, highlightSpecial: true }, { arka: '#0f1a0a', vurgu: P.kick, metin: P.beyaz }),
    // Görünüm stilli temalar: platformların özgün renkleri, logoları ve rozetleriyle
    tema('platformkartlari', 'Platform Kartları', { chatStyle: 'platformkart', platformColors: true, messageBgColor: '#0b0f17', messageBgOpacity: 0.85, borderRadius: 10, textColor: P.beyaz, showPlatformLogo: true, showBadges: true, textShadow: false }, { arka: 'linear-gradient(90deg,#53fc1840,#0b0f17)', vurgu: P.kick, metin: P.beyaz, kenar: P.kick }),
    tema('konusmabalonu', 'Konuşma Balonları', { chatStyle: 'konusma', platformColors: true, messageBgColor: '#111827', messageBgOpacity: 0.92, borderRadius: 16, textColor: P.beyaz, showAvatars: true, textShadow: false }, { arka: '#111827', vurgu: '#9146ff', metin: P.beyaz, kenar: '#9146ff' }),
    tema('adetiketi', 'Ad Etiketleri', { chatStyle: 'etiket', platformColors: true, messageBgOpacity: 0, transparentBg: true, textColor: P.beyaz, textShadow: true }, { arka: 'transparent', vurgu: P.kick, metin: P.beyaz }),
    tema('markaseridi', 'Marka Şeridi', { chatStyle: 'serit', messageBgColor: '#0b0f17', messageBgOpacity: 0.9, borderRadius: 8, textColor: P.beyaz, textShadow: false }, { arka: 'linear-gradient(90deg,#9146ff 18%,#0b0f17 18%)', vurgu: '#9146ff', metin: P.beyaz }),
    tema('platformneonu', 'Platform Neonu', { chatStyle: 'neon', platformColors: true, messageBgColor: '#05010d', messageBgOpacity: 0.85, borderRadius: 12, textColor: P.beyaz, textShadow: true }, { arka: '#05010d', vurgu: '#ff0000', metin: P.beyaz, kenar: '#ff0000' }),
    tema('basliklimesaj', 'Başlıklı Mesaj', { chatStyle: 'baslikli', platformColors: true, messageBgColor: '#1e293b', messageBgOpacity: 0.9, borderRadius: 14, textColor: '#f1f5f9', highlightSpecial: true, textShadow: false }, { arka: '#1e293b', vurgu: P.turkuaz, metin: '#f1f5f9' }),
    tema('incesatir', 'İnce Satır', { chatStyle: 'kompakt', transparentBg: true, messageBgOpacity: 0, textColor: P.beyaz, textShadow: true, showTimestamp: false, showAvatars: false }, { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz }),
    tema('oyunhud', 'Oyun HUD', { chatStyle: 'platformkart', platformColors: true, messageBgColor: '#020617', messageBgOpacity: 0.85, borderRadius: 0, fontFamily: 'Rajdhani', fontWeight: 700, textColor: '#e2e8f0', textShadow: false }, { arka: '#020617', vurgu: P.turkuaz, metin: '#e2e8f0', kenar: P.turkuaz, yazi: 'Rajdhani' })
  ],
  polls: [
    tema('savas', 'Düello', { barColor: '#f87171', barBackground: '#1e40af', showVotes: true }, { arka: '#1e293b', vurgu: P.kirmizi, metin: P.beyaz }),
    tema('yayin', 'Yayın Bandı', { barColor: P.turkuaz, barBackground: '#0f172a', borderRadius: 4 }, { arka: '#0f172a', vurgu: P.turkuaz, metin: P.beyaz }),
    tema('kompakt', 'Kompakt Kapışma', { barColor: '#f97316', barBackground: '#1e3a8a', borderRadius: 6, fontSize: 12, backgroundOpacity: 0.85 }, { arka: '#1e3a8a', vurgu: '#f97316', metin: P.beyaz }),
    tema('platform', 'Platform Rengi', { barColor: P.kick, barBackground: '#0f1a0a', titleColor: P.kick, borderColor: P.kick }, { arka: '#0f1a0a', vurgu: P.kick, metin: P.beyaz }),
    tema('baloncuk', 'Baloncuklar', { barColor: '#38bdf8', barBackground: '#0c4a6e', borderRadius: 24, titleColor: '#bae6fd', borderColor: '#38bdf8' }, { arka: '#0c4a6e', vurgu: '#38bdf8', metin: P.beyaz }),
    tema('beyaz', 'Beyaz', { backgroundColor: '#ffffff', backgroundOpacity: 0.95, fontColor: '#111827', titleColor: '#4f46e5', barColor: '#4f46e5', barBackground: '#e5e7eb', borderColor: '#e5e7eb' }, { arka: '#ffffff', vurgu: '#4f46e5', metin: '#111827' }),
    tema('pasta', 'Pasta', { backgroundColor: '#fff1f2', backgroundOpacity: 0.95, fontColor: '#831843', titleColor: '#db2777', barColor: '#db2777', barBackground: '#fce7f3', borderColor: '#f9a8d4', borderRadius: 22 }, { arka: '#fff1f2', vurgu: '#db2777', metin: '#831843' }),
    tema('hacker', 'Hacker', { backgroundColor: '#000000', fontColor: '#22c55e', titleColor: '#4ade80', barColor: '#16a34a', barBackground: '#052e16', borderColor: '#16a34a', borderRadius: 0, fontFamily: 'VT323', fontSize: 18 }, { arka: '#000000', vurgu: '#22c55e', metin: '#22c55e' }),
    tema('neon', 'Neon', { backgroundColor: '#0b0420', fontColor: P.beyaz, titleColor: '#ff2bd6', barColor: '#ff2bd6', barBackground: '#1e0b3a', borderColor: '#22d3ee' }, { arka: '#0b0420', vurgu: '#ff2bd6', metin: P.beyaz, kenar: '#22d3ee' }),
    tema('yuvarlak', 'Yuvarlak', { borderRadius: 28, barColor: P.mor, barBackground: '#1e1b4b', titleColor: '#c4b5fd', borderColor: P.mor }, { arka: '#1e1b4b', vurgu: P.mor, metin: P.beyaz }),
    tema('isinkilici', 'Işın Kılıcı', { backgroundColor: '#020617', barColor: '#38bdf8', barBackground: '#0f172a', titleColor: '#e0f2fe', borderColor: '#38bdf8', borderRadius: 999, fontFamily: 'Oxanium' }, { arka: '#020617', vurgu: '#38bdf8', metin: '#e0f2fe' }),
    tema('kapisma', 'Kapışma', { barColor: '#f87171', barBackground: '#1e3a8a', titleColor: '#fde047', borderColor: '#fde047', fontFamily: 'Russo One' }, { arka: 'linear-gradient(90deg,#f87171,#1e3a8a)', vurgu: '#fde047', metin: P.beyaz }),
    tema('minimalanket', 'Minimal', { backgroundOpacity: 0, borderColor: '#ffffff', barColor: '#ffffff', barBackground: '#ffffff33', titleColor: '#ffffff', outlineEnabled: true }, { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz })
  ]
};

/** Bir widget için kullanılabilir tüm temalar. */
export function temalar(widgetId: string): TemaTanimi[] {
  // Sohbetin eski temaları görünüm stilini belirtmez: başka stilden geçince klasik görünüme dönsün
  const ozel = (WIDGET_TEMALARI[widgetId] || []).map((t) =>
    widgetId === 'chat-overlay' && !('chatStyle' in t.degerler) ? { ...t, degerler: { chatStyle: 'klasik', ...t.degerler } } : t
  );
  const genel = GENEL_TEMALAR.filter((t) => !t.widgetlar || t.widgetlar.includes(widgetId));
  return [...ozel, ...genel]; // Widget'a özel temalar önce: hedef çubuğunda asıl seçenekler onlar
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
  tanimliAnahtarlar: string[],
  /** Seçmeli alanların geçerli değerleri: tema geçersiz bir görünüm yazmasın (ör. çarka "classic") */
  gecerli?: (anahtar: string, deger: unknown) => boolean
): Record<string, unknown> {
  const izinli = new Set(tanimliAnahtarlar);
  const yeni = { ...mevcut };
  const gorunumKondu = new Set<string>();
  // Ortak kutu tasarımı yalnız onu seçen temada kalır
  if (izinli.has('kabuk')) yeni.kabuk = '';
  for (const [k, v] of Object.entries(tema.degerler)) {
    if (gecerli && !gecerli(k, v)) continue;
    if (izinli.has(k) && GORUNUM_ANAHTARLARI.includes(k)) gorunumKondu.add(k);
    if (izinli.has(k)) yeni[k] = v;
    // Genel anahtarı widget kendi adıyla tanıyor (hedef barı: barColor/backgroundColor/fontColor);
    // tema o alanı ayrıca belirttiyse ona dokunulmaz
    for (const es of ESANLAMLI[k] || []) {
      if (izinli.has(es) && !(es in tema.degerler)) yeni[es] = v;
    }
  }
  // Görünüm (yerleşim) de değişsin: temanın istediği görünüm bu widget'ta yoksa (ör. shoutout'ta "classic")
  // eskiden yalnız renkler değişiyordu. Temanın aday görünümlerinden widget'ta olan ilki seçilir.
  if (gecerli) {
    const aile = AILELER[TEMA_AILESI[tema.id]];
    const adaylar = [...(GORUNUM_ADAYLARI[tema.id] || []), ...(GORUNUM_ADAYLARI[String(tema.degerler.theme)] || []), ...(aile?.gorunum || [])];
    let bicimDegisti = gorunumKondu.size > 0;
    for (const k of GORUNUM_ANAHTARLARI) {
      if (!izinli.has(k) || gorunumKondu.has(k)) continue;
      const bulunan = adaylar.find((a) => gecerli(k, a));
      if (bulunan) {
        yeni[k] = bulunan;
        bicimDegisti = true;
      }
    }
    // Görünüm seçeneği olmayan widget'ta (anket, çekiliş, hedef…) tema yalnız renk değiştiriyordu: kutu biçimi de değişsin
    if (!bicimDegisti && aile && izinli.has('kabuk') && !tema.degerler.kabuk && gecerli('kabuk', aile.kabuk)) yeni.kabuk = aile.kabuk;
  }
  // Genel temalar yalnız ana rengi veriyordu: çubuğun zemini, ikinci rengi, kenarı ve dolgu biçimi
  // (ve altyazı/bağlam gibi yan renkler) önceki temada kalıyordu. Temanın kendi renklerinden türetilir.
  for (const [k, v] of Object.entries(turetilenler(tema, String(yeni.kabuk || '')))) {
    if (!izinli.has(k) || k in tema.degerler || v === undefined) continue;
    if (gecerli && !gecerli(k, v)) continue;
    yeni[k] = v;
  }
  return yeni;
}

/** #rgb / #rrggbb / #rrggbbaa → [r, g, b]; tanınmazsa null */
function hexRgb(renk: unknown): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(String(renk || ''));
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((x) => x + x).join('') : m[1].slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** İki rengi `oran` kadar karıştırır (0 = a, 1 = b) */
export function renkKaristir(a: unknown, b: unknown, oran: number): string | undefined {
  const x = hexRgb(a);
  if (!x) return undefined;
  const y = hexRgb(b) || x;
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * oran).toString(16).padStart(2, '0')).join('');
}

/** Saydamlık ekli renk (#rrggbbaa) */
function saydam(renk: unknown, alfa: number): string | undefined {
  const r = renkKaristir(renk, renk, 0);
  return r ? r + Math.round(alfa * 255).toString(16).padStart(2, '0') : undefined;
}

/** Kutu tasarımına (ya da tema ailesine) yakışan çubuk: [dolgu biçimi, köşe, kenar kalınlığı] */
const BAR_BICIMLERI: Record<string, [string, number, number?]> = {
  holo: ['parilti', 999], crt: ['segment', 0], brutal: ['flat', 0, 3], defter: ['striped', 6], ampul: ['noktalar', 999],
  siber: ['segment', 2], kil: ['glossy', 999], krom: ['glossy', 999], plan: ['striped', 0], bilet: ['pil', 4],
  origami: ['kama', 0], vapor: ['gradient', 0], manga: ['striped', 0, 3], vitray: ['segment', 4], lav: ['dalga', 999],
  perde: ['gradient', 6], arcade: ['segment', 0], kaset: ['pil', 4], polaroid: ['flat', 2], postit: ['striped', 2],
  piksel: ['segment', 0, 2], ahsap: ['gradient', 4, 2], film: ['segment', 0], buz: ['parilti', 999], washi: ['striped', 4],
  rozet: ['glossy', 999, 2], sivicam: ['parilti', 999], pencere: ['flat', 0, 2], gameboy: ['segment', 0], yapiskan: ['flat', 2],
  parsomen: ['gradient', 4], cizgiroman: ['striped', 0, 3], gecedalga: ['dalga', 999], altin: ['glossy', 999, 2], koseli: ['kama', 0],
  kupon: ['segment', 6], terminal: ['segment', 2], gazete: ['striped', 0, 2], neontabela: ['parilti', 999, 2], karton: ['striped', 2],
  mermer: ['glossy', 4, 1], sakiz: ['glossy', 999],
  // Kutusu olmayan temalar ailesine göre
  'aile:kart': ['gradient', 999], 'aile:sade': ['flat', 999], 'aile:cam': ['glossy', 999], 'aile:neon': ['parilti', 999],
  'aile:uzay': ['parilti', 999], 'aile:asil': ['glossy', 8, 2], 'aile:doga': ['dalga', 999], 'aile:cizgi': ['striped', 6, 2],
  'aile:piksel': ['segment', 0], 'aile:taktik': ['segment', 2], 'aile:korku': ['dalga', 4], 'aile:bati': ['gradient', 4, 2],
  'aile:yayin': ['striped', 2], 'aile:eglence': ['glossy', 999]
};

/** Temanın belirtmediği yan alanlar: çubuk biçimi ve renkleri, yazı dış çizgisi, altyazı/bağlam renkleri */
function turetilenler(tema: TemaTanimi, kabuk: string): Record<string, unknown> {
  const d = tema.degerler;
  const vurgu = d.accentColor ?? d.barColor;
  const metin = d.textColor ?? d.fontColor;
  const arka = d.bgColor ?? d.backgroundColor;
  if (!hexRgb(vurgu)) return {};
  const bicim = BAR_BICIMLERI[kabuk] || BAR_BICIMLERI[`aile:${TEMA_AILESI[tema.id] || ''}`] || ['gradient', 999];
  return {
    barStyle: bicim[0],
    barRadius: bicim[1],
    barBorderWidth: bicim[2] ?? 0,
    barColor2: renkKaristir(vurgu, metin ?? '#ffffff', 0.45),
    barBackground: saydam(metin ?? '#ffffff', 0.16),
    barBorderColor: renkKaristir(vurgu, vurgu, 0),
    outlineColor: renkKaristir(arka, arka, 0),
    customUsernameColor: renkKaristir(vurgu, vurgu, 0),
    captionColor: renkKaristir(metin, metin, 0),
    captionBgColor: renkKaristir(arka, arka, 0),
    contextColor: saydam(metin, 0.6),
    donorLabelColor: renkKaristir(vurgu, vurgu, 0),
    shadowColor: renkKaristir(arka, arka, 0)
  };
}

/** Widget'ın yerleşimini belirleyen seçmeli alanlar */
const GORUNUM_ANAHTARLARI = ['theme', 'chatStyle', 'comboStyle'];

/**
 * Tema kimliği (ya da genel görünüm adı) → sırayla denenecek görünümler. Widget'ların kendi görünüm adları
 * (shoutout: card/banner/ribbon…, sohbet: klasik/neon/kompakt…, kombo: pixel/neon/clean) karışık durur;
 * her widget kendinde olan ilkini alır.
 */
const GORUNUM_ADAYLARI: Record<string, string[]> = {
  classic: ['classic', 'card', 'klasik', 'plate', 'stacked'],
  minimal: ['minimal', 'compact', 'borderline', 'kompakt', 'clean'],
  glass: ['glass', 'softcard', 'neumorph', 'baslikli'],
  neon: ['neon', 'signal', 'prism', 'holochip'],
  klasik: ['classic', 'card', 'klasik', 'plate'],
  cam: ['glass', 'softcard', 'neumorph', 'baslikli'],
  karbon: ['plate', 'classic', 'card', 'platformkart', 'status'],
  aurora: ['glass', 'aurora', 'prism', 'holochip', 'horizon', 'baslikli'],
  gunbatimi: ['horizon', 'ember', 'softcard', 'card', 'platformkart'],
  gokyuzu: ['glass', 'softcard', 'horizon', 'baslikli'],
  hacker: ['terminal', 'phosphor', 'pixel', 'retro', 'kompakt', 'clean'],
  retro: ['retro', 'splitflap', 'kaset', 'pixel', 'card', 'klasik'],
  pastel: ['cute', 'softcard', 'capsule', 'konusma', 'glass'],
  beyaz: ['card', 'softcard', 'kart', 'classic', 'baslikli'],
  kick: ['signal', 'neon', 'platformkart', 'classic'],
  kadife: ['velvet', 'royal', 'softcard', 'glass'],
  kor: ['ember', 'stage', 'neon'],
  buz: ['glass', 'prism', 'holochip', 'baslikli'],
  kagit: ['minimal', 'kart', 'card', 'softcard', 'borderline', 'kompakt'],
  gece: ['stage', 'classic', 'card', 'baslikli'],
  seker: ['cute', 'capsule', 'softcard', 'konusma'],
  altin: ['royal', 'plate', 'velvet', 'neon'],
  arcade: ['pixel', 'retro', 'splitflap', 'neon'],
  piksel: ['pixel', 'retro', 'phosphor'],
  siberpunk: ['hud', 'holochip', 'prism', 'neon'],
  taktik: ['hud', 'status', 'signal', 'platformkart'],
  fantastik: ['royal', 'ribbon', 'velvet', 'plate'],
  yaris: ['hud', 'broadcast', 'signal', 'neon'],
  zombi: ['terminal', 'phosphor', 'neon'],
  uzay: ['holochip', 'hud', 'prism', 'neon'],
  korku: ['ember', 'stage', 'neon'],
  vahsibati: ['wood', 'ribbon', 'retro', 'plate'],
  noir: ['borderline', 'minimal', 'stage', 'kompakt'],
  gala: ['stage', 'royal', 'ribbon', 'plate'],
  cizgiroman: ['tag', 'cute', 'capsule', 'banner', 'etiket'],
  anime: ['cute', 'softcard', 'prism', 'capsule', 'konusma']
};

/**
 * Tema aileleri: görünüm adayları ve görünüm seçeneği olmayan widget'lar için ortak kutu tasarımı.
 * Kutular renklerini temadan alır (sabit renkli kutular açık/koyu yazıyla okunmaz olabilirdi).
 */
const AILELER: Record<string, { gorunum: string[]; kabuk: string }> = {
  kart: { gorunum: ['card', 'classic', 'plate', 'softcard', 'klasik'], kabuk: 'softcard' },
  sade: { gorunum: ['minimal', 'kompakt', 'borderline', 'clean', 'pill'], kabuk: 'borderline' },
  cam: { gorunum: ['glass', 'cam', 'crystal', 'softcard', 'baslikli'], kabuk: 'horizon' },
  neon: { gorunum: ['neon', 'signal', 'prism', 'holochip'], kabuk: 'stage' },
  uzay: { gorunum: ['holochip', 'hud', 'prism', 'neon', 'glass'], kabuk: 'prism' },
  asil: { gorunum: ['royal', 'taht', 'velvet', 'altin', 'ribbon', 'plate'], kabuk: 'altin' },
  doga: { gorunum: ['wood', 'cozy', 'crystal', 'softcard', 'card'], kabuk: 'kupon' },
  cizgi: { gorunum: ['tag', 'cute', 'capsule', 'banner', 'etiket', 'konusma'], kabuk: 'koseli' },
  piksel: { gorunum: ['pixel', 'retro', 'splitflap', 'phosphor', 'terminal', 'digital', 'flip'], kabuk: 'compact' },
  taktik: { gorunum: ['hud', 'status', 'signal', 'split', 'platformkart', 'broadcast'], kabuk: 'hud' },
  korku: { gorunum: ['ember', 'alev', 'stage', 'sahne', 'neon'], kabuk: 'ember' },
  bati: { gorunum: ['wood', 'ribbon', 'retro', 'plaka', 'plate'], kabuk: 'guestpass' },
  yayin: { gorunum: ['broadcast', 'banner', 'ticker', 'serit', 'band', 'stacked'], kabuk: 'broadcast' },
  eglence: { gorunum: ['cute', 'capsule', 'softcard', 'konusma', 'pill'], kabuk: 'capsule' }
};

const TEMA_AILESI: Record<string, string> = {
  ...Object.fromEntries(
    (
      [
        ['kart', 'klasik karbon beyaz gece nord solarized gruvbox'],
        ['sade', 'minimal kagit noir tek-renk lofi'],
        ['cam', 'cam aurora gokyuzu buz okyanus catppuccin'],
        ['neon', 'neon kick f-neon-yagmur synthwave vaporwave dracula tokyo'],
        ['uzay', 'uzay f-galaktik f-mavi-gezegen o-gece-kenti d-siyah-ayna'],
        ['asil', 'kadife altin fantastik gala altin-luks vegas f-buyucu f-orta-diyar d-demir-taht d-kasket'],
        ['doga', 'gunbatimi pastel f-dinozor o-blok orman col sakura'],
        ['cizgi', 'cizgiroman anime f-orumcek o-uzay-haini o-son-kalan'],
        ['piksel', 'hacker retro arcade piksel d-kimya matrix piksel-mor'],
        ['taktik', 'siberpunk taktik yaris espor-kirmizi espor-mavi f-zirh o-nisanci o-karsi-saldiri'],
        ['korku', 'kor zombi korku o-kul d-ters-dunya d-yuruyen o-cadi-avcisi'],
        ['bati', 'vahsibati f-korsan o-haydut'],
        ['yayin', 'f-karanlik-sehir o-suc-sehri d-soygun'],
        ['eglence', 'seker seker-pop gokkusagi d-olumcul-oyun']
      ] as Array<[string, string]>
    ).flatMap(([aile, idler]) => idler.split(' ').map((id) => [id, aile]))
  )
};

/** Genel tema anahtarı → widget'ların aynı anlamdaki kendi anahtarları. */
const ESANLAMLI: Record<string, string[]> = {
  bgColor: ['backgroundColor', 'messageBgColor', 'cardColor'],
  bgOpacity: ['backgroundOpacity', 'messageBgOpacity', 'cardOpacity'],
  accentColor: ['barColor', 'borderColor', 'highlightColor', 'pointerColor', 'titleColor', 'labelColor'],
  textColor: ['fontColor', 'messageColor'],
  radius: ['borderRadius']
};

