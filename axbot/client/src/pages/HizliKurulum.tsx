/**
 * Hızlı Kurulum: yeni kullanıcı için tek akış — platform → müzik → OBS → test uyarısı → yapay zekâ.
 * Adımların durumu /api/durum-ozeti'nden canlı okunur; her adım ilgili sayfaya götürür.
 */
import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { MUZIK_ADI, useDurumOzeti } from '../lib/durumOzeti.js';
import { Panel } from '../ui/index.js';

export function HizliKurulum({ git }: { git: (sekme: string) => void }) {
  const d = useDurumOzeti();
  const [kopyalandi, setKopyalandi] = useState(false);
  const [testGitti, setTestGitti] = useState(false);
  const url = `${window.location.origin}/widgets/overlay`;

  const testGonder = async () => {
    const r = await fetch('/api/alerts/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType: 'follow' })
    }).catch(() => null);
    setTestGitti(Boolean(r?.ok));
  };

  const adimlar = [
    {
      baslik: 'Yayın platformunu bağla',
      aciklama: d?.platformlar.length ? `Bağlı: ${d.platformlar.join(', ')}` : 'Kick, Twitch, YouTube… en az birini bağla.',
      tamam: Boolean(d?.platformlar.length),
      eylem: <Dugme onClick={() => git('platforms')}>Platformlar</Dugme>
    },
    {
      baslik: 'Müziği bağla (isteğe bağlı)',
      aciklama: d?.muzik ? `${MUZIK_ADI[d.muzik]} kullanılıyor.` : "Spotify'ı AxthrowA Studio'da ya da burada bağla: !sr ve şarkı sözleri bunu kullanır.",
      tamam: Boolean(d?.muzik),
      eylem: <Dugme onClick={() => git('songrequest')}>Şarkı İsteği</Dugme>
    },
    {
      baslik: "OBS'e tek URL'yi ekle",
      aciklama: d?.obsKaynak
        ? `${d.obsKaynak} OBS kaynağı bağlı.`
        : "OBS → Kaynak ekle → Tarayıcı → bu adresi yapıştır (1920×1080). Widget'ları Overlay Stüdyo'dan aç/kapat.",
      tamam: Boolean(d?.obsKaynak),
      eylem: (
        <div className="flex flex-wrap gap-2">
          <Dugme
            onClick={() => {
              void navigator.clipboard.writeText(url);
              setKopyalandi(true);
              setTimeout(() => setKopyalandi(false), 2000);
            }}
          >
            {kopyalandi ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {kopyalandi ? 'Kopyalandı' : 'URL kopyala'}
          </Dugme>
          <Dugme onClick={() => git('overlays')}>Overlay Stüdyo</Dugme>
        </div>
      )
    },
    {
      baslik: 'Test uyarısı gönder',
      aciklama: testGitti ? "Gönderildi — OBS'te takipçi uyarısını görmelisin." : 'Sahte bir takipçi uyarısı OBS katmanında görünür (gerçek olay oluşmaz).',
      tamam: testGitti,
      eylem: <Dugme onClick={() => void testGonder()}>Test gönder</Dugme>
    },
    {
      baslik: 'Yapay zekâ asistanı (isteğe bağlı)',
      aciklama: d?.ai.hazir ? `Hazır (${d.ai.saglayici}).` : 'Gemini, ChatGPT, Claude… bir API anahtarı ekle; izleyiciler !ai ile soru sorabilir.',
      tamam: Boolean(d?.ai.hazir),
      eylem: <Dugme onClick={() => git('ai')}>Yapay Zekâ</Dugme>
    }
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-black text-white">Hızlı Kurulum</h1>
        <p className="text-sm text-gray-400">Beş adımda yayına hazır ol. Durumlar kendiliğinden güncellenir.</p>
      </div>
      <ol className="space-y-3">
        {adimlar.map((a, i) => (
          <Panel as="li" key={a.baslik} className="flex flex-col gap-3 rounded-2xl border border-white/10 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${a.tamam ? 'bg-emerald-500 text-black' : 'bg-white/10 text-gray-300'}`}
                aria-label={a.tamam ? 'tamam' : 'bekliyor'}
              >
                {a.tamam ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <div>
                <div className="text-sm font-bold text-white">{a.baslik}</div>
                <div className="text-xs text-gray-400">{a.aciklama}</div>
              </div>
            </div>
            {a.eylem}
          </Panel>
        ))}
      </ol>
    </div>
  );
}

function Dugme({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white hover:bg-purple-500"
    >
      {children}
    </button>
  );
}

export default HizliKurulum;
