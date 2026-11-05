import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Check, Volume2, Share2 } from 'lucide-react';
import { KaydedilmemisUyari, useToast } from '../ui/index.js';
import { useKirliTakip } from '../hooks/useKirliTakip.js';

export function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const toast = useToast();
  const { kirli, taban } = useKirliTakip(settings);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        setSettings(d || {});
        taban(d || {});
      })
      .catch(() => {});
  }, [taban]);

  const handleChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    // Eskiden yanıta bakılmadan "Kaydedildi" gösteriliyordu (sunucu reddetse de)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    }).catch(() => null);
    if (!res?.ok) {
      const hata = res ? await res.json().catch(() => null) : null;
      toast(`Ayarlar kaydedilemedi${hata?.error ? `: ${hata.error}` : ''}`, 'hata');
      return;
    }
    taban(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <KaydedilmemisUyari varMi={kirli} onKaydet={() => void handleSave()} />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Genel Bot Ayarları</h1>
          <p className="text-sm text-gray-400">
            Komut öneki, çapraz sohbet (cross-chat) köprüsü, sesli okuma ve ekonomi tercihlerini yapılandırın.
          </p>
        </div>

        <button
          onClick={handleSave}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
            saved ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
          }`}
        >
          {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Kaydedildi' : 'Tüm Ayarları Kaydet'}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Command Prefix & Bot Basics */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
            <SettingsIcon className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white text-base">Komut Öneki & Temel Ayarlar</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Komut Öneki (Prefix)
              </label>
              <input aria-label="Komut Öneki (Prefix)"
                type="text"
                value={settings.prefix || '!'}
                onChange={e => handleChange('prefix', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">Örnek: ! veya ? veya .</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Para / Puan Birimi Adı
              </label>
              <input aria-label="Para / Puan Birimi Adı"
                type="text"
                value={settings.currency_name || 'Puan'}
                onChange={e => handleChange('currency_name', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white"
              />
            </div>
          </div>
        </div>

        {/* 2. Cross-Chat Relay */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Share2 className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-white text-base">Çapraz Sohbet Aktarımı (Cross-Chat Relay)</h2>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.cross_chat_enabled === 'true'}
                onChange={e => handleChange('cross_chat_enabled', e.target.checked ? 'true' : 'false')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <p className="text-xs text-gray-400">
            Bir platformdaki sohbet mesajını (örn: Kick) otomatik olarak diğer bağlı platformlara (Twitch, YouTube, Discord) anında aktarır.
          </p>

          <div>
            <label className="block text-xs font-bold text-gray-300 mb-1">
              Aktarım Mesaj Formatı
            </label>
            <input aria-label="Aktarım Mesaj Formatı"
              type="text"
              value={settings.cross_chat_format || '[$platform] $user: $message'}
              onChange={e => handleChange('cross_chat_format', e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-mono"
            />
            <p className="text-[11px] text-gray-500 mt-1">
              Desteklenen etiketler: <code className="text-purple-400">$platform</code>, <code className="text-purple-400">$user</code>, <code className="text-purple-400">$message</code>
            </p>
          </div>
        </div>

        {/* 3. Text-to-Speech (TTS) Settings */}
        <div className="glass-panel p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <h2 className="font-bold text-white text-base">Sesli Okuma (TTS) Ayarları</h2>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.tts_enabled !== 'false'}
                onChange={e => handleChange('tts_enabled', e.target.checked ? 'true' : 'false')}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Varsayılan Ses
              </label>
              <select aria-label="Varsayılan Ses"
                value={settings.tts_voice || 'tr-TR-AhmetNeural'}
                onChange={e => handleChange('tts_voice', e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
              >
                <option value="tr-TR-AhmetNeural">Türkçe (Ahmet - Erkek)</option>
                <option value="tr-TR-EmelNeural">Türkçe (Emel - Kadın)</option>
                <option value="en-US-BrianNeural">English (Brian - Classic Streamer)</option>
                <option value="en-US-JennyNeural">English (Jenny)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                TTS Ses Düzeyi: %{Math.round(parseFloat(settings.tts_volume || '0.8') * 100)}
              </label>
              <input aria-label="TTS ses düzeyi"
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={settings.tts_volume || '0.8'}
                onChange={e => handleChange('tts_volume', e.target.value)}
                className="w-full accent-purple-500 mt-2"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

export default Settings;
