/**
 * AxBoT Giveaway overlay
 * Developed by AxthrowA
 *
 * Çekiliş açıkken ödül, katılım kelimesi, katılımcı sayısı ve kalan süre görünür. Kazanan çekilince
 * katılımcı adları kasa açar gibi sağdan sola kayar, yavaşlar ve kazanan `winnerShowSec` saniye gösterilip kaybolur.
 */
import { kutuTasarimi } from '../lib/widget-style.js';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import confetti from 'canvas-confetti';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { GIVEAWAY_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

const KART_G = 170;
const KART_ARA = 8;
const SERIT_KART = 52;
const KAZANAN_SIRA = 46;

/** Kasa şeridi: kazanan sonlara yakın bir kartta; işaret kartın tam ortasına denk gelmesin diye küçük sapma. */
export function kasaSeridi(kazanan: string, adaylar: string[], r: () => number = Math.random) {
  const havuz = adaylar.length ? adaylar : [kazanan];
  const isimler = Array.from({ length: SERIT_KART }, () => havuz[Math.floor(r() * havuz.length) % havuz.length]);
  isimler[KAZANAN_SIRA] = kazanan;
  const kayma = KAZANAN_SIRA * (KART_G + KART_ARA) + KART_G / 2 + (r() - 0.5) * KART_G * 0.7;
  return { isimler, kayma };
}

const KAYAN_CSS = `@keyframes axt-cekilis-kay { from { left: 100%; transform: translateX(0) } to { left: 0; transform: translateX(-100%) } }
@keyframes axt-kasa { to { transform: translate3d(calc(var(--kayma) * -1), 0, 0) } }`;

export function GiveawayWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('giveaways', GIVEAWAY_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const [active, setActive] = useState<any>(null);
  const [entries, setEntries] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [kasa, setKasa] = useState<{ no: number; isimler: string[]; kayma: number; sureMs: number } | null>(null);
  // Katılım geri sayımı; her saniye yeniden çizilir
  const [, setTik] = useState(0);
  const ayar = useRef(s);
  ayar.current = s;
  const adlar = useRef<string[]>([]);
  adlar.current = entries;
  const zamanlar = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const t = setInterval(() => setTik((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (onizleme) return;
    const load = () =>
      fetch('/api/giveaways')
        .then((r) => r.json())
        .then((d) => {
          setActive(d.active || null);
          // Çekiliş kapanınca liste boşalır: çark son bilinen adları kullanabilsin
          if (d.active) setEntries((d.entries || []).map((e: any) => e.username));
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 4000);

    const carkiDondur = (kazanan: string, adaylar: string[], sonucSn: number) => {
      zamanlar.current.forEach(clearTimeout);
      zamanlar.current = [];
      setWinner(null);
      const sureMs = Math.min(20, Math.max(3, Number(ayar.current.drawSec) || 7)) * 1000;
      setKasa({ no: Date.now(), ...kasaSeridi(kazanan, adaylar), sureMs });
      zamanlar.current.push(
        setTimeout(() => {
          setKasa(null);
          setWinner(kazanan);
          void confetti({ particleCount: 140, spread: 90, origin: { y: 0.55 } });
          if (sonucSn > 0) zamanlar.current.push(setTimeout(() => setWinner(null), sonucSn * 1000));
        }, sureMs + 500)
      );
    };

    const ws = new KaliciSoket(wsAdresi());
    ws.onyenidenbaglandi = load;
    ws.onmessage = (e) => {
      let m: any;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m?.type === 'giveaway_winner') {
        const ad = m.payload?.winner || m.winner?.winner || m.winner;
        if (typeof ad !== 'string') return;
        const adaylar = m.payload?.adaylar || m.winner?.adaylar || adlar.current;
        carkiDondur(ad, adaylar, m.test ? 6 : Number(ayar.current.winnerShowSec));
        load();
      }
      if (m?.type === 'giveaway_join' || m?.type === 'giveaway_started') load();
    };
    return () => {
      clearInterval(t);
      zamanlar.current.forEach(clearTimeout);
      ws.close();
    };
  }, [onizleme]);

  // Önizleme ayarı anında yansıtır: örnek değerler her çizimde güncel ayardan okunur
  const gosterilen = onizleme ? { title: 'Steam hediye kartı', keyword: s.keyword, created_at: Date.now() - 45_000, duration_minutes: 5 } : active;
  const katilimci = onizleme ? 37 : entries.length;
  const isimler = onizleme ? ['Mira', 'Deniz', 'Kaan', 'Ece', 'Berk', 'Zeynep', 'Can', 'Ayşe'] : entries;
  if (!gosterilen && !winner && !kasa) return null;

  const sureMs = gosterilen ? Number(gosterilen.duration_minutes) * 60_000 : 0;
  const kalanMs = sureMs > 0 ? Math.max(0, Number(gosterilen.created_at) + sureMs - Date.now()) : 0;
  const kalanSn = Math.round(kalanMs / 1000);
  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <div
      data-katman-cekilis={kasa || winner ? '' : undefined}
      className={`axt-anim-${s.animation}`}
      style={{ fontFamily: s.fontFamily, background: bg, borderRadius: s.borderRadius, padding: '18px 22px', color: s.fontColor, textAlign: 'center', overflow: 'hidden', ...kutuTasarimi(s), borderTop: s.kabuk ? undefined : `4px solid ${s.accentColor}` }}
    >
      <div style={{ fontSize: Math.round(s.fontSize * 0.75), fontWeight: 800, letterSpacing: 2, color: s.accentColor }}>{s.overlayTitle}</div>

      {kasa ? (
        <div style={{ marginTop: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 8 }}>Çekiliyor…</div>
          <div style={{ position: 'relative', height: 72, overflow: 'hidden', WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent)' }}>
            <style>{KAYAN_CSS}</style>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 3, marginLeft: -1.5, background: s.accentColor, boxShadow: `0 0 10px ${s.accentColor}`, zIndex: 1 }} />
            <div
              key={kasa.no}
              style={
                {
                  position: 'absolute',
                  left: '50%',
                  top: 4,
                  display: 'flex',
                  gap: KART_ARA,
                  willChange: 'transform',
                  '--kayma': `${kasa.kayma}px`,
                  animation: `axt-kasa ${kasa.sureMs}ms cubic-bezier(.08,.72,.12,1) forwards`
                } as CSSProperties
              }
            >
              {kasa.isimler.map((ad, i) => (
                <div key={i} style={{ flex: `0 0 ${KART_G}px`, height: 64, display: 'grid', placeItems: 'center', padding: '0 8px', borderRadius: 8, background: 'rgba(255,255,255,.1)', borderBottom: `3px solid ${s.accentColor}`, fontWeight: 800, fontSize: s.fontSize, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {ad}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : winner ? (
        <div style={{ marginTop: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Kazanan</div>
          <div style={{ fontSize: s.fontSize * 1.9, fontWeight: 900, color: s.accentColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            🎉 {winner}
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: s.fontSize * 1.35, fontWeight: 900, marginTop: 6 }}>{gosterilen.title}</div>
          {s.showKeyword && (
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 13, opacity: 0.75 }}>Katılmak için sohbete yaz </span>
              <span style={{ display: 'inline-block', marginTop: 4, padding: '4px 14px', borderRadius: 999, background: s.accentColor, color: '#fff', fontWeight: 900, fontSize: s.fontSize }}>
                {gosterilen.keyword}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 10, fontWeight: 700, fontSize: 14 }}>
            {s.showEntries && <span>👥 {katilimci} katılımcı</span>}
            {s.showTimer && sureMs > 0 && <span>{kalanSn > 0 ? `⏳ ${Math.floor(kalanSn / 60)}:${String(kalanSn % 60).padStart(2, '0')}` : 'Katılım kapandı'}</span>}
          </div>
          {s.showTimer && sureMs > 0 && (
            <div style={{ height: 5, marginTop: 8, borderRadius: 999, background: 'rgba(255,255,255,.15)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(kalanMs / sureMs) * 100}%`, background: s.accentColor, transition: 'width 1s linear' }} />
            </div>
          )}
          {s.showEntries && isimler.length > 0 && (
            <div style={{ position: 'relative', height: 20, marginTop: 8, overflow: 'hidden', fontSize: 13, opacity: 0.8 }}>
              <style>{KAYAN_CSS}</style>
              {/* Mutlak konum: uzun liste kutuyu genişletmez. Süre onarlı artar: her katılımda yazı başa dönmesin */}
              <span style={{ position: 'absolute', top: 0, whiteSpace: 'nowrap', animation: `axt-cekilis-kay ${Math.max(10, Math.ceil(isimler.length / 10) * 12)}s linear infinite` }}>
                {isimler.join('  •  ')}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GiveawayWidget;
