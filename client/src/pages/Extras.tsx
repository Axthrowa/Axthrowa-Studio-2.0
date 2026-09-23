/**
 * StreamAxT Extras — chat alerts, clip, levels, quotes, counters
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { Sparkles, Check } from 'lucide-react';

const DEFAULTS = {
  chat_alerts_enabled: true,
  chat_alert_follow: '{user} takip etti! Hoş geldin 💜',
  chat_alert_sub: '{user} abone oldu! ⭐',
  chat_alert_gift_sub: '{user} {count} hediye abone gönderdi!',
  chat_alert_tip: '{user} {amount} {currency} bağışladı!',
  chat_alert_raid: '{user} {viewers} kişiyle raid yaptı!',
  chat_alert_host: '{user} host etti!',
  chat_alert_kicks: '{user} {amount} Kick gönderdi!',
  clip_enabled: true,
  clip_command: '!clip',
  clip_cooldown: 30,
  clip_message: 'Klip alındı: {url}',
  levels_enabled: true,
  xp_per_message: 5,
  xp_per_minute: 2,
  announce_levelup: true,
  levelup_message: '{user} seviye {level} oldu! 🎉'
};

export function Extras() {
  const [s, setS] = useState(DEFAULTS);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [counters, setCounters] = useState<any[]>([]);
  const [newQuote, setNewQuote] = useState('');
  const [newCounter, setNewCounter] = useState('ölüm');
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'alerts' | 'clip' | 'levels' | 'quotes'>('alerts');

  useEffect(() => {
    fetch('/api/extras').then(r => r.json()).then(d => {
      setS({ ...DEFAULTS, ...(d.settings || {}) });
      setQuotes(d.quotes || []);
      setCounters(d.counters || []);
    }).catch(() => {});
  }, []);

  const save = async () => {
    await fetch('/api/extras', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Ekstralar</h1>
          <p className="text-sm text-gray-400">Chat alerts, clip command, level system, quotes & counters.</p>
        </div>
        <button onClick={save} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 ${saved ? 'bg-emerald-600' : 'bg-purple-600'} text-white`}>
          {saved ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />} Kaydet
        </button>
      </div>
      <div className="flex gap-1 bg-black/30 p-1 rounded-xl w-fit">
        {(['alerts', 'clip', 'levels', 'quotes'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === t ? 'bg-purple-600 text-white' : 'text-gray-400'}`}>
            {t === 'alerts' ? 'Chat Alerts' : t === 'clip' ? 'Clip Command' : t === 'levels' ? 'Level System' : 'Quotes & Counters'}
          </button>
        ))}
      </div>

      {tab === 'alerts' && (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <label className="flex justify-between text-xs font-bold">Chat alerts açık <input type="checkbox" checked={s.chat_alerts_enabled} onChange={e => setS({ ...s, chat_alerts_enabled: e.target.checked })} /></label>
          {(['chat_alert_follow','chat_alert_sub','chat_alert_gift_sub','chat_alert_tip','chat_alert_raid','chat_alert_host','chat_alert_kicks'] as const).map(k => (
            <label key={k} className="text-xs font-bold space-y-1">{k.replace('chat_alert_', '')}<input value={(s as any)[k]} onChange={e => setS({ ...s, [k]: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          ))}
        </div>
      )}
      {tab === 'clip' && (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <label className="flex justify-between text-xs font-bold">Clip komutu açık <input type="checkbox" checked={s.clip_enabled} onChange={e => setS({ ...s, clip_enabled: e.target.checked })} /></label>
          <label className="text-xs font-bold space-y-1">Komut<input value={s.clip_command} onChange={e => setS({ ...s, clip_command: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs font-bold space-y-1">Cooldown (sn)<input type="number" value={s.clip_cooldown} onChange={e => setS({ ...s, clip_cooldown: +e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs font-bold space-y-1">Mesaj<input value={s.clip_message} onChange={e => setS({ ...s, clip_message: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
        </div>
      )}
      {tab === 'levels' && (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <label className="flex justify-between text-xs font-bold">Level sistemi <input type="checkbox" checked={s.levels_enabled} onChange={e => setS({ ...s, levels_enabled: e.target.checked })} /></label>
          <label className="text-xs font-bold space-y-1">Mesaj başına XP<input type="number" value={s.xp_per_message} onChange={e => setS({ ...s, xp_per_message: +e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs font-bold space-y-1">Dakika başına XP<input type="number" value={s.xp_per_minute} onChange={e => setS({ ...s, xp_per_minute: +e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="flex justify-between text-xs font-bold">Level atlayınca duyur <input type="checkbox" checked={s.announce_levelup} onChange={e => setS({ ...s, announce_levelup: e.target.checked })} /></label>
          <label className="text-xs font-bold space-y-1">Level-up mesajı<input value={s.levelup_message} onChange={e => setS({ ...s, levelup_message: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
        </div>
      )}
      {tab === 'quotes' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex gap-2">
            <input value={newQuote} onChange={e => setNewQuote(e.target.value)} placeholder="Alıntı" className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2 text-sm" />
            <button onClick={async () => { await fetch('/api/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: newQuote }) }); setNewQuote(''); const d = await fetch('/api/extras').then(r => r.json()); setQuotes(d.quotes || []); }} className="px-3 py-2 bg-purple-600 rounded-xl text-xs font-bold">Ekle</button>
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto text-xs text-gray-300">
            {quotes.map((q: any) => <div key={q.id}>#{q.id} {q.text}</div>)}
          </div>
          <div className="flex gap-2 pt-3 border-t border-white/10">
            <input value={newCounter} onChange={e => setNewCounter(e.target.value)} className="flex-1 bg-black/40 border border-white/10 rounded-xl p-2 text-sm" />
            <button onClick={async () => { await fetch('/api/counters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newCounter }) }); const d = await fetch('/api/extras').then(r => r.json()); setCounters(d.counters || []); }} className="px-3 py-2 bg-emerald-600 rounded-xl text-xs font-bold">Sayaç oluştur</button>
          </div>
          <div className="text-xs text-gray-400">{counters.map((c: any) => `${c.name}: ${c.count}`).join(' · ') || 'Sayaç yok'}</div>
        </div>
      )}
    </div>
  );
}

export default Extras;
