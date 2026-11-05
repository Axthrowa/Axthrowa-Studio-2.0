import { useState, useEffect } from 'react';
import { Sparkles, Bot, Save, Check, Send, User, MessageSquarePlus, Zap } from 'lucide-react';
import { KaydedilmemisUyari, useToast } from '../ui/index.js';
import { useKirliTakip } from '../hooks/useKirliTakip.js';
import { YayinOzetleri } from '../components/YayinOzetleri.js';

interface ChatRescueSettings {
  isEnabled: boolean;
  inactivityMinutes: number;
  personality: 'friendly' | 'troll' | 'wise' | 'gamer' | 'custom';
  customPrompt?: string;
  allowPolls: boolean;
  allowTrivia: boolean;
  lastRescuedAt?: number;
}

const AI_SAGLAYICILARI: Array<{ id: string; ad: string; model: string; ornek?: string; adres?: string; anahtarsiz?: boolean }> = [
  { id: 'gemini', ad: 'Google Gemini', model: '' },
  { id: 'openai', ad: 'OpenAI (ChatGPT)', model: 'gpt-4o-mini', ornek: 'sk-...', adres: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', ad: 'Anthropic Claude', model: 'claude-haiku-5-5', ornek: 'sk-ant-...', adres: 'https://console.anthropic.com/settings/keys' },
  { id: 'groq', ad: 'Groq (ücretsiz katman)', model: 'openai/gpt-oss-120b', ornek: 'gsk_...', adres: 'https://console.groq.com/keys' },
  { id: 'openrouter', ad: 'OpenRouter', model: 'openrouter/auto', ornek: 'sk-or-...', adres: 'https://openrouter.ai/keys' },
  { id: 'deepseek', ad: 'DeepSeek', model: 'deepseek-chat', ornek: 'sk-...', adres: 'https://platform.deepseek.com/api_keys' },
  { id: 'mistral', ad: 'Mistral', model: 'mistral-small-latest', adres: 'https://console.mistral.ai/api-keys' },
  { id: 'xai', ad: 'xAI Grok', model: 'grok-3-mini', ornek: 'xai-...', adres: 'https://console.x.ai' },
  { id: 'ollama', ad: 'Ollama (yerel, anahtarsız)', model: 'llama3.2', anahtarsiz: true },
  { id: 'custom', ad: 'Özel (OpenAI uyumlu adres)', model: '' }
];

export function AISettings() {
  const [apiKey, setApiKey] = useState('');
  // Gemini dışındaki sağlayıcılar (sunucu: modules/ai/saglayicilar.ts)
  const [saglayici, setSaglayici] = useState('gemini');
  const [saglayiciAnahtar, setSaglayiciAnahtar] = useState('');
  const [saglayiciModel, setSaglayiciModel] = useState('');
  const [ozelAdres, setOzelAdres] = useState('');
  const [webArama, setWebArama] = useState(false);
  const [kayitliAyarlar, setKayitliAyarlar] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState('');
  const [enabled, setEnabled] = useState(true);
  /** Sohbette "@BotAdı soru" yazılınca yapay zekâ yanıtlasın mı (varsayılan kapalı). */
  const [seslenme, setSeslenme] = useState(false);
  const [saved, setSaved] = useState(false);
  // Anahtar sunucuda maskelenerek geliyor; panel gerçek değeri hiç görmez.
  const [anahtarKayitli, setAnahtarKayitli] = useState(false);
  const [aktifModel, setAktifModel] = useState('');
  const [durum, setDurum] = useState<any>(null);
  const [durumYukleniyor, setDurumYukleniyor] = useState(false);

  // Chat Rescue State
  const [rescue, setRescue] = useState<ChatRescueSettings>({
    isEnabled: true,
    inactivityMinutes: 5,
    personality: 'friendly',
    customPrompt: '',
    allowPolls: true,
    allowTrivia: true
  });
  const [rescuing, setRescuing] = useState(false);
  const [rescueMsg, setRescueMsg] = useState('');

  // Test chat
  const [testInput, setTestInput] = useState('');
  const [chatLog, setChatLog] = useState<Array<{ role: string; text: string }>>([
    { role: 'bot', text: 'Merhaba! Ben AxBoT AI yayın asistanınım. Sohbetteki izleyicilerin sorularına senin belirlediğin kişilikle yanıt verebilirim!' }
  ]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const gemini = useKirliTakip({ apiKey, prompt, enabled, seslenme });
  const kurtarma = useKirliTakip(rescue);
  const kirli = gemini.kirli || kurtarma.kirli;
  const geminiTaban = gemini.taban;
  const kurtarmaTaban = kurtarma.taban;

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        const yuklenen = { apiKey: d.gemini_api_key || '', prompt: d.gemini_prompt || '', enabled: d.gemini_enabled !== 'false', seslenme: d.ai_mention_enabled === 'true' };
        setSeslenme(yuklenen.seslenme);
        setApiKey(yuklenen.apiKey);
        setAnahtarKayitli(Boolean(d.gemini_api_keyVar));
        setKayitliAyarlar(d || {});
        const s0 = d.ai_provider || 'gemini';
        setSaglayici(s0);
        setSaglayiciAnahtar(d[`ai_${s0}_api_key`] || '');
        setSaglayiciModel(d[`ai_${s0}_model`] || '');
        setOzelAdres(d.ai_custom_base_url || '');
        setWebArama(d.ai_web_arama === 'true');
        setPrompt(yuklenen.prompt);
        setEnabled(yuklenen.enabled);
        geminiTaban(yuklenen);
      })
      .catch(() => {});

    fetch('/api/chat-rescue/settings')
      .then(r => r.json())
      .then(d => {
        if (d && typeof d.isEnabled === 'boolean') {
          setRescue(d);
          kurtarmaTaban(d);
        }
      })
      .catch(() => {});
  }, [geminiTaban, kurtarmaTaban]);

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const [ayarYaniti, kurtarmaYaniti] = await Promise.all([
      fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini_api_key: apiKey,
          gemini_prompt: prompt,
          gemini_enabled: enabled ? 'true' : 'false',
          ai_provider: saglayici,
          ai_web_arama: webArama ? 'true' : 'false',
          ...(saglayici !== 'gemini'
            ? { [`ai_${saglayici}_api_key`]: saglayiciAnahtar, [`ai_${saglayici}_model`]: saglayiciModel }
            : {}),
          ...(saglayici === 'custom' ? { ai_custom_base_url: ozelAdres } : {}),
          ai_mention_enabled: seslenme ? 'true' : 'false'
        })
      }).catch(() => null),
      fetch('/api/chat-rescue/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rescue)
      }).catch(() => null)
    ]);
    // Eskiden yanıtlara bakılmadan "Kaydedildi" gösteriliyordu
    if (!ayarYaniti?.ok || !kurtarmaYaniti?.ok) {
      toast(!ayarYaniti?.ok ? 'Yapay zekâ ayarları kaydedilemedi.' : 'Sohbet kurtarma ayarları kaydedilemedi.', 'hata');
      if (ayarYaniti?.ok) geminiTaban({ apiKey, prompt, enabled, seslenme });
      if (kurtarmaYaniti?.ok) kurtarmaTaban(rescue);
      return;
    }
    geminiTaban({ apiKey, prompt, enabled, seslenme });
    kurtarmaTaban(rescue);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTriggerRescueNow = async () => {
    setRescuing(true);
    setRescueMsg('');
    try {
      const res = await fetch('/api/chat-rescue/trigger', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.message) {
        setRescueMsg(`✅ Chat Kurtarıldı: "${data.message}"`);
        setTimeout(() => setRescueMsg(''), 5000);
      }
    } catch {
      setRescueMsg('❌ Sohbet kurtarma tetiklenemedi.');
    } finally {
      setRescuing(false);
    }
  };

  /**
   * Asistana GERÇEKTEN sorar.
   *
   * Bu kutu daha önce sunucuya hiç gitmiyordu: `setTimeout` ile sabit bir
   * cümle gösteriyordu, bu yüzden API anahtarı doğru olsa bile "hep aynı
   * yanıtı veriyor" görünüyordu. Artık `POST /api/ai/ask` çağrılıyor.
   */
  const handleTestChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testInput.trim() || loading) return;

    const userMessage = testInput.trim();
    setTestInput('');
    setChatLog(prev => [...prev, { role: 'user', text: userMessage }, { role: 'bot', text: 'Düşünüyor...' }]);
    setLoading(true);

    const yaz = (text: string) =>
      setChatLog(prev => [...prev.filter(m => m.text !== 'Düşünüyor...'), { role: 'bot', text }]);

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userMessage, sender: 'Yayıncı' })
      });
      const d = await res.json().catch(() => null);

      if (!res.ok) {
        yaz(`⚠️ Sunucu hatası (${res.status}): ${d?.error || 'bilinmeyen'}`);
      } else {
        yaz(d?.cevap || '⚠️ Boş yanıt geldi.');
        if (d?.model) setAktifModel(d.model);
      }
    } catch (err: any) {
      yaz(`⚠️ AxBoT sunucusuna ulaşılamadı: ${String(err?.message || err)}`);
    } finally {
      setLoading(false);
    }
  };

  /** Anahtarı ve modeli sunucuya doğrulatır — üretim kotası harcamaz. */
  const durumuYenile = async () => {
    setDurumYukleniyor(true);
    try {
      const d = await fetch('/api/ai/status').then(r => r.json());
      setDurum(d);
      if (d?.model) setAktifModel(d.model);
    } catch {
      setDurum({ hazir: false, hata: 'Sunucuya ulaşılamadı' });
    } finally {
      setDurumYukleniyor(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <KaydedilmemisUyari varMi={kirli} onKaydet={() => void handleSave()} />
      <div>
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-400" />
          Yapay Zekâ & Sohbet Kurtarma
        </h1>
        <p className="text-sm text-gray-400">
          Gemini, ChatGPT, Claude ve diğer yapay zekâlarla akıllı komut yanıtları verin ve durgun geçen anlarda sohbeti otomatik canlandıracak konular açın.
        </p>
      </div>

      {/* AxBoT Chat Rescue Banner */}
      <div className="bg-gradient-to-r from-purple-950/70 via-slate-900 to-indigo-950/60 border border-purple-500/30 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-purple-500/20 text-purple-300 text-xs font-bold px-2.5 py-0.5 rounded-full border border-purple-500/30 uppercase tracking-wider">
                AxBoT Chat Rescue
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Zap className="w-3 h-3" /> Canlı İzleyici Etkileşimi
              </span>
            </div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <MessageSquarePlus className="w-6 h-6 text-purple-400" />
              Sohbet Kurtarma (Chat Rescue)
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-2xl">
              Yayın sırasında sohbette mesaj akışı durduğunda AI bot devreye girerek izleyicilere günün sorusunu, eğlenceli anketleri veya oyun tartışma konularını yönlendirir.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTriggerRescueNow}
              disabled={rescuing}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold px-5 py-2.5 rounded-xl shadow-lg shadow-purple-600/30 transition-all cursor-pointer whitespace-nowrap text-xs"
            >
              <Zap className="w-4 h-4" />
              {rescuing ? 'Konu Açılıyor...' : 'Sohbeti Canlandır (Şimdi Tetikle)'}
            </button>
          </div>
        </div>

        {rescueMsg && (
          <div className="p-3 bg-purple-950/80 border border-purple-500/50 rounded-xl text-purple-200 text-xs font-semibold">
            {rescueMsg}
          </div>
        )}

        {/* Rescue Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-purple-500/20">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Bot Kişiliği (Persona):
            </label>
            <select aria-label="Bot Kişiliği (Persona)"
              value={rescue.personality}
              onChange={e => setRescue({ ...rescue, personality: e.target.value as any })}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:border-purple-500 focus:outline-none"
            >
              <option value="friendly">😊 Samimi / Kanka (Sıcak & Esprili)</option>
              <option value="troll">😈 Troll / İğneleyici (Hafif Taş Atan)</option>
              <option value="wise">📜 Bilge / Filozof (Derin Düşünceler)</option>
              <option value="gamer">⚡ Heyecanlı / Gamer (Yüksek Enerji)</option>
              <option value="custom">✨ Özel Prompt (Aşağıda Tanımla)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs text-gray-300 mb-1.5">
              <span>Hareketsizlik Eşiği:</span>
              <span className="font-bold text-purple-400">{rescue.inactivityMinutes} dakika</span>
            </div>
            <input aria-label="Hareketsizlik eşiği"
              type="range"
              min="2"
              max="20"
              step="1"
              value={rescue.inactivityMinutes}
              onChange={e => setRescue({ ...rescue, inactivityMinutes: parseInt(e.target.value, 10) || 5 })}
              className="w-full accent-purple-500"
            />
            <span className="text-[10px] text-gray-500">Sohettte bu süre mesaj olmazsa tetiklenir</span>
          </div>

          <div className="flex items-center pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={rescue.isEnabled}
                onChange={e => setRescue({ ...rescue, isEnabled: e.target.checked })}
                className="w-4 h-4 rounded text-purple-600 focus:ring-0"
              />
              <span className="text-xs font-bold text-white">
                Otomatik Sohbet Kurtarma Aktif
              </span>
            </label>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Settings Form */}
        <form onSubmit={handleSave} className="glass-panel p-6 rounded-2xl space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="font-bold text-white text-base flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-400" />
                Yapay Zekâ Yapılandırması
              </span>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-3 cursor-pointer">
              <input type="checkbox" checked={seslenme} onChange={e => setSeslenme(e.target.checked)} className="mt-0.5 accent-purple-600" />
              <span className="text-xs text-gray-300">
                <b className="text-white">Sohbette seslenince yanıtla</b> — izleyici mesajına botun adıyla (AxBoT ya da bot hesabının adı) başlarsa (ör. <code>@AxBoT bugün ne oynuyoruz?</code>) yapay zekâ yanıt verir. Kişi başına 30 sn, genel 4 sn bekleme uygulanır.
              </span>
            </label>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">Yapay zekâ sağlayıcısı</label>
              <select aria-label="Yapay zekâ sağlayıcısı"
                value={saglayici}
                onChange={(e) => {
                  const y = e.target.value;
                  setSaglayici(y);
                  setSaglayiciAnahtar(kayitliAyarlar[`ai_${y}_api_key`] || '');
                  setSaglayiciModel(kayitliAyarlar[`ai_${y}_model`] || '');
                }}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {AI_SAGLAYICILARI.map((p) => (
                  <option key={p.id} value={p.id}>{p.ad}</option>
                ))}
              </select>
              <p className="text-[11px] text-gray-500 mt-1">Kaydedip "Bağlantıyı sına" ile anahtarı ve modelleri denetleyebilirsin. Bilgi yarışması soru üretimi yalnız Gemini ile çalışır.</p>
            </div>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/30 p-3 cursor-pointer">
              <input type="checkbox" checked={webArama} onChange={(e) => setWebArama(e.target.checked)} className="mt-0.5 accent-purple-600" />
              <span className="text-xs text-gray-300">
                <b className="text-white">Güncel bilgi: internette ara</b> — güncel haber, maç skoru, sonuç gibi sorularda yapay zekâ internette arar.
                Groq'ta gpt-oss modellerinin yerleşik internet araması, Gemini'de Google Arama kullanılır. Cevap birkaç saniye daha uzun sürer;
                ücretsiz katmanın günlük arama sınırı sağlayıcı panelinde görünür.
              </span>
            </label>

            {saglayici !== 'gemini' && (() => {
              const p = AI_SAGLAYICILARI.find((x) => x.id === saglayici)!;
              return (
                <div className="space-y-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  {saglayici === 'custom' && (
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">API adresi (OpenAI uyumlu, /v1 ile)</label>
                      <input aria-label="API adresi (OpenAI uyumlu, /v1 ile)" value={ozelAdres} onChange={(e) => setOzelAdres(e.target.value)} placeholder="http://127.0.0.1:1234/v1"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono" />
                    </div>
                  )}
                  {!p.anahtarsiz && (
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">{p.ad} API anahtarı</label>
                      <input type="password" value={saglayiciAnahtar} onChange={(e) => setSaglayiciAnahtar(e.target.value)} placeholder={p.ornek}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono" />
                      {kayitliAyarlar[`ai_${saglayici}_api_keyVar`] && (
                        <span className="mt-1 inline-block text-[10px] px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">✓ Anahtar kayıtlı (maskeli)</span>
                      )}
                      {p.adres && (
                        <p className="text-[11px] text-gray-500 mt-1">Anahtar al: <a href={p.adres} target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">{p.adres.replace('https://', '')}</a></p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">Model</label>
                    <input aria-label="Model" value={saglayiciModel} onChange={(e) => setSaglayiciModel(e.target.value)} placeholder={p.model || 'model adı'}
                      list="ai-modeller"
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono" />
                    <datalist id="ai-modeller">
                      {(durum?.modeller || []).map((m: string) => <option key={m} value={m} />)}
                    </datalist>
                    <p className="text-[11px] text-gray-500 mt-1">Boş bırakılırsa: {p.model || '—'}</p>
                  </div>
                </div>
              );
            })()}

            <div className={saglayici === 'gemini' ? '' : 'hidden'}>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Google Gemini API Anahtarı
              </label>
              <input aria-label="Google Gemini API Anahtarı"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500 font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Google AI Studio üzerinden ücretsiz API anahtarınızı alabilirsiniz: <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" className="text-purple-400 hover:underline">aistudio.google.com</a>
              </p>

              {/* Anahtar sunucuda MASKELENIR; panel gercek degeri hic gormez.
                  Kutuyu bos birakip kaydetmek kayitli anahtari SILMEZ. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {anahtarKayitli && (
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
                    ✓ Anahtar kayıtlı (güvenlik için maskeli gösterilir)
                  </span>
                )}
                <button
                  type="button"
                  onClick={durumuYenile}
                  disabled={durumYukleniyor}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 font-bold disabled:opacity-50"
                >
                  {durumYukleniyor ? 'Deneniyor…' : 'Bağlantıyı sına'}
                </button>
                {aktifModel && (
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono">
                    model: {aktifModel}
                  </span>
                )}
              </div>

              {durum && (
                <div
                  className={`mt-2 text-[11px] rounded-xl px-3 py-2 border ${
                    durum.hazir
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                      : 'bg-red-500/10 border-red-500/30 text-red-200'
                  }`}
                >
                  {durum.hazir ? (
                    <>
                      Bağlantı çalışıyor. Hesabınızda <strong>{durum.modeller?.length ?? 0}</strong> model açık,
                      kullanılan: <strong className="font-mono">{durum.model}</strong>.
                      {durum.kotasiDolan?.length > 0 && (
                        <span className="block mt-1 text-amber-300">
                          Kotası dolduğu için atlanan: {durum.kotasiDolan.join(', ')}
                        </span>
                      )}
                    </>
                  ) : (
                    <>Bağlantı kurulamadı: {durum.hata || 'bilinmeyen sebep'}</>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                Yapay Zeka Kişiliği & Talimatlar (System Prompt)
              </label>
              <textarea aria-label="Yapay Zeka Kişiliği & Talimatlar (System Prompt)"
                rows={4}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Sen neşeli, esprili ve zeki bir canlı yayın botusun..."
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Botun yanıt tarzını belirleyin (Örn: "Bir espor koçu gibi taktiksel konuş", "Aşırı esprili ve yayıncıya sadık ol").
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-end">
            <button
              type="submit"
              className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                saved ? 'bg-emerald-600 text-white' : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Kaydedildi' : 'Tüm Ayarları Kaydet'}
            </button>
          </div>
        </form>

        {/* Interactive Chat Test Simulator */}
        <div className="glass-panel p-6 rounded-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-white/10">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white text-base">Yapay Zeka Canlı Test Alanı</h2>
          </div>

          <div className="flex-1 space-y-3 max-h-80 overflow-y-auto pr-1">
            {chatLog.map((m, i) => (
              <div
                key={i}
                className={`flex items-start space-x-2.5 text-xs ${
                  m.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                {m.role === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`p-3 rounded-2xl max-w-xs ${
                    m.role === 'user'
                      ? 'bg-purple-600/30 border border-purple-500/40 text-purple-100 rounded-br-none'
                      : 'bg-black/50 border border-white/10 text-gray-200 rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'user' && (
                  <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleTestChat} className="flex items-center space-x-2 pt-3 border-t border-white/10">
            <input
              type="text"
              value={testInput}
              onChange={e => setTestInput(e.target.value)}
              placeholder="Asistana bir şey sorun..."
              className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Sor
            </button>
          </form>
        </div>
      </div>

      <YayinOzetleri />
    </div>
  );
}

export default AISettings;
