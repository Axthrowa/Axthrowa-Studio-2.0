/**
 * AxBoT — Uyarı Varyantları
 * Developed by AxthrowA
 *
 * Örnek alınan botta her olay türü için birden çok varyant tanımlanabiliyor
 * (ücretsiz 5, premium 25 — rakip incelemesi): aynı olay her
 * geldiğinde farklı görsel/ses gösterilebiliyor, ayrıca tutara göre farklı
 * varyant seçilebiliyor.
 *
 * Bizde tek sabit preset vardı — her abone aynı GIF'i görüyordu.
 *
 * Seçim kuralı (sunucu: variant-select.ts):
 *   1. Eşiği tutanlar süzülür (minDeğer ≤ olay değeri)
 *   2. En yüksek eşiği tutanlar önceliklidir — 1000 TL'lik bağış
 *      "0+" varyantına düşmez
 *   3. Aynı öncelikte birden çoksa AĞIRLIKLI rastgele seçilir
 */
import { useEffect, useState } from 'react';
import { Copy, Layers, Play, Plus, Save, Trash2 } from 'lucide-react';
import { ANIM_SECENEKLERI } from '../lib/animations.js';
import {
  Alan,
  AlanMetni,
  Anahtar,
  BosDurum,
  Buton,
  Girdi,
  HataDurumu,
  Iskelet,
  Kart,
  Secim,
  useOnay,
  useToast
} from '../ui/index.js';
import { MediaLibrary, type MedyaOgesi } from './MediaLibrary.js';
import { yetenekleriGetir, olayEtiketi, type YetenekHaritasi } from '../lib/capabilities.js';

export interface UyariVaryanti {
  id: string;
  eventType: string;
  ad: string;
  aktif: boolean;
  minDeger: number;
  agirlik: number;
  baslikSablonu: string;
  mesajSablonu: string;
  gorselUrl: string;
  sesUrl: string;
  sesSeviyesi: number;
  sureMs: number;
  animasyon: string;
  vurguRengi: string;
  metinRengi: string;
}

const OLAYLAR: Array<{ id: string; etiket: string; degerAdi: string }> = [
  { id: 'follow', etiket: 'Takip', degerAdi: '—' },
  { id: 'sub', etiket: 'Abone', degerAdi: 'ay sayısı' },
  { id: 'gift_sub', etiket: 'Hediye abone', degerAdi: 'adet' },
  { id: 'tip', etiket: 'Bağış', degerAdi: 'tutar' },
  { id: 'kicks', etiket: 'Kicks', degerAdi: 'adet' },
  { id: 'raid', etiket: 'Raid', degerAdi: 'izleyici' },
  { id: 'host', etiket: 'Host', degerAdi: 'izleyici' }
];

const YENI = (eventType: string): UyariVaryanti => ({
  id: '',
  eventType,
  ad: 'Yeni varyant',
  aktif: true,
  minDeger: 0,
  agirlik: 1,
  baslikSablonu: '',
  mesajSablonu: '',
  gorselUrl: '',
  sesUrl: '',
  sesSeviyesi: 0.7,
  sureMs: 5000,
  animasyon: 'bounce',
  vurguRengi: '#3EEDFE',
  metinRengi: '#ffffff'
});

export function AlertVariants() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [olay, setOlay] = useState('tip');
  const [liste, setListe] = useState<UyariVaryanti[] | null>(null);
  const [hata, setHata] = useState('');
  const [duzenlenen, setDuzenlenen] = useState<UyariVaryanti | null>(null);
  const [medyaAcik, setMedyaAcik] = useState<'gorsel' | 'ses' | null>(null);
  const [yetenek, setYetenek] = useState<YetenekHaritasi>({});
  const [testDegeri, setTestDegeri] = useState('');

  useEffect(() => {
    yetenekleriGetir().then(setYetenek);
  }, []);

  const yukle = () =>
    fetch(`/api/alerts/variants?eventType=${encodeURIComponent(olay)}`)
      .then((r) => r.json())
      .then((x) => {
        setListe(x);
        setHata('');
      })
      .catch(() => setHata('Varyantlar okunamadı.'));

  useEffect(() => {
    setDuzenlenen(null);
    setMedyaAcik(null);
    yukle();
  }, [olay]);

  if (hata) return <HataDurumu mesaj={hata} yenidenDene={yukle} />;
  if (!liste) return <Iskelet satir={4} />;

  const secili = OLAYLAR.find((o) => o.id === olay)!;

  const kaydet = async () => {
    if (!duzenlenen) return;
    if (!duzenlenen.ad.trim()) return toast('Varyanta bir ad verin.', 'hata');
    const r = await fetch(`/api/alerts/variants/${encodeURIComponent(olay)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(duzenlenen.id ? duzenlenen : { ...duzenlenen, id: undefined })
    });
    if (!r.ok) return toast('Kaydedilemedi.', 'hata');
    toast('Varyant kaydedildi.', 'basari');
    setDuzenlenen(null);
    yukle();
  };

  return (
    <div className="space-y-3">
      {eleman}

      <Kart
        baslik="Varyantlar"
        aciklama="Aynı olay her geldiğinde farklı görsel/ses. Eşiği yüksek varyant önceliklidir; eşit olanlar ağırlığa göre rastgele seçilir."
        sag={
          <Secim
            value={olay}
            onChange={(e) => setOlay(e.target.value)}
            className="w-auto"
            secenekler={OLAYLAR.map((o) => ({ value: o.id, label: o.etiket }))}
          />
        }
      >
        <p className="text-[11px] text-gray-500">
          Hiç varyant yoksa Alert Box sekmesindeki temel ayar kullanılır — varyant eklemek zorunlu değildir.
        </p>
        {olayEtiketi(yetenek, olay) && (
          <p className="text-[11px] text-amber-300/90">
            Bu olayı üreten kaynaklar: {olayEtiketi(yetenek, olay)}
          </p>
        )}

        {liste.length === 0 ? (
          <BosDurum
            baslik={`${secili.etiket} için varyant yok`}
            aciklama="Temel uyarı kullanılıyor."
            eylem={
              <Buton ikon={<Plus className="w-3.5 h-3.5" />} onClick={() => setDuzenlenen(YENI(olay))}>
                İlk varyantı ekle
              </Buton>
            }
          />
        ) : (
          <div className="space-y-1">
            {liste.map((v) => (
              <div key={v.id} className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: v.aktif ? v.vurguRengi : '#555' }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{v.ad}</p>
                  <p className="text-[10px] text-gray-500">
                    {secili.degerAdi === '—' ? 'eşiksiz' : `${secili.degerAdi} ≥ ${v.minDeger}`} · ağırlık {v.agirlik}
                    {!v.aktif && ' · KAPALI'}
                  </p>
                </div>
                <div className="ml-auto flex gap-1">
                  <Buton ton="sade" onClick={() => setDuzenlenen({ ...v })}>
                    Düzenle
                  </Buton>
                  <Buton
                    ton="sade"
                    ikon={<Copy className="w-3.5 h-3.5" />}
                    title="Kopyala"
                    onClick={() => setDuzenlenen({ ...v, id: '', ad: `${v.ad} (kopya)` })}
                  />
                  <Buton
                    ton="sade"
                    ikon={<Trash2 className="w-3.5 h-3.5 text-red-400" />}
                    title="Sil"
                    onClick={() =>
                      sor(`"${v.ad}" silinsin mi?`, 'Bu varyant bir daha seçilmez.', async () => {
                        await fetch(`/api/alerts/variants/${v.id}`, { method: 'DELETE' });
                        toast('Silindi.', 'basari');
                        yukle();
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {liste.length > 0 && (
          <Buton ton="ikincil" ikon={<Plus className="w-3.5 h-3.5" />} onClick={() => setDuzenlenen(YENI(olay))}>
            Varyant ekle
          </Buton>
        )}
      </Kart>

      {duzenlenen && (
        <Kart
          baslik={duzenlenen.id ? `Düzenle: ${duzenlenen.ad}` : 'Yeni varyant'}
          sag={
            <Anahtar
              acik={duzenlenen.aktif}
              etiket={duzenlenen.aktif ? 'Açık' : 'Kapalı'}
              onChange={(v) => setDuzenlenen({ ...duzenlenen, aktif: v })}
            />
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Alan etiket="Varyant adı" ipucu="Yalnız panelde görünür">
              <Girdi value={duzenlenen.ad} onChange={(e) => setDuzenlenen({ ...duzenlenen, ad: e.target.value })} />
            </Alan>

            <Alan
              etiket={`Alt eşik (${secili.degerAdi})`}
              ipucu={
                secili.degerAdi === '—'
                  ? 'Bu olayda sayısal değer yok; 0 bırakın'
                  : 'Bu değerin altındaki olaylar bu varyantı almaz'
              }
            >
              <Girdi
                type="number"
                min={0}
                value={duzenlenen.minDeger}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, minDeger: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Alan>

            <Alan etiket="Ağırlık" ipucu="Aynı eşikteki varyantlar arasında seçilme şansı">
              <Girdi
                type="number"
                min={0}
                step={0.5}
                value={duzenlenen.agirlik}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, agirlik: Math.max(0, Number(e.target.value) || 0) })}
              />
            </Alan>

            <Alan etiket="Süre (ms)">
              <Girdi
                type="number"
                min={500}
                value={duzenlenen.sureMs}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, sureMs: Math.max(500, Number(e.target.value) || 500) })}
              />
            </Alan>

            <Alan etiket="Başlık şablonu" ipucu="Boş bırakılırsa temel uyarının başlığı kullanılır">
              <Girdi
                value={duzenlenen.baslikSablonu}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, baslikSablonu: e.target.value })}
                placeholder="BÜYÜK BAĞIŞ!"
              />
            </Alan>

            <Alan etiket="Animasyon">
              <Secim
                value={duzenlenen.animasyon}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, animasyon: e.target.value })}
                secenekler={ANIM_SECENEKLERI}
              />
            </Alan>

            <div className="md:col-span-2">
              <Alan etiket="Mesaj şablonu" ipucu="{user} {amount} {currency} {message} {months} {tier} {count} {viewers}">
                <AlanMetni
                  value={duzenlenen.mesajSablonu}
                  onChange={(e) => setDuzenlenen({ ...duzenlenen, mesajSablonu: e.target.value })}
                />
              </Alan>
            </div>

            <Alan etiket="Görsel / GIF" ipucu="Harici URL veya kütüphaneden seçin">
              <div className="flex gap-2">
                <Girdi
                  value={duzenlenen.gorselUrl}
                  onChange={(e) => setDuzenlenen({ ...duzenlenen, gorselUrl: e.target.value })}
                  placeholder="https://… veya /api/media/…"
                />
                <Buton ton="ikincil" onClick={() => setMedyaAcik(medyaAcik === 'gorsel' ? null : 'gorsel')}>
                  Kütüphane
                </Buton>
              </div>
            </Alan>

            <Alan etiket="Ses">
              <div className="flex gap-2">
                <Girdi
                  value={duzenlenen.sesUrl}
                  onChange={(e) => setDuzenlenen({ ...duzenlenen, sesUrl: e.target.value })}
                  placeholder="https://… veya /api/media/…"
                />
                <Buton ton="ikincil" onClick={() => setMedyaAcik(medyaAcik === 'ses' ? null : 'ses')}>
                  Kütüphane
                </Buton>
              </div>
            </Alan>

            <Alan etiket={`Ses seviyesi (${duzenlenen.sesSeviyesi})`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={duzenlenen.sesSeviyesi}
                onChange={(e) => setDuzenlenen({ ...duzenlenen, sesSeviyesi: Number(e.target.value) })}
                className="w-full"
              />
            </Alan>

            <div className="grid grid-cols-2 gap-3">
              <Alan etiket="Vurgu rengi">
                <input
                  type="color"
                  value={duzenlenen.vurguRengi}
                  onChange={(e) => setDuzenlenen({ ...duzenlenen, vurguRengi: e.target.value })}
                  className="w-full h-9 bg-black/40 rounded-xl"
                />
              </Alan>
              <Alan etiket="Yazı rengi">
                <input
                  type="color"
                  value={duzenlenen.metinRengi}
                  onChange={(e) => setDuzenlenen({ ...duzenlenen, metinRengi: e.target.value })}
                  className="w-full h-9 bg-black/40 rounded-xl"
                />
              </Alan>
            </div>
          </div>

          {medyaAcik && (
            <div className="pt-3 border-t border-white/10">
              <MediaLibrary
                onSec={(o: MedyaOgesi) => {
                  setDuzenlenen({
                    ...duzenlenen,
                    ...(medyaAcik === 'gorsel' ? { gorselUrl: o.url } : { sesUrl: o.url })
                  });
                  setMedyaAcik(null);
                  toast(`${o.ad} seçildi.`, 'basari');
                }}
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
            <Buton ikon={<Save className="w-3.5 h-3.5" />} onClick={kaydet}>
              Kaydet
            </Buton>
            <Buton ton="sade" onClick={() => setDuzenlenen(null)}>
              Vazgeç
            </Buton>
            {secili.degerAdi !== '—' && (
              <Girdi
                type="number"
                min={0}
                value={testDegeri}
                onChange={(e) => setTestDegeri(e.target.value)}
                placeholder={`test ${secili.degerAdi}`}
                className="ml-auto w-36"
              />
            )}
            <Buton
              ton="ikincil"
              ikon={<Play className="w-3.5 h-3.5" />}
              className={secili.degerAdi === '—' ? 'ml-auto' : ''}
              onClick={() =>
                fetch('/api/alerts/test', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    eventType: olay,
                    ...(testDegeri ? { deger: Number(testDegeri) } : {})
                  })
                }).then(() => toast('Test uyarısı tetiklendi — overlay’i izleyin.', 'basari'))
              }
            >
              Overlay’de dene
            </Buton>
          </div>
          <p className="text-[10px] text-gray-500">
            <Layers className="w-3 h-3 inline mr-1" />
            Test, kayıtlı varyantlar arasından kural gereği seçim yapar — önce kaydedin. Eşiği denemek için test
            değeri girin (ör. 500 → "tutar ≥ 500" varyantı seçilir).
          </p>
        </Kart>
      )}
    </div>
  );
}

export default AlertVariants;
