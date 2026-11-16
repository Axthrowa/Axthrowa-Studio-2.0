/**
 * AxBoT widget görünüm yardımcıları
 * Developed by AxthrowA
 *
 * Renk seçicileri hex tutar, saydamlık ayrı bir alandır; bu ikisini birleştiren
 * dönüşüm her widget'ta tekrar yazılıyordu. Hizalama ve sayı biçimlemesi de
 * aynı şekilde kopyalanıyordu — hepsi burada toplandı.
 */

/** Hex + opaklık → rgba(). Geçersiz girdi siyaha düşer, widget çökmez. */
export function rgba(hex: string | undefined, opaklik: number | string | undefined = 1): string {
  const h = String(hex || '#000000').replace('#', '');
  const t = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0');
  const r = parseInt(t.slice(0, 2), 16) || 0;
  const g = parseInt(t.slice(2, 4), 16) || 0;
  const b = parseInt(t.slice(4, 6), 16) || 0;
  const a = Math.max(0, Math.min(1, Number(opaklik ?? 1)));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** 'left' | 'center' | 'right' → flexbox karşılığı. */
export function yatay(deger: string | undefined): 'flex-start' | 'center' | 'flex-end' {
  if (deger === 'center') return 'center';
  if (deger === 'right') return 'flex-end';
  return 'flex-start';
}

/** 'top' | 'center' | 'bottom' → flexbox karşılığı. */
export function dikey(deger: string | undefined): 'flex-start' | 'center' | 'flex-end' {
  if (deger === 'center') return 'center';
  if (deger === 'bottom') return 'flex-end';
  return 'flex-start';
}

/** Sayıyı okunur yaz: 1.234 / 12,3 B / 1,2 M. */
export function sayiYaz(n: number, kisalt = false): string {
  const s = Number(n) || 0;
  if (!kisalt || Math.abs(s) < 1000) return s.toLocaleString('tr-TR');
  if (Math.abs(s) < 1_000_000) return `${(s / 1000).toFixed(1).replace('.', ',')} B`;
  return `${(s / 1_000_000).toFixed(1).replace('.', ',')} M`;
}

/** "🪙,💰,💵" → ['🪙','💰','💵']; boş girdi yedek listeye düşer. */
export function emojiListesi(ham: string | undefined, yedek: string[]): string[] {
  const parcalar = String(ham || '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  return parcalar.length ? parcalar : yedek;
}

/** Saniyeyi 12:34 / 1:02:03 biçimine çevirir. */
export function sureYaz(toplamSaniye: number): string {
  const t = Math.max(0, Math.floor(Number(toplamSaniye) || 0));
  const sa = Math.floor(t / 3600);
  const dk = Math.floor((t % 3600) / 60);
  const sn = t % 60;
  if (sa > 0) return `${sa}:${String(dk).padStart(2, '0')}:${String(sn).padStart(2, '0')}`;
  return `${dk}:${String(sn).padStart(2, '0')}`;
}

/** Hız ayarı: 1 normal, 2 iki kat hızlı, 0.1 en yavaş. 0 eskiden "ayar yok" sayılıp normal hıza dönüyordu. */
export function hizCarpani(deger: unknown): number {
  const n = deger === '' || deger === null || deger === undefined ? 1 : Number(deger);
  if (n === 0) return 0.5;
  return Number.isFinite(n) ? Math.min(4, Math.max(0.1, n)) : 1;
}

export function onizlemeKipi(prop?: boolean): boolean {
  if (prop) return true;
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preview') === '1';
}

/**
 * Sunucunun portu: sayfa sunucunun kendisinden açıldığı için onun portudur;
 * yalnız vite geliştirme portları (5173/3000) varsayılan 3001'e çevrilir.
 */
export function sunucuPortu(konum: { port: string } = window.location): string {
  return konum.port === '5173' || konum.port === '3000' ? '3001' : konum.port || '3001';
}

/** Overlay WebSocket adresi. */
/** Bu sayfa yüklemesinin kimliği (aynı sayfanın soketleri sunucuda tek kaynak sayılır) */
const SAYFA_KIMLIGI = Math.random().toString(36).slice(2, 12);

/** `/widgets/alertbox` → `alertbox`; widget sayfası değilse boş (panel bağlantıları katman sayılmaz) */
export function katmanAdi(yol: string): string {
  const m = /^\/widgets\/([a-z0-9-]{1,40})\/?$/i.exec(yol);
  return m ? m[1].toLowerCase() : '';
}

export function wsAdresi(tur = 'all'): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Katman adı: panel hangi OBS katmanının bağlı olduğunu gösterebilsin
  const katman = katmanAdi(window.location.pathname);
  return `${protocol}//${window.location.hostname}:${sunucuPortu()}/ws?type=${tur}${katman ? `&katman=${katman}&sayfa=${SAYFA_KIMLIGI}` : ''}`;
}

import { YAPISAL_KABUKLAR, yapisalKabukStilleri } from './kabuklar.js';

/**
 * Kart biçimli widget'ların (Shoutout, Sabitlenmiş Mesaj) ek tasarımları. Kendi stillerimiz;
 * her biri yalnız kutu görünümünü değiştirir, metin/avatar düzeni widget'ta kalır.
 */
export function kartTasarimlari(s: { bgColor?: string; bgOpacity?: number | string; accentColor?: string; borderColor?: string }): Record<string, import('react').CSSProperties> {
  const arka = rgba(s.bgColor, s.bgOpacity ?? 0.85);
  const vurgu = s.accentColor || '#22d3ee';
  return {
    ...yapisalKabukStilleri(arka, vurgu),
    softcard: { background: arka, border: `1px solid ${rgba('#ffffff', 0.08)}`, boxShadow: '0 20px 50px rgba(0,0,0,.45)' },
    neumorph: { background: rgba(s.bgColor, 1), border: 'none', boxShadow: `8px 8px 18px rgba(0,0,0,.6), -6px -6px 14px ${rgba('#ffffff', 0.06)}` },
    borderline: { background: 'transparent', border: `2px solid ${vurgu}`, boxShadow: 'none' },
    broadcast: { background: `linear-gradient(90deg, ${rgba('#b91c1c', 0.95)} 0 8px, ${arka} 8px)`, borderBottom: `3px solid ${vurgu}`, boxShadow: '0 10px 30px rgba(0,0,0,.5)' },
    horizon: { background: `linear-gradient(180deg, ${rgba(vurgu, 0.45)}, ${arka} 70%)`, border: `1px solid ${rgba(vurgu, 0.4)}` },
    stage: { background: `radial-gradient(120% 90% at 50% 0%, ${rgba(vurgu, 0.55)}, ${arka} 65%)`, border: `1px solid ${rgba('#ffffff', 0.15)}`, boxShadow: `0 0 40px ${rgba(vurgu, 0.35)}` },
    ember: { background: `linear-gradient(135deg, ${rgba('#7c2d12', 0.95)}, ${rgba('#1c0a03', 0.95)})`, border: '1px solid rgba(251,146,60,.6)', boxShadow: '0 0 30px rgba(249,115,22,.45)' },
    signal: { background: arka, borderLeft: `6px solid ${vurgu}`, boxShadow: `inset 0 0 0 1px ${rgba(vurgu, 0.25)}` },
    tag: { background: vurgu, border: 'none', boxShadow: '4px 4px 0 rgba(0,0,0,.8)' },
    ribbon: { background: `linear-gradient(90deg, ${vurgu}, ${rgba(vurgu, 0.6)})`, border: 'none', clipPath: 'polygon(0 0, 100% 0, 96% 50%, 100% 100%, 0 100%, 4% 50%)' },
    guestpass: { background: `repeating-linear-gradient(90deg, transparent 0 10px, ${rgba('#ffffff', 0.04)} 10px 11px), ${arka}`, border: `2px dashed ${rgba(vurgu, 0.8)}` },
    phosphor: { background: rgba('#031a0b', 0.95), border: '1px solid #22c55e', boxShadow: '0 0 22px rgba(34,197,94,.45), inset 0 0 18px rgba(34,197,94,.15)', fontFamily: 'VT323, monospace' },
    prism: { background: `linear-gradient(${arka}, ${arka}) padding-box, linear-gradient(120deg, #22d3ee, #a78bfa, #f472b6, #fbbf24) border-box`, border: '2px solid transparent' },
    cute: { background: 'linear-gradient(135deg, #f472b6, #c084fc)', border: '3px solid #fff', boxShadow: '0 8px 0 rgba(0,0,0,.25)' },
    terminal: { background: rgba('#000000', 0.92), border: '1px solid #22c55e', fontFamily: 'Consolas, monospace' },
    cozy: { background: 'linear-gradient(135deg, rgba(120,53,15,.92), rgba(68,32,10,.92))', border: '1px solid rgba(253,230,138,.35)' },
    pixel: { background: arka, border: `4px solid ${vurgu}`, boxShadow: '6px 6px 0 rgba(0,0,0,.85)', fontFamily: '"Press Start 2P", monospace' },
    compact: { background: arka, border: `1px solid ${rgba('#ffffff', 0.12)}`, padding: '8px 12px' },
    capsule: { background: arka, border: `1px solid ${rgba(vurgu, 0.5)}`, borderRadius: 999 },
    // Pencere: eski masaüstü penceresi gibi kabartmalı gri kutu
    pencere: { background: '#c0c0c0', color: '#000000', border: '2px solid', borderColor: '#ffffff #404040 #404040 #ffffff', boxShadow: '1px 1px 0 #000', borderRadius: 0 },
    // El konsolu: yeşil tonlu dört renkli ekran
    gameboy: { background: '#9bbc0f', color: '#0f380f', border: '4px solid #306230', boxShadow: 'inset 0 0 0 2px #8bac0f', borderRadius: 4 },
    // Yapışkan not ve parşömen: açık zemin, koyu yazı
    yapiskan: { background: 'linear-gradient(180deg,#fde68a,#fcd34d)', color: '#3f2d06', border: 'none', boxShadow: '3px 6px 14px rgba(0,0,0,.4)', borderRadius: 2, transform: 'rotate(-0.6deg)' },
    parsomen: { background: 'radial-gradient(120% 120% at 50% 50%,#f5e6c4,#d9bf8c)', color: '#3b2a14', border: '1px solid #8a6a3b', boxShadow: 'inset 0 0 24px rgba(90,60,20,.45)' },
    // Çizgi roman: kalın siyah kontur, düz gölge
    cizgiroman: { background: '#ffffff', color: '#111111', border: '3px solid #111111', boxShadow: '6px 6px 0 #111111' },
    // Sıvı cam: çok saydam, üst kenarda ışık
    sivicam: { background: rgba('#ffffff', 0.1), border: `1px solid ${rgba('#ffffff', 0.28)}`, boxShadow: `inset 0 1px 0 ${rgba('#ffffff', 0.45)}, 0 12px 32px rgba(0,0,0,.35)`, backdropFilter: 'blur(14px) saturate(160%)' },
    // Gece dalgası: mor-pembe geçiş, parlak çerçeve
    gecedalga: { background: 'linear-gradient(160deg,#2b0a4d,#7a1d6f 60%,#f0568a)', border: '1px solid #ff8ad8', boxShadow: '0 0 22px rgba(240,86,138,.55)' },
    // Altın kenar: koyu zemin, çift altın çerçeve
    altin: { background: rgba('#14100a', 0.95), border: '2px solid #d4a843', boxShadow: `inset 0 0 0 3px ${rgba('#14100a', 1)}, inset 0 0 0 4px ${rgba('#d4a843', 0.5)}` },
    // Köşeli: yalnız köşeleri çizili yayın çerçevesi
    koseli: { background: `linear-gradient(${vurgu},${vurgu}) 0 0/18px 2px no-repeat, linear-gradient(${vurgu},${vurgu}) 0 0/2px 18px no-repeat, linear-gradient(${vurgu},${vurgu}) 100% 100%/18px 2px no-repeat, linear-gradient(${vurgu},${vurgu}) 100% 100%/2px 18px no-repeat, ${arka}`, border: 'none' },
    // Kupon: kesik kenarlı hediye kuponu
    kupon: { background: arka, border: `2px dashed ${rgba(vurgu, 0.8)}`, outline: `4px solid ${arka}` },
    hud: { background: rgba('#020617', 0.8), border: `1px solid ${rgba(vurgu, 0.8)}`, clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)', boxShadow: `inset 0 0 16px ${rgba(vurgu, 0.25)}` }
  };
}

/** Her widget'ta seçilebilen ortak kutu tasarımları; boş: widget'ın kendi görünümü */
export const KUTU_TASARIMLARI: Array<{ value: string; label: string }> = [
  ['', "Widget'ın kendi görünümü"], ['sivicam', 'Sıvı cam'], ['softcard', 'Yumuşak kart'], ['neumorph', 'Kabartma'], ['borderline', 'Yalnız çerçeve'],
  ['broadcast', 'Haber bandı'], ['horizon', 'Ufuk geçişi'], ['stage', 'Sahne ışığı'], ['ember', 'Kor'], ['signal', 'Sinyal şeridi'], ['tag', 'Etiket'],
  ['ribbon', 'Kurdele'], ['guestpass', 'Davetiye'], ['phosphor', 'Terminal'], ['prism', 'Prizma kenar'], ['cute', 'Sevimli'], ['capsule', 'Kapsül'], ['hud', 'E-spor HUD'],
  ['pencere', 'Eski pencere'], ['gameboy', 'El konsolu'], ['yapiskan', 'Yapışkan not'], ['parsomen', 'Parşömen'], ['cizgiroman', 'Çizgi roman'],
  ['gecedalga', 'Gece dalgası'], ['altin', 'Altın kenar'], ['koseli', 'Köşeli çerçeve'], ['kupon', 'Kupon']
].map(([value, label]) => ({ value, label })).concat(YAPISAL_KABUKLAR);

/** Seçili ortak kutu tasarımı (widget kutusunun stiline en son eklenir). Renk alanlarının adı widget'a göre değişir. */
export function kutuTasarimi(s: Record<string, any>): import('react').CSSProperties | undefined {
  if (!s.kabuk) return undefined;
  return kartTasarimlari({
    bgColor: s.bgColor ?? s.backgroundColor ?? s.cardColor,
    bgOpacity: s.bgOpacity ?? s.backgroundOpacity ?? s.cardOpacity,
    accentColor: s.accentColor ?? s.barColor ?? s.highlightColor ?? s.borderColor,
    borderColor: s.borderColor
  })[String(s.kabuk)];
}

/**
 * CSS font-family değeri: ad tırnaklı + yedek. Tırnaksız "Press Start 2P" ve "Exo 2" geçersiz CSS'ti
 * (rakamla başlayan sözcük), tarayıcı hiç uygulamıyordu; yüklenene dek de okunur bir yedek görünür.
 */
export function yaziAilesi(ad: string): string {
  return `"${ad.replace(/"/g, '')}", system-ui, sans-serif`;
}

/**
 * Aynı punto değerinde dar/süslü yazı tipleri çok küçük, geniş olanlar çok büyük görünür.
 * Sohbet okunurluğu için punto bu oranla çarpılır (x-yüksekliği ve genişlik ölçümüyle, Plus Jakarta Sans = 1).
 */
const YAZI_BOYUT_OLCEGI: Record<string, number> = {
  Teko: 1.3, VT323: 1.35, Caveat: 1.3, 'Dancing Script': 1.3, 'Bebas Neue': 1.15, Bangers: 1.1, Oswald: 1.1,
  'Barlow Condensed': 1.15, Rajdhani: 1.1, 'Pixelify Sans': 1.1, Creepster: 1.1, Staatliches: 1.05, Pacifico: 1.05,
  'Press Start 2P': 0.62, Silkscreen: 0.8, Monoton: 0.8, Bungee: 0.82, Orbitron: 0.92, Oxanium: 0.95, Michroma: 0.78, 'Rubik Mono One': 0.78, 'Great Vibes': 1.3, Sacramento: 1.35, Allura: 1.3, 'Alex Brush': 1.25, 'Amatic SC': 1.3, 'Shadows Into Light': 1.15, 'Fira Code': 0.92,
  Audiowide: 0.92, 'Black Ops One': 0.92, Cinzel: 0.95
};

/** Ayar değeri ad ya da `yaziAilesi` çıktısı olabilir */
export function yaziOlcegi(deger: unknown): number {
  const ad = String(deger || '').replace(/^"([^"]+)".*$/, '$1');
  return YAZI_BOYUT_OLCEGI[ad] ?? 1;
}
