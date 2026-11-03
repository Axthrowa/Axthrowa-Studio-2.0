/**
 * StreamAxT Polls panel
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { BarChart3, Play, Square } from 'lucide-react';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
import { WidgetOnizleme } from '../components/WidgetOnizleme.js';

export function PollsStudio() {
  const [title, setTitle] = useState('');
  const [options, setOptions] = useState(['Evet', 'Hayır']);
  const [duration, setDuration] = useState(60);
  const [active, setActive] = useState<any>(null);
  const baseUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port || '5173'}`;

  const load = () => {
    fetch('/api/polls/active').then(r => r.json()).then(d => setActive(d.poll || null)).catch(() => {});
  };
  useEffect(() => { load(); const t = setInterval(load, 3000); return () => clearInterval(t); }, []);

  const create = async () => {
    await fetch('/api/polls/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, options: options.filter(Boolean), durationSeconds: duration })
    });
    load();
  };

  const end = async () => {
    await fetch('/api/polls/end', { method: 'POST' });
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><BarChart3 className="w-6 h-6 text-emerald-400" /> Anketler</h1>
        <p className="text-sm text-gray-400">Anket oluştur, sohbetten oyla, overlay’de göster.</p>
      </div>
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <label className="text-xs font-bold space-y-1">Soru<input value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
        {options.map((o, i) => (
          <label key={i} className="text-xs font-bold space-y-1">Seçenek {i + 1}
            <input value={o} onChange={e => setOptions(opts => opts.map((x, idx) => idx === i ? e.target.value : x))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" />
          </label>
        ))}
        <div className="flex gap-2">
          <button type="button" onClick={() => setOptions(o => [...o, ''])} className="px-3 py-2 bg-white/10 rounded-xl text-xs">+ Seçenek</button>
          <label className="text-xs font-bold">Süre (sn) <input type="number" value={duration} onChange={e => setDuration(+e.target.value)} className="ml-2 bg-black/40 border border-white/10 rounded-xl p-2 w-24" /></label>
        </div>
        <div className="flex gap-2">
          <button onClick={create} className="px-4 py-2 bg-emerald-600 rounded-xl text-xs font-bold flex items-center gap-1"><Play className="w-4 h-4" /> Anketi başlat</button>
          {active && <button onClick={end} className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold flex items-center gap-1"><Square className="w-4 h-4" /> Bitir</button>}
        </div>
        {active && <div className="text-xs text-emerald-300">Aktif: {active.title || active.question}</div>}
      </div>
      <div className="glass-panel p-5 rounded-2xl space-y-3">
        <h2 className="text-sm font-bold text-white">Önizleme</h2>
        <WidgetOnizleme url={`${baseUrl}/widgets/polls`} testAdi="polls" boyut={{ w: 340, h: 260 }} />
      </div>
      <WidgetSettingsForm widgetId="polls" baseUrl={baseUrl} />
    </div>
  );
}

export default PollsStudio;
