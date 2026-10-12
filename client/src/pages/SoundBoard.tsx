/**
 * StreamAxT — Ses/Video Panosu (Blerp tarzı)
 * Developed by AxthrowA
 *
 * Yayıncı kendi ses ve videolarını yükler, panoya ekler; izleyiciler sohbetten `!ses <ad>` ile bot puanı harcayarak
 * yayında oynatır. Rastgele kovalar, giriş sesleri, bekleme süreleri ve sıra denetimi buradan yönetilir. Yayına çıkış
 * için /widgets/pano adresi tarayıcı kaynağı olarak eklenir (OBS ya da yayın motoru).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Pause, Play, Plus, SkipForward, Trash2, X } from 'lucide-react';
import { Alan, Anahtar, BosDurum, Buton, Girdi, Kart, Secim, useOnay, useToast } from '../ui/index.js';
import { MediaLibrary, type MedyaOgesi } from '../components/MediaLibrary.js';
import { KONUM_ADLARI, sohbetAdi, type PanoGorunum, type PanoKonum } from '../lib/pano.js';
import { wsAdresi } from '../lib/widget-style.js';

interface Oge {
  id: string;
  ad: string;
  komut: string;
  medyaId: string;
  tur: 'audio' | 'video';
  gorselId: string | null;
  ses: number;
  maksSureSn: number;
  maliyet: number;
  beklemeSn: number;
  kullaniciBeklemeSn: number;
  yetki: 'herkes' | 'abone' | 'mod';
  kovaId: string | null;
  agirlik: number;
  etkin: boolean;
}
interface Kova {
  id: string;
  ad: string;
  komut: string;
  maliyet: number;
  beklemeSn: number;
  etkin: boolean;
}
interface Ayarlar {
  etkin: boolean;
  genelBeklemeSn: number;
  kuyrukSiniri: number;
  maksSureSn: number;
  modlarUcretsiz: boolean;
  girisSesleri: boolean;
  gorunum: PanoGorunum;
}
interface Istek {
  id: string;
  ad: string;
  kullanici: string;
  tur: string;
}
interface Durum {
  ogeler: Oge[];
  kovalar: Kova[];
  girisSesleri: { kullanici: string; ogeId: string }[];
  calan: Istek | null;
  kuyruk: Istek[];
  duraklatildi: boolean;
  ayarlar: Ayarlar;
}

const BOS_OGE: Partial<Oge> = { ses: 80, maksSureSn: 0, maliyet: 100, beklemeSn: 10, kullaniciBeklemeSn: 30, yetki: 'herkes', agirlik: 1, etkin: true };

async function istek<T = any>(yol: string, yontem = 'GET', govde?: unknown): Promise<T> {
  const r = await fetch(yol, { method: yontem, headers: govde ? { 'Content-Type': 'application/json' } : undefined, body: govde ? JSON.stringify(govde) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.hata || j?.error || `HTTP ${r.status}`);
  return j as T;
}

export default function SoundBoard() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [d, setD] = useState<Durum | null>(null);
  const [medya, setMedya] = useState<MedyaOgesi[]>([]);
  const [duzen, setDuzen] = useState<Partial<Oge> | null>(null);
  const [secici, setSecici] = useState<'medya' | 'gorsel' | null>(null);
  const [yeniKova, setYeniKova] = useState({ ad: '', maliyet: 50, beklemeSn: 10 });
  const [giris, setGiris] = useState({ kullanici: '', ogeId: '' });
  const [gecmis, setGecmis] = useState<any[]>([]);
  const onizleme = useRef<HTMLAudioElement | null>(null);

  const yukle = useCallback(async () => {
    try {
      const [p, m, g] = await Promise.all([istek<Durum>('/api/pano'), istek<{ ogeler: MedyaOgesi[] }>('/api/media'), istek<{ gecmis: any[] }>('/api/pano/gecmis?adet=30')]);
      setD(p);
      setMedya(m.ogeler || []);
      setGecmis(g.gecmis || []);
    } catch (e: any) {
      toast(`Ses panosu yüklenemedi: ${e.message}`, 'hata');
    }
  }, [toast]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  // Sıra ve çalan canlı (pano_durum iletisi panele de gelir)
  useEffect(() => {
    let kapandi = false;
    let s: WebSocket | null = null;
    const baglan = () => {
      s = new WebSocket(wsAdresi('dashboard'));
      s.onmessage = (e) => {
        try {
          const m = JSON.parse(String(e.data));
          if (m.type === 'pano_durum') setD((x) => (x ? { ...x, ...m.durum } : x));
        } catch {
          /* yok say */
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

  const medyaAdi = (id: string | null) => medya.find((m) => m.id === id)?.ad ?? '—';
  const medyaUrl = (id: string | null) => medya.find((m) => m.id === id)?.url;
  const katmanAdresi = `${window.location.protocol}//${window.location.host}/widgets/pano`;

  const ayarYaz = async (degisim: Partial<Ayarlar>) => {
    try {
      const r = await istek<{ ayarlar: Ayarlar }>('/api/pano/ayarlar', 'POST', degisim);
      setD((x) => (x ? { ...x, ayarlar: r.ayarlar } : x));
    } catch (e: any) {
      toast(e.message, 'hata');
    }
  };

  const kaydet = async () => {
    if (!duzen) return;
    try {
      await istek('/api/pano/oge', 'POST', duzen);
      toast(`"${duzen.ad}" kaydedildi`, 'basari');
      setDuzen(null);
      void yukle();
    } catch (e: any) {
      toast(e.message, 'hata');
    }
  };

  const sil = (o: Oge) =>
    sor('Sesi sil', `"${o.ad}" panodan kaldırılsın mı? (Medya dosyası kütüphanede kalır.)`, () => {
      void istek(`/api/pano/oge/${o.id}`, 'DELETE').then(yukle);
    });

  const kontrol = (eylem: string) => istek('/api/pano/kontrol', 'POST', { eylem }).catch((e) => toast(e.message, 'hata'));
  const oynat = (o: Oge) =>
    istek('/api/pano/oynat', 'POST', { ogeId: o.id }).then(
      () => toast(`"${o.ad}" yayına gönderildi`, 'basari'),
      (e) => toast(e.message, 'hata')
    );
  const dinle = (o: Oge) => {
    const url = medyaUrl(o.medyaId);
    if (!url || !onizleme.current) return;
    onizleme.current.src = url;
    onizleme.current.volume = o.ses / 100;
    void onizleme.current.play();
  };

  const kovaSecenekleri = useMemo(() => [{ value: '', label: 'Kova yok (doğrudan adla)' }, ...(d?.kovalar ?? []).map((k) => ({ value: k.id, label: `🎲 ${k.ad}` }))], [d?.kovalar]);

  if (!d) return <BosDurum baslik="Yükleniyor…" />;
  const a = d.ayarlar;
  return (
    <div className="space-y-4">
      {eleman}
      <audio ref={onizleme} className="hidden" />
      <Kart
        baslik="Ses / Video Panosu"
        aciklama="Kendi ses ve videolarını yükle; izleyiciler sohbetten !ses <ad> ile bot puanı harcayarak yayında oynatsın. Liste: !sesler · Mod: !sesgec"
        sag={<Anahtar acik={a.etkin} onChange={(v) => void ayarYaz({ etkin: v })} etiket={a.etkin ? 'Açık' : 'Kapalı'} />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Alan etiket="Yayın katmanı (tarayıcı kaynağı, 1920×1080)" ipucu="OBS'e ya da Yayın sekmesindeki motora tarayıcı kaynağı olarak ekleyin">
            <div className="flex gap-2">
              <Girdi readOnly value={katmanAdresi} />
              <Buton ton="ikincil" ikon={<Copy className="w-3.5 h-3.5" />} onClick={() => void navigator.clipboard.writeText(katmanAdresi).then(() => toast('Adres kopyalandı', 'basari'))}>
                Kopyala
              </Buton>
            </div>
          </Alan>
          <div>
            <span className="block text-[11px] font-bold text-gray-300 mb-1">Şu an</span>
            <div className="flex flex-wrap items-center gap-2 text-sm text-white">
              {d.calan ? (
                <span>
                  ▶ <b>{d.calan.ad}</b> <span className="text-gray-400">({d.calan.kullanici})</span>
                </span>
              ) : (
                <span className="text-gray-400">{d.duraklatildi ? 'Sıra duraklatıldı' : 'Çalan yok'}</span>
              )}
              <span className="text-gray-400">· sırada {d.kuyruk.length}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Buton ton="ikincil" ikon={<SkipForward className="w-3.5 h-3.5" />} disabled={!d.calan} onClick={() => void kontrol('atla')}>
                Atla
              </Buton>
              {d.duraklatildi ? (
                <Buton ton="ikincil" ikon={<Play className="w-3.5 h-3.5" />} onClick={() => void kontrol('devam')}>
                  Devam
                </Buton>
              ) : (
                <Buton ton="ikincil" ikon={<Pause className="w-3.5 h-3.5" />} onClick={() => void kontrol('duraklat')}>
                  Duraklat
                </Buton>
              )}
              <Buton ton="tehlike" ikon={<X className="w-3.5 h-3.5" />} disabled={!d.kuyruk.length} onClick={() => void kontrol('temizle')}>
                Sırayı temizle (puan iade)
              </Buton>
            </div>
          </div>
        </div>
      </Kart>

      <Kart baslik="Sesler" aciklama="Her ses için sohbet adı, bedel ve bekleme süresi" sag={<Buton ikon={<Plus className="w-3.5 h-3.5" />} onClick={() => setDuzen({ ...BOS_OGE })}>Yeni ses / video</Buton>}>
        {d.ogeler.length === 0 ? (
          <BosDurum baslik="Henüz ses yok" aciklama="Önce aşağıdaki medya kütüphanesine dosya yükleyin, sonra 'Yeni ses / video' ile panoya ekleyin." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {d.ogeler.map((o) => (
              <div key={o.id} className={`rounded-xl border border-white/10 bg-black/30 p-3 ${o.etkin ? '' : 'opacity-50'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white">
                      {o.tur === 'video' ? '🎬' : '🔊'} {o.ad}
                    </div>
                    <div className="truncate text-[11px] text-gray-400">
                      !ses {o.komut} · {o.maliyet} puan · {o.beklemeSn} sn{o.kovaId ? ` · 🎲 ${d.kovalar.find((k) => k.id === o.kovaId)?.ad ?? ''}` : ''}
                      {o.yetki !== 'herkes' ? ` · ${o.yetki === 'mod' ? 'yalnız mod' : 'yalnız abone'}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Buton ton="sade" title="Dinle (yalnız sende)" onClick={() => dinle(o)}>
                      <Play className="w-3.5 h-3.5" />
                    </Buton>
                    <Buton ton="sade" title="Sil" onClick={() => sil(o)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Buton>
                  </div>
                </div>
                <div className="mt-2 flex gap-2">
                  <Buton ton="birincil" className="flex-1 justify-center" onClick={() => void oynat(o)}>
                    Yayında oynat
                  </Buton>
                  <Buton ton="ikincil" onClick={() => setDuzen({ ...o })}>
                    Düzenle
                  </Buton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Kart>

      {duzen && (
        <Kart baslik={duzen.id ? `Düzenle: ${duzen.ad}` : 'Yeni ses / video'} sag={<Buton ton="sade" onClick={() => setDuzen(null)}><X className="w-3.5 h-3.5" /></Buton>}>
          <div className="grid gap-3 md:grid-cols-3">
            <Alan etiket="Ad">
              <Girdi value={duzen.ad ?? ''} maxLength={60} onChange={(e) => setDuzen({ ...duzen, ad: e.target.value })} />
            </Alan>
            <Alan etiket="Sohbet adı" ipucu={`Sohbette: !ses ${sohbetAdi(duzen.komut || duzen.ad || '') || '…'}`}>
              <Girdi value={duzen.komut ?? ''} placeholder="(addan üretilir)" onChange={(e) => setDuzen({ ...duzen, komut: e.target.value })} />
            </Alan>
            <Alan etiket="Ses ya da video">
              <div className="flex gap-2">
                <Girdi readOnly value={medyaAdi(duzen.medyaId ?? null)} />
                <Buton ton="ikincil" onClick={() => setSecici('medya')}>Seç</Buton>
              </div>
            </Alan>
            <Alan etiket="Görsel / GIF (yalnız ses için, isteğe bağlı)">
              <div className="flex gap-2">
                <Girdi readOnly value={duzen.gorselId ? medyaAdi(duzen.gorselId) : 'yok'} />
                <Buton ton="ikincil" onClick={() => setSecici('gorsel')}>Seç</Buton>
                {duzen.gorselId && (
                  <Buton ton="sade" onClick={() => setDuzen({ ...duzen, gorselId: null })}>
                    <X className="w-3.5 h-3.5" />
                  </Buton>
                )}
              </div>
            </Alan>
            <Alan etiket={`Ses düzeyi: %${duzen.ses ?? 80}`}>
              <input type="range" min={0} max={100} value={duzen.ses ?? 80} onChange={(e) => setDuzen({ ...duzen, ses: Number(e.target.value) })} className="w-full" />
            </Alan>
            <Alan etiket="En uzun süre (sn)" ipucu="0 = genel sınır">
              <Girdi type="number" min={0} max={120} value={duzen.maksSureSn ?? 0} onChange={(e) => setDuzen({ ...duzen, maksSureSn: Number(e.target.value) })} />
            </Alan>
            <Alan etiket="Bedel (bot puanı)">
              <Girdi type="number" min={0} value={duzen.maliyet ?? 100} onChange={(e) => setDuzen({ ...duzen, maliyet: Number(e.target.value) })} />
            </Alan>
            <Alan etiket="Bekleme (sn, herkes için)">
              <Girdi type="number" min={0} value={duzen.beklemeSn ?? 10} onChange={(e) => setDuzen({ ...duzen, beklemeSn: Number(e.target.value) })} />
            </Alan>
            <Alan etiket="Kişi başı bekleme (sn)">
              <Girdi type="number" min={0} value={duzen.kullaniciBeklemeSn ?? 30} onChange={(e) => setDuzen({ ...duzen, kullaniciBeklemeSn: Number(e.target.value) })} />
            </Alan>
            <Alan etiket="Kimler oynatabilir">
              <Secim
                value={duzen.yetki ?? 'herkes'}
                secenekler={[
                  { value: 'herkes', label: 'Herkes' },
                  { value: 'abone', label: 'Aboneler ve VIP' },
                  { value: 'mod', label: 'Yalnız moderatörler' }
                ]}
                onChange={(e) => setDuzen({ ...duzen, yetki: e.target.value as Oge['yetki'] })}
              />
            </Alan>
            <Alan etiket="Rastgele kova" ipucu="Kovadaki sesler !ses <kova adı> ile rastgele çalar">
              <Secim value={duzen.kovaId ?? ''} secenekler={kovaSecenekleri} onChange={(e) => setDuzen({ ...duzen, kovaId: e.target.value || null })} />
            </Alan>
            <Alan etiket="Kovadaki ağırlık (1–100)">
              <Girdi type="number" min={1} max={100} value={duzen.agirlik ?? 1} onChange={(e) => setDuzen({ ...duzen, agirlik: Number(e.target.value) })} />
            </Alan>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Anahtar acik={duzen.etkin !== false} onChange={(v) => setDuzen({ ...duzen, etkin: v })} etiket="Etkin" />
            <Buton onClick={() => void kaydet()} disabled={!duzen.ad || !duzen.medyaId}>
              Kaydet
            </Buton>
          </div>
          {secici && (
            <div className="mt-3 rounded-xl border border-white/10 p-2">
              <div className="mb-2 text-[11px] font-bold text-gray-300">{secici === 'medya' ? 'Ses ya da video seçin' : 'Görsel / GIF seçin'} (yeni dosyayı da buradan yükleyebilirsiniz)</div>
              <MediaLibrary
                onSec={(m) => {
                  if (secici === 'medya' && m.tur === 'image') return toast('Bu alan ses ya da video ister', 'hata');
                  if (secici === 'gorsel' && m.tur !== 'image') return toast('Bu alan görsel/GIF ister', 'hata');
                  setDuzen((x) => (x ? (secici === 'medya' ? { ...x, medyaId: m.id, ad: x.ad || m.ad.replace(/\.[^.]+$/, '') } : { ...x, gorselId: m.id }) : x));
                  setSecici(null);
                }}
              />
            </div>
          )}
        </Kart>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Kart baslik="Rastgele kovalar" aciklama="!ses <kova adı>: kovadaki seslerden biri ağırlığına göre rastgele çalar">
          <div className="space-y-2">
            {d.kovalar.map((k) => (
              <div key={k.id} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-sm text-white">
                <span>
                  🎲 {k.ad} <span className="text-gray-400">· !ses {k.komut} · {k.maliyet} puan · {d.ogeler.filter((o) => o.kovaId === k.id).length} ses</span>
                </span>
                <Buton ton="sade" onClick={() => void istek(`/api/pano/kova/${k.id}`, 'DELETE').then(yukle)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Buton>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_90px_90px_auto] gap-2">
              <Girdi placeholder="Kova adı" value={yeniKova.ad} onChange={(e) => setYeniKova({ ...yeniKova, ad: e.target.value })} />
              <Girdi type="number" title="Bedel" value={yeniKova.maliyet} onChange={(e) => setYeniKova({ ...yeniKova, maliyet: Number(e.target.value) })} />
              <Girdi type="number" title="Bekleme (sn)" value={yeniKova.beklemeSn} onChange={(e) => setYeniKova({ ...yeniKova, beklemeSn: Number(e.target.value) })} />
              <Buton
                disabled={!yeniKova.ad.trim()}
                onClick={() =>
                  void istek('/api/pano/kova', 'POST', yeniKova).then(
                    () => (setYeniKova({ ad: '', maliyet: 50, beklemeSn: 10 }), yukle()),
                    (e) => toast(e.message, 'hata')
                  )
                }
              >
                Ekle
              </Buton>
            </div>
          </div>
        </Kart>

        <Kart baslik="Giriş sesleri" aciklama="İzleyicinin günün ilk mesajında kendi sesi çalar (ücretsiz)" sag={<Anahtar acik={a.girisSesleri} onChange={(v) => void ayarYaz({ girisSesleri: v })} />}>
          <div className="space-y-2">
            {d.girisSesleri.map((g) => (
              <div key={g.kullanici} className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 text-sm text-white">
                <span>
                  {g.kullanici} <span className="text-gray-400">→ {d.ogeler.find((o) => o.id === g.ogeId)?.ad ?? '?'}</span>
                </span>
                <Buton ton="sade" onClick={() => void istek('/api/pano/giris', 'POST', { kullanici: g.kullanici, ogeId: null }).then(yukle)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Buton>
              </div>
            ))}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Girdi placeholder="Kullanıcı adı" value={giris.kullanici} onChange={(e) => setGiris({ ...giris, kullanici: e.target.value })} />
              <Secim value={giris.ogeId} secenekler={[{ value: '', label: 'Ses seçin' }, ...d.ogeler.map((o) => ({ value: o.id, label: o.ad }))]} onChange={(e) => setGiris({ ...giris, ogeId: e.target.value })} />
              <Buton
                disabled={!giris.kullanici.trim() || !giris.ogeId}
                onClick={() =>
                  void istek('/api/pano/giris', 'POST', giris).then(
                    () => (setGiris({ kullanici: '', ogeId: '' }), yukle()),
                    (e) => toast(e.message, 'hata')
                  )
                }
              >
                Ekle
              </Buton>
            </div>
          </div>
        </Kart>
      </div>

      <Kart baslik="Ayarlar">
        <div className="grid gap-3 md:grid-cols-4">
          <Alan etiket="Genel bekleme (sn)" ipucu="İki istek arası en az süre">
            <Girdi type="number" min={0} defaultValue={a.genelBeklemeSn} onBlur={(e) => void ayarYaz({ genelBeklemeSn: Number(e.target.value) })} />
          </Alan>
          <Alan etiket="Sıra sınırı">
            <Girdi type="number" min={1} max={100} defaultValue={a.kuyrukSiniri} onBlur={(e) => void ayarYaz({ kuyrukSiniri: Number(e.target.value) })} />
          </Alan>
          <Alan etiket="En uzun oynatma (sn)">
            <Girdi type="number" min={1} max={120} defaultValue={a.maksSureSn} onBlur={(e) => void ayarYaz({ maksSureSn: Number(e.target.value) })} />
          </Alan>
          <Alan etiket="Katman konumu">
            <Secim
              value={a.gorunum.konum}
              secenekler={(Object.keys(KONUM_ADLARI) as PanoKonum[]).map((k) => ({ value: k, label: KONUM_ADLARI[k] }))}
              onChange={(e) => void ayarYaz({ gorunum: { ...a.gorunum, konum: e.target.value as PanoKonum } })}
            />
          </Alan>
          <Alan etiket={`Katman genişliği: %${a.gorunum.genislikYuzde}`}>
            <input type="range" min={10} max={100} defaultValue={a.gorunum.genislikYuzde} onMouseUp={(e) => void ayarYaz({ gorunum: { ...a.gorunum, genislikYuzde: Number((e.target as HTMLInputElement).value) } })} className="w-full" />
          </Alan>
          <div className="flex flex-col gap-2 pt-5">
            <Anahtar acik={a.gorunum.adGoster} onChange={(v) => void ayarYaz({ gorunum: { ...a.gorunum, adGoster: v } })} etiket="Kim oynattı yazısı" />
            <Anahtar acik={a.modlarUcretsiz} onChange={(v) => void ayarYaz({ modlarUcretsiz: v })} etiket="Mod ve yayıncı ücretsiz" />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-gray-500">
          Platform kanal puanı ödülleri bu sürümde bağlı değil: Kick ödül olayı yalnız webhook'la gelir (herkese açık adres gerekir), Twitch için
          EventSub gerekir. İzleyiciler bot puanıyla (!ses) oynatır.
        </p>
      </Kart>

      <Kart baslik="Son istekler">
        {gecmis.length === 0 ? (
          <BosDurum baslik="Henüz istek yok" />
        ) : (
          <div className="max-h-64 overflow-auto text-[12px] text-gray-300">
            {gecmis.map((g) => (
              <div key={g.id} className="flex justify-between border-b border-white/5 py-1">
                <span>
                  {g.kullanici} → <b className="text-white">{g.ad}</b> <span className="text-gray-500">({g.kaynak})</span>
                </span>
                <span className="text-gray-500">
                  {g.maliyet ? `${g.maliyet} puan · ` : ''}
                  {new Date(g.zaman).toLocaleTimeString('tr-TR')}
                </span>
              </div>
            ))}
          </div>
        )}
      </Kart>

      <Kart baslik="Medya kütüphanesi" aciklama="Kendi ses (MP3/WAV/OGG, 5 MB) ve videolarını (MP4/WEBM, 30 MB) yükle">
        <MediaLibrary />
      </Kart>
    </div>
  );
}
