import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Check, Volume2, Share2, Palette } from 'lucide-react';
import { Anahtar, KayitDurumu, Panel, Secim, useToast } from '../ui/index.js';
import { useOtoKayit } from '../hooks/useOtoKayit.js';
import { PANEL_TEMALARI, panelTemasiSec, usePanelTemasi } from '../lib/panelTemalari.js';

export function Settings() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const toast = useToast();
  // Anlık kayıt: değişiklik kısa beklemeden sonra kaydedilir, Ctrl+Z geri alır
  const { taban, durum, yeniden } = useOtoKayit(settings, () => handleSave(), setSettings);

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

  const handleSave = async (e?: React.FormEvent): Promise<boolean> => {
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
      return false;
    }
    return true;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">Genel Bot Ayarları</h1>
          <p className="text-sm text-gray-400">
            Komut öneki, çapraz sohbet (cross-chat) köprüsü, sesli okuma ve ekonomi tercihlerini yapılandırın.
          </p>
        </div>

        <KayitDurumu durum={durum} onYeniden={yeniden} />
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
        {/* 1. Command Prefix & Bot Basics */}
        <Panel className="p-6 rounded-2xl space-y-4">
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
        </Panel>

        {/* 2. Cross-Chat Relay */}
        <Panel className="p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Share2 className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-white text-base">Çapraz Sohbet Aktarımı (Cross-Chat Relay)</h2>
            </div>

            <Anahtar acik={settings.cross_chat_enabled === 'true'} onChange={(v) => handleChange('cross_chat_enabled', v ? 'true' : 'false')} ad="Çapraz sohbet aktarımı" />
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
        </Panel>

        {/* 3. Text-to-Speech (TTS) Settings */}
        <Panel className="p-6 rounded-2xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <div className="flex items-center space-x-2">
              <Volume2 className="w-5 h-5 text-blue-400" />
              <h2 className="font-bold text-white text-base">Sesli Okuma (TTS) Ayarları</h2>
            </div>

            <Anahtar acik={settings.tts_enabled !== 'false'} onChange={(v) => handleChange('tts_enabled', v ? 'true' : 'false')} ad="Sesli okuma (TTS)" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Varsayılan Ses
              </label>
              <Secim aria-label="Varsayılan Ses"
                value={settings.tts_voice || 'tr-TR-AhmetNeural'}
                onChange={e => handleChange('tts_voice', e.target.value)}
 className="w-full"
              >
                <option value="tr-TR-AhmetNeural">Türkçe (Ahmet - Erkek)</option>
                <option value="tr-TR-EmelNeural">Türkçe (Emel - Kadın)</option>
                <option value="en-US-BrianNeural">English (Brian - Classic Streamer)</option>
                <option value="en-US-JennyNeural">English (Jenny)</option>
              </Secim>
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
        </Panel>
      </form>

      <PanelTemasiSecici />
    </div>
  );
}

/** Panel teması bu tarayıcıda saklanır, sunucu ayarlarıyla kaydedilmez; seçim anında uygulanır. */
function PanelTemasiSecici() {
  const secili = usePanelTemasi();
  return (
    <Panel as="section" className="p-6 rounded-2xl space-y-4" aria-labelledby="panel-temasi-baslik">
      <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
        <Palette className="w-5 h-5 text-purple-400" aria-hidden />
        <h2 id="panel-temasi-baslik" className="font-bold text-white text-base">Panel teması</h2>
      </div>
      <p className="text-[11px] text-gray-400">
        Yalnız bu paneli boyar ve bu tarayıcıda saklanır. OBS widget'ları ve stüdyo önizlemesi değişmez. Ok tuşlarıyla da seçebilirsiniz.
      </p>
      <div role="radiogroup" aria-labelledby="panel-temasi-baslik" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {PANEL_TEMALARI.map((t) => {
          const o = t.onizleme;
          return (
            <label
              key={t.id}
              className={`group block cursor-pointer rounded-xl border p-2 transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--axt-odak,#c4b5fd)] ${
                secili === t.id ? 'border-purple-400 bg-purple-500/10' : 'border-white/10 hover:border-white/25 hover:bg-white/[0.03]'
              }`}
            >
              <input
                type="radio"
                name="panel-temasi"
                value={t.id}
                checked={secili === t.id}
                onChange={() => panelTemasiSec(t.id)}
                aria-describedby={`panel-temasi-${t.id}`}
                className="sr-only"
              />
              {/* Küçük önizleme: tema renkleri satır içi, panel temasından bağımsız */}
              <span aria-hidden className="flex h-16 overflow-hidden rounded-lg border border-black/20" style={{ background: o.zemin }}>
                <span className="w-1/4 h-full border-r" style={{ borderColor: `${o.metin}14` }} />
                <span className="flex-1 p-1.5 space-y-1">
                  <span className="block h-full rounded-md p-1.5 space-y-1" style={{ background: o.yuzey }}>
                    <span className="block h-1.5 w-3/5 rounded-full" style={{ background: o.metin }} />
                    <span className="block h-1 w-4/5 rounded-full opacity-50" style={{ background: o.metin }} />
                    <span className="block h-2.5 w-2/5 rounded" style={{ background: o.vurgu }} />
                  </span>
                </span>
              </span>
              <span className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-white">{t.ad}</span>
                {secili === t.id && <Check className="w-3.5 h-3.5 text-purple-400" aria-hidden />}
              </span>
              <span id={`panel-temasi-${t.id}`} className="block text-[11px] text-gray-400 leading-snug">{t.aciklama}</span>
            </label>
          );
        })}
      </div>
    </Panel>
  );
}

export default Settings;
