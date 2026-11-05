/**
 * Dönen widget'ların liste düzenleyicileri (sosyal medya hesapları, sponsor medyası).
 * Developed by AxthrowA
 */
import { useState } from 'react';
import { MediaLibrary } from './MediaLibrary.js';
import { guvenliMedya, medyaTuru, ogeTuru, type SponsorOgesi } from '../lib/donenWidget.js';
import { SOSYAL_PLATFORMLAR } from '../lib/sosyalPlatformlar.js';

interface PanelProps {
  values: Record<string, any>;
  degistir: (p: Record<string, any>) => void;
}

const GIRDI = 'bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white';
const DUGME = 'px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] text-white disabled:opacity-40';

/** Dönüş sırası elle belirlenir. */
function SiraDugmeleri({ i, n, tasi, sil, ad }: { i: number; n: number; tasi: (a: number, b: number) => void; sil: (i: number) => void; ad: string }) {
  return (
    <div className="flex shrink-0 gap-1">
      <button type="button" aria-label={`${ad} yukarı taşı`} disabled={i === 0} onClick={() => tasi(i, i - 1)} className={DUGME}>↑</button>
      <button type="button" aria-label={`${ad} aşağı taşı`} disabled={i === n - 1} onClick={() => tasi(i, i + 1)} className={DUGME}>↓</button>
      <button type="button" aria-label={`${ad} sil`} onClick={() => sil(i)} className={DUGME}>×</button>
    </div>
  );
}

function tasinmis<T>(liste: T[], a: number, b: number): T[] {
  const kopya = [...liste];
  [kopya[a], kopya[b]] = [kopya[b], kopya[a]];
  return kopya;
}

export function SosyalHesapPaneli({ values, degistir }: PanelProps) {
  const hesaplar: Array<{ platform: string; kullanici: string }> = Array.isArray(values.hesaplar) ? values.hesaplar : [];
  const yaz = (yeni: typeof hesaplar) => degistir({ hesaplar: yeni });
  return (
    <div className="space-y-1.5 p-3 rounded-xl border border-white/10 bg-black/20">
      <span className="text-[11px] font-bold text-white">Sosyal medya hesapları</span>
      {!hesaplar.length && <p className="text-[11px] text-gray-300">Hesap eklenene kadar yayında bu widget görünmez.</p>}
      {hesaplar.map((h, i) => (
        <div key={i} className="space-y-1 border-b border-white/10 pb-2">
          <div className="flex items-center justify-between gap-1.5">
          <select
            aria-label="Platform"
            value={h.platform}
            onChange={(e) => yaz(hesaplar.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))}
            className={`${GIRDI} min-w-0 flex-1`}
          >
            {Object.entries(SOSYAL_PLATFORMLAR).map(([k, m]) => (
              <option key={k} value={k}>{m.label}</option>
            ))}
            <option value="diger">Diğer</option>
          </select>
          <SiraDugmeleri i={i} n={hesaplar.length} ad="Hesabı" tasi={(a, b) => yaz(tasinmis(hesaplar, a, b))} sil={(k) => yaz(hesaplar.filter((_, j) => j !== k))} />
          </div>
          <input
            aria-label="Kullanıcı adı veya adres"
            value={h.kullanici}
            placeholder="kullanıcı adı veya profil adresi"
            onChange={(e) => yaz(hesaplar.map((x, j) => (j === i ? { ...x, kullanici: e.target.value } : x)))}
            className={`${GIRDI} w-full`}
          />
        </div>
      ))}
      <button type="button" onClick={() => yaz([...hesaplar, { platform: 'kick', kullanici: '' }])} className={DUGME}>+ Hesap ekle</button>
    </div>
  );
}

export function SponsorPaneli({ values, degistir }: PanelProps) {
  const [kutuphane, setKutuphane] = useState(false);
  const ogeler: SponsorOgesi[] = Array.isArray(values.ogeler) ? values.ogeler : [];
  const yaz = (yeni: SponsorOgesi[]) => degistir({ ogeler: yeni });
  const oge = (i: number, p: Partial<SponsorOgesi>) => yaz(ogeler.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <div className="space-y-2 p-3 rounded-xl border border-white/10 bg-black/20">
      <span className="text-[11px] font-bold text-white">Sponsor görselleri, GIF ve videolar</span>
      {!ogeler.length && <p className="text-[11px] text-gray-300">Medya eklenene kadar yayında bu widget görünmez.</p>}
      {ogeler.map((o, i) => {
        const gecerli = guvenliMedya(o.url);
        return (
          <div key={i} className="space-y-1 border-b border-white/10 pb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="w-16 h-10 shrink-0 overflow-hidden rounded bg-black/60">
                {gecerli && ogeTuru(o) === 'video' && <video src={gecerli} muted className="w-full h-full object-contain" />}
                {gecerli && ogeTuru(o) === 'image' && <img src={gecerli} alt="" className="w-full h-full object-contain" />}
              </div>
              <SiraDugmeleri i={i} n={ogeler.length} ad="Medyayı" tasi={(a, b) => yaz(tasinmis(ogeler, a, b))} sil={(k) => yaz(ogeler.filter((_, j) => j !== k))} />
            </div>
              <input
                aria-label="Medya adresi"
                value={o.url}
                placeholder="https://… (.png, .gif, .webp, .mp4, .webm)"
                onChange={(e) => oge(i, { url: e.target.value.trim(), tur: medyaTuru(e.target.value) })}
                className={`${GIRDI} w-full`}
              />
              {o.url && !gecerli && <p className="text-[11px] text-amber-300">Bu adres çizilmez: http(s) ile başlayan bir dosya adresi girin.</p>}
              <input
                aria-label="Alt yazı"
                value={o.metin || ''}
                placeholder="alt yazı (isteğe bağlı), ör. indirim kodu"
                onChange={(e) => oge(i, { metin: e.target.value })}
                className={`${GIRDI} w-full`}
              />
              <label className="flex items-center gap-1.5 text-[11px] text-gray-300">
                Süre (sn)
                <input
                  title="0: görselde varsayılan süre, videoda bitene kadar"
                  type="number"
                  min={0}
                  value={o.sure ?? 0}
                  onChange={(e) => oge(i, { sure: Math.max(0, Number(e.target.value) || 0) })}
                  className={`${GIRDI} w-16`}
                />
              </label>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setKutuphane((a) => !a)} className={DUGME}>{kutuphane ? 'Kapat' : '+ Kütüphaneden seç / yükle'}</button>
        <button type="button" onClick={() => yaz([...ogeler, { url: '', sure: 0 }])} className={DUGME}>+ Adres ekle</button>
      </div>
      <p className="text-[11px] text-gray-300">Süre 0 ise görsel varsayılan süre kadar, video bitene kadar kalır. Yükleme sınırı: görsel ve GIF 5 MB, video 30 MB. YouTube gibi sayfa adresleri çalışmaz.</p>
      {kutuphane && (
        <MediaLibrary
          onSec={(m) => {
            if (m.tur === 'audio') return;
            yaz([...ogeler, { url: m.url, tur: m.tur, sure: 0 }]);
            setKutuphane(false);
          }}
        />
      )}
    </div>
  );
}
