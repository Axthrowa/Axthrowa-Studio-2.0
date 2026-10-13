/**
 * StreamAxT — Medya Kütüphanesi
 * Developed by AxthrowA
 *
 * Denetimde bulunmuştu: uyarı görseli ve sesi YALNIZ harici URL ile
 * verilebiliyordu (CURRENT_SYSTEM_AUDIT §11.6). İnternet kesilince ya da
 * kaynak site dosyayı silince uyarılar sessizce bozuluyordu.
 *
 * Artık dosya yerel diske yüklenir ve `/api/media/<id>/dosya` ile sunulur.
 * Tür doğrulaması sunucuda İÇERİK İMZASINDAN yapılır — istemcinin bildirdiği
 * MIME'a güvenilmez (`.png` diye gönderilen HTML overlay'de çalışabilirdi).
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Image as ImageIkon, Music, Trash2, Upload, Video } from 'lucide-react';
import { BosDurum, Buton, HataDurumu, Iskelet, Kart, Secim, useOnay, useToast } from '../ui/index.js';

export interface MedyaOgesi {
  id: string;
  ad: string;
  tur: 'image' | 'audio' | 'video';
  boyut: number;
  mime: string;
  olusturma: number;
  url: string;
}

const TUR_IKON = { image: ImageIkon, audio: Music, video: Video } as const;

/** 1536000 → "1,5 MB" */
export function boyutMetni(bayt: number): string {
  if (bayt < 1024) return `${bayt} B`;
  if (bayt < 1024 * 1024) return `${Math.round(bayt / 1024)} KB`;
  return `${(bayt / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

/** Dosyayı base64'e çevirir (data: öneki sunucuda soyuluyor). */
function base64Oku(d: File): Promise<string> {
  return new Promise((coz, at) => {
    const o = new FileReader();
    o.onload = () => coz(String(o.result || ''));
    o.onerror = () => at(new Error('Dosya okunamadı'));
    o.readAsDataURL(d);
  });
}

export function MediaLibrary({ onSec }: { onSec?: (oge: MedyaOgesi) => void }) {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [d, setD] = useState<any>(null);
  const [hata, setHata] = useState('');
  const [suzgec, setSuzgec] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kopyalanan, setKopyalanan] = useState('');
  const girdi = useRef<HTMLInputElement | null>(null);

  const yukle = () =>
    fetch(`/api/media${suzgec ? `?tur=${suzgec}` : ''}`)
      .then((r) => r.json())
      .then((x) => {
        setD(x);
        setHata('');
      })
      .catch(() => setHata('Medya kütüphanesi okunamadı.'));

  useEffect(() => {
    yukle();
  }, [suzgec]);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!d) return <Iskelet satir={4} />;

  const ogeler: MedyaOgesi[] = d.ogeler || [];

  const dosyaEkle = async (dosyalar: FileList | null) => {
    if (!dosyalar?.length) return;
    setYukleniyor(true);
    let basarili = 0;
    for (const dosya of Array.from(dosyalar)) {
      try {
        const veri = await base64Oku(dosya);
        const r = await fetch('/api/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ad: dosya.name, veri })
        });
        const s = await r.json();
        if (s.ok) basarili++;
        else toast(`${dosya.name}: ${s.hata}`, 'hata');
      } catch {
        toast(`${dosya.name} yüklenemedi.`, 'hata');
      }
    }
    setYukleniyor(false);
    if (basarili) toast(`${basarili} dosya yüklendi.`, 'basari');
    if (girdi.current) girdi.current.value = '';
    yukle();
  };

  const kopyala = async (oge: MedyaOgesi) => {
    try {
      await navigator.clipboard.writeText(oge.url);
      setKopyalanan(oge.id);
      setTimeout(() => setKopyalanan(''), 1500);
    } catch {
      toast('Panoya kopyalanamadı.', 'hata');
    }
  };

  const doluluk = d.maksToplam > 0 ? Math.min(100, Math.round((d.toplamBoyut / d.maksToplam) * 100)) : 0;

  return (
    <div className="space-y-3">
      {eleman}

      <Kart
        baslik="Medya kütüphanesi"
        aciklama="Yüklenen dosyalar yerel diskte durur; internet kesilse bile uyarılar çalışır."
        sag={
          <Secim
            value={suzgec}
            onChange={(e) => setSuzgec(e.target.value)}
            className="w-auto"
            secenekler={[
              { value: '', label: 'Hepsi' },
              { value: 'image', label: 'Görsel' },
              { value: 'audio', label: 'Ses' },
              { value: 'video', label: 'Video' }
            ]}
          />
        }
      >
        <input
          ref={girdi}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/gif,image/webp,audio/mpeg,audio/wav,audio/ogg,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => dosyaEkle(e.target.files)}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Buton
            ikon={<Upload className="w-3.5 h-3.5" />}
            disabled={yukleniyor}
            onClick={() => girdi.current?.click()}
          >
            {yukleniyor ? 'Yükleniyor…' : 'Dosya yükle'}
          </Buton>
          <span className="text-[11px] text-gray-500">
            PNG · JPG · GIF · WEBP · MP3 · WAV · OGG · MP4 · WEBM — dosya başına en fazla{' '}
            {boyutMetni(d.maksBoyut || 0)}
            {d.maksVideo ? ` (video ${boyutMetni(d.maksVideo)})` : ''}
          </span>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>
              Kullanılan: {boyutMetni(d.toplamBoyut || 0)} / {boyutMetni(d.maksToplam || 0)}
            </span>
            <span>%{doluluk}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full transition-all ${doluluk > 90 ? 'bg-red-500' : 'bg-emerald-500'}`}
              style={{ width: `${doluluk}%` }}
            />
          </div>
        </div>
      </Kart>

      {ogeler.length === 0 ? (
        <BosDurum
          baslik="Kütüphane boş"
          aciklama="Uyarı görselleri ve seslerini buraya yükleyin, sonra uyarı ayarlarında seçin."
        />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {ogeler.map((o) => {
            const I = TUR_IKON[o.tur] || ImageIkon;
            return (
              <div key={o.id} className="bg-black/30 border border-white/10 rounded-2xl p-2 space-y-2">
                <div className="aspect-video rounded-xl bg-black/40 overflow-hidden flex items-center justify-center">
                  {o.tur === 'image' ? (
                    <img src={o.url} alt={o.ad} className="w-full h-full object-contain" loading="lazy" />
                  ) : o.tur === 'video' ? (
                    <video src={o.url} className="w-full h-full object-contain" muted playsInline />
                  ) : (
                    <I className="w-8 h-8 text-gray-500" />
                  )}
                </div>

                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white truncate" title={o.ad}>
                    {o.ad}
                  </p>
                  <p className="text-[10px] text-gray-500">{boyutMetni(o.boyut)}</p>
                </div>

                {o.tur === 'audio' && <audio src={o.url} controls className="w-full h-7" preload="none" />}

                <div className="flex gap-1">
                  {onSec && (
                    <Buton ton="ikincil" className="flex-1 justify-center" onClick={() => onSec(o)}>
                      Kullan
                    </Buton>
                  )}
                  <Buton
                    ton="sade"
                    ikon={
                      kopyalanan === o.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )
                    }
                    title="Bağlantıyı kopyala"
                    onClick={() => kopyala(o)}
                  />
                  <Buton
                    ton="sade"
                    ikon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                    title="Sil"
                    onClick={() =>
                      sor(`"${o.ad}" silinsin mi?`, 'Bu dosyayı kullanan uyarılarda görsel/ses boş kalır.', async () => {
                        await fetch(`/api/media/${o.id}`, { method: 'DELETE' });
                        toast('Silindi.', 'basari');
                        yukle();
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MediaLibrary;
