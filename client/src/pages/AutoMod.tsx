/**
 * StreamAxT AutoMod
 * Developed by AxthrowA
 */
import { useState, useEffect } from 'react';
import { AutoModSettings } from '../types.js';
import { Shield, Check, Plus, X, Sparkles, Link, Type, Smile, Ban, Hash, User } from 'lucide-react';

type Adv = {
  caps_timeout: number; caps_exclude_subs: boolean; caps_exclude_vips: boolean; caps_warning: string; caps_action: string;
  links_timeout: number; links_permit_seconds: number; links_exclude_subs: boolean; links_warning: string; links_action: string;
  emotes_timeout: number; emotes_exclude_subs: boolean; emotes_warning: string; emotes_action: string;
  symbols_timeout: number; symbols_min_length: number; symbols_exclude_subs: boolean; symbols_warning: string; symbols_action: string;
  blacklist_timeout: number; blacklist_exclude_subs: boolean; blacklist_warning: string; blacklist_action: string;
  name_enabled: boolean; name_words: string[]; name_regex: string; name_timeout: number; name_warning: string;
};

const ADV_DEFAULT: Adv = {
  caps_timeout: 30, caps_exclude_subs: false, caps_exclude_vips: true, caps_warning: 'Lütfen CAPS kullanmayı azalt.', caps_action: 'timeout',
  links_timeout: 60, links_permit_seconds: 60, links_exclude_subs: false, links_warning: 'İzinsiz link paylaşımı yasak.', links_action: 'timeout',
  emotes_timeout: 20, emotes_exclude_subs: false, emotes_warning: 'Emote spam yapma.', emotes_action: 'delete',
  symbols_timeout: 20, symbols_min_length: 8, symbols_exclude_subs: false, symbols_warning: 'Sembol spam yasak.', symbols_action: 'delete',
  blacklist_timeout: 300, blacklist_exclude_subs: false, blacklist_warning: 'Yasaklı kelime kullanıldı.', blacklist_action: 'timeout',
  name_enabled: false, name_words: [], name_regex: '', name_timeout: 600, name_warning: 'Kullanıcı adın kurala uymuyor.'
};

const TABS = [
  { id: 'caps', label: 'Caps Protection' },
  { id: 'links', label: 'Link Protection' },
  { id: 'emotes', label: 'Emote Protection' },
  { id: 'symbols', label: 'Symbol Protection' },
  { id: 'words', label: 'Bad Words' },
  { id: 'name', label: 'Name' }
];

export function AutoMod() {
  const [settings, setSettings] = useState<AutoModSettings | null>(null);
  const [adv, setAdv] = useState<Adv>(ADV_DEFAULT);
  const [tab, setTab] = useState('caps');
  const [newWord, setNewWord] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [newNameWord, setNewNameWord] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/automod')
      .then(r => r.json())
      .then(d => {
        setSettings(d);
        setAdv({ ...ADV_DEFAULT, ...(d.advanced || {}) });
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    const res = await fetch('/api/automod', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...settings, advanced: adv })
    });
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  if (!settings) return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;

  const ActionSelect = ({ k }: { k: keyof Adv }) => (
    <label className="text-xs text-gray-300 font-bold space-y-1">
      Aksiyon
      <select value={String(adv[k])} onChange={e => setAdv(a => ({ ...a, [k]: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
        <option value="warning">Uyarı</option>
        <option value="delete">Mesajı sil</option>
        <option value="timeout">Timeout</option>
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Bot Moderation</h1>
          <p className="text-sm text-gray-400">Caps, link, emote, symbol, bad words ve isim korumasını yapılandır.</p>
        </div>
        <button onClick={handleSave} className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${saved ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'}`}>
          {saved ? <Check className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
          {saved ? 'Kaydedildi' : 'Configure kaydet'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === t.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'caps' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Type className="w-5 h-5 text-purple-400" /><h2 className="font-bold">Caps Protection Configure</h2></div>
          <label className="flex justify-between text-xs">Caps Lock filtresi <input type="checkbox" checked={settings.caps_enabled !== 0} onChange={e => setSettings({ ...settings, caps_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Asgari karakter<input type="number" value={settings.caps_min_length} onChange={e => setSettings({ ...settings, caps_min_length: +e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <label className="text-xs space-y-1">Max büyük harf % ({settings.caps_max_percent})<input type="range" min={30} max={100} value={settings.caps_max_percent} onChange={e => setSettings({ ...settings, caps_max_percent: +e.target.value })} className="w-full" /></label>
            <label className="text-xs space-y-1">Timeout (sn)<input type="number" value={adv.caps_timeout} onChange={e => setAdv(a => ({ ...a, caps_timeout: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <ActionSelect k="caps_action" />
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.caps_exclude_subs} onChange={e => setAdv(a => ({ ...a, caps_exclude_subs: e.target.checked }))} /></label>
          <label className="flex justify-between text-xs">VIP muaf <input type="checkbox" checked={adv.caps_exclude_vips} onChange={e => setAdv(a => ({ ...a, caps_exclude_vips: e.target.checked }))} /></label>
          <label className="text-xs space-y-1">Uyarı mesajı<input value={adv.caps_warning} onChange={e => setAdv(a => ({ ...a, caps_warning: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
        </div>
      )}

      {tab === 'links' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Link className="w-5 h-5 text-blue-400" /><h2 className="font-bold">Link Protection Configure</h2></div>
          <label className="flex justify-between text-xs">İzinsiz linkleri engelle <input type="checkbox" checked={settings.links_enabled !== 0} onChange={e => setSettings({ ...settings, links_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Timeout (sn)<input type="number" value={adv.links_timeout} onChange={e => setAdv(a => ({ ...a, links_timeout: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <label className="text-xs space-y-1">!permit süresi (sn)<input type="number" value={adv.links_permit_seconds} onChange={e => setAdv(a => ({ ...a, links_permit_seconds: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <ActionSelect k="links_action" />
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.links_exclude_subs} onChange={e => setAdv(a => ({ ...a, links_exclude_subs: e.target.checked }))} /></label>
          <label className="text-xs space-y-1">Uyarı mesajı<input value={adv.links_warning} onChange={e => setAdv(a => ({ ...a, links_warning: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <div className="flex gap-2">
            <input value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="twitch.tv" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs" />
            <button type="button" onClick={() => { if (newDomain.trim()) setSettings({ ...settings, links_whitelist: [...settings.links_whitelist, newDomain.trim()] }); setNewDomain(''); }} className="px-3 py-2 bg-blue-600 rounded-xl"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5">{settings.links_whitelist.map(dom => (
            <span key={dom} className="px-2 py-1 rounded-lg bg-blue-500/15 text-blue-300 text-xs flex items-center gap-1">{dom}<button onClick={() => setSettings({ ...settings, links_whitelist: settings.links_whitelist.filter(d => d !== dom) })}><X className="w-3 h-3" /></button></span>
          ))}</div>
        </div>
      )}

      {tab === 'emotes' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Smile className="w-5 h-5 text-pink-400" /><h2 className="font-bold">Emote Protection Configure</h2></div>
          <label className="flex justify-between text-xs">Emoji sınırı <input type="checkbox" checked={settings.emotes_enabled !== 0} onChange={e => setSettings({ ...settings, emotes_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Max emote<input type="number" value={settings.emotes_max} onChange={e => setSettings({ ...settings, emotes_max: +e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <label className="text-xs space-y-1">Timeout (sn)<input type="number" value={adv.emotes_timeout} onChange={e => setAdv(a => ({ ...a, emotes_timeout: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <ActionSelect k="emotes_action" />
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.emotes_exclude_subs} onChange={e => setAdv(a => ({ ...a, emotes_exclude_subs: e.target.checked }))} /></label>
          <label className="text-xs space-y-1">Uyarı mesajı<input value={adv.emotes_warning} onChange={e => setAdv(a => ({ ...a, emotes_warning: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
        </div>
      )}

      {tab === 'symbols' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Hash className="w-5 h-5 text-amber-400" /><h2 className="font-bold">Symbol Protection Configure</h2></div>
          <label className="flex justify-between text-xs">Sembol filtresi <input type="checkbox" checked={settings.symbols_enabled !== 0} onChange={e => setSettings({ ...settings, symbols_enabled: e.target.checked ? 1 : 0 })} /></label>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Max sembol % ({settings.symbols_max_percent})<input type="range" min={20} max={100} value={settings.symbols_max_percent} onChange={e => setSettings({ ...settings, symbols_max_percent: +e.target.value })} className="w-full" /></label>
            <label className="text-xs space-y-1">Min uzunluk<input type="number" value={adv.symbols_min_length} onChange={e => setAdv(a => ({ ...a, symbols_min_length: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <label className="text-xs space-y-1">Timeout (sn)<input type="number" value={adv.symbols_timeout} onChange={e => setAdv(a => ({ ...a, symbols_timeout: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <ActionSelect k="symbols_action" />
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.symbols_exclude_subs} onChange={e => setAdv(a => ({ ...a, symbols_exclude_subs: e.target.checked }))} /></label>
          <label className="text-xs space-y-1">Uyarı mesajı<input value={adv.symbols_warning} onChange={e => setAdv(a => ({ ...a, symbols_warning: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
        </div>
      )}

      {tab === 'words' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><Ban className="w-5 h-5 text-red-400" /><h2 className="font-bold">Bad Words Protection Configure</h2></div>
          <div className="grid grid-cols-2 gap-4">
            <label className="text-xs space-y-1">Timeout (sn)<input type="number" value={adv.blacklist_timeout} onChange={e => setAdv(a => ({ ...a, blacklist_timeout: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            <ActionSelect k="blacklist_action" />
          </div>
          <label className="flex justify-between text-xs">Aboneleri muaf tut <input type="checkbox" checked={adv.blacklist_exclude_subs} onChange={e => setAdv(a => ({ ...a, blacklist_exclude_subs: e.target.checked }))} /></label>
          <label className="text-xs space-y-1">Uyarı mesajı<input value={adv.blacklist_warning} onChange={e => setAdv(a => ({ ...a, blacklist_warning: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <div className="flex gap-2">
            <input value={newWord} onChange={e => setNewWord(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newWord.trim()) { setSettings({ ...settings, blacklist_words: [...settings.blacklist_words, newWord.trim()] }); setNewWord(''); } }} placeholder="yasaklı kelime" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm" />
            <button type="button" onClick={() => { if (newWord.trim()) setSettings({ ...settings, blacklist_words: [...settings.blacklist_words, newWord.trim()] }); setNewWord(''); }} className="px-4 py-2 bg-red-600 rounded-xl text-xs font-bold">Ekle</button>
          </div>
          <div className="flex flex-wrap gap-2">{settings.blacklist_words.map(word => (
            <span key={word} className="px-3 py-1.5 rounded-xl bg-red-500/15 text-red-300 text-xs font-bold flex items-center gap-2">{word}<button onClick={() => setSettings({ ...settings, blacklist_words: settings.blacklist_words.filter(w => w !== word) })}><X className="w-3.5 h-3.5" /></button></span>
          ))}</div>
        </div>
      )}

      {tab === 'name' && (
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2"><User className="w-5 h-5 text-cyan-400" /><h2 className="font-bold">Name Protection</h2></div>
          <label className="flex justify-between text-xs">Kullanıcı adı filtresi <input type="checkbox" checked={adv.name_enabled} onChange={e => setAdv(a => ({ ...a, name_enabled: e.target.checked }))} /></label>
          <label className="text-xs space-y-1">Regex<input value={adv.name_regex} onChange={e => setAdv(a => ({ ...a, name_regex: e.target.value }))} placeholder="(scam|xxx)" className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs space-y-1">Timeout (sn)<input type="number" value={adv.name_timeout} onChange={e => setAdv(a => ({ ...a, name_timeout: +e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs space-y-1">Uyarı<input value={adv.name_warning} onChange={e => setAdv(a => ({ ...a, name_warning: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <div className="flex gap-2">
            <input value={newNameWord} onChange={e => setNewNameWord(e.target.value)} placeholder="yasaklı isim parçası" className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs" />
            <button type="button" onClick={() => { if (newNameWord.trim()) setAdv(a => ({ ...a, name_words: [...a.name_words, newNameWord.trim()] })); setNewNameWord(''); }} className="px-3 py-2 bg-cyan-700 rounded-xl"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-2">{adv.name_words.map(w => (
            <span key={w} className="px-2 py-1 bg-cyan-500/15 text-cyan-300 text-xs rounded-lg flex items-center gap-1">{w}<button onClick={() => setAdv(a => ({ ...a, name_words: a.name_words.filter(x => x !== w) }))}><X className="w-3 h-3" /></button></span>
          ))}</div>
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-amber-400" /><h2 className="font-bold">Gemini AI Moderasyon</h2></div>
        <label className="flex justify-between text-xs">AI toksisite filtresi <input type="checkbox" checked={settings.ai_moderation_enabled !== 0} onChange={e => setSettings({ ...settings, ai_moderation_enabled: e.target.checked ? 1 : 0 })} /></label>
        <label className="text-xs space-y-1">Eşik ({settings.ai_toxicity_threshold})<input type="range" min={1} max={10} value={settings.ai_toxicity_threshold} onChange={e => setSettings({ ...settings, ai_toxicity_threshold: +e.target.value })} className="w-full" /></label>
      </div>
    </div>
  );
}

export default AutoMod;
