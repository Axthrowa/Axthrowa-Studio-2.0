/**
 * AxBoT Polls overlay
 * Developed by AxthrowA
 *
 * Anket açılınca belirir, oylar canlı güncellenir; süre dolunca (ya da panelden
 * bitirilince) sonuç `hideAfterSec` saniye gösterilip kaybolur. Eskiden bitiş
 * olayı gelmezse "Anket bitti" kartı ekranda sonsuza dek kalıyordu.
 */
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { POLL_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';

interface PollState {
  question: string;
  options: string[];
  votes: Record<string, number>;
  endsAt: number;
  /** Panelden bitirildi / sunucu kapattı */
  bitti: boolean;
}

function oylariAyikla(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (Array.isArray(v)) v.forEach((x: any) => (out[String((x.option_index ?? 0) + 1)] = Number(x.count) || 0));
  else if (v && typeof v === 'object') Object.assign(out, v);
  return out;
}

function anketAyikla(p: any, bitti = false): PollState | null {
  if (!p) return null;
  let options: string[] = [];
  try {
    options = Array.isArray(p.options) ? p.options : JSON.parse(p.options || '[]');
  } catch {
    options = [];
  }
  if (!options.length) return null;
  const endsAt = Number(p.endsAt ?? p.ends_at) || Date.now() + (Number(p.durationSeconds) || 60) * 1000;
  return { question: String(p.question || p.title || ''), options, votes: oylariAyikla(p.votes), endsAt, bitti };
}

export function PollsWidget({ previewMode: onizlemeProp = false }: { embedded?: boolean; previewMode?: boolean } = {}) {
  const previewMode = onizlemeKipi(onizlemeProp);
  const s = useWidgetSettings('polls', POLL_DEFAULTS);
  const [poll, setPoll] = useState<PollState | null>(
    previewMode
      ? { question: 'Bugün hangi oyunu oynayalım?', options: ['Valorant', 'CS2', 'Minecraft'], votes: { 1: 12, 2: 7, 3: 4 }, endsAt: Date.now() + 45_000, bitti: false }
      : null
  );
  const [now, setNow] = useState(Date.now());
  const ayar = useRef(s);
  ayar.current = s;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    if (previewMode) return () => clearInterval(t);
    fetch('/api/polls/active')
      .then((r) => r.json())
      .then((d) => {
        const p = anketAyikla(d?.poll);
        // Süresi çoktan dolmuş eski anketi geri getirme
        if (p && p.endsAt > Date.now()) setPoll(p);
      })
      .catch(() => {});
    // Her olay ayrı işlenir (useWebSocket son mesajı birleştirebiliyordu)
    const ws = new KaliciSoket(wsAdresi());
    ws.onmessage = (e) => {
      let m: any;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      if (m?.type === 'poll_start' || m?.type === 'poll_started' || m?.type === 'poll_update') {
        const p = anketAyikla(m.poll || m.payload || m.data);
        if (p) {
          setPoll((onceki) => {
            // Test anketi birkaç saniye görünür, sonra önceki hâl (gerçek anket ya da boş) geri gelir
            if (m.test) setTimeout(() => setPoll(onceki), 8000);
            return p;
          });
        }
      } else if (m?.type === 'poll_end' || m?.type === 'poll_ended') {
        setPoll((onceki) => {
          const son = anketAyikla(m.poll, true);
          if (son) return { ...son, endsAt: Math.min(son.endsAt, Date.now()) };
          return onceki ? { ...onceki, bitti: true, endsAt: Math.min(onceki.endsAt, Date.now()) } : null;
        });
      }
    };
    return () => {
      clearInterval(t);
      ws.close();
    };
  }, [previewMode]);

  if (!poll) return null;
  const remaining = Math.max(0, Math.ceil((poll.endsAt - now) / 1000));
  const ended = poll.bitti || remaining <= 0;
  // Bitişten `hideAfterSec` sn sonra kaybolur (0 = ekranda kalır)
  const gizle = Number(s.hideAfterSec);
  if (!previewMode && ended && gizle > 0 && now - poll.endsAt > gizle * 1000) return null;
  if (s.hideUntilEnd && !ended) return null;
  const total = Object.values(poll.votes || {}).reduce((a, b) => a + b, 0) || 1;
  const enCok = Math.max(...poll.options.map((_, i) => poll.votes?.[String(i + 1)] || 0));
  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;

  return (
    <div className={`axt-anim-${s.animation}`} style={{
      fontFamily: s.fontFamily,
      background: bg,
      border: `1px solid ${s.borderColor}`,
      borderRadius: s.borderRadius,
      padding: 16,
      minWidth: 280
    }}>
      <div style={{ color: s.titleColor, fontWeight: 800, marginBottom: 12, WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined }}>
        {poll.question}
      </div>
      {poll.options.map((opt, i) => {
        const votes = poll.votes?.[String(i + 1)] || 0;
        const pct = Math.round((votes / total) * 100);
        const kazanan = ended && votes > 0 && votes === enCok;
        return (
          <div key={`${i}-${opt}`} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s.fontSize, color: s.fontColor, fontWeight: kazanan ? 800 : 400 }}>
              <span>{kazanan ? '🏆 ' : ''}{i + 1}. {opt}</span>
              <span>{s.showPercent ? `${pct}%` : ''} {s.showVotes ? `(${votes})` : ''}</span>
            </div>
            <div style={{ height: 8, background: s.barBackground, borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: s.barColor, transition: 'width .4s ease' }} />
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        {ended ? 'Anket bitti' : `${remaining} sn kaldı`} · {s.command} 1-{poll.options.length}
      </div>
    </div>
  );
}

export default PollsWidget;
