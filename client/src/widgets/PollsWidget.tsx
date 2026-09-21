/**
 * StreamAxT Polls overlay
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { POLL_DEFAULTS } from '../lib/widget-defaults.js';

interface PollState {
  question: string;
  options: string[];
  votes: Record<string, number>;
  endsAt: number;
}

export function PollsWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('polls', POLL_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const [poll, setPoll] = useState<PollState | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    fetch('/api/polls/active').then(r => r.json()).then(d => {
      if (!d.poll) return;
      const p = d.poll;
      const opts = Array.isArray(p.options) ? p.options : JSON.parse(p.options || '[]');
      const votes: Record<string, number> = {};
      (p.votes || []).forEach((v: any) => { votes[String((v.option_index ?? 0) + 1)] = v.count; });
      setPoll({ question: p.title || p.question, options: opts, votes, endsAt: p.ends_at || Date.now() + 60000 });
    }).catch(() => {});
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'poll_start' || lastMessage.type === 'poll_started' || lastMessage.type === 'poll_update') {
      const p = lastMessage.poll || lastMessage.payload || lastMessage.data;
      if (p) {
        const opts = Array.isArray(p.options) ? p.options : [];
        const votes: Record<string, number> = {};
        if (Array.isArray(p.votes)) {
          p.votes.forEach((v: any) => { votes[String((v.option_index ?? 0) + 1)] = v.count; });
        } else if (p.votes) {
          Object.assign(votes, p.votes);
        }
        setPoll({
          question: p.question || p.title,
          options: opts,
          votes,
          endsAt: p.endsAt || Date.now() + (p.durationSeconds || 60) * 1000
        });
      }
    }
    if (lastMessage.type === 'poll_end' || lastMessage.type === 'poll_ended') setTimeout(() => setPoll(null), 8000);
  }, [lastMessage]);

  if (!poll) return null;
  const remaining = Math.max(0, Math.ceil((poll.endsAt - now) / 1000));
  const total = Object.values(poll.votes || {}).reduce((a, b) => a + b, 0) || 1;
  const ended = remaining <= 0;
  if (s.hideUntilEnd && !ended) return null;
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
        return (
          <div key={opt} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: s.fontSize, color: s.fontColor }}>
              <span>{i + 1}. {opt}</span>
              <span>{s.showPercent ? `${pct}%` : ''} {s.showVotes ? `(${votes})` : ''}</span>
            </div>
            <div style={{ height: 8, background: s.barBackground, borderRadius: 99, overflow: 'hidden', marginTop: 4 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: s.barColor }} />
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 8 }}>
        {ended ? 'Anket bitti' : `${remaining}s kaldı`} · {s.command} 1-{poll.options.length}
      </div>
    </div>
  );
}

export default PollsWidget;
