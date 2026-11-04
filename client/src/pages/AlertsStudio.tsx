/**
 * AxBoT Alerts Studio
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { Bell, Check, Play, Save, Settings2 } from 'lucide-react';
import { Katlanir } from '../ui/index.js';
import { ALERT_ADVANCED_DEFAULTS, FONTS, uyariKaydiGovdesi, yeniUyariKaydi } from '../lib/widget-defaults.js';
import { ANIM_SECENEKLERI, animKimligi } from '../lib/animations.js';
import AlertVariants from '../components/AlertVariants.js';
import { MediaLibrary, type MedyaOgesi } from '../components/MediaLibrary.js';
import { yetenekleriGetir, olayEtiketi, type YetenekHaritasi } from '../lib/capabilities.js';

const TABS = [
  { id: 'advanced', label: 'Gelişmiş Ayarlar' },
  { id: 'follow', label: 'Takipçi' },
  { id: 'sub', label: 'Abonelik' },
  { id: 'gift_sub', label: 'Hediye Abone' },
  { id: 'host', label: 'Host' },
  { id: 'tip', label: 'Bağış' },
  { id: 'kicks', label: 'Kicks' },
  { id: 'raid', label: 'Raid' },
  // Bu turda eklendi: aynı olayın birden çok görünümü + yerel dosya kütüphanesi
  { id: 'variants', label: 'Varyantlar' },
  { id: 'media', label: 'Medya Kütüphanesi' }
];

/** Ayar sekmesi olmayan (olay preseti taşımayan) sekmeler. */
const OLAY_DISI = new Set(['advanced', 'variants', 'media']);


export function AlertsStudio() {
  const [tab, setTab] = useState('advanced');
  const [presets, setPresets] = useState<any[]>([]);
  const [advanced, setAdvanced] = useState(ALERT_ADVANCED_DEFAULTS);
  const [saved, setSaved] = useState('');
  const [kutuphane, setKutuphane] = useState<'image' | 'audio' | null>(null);
  // Hangi olayı hangi platform üretebilir? Ayar gizlenmez, ETİKETLENİR —
  // sessizce çalışmayan bir ayar, sebebini söylemekten kötüdür.
  const [yetenek, setYetenek] = useState<YetenekHaritasi>({});
  useEffect(() => { yetenekleriGetir().then(setYetenek); }, []);

  const load = () => {
    fetch('/api/alerts').then(r => r.json()).then(setPresets).catch(() => {});
    fetch('/api/widgets/alert-box/settings')
      .then(r => r.json())
      .then(d => setAdvanced({ ...ALERT_ADVANCED_DEFAULTS, ...d }))
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const current = presets.find(p => p.event_type === tab) || yeniUyariKaydi(tab);

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
      body: JSON.stringify(uyariKaydiGovdesi(tab, p))
    });
    setSaved(`${tab} alert kaydedildi`);
    load();
    setTimeout(() => setSaved(''), 2000);
  };

  const test = async () => {
    await fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: OLAY_DISI.has(tab) ? 'follow' : tab })
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Bell className="w-6 h-6 text-purple-400" /> Uyarılar (Alert Box)</h1>
          <p className="text-sm text-gray-400">Takip, abone, hediye abone, host, bağış, kicks ve raid alert ayarları.</p>
        </div>
        <button onClick={test} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5">
          <Play className="w-4 h-4" /> Test uyarısı
        </button>
      </div>

      <div className="flex flex-wrap gap-1 bg-black/30 p-1 rounded-xl">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 rounded-lg text-xs font-bold ${tab === t.id ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'variants' ? (
        <AlertVariants />
      ) : tab === 'media' ? (
        <MediaLibrary />
      ) : tab === 'advanced' ? (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <Katlanir baslik="Davranış" aciklama="Sıra, aralık ve en düşük tutarlar" acik>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold">Kuyruk <input className="ml-2" type="checkbox" checked={advanced.queueEnabled} onChange={e => setAdvanced(a => ({ ...a, queueEnabled: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold">Alert atla <input className="ml-2" type="checkbox" checked={advanced.skipEnabled} onChange={e => setAdvanced(a => ({ ...a, skipEnabled: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold">Konfeti <input className="ml-2" type="checkbox" checked={advanced.confetti} onChange={e => setAdvanced(a => ({ ...a, confetti: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Aralık (ms)<input type="number" value={advanced.gapMs} onChange={e => setAdvanced(a => ({ ...a, gapMs: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Min bağış<input type="number" value={advanced.minTipAmount} onChange={e => setAdvanced(a => ({ ...a, minTipAmount: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Min kicks<input type="number" value={advanced.minKicks} onChange={e => setAdvanced(a => ({ ...a, minKicks: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            </div>
          </Katlanir>
          <Katlanir baslik="Ses ve TTS" aciklama="Genel ses, mesajı okuma">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold">TTS <input className="ml-2" type="checkbox" checked={advanced.ttsEnabled} onChange={e => setAdvanced(a => ({ ...a, ttsEnabled: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold">Mesajı TTS ile oku <input className="ml-2" type="checkbox" checked={advanced.ttsReadMessage} onChange={e => setAdvanced(a => ({ ...a, ttsReadMessage: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Genel ses ({advanced.globalVolume})<input type="range" min={0} max={1} step={0.05} value={advanced.globalVolume} onChange={e => setAdvanced(a => ({ ...a, globalVolume: Number(e.target.value) }))} className="w-full" /></label>
            </div>
          </Katlanir>
          <Katlanir baslik="Görünüm" aciklama="Düzen, yazı tipi, animasyon">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold space-y-1">Düzen
            <select value={advanced.layoutMode} onChange={e => setAdvanced(a => ({ ...a, layoutMode: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              <option value="stacked">Üst üste</option><option value="side-by-side">Yan yana</option><option value="text-over">Yazı üstünde</option>
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Animasyon
            <select value={animKimligi(advanced.animation)} onChange={e => setAdvanced(a => ({ ...a, animation: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {ANIM_SECENEKLERI.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Yazı tipi
            <select value={advanced.fontFamily} onChange={e => setAdvanced(a => ({ ...a, fontFamily: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Çıkış animasyonu
            <select value={animKimligi(advanced.exitAnimation)} onChange={e => setAdvanced(a => ({ ...a, exitAnimation: e.target.value }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {ANIM_SECENEKLERI.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Animasyon süresi (ms)<input type="number" min={0} max={3000} step={50} value={advanced.animationDuration} onChange={e => setAdvanced(a => ({ ...a, animationDuration: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Görsel en fazla yükseklik (px)<input type="number" min={40} max={1080} value={advanced.imageMaxHeight} onChange={e => setAdvanced(a => ({ ...a, imageMaxHeight: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
            </div>
          </Katlanir>
          <Katlanir baslik="Metin katmanı" aciklama="Başlık ve mesajın rengi, konumu, zamanı">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">Metin katmanı</p>
            <p className="text-[10px] text-gray-500">Üst metin (başlık) ve alt metin (mesaj) ayrı renklenir; konum ve görünme aralığı görsel/ses ile senkron için.</p>
          <label className="text-xs text-gray-300 font-bold space-y-1">Üst metin rengi<input type="color" value={advanced.titleColor} onChange={e => setAdvanced(a => ({ ...a, titleColor: e.target.value }))} className="w-full h-9 bg-black/40 rounded-xl" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Alt metin rengi<input type="color" value={advanced.messageColor} onChange={e => setAdvanced(a => ({ ...a, messageColor: e.target.value }))} className="w-full h-9 bg-black/40 rounded-xl" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Üst metin boyutu (px)<input type="number" min={10} max={160} value={advanced.titleSize} onChange={e => setAdvanced(a => ({ ...a, titleSize: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Alt metin boyutu (px)<input type="number" min={9} max={120} value={advanced.messageSize} onChange={e => setAdvanced(a => ({ ...a, messageSize: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Metin gölgesi ({advanced.textShadow}%)<input type="range" min={0} max={100} value={advanced.textShadow} onChange={e => setAdvanced(a => ({ ...a, textShadow: Number(e.target.value) }))} className="w-full" /></label>
          <label className="text-xs text-gray-300 font-bold">Kullanıcı mesajını gizle <input className="ml-2" type="checkbox" checked={!!advanced.hideUserMessage} onChange={e => setAdvanced(a => ({ ...a, hideUserMessage: e.target.checked }))} /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Metin yatay konumu (px)<input type="number" value={advanced.textOffsetX} onChange={e => setAdvanced(a => ({ ...a, textOffsetX: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Metin dikey konumu (px)<input type="number" value={advanced.textOffsetY} onChange={e => setAdvanced(a => ({ ...a, textOffsetY: Number(e.target.value) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Metin görünsün — başlangıç (ms)<input type="number" min={0} step={100} value={advanced.textFromMs} onChange={e => setAdvanced(a => ({ ...a, textFromMs: Math.max(0, Number(e.target.value)) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Metin görünsün — bitiş (ms)<input type="number" min={0} step={100} value={advanced.textToMs} onChange={e => setAdvanced(a => ({ ...a, textToMs: Math.max(0, Number(e.target.value)) }))} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <p className="md:col-span-2 text-[10px] text-gray-500">0 – 0 = metin hep görünür. Örnek: 1500 – 4500 → uyarı başladıktan 1,5 sn sonra belirir, 4,5. saniyede kaybolur.</p>
            </div>
          </Katlanir>

          <button onClick={saveAdvanced} className="md:col-span-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 w-fit">
            <Settings2 className="w-4 h-4" /> Gelişmiş ayarları kaydet
          </button>
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <Katlanir baslik="Metin" aciklama="Uyarıda ne yazsın" acik>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold">Alert açık <input className="ml-2" type="checkbox" checked={current.is_enabled !== 0} onChange={e => updatePreset({ is_enabled: e.target.checked ? 1 : 0 })} /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Başlık şablonu<input value={current.title_template || ''} onChange={e => updatePreset({ title_template: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="md:col-span-2 text-xs text-gray-300 font-bold space-y-1">Mesaj şablonu<textarea value={current.message_template || ''} onChange={e => updatePreset({ message_template: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2 min-h-[70px]" /></label>
          {olayEtiketi(yetenek, tab) && (
            <p className="md:col-span-2 text-[11px] text-amber-300/90">
              Bu olayı üreten kaynaklar: {olayEtiketi(yetenek, tab)}
            </p>
          )}
          <p className="md:col-span-2 text-[11px] text-gray-500">Değişkenler: {'{user} {amount} {currency} {message} {months} {tier} {count} {viewers}'}</p>
            </div>
          </Katlanir>
          <Katlanir baslik="Görsel ve ses" aciklama="GIF, ses dosyası, süre">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold space-y-1">Görsel / GIF URL<input value={current.image_url || ''} onChange={e => updatePreset({ image_url: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Ses URL<input value={current.sound_url || ''} onChange={e => updatePreset({ sound_url: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          {/* Harici URL kırılgandı: site dosyayı silince uyarı sessizce bozuluyordu */}
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button onClick={() => setKutuphane(kutuphane === 'image' ? null : 'image')} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold text-gray-200">
              {kutuphane === 'image' ? 'Kütüphaneyi kapat' : 'Görseli kütüphaneden seç'}
            </button>
            <button onClick={() => setKutuphane(kutuphane === 'audio' ? null : 'audio')} className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[11px] font-bold text-gray-200">
              {kutuphane === 'audio' ? 'Kütüphaneyi kapat' : 'Sesi kütüphaneden seç'}
            </button>
          </div>
          {kutuphane && (
            <div className="md:col-span-2 pt-2 border-t border-white/10">
              <MediaLibrary
                onSec={(o: MedyaOgesi) => {
                  updatePreset(kutuphane === 'image' ? { image_url: o.url } : { sound_url: o.url });
                  setKutuphane(null);
                  setSaved(`${o.ad} seçildi — kaydetmeyi unutmayın`);
                  setTimeout(() => setSaved(''), 2500);
                }}
              />
            </div>
          )}
          <label className="text-xs text-gray-300 font-bold space-y-1">Süre (ms)<input type="number" value={current.duration_ms || 5000} onChange={e => updatePreset({ duration_ms: Number(e.target.value) })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Ses ({current.sound_volume ?? 0.7})<input type="range" min={0} max={1} step={0.05} value={current.sound_volume ?? 0.7} onChange={e => updatePreset({ sound_volume: Number(e.target.value) })} className="w-full" /></label>
            </div>
          </Katlanir>
          <Katlanir baslik="Görünüm" aciklama="Renk, yazı tipi, animasyon">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-300 font-bold space-y-1">Yazı rengi<input type="color" value={current.text_color || '#ffffff'} onChange={e => updatePreset({ text_color: e.target.value })} className="w-full h-9 bg-black/40 rounded-xl" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Vurgu rengi<input type="color" value={current.accent_color || '#8b5cf6'} onChange={e => updatePreset({ accent_color: e.target.value })} className="w-full h-9 bg-black/40 rounded-xl" /></label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Yazı tipi
            <select value={current.font_family || 'Plus Jakarta Sans'} onChange={e => updatePreset({ font_family: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {FONTS.map(f => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300 font-bold space-y-1">Animasyon
            <select value={animKimligi(current.animation || 'bounce')} onChange={e => updatePreset({ animation: e.target.value })} className="w-full bg-black/40 border border-white/10 rounded-xl p-2">
              {ANIM_SECENEKLERI.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
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
            </div>
          </Katlanir>
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
