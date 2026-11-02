/**
 * StreamAxT Giveaway overlay
 * Developed by AxthrowA
 *
 * Çekiliş açıkken başlık, katılım kelimesi ve katılımcı sayısını gösterir;
 * kazanan çekilince `winnerShowSec` saniye kazananı gösterip kaybolur
 * (eskiden kazanan ekranda sonsuza dek kalıyordu ve önizleme örneği yoktu).
 */
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { GIVEAWAY_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

export function GiveawayWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('giveaways', GIVEAWAY_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const [active, setActive] = useState<any>(onizleme ? { title: 'Steam hediye kartı', keyword: s.keyword, created_at: Date.now(), duration_minutes: 5 } : null);
  const [entries, setEntries] = useState(onizleme ? 37 : 0);
  const [winner, setWinner] = useState<string | null>(null);
  // Katılım geri sayımı (Çekilişler sayfasındaki "Süre"); her saniye yeniden çizilir
  const [, setTik] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTik((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const bitis = active && Number(active.duration_minutes) > 0 ? Number(active.created_at) + Number(active.duration_minutes) * 60_000 : 0;
  const kalanSn = bitis ? Math.max(0, Math.round((bitis - Date.now()) / 1000)) : null;
  const ayar = useRef(s);
  ayar.current = s;

  useEffect(() => {
    if (onizleme) return;
    const load = () =>
      fetch('/api/giveaways')
        .then((r) => r.json())
        .then((d) => {
          setActive(d.active || null);
          setEntries((d.entries || []).length);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 4000);
    let gizle: ReturnType<typeof setTimeout> | null = null;
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
        setWinner(ad);
        if (gizle) clearTimeout(gizle);
        const sn = m.test ? 6 : Number(ayar.current.winnerShowSec);
        if (sn > 0) gizle = setTimeout(() => setWinner(null), sn * 1000);
      }
      if (m?.type === 'giveaway_join') load();
    };
    return () => {
      clearInterval(t);
      if (gizle) clearTimeout(gizle);
      ws.close();
    };
  }, [onizleme]);

  if (!active && !winner) return null;
  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <div className={`axt-anim-${s.animation}`} style={{
      fontFamily: s.fontFamily, background: bg, borderRadius: s.borderRadius, padding: 20, color: s.fontColor, textAlign: 'center'
    }}>
      <div style={{ fontSize: s.fontSize, fontWeight: 900, color: s.accentColor }}>{s.overlayTitle}</div>
      {active && <div style={{ fontWeight: 800, marginTop: 8 }}>{active.title}</div>}
      {s.showKeyword && active && <div style={{ marginTop: 8, opacity: 0.8 }}>Katıl: {active.keyword || s.keyword}</div>}
      {s.showEntries && active && <div style={{ marginTop: 6 }}>{entries} katılımcı</div>}
      {s.showTimer && active && kalanSn !== null && (
        <div style={{ marginTop: 6, opacity: 0.85 }}>
          {kalanSn > 0 ? `⏳ ${Math.floor(kalanSn / 60)}:${String(kalanSn % 60).padStart(2, "0")}` : "Katılım kapandı"}
        </div>
      )}
      {winner && <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900 }}>🎉 {winner}</div>}
    </div>
  );
}

export default GiveawayWidget;
