/**
 * AxBoT Polls panel
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { BarChart3, Play, Plus, Square, Trash2 } from 'lucide-react';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
import { WidgetOnizleme } from '../components/WidgetOnizleme.js';
import { Panel } from '../ui/index.js';

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

  const dolu = options.map(o => o.trim()).filter(Boolean);
  const hazir = title.trim() !== '' && dolu.length >= 2;

  const create = async () => {
    await fetch('/api/polls/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, options: dolu, durationSeconds: duration })
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
      {active ? (
        <Panel className="p-5 rounded-2xl border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black">AKTİF ANKET</span>
            <div className="text-base font-bold text-white mt-1 truncate">{active.title || active.question}</div>
            <div className="text-[11px] text-gray-400">İzleyiciler sohbetten oy verir.</div>
          </div>
          <button onClick={end} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1"><Square className="w-4 h-4" /> Anketi bitir</button>
        </Panel>
      ) : (
        <Panel className="p-5 rounded-2xl space-y-4">
          <h2 className="text-sm font-bold text-white">Yeni anket</h2>
          <label className="block text-xs font-bold text-gray-300 space-y-1">
            <span>Soru</span>
            <input aria-label="Soru" value={title} onChange={e => setTitle(e.target.value)} placeholder="Bugün hangi oyunu oynayalım?" className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
          </label>
          <div className="space-y-2">
            <span className="block text-xs font-bold text-gray-300">Seçenekler (en az 2)</span>
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input aria-label={`Seçenek ${i + 1}`} value={o} onChange={e => setOptions(opts => opts.map((x, idx) => idx === i ? e.target.value : x))} placeholder={`${i + 1}. seçenek`} className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500" />
                {options.length > 2 && (
                  <button type="button" aria-label={`${i + 1}. seçeneği sil`} onClick={() => setOptions(opts => opts.filter((_, idx) => idx !== i))} className="px-3 rounded-xl bg-white/5 hover:bg-red-500/30 text-gray-300"><Trash2 className="w-3.5 h-3.5" /></button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => setOptions(o => [...o, ''])} className="px-3 py-2 bg-white/10 hover:bg-white/15 rounded-xl text-xs font-bold text-white flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Seçenek ekle</button>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 pt-3 border-t border-white/10">
            <label className="block text-xs font-bold text-gray-300 space-y-1">
              <span>Süre (saniye)</span>
              <input aria-label="Süre (saniye)" type="number" min={5} value={duration} onChange={e => setDuration(+e.target.value)} className="w-28 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white" />
            </label>
            <button onClick={create} disabled={!hazir} title={hazir ? undefined : 'Soru ve en az 2 seçenek gerekli'} className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center gap-1"><Play className="w-4 h-4" /> Anketi başlat</button>
          </div>
        </Panel>
      )}
      <div className="space-y-2">
        <h2 className="text-sm font-bold text-white">OBS'teki görünüm</h2>
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-4 items-start">
          <WidgetSettingsForm widgetId="polls" baseUrl={baseUrl} />
          <div className="lg:sticky lg:top-0">
            <WidgetOnizleme url={`${baseUrl}/widgets/polls`} testAdi="polls" boyut={{ w: 340, h: 260 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PollsStudio;
