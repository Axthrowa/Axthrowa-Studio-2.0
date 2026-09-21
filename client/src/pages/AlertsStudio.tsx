/**
 * StreamAxT Alerts Studio
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { Bell, Check, Play, Save, Settings2 } from 'lucide-react';
import { ALERT_ADVANCED_DEFAULTS, ANIMATIONS, FONTS } from '../lib/widget-defaults.js';

const TABS = [
  { id: 'advanced', label: 'Advanced Settings' },
  { id: 'follow', label: 'Followers' },
  { id: 'sub', label: 'Subscription' },
  { id: 'gift_sub', label: 'Gift Sub' },
  { id: 'host', label: 'Host' },
  { id: 'tip', label: 'Tip / Donate' },
  { id: 'kicks', label: 'Kicks' },
  { id: 'raid', label: 'Raid' }
];

const EVENT_DEFAULTS: Record<string, any> = {
  follow: { event_type: 'follow', title_template: 'YENİ TAKİPÇİ!', message_template: '{user} aileye katıldı!', accent_color: '#8b5cf6', duration_ms: 5000 },
  sub: { event_type: 'sub', title_template: 'YENİ ABONE!', message_template: '{user} {tier} ile abone oldu! ({months} ay)', accent_color: '#ec4899', duration_ms: 6500 },
  gift_sub: { event_type: 'gift_sub', title_template: 'HEDİYE ABONE!', message_template: '{user} {count} hediye abone gönderdi!', accent_color: '#f472b6', duration_ms: 6500 },
  host: { event_type: 'host', title_template: 'HOST!', message_template: '{user} kanalı host etti ({viewers})', accent_color: '#38bdf8', duration_ms: 6000 },
  tip: { event_type: 'tip', title_template: 'BAĞIŞ GELDİ!', message_template: '{user} {amount} {currency}: "{message}"', accent_color: '#10b981', duration_ms: 7000 },
  kicks: { event_type: 'kicks', title_template: 'KICKS!', message_template: '{user} {amount} Kick gönderdi!', accent_color: '#53fc18', duration_ms: 5500 },
  raid: { event_type: 'raid', title_template: 'RAID!', message_template: '{user} {viewers} izleyici ile raid yaptı!', accent_color: '#f59e0b', duration_ms: 8000 }
};

export function AlertsStudio() {
  const [tab, setTab] = useState('advanced');
  const [presets, setPresets] = useState<any[]>([]);
  const [advanced, setAdvanced] = useState(ALERT_ADVANCED_DEFAULTS);
  const [saved, setSaved] = useState('');

  const load = () => {
    fetch('/api/alerts').then(r => r.json()).then(setPresets).catch(() => {});
    fetch('/api/widgets/alert-box/settings')
      .then(r => r.json())
      .then(d => setAdvanced({ ...ALERT_ADVANCED_DEFAULTS, ...d }))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const current = presets.find(p => p.event_type === tab) || { ...EVENT_DEFAULTS[tab], sound_url: '', image_url: '', font_family: 'Plus Jakarta Sans', text_color: '#ffffff', animation: 'bounce', sound_volume: 0.7, is_enabled: 1, layout_mode: 'stacked', text_effect: 'shine' };

  const updatePreset = (patch: Record<string, any>) => {
    setPresets(prev => {
      const idx = prev.findIndex(p => p.event_type === tab);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...patch };
        return next;
      }
      return [...prev, { ...current, ...patch, event_type: tab }];
    });
  };

  const saveAdvanced = async () => {
    await fetch('/api/widgets/alert-box/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(advanced)
    });
    setSaved('Gelişmiş ayarlar kaydedildi');
    setTimeout(() => setSaved(''), 2000);
  };

  const saveEvent = async () => {
    const p = presets.find(x => x.event_type === tab) || current;
    await fetch('/api/alerts/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: p.id,
        eventType: tab,
        titleTemplate: p.title_template,
        messageTemplate: p.message_template,
        soundUrl: p.sound_url,
        imageUrl: p.image_url,
        durationMs: p.duration_ms,
        fontFamily: p.font_family,
        textColor: p.text_color,
        accentColor: p.accent_color,
        animation: p.animation,
        soundVolume: p.sound_volume,
        isEnabled: p.is_enabled,
        layoutMode: p.layout_mode,
        textEffect: p.text_effect
      })
    });
    setSaved(`${tab} alert kaydedildi`);
    load();
    setTimeout(() => setSaved(''), 2000);
  };

  const test = async () => {
    await fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: tab === 'advanced' ? 'follow' : tab })
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Bell className="w-6 h-6 text-purple-400" /> Alert Box</h1>
          <p className="text-sm text-gray-400">Takip, abone, hediye abone, host, bağış, kicks ve raid alert ayarları.</p>
        </div>
        <button onClick={test} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
          <Play className="w-4 h-4" /> Test Alert
        </button>
      </div>

      <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === t.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'advanced' ? (
        <div className="glass-panel p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold">Kuyruk <input className="ml-2" type="checkbox" checked={advanced.queueEnabled} onChange={e => setAdvanced(a => ({ ...a, queueEnabled: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold">Alert atla <input className="ml-2" type="checkbox" checked={advanced.skipEnabled} onChange={e => setAdvanced(a => ({ ...a, skipEnabled: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold">TTS <input className="ml-2" type="checkbox" checked={advanced.ttsEnabled} onChange={e => setAdvanced(a => ({ ...a, ttsEnabled: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold">Mesajı TTS ile oku <input className="ml-2" type="checkbox" checked={advanced.ttsReadMessage} onChange={e => setAdvanced(a => ({ ...a, ttsReadMessage: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold">Konfeti <input className="ml-2" type="checkbox" checked={advanced.confetti} onChange={e => setAdvanced(a => ({ ...a, confetti: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Aralık (ms)<input type="number" value={advanced.gapMs} onChange={e => setAdvanced(a => ({ ...a, gapMs: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Genel ses ({advanced.globalVolume})<input type="range" min={0} max={1} step={0.05} value={advanced.globalVolume} onChange={e => setAdvanced(a => ({ ...a, globalVolume: Number(e.target.value) }))} className="w-full" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Min bağış<input type="number" value={advanced.minTipAmount} onChange={e => setAdvanced(a => ({ ...a, minTipAmount: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Min kicks<input type="number" value={advanced.minKicks} onChange={e => setAdvanced(a => ({ ...a, minKicks: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Düzen
            <select value={advanced.layoutMode} onChange={e => setAdvanced(a => ({ ...a, layoutMode: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              <option value="stacked">Üst üste</option><option value="side-by-side">Yan yana</option><option value="text-over">Yazı üstünde</option>
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Animasyon
            <select value={advanced.animation} onChange={e => setAdvanced(a => ({ ...a, animation: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Yazı tipi
            <select value={advanced.fontFamily} onChange={e => setAdvanced(a => ({ ...a, fontFamily: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select>
          </label>
          <button onClick={saveAdvanced} className="md:col-span-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 w-fit">
            <Settings2 className="w-4 h-4" /> Gelişmiş ayarları kaydet
          </button>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold">Alert açık <input className="ml-2" type="checkbox" checked={current.is_enabled !== 0} onChange={e => updatePreset({ is_enabled: e.target.checked ? 1 : 0 })} /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Başlık şablonu<input value={current.title_template || ''} onChange={e => updatePreset({ title_template: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="md:col-span-2 text-xs text-gray-300 font-bold space-y-1">Mesaj şablonu<textarea value={current.message_template || ''} onChange={e => updatePreset({ message_template: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 min-h-[70px]" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Görsel / GIF URL<input value={current.image_url || ''} onChange={e => updatePreset({ image_url: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Ses URL<input value={current.sound_url || ''} onChange={e => updatePreset({ sound_url: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Süre (ms)<input type="number" value={current.duration_ms || 5000} onChange={e => updatePreset({ duration_ms: Number(e.target.value) })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Ses ({current.sound_volume ?? 0.7})<input type="range" min={0} max={1} step={0.05} value={current.sound_volume ?? 0.7} onChange={e => updatePreset({ sound_volume: Number(e.target.value) })} className="w-full" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Yazı rengi<input type="color" value={current.text_color || '#ffffff'} onChange={e => updatePreset({ text_color: e.target.value })} className="w-full h-9 bg-black/40 rounded-xl" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Vurgu rengi<input type="color" value={current.accent_color || '#8b5cf6'} onChange={e => updatePreset({ accent_color: e.target.value })} className="w-full h-9 bg-black/40 rounded-xl" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Yazı tipi
            <select value={current.font_family || 'Plus Jakarta Sans'} onChange={e => updatePreset({ font_family: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Animasyon
            <select value={current.animation || 'bounce'} onChange={e => updatePreset({ animation: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {ANIMATIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Düzen
            <select value={current.layout_mode || 'stacked'} onChange={e => updatePreset({ layout_mode: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              <option value="stacked">Üst üste</option><option value="side-by-side">Yan yana</option><option value="text-over">Yazı üstünde</option>
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Yazı efekti
            <select value={current.text_effect || 'shine'} onChange={e => updatePreset({ text_effect: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              <option value="none">Yok</option><option value="shine">Shine</option><option value="wiggle">Wiggle</option><option value="wave">Wave</option><option value="pulse">Pulse</option>
            </select>
          </label>
          <p className="md:col-span-2 text-[11px] text-gray-500">Değişkenler: {'{user} {amount} {currency} {message} {months} {tier} {count} {viewers}'}</p>
          <button onClick={saveEvent} className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 w-fit">
            <Save className="w-4 h-4" /> Bu sekmeyi kaydet
          </button>
        </div>
      )}
      {saved && <div className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {saved}</div>}
    </div>
  );
}

export default AlertsStudio;
