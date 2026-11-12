/**
 * AxBoT Alerts Studio
 * Developed by AxthrowA
 */
import { useEffect, useState } from 'react';
import { Bell, Check, Play, Save } from 'lucide-react';
import { Alan, AlanMetni, Anahtar, Buton, Girdi, Katlanir, Secim } from '../ui/index.js';
import { FONTS, uyariKaydiGovdesi, yeniUyariKaydi } from '../lib/widget-defaults.js';
import { ANIM_SECENEKLERI, animKimligi } from '../lib/animations.js';
import { WidgetSettingsForm } from './WidgetSettingsForm.js';
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

const DUZENLER = [{ value: 'stacked', label: 'Üst üste' }, { value: 'side-by-side', label: 'Yan yana' }, { value: 'text-over', label: 'Yazı üstünde' }];
const YAZI_EFEKTLERI = [{ value: 'none', label: 'Yok' }, { value: 'shine', label: 'Parlama' }, { value: 'wiggle', label: 'Kıpırtı' }, { value: 'wave', label: 'Dalga' }, { value: 'pulse', label: 'Nabız' }];


export function AlertsStudio() {
  const [tab, setTab] = useState('advanced');
  const [presets, setPresets] = useState<any[]>([]);
  const [saved, setSaved] = useState('');
  const [kutuphane, setKutuphane] = useState<'image' | 'audio' | null>(null);
  // Hangi olayı hangi platform üretebilir? Ayar gizlenmez, ETİKETLENİR —
  // sessizce çalışmayan bir ayar, sebebini söylemekten kötüdür.
  const [yetenek, setYetenek] = useState<YetenekHaritasi>({});
  useEffect(() => { yetenekleriGetir().then(setYetenek); }, []);

  const load = () => {
    fetch('/api/alerts').then(r => r.json()).then(setPresets).catch(() => {});
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
      body: JSON.stringify({
        eventType: OLAY_DISI.has(tab) ? 'follow' : tab,
        deger: tab === 'tip' || tab === 'kicks' ? 100 : undefined
      })
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Bell className="w-6 h-6 text-purple-400" /> Uyarılar (Alert Box)</h1>
          <p className="text-sm text-gray-400">Takip, abone, hediye abone, host, bağış, kicks ve raid alert ayarları.</p>
        </div>
        <Buton ton="basari" onClick={test} ikon={<Play className="w-4 h-4" />}>Test uyarısı</Buton>
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
        <div className="glass-panel p-6 rounded-2xl">
          {/* Widget galerisindeki formun aynısı: iki ayrı form aynı ayarları farklı yazıyordu */}
          <WidgetSettingsForm widgetId="alert-box" baseUrl={window.location.origin} />
        </div>
      ) : (
        <div className="glass-panel p-6 rounded-2xl space-y-3">
          <Katlanir baslik="Metin" aciklama="Uyarıda ne yazsın" acik>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Anahtar etiket="Uyarı açık" acik={current.is_enabled !== 0} onChange={(v) => updatePreset({ is_enabled: v ? 1 : 0 })} />
          <Alan etiket="Başlık şablonu"><Girdi value={current.title_template || ''} onChange={e => updatePreset({ title_template: e.target.value })} /></Alan>
          <div className="md:col-span-2"><Alan etiket="Mesaj şablonu"><AlanMetni value={current.message_template || ''} onChange={e => updatePreset({ message_template: e.target.value })} /></Alan></div>
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
          <Alan etiket="Görsel / GIF adresi"><Girdi value={current.image_url || ''} onChange={e => updatePreset({ image_url: e.target.value })} /></Alan>
          <Alan etiket="Ses adresi"><Girdi value={current.sound_url || ''} onChange={e => updatePreset({ sound_url: e.target.value })} /></Alan>
          {/* Harici URL kırılgandı: site dosyayı silince uyarı sessizce bozuluyordu */}
          <div className="md:col-span-2 flex flex-wrap gap-2">
            <Buton ton="ikincil" onClick={() => setKutuphane(kutuphane === 'image' ? null : 'image')}>
              {kutuphane === 'image' ? 'Kütüphaneyi kapat' : 'Görseli kütüphaneden seç'}
            </Buton>
            <Buton ton="ikincil" onClick={() => setKutuphane(kutuphane === 'audio' ? null : 'audio')}>
              {kutuphane === 'audio' ? 'Kütüphaneyi kapat' : 'Sesi kütüphaneden seç'}
            </Buton>
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
          <Alan etiket="Süre (ms)"><Girdi type="number" value={current.duration_ms || 5000} onChange={e => updatePreset({ duration_ms: Number(e.target.value) })} /></Alan>
          <Alan etiket={`Ses düzeyi (%${Math.round((current.sound_volume ?? 0.7) * 100)})`}><input type="range" min={0} max={1} step={0.05} value={current.sound_volume ?? 0.7} onChange={e => updatePreset({ sound_volume: Number(e.target.value) })} className="w-full accent-[var(--axt-vurgu,#8b5cf6)]" /></Alan>
            </div>
          </Katlanir>
          <Katlanir baslik="Görünüm" aciklama="Renk, yazı tipi, animasyon">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Alan etiket="Yazı rengi"><Girdi type="color" value={current.text_color || '#ffffff'} onChange={e => updatePreset({ text_color: e.target.value })} className="h-9" /></Alan>
          <Alan etiket="Vurgu rengi"><Girdi type="color" value={current.accent_color || '#8b5cf6'} onChange={e => updatePreset({ accent_color: e.target.value })} className="h-9" /></Alan>
          <Alan etiket="Yazı tipi"><Secim value={current.font_family || 'Plus Jakarta Sans'} onChange={e => updatePreset({ font_family: e.target.value })} secenekler={FONTS.map(f => ({ value: f, label: f }))} /></Alan>
          <Alan etiket="Animasyon"><Secim value={animKimligi(current.animation || 'bounce')} onChange={e => updatePreset({ animation: e.target.value })} secenekler={ANIM_SECENEKLERI} /></Alan>
          <Alan etiket="Düzen"><Secim value={current.layout_mode || 'stacked'} onChange={e => updatePreset({ layout_mode: e.target.value })} secenekler={DUZENLER} /></Alan>
          <Alan etiket="Yazı efekti"><Secim value={current.text_effect || 'shine'} onChange={e => updatePreset({ text_effect: e.target.value })} secenekler={YAZI_EFEKTLERI} /></Alan>
            </div>
          </Katlanir>
          <Buton onClick={saveEvent} ikon={<Save className="w-4 h-4" />}>Bu sekmeyi kaydet</Buton>
        </div>
      )}
      {saved && <div className="text-xs text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {saved}</div>}
    </div>
  );
}

export default AlertsStudio;
