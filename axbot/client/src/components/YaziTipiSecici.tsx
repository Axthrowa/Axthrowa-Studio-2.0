/**
 * WID-5: bütün widget'lardaki yazı tipi seçici. Hazır liste + yüklenen yazı tipleri + bilgisayarda kurulu
 * herhangi bir yazı tipi (ad yazılarak ya da tarayıcı izin verirse listeden). Değer `yaziAilesi` biçiminde.
 */
import { useRef, useState } from 'react';
import { Secim } from '../ui/index.js';
import { yaziAilesi } from '../lib/widget-style.js';
import { kuruluYaziTipleri, useYuklenenYaziTipleri, yaziAdiCoz, yaziTipiCssYenile, yaziTipiYukle } from '../lib/yaziTipleri.js';

const KURULU = '__kurulu__';

export function YaziTipiSecici({ value, onChange, secenekler }: { value: string; onChange: (v: string) => void; secenekler: Array<{ value: string; label: string }> }) {
  const [yuklenenler] = useYuklenenYaziTipleri();
  const [kuruluKip, setKuruluKip] = useState(false);
  const [kurulular, setKurulular] = useState<string[]>([]);
  const [hata, setHata] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const dosyaGirdisi = useRef<HTMLInputElement>(null);

  const hazir = secenekler.some((o) => o.value === value);
  const yuklenen = yuklenenler.find((y) => yaziAilesi(y.ad) === value);
  // Listede olmayan değer (kurulu yazı tipi ya da eski ayar) kaybolmasın
  const yabanci = value && !hazir && !yuklenen ? value : '';

  const sec = (v: string) => {
    setHata('');
    if (v === KURULU) {
      setKuruluKip(true);
      void kuruluYaziTipleri().then(setKurulular);
      return;
    }
    setKuruluKip(false);
    onChange(v);
  };

  const yukle = async (dosya: File | undefined) => {
    if (!dosya) return;
    setMesgul(true);
    setHata('');
    try {
      onChange(await yaziTipiYukle(dosya, dosya.name));
    } catch (e) {
      setHata(e instanceof Error ? e.message : String(e));
    } finally {
      setMesgul(false);
      if (dosyaGirdisi.current) dosyaGirdisi.current.value = '';
    }
  };

  const sil = async () => {
    if (!yuklenen || !window.confirm(`"${yuklenen.ad}" yazı tipi silinsin mi? Kullanan widget'lar varsayılan yazı tipine döner.`)) return;
    await fetch(`/api/fonts/${yuklenen.id}`, { method: 'DELETE' }).catch(() => {});
    yaziTipiCssYenile();
  };

  return (
    <div className="space-y-1.5 w-full min-w-0">
      <div className="flex items-center gap-1.5">
        <Secim value={kuruluKip ? KURULU : value} onChange={(e) => sec(e.target.value)} className="flex-1 min-w-0 w-full" style={{ fontFamily: value || undefined }}>
          {secenekler.map((o) => (
            <option key={o.value} value={o.value} style={o.value ? { fontFamily: yaziAilesi(o.value) } : undefined}>{o.label}</option>
          ))}
          {yuklenenler.length > 0 && (
            <optgroup label="Yüklenen yazı tipleri">
              {yuklenenler.map((y) => (
                <option key={y.id} value={yaziAilesi(y.ad)} style={{ fontFamily: yaziAilesi(y.ad) }}>{y.ad}</option>
              ))}
            </optgroup>
          )}
          {yabanci && <option value={yabanci}>{yaziAdiCoz(yabanci)} (bilgisayarda)</option>}
          <option value={KURULU}>Bilgisayardaki yazı tipi…</option>
        </Secim>
        <button type="button" disabled={mesgul} onClick={() => dosyaGirdisi.current?.click()} title="TTF, OTF, WOFF ya da WOFF2 dosyası" className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white shrink-0 disabled:opacity-50">
          {mesgul ? 'Yükleniyor…' : 'Yükle'}
        </button>
        {yuklenen && (
          <button type="button" onClick={() => void sil()} aria-label={`${yuklenen.ad} yazı tipini sil`} className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-red-500/40 text-xs text-white shrink-0">Sil</button>
        )}
        <input ref={dosyaGirdisi} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => void yukle(e.target.files?.[0])} />
      </div>
      {kuruluKip && (
        <KuruluGirdi
          kurulular={kurulular}
          onSec={(ad) => {
            setKuruluKip(false);
            if (ad.trim()) onChange(yaziAilesi(ad.trim()));
          }}
        />
      )}
      {hata && <p className="text-xs text-red-300">{hata}</p>}
    </div>
  );
}

function KuruluGirdi({ kurulular, onSec }: { kurulular: string[]; onSec: (ad: string) => void }) {
  const [ad, setAd] = useState('');
  const liste = useRef(`axt-kurulu-${Math.random().toString(36).slice(2)}`).current;
  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        list={liste}
        value={ad}
        onChange={(e) => setAd(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onSec(ad))}
        placeholder={kurulular.length ? 'Listeden seçin ya da adını yazın' : 'Yazı tipinin adı (ör. Segoe UI)'}
        style={{ fontFamily: ad ? yaziAilesi(ad) : undefined }}
        className="flex-1 min-w-0 bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
      />
      <datalist id={liste}>
        {kurulular.map((k) => <option key={k} value={k} />)}
      </datalist>
      <button type="button" onClick={() => onSec(ad)} className="px-2 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs text-white shrink-0">Kullan</button>
    </div>
  );
}
