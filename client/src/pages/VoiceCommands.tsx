/**
 * StreamAxT — Sesli Komutlar
 * Developed by AxthrowA
 *
 * Yayıncı mikrofona konuşur ("bot, sohbeti temizle"); tanıma tarayıcıda yerel (Vosk, Türkçe model) yapılır, sunucu
 * cümleyi komutlarla eşleyip eylemi çalıştırır: bot komutları, sohbet, TTS, ses panosu, Overlay Studio widget'ları,
 * testler, şarkı, moderasyon. Dinleme kipi: uyandırma sözcüğü, bas-konuş ya da ikisi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Mic, MicOff, Plus, Trash2, X } from 'lucide-react';
import { Alan, Anahtar, BosDurum, Buton, Girdi, Kart, Secim, useOnay, useToast } from '../ui/index.js';
import { panelDinleyicisi } from '../lib/sesli/tekil.js';
import { KANAL_ADI, type DinleyiciDurumu, type KanalMesaji } from '../lib/sesli/kapi.js';
import { wsAdresi } from '../lib/widget-style.js';

type EylemTuru =
  | 'komut'
  | 'sohbet'
  | 'tts'
  | 'pano_oynat'
  | 'pano_kontrol'
  | 'overlay'
  | 'widget_test'
  | 'uyari_test'
  | 'sarki_atla'
  | 'sohbet_temizle'
  | 'kalkan';

interface Eylem {
  tur: EylemTuru;
  metin?: string;
  ogeId?: string;
  eylem?: string;
  widget?: string;
  durum?: string;
  olay?: string;
}
interface Komut {
  id?: string;
  ad: string;
  ifadeler: string[];
  eylem: Eylem;
  etkin: boolean;
  aciklama?: string;
}
interface Ayarlar {
  etkin: boolean;
  kip: 'uyandirma' | 'bas_konus' | 'ikisi';
  uyandirma: string;
  esik: number;
  dinamikPano: boolean;
  dinamikOverlay: boolean;
  kisitli: boolean;
  platform: string;
  mikrofon: string;
}
type Model = { durum: 'yok' } | { durum: 'indiriliyor'; yuzde: number; mesaj: string } | { durum: 'hazir'; boyut: number } | { durum: 'hata'; mesaj: string };

const EYLEM_TURLERI: { value: EylemTuru; label: string }[] = [
  { value: 'komut', label: 'Bot komutu çalıştır (yanıt sohbete gider)' },
  { value: 'sohbet', label: 'Sohbete mesaj yaz' },
  { value: 'tts', label: 'Seslendir (TTS)' },
  { value: 'pano_oynat', label: 'Ses panosundan çal' },
  { value: 'pano_kontrol', label: 'Ses panosu: atla / duraklat / devam / temizle' },
  { value: 'overlay', label: 'Overlay Studio widget aç / kapat' },
  { value: 'widget_test', label: 'Widget testi' },
  { value: 'uyari_test', label: 'Uyarı testi' },
  { value: 'sarki_atla', label: 'Şarkı isteğini atla' },
  { value: 'sohbet_temizle', label: 'Sohbeti temizle' },
  { value: 'kalkan', label: 'Kalkan modu aç / kapat' }
];

const WIDGETLAR = [
  { value: 'chat', label: 'Sohbet' },
  { value: 'alerts', label: 'Uyarılar' },
  { value: 'goals', label: 'Hedefler' },
  { value: 'subathon', label: 'Subathon' },
  { value: 'trivia', label: 'Bil Bakalım' },
  { value: 'eventLabels', label: 'Olay etiketleri' },
  { value: 'emoteCombo', label: 'Emote kombo' },
  { value: 'nowPlaying', label: 'Çalan şarkı' },
  { value: 'theCup', label: 'Kupa' },
  { value: 'polls', label: 'Anket' },
  { value: 'wheel', label: 'Çarkıfelek' },
  { value: 'hypeTrain', label: 'Hype treni' }
];

const TEST_WIDGETLARI = ['wheel', 'emote-combo', 'the-cup', 'hype-train', 'subathon', 'shoutout', 'credits', 'jumpscare', 'viewer-counter', 'tts'].map((v) => ({
  value: v,
  label: v
}));

const DURUM_METNI: Record<DinleyiciDurumu, string> = {
  kapali: 'Kapalı',
  'model-yok': 'Model indirilmemiş',
  yukleniyor: 'Yükleniyor…',
  dinliyor: 'Dinliyor',
  hata: 'Hata',
  'baska-pencerede': 'Başka pencerede dinleniyor'
};

const BOS: Komut = { ad: '', ifadeler: [], eylem: { tur: 'komut', metin: '!' }, etkin: true };

async function istek<T = any>(yol: string, yontem = 'GET', govde?: unknown): Promise<T> {
  const r = await fetch(yol, { method: yontem, headers: govde ? { 'Content-Type': 'application/json' } : undefined, body: govde ? JSON.stringify(govde) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.hata || j?.error || `HTTP ${r.status}`);
  return j as T;
}

export default function VoiceCommands() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [ayar, setAyar] = useState<Ayarlar | null>(null);
  const [komutlar, setKomutlar] = useState<Komut[]>([]);
  const [model, setModel] = useState<Model>({ durum: 'yok' });
  const [pano, setPano] = useState<{ id: string; ad: string }[]>([]);
  const [gecmis, setGecmis] = useState<any[]>([]);
  const [duzen, setDuzen] = useState<Komut | null>(null);
  const [dene, setDene] = useState('');
  const [mikrofonlar, setMikrofonlar] = useState<{ value: string; label: string }[]>([]);
  // Dinleyici (bu pencerede ya da başka bir pencerede — durum kanaldan gelir)
  const [dDurum, setDDurum] = useState<DinleyiciDurumu>('kapali');
  const [dMesaj, setDMesaj] = useState('');
  const [seviye, setSeviye] = useState(0);
  const [basili, setBasili] = useState(false);
  const [kismi, setKismi] = useState('');

  const yukle = useCallback(async () => {
    try {
      const [s, g, p] = await Promise.all([istek('/api/sesli'), istek('/api/sesli/gecmis?adet=40'), istek('/api/pano').catch(() => ({ ogeler: [] }))]);
      setAyar(s.ayarlar);
      setKomutlar(s.komutlar);
      setModel(s.model);
      setGecmis(g.gecmis || []);
      setPano((p.ogeler || []).map((o: any) => ({ id: o.id, ad: o.ad })));
    } catch (e: any) {
      toast(`Sesli komutlar yüklenemedi: ${e.message}`, 'hata');
    }
  }, [toast]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  // Sunucu iletileri: sonuç, model ilerlemesi
  useEffect(() => {
    let kapandi = false;
    let s: WebSocket | null = null;
    const baglan = () => {
      s = new WebSocket(wsAdresi('dashboard'));
      s.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data));
          if (m.type === 'sesli_sonuc') setGecmis((x) => [{ id: `${Date.now()}`, zaman: Date.now(), ...m.sonuc }, ...x].slice(0, 40));
          else if (m.type === 'sesli_model') setModel(m.model);
        } catch {
          /* */
        }
      };
      s.onclose = () => {
        if (!kapandi) setTimeout(baglan, 3000);
      };
    };
    baglan();
    return () => {
      kapandi = true;
      s?.close();
    };
  }, []);

  // Dinleyici durumu (aynı kökendeki her pencere)
  useEffect(() => {
    const k = new BroadcastChannel(KANAL_ADI);
    k.onmessage = (e) => {
      const m = e.data as KanalMesaji;
      if (m.tur === 'durum') {
        setDDurum(m.durum);
        if (m.mesaj !== undefined) setDMesaj(m.mesaj);
        setSeviye(m.seviye ?? 0);
        setBasili(!!m.basili);
      } else if (m.tur === 'kismi') setKismi(m.metin);
      else if (m.tur === 'sonuc') setKismi('');
    };
    k.postMessage({ tur: 'durum-sor' } satisfies KanalMesaji);
    const d = panelDinleyicisi();
    if (d.durum !== 'kapali') setDDurum(d.durum);
    return () => k.close();
  }, []);

  // Bu penceredeki dinleyiciye ayarları ilet
  useEffect(() => {
    if (ayar) panelDinleyicisi().secenekleriAyarla({ kip: ayar.kip, mikrofon: ayar.mikrofon });
  }, [ayar]);

  const mikrofonlariListele = async () => {
    try {
      const aygitlar = await navigator.mediaDevices.enumerateDevices();
      setMikrofonlar(
        aygitlar
          .filter((a) => a.kind === 'audioinput' && a.deviceId !== 'default' && a.deviceId !== 'communications')
          .map((a, i) => ({ value: a.deviceId, label: a.label || `Mikrofon ${i + 1}` }))
      );
    } catch {
      /* izin yok */
    }
  };
  useEffect(() => {
    void mikrofonlariListele();
  }, [dDurum]);

  const ayarYaz = async (degisim: Partial<Ayarlar>) => {
    try {
      const r = await istek<{ ayarlar: Ayarlar }>('/api/sesli/ayarlar', 'POST', degisim);
      setAyar(r.ayarlar);
    } catch (e: any) {
      toast(e.message, 'hata');
    }
  };

  const kaydet = async () => {
    if (!duzen) return;
    try {
      await istek('/api/sesli/komut', 'POST', duzen);
      toast(`"${duzen.ad}" kaydedildi`, 'basari');
      setDuzen(null);
      void yukle();
    } catch (e: any) {
      toast(e.message, 'hata');
    }
  };

  const sil = (k: Komut) =>
    sor('Komutu sil', `"${k.ad}" sesli komutu silinsin mi?`, () => {
      void istek(`/api/sesli/komut/${k.id}`, 'DELETE').then(yukle);
    });

  const denemeYap = async () => {
    if (!dene.trim()) return;
    try {
      const r = await istek('/api/sesli/calistir', 'POST', { metin: dene, dene: true });
      toast(r.ok ? `✓ ${r.mesaj}` : r.mesaj, r.ok ? 'basari' : 'hata');
    } catch (e: any) {
      toast(e.message, 'hata');
    }
  };

  const ptt = (b: boolean) => {
    // Dinleyici başka pencerede olabilir: kanaldan da yolla
    panelDinleyicisi().basKonus(b);
    try {
      const k = new BroadcastChannel(KANAL_ADI);
      k.postMessage({ tur: 'ptt', basili: b } satisfies KanalMesaji);
      k.close();
    } catch {
      /* */
    }
  };

  const panoSecenekleri = useMemo(() => [{ value: '', label: 'Ses seçin' }, ...pano.map((p) => ({ value: p.id, label: p.ad }))], [pano]);
  const dinleyiciBuradaMi = panelDinleyicisi().durum === 'dinliyor' || panelDinleyicisi().durum === 'yukleniyor';
  const dinleyiciAdresi = `${window.location.protocol}//${window.location.host}/sesli-dinleyici?otomatik=1`;

  if (!ayar) return <BosDurum baslik="Yükleniyor…" />;
  const e = duzen?.eylem;
  return (
    <div className="space-y-4">
      {eleman}
      <Kart
        baslik="Sesli Komutlar"
        aciklama={`Mikrofona konuşarak botu ve Overlay Studio'yu yönetin: "${ayar.uyandirma}, sohbeti temizle". Tanıma bilgisayarınızda yapılır; ses dışarı gönderilmez.`}
        sag={<Anahtar acik={ayar.etkin} onChange={(v) => void ayarYaz({ etkin: v })} etiket={ayar.etkin ? 'Açık' : 'Kapalı'} />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <span className="mb-1 block text-[11px] font-bold text-gray-300">Türkçe konuşma modeli</span>
            {model.durum === 'hazir' ? (
              <p className="text-sm text-emerald-300">Hazır ({(model.boyut / 1048576).toFixed(1)} MB) — Vosk küçük Türkçe model, Apache-2.0</p>
            ) : model.durum === 'indiriliyor' ? (
              <div>
                <div className="h-2 overflow-hidden rounded bg-white/10">
                  <div className="h-full bg-cyan-500" style={{ width: `${model.yuzde}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">{model.mesaj}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {model.durum === 'hata' && <p className="text-sm text-red-300">İndirme başarısız: {model.mesaj}</p>}
                <p className="text-[11px] text-gray-400">
                  Model bir kez indirilir (~37 MB, alphacephei.com, Apache-2.0) ve bilgisayarda saklanır; sonra internetsiz çalışır.
                </p>
                <Buton ikon={<Download className="h-3.5 w-3.5" />} onClick={() => void istek('/api/sesli/model/indir', 'POST').then(setModel, (x) => toast(x.message, 'hata'))}>
                  Modeli indir
                </Buton>
              </div>
            )}
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-bold text-gray-300">Dinleyici</span>
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${dDurum === 'dinliyor' ? (basili ? 'bg-red-500' : 'bg-emerald-400') : dDurum === 'hata' ? 'bg-red-500' : 'bg-gray-500'}`} />
              <b>{DURUM_METNI[dDurum]}</b>
              {basili && <span className="rounded bg-red-500/20 px-1.5 text-[11px] text-red-300">BAS-KONUŞ</span>}
              <span className="ml-auto flex gap-2">
                {dinleyiciBuradaMi ? (
                  <Buton ton="ikincil" ikon={<MicOff className="h-3.5 w-3.5" />} onClick={() => panelDinleyicisi().durdur()}>
                    Durdur
                  </Buton>
                ) : (
                  <Buton ton="ikincil" ikon={<Mic className="h-3.5 w-3.5" />} disabled={model.durum !== 'hazir' || dDurum === 'dinliyor'} onClick={() => void panelDinleyicisi().baslat()}>
                    Bu pencerede dinle
                  </Buton>
                )}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded bg-white/10">
              <div className="h-full bg-emerald-400 transition-[width] duration-100" style={{ width: `${Math.round(seviye * 100)}%` }} />
            </div>
            {dMesaj && <p className="mt-1 text-[11px] text-gray-400">{dMesaj}</p>}
            <p className="mt-1 min-h-[1.1rem] text-[12px] italic text-gray-400">{kismi}</p>
            <button
              className={`mt-1 w-full select-none rounded-xl py-2 text-xs font-bold ${basili ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-200 hover:bg-white/15'}`}
              disabled={dDurum !== 'dinliyor'}
              onPointerDown={() => ptt(true)}
              onPointerUp={() => ptt(false)}
              onPointerLeave={() => basili && ptt(false)}
            >
              Basılı tut ve konuş
            </button>
            <p className="mt-2 text-[11px] text-gray-500">
              Yayın Yönetim Aracı dinleyiciyi arka planda açık tutar ve genel kısayolla bas-konuş sağlar (oyun içindeyken de). Ayrı kullanımda bu
              sayfayı açık bırakın ya da dinleyiciyi OBS'te özel tarayıcı dock'u olarak ekleyin:{' '}
              <code className="select-all text-gray-400">{dinleyiciAdresi}</code>
            </p>
          </div>
        </div>
      </Kart>

      <Kart baslik="Ayarlar">
        <div className="grid gap-3 md:grid-cols-3">
          <Alan etiket="Dinleme kipi">
            <Secim
              value={ayar.kip}
              secenekler={[
                { value: 'ikisi', label: 'Uyandırma sözcüğü + bas-konuş' },
                { value: 'uyandirma', label: 'Yalnız uyandırma sözcüğü' },
                { value: 'bas_konus', label: 'Yalnız bas-konuş' }
              ]}
              onChange={(x) => void ayarYaz({ kip: x.target.value as Ayarlar['kip'] })}
            />
          </Alan>
          <Alan etiket="Uyandırma sözcüğü" ipucu="Cümlenin başında söylenir. Kısa ve sohbette az geçen bir sözcük seçin.">
            <Girdi defaultValue={ayar.uyandirma} key={ayar.uyandirma} onBlur={(x) => x.target.value !== ayar.uyandirma && void ayarYaz({ uyandirma: x.target.value })} />
          </Alan>
          <Alan etiket="Mikrofon">
            <Secim
              value={ayar.mikrofon}
              secenekler={[{ value: '', label: 'Varsayılan mikrofon' }, ...mikrofonlar]}
              onChange={(x) => void ayarYaz({ mikrofon: x.target.value })}
            />
          </Alan>
          <Alan etiket={`Eşleşme hassasiyeti: %${Math.round(ayar.esik * 100)}`} ipucu="Yüksek: daha az yanlış tetikleme; düşük: daha çok tolerans">
            <input type="range" min={50} max={98} defaultValue={Math.round(ayar.esik * 100)} key={ayar.esik} onMouseUp={(x) => void ayarYaz({ esik: Number((x.target as HTMLInputElement).value) / 100 })} className="w-full" />
          </Alan>
          <Alan etiket="Bot komutları hangi platformda çalışsın">
            <Secim
              value={ayar.platform}
              secenekler={['kick', 'twitch', 'youtube', 'tiktok', 'trovo', 'discord'].map((p) => ({ value: p, label: p }))}
              onChange={(x) => void ayarYaz({ platform: x.target.value })}
            />
          </Alan>
          <div className="flex flex-col gap-2 pt-5">
            <Anahtar acik={ayar.kisitli} onChange={(v) => void ayarYaz({ kisitli: v })} etiket="Yalnız komut ifadelerini tanı (önerilen)" />
            <Anahtar acik={ayar.dinamikPano} onChange={(v) => void ayarYaz({ dinamikPano: v })} etiket={'"<ses adı> çal" ile ses panosu'} />
            <Anahtar acik={ayar.dinamikOverlay} onChange={(v) => void ayarYaz({ dinamikOverlay: v })} etiket={'"<widget> aç / kapat" ile Overlay Studio'} />
          </div>
        </div>
      </Kart>

      <Kart baslik="Komutlar" aciklama="Her komut için bir ya da daha çok ifade; biri söylenince eylem çalışır." sag={<Buton ikon={<Plus className="h-3.5 w-3.5" />} onClick={() => setDuzen({ ...BOS })}>Yeni komut</Buton>}>
        {komutlar.length === 0 ? (
          <BosDurum baslik="Komut yok" aciklama="Yeni komut ekleyin. Ses panosu ve widget kalıpları komut tanımlamadan da çalışır." />
        ) : (
          <div className="divide-y divide-white/5">
            {komutlar.map((k) => (
              <div key={k.id} className={`flex items-center gap-3 py-2 ${k.etkin ? '' : 'opacity-50'}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-white">{k.ad}</div>
                  <div className="truncate text-[11px] text-gray-400">
                    “{k.ifadeler.join('” · “')}” → {k.aciklama}
                  </div>
                </div>
                <Buton ton="ikincil" onClick={() => setDuzen({ ...k, ifadeler: [...k.ifadeler], eylem: { ...k.eylem } })}>
                  Düzenle
                </Buton>
                <Buton ton="sade" title="Sil" onClick={() => sil(k)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Buton>
              </div>
            ))}
          </div>
        )}
      </Kart>

      {duzen && e && (
        <Kart baslik={duzen.id ? `Düzenle: ${duzen.ad}` : 'Yeni sesli komut'} sag={<Buton ton="sade" onClick={() => setDuzen(null)}><X className="h-3.5 w-3.5" /></Buton>}>
          <div className="grid gap-3 md:grid-cols-2">
            <Alan etiket="Ad">
              <Girdi value={duzen.ad} maxLength={60} onChange={(x) => setDuzen({ ...duzen, ad: x.target.value })} />
            </Alan>
            <Alan etiket="İfadeler" ipucu={`Virgülle ayırın. Uyandırma sözcüğü ("${ayar.uyandirma}") yazılmaz.`}>
              <Girdi value={duzen.ifadeler.join(', ')} placeholder="çekilişi başlat, çekiliş başlasın" onChange={(x) => setDuzen({ ...duzen, ifadeler: x.target.value.split(',').map((s) => s.trimStart()) })} />
            </Alan>
            <Alan etiket="Eylem">
              <Secim value={e.tur} secenekler={EYLEM_TURLERI} onChange={(x) => setDuzen({ ...duzen, eylem: varsayilanEylem(x.target.value as EylemTuru) })} />
            </Alan>
            {(e.tur === 'komut' || e.tur === 'sohbet' || e.tur === 'tts') && (
              <Alan etiket={e.tur === 'komut' ? 'Bot komutu (örn. !çekiliş başlat)' : 'Metin'} ipucu={e.tur === 'komut' ? 'Yayıncı adına çalışır; botun yanıtı gerçek sohbete gider.' : undefined}>
                <Girdi value={e.metin ?? ''} onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, metin: x.target.value } })} />
              </Alan>
            )}
            {e.tur === 'pano_oynat' && (
              <Alan etiket="Ses / video">
                <Secim value={e.ogeId ?? ''} secenekler={panoSecenekleri} onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, ogeId: x.target.value } })} />
              </Alan>
            )}
            {e.tur === 'pano_kontrol' && (
              <Alan etiket="Ses panosu">
                <Secim
                  value={e.eylem ?? 'atla'}
                  secenekler={[
                    { value: 'atla', label: 'Çalanı atla' },
                    { value: 'duraklat', label: 'Sırayı duraklat' },
                    { value: 'devam', label: 'Sırayı sürdür' },
                    { value: 'temizle', label: 'Sırayı temizle (puan iade)' }
                  ]}
                  onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, eylem: x.target.value } })}
                />
              </Alan>
            )}
            {e.tur === 'overlay' && (
              <>
                <Alan etiket="Widget">
                  <Secim value={e.widget ?? 'chat'} secenekler={WIDGETLAR} onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, widget: x.target.value } })} />
                </Alan>
                <Alan etiket="Durum">
                  <Secim
                    value={e.durum ?? 'degistir'}
                    secenekler={[
                      { value: 'ac', label: 'Aç' },
                      { value: 'kapat', label: 'Kapat' },
                      { value: 'degistir', label: 'Aç / kapat (tersine çevir)' }
                    ]}
                    onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, durum: x.target.value } })}
                  />
                </Alan>
              </>
            )}
            {e.tur === 'widget_test' && (
              <Alan etiket="Widget">
                <Secim value={e.widget ?? 'wheel'} secenekler={TEST_WIDGETLARI} onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, widget: x.target.value } })} />
              </Alan>
            )}
            {e.tur === 'uyari_test' && (
              <Alan etiket="Olay">
                <Secim
                  value={e.olay ?? 'follow'}
                  secenekler={[
                    { value: 'follow', label: 'Takip' },
                    { value: 'sub', label: 'Abonelik' },
                    { value: 'tip', label: 'Bağış' },
                    { value: 'raid', label: 'Baskın' },
                    { value: 'gift_tiktok', label: 'TikTok hediyesi' }
                  ]}
                  onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, olay: x.target.value } })}
                />
              </Alan>
            )}
            {e.tur === 'kalkan' && (
              <Alan etiket="Kalkan modu">
                <Secim
                  value={e.durum ?? 'ac'}
                  secenekler={[
                    { value: 'ac', label: 'Aç' },
                    { value: 'kapat', label: 'Kapat' }
                  ]}
                  onChange={(x) => setDuzen({ ...duzen, eylem: { ...e, durum: x.target.value } })}
                />
              </Alan>
            )}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Anahtar acik={duzen.etkin} onChange={(v) => setDuzen({ ...duzen, etkin: v })} etiket="Etkin" />
            <Buton onClick={() => void kaydet()} disabled={!duzen.ad.trim() || !duzen.ifadeler.some((i) => i.trim())}>
              Kaydet
            </Buton>
          </div>
        </Kart>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Kart baslik="Dene" aciklama="Konuşmadan, yazarak deneyin. Eylem gerçekten çalışır (bot komutu sohbete yanıt yazar).">
          <div className="flex gap-2">
            <Girdi value={dene} placeholder="sohbeti temizle" onChange={(x) => setDene(x.target.value)} onKeyDown={(x) => x.key === 'Enter' && void denemeYap()} />
            <Buton onClick={() => void denemeYap()} disabled={!dene.trim()}>
              Çalıştır
            </Buton>
          </div>
          <div className="mt-3 text-[11px] leading-relaxed text-gray-400">
            <b className="text-gray-300">Komut tanımlamadan çalışanlar:</b>
            <br />• “{ayar.uyandirma}, davul çal” / “{ayar.uyandirma}, alkış sesini çal” — ses panosundaki ada göre
            <br />• “{ayar.uyandirma}, anketi aç” / “{ayar.uyandirma}, sohbeti gizle” — Overlay Studio widget'ları
            <br />
            <b className="text-gray-300">Bas-konuş:</b> tuş basılıyken uyandırma sözcüğü gerekmez.
          </div>
        </Kart>
        <Kart baslik="Son komutlar">
          {gecmis.length === 0 ? (
            <BosDurum baslik="Henüz komut yok" />
          ) : (
            <div className="max-h-72 overflow-auto text-[12px]">
              {gecmis.map((g) => (
                <div key={g.id} className="flex justify-between gap-2 border-b border-white/5 py-1">
                  <span className="min-w-0 truncate">
                    <span className={g.ok ? 'text-emerald-300' : 'text-gray-500'}>{g.ok ? '✓' : '·'}</span> “{g.metin}”{' '}
                    <span className="text-gray-400">→ {g.mesaj}</span>
                  </span>
                  <span className="shrink-0 text-gray-500">{new Date(g.zaman).toLocaleTimeString('tr-TR')}</span>
                </div>
              ))}
            </div>
          )}
        </Kart>
      </div>
    </div>
  );
}

function varsayilanEylem(tur: EylemTuru): Eylem {
  switch (tur) {
    case 'komut':
      return { tur, metin: '!' };
    case 'sohbet':
    case 'tts':
      return { tur, metin: '' };
    case 'pano_oynat':
      return { tur, ogeId: '' };
    case 'pano_kontrol':
      return { tur, eylem: 'atla' };
    case 'overlay':
      return { tur, widget: 'chat', durum: 'degistir' };
    case 'widget_test':
      return { tur, widget: 'wheel' };
    case 'uyari_test':
      return { tur, olay: 'follow' };
    case 'kalkan':
      return { tur, durum: 'ac' };
    default:
      return { tur };
  }
}
