/**
 * StreamAxT Emote Combo overlay
 * Developed by AxthrowA
 */
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { EMOTE_COMBO_DEFAULTS } from '../lib/widget-defaults.js';

interface Combo { emote: string; count: number; displayUntil: number }

export function EmoteComboWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('emote-combo', EMOTE_COMBO_DEFAULTS);
  const { lastMessage } = useWebSocket('chatbox');
  const [combo, setCombo] = useState<Combo | null>(null);
  const [floats, setFloats] = useState<Array<{ id: number; emote: string; x: number }>>([]);
  const last = useRef<{ emote: string; at: number } | null>(null);

  useEffect(() => {
    if (!lastMessage) return;
    // `emote_used`: widget "Test" düğmesi ve sunucu olayları (eskiden dinlenmiyordu)
    const dogrudan = lastMessage.type === 'emote_used' ? String(lastMessage.emote || lastMessage.data?.emote || '') : '';
    if (lastMessage.type !== 'chat' && !dogrudan) return;
    // Ortak kara listedeki kullanıcı kombo sayacına katılmaz
    if (!dogrudan && lastMessage.data?.karaListede) return;
    const text: string = dogrudan || lastMessage.data?.message || lastMessage.payload?.message || '';
    // Olay kombo sayısını hazır verirse (test: combo 7) doğrudan göster
    const hazirKombo = dogrudan ? Math.max(0, Number(lastMessage.combo) || 0) : 0;
    if (hazirKombo > 1) {
      const an = Date.now();
      setCombo({ emote: dogrudan, count: hazirKombo, displayUntil: an + s.displayMs });
      last.current = { emote: dogrudan, at: an };
      return;
    }
    const tokens = text.trim().split(/\s+/);
    const emote = tokens.find(t => t.startsWith(':') && t.endsWith(':') && t.length > 2)
      || tokens.find(t => /^[\u{1F300}-\u{1FAFF}]$/u.test(t))
      || (tokens.length === 1 ? tokens[0] : null);
    if (!emote) return;
    const now = Date.now();
    if (last.current && last.current.emote === emote && now - last.current.at < s.timeoutMs) {
      setCombo(prev => {
        const count = (prev?.count || 1) + 1;
        if (count >= s.minCombo && s.soundEnabled && s.soundUrl) {
          const a = new Audio(s.soundUrl);
          a.volume = s.soundVolume;
          a.play().catch(() => {});
        }
        return { emote, count, displayUntil: now + s.displayMs };
      });
    } else {
      setCombo({ emote, count: 1, displayUntil: now + s.displayMs });
    }
    last.current = { emote, at: now };
    if (s.showFloating) {
      const id = now;
      setFloats(f => [...f.slice(-12), { id, emote, x: 20 + Math.random() * 60 }]);
      setTimeout(() => setFloats(f => f.filter(x => x.id !== id)), 1800);
    }
  }, [lastMessage, s]);

  useEffect(() => {
    const t = setInterval(() => {
      setCombo(c => (c && c.displayUntil < Date.now() ? null : c));
    }, 250);
    return () => clearInterval(t);
  }, []);

  if (!combo || combo.count < s.minCombo) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {s.showFloating && floats.map(f => (
          <span key={f.id} className="axt-anim-bounce" style={{ position: 'absolute', left: `${f.x}%`, bottom: 20, fontSize: 28 }}>{f.emote}</span>
        ))}
      </div>
    );
  }

  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;
  const title = (s.template || 'x{count} COMBO!').replace('{count}', String(combo.count)).replace('{emote}', combo.emote);
  const sub = (s.subTemplate || '{emote} ÇILGINLIĞI!').replace('{emote}', combo.emote).replace('{count}', String(combo.count));

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', position: 'relative' }}>
      {s.showPopup && (
        <div className={`axt-anim-${s.animation}`} style={{
          background: bg,
          border: `2px solid ${s.borderColor}`,
          borderRadius: 24,
          padding: '24px 40px',
          textAlign: 'center',
          fontFamily: s.fontFamily
        }}>
          <div style={{ fontSize: s.size }}>{combo.emote}</div>
          <div style={{
            fontSize: s.fontSize,
            color: s.fontColor,
            WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined
          }}>{title}</div>
          <div style={{ color: '#fde68a', letterSpacing: 4, marginTop: 8 }}>{sub}</div>
        </div>
      )}
      {s.showFloating && floats.map(f => (
        <span key={f.id} className="axt-anim-bounce" style={{ position: 'absolute', left: `${f.x}%`, bottom: 20, fontSize: 28 }}>{f.emote}</span>
      ))}
    </div>
  );
}

export default EmoteComboWidget;
