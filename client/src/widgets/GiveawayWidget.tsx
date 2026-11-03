/**
 * AxBoT Giveaway overlay
 * Developed by AxthrowA
 *
 * Çekiliş açıkken ödül, katılım kelimesi, katılımcı sayısı ve kalan süre görünür. Kazanan çekilince
 * katılımcı adları çarkta döner, yavaşlar ve kazanan `winnerShowSec` saniye gösterilip kaybolur.
 */
import { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { GIVEAWAY_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

/** Çark adımlarının bekleme süreleri (ms): hızlı başlar, yavaşlayarak durur. */
export function carkAdimlari(toplamMs = 3200, ilkMs = 60, carpan = 1.12): number[] {
  const adimlar: number[] = [];
  let bekleme = ilkMs;
  let toplam = 0;
  while (toplam + bekleme <= toplamMs) {
    adimlar.push(Math.round(bekleme));
    toplam += bekleme;
    bekleme *= carpan;
  }
  return adimlar;
}

export function GiveawayWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('giveaways', GIVEAWAY_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const [active, setActive] = useState<any>(null);
  const [entries, setEntries] = useState<string[]>([]);
  const [winner, setWinner] = useState<string | null>(null);
  const [cark, setCark] = useState<string | null>(null);
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
      const havuz = adaylar.length ? adaylar : [kazanan];
      let gecen = 0;
      carkAdimlari().forEach((bekleme, i) => {
        gecen += bekleme;
        zamanlar.current.push(setTimeout(() => setCark(havuz[i % havuz.length]), gecen));
      });
      zamanlar.current.push(
        setTimeout(() => {
          setCark(null);
          setWinner(kazanan);
          void confetti({ particleCount: 140, spread: 90, origin: { y: 0.55 } });
          if (sonucSn > 0) zamanlar.current.push(setTimeout(() => setWinner(null), sonucSn * 1000));
        }, gecen + 300)
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
  const sonKatilanlar = onizleme ? ['Mira', 'Deniz', 'Kaan'] : entries.slice(0, 3);
  if (!gosterilen && !winner && !cark) return null;

  const sureMs = gosterilen ? Number(gosterilen.duration_minutes) * 60_000 : 0;
  const kalanMs = sureMs > 0 ? Math.max(0, Number(gosterilen.created_at) + sureMs - Date.now()) : 0;
  const kalanSn = Math.round(kalanMs / 1000);
  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <div
      className={`axt-anim-${s.animation}`}
      style={{ fontFamily: s.fontFamily, background: bg, borderRadius: s.borderRadius, padding: '18px 22px', color: s.fontColor, textAlign: 'center', overflow: 'hidden', borderTop: `4px solid ${s.accentColor}` }}
    >
      <div style={{ fontSize: Math.round(s.fontSize * 0.75), fontWeight: 800, letterSpacing: 2, color: s.accentColor }}>{s.overlayTitle}</div>

      {cark || winner ? (
        <div style={{ marginTop: 12, marginBottom: 6 }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>{winner ? 'Kazanan' : 'Çekiliyor…'}</div>
          <div style={{ fontSize: s.fontSize * 1.9, fontWeight: 900, color: winner ? s.accentColor : s.fontColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {winner ? `🎉 ${winner}` : cark}
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
          {s.showEntries && sonKatilanlar.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Son katılanlar: {sonKatilanlar.join(', ')}</div>
          )}
        </>
      )}
    </div>
  );
}

export default GiveawayWidget;
