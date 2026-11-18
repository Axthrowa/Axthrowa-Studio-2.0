/**
 * AxBoT Skor Tablosu — 2-6 takımın skoru; `!skortablo` komutu ya da panel günceller
 * Developed by AxthrowA
 *
 * Görünümler: TV yayını (eğik takım panelleri), kartlar, alt alta sıralama (oranlı çubuk), neon, e-spor HUD,
 * minimal. Skor değişince sayı zıplar ve "+1" yükselir; önde olan takımda taç.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { hareketAnahtari, ortakHareket } from '../lib/animations.js';
import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SCOREBOARD_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeKipi, rgba, wsAdresi } from '../lib/widget-style.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';

interface Takim {
  ad: string;
  renk: string;
  skor: number;
}
interface Tablo {
  baslik: string;
  takimlar: Takim[];
}

const ORNEK: Tablo = { baslik: 'MAÇ SKORU', takimlar: [{ ad: 'Mavi', renk: '#3b82f6', skor: 3 }, { ad: 'Kırmızı', renk: '#ef4444', skor: 2 }] };

const SKOR_CSS = `
@keyframes axt-skor-vurus { 0% { transform: scale(1) } 35% { transform: scale(1.35) } 100% { transform: scale(1) } }
@keyframes axt-skor-artti { 0% { transform: translate(-50%, 0); opacity: 0 } 20% { opacity: 1 } 100% { transform: translate(-50%, -42px); opacity: 0 } }
@keyframes axt-skor-parilti { 0% { left: -60% } 100% { left: 130% } }
`;

/** Tek bir takımın önde olup olmadığı (beraberlikte kimse) */
export function onde(takimlar: Takim[]): number {
  if (takimlar.length < 2) return -1;
  const enCok = Math.max(...takimlar.map((t) => t.skor));
  const kac = takimlar.filter((t) => t.skor === enCok).length;
  return kac === 1 ? takimlar.findIndex((t) => t.skor === enCok) : -1;
}

export function ScoreboardWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('scoreboard', SCOREBOARD_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const [t, setT] = useState<Tablo | null>(onizleme ? ORNEK : null);
  // Son değişen takım ve fark ("+1"); anahtar her değişimde artar ki animasyon yeniden oynasın
  const [degisim, setDegisim] = useState<{ i: number; fark: number; anahtar: number } | null>(null);
  const sayac = useRef(0);

  useEffect(() => {
    if (onizleme) return;
    const oku = () => fetch('/api/skor-tablosu').then((r) => r.json()).then((d) => Array.isArray(d?.takimlar) && setT(d)).catch(() => {});
    oku();
    const ws = new KaliciSoket(wsAdresi());
    ws.onyenidenbaglandi = oku;
    ws.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (m.type !== 'skor_tablosu' || !m.data) return;
        setT((eski) => {
          const i = eski ? m.data.takimlar.findIndex((x: Takim, j: number) => x.skor !== eski.takimlar[j]?.skor) : -1;
          if (i >= 0) {
            const anahtar = ++sayac.current;
            setDegisim({ i, fark: m.data.takimlar[i].skor - (eski?.takimlar[i]?.skor || 0), anahtar });
            setTimeout(() => setDegisim((d) => (d?.anahtar === anahtar ? null : d)), 1400);
          }
          return m.data;
        });
      } catch {
        /* bozuk mesaj */
      }
    };
    return () => ws.close();
  }, [onizleme]);

  if (!t) return null;
  const tema = String(s.theme || 'broadcast');
  const boy = Number(s.fontSize) || 48;
  const golge = '0 2px 4px rgba(0,0,0,.9)';
  const lider = s.showLeader !== false ? onde(t.takimlar) : -1;

  const skorSayisi = (x: Takim, i: number, ek: CSSProperties = {}) => (
    <span className="relative inline-block font-black tabular-nums" style={{ fontSize: boy, lineHeight: 1, textShadow: golge, ...ek }}>
      <span key={degisim?.i === i ? degisim.anahtar : 0} className="inline-block" style={{ animation: degisim?.i === i ? 'axt-skor-vurus 450ms ease-out' : undefined }}>
        {x.skor}
      </span>
      {degisim?.i === i && degisim.fark !== 0 && (
        <span
          key={`f${degisim.anahtar}`}
          className="absolute left-1/2 top-0 font-black"
          style={{ fontSize: boy * 0.4, color: degisim.fark > 0 ? '#4ade80' : '#f87171', textShadow: golge, animation: 'axt-skor-artti 1.2s ease-out forwards', pointerEvents: 'none' }}
        >
          {degisim.fark > 0 ? `+${degisim.fark}` : degisim.fark}
        </span>
      )}
    </span>
  );
  const tac = (i: number) => (lider === i ? <span style={{ fontSize: boy * 0.42, filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.8))' }}>👑</span> : null);
  const baslik = s.showTitle ? (
    <div className="font-black uppercase tracking-[0.25em] text-center" style={{ color: s.accentColor, fontSize: Math.max(11, boy * 0.32), textShadow: golge }}>
      {t.baslik}
    </div>
  ) : null;

  let icerik: ReactElement;
  if (tema === 'broadcast' && t.takimlar.length === 2) {
    // TV yayını: iki eğik takım paneli ortada skor kutusuna dayanır
    const [a, b] = t.takimlar;
    const panel = (x: Takim, i: number, sag: boolean) => (
      <div
        className="relative flex items-center gap-2 overflow-hidden"
        style={{
          background: `linear-gradient(${sag ? 270 : 90}deg, ${rgba(x.renk, 0.95)}, ${rgba(x.renk, 0.7)})`,
          clipPath: sag ? 'polygon(0 0, 100% 0, 100% 100%, 14px 100%)' : 'polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)',
          padding: `${boy * 0.18}px ${boy * 0.5}px`,
          flexDirection: sag ? 'row-reverse' : 'row',
          minWidth: boy * 3.2,
          // Uzun takım adı paneli büyütüp çubuğu kaynaktan taşırıyordu: ad "…" ile kısalır
          maxWidth: '40vw'
        }}
      >
        <span className="absolute top-0 bottom-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent)', animation: 'axt-skor-parilti 3.5s ease-in-out infinite' }} />
        <span className="relative font-black uppercase tracking-wider truncate" style={{ fontSize: boy * 0.42, textShadow: golge }}>{x.ad}</span>
        <span className="relative">{tac(i)}</span>
      </div>
    );
    icerik = (
      <div className="flex flex-col items-stretch gap-1">
        {s.showTitle && (
          <div data-yuzey="" className="self-center px-4 py-0.5 rounded-t-lg max-w-full truncate" style={{ background: rgba(s.bgColor, Math.max(0.6, Number(s.bgOpacity))) }}>
            {baslik}
          </div>
        )}
        <div className="flex items-stretch" style={{ filter: `drop-shadow(0 8px 18px ${rgba(s.accentColor, 0.35)})` }}>
          {panel(a, 0, false)}
          <div data-yuzey="" className="flex items-center gap-3 px-4" style={{ background: rgba(s.bgColor, Math.max(0.85, Number(s.bgOpacity))), borderTop: `3px solid ${s.accentColor}`, borderBottom: `3px solid ${s.accentColor}` }}>
            {skorSayisi(a, 0)}
            <span className="font-black" style={{ fontSize: boy * 0.5, color: s.accentColor }}>:</span>
            {skorSayisi(b, 1)}
          </div>
          {panel(b, 1, true)}
        </div>
      </div>
    );
  } else if (tema === 'stacked' || (tema === 'broadcast' && t.takimlar.length !== 2)) {
    // Alt alta: skora göre sıralı, en yükseğe oranlı çubuk
    const sirali = t.takimlar.map((x, i) => ({ x, i })).sort((p, q) => q.x.skor - p.x.skor);
    const enCok = Math.max(1, ...t.takimlar.map((x) => x.skor));
    icerik = (
      <div data-yuzey="" className="flex flex-col gap-1.5" style={{ minWidth: boy * 6, background: rgba(s.bgColor, s.bgOpacity), borderRadius: Number(s.radius), padding: 12, border: `2px solid ${rgba(s.accentColor, 0.6)}` }}>
        {baslik}
        {sirali.map(({ x, i }, sira) => (
          <div key={i} className="relative flex items-center gap-3 px-3 py-1.5 rounded-lg overflow-hidden" style={{ background: rgba('#ffffff', 0.05) }}>
            <span className="absolute inset-y-0 left-0" style={{ width: `${(x.skor / enCok) * 100}%`, background: `linear-gradient(90deg, ${rgba(x.renk, 0.75)}, ${rgba(x.renk, 0.35)})`, transition: 'width .6s ease' }} />
            <span className="relative font-black opacity-80 w-6 text-center" style={{ fontSize: boy * 0.38, textShadow: golge }}>{sira + 1}</span>
            <span className="relative font-black uppercase tracking-wider flex-1 truncate" style={{ fontSize: boy * 0.42, textShadow: golge }}>{x.ad}</span>
            <span className="relative">{tac(i)}</span>
            <span className="relative">{skorSayisi(x, i, { fontSize: boy * 0.7 })}</span>
          </div>
        ))}
      </div>
    );
  } else {
    // Kartlar / neon / hud / minimal: yan yana
    const kartStili = (x: Takim): CSSProperties =>
      tema === 'minimal'
        ? {}
        : tema === 'neon'
          ? { background: rgba('#05010d', 0.85), border: `2px solid ${x.renk}`, boxShadow: `0 0 16px ${x.renk}, inset 0 0 14px ${rgba(x.renk, 0.35)}`, borderRadius: Number(s.radius) }
          : tema === 'hud'
            ? { background: `linear-gradient(180deg, ${rgba(s.bgColor, 0.92)}, ${rgba(x.renk, 0.35)})`, borderBottom: `4px solid ${x.renk}`, clipPath: 'polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)' }
            : { background: `linear-gradient(160deg, ${rgba(x.renk, 0.95)}, ${rgba(x.renk, 0.5)})`, borderTop: `4px solid ${rgba('#ffffff', 0.5)}`, borderRadius: Number(s.radius), boxShadow: `0 8px 20px ${rgba(x.renk, 0.45)}` };
    icerik = (
      <div className="flex flex-col items-center gap-2" style={tema === 'minimal' ? {} : { background: rgba(s.bgColor, tema === 'split' ? s.bgOpacity : 0), borderRadius: Number(s.radius), padding: tema === 'split' ? 12 : 0 }}>
        {baslik}
        <div className="flex items-stretch gap-2">
          {t.takimlar.map((x, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span className="font-black px-1" style={{ fontSize: boy * 0.45, color: tema === 'neon' ? s.accentColor : rgba(s.textColor, 0.7), textShadow: golge }}>
                  {tema === 'minimal' ? ':' : 'VS'}
                </span>
              )}
              <div className="flex flex-col items-center px-5 py-2" style={{ ...kartStili(x), minWidth: boy * 2.2 }}>
                <span className="flex items-center gap-1 font-black uppercase tracking-wider" style={{ fontSize: boy * 0.36, textShadow: golge, color: tema === 'minimal' || tema === 'neon' ? x.renk : undefined }}>
                  {tac(i)}
                  {x.ad}
                </span>
                {skorSayisi(x, i, tema === 'neon' ? { color: '#fff', textShadow: `0 0 10px ${x.renk}, 0 0 22px ${x.renk}` } : {})}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div key={hareketAnahtari(s)} {...kokOzellik(s)} className={`${embedded ? 'w-full h-full' : 'w-screen h-screen p-6'} flex items-start justify-center select-none`} style={{ fontFamily: s.fontFamily, color: s.textColor, ...kutuTasarimi(s), ...ortakHareket(s) }}>
      <style>{SKOR_CSS}</style>
      {icerik}
    </div>
  );
}

export default ScoreboardWidget;
