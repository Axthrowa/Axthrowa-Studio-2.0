/**
 * StreamAxT Şarkı Sözleri widget
 * Developed by AxthrowA
 *
 * Panelden tema, tipografi, satır geçiş hızı ve hangi satırların görüneceği
 * ayarlanır. Eski sürümde `lines` boşken `lines[(i+1) % 0]` hesabı NaN indeks
 * üretiyordu ve satır sayacı şarkı değişince sıfırlanmıyordu; sözler yeni
 * parçaya geçince ortadan devam ediyordu.
 */
import { useState, useEffect, useRef } from 'react';
import { Disc } from 'lucide-react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { LYRICS_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, onizlemeKipi } from '../lib/widget-style.js';

/** Şarkı duruyor ya da süresi dolduysa sözler ekranda kalmaz. `isPlaying` yoksa (istek kuyruğu) karar verilmez. */
export function sozGizlensinMi(d: { title?: unknown; isPlaying?: unknown; progressMs?: unknown; durationMs?: unknown }, gecenMs = 0): boolean {
  if (!d.title || d.isPlaying === false) return true;
  const sure = Number(d.durationMs) || 0;
  return d.isPlaying === true && sure > 0 && (Number(d.progressMs) || 0) + gecenMs >= sure;
}

/** Bu şarkının sözünün bulunamadığı ilk an; şarkı değişince sıfırlanır. */
export type BulunamadiIzi = { sarki: string; an: number } | null;

/**
 * "Sözler bulunamadı" yazısı `sureSn` kadar kalır, sonra widget gizlenir. Şarkı değişince ya da söz
 * bulununca iz silinir, widget yeniden açılır. `sureSn` 0 ise yazı hep kalır.
 */
export function bulunamadiDurumu(iz: BulunamadiIzi, sarki: string, yok: boolean, sureSn: number, simdi: number): { iz: BulunamadiIzi; gizle: boolean } {
  if (!yok) return { iz: null, gizle: false };
  const yeni = iz && iz.sarki === sarki ? iz : { sarki, an: simdi };
  return { iz: yeni, gizle: sureSn > 0 && simdi - yeni.an >= sureSn * 1000 };
}

interface LyricLine {
  time: number;
  text: string;
}

export interface LyricsWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

const ORNEK: LyricLine[] = [
  { time: 0, text: 'Gece boyunca ışıklar yanıyor' },
  { time: 4, text: 'Sesini duyduğum her yerde' },
  { time: 8, text: 'Bir şarkı daha, bir tur daha' }
];

export function LyricsWidget({ embedded = false, previewMode = false }: LyricsWidgetProps) {
  const s = useWidgetSettings('lyrics', LYRICS_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);

  const [songTitle, setSongTitle] = useState(onizleme ? 'Lofi Chill Beats' : 'Şarkı Sözleri');
  const [artist, setArtist] = useState(onizleme ? 'StreamAxT' : '');
  const [lines, setLines] = useState<LyricLine[]>(onizleme ? ORNEK : []);
  const [aktif, setAktif] = useState(0);
  // Senkron: sunucunun verdiği ilerleme (ms) + örnekleme anı; aradaki süre eklenir
  const [senkron, setSenkron] = useState<{ synced: boolean; progressMs: number | null; updatedAt: number | null; isPlaying: boolean }>({
    synced: false,
    progressMs: null,
    updatedAt: null,
    isPlaying: false
  });
  const [bulunamadi, setBulunamadi] = useState(false);
  const [gizli, setGizli] = useState(!onizleme);
  const bulunamadiIzi = useRef<BulunamadiIzi>(null);
  const ayar = useRef(s);
  ayar.current = s;

  useEffect(() => {
    if (onizleme) return;
    let iptal = false;

    const cek = async () => {
      try {
        const res = await fetch('/api/lyrics/current');
        if (!res.ok || iptal) return;
        const data = await res.json();
        const yeniBaslik = data.title || String(s.idleText || 'Şarkı Sözleri');
        setSongTitle((oncekiBaslik) => {
          // Parça değiştiyse satır sayacı başa döner.
          if (oncekiBaslik !== yeniBaslik) setAktif(0);
          return yeniBaslik;
        });
        setArtist(data.artist || '');
        setLines(Array.isArray(data.lines) ? data.lines : []);
        setBulunamadi(Boolean(data.title) && data.bulundu === false);
        const yok = bulunamadiDurumu(bulunamadiIzi.current, `${data.artist}|${data.title}`, Boolean(data.title) && data.bulundu === false, Number(ayar.current.notFoundSeconds) || 0, Date.now());
        bulunamadiIzi.current = yok.iz;
        setGizli(sozGizlensinMi(data) || yok.gizle);
        setSenkron({
          synced: Boolean(data.synced),
          progressMs: typeof data.progressMs === 'number' ? data.progressMs : null,
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null,
          isPlaying: Boolean(data.isPlaying)
        });
      } catch {
        /* sunucu yok */
      }
    };

    cek();
    // Şarkı kesilince sözler hemen kalksın: saniyede bir (sözler sunucuda önbellekli, istek yerel)
    const t = setInterval(cek, 1000);
    return () => {
      iptal = true;
      clearInterval(t);
    };
  }, [onizleme]);

  useEffect(() => {
    if (lines.length <= 1) return;
    // Zaman damgalı söz + çaların ilerlemesi biliniyorsa: şarkıyla SENKRON
    if (senkron.synced && senkron.progressMs !== null && senkron.updatedAt !== null) {
      const hesapla = () => {
        const gecen = senkron.isPlaying ? Date.now() - (senkron.updatedAt as number) : 0;
        // Kaydırma: + söz erken, - geç gelir (çalar/söz kaynağı arasındaki sabit farkı düzeltmek için)
        const konum = ((senkron.progressMs as number) + gecen + (Number(s.syncOffsetMs) || 0)) / 1000;
        let i = 0;
        for (let k = 0; k < lines.length; k++) {
          if (lines[k].time <= konum) i = k;
          else break;
        }
        setAktif(i);
      };
      hesapla();
      const t = setInterval(hesapla, 250);
      return () => clearInterval(t);
    }
    // İlerleme yoksa (istek kuyruğu / düz söz): sabit aralıkla döner
    const t = setInterval(
      () => setAktif((p) => (p + 1) % lines.length),
      Math.max(500, Number(s.lineMs) || 4500)
    );
    return () => clearInterval(t);
  }, [lines, s.lineMs, s.syncOffsetMs, senkron]);

  const bos = lines.length === 0;
  if (gizli || (bos && s.hideWhenIdle)) return null;

  // Boş listede modulo NaN üretiyordu; artık güvenli okuma.
  const satir = (i: number) => (lines.length ? lines[((i % lines.length) + lines.length) % lines.length]?.text || '' : '');
  const suAn = bos ? (bulunamadi ? String(s.notFoundText || 'Bu şarkının sözleri bulunamadı') : String(s.idleText)) : satir(aktif);
  const sonraki = bos ? '' : satir(aktif + 1);
  const onceki = bos ? '' : satir(aktif - 1);

  const tema = String(s.theme || 'neon');
  const temaStili: Record<string, React.CSSProperties> = {
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${rgba(s.borderColor, 0.3)}`,
      backdropFilter: 'blur(6px)',
      boxShadow: `0 0 30px ${rgba(s.accentColor, 0.25)}`
    },
    minimal: { background: 'transparent', border: 'none', boxShadow: 'none' },
    glass: {
      background: rgba(s.bgColor, Math.min(0.5, Number(s.bgOpacity) || 0.5)),
      border: `1px solid ${rgba('#ffffff', 0.18)}`,
      backdropFilter: 'blur(14px)'
    },
    karaoke: {
      background: `linear-gradient(180deg, ${rgba('#000000', 0.2)}, ${rgba(s.bgColor, s.bgOpacity)})`,
      border: 'none'
    },
    band: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: 'none',
      borderLeft: `6px solid ${s.accentColor}`,
      borderRadius: 8
    },
    // Ek görünümler (kendi tasarımlarımız)
    altyazi: { background: 'transparent', border: 'none', boxShadow: 'none' },
    sahne: {
      background: `radial-gradient(120% 120% at 50% 100%, ${rgba(s.accentColor, 0.35)}, ${rgba(s.bgColor, s.bgOpacity)} 70%)`,
      border: 'none',
      boxShadow: `0 20px 50px ${rgba('#000000', 0.5)}`
    },
    retro: {
      background: rgba('#0d0221', 0.92),
      border: `3px solid ${s.accentColor}`,
      boxShadow: `0 0 0 3px #000, 0 0 24px ${rgba(s.accentColor, 0.5)}`,
      fontFamily: '"Press Start 2P", monospace'
    },
    kart: { background: rgba('#ffffff', 0.94), border: 'none', boxShadow: '0 14px 40px rgba(0,0,0,.35)' },
    kaset: {
      background: `repeating-linear-gradient(0deg, ${rgba('#000000', 0.15)} 0 2px, transparent 2px 4px), linear-gradient(135deg, #3f2412, #1c1008)`,
      border: '2px solid #a16207',
      fontFamily: '"Special Elite", monospace'
    },
    aurora: {
      background: `linear-gradient(135deg, ${rgba('#0f766e', 0.75)}, ${rgba('#6366f1', 0.7)}, ${rgba('#a855f7', 0.7)})`,
      border: `1px solid ${rgba('#ffffff', 0.2)}`,
      backdropFilter: 'blur(10px)'
    }
  };

  const anaBoy = Number(s.fontSize) || 30;
  const yanBoy = Number(s.contextFontSize) || 14;

  return (
    <div
      className={
        embedded
          ? 'w-full h-full flex items-center justify-center p-2 bg-transparent select-none'
          : 'w-screen h-screen flex items-center justify-center p-4 bg-transparent select-none'
      }
      style={{ fontFamily: s.fontFamily }}
    >
      <div
        className="w-full flex flex-col items-center justify-center text-center overflow-hidden"
        style={{
          ...(temaStili[tema] || temaStili.neon),
          borderRadius: tema === 'band' ? 8 : Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 20}px ${Number(s.paddingX) || 20}px`,
          maxWidth: Number(s.maxWidth) || 896,
          color: s.textColor
        }}
      >
        {s.showTrack && (
          <div
            className="flex items-center gap-2 mb-2 font-semibold uppercase tracking-wider"
            style={{ color: s.accentColor, fontSize: Math.max(10, yanBoy * 0.8) }}
          >
            {s.showDisc && <Disc className="w-4 h-4" style={{ animation: 'spin 6s linear infinite' }} />}
            <span>{artist ? `${artist} - ${songTitle}` : songTitle}</span>
          </div>
        )}

        {s.showPrev && onceki && (
          <div
            className="font-medium transition-all duration-500 line-clamp-1"
            style={{ color: s.contextColor, opacity: 0.55, fontSize: yanBoy }}
          >
            {onceki}
          </div>
        )}

        <div
          className="my-2 px-4 py-1 font-extrabold transition-all duration-300"
          style={{
            fontSize: anaBoy,
            fontFamily: s.lineFontFamily || undefined,
            color: tema === 'kart' ? '#111827' : s.textColor,
            // Altyazı: siyah kutu içinde, film altyazısı gibi
            background: tema === 'altyazi' ? 'rgba(0,0,0,.78)' : undefined,
            borderRadius: tema === 'altyazi' ? 6 : undefined,
            textShadow:
              tema === 'kart'
                ? 'none'
                : tema === 'minimal' || tema === 'altyazi'
                  ? '0 2px 6px rgba(0,0,0,.8)'
                  : `0 0 14px ${rgba(s.accentColor, 0.8)}`
          }}
        >
          {suAn}
        </div>

        {s.showNext && sonraki && (
          <div
            className="font-medium transition-all duration-500 line-clamp-1"
            style={{ color: s.contextColor, opacity: 0.65, fontSize: yanBoy }}
          >
            {sonraki}
          </div>
        )}
      </div>
    </div>
  );
}

export default LyricsWidget;
