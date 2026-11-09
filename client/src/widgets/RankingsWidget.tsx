/**
 * AxBoT Sıralama (Rankings) overlay
 * Developed by AxthrowA
 *
 * Eskiden yalnız adres satırındaki `?sort=` okunuyordu: renk, satır sayısı,
 * yenileme aralığı ve başlık koda gömülüydü. Ayrıca `u[sort] ?? u.points`
 * ifadesi watchtime/messages alan adlarını ıskalıyor, sütun boş kalınca
 * puanı gösteriyordu. Artık alan eşlemesi açık ve değer biçimlenerek yazılıyor.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useEffect, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { RANKINGS_DEFAULTS } from '../lib/widget-defaults.js';
import { rgba, sayiYaz, onizlemeKipi } from '../lib/widget-style.js';

type Satir = { username: string; display_name?: string; [k: string]: any };

const ALAN: Record<string, string[]> = {
  points: ['points', 'balance'],
  watchtime: ['watch_time', 'watchtime', 'watch_minutes', 'minutes_watched'],
  messages: ['messages_count', 'messages', 'message_count']
};

const MADALYA = ['🥇', '🥈', '🥉'];

/** Sıralama ölçütünün değerini kullanıcı satırından okur. */
export function deger(u: Satir, sort: string): number {
  for (const alan of ALAN[sort] || [sort]) {
    if (u[alan] !== undefined && u[alan] !== null) return Number(u[alan]) || 0;
  }
  return 0;
}

/** İzleme süresi dakika tutulur; saat/dakika olarak yazılır. */
export function degerYaz(n: number, sort: string, kisalt: boolean, sonek: string): string {
  if (sort === 'watchtime') {
    const dk = Math.max(0, Math.floor(n));
    const sa = Math.floor(dk / 60);
    return sa > 0 ? `${sa}sa ${dk % 60}dk` : `${dk}dk`;
  }
  return `${sayiYaz(n, kisalt)}${sonek ? ` ${sonek}` : ''}`;
}

export interface RankingsWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

const ORNEK: Satir[] = [
  { username: 'axthrowa', display_name: 'AxthrowA', points: 12480, watch_time: 640, messages_count: 812 },
  { username: 'streamqueen', display_name: 'StreamQueen', points: 9120, watch_time: 501, messages_count: 640 },
  { username: 'progamer34', display_name: 'ProGamer34', points: 7640, watch_time: 388, messages_count: 512 },
  { username: 'kraloyuncu', display_name: 'KralOyuncu', points: 5210, watch_time: 250, messages_count: 301 },
  { username: 'kartal34', display_name: 'Kartal34', points: 3980, watch_time: 190, messages_count: 244 }
];

export function RankingsWidget({ embedded = false, previewMode = false }: RankingsWidgetProps) {
  const s = useWidgetSettings('rankings', RANKINGS_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const sort = String(s.sort || 'points');
  const [users, setUsers] = useState<Satir[]>(onizleme ? ORNEK : []);

  useEffect(() => {
    if (onizleme) return;
    const limit = Math.max(1, Number(s.limit) || 10);
    const load = () =>
      fetch(`/api/economy/leaderboard?sort=${sort}`)
        .then((r) => r.json())
        .then((d) => setUsers((Array.isArray(d) ? d : []).slice(0, limit)))
        .catch(() => {});
    load();
    const t = setInterval(load, Math.max(2, Number(s.refreshSeconds) || 8) * 1000);
    return () => clearInterval(t);
  }, [sort, s.limit, s.refreshSeconds, onizleme]);

  if (s.hideEmpty && users.length === 0) return null;

  const tema = String(s.theme || 'classic');
  const temaStili: Record<string, React.CSSProperties> = {
    classic: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `1px solid ${rgba(s.borderColor, 0.12)}`
    },
    minimal: { background: 'transparent', border: 'none' },
    glass: {
      background: rgba(s.bgColor, Math.min(0.5, Number(s.bgOpacity) || 0.5)),
      border: `1px solid ${rgba('#ffffff', 0.18)}`,
      backdropFilter: 'blur(12px)'
    },
    neon: {
      background: rgba(s.bgColor, s.bgOpacity),
      border: `2px solid ${s.accentColor}`,
      boxShadow: `0 0 20px ${rgba(s.accentColor, 0.55)}`
    },
    podium: {
      background: `linear-gradient(180deg, ${rgba(s.accentColor, 0.22)}, ${rgba(s.bgColor, s.bgOpacity)})`,
      border: `1px solid ${rgba(s.accentColor, 0.4)}`
    }
  };

  const boy = Number(s.fontSize) || 13;
  const baslikSonek =
    sort === 'watchtime' ? 'İZLEME' : sort === 'messages' ? 'MESAJ' : 'PUAN';

  return (
    <div
      className={embedded ? 'w-full h-full flex items-start' : 'w-screen h-screen bg-transparent p-4 flex items-start'}
    >
      <div {...kokOzellik(s)}
        style={{
          ...(kutuTasarimi(s) || temaStili[tema] || temaStili.classic), ...ortakHareket(s),
          borderRadius: Number(s.radius) || 16,
          padding: `${Number(s.paddingY) || 16}px ${Number(s.paddingX) || 16}px`,
          minWidth: Number(s.minWidth) || 280,
          color: s.textColor,
          fontFamily: s.fontFamily,
          fontSize: boy
        }}
      >
        {s.showTitle && (
          <div
            className="font-black uppercase tracking-wider"
            style={{ marginBottom: 10, color: s.accentColor, fontSize: boy * 1.1 }}
          >
            🏆 {s.title} · {baslikSonek}
          </div>
        )}

        {users.map((u, i) => {
          const ilk = s.highlightTop && i === 0;
          return (
            <div
              key={u.username || i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: Number(s.rowGap) || 6,
                padding: ilk ? '2px 6px' : undefined,
                borderRadius: ilk ? 8 : undefined,
                background: ilk ? rgba(s.accentColor, 0.16) : undefined,
                fontWeight: ilk ? 800 : 500
              }}
            >
              <span className="truncate">
                {s.showMedals && MADALYA[i] ? `${MADALYA[i]} ` : s.showRank ? `${i + 1}. ` : ''}
                {u.display_name || u.username}
              </span>
              {s.showValue && (
                <span style={{ color: ilk ? s.accentColor : undefined, whiteSpace: 'nowrap' }}>
                  {degerYaz(deger(u, sort), sort, !!s.compactNumbers, String(s.valueSuffix || ''))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RankingsWidget;
