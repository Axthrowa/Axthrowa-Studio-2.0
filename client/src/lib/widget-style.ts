/**
 * StreamAxT widget görünüm yardımcıları
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

/** Önizleme kipi: prop ya da adres satırındaki ?preview=1. */
/**
 * Widget yazı tipini Google Fonts'tan yükler (OBS tarayıcısında kurulu olmayabilir).
 * Yalnız FONTS listesindeki adlar: ayardan gelen keyfi değer adrese yazılmaz.
 */
export function fontuYukle(ad: string | undefined, liste: readonly string[]): void {
  if (!ad || !liste.includes(ad) || typeof document === 'undefined') return;
  const id = 'axt-font-' + ad.replace(/\s+/g, '-');
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(ad).replace(/%20/g, '+')}&display=swap`;
  document.head.appendChild(link);
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
export function wsAdresi(tur = 'all'): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:${sunucuPortu()}/ws?type=${tur}`;
}

/**
 * Kart biçimli widget'ların (Shoutout, Sabitlenmiş Mesaj) ek tasarımları. Kendi stillerimiz;
 * her biri yalnız kutu görünümünü değiştirir, metin/avatar düzeni widget'ta kalır.
 */
export function kartTasarimlari(s: { bgColor?: string; bgOpacity?: number | string; accentColor?: string; borderColor?: string }): Record<string, import('react').CSSProperties> {
  const arka = rgba(s.bgColor, s.bgOpacity ?? 0.85);
  const vurgu = s.accentColor || '#22d3ee';
  return {
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
    hud: { background: rgba('#020617', 0.8), border: `1px solid ${rgba(vurgu, 0.8)}`, clipPath: 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)', boxShadow: `inset 0 0 16px ${rgba(vurgu, 0.25)}` }
  };
}
