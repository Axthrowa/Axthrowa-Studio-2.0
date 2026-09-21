/**
 * StreamAxT Giveaway overlay
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { GIVEAWAY_DEFAULTS } from '../lib/widget-defaults.js';

export function GiveawayWidget() {
  const s = useWidgetSettings('giveaways', GIVEAWAY_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const [active, setActive] = useState<any>(null);
  const [entries, setEntries] = useState(0);
  const [winner, setWinner] = useState<string | null>(null);

  const load = () => {
    fetch('/api/giveaways').then(r => r.json()).then(d => {
      setActive(d.active);
      setEntries((d.entries || []).length);
    }).catch(() => {});
  };

  useEffect(() => { load(); const t = setInterval(load, 4000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'giveaway_winner') setWinner(lastMessage.payload?.winner || lastMessage.winner?.winner);
    if (lastMessage.type === 'giveaway_join') load();
  }, [lastMessage]);

  if (!active && !winner) return null;
  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <div className={`axt-anim-${s.animation}`} style={{
      fontFamily: s.fontFamily, background: bg, borderRadius: s.borderRadius, padding: 20, color: s.fontColor, textAlign: 'center'
    }}>
      <div style={{ fontSize: s.fontSize, fontWeight: 900, color: s.accentColor }}>{s.overlayTitle}</div>
      {active && <div style={{ fontWeight: 800, marginTop: 8 }}>{active.title}</div>}
      {s.showKeyword && active && <div style={{ marginTop: 8, opacity: 0.8 }}>Katıl: {active.keyword || s.keyword}</div>}
      {s.showEntries && <div style={{ marginTop: 6 }}>{entries} katılımcı</div>}
      {winner && <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900 }}>🎉 {winner}</div>}
    </div>
  );
}

export default GiveawayWidget;
