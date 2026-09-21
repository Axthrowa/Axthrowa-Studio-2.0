/**
 * StreamAxT 5-Engine TTS Studio
 * Developed by AxthrowA
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { playTtsAudio } from '../lib/tts-playback.js';
import {
  Volume2,
  Play,
  Save,
  Sparkles,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Globe,
  Bot,
  Zap,
  Key
} from 'lucide-react';

interface VoiceOption {
  id: string;
  label: string;
  language: string;
  gender: string;
  engine: string;
}

interface TTSSettings {
  primaryEngine: 'edge' | 'google' | 'gemini' | 'elevenlabs' | 'webspeech';
  fallbackChain: ('edge' | 'google' | 'gemini' | 'elevenlabs' | 'webspeech')[];
  language: string;
  edgeVoice: string;
  googleLang: string;
  geminiVoice: string;
  elevenlabsApiKey?: string;
  elevenlabsVoiceId?: string;
  speed: number;
  pitch: number;
  volume: number;
  profanityFilter: boolean;
  removeUrls: boolean;
  maxLength: number;
  minPointsOrDonation?: number;
}

const ENGINE_LABELS: Record<string, { name: string; desc: string; icon: any; color: string }> = {
  edge: {
    name: 'Microsoft Edge Neural TTS',
    desc: 'Doğal, akıcı, insansı sesler (ücretsiz)',
    icon: Zap,
    color: 'from-blue-600 to-cyan-600'
  },
  google: {
    name: 'Google Translate TTS',
    desc: 'Hızlı yedek motor — dil koduna göre konuşur',
    icon: Globe,
    color: 'from-emerald-600 to-teal-600'
  },
  gemini: {
    name: 'Gemini AI Voice',
    desc: 'Duygulu yapay zeka sesi (API anahtarı gerekir)',
    icon: Bot,
    color: 'from-purple-600 to-pink-600'
  },
  elevenlabs: {
    name: 'ElevenLabs TTS',
    desc: 'Stüdyo kalitesinde özel ses (API)',
    icon: Sparkles,
    color: 'from-amber-600 to-orange-600'
  },
  webspeech: {
    name: 'Web Speech API (Tarayıcı)',
    desc: 'OBS tarayıcı kaynağında yerel seslendirme',
    icon: Volume2,
    color: 'from-gray-600 to-slate-700'
  }
};

const FALLBACK_LANGUAGES = [
  { id: 'tr-TR', google: 'tr', label: 'Türkçe' },
  { id: 'en-US', google: 'en', label: 'English (US)' },
  { id: 'en-GB', google: 'en-GB', label: 'English (UK)' },
  { id: 'de-DE', google: 'de', label: 'Deutsch' },
  { id: 'fr-FR', google: 'fr', label: 'Français' },
  { id: 'es-ES', google: 'es', label: 'Español' },
  { id: 'it-IT', google: 'it', label: 'Italiano' },
  { id: 'pt-BR', google: 'pt', label: 'Português (BR)' },
  { id: 'ja-JP', google: 'ja', label: '日本語' },
  { id: 'ko-KR', google: 'ko', label: '한국어' },
  { id: 'ru-RU', google: 'ru', label: 'Русский' },
  { id: 'ar-SA', google: 'ar', label: 'العربية' }
];

const FALLBACK_EDGE: VoiceOption[] = [
  { id: 'tr-TR-AhmetNeural', label: 'Ahmet (Türkçe · Erkek)', language: 'tr-TR', gender: 'male', engine: 'edge' },
  { id: 'tr-TR-EmelNeural', label: 'Emel (Türkçe · Kadın)', language: 'tr-TR', gender: 'female', engine: 'edge' },
  { id: 'en-US-JennyNeural', label: 'Jenny (English · Female)', language: 'en-US', gender: 'female', engine: 'edge' },
  { id: 'en-US-GuyNeural', label: 'Guy (English · Male)', language: 'en-US', gender: 'male', engine: 'edge' }
];

export default function TTSManager() {
  const [settings, setSettings] = useState<TTSSettings>({
    primaryEngine: 'edge',
    fallbackChain: ['edge', 'gemini', 'elevenlabs', 'google', 'webspeech'],
    language: 'tr-TR',
    edgeVoice: 'tr-TR-AhmetNeural',
    googleLang: 'tr',
    geminiVoice: 'Puck',
    elevenlabsApiKey: '',
    elevenlabsVoiceId: 'pNInz6obpgDQGcFmaJgB',
    speed: 1.0,
    pitch: 1.0,
    volume: 0.8,
    profanityFilter: true,
    removeUrls: true,
    maxLength: 300,
    minPointsOrDonation: 0
  });

  const [languages, setLanguages] = useState(FALLBACK_LANGUAGES);
  const [edgeVoices, setEdgeVoices] = useState<VoiceOption[]>(FALLBACK_EDGE);
  const [geminiVoices, setGeminiVoices] = useState<VoiceOption[]>([
    { id: 'Puck', label: 'Puck (Gemini · Erkek)', language: 'multi', gender: 'male', engine: 'gemini' },
    { id: 'Kore', label: 'Kore (Gemini · Kadın)', language: 'multi', gender: 'female', engine: 'gemini' },
    { id: 'Fenrir', label: 'Fenrir (Gemini · Erkek)', language: 'multi', gender: 'male', engine: 'gemini' },
    { id: 'Charon', label: 'Charon (Gemini · Erkek)', language: 'multi', gender: 'male', engine: 'gemini' },
    { id: 'Aoede', label: 'Aoede (Gemini · Kadın)', language: 'multi', gender: 'female', engine: 'gemini' }
  ]);
  const [elevenVoices, setElevenVoices] = useState<VoiceOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testText, setTestText] = useState('StreamAxT 5 motorlu kesintisiz TTS sistemi başarıyla çalışıyor!');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState('');
  const [autoSaved, setAutoSaved] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/tts/settings').then(r => r.json()).catch(() => null),
      fetch('/api/tts/voices').then(r => r.json()).catch(() => null)
    ]).then(([data, catalog]) => {
      if (catalog?.languages) setLanguages(catalog.languages);
      if (catalog?.edge) setEdgeVoices(catalog.edge);
      if (catalog?.gemini) setGeminiVoices(catalog.gemini);
      if (catalog?.elevenlabs) setElevenVoices(catalog.elevenlabs);
      if (data && data.fallbackChain) {
        setSettings(prev => ({ ...prev, ...data, language: data.language || 'tr-TR' }));
      }
      setLoading(false);
    });
  }, []);

  const voicesForLang = useMemo(
    () => edgeVoices.filter(v => v.language === settings.language),
    [edgeVoices, settings.language]
  );

  const applyLanguage = (language: string) => {
    const langMeta = languages.find(l => l.id === language);
    const currentGender = (voicesForLang.length ? voicesForLang : edgeVoices).find(v => v.id === settings.edgeVoice)?.gender;
    const langVoices = edgeVoices.filter(v => v.language === language);
    const firstVoice = langVoices.find(v => v.gender === currentGender) || langVoices[0];
    const g = firstVoice?.gender;
    setSettings(prev => ({
      ...prev,
      language,
      googleLang: langMeta?.google || language.split('-')[0].toLowerCase(),
      edgeVoice: firstVoice?.id || prev.edgeVoice,
      geminiVoice: g === 'female'
        ? (geminiVoices.find(v => v.gender === 'female')?.id || 'Kore')
        : (geminiVoices.find(v => v.gender === 'male')?.id || 'Puck'),
      elevenlabsVoiceId: g === 'male' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM'
    }));
  };

  /**
   * Ayarları sunucuya yaz. `quiet` otomatik kaydetme içindir: düğme metnini
   * ve büyük durum kutusunu oynatmaz.
   */
  const persist = useCallback(async (next: TTSSettings, quiet = false) => {
    if (!quiet) setSaving(true);
    try {
      const res = await fetch('/api/tts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next)
      });
      if (!res.ok) throw new Error('kaydedilemedi');
      const saved = await res.json();
      setAutoSaved(Date.now());
      return saved;
    } finally {
      if (!quiet) setSaving(false);
    }
  }, []);

  // Değişiklik anında etkin olsun: ayar değişince 600 ms sonra kendiliğinden
  // kaydedilir. Sunucu ayarları her seferinde veritabanından okuduğu için
  // kaydedilen değer bir sonraki okumada geçerlidir.
  const firstSettings = useRef(true);
  useEffect(() => {
    if (loading) return;
    if (firstSettings.current) {
      firstSettings.current = false;
      return;
    }
    const id = setTimeout(() => { void persist(settings, true).catch(() => {}); }, 600);
    return () => clearTimeout(id);
  }, [settings, loading, persist]);

  const handleSave = async () => {
    setSaving(true);
    setStatusMsg('');
    try {
      const res = await fetch('/api/tts/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(prev => ({ ...prev, ...saved }));
        setStatusMsg('TTS ayarları, dil ve ses seçimi kaydedildi.');
        setTimeout(() => setStatusMsg(''), 4000);
      } else {
        setStatusMsg('Ayarlar kaydedilemedi.');
      }
    } catch {
      setStatusMsg('Ayarlar kaydedilemedi.');
    } finally {
      setSaving(false);
    }
  };

  const playLocal = (item: any) => {
    playTtsAudio({
      ...item,
      volume: item.volume ?? settings.volume,
      speed: item.speed ?? settings.speed,
      pitch: item.pitch ?? settings.pitch,
      language: item.language || settings.language,
      gender: item.gender,
      voice: item.voice || settings.edgeVoice
    }).catch(() => {});
  };

  const handleTestTTS = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/tts/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testText, user: 'Yayıncı', settings })
      });
      const data = await res.json();
      if (data.success && data.item) {
        setTestResult(data.item);
        playLocal(data.item);
      } else {
        setTestResult({ engineUsed: 'error', processedText: data.error || 'Sentezlenemedi' });
      }
    } catch (err: any) {
      setTestResult({ engineUsed: 'error', processedText: err?.message || 'Test hatası' });
    } finally {
      setTesting(false);
    }
  };

  const moveEngine = (index: number, direction: 'up' | 'down') => {
    const chain = [...settings.fallbackChain];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= chain.length) return;
    const temp = chain[index];
    chain[index] = chain[targetIdx];
    chain[targetIdx] = temp;
    setSettings({ ...settings, fallbackChain: chain, primaryEngine: chain[0] });
  };

  // Widget adresi sunucunun kendi kökünden türetilir (port değişse de doğru kalır).
  const ttsWidgetUrl = `${window.location.origin}/widgets/audio-player`;

  if (loading) {
    return <div className="p-8 text-center text-gray-400">TTS motorları yükleniyor...</div>;
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      <div className="bg-gradient-to-r from-blue-900/50 via-purple-900/40 to-slate-900 border border-blue-500/30 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-blue-500/20 text-blue-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wider">
                StreamAxT Kesintisiz Mimari
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 5 Motor Aktif
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-3">
              <Volume2 className="w-8 h-8 text-blue-400" /> 5-Motorlu Fail-Safe TTS Stüdyosu
            </h1>
            <p className="text-gray-300 text-sm mt-1 max-w-2xl">
              Dil ve ses seçimi tüm motorlara uygulanır. Test, kaydetmeden önce mevcut seçiminizi kullanır.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-blue-600/30 transition-all cursor-pointer whitespace-nowrap"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
          </button>
          {autoSaved > 0 && !saving && (
            <span className="text-xs font-semibold text-emerald-300 whitespace-nowrap">
              ✓ Anında uygulandı
            </span>
          )}
        </div>
        {statusMsg && (
          <div className="mt-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-sm font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            {statusMsg}
          </div>
        )}
      </div>

      {/* Yayına ekleme: TTS sesi OBS'e bu tarayıcı kaynağıyla girer. */}
      <div className="bg-[#0d1017] border border-emerald-500/25 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-emerald-400" /> Yayına ekle (OBS)
          </h2>
          <button
            onClick={() => {
              navigator.clipboard.writeText(ttsWidgetUrl).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2500);
              }).catch(() => {});
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-[#022026] font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {copied ? 'Kopyalandı' : 'Yayına ekleme linkini kopyala'}
          </button>
        </div>
        <code className="mt-3 block rounded-xl bg-black/50 px-3 py-2 font-mono text-[12px] text-emerald-300 break-all">
          {ttsWidgetUrl}
        </code>
        <ol className="mt-3 space-y-1.5 text-sm text-gray-300 list-decimal list-inside">
          <li>OBS'te <b>Kaynaklar</b> panelinde <b>+</b> → <b>Tarayıcı</b> (Browser) ekle.</li>
          <li>Yukarıdaki adresi <b>URL</b> alanına yapıştır; genişlik <b>400</b>, yükseklik <b>100</b> yeter (ses kaynağı, görüntüsü yok).</li>
          <li><b>"Kaynak görünür değilken sesi kapat"</b> seçeneğini <b>kapalı</b> bırak, yoksa sahne değişince TTS susar.</li>
          <li><b>"Sahne etkin olduğunda yeniden yükle"</b> seçeneğini <b>işaretleme</b>; kuyruktaki okuma kesilir.</li>
          <li>OBS ses mikserinde kaynağın sesini duyabildiğinden emin ol; izleyiciye giden ses budur.</li>
        </ol>
        <div className="mt-4 border-t border-white/10 pt-3">
          <h3 className="text-sm font-bold text-white">Yayında nasıl tetiklenir?</h3>
          <ul className="mt-1.5 space-y-1 text-sm text-gray-300 list-disc list-inside">
            <li>İzleyici sohbete <code className="text-emerald-300">!tts merhaba</code> yazar; mesaj sesli okunur.</li>
            <li>Bağış/abonelik gibi olaylar <b>BynoGame &amp; Bağış</b> sekmesindeki eşiğe göre okunur.</li>
            <li>Sen elle okutmak istersen aşağıdaki <b>Canlı Ses Sentezleme Testi</b> kutusunu kullan.</li>
            <li>Spam'ı kısmak için <b>en az puan/bağış</b> eşiğini ve <b>en fazla karakter</b> sınırını ayarla.</li>
          </ul>
          <h3 className="mt-3 text-sm font-bold text-white">Ses ve karakter</h3>
          <ul className="mt-1.5 space-y-1 text-sm text-gray-300 list-disc list-inside">
            <li><b>Dil + karakter</b> (ör. Ahmet / Emel) ana sestir; Edge motorunda bu ses kullanılır.</li>
            <li>Gemini ve ElevenLabs seslerini <b>ayrı ayrı</b> seçebilirsin; seçimin artık korunur.</li>
            <li>Dil değiştirirsen o dile uygun ses kendiliğinden gelir; sonra istediğini seçebilirsin.</li>
            <li>Google motoru ses seçtirmez (kadın tonlu); erkek karakterde son çare olarak devreye girer.</li>
          </ul>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          Ayarları değiştirince kendiliğinden kaydedilir; OBS kaynağını yeniden yüklemen gerekmez.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              Yedekleme Öncelik Zinciri
            </h2>
          </div>
          <div className="space-y-3">
            {settings.fallbackChain.map((engineKey, idx) => {
              const eng = ENGINE_LABELS[engineKey] || { name: engineKey, desc: '', icon: Volume2, color: 'from-gray-700 to-gray-800' };
              const Icon = eng.icon;
              const isPrimary = idx === 0;
              return (
                <div
                  key={engineKey}
                  className={`p-4 rounded-xl border transition-all ${
                    isPrimary
                      ? 'bg-blue-950/40 border-blue-500/60 shadow-[0_0_15px_rgba(59,130,246,0.2)]'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  } flex items-center justify-between gap-3`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 text-xs font-bold flex items-center justify-center text-gray-300">
                      {idx + 1}
                    </div>
                    <div className={`p-2 rounded-lg bg-gradient-to-br ${eng.color} text-white`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{eng.name}</span>
                        {isPrimary && (
                          <span className="bg-blue-500 text-white text-[10px] font-black px-1.5 rounded uppercase">Ana Motor</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1">{eng.desc}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button onClick={() => moveEngine(idx, 'up')} disabled={idx === 0} className="p-1 rounded bg-slate-800 text-gray-400 hover:text-white disabled:opacity-30">
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => moveEngine(idx, 'down')} disabled={idx === settings.fallbackChain.length - 1} className="p-1 rounded bg-slate-800 text-gray-400 hover:text-white disabled:opacity-30">
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-blue-400" />
              Dil, Ses ve Karakter
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Konuşma Dili</label>
                <select
                  value={settings.language}
                  onChange={e => applyLanguage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                >
                  {languages.map(l => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Edge Neural Ses</label>
                <select
                  value={settings.edgeVoice}
                  onChange={e => {
                    const id = e.target.value;
                    const g = (voicesForLang.length ? voicesForLang : edgeVoices).find(v => v.id === id)?.gender;
                    const geminiPick = g === 'female'
                      ? (geminiVoices.find(v => v.gender === 'female')?.id || 'Kore')
                      : (geminiVoices.find(v => v.gender === 'male')?.id || 'Puck');
                    const elevenPick = g === 'male' ? 'pNInz6obpgDQGcFmaJgB' : '21m00Tcm4TlvDq8ikWAM';
                    setSettings({
                      ...settings,
                      edgeVoice: id,
                      geminiVoice: geminiPick,
                      elevenlabsVoiceId: elevenPick
                    });
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                >
                  {(voicesForLang.length ? voicesForLang : edgeVoices).map(v => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Google TTS Dili</label>
                <select
                  value={settings.googleLang}
                  onChange={e => setSettings({ ...settings, googleLang: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                >
                  {languages.map(l => (
                    <option key={l.google} value={l.google}>{l.label} ({l.google})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1.5">Gemini AI Sesi</label>
                <select
                  value={settings.geminiVoice}
                  onChange={e => setSettings({ ...settings, geminiVoice: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                >
                  {geminiVoices.map(v => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Key className="w-4 h-4" />
                ElevenLabs Özel Ses
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="password"
                  placeholder="ElevenLabs API Key"
                  value={settings.elevenlabsApiKey || ''}
                  onChange={e => setSettings({ ...settings, elevenlabsApiKey: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-amber-500 focus:outline-none"
                />
                <select
                  value={settings.elevenlabsVoiceId || ''}
                  onChange={e => setSettings({ ...settings, elevenlabsVoiceId: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-xs focus:border-amber-500 focus:outline-none"
                >
                  <option value="">Cinsiyete göre otomatik</option>
                  {elevenVoices.map(v => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Okuma Hızı</span>
                  <span className="font-bold text-blue-400">{settings.speed}x</span>
                </div>
                <input type="range" min="0.5" max="2.0" step="0.1" value={settings.speed} onChange={e => setSettings({ ...settings, speed: parseFloat(e.target.value) })} className="w-full accent-blue-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Ses Tonu / Perde</span>
                  <span className="font-bold text-indigo-400">{settings.pitch}x</span>
                </div>
                <input type="range" min="0.5" max="1.5" step="0.1" value={settings.pitch} onChange={e => setSettings({ ...settings, pitch: parseFloat(e.target.value) })} className="w-full accent-indigo-500" />
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                  <span>Ses Düzeyi</span>
                  <span className="font-bold text-emerald-400">%{Math.round(settings.volume * 100)}</span>
                </div>
                <input type="range" min="0.1" max="1.0" step="0.05" value={settings.volume} onChange={e => setSettings({ ...settings, volume: parseFloat(e.target.value) })} className="w-full accent-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.profanityFilter} onChange={e => setSettings({ ...settings, profanityFilter: e.target.checked })} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-xs text-gray-300">Küfür filtresi</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={settings.removeUrls} onChange={e => setSettings({ ...settings, removeUrls: e.target.checked })} className="w-4 h-4 rounded text-blue-600" />
                <span className="text-xs text-gray-300">Linkleri okuma</span>
              </label>
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl p-6 space-y-4 shadow-lg">
            <h3 className="text-md font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Canlı Ses Sentezleme Testi
              </span>
              {testResult && (
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  {ENGINE_LABELS[testResult.engineUsed]?.name || testResult.engineUsed}
                </span>
              )}
            </h3>
            <div className="flex gap-3">
              <input
                type="text"
                value={testText}
                onChange={e => setTestText(e.target.value)}
                placeholder="Seslendirmek istediğiniz test mesajını yazın..."
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={handleTestTTS}
                disabled={testing || !testText.trim()}
                className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
                {testing ? 'Sentezleniyor...' : 'Seslendir'}
              </button>
            </div>
            {testResult && (
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-gray-300 space-y-1">
                <div>Motor: {ENGINE_LABELS[testResult.engineUsed]?.name || testResult.engineUsed}</div>
                <div>Ses / karakter: {testResult.voice || settings.edgeVoice} · {testResult.gender === 'male' ? 'Erkek' : testResult.gender === 'female' ? 'Kadın' : 'Nötr'}</div>
                <div>Sonuç: "{testResult.processedText || testResult.text}"</div>
                {testResult.failedEngines?.length > 0 && (
                  <div className="text-amber-400">Yedek geçiş: {testResult.failedEngines.join(' → ')}</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
