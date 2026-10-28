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
    { theme: 'neon', bgColor: '#020818', bgOpacity: 0.92, accentColor: '#4fc3f7', accentColor2: '#312e81', textColor: '#e3f2fd', radius: 6, fontFamily: 'Orbitron' },
    { arka: 'linear-gradient(135deg,#020818,#312e81)', vurgu: '#4fc3f7', metin: '#e3f2fd', kenar: '#4fc3f7' }
  ),
  tema(
    'korku',
    '🎬 Korku',
    { theme: 'neon', bgColor: '#0a0000', bgOpacity: 0.92, accentColor: '#dc2626', accentColor2: '#450a0a', textColor: '#fde8e8', radius: 4, fontFamily: 'Creepster' },
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
      ['synthwave', '🌆 Synthwave', '#241b2f', '#ff7edb', '#fefeff', 'Monoton'],
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
      ['seker-pop', '🍭 Şeker Pop', '#2a1036', '#ff8fd8', '#ffffff', 'Fredoka'],
      ['matrix', '🟢 Matrix', '#000000', '#00ff41', '#b6ffbf', 'Fira Code'],
      ['piksel-mor', '👾 Piksel Gece', '#1b1035', '#a78bfa', '#ffffff', 'Pixelify Sans']
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
  hedefTema('h-korku', '🩸 Korku Gecesi', '#450a0a', '#dc2626', '🩸', { fontFamily: 'Creepster', barBorderColor: '#7f1d1d', letterSpacing: 3 }),
  hedefTema('h-zombi', '🧟 Zombi', '#365314', '#84cc16', '🧟', { fontFamily: 'Special Elite', barBorderColor: '#a3e635', barStyle: 'striped' }),
  hedefTema('h-arcade', '👾 Retro Arcade', '#ff2a6d', '#00f0ff', '👾', { fontFamily: 'Press Start 2P', fontSize: 12, barRadius: 0, barBorderColor: '#00f0ff', barStyle: 'striped' }),
  hedefTema('h-piksel', '⛏️ Piksel Madenci', '#5b8731', '#8b5a2b', '⛏️', { fontFamily: 'VT323', fontSize: 22, barRadius: 0, barBorderColor: '#3b2a1a', barBackground: '#2b2b2b' }),
  hedefTema('h-siberpunk', '⚡ Siberpunk', '#fcee0a', '#00f0ff', '⚡', { fontFamily: 'Audiowide', barRadius: 4, barBorderColor: '#fcee0a', barStyle: 'glossy' }),
  hedefTema('h-taktik', '🎯 Taktik', '#4d5d2a', '#ff6b00', '🎯', { fontFamily: 'Black Ops One', barRadius: 2, barBorderColor: '#c5b358' }),
  hedefTema('h-fantastik', '🗡️ Fantastik RPG', '#7b1e1e', '#d4af37', '🗡️', { fontFamily: 'Cinzel', barBorderColor: '#d4af37', barRadius: 8 }),
  hedefTema('h-ejderha', '🐉 Ejderha Ateşi', '#991b1b', '#fbbf24', '🐉', { fontFamily: 'Cinzel', barBorderColor: '#fbbf24', barStyle: 'glossy' }),
  hedefTema('h-yaris', '🏎️ Yarış', '#dc2626', '#f5f5f5', '🏎️', { fontFamily: 'Russo One', barRadius: 4, barStyle: 'striped', barBorderColor: '#e5e5e5' }),
  hedefTema('h-futbol', '⚽ Futbol', '#15803d', '#4ade80', '⚽', { fontFamily: 'Oswald', barBorderColor: '#ffffff', barStyle: 'striped' }),
  hedefTema('h-uzay', '🚀 Uzay Destanı', '#312e81', '#4fc3f7', '🚀', { fontFamily: 'Orbitron', barBorderColor: '#93c5fd', barStyle: 'glossy' }),
  hedefTema('h-vahsibati', '🤠 Vahşi Batı', '#8c1c13', '#e0a458', '🤠', { fontFamily: 'Rye', barBorderColor: '#e0a458', barRadius: 6 }),
  hedefTema('h-noir', '🎬 Kara Film', '#404040', '#e5e5e5', '🎬', { fontFamily: 'Special Elite', barBorderColor: '#e5e5e5', barRadius: 0 }),
  hedefTema('h-gala', '🍿 Sinema Galası', '#991b1b', '#e6b422', '🍿', { fontFamily: 'Bebas Neue', fontSize: 22, barBorderColor: '#e6b422', barStyle: 'glossy' }),
  hedefTema('h-cizgiroman', '💥 Çizgi Roman', '#dc2626', '#facc15', '💥', { fontFamily: 'Bangers', fontSize: 22, barBorderColor: '#000000', outlineEnabled: true, outlineColor: '#000000', outlineWidth: 1 }),
  hedefTema('h-anime', '🌸 Anime', '#ff6ec7', '#7df9ff', '🌸', { fontFamily: 'Poppins', barBorderColor: '#ffffff', barStyle: 'glossy' }),
  hedefTema('h-okyanus', '🐠 Okyanus', '#0369a1', '#2dd4bf', '🐠', { fontFamily: 'Nunito', barBorderColor: '#a5f3fc' }),
  hedefTema('h-lav', '🌋 Lav', '#7c2d12', '#facc15', '🌋', { fontFamily: 'Anton', barBorderColor: '#fb923c', barStyle: 'striped' }),
  hedefTema('h-kis', '❄️ Kış', '#1e3a8a', '#e0f2fe', '❄️', { fontFamily: 'Nunito', barBorderColor: '#e0f2fe', barStyle: 'glossy' }),
  hedefTema('h-yilbasi', '🎄 Yılbaşı', '#b91c1c', '#16a34a', '🎄', { fontFamily: 'Montserrat', barBorderColor: '#fde68a', barStyle: 'striped' }),
  hedefTema('h-altin', '🏆 Altın Kupa', '#a16207', '#fde047', '🏆', { fontFamily: 'Oswald', barBorderColor: '#fef08a', barStyle: 'glossy' }),
  hedefTema('h-kick', '💚 Yeşil Neon', '#14532d', '#53fc18', '💚', { fontFamily: 'Russo One', barBorderColor: '#53fc18' }),
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
  sayacTema('s-hap', '💊 Tek Satır', 'pill', '#22d3ee', '#34d399', '#000000', '⏳', { timeFontFamily: 'Orbitron', timeFontSize: 48 }),
  sayacTema('s-minimal', 'Minimal (yalnız süre)', 'minimal', '#ffffff', '#94a3b8', '#000000', '', { timeFontFamily: 'Bebas Neue', timeFontSize: 80, showRules: false }),
  sayacTema('s-arcade', '👾 Retro Arcade', 'digital', '#00f0ff', '#ff2a6d', '#0d0221', '👾', { fontFamily: 'Press Start 2P', timeFontFamily: 'Press Start 2P', timeFontSize: 36, radius: 0 }),
  sayacTema('s-siberpunk', '⚡ Siberpunk', 'neon', '#fcee0a', '#00f0ff', '#0a0014', '⚡', { fontFamily: 'Audiowide', timeFontFamily: 'Orbitron', radius: 2 }),
  sayacTema('s-bomba', '💣 Saatli Bomba', 'digital', '#ef4444', '#7f1d1d', '#0a0000', '💣', { timeFontFamily: 'VT323', timeFontSize: 68, radius: 4 }),
  sayacTema('s-taktik', '🎯 Taktik', 'card', '#c5b358', '#ff6b00', '#1b1f14', '🎯', { fontFamily: 'Black Ops One', timeFontFamily: 'Black Ops One', radius: 2 }),
  sayacTema('s-fantastik', '🗡️ Fantastik RPG', 'card', '#d4af37', '#7b1e1e', '#1a1208', '📜', { fontFamily: 'Cinzel', timeFontFamily: 'Cinzel', radius: 10 }),
  sayacTema('s-uzay', '🚀 Uzay Görevi', 'flip', '#4fc3f7', '#312e81', '#020818', '🚀', { fontFamily: 'Orbitron', timeFontFamily: 'Orbitron' }),
  sayacTema('s-korku', '🩸 Korku', 'neon', '#dc2626', '#450a0a', '#0a0000', '🕯️', { fontFamily: 'Creepster', timeFontFamily: 'Creepster', timeFontSize: 64 }),
  sayacTema('s-cadilar', '🎃 Cadılar Bayramı', 'card', '#f97316', '#6d28d9', '#1a0b2e', '🎃', { fontFamily: 'Montserrat', timeFontFamily: 'Bangers', timeFontSize: 64 }),
  sayacTema('s-vahsibati', '🤠 Vahşi Batı', 'card', '#e0a458', '#8c1c13', '#3e2412', '🤠', { fontFamily: 'Rye', timeFontFamily: 'Rye', radius: 4 }),
  sayacTema('s-gala', '🎬 Sinema', 'flip', '#e6b422', '#991b1b', '#2a0505', '🎬', { fontFamily: 'Bebas Neue', timeFontFamily: 'Bebas Neue', timeFontSize: 64 }),
  sayacTema('s-cizgiroman', '💥 Çizgi Roman', 'card', '#facc15', '#dc2626', '#1e3a8a', '💥', { fontFamily: 'Bangers', timeFontFamily: 'Bangers', timeFontSize: 64 }),
  sayacTema('s-anime', '🌸 Anime', 'pill', '#ff6ec7', '#7df9ff', '#1a0f2e', '🌸', { fontFamily: 'Poppins', timeFontFamily: 'Poppins' }),
  sayacTema('s-yilbasi', '🎄 Yılbaşı', 'card', '#fde68a', '#16a34a', '#7f1d1d', '🎄', { fontFamily: 'Montserrat', timeFontFamily: 'Oswald' })
];

/** Widget'a özel ek temalar. */
export const WIDGET_TEMALARI: Record<string, TemaTanimi[]> = {
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
      tema(`p-${palet}`, ad, { palette: palet, borderColor: kenar, pointerColor: ibre, outlineEnabled: true, outlineColor: '#000000' }, { arka: palet === 'white' ? '#e2e8f0' : '#1e293b', vurgu: ibre, metin: kenar })
    )
  ],
  'chat-overlay': [
    tema('baloncuk', 'Baloncuk', { messageBubbles: true, messageBgColor: '#1e293b', messageBgOpacity: 0.9, borderRadius: 22 }, { arka: '#1e293b', vurgu: P.turkuaz, metin: P.beyaz }),
    tema('yanmenu', 'Yan Şerit', { messageBubbles: true, messageBgColor: P.siyah, messageBgOpacity: 0.55, borderRadius: 4 }, { arka: 'rgba(0,0,0,.55)', vurgu: P.mor, metin: P.beyaz }),
    tema('seffaf', 'Tamamen Şeffaf', { transparentBg: true, messageBgOpacity: 0, textShadow: true }, { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz }),
    // BotRix'te 24 hazır sohbet tasarımı gözlemlendi; bizdekiler kendi renk/ayar birleşimlerimiz
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
    tema('yuvarlak', 'Yuvarlak', { messageBubbles: true, messageBgColor: '#1e293b', messageBgOpacity: 0.85, borderRadius: 999, textColor: P.beyaz, gap: 8 }, { arka: '#1e293b', vurgu: P.mor, metin: P.beyaz }),
    tema('gokyuzu', 'Gökyüzü', { messageBubbles: true, messageBgColor: '#e0f2fe', messageBgOpacity: 0.92, borderRadius: 16, textColor: '#0c4a6e', usernameColorMode: 'custom', customUsernameColor: '#0284c7', textShadow: false }, { arka: '#e0f2fe', vurgu: '#0284c7', metin: '#0c4a6e' }),
    tema('pencerecami', 'Pencere Camı', { messageBubbles: true, messageBgColor: '#ffffff', messageBgOpacity: 0.18, borderRadius: 6, textColor: P.beyaz, textShadow: true }, { arka: 'rgba(255,255,255,.18)', vurgu: P.beyaz, metin: P.beyaz, kenar: 'rgba(255,255,255,.5)' }),
    tema('mesajlasma', 'Mesajlaşma Uygulaması', { messageBubbles: true, messageBgColor: '#dcf8c6', messageBgOpacity: 0.97, borderRadius: 14, textColor: '#111b21', usernameColorMode: 'custom', customUsernameColor: '#075e54', textShadow: false }, { arka: '#dcf8c6', vurgu: '#075e54', metin: '#111b21' }),
    tema('retro', 'Retro', { messageBubbles: true, messageBgColor: '#2b1d0e', messageBgOpacity: 0.9, borderRadius: 4, textColor: '#fde68a', fontFamily: 'Special Elite', highlightColor: '#f97316' }, { arka: '#2b1d0e', vurgu: '#f97316', metin: '#fde68a' }),
    tema('kadife', 'Kadife', { messageBubbles: true, messageBgColor: '#3b0a1f', messageBgOpacity: 0.88, borderRadius: 14, textColor: '#fce7f3', highlightColor: '#e11d48', highlightSpecial: true }, { arka: 'linear-gradient(135deg,#3b0a1f,#7f1d1d)', vurgu: '#e11d48', metin: '#fce7f3' }),
    tema('kickyesili', 'Kick Yeşili', { messageBubbles: true, messageBgColor: '#0f1a0a', messageBgOpacity: 0.88, borderRadius: 8, textColor: P.beyaz, highlightColor: P.kick, highlightSpecial: true }, { arka: '#0f1a0a', vurgu: P.kick, metin: P.beyaz })
  ],
  polls: [
    tema('savas', 'Düello', { barColor: P.kirmizi, barBackground: '#1e40af', showVotes: true }, { arka: '#1e293b', vurgu: P.kirmizi, metin: P.beyaz }),
    tema('yayin', 'Yayın Bandı', { barColor: P.turkuaz, barBackground: '#0f172a', borderRadius: 4 }, { arka: '#0f172a', vurgu: P.turkuaz, metin: P.beyaz }),
    tema('kompakt', 'Kompakt Kapışma', { barColor: '#f97316', barBackground: '#1e3a8a', borderRadius: 6, fontSize: 12, backgroundOpacity: 0.85 }, { arka: '#1e3a8a', vurgu: '#f97316', metin: P.beyaz }),
    tema('platform', 'Platform Rengi', { barColor: P.kick, barBackground: '#0f1a0a', titleColor: P.kick, borderColor: P.kick }, { arka: '#0f1a0a', vurgu: P.kick, metin: P.beyaz }),
    tema('baloncuk', 'Baloncuklar', { barColor: '#38bdf8', barBackground: '#0c4a6e', borderRadius: 24, titleColor: '#bae6fd', borderColor: '#38bdf8' }, { arka: '#0c4a6e', vurgu: '#38bdf8', metin: P.beyaz }),
    tema('beyaz', 'Beyaz', { backgroundColor: '#ffffff', backgroundOpacity: 0.95, fontColor: '#111827', titleColor: '#4f46e5', barColor: '#4f46e5', barBackground: '#e5e7eb', borderColor: '#e5e7eb' }, { arka: '#ffffff', vurgu: '#4f46e5', metin: '#111827' }),
    tema('pasta', 'Pasta', { backgroundColor: '#fff1f2', backgroundOpacity: 0.95, fontColor: '#831843', titleColor: '#db2777', barColor: '#f472b6', barBackground: '#fce7f3', borderColor: '#f9a8d4', borderRadius: 22 }, { arka: '#fff1f2', vurgu: '#db2777', metin: '#831843' }),
    tema('hacker', 'Hacker', { backgroundColor: '#000000', fontColor: '#22c55e', titleColor: '#4ade80', barColor: '#16a34a', barBackground: '#052e16', borderColor: '#16a34a', borderRadius: 0, fontFamily: 'VT323', fontSize: 18 }, { arka: '#000000', vurgu: '#22c55e', metin: '#22c55e' }),
    tema('neon', 'Neon', { backgroundColor: '#0b0420', fontColor: P.beyaz, titleColor: '#ff2bd6', barColor: '#ff2bd6', barBackground: '#1e0b3a', borderColor: '#22d3ee' }, { arka: '#0b0420', vurgu: '#ff2bd6', metin: P.beyaz, kenar: '#22d3ee' }),
    tema('yuvarlak', 'Yuvarlak', { borderRadius: 28, barColor: P.mor, barBackground: '#1e1b4b', titleColor: '#c4b5fd', borderColor: P.mor }, { arka: '#1e1b4b', vurgu: P.mor, metin: P.beyaz }),
    tema('isinkilici', 'Işın Kılıcı', { backgroundColor: '#020617', barColor: '#38bdf8', barBackground: '#0f172a', titleColor: '#e0f2fe', borderColor: '#38bdf8', borderRadius: 999, fontFamily: 'Orbitron' }, { arka: '#020617', vurgu: '#38bdf8', metin: '#e0f2fe' }),
    tema('kapisma', 'Kapışma', { barColor: '#dc2626', barBackground: '#1d4ed8', titleColor: '#fde047', borderColor: '#fde047', fontFamily: 'Russo One' }, { arka: 'linear-gradient(90deg,#dc2626,#1d4ed8)', vurgu: '#fde047', metin: P.beyaz }),
    tema('minimalanket', 'Minimal', { backgroundOpacity: 0, borderColor: '#ffffff', barColor: '#ffffff', barBackground: '#ffffff33', titleColor: '#ffffff', outlineEnabled: true }, { arka: 'transparent', vurgu: P.beyaz, metin: P.beyaz })
  ]
};

/** Bir widget için kullanılabilir tüm temalar. */
export function temalar(widgetId: string): TemaTanimi[] {
  const ozel = WIDGET_TEMALARI[widgetId] || [];
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
  for (const [k, v] of Object.entries(tema.degerler)) {
    if (gecerli && !gecerli(k, v)) continue;
    if (izinli.has(k)) yeni[k] = v;
    // Genel anahtarı widget kendi adıyla tanıyor (hedef barı: barColor/backgroundColor/fontColor);
    // tema o alanı ayrıca belirttiyse ona dokunulmaz
    for (const es of ESANLAMLI[k] || []) {
      if (izinli.has(es) && !(es in tema.degerler)) yeni[es] = v;
    }
  }
  return yeni;
}

/** Genel tema anahtarı → widget'ların aynı anlamdaki kendi anahtarları. */
const ESANLAMLI: Record<string, string[]> = {
  bgColor: ['backgroundColor', 'messageBgColor', 'cardColor'],
  bgOpacity: ['backgroundOpacity', 'messageBgOpacity', 'cardOpacity'],
  accentColor: ['barColor', 'borderColor', 'highlightColor', 'pointerColor', 'titleColor', 'labelColor'],
  textColor: ['fontColor', 'messageColor'],
  radius: ['borderRadius']
};

