/**
 * Uyarı kutusu: her olay (takip, abone, bağış, raid…) için ayrı GIF/görsel ve ses.
 * Widget ayarları penceresinde gösterilir; kayıt Uyarılar sayfasıyla aynı (`alert_presets`).
 */
import { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { MediaLibrary, type MedyaOgesi } from './MediaLibrary.js';
import { uyariKaydiGovdesi, yeniUyariKaydi } from '../lib/widget-defaults.js';

const OLAYLAR = [
  { id: 'follow', ad: 'Takip' },
  { id: 'sub', ad: 'Abone' },
  { id: 'gift_sub', ad: 'Hediye abone' },
  { id: 'tip', ad: 'Bağış' },
  { id: 'raid', ad: 'Raid' },
  { id: 'kicks', ad: 'Kicks' },
  { id: 'host', ad: 'Host' }
];

export function UyariOlayMedyasi() {
  const [kayitlar, setKayitlar] = useState<any[]>([]);
  const [kutuphane, setKutuphane] = useState<{ olay: string; tur: 'image' | 'audio' } | null>(null);
  const [durum, setDurum] = useState('');

  const yukle = () => fetch('/api/alerts').then(r => r.json()).then(setKayitlar).catch(() => {});
  useEffect(() => { void yukle(); }, []);

  const kayit = (olay: string) => kayitlar.find(k => k.event_type === olay) || yeniUyariKaydi(olay);

  const kaydet = async (olay: string, yama: Record<string, any>) => {
    const yeni = { ...kayit(olay), ...yama };
    setKayitlar(liste => [...liste.filter(k => k.event_type !== olay), yeni]);
    const r = await fetch('/api/alerts/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(uyariKaydiGovdesi(olay, yeni))
    }).then(r => r.json()).catch(() => null);
    // Yeni kayıt sunucuda kimlik alır; sonraki kayıt aynı satırı güncellesin
    if (r?.id && !yeni.id) setKayitlar(liste => liste.map(k => (k.event_type === olay ? { ...k, id: r.id } : k)));
    setDurum(`${OLAYLAR.find(o => o.id === olay)?.ad} kaydedildi`);
    setTimeout(() => setDurum(''), 2000);
  };

  const test = (olay: string) =>
    fetch('/api/alerts/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventType: olay }) });

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black uppercase tracking-wider text-cyan-300 border-b border-white/10 pb-1">Olay başına GIF ve ses</div>
      <p className="text-[10px] text-gray-500">Boş bırakılan olayda görsel/ses çıkmaz. Yazınca kaydedilir; dosya için kütüphaneden seç (yükleme Medya Kütüphanesi'nde).</p>
      {OLAYLAR.map(o => {
        const k = kayit(o.id);
        return (
          <div key={o.id} className="rounded-lg border border-white/10 bg-black/30 p-2 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-white">{o.ad}</span>
              <button type="button" onClick={() => test(o.id)} className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                <Play className="w-3 h-3" /> Test
              </button>
            </div>
            <div className="grid grid-cols-[2.5rem_1fr_auto] gap-1.5 items-center">
              <div className="w-10 h-10 rounded bg-black/50 overflow-hidden flex items-center justify-center">
                {k.image_url ? <img src={k.image_url} alt="" className="max-w-full max-h-full object-contain" /> : <span className="text-[9px] text-gray-600">yok</span>}
              </div>
              <input
                value={k.image_url || ''}
                placeholder="GIF / görsel URL"
                onChange={e => setKayitlar(l => [...l.filter(x => x.event_type !== o.id), { ...k, image_url: e.target.value }])}
                onBlur={e => void kaydet(o.id, { image_url: e.target.value.trim() })}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
              />
              <button type="button" onClick={() => setKutuphane({ olay: o.id, tur: 'image' })} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-200">Seç</button>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-1.5 items-center">
              <input
                value={k.sound_url || ''}
                placeholder="Ses URL (mp3, ogg, wav)"
                onChange={e => setKayitlar(l => [...l.filter(x => x.event_type !== o.id), { ...k, sound_url: e.target.value }])}
                onBlur={e => void kaydet(o.id, { sound_url: e.target.value.trim() })}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
              />
              <button type="button" onClick={() => setKutuphane({ olay: o.id, tur: 'audio' })} className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-gray-200">Seç</button>
            </div>
            <label className="text-[10px] text-gray-400 flex items-center gap-2">
              Ses {Math.round((k.sound_volume ?? 0.7) * 100)}%
              <input type="range" min={0} max={1} step={0.05} value={k.sound_volume ?? 0.7}
                onChange={e => setKayitlar(l => [...l.filter(x => x.event_type !== o.id), { ...k, sound_volume: Number(e.target.value) }])}
                onPointerUp={e => void kaydet(o.id, { sound_volume: Number((e.target as HTMLInputElement).value) })}
                onKeyUp={e => void kaydet(o.id, { sound_volume: Number((e.target as HTMLInputElement).value) })}
                className="flex-1" />
            </label>
            {kutuphane?.olay === o.id && (
              <div className="pt-1 border-t border-white/10">
                <MediaLibrary
                  onSec={(m: MedyaOgesi) => {
                    void kaydet(o.id, kutuphane.tur === 'image' ? { image_url: m.url } : { sound_url: m.url });
                    setKutuphane(null);
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
      {durum && <div className="text-[11px] text-emerald-400">{durum}</div>}
    </div>
  );
}

export default UyariOlayMedyasi;
