/**
 * Widget ayarları penceresinde canlı önizleme: widget'ın gerçek OBS sayfası 1280×720 iframe'de
 * açılır. Ayarlar kendiliğinden kaydedilip yayınlandığı için önizleme her değişiklikte güncellenir.
 *
 * - "Yakınlaş" (varsayılan): widget'ın görünen kısmı kutuya sığacak kadar büyütülür (en çok 1,6 kat;
 *   3 kat büyütme bulanık ve taşkın görünüyordu). Odak alanı yalnız büyür: her yeni sohbet iletisi ya da
 *   animasyon karesiyle yeniden ölçülüp sürekli kayan, titreyen önizleme düzeldi.
 * - "Test et": önizleme canlı kipe geçer (örnek kip olayları dinlemez), sonra test gönderilir.
 */
import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Play, Maximize2, Minimize2 } from 'lucide-react';

const GENISLIK = 1280;
const YUKSEKLIK = 720;

/** Görünen öğelerin kapsadığı alan (iframe içi, aynı köken) */
export function icerikKutusu(d: Document): { x: number; y: number; w: number; h: number } | null {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const e of Array.from(d.querySelectorAll('#root *'))) {
    if ((e as HTMLElement).closest('[data-odak-disi]')) continue;
    const r = (e as HTMLElement).getBoundingClientRect();
    // Tuval boyu kutular (sohbet satırları, tam ekran sarmalayıcılar) atlanır: yalnız içerikleri ölçülür,
    // yoksa sohbet gibi widget'larda odak tüm tuval olup yazı okunmayacak kadar küçülüyordu
    if (r.width < 2 || r.height < 2 || r.width >= GENISLIK * 0.9 || r.height >= YUKSEKLIK * 0.9) continue;
    if (r.right <= 0 || r.bottom <= 0 || r.left >= GENISLIK || r.top >= YUKSEKLIK) continue;
    x1 = Math.min(x1, Math.max(0, r.left));
    y1 = Math.min(y1, Math.max(0, r.top));
    x2 = Math.max(x2, Math.min(GENISLIK, r.right));
    y2 = Math.max(y2, Math.min(YUKSEKLIK, r.bottom));
  }
  return x2 > x1 && y2 > y1 ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : null;
}

type Kutu = { x: number; y: number; w: number; h: number };

/** Görünen öğelerin sağ ve alt sınırı (sayfa kendi boyutundan taşıyorsa önizleme büyütülsün) */
export function icerikSiniri(d: Document): { w: number; h: number } | null {
  let w = 0;
  let h = 0;
  for (const e of Array.from(d.querySelectorAll('#root *'))) {
    if ((e as HTMLElement).closest('[data-odak-disi]')) continue;
    const r = (e as HTMLElement).getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    w = Math.max(w, Math.ceil(r.right));
    h = Math.max(h, Math.ceil(r.bottom));
  }
  return w > 0 && h > 0 ? { w, h } : null;
}

/** İki alanı kapsayan alan; değişmediyse aynı nesne (gereksiz çizim olmasın) */
export function kapsa(a: Kutu, b: Kutu): Kutu {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.max(a.x + a.w, b.x + b.w) - x;
  const h = Math.max(a.y + a.h, b.y + b.h) - y;
  return x === a.x && y === a.y && w === a.w && h === a.h ? a : { x, y, w, h };
}

/** Önizleme kutusunun yüksekliği sınırları (px) */
const KUTU_EN_AZ = 150;
const KUTU_EN_COK = 420;

/**
 * `boyut`: widget'ın OBS'teki (Tek URL katmanı) boyutu. Verilirse önizleme sayfayı o boyutta açar:
 * ekranı kaplayan widget'lar 1280 piksele yayılıp küçülmez, OBS'teki gibi görünür.
 */
export function WidgetOnizleme({ url, testAdi, boyut }: { url: string; testAdi?: string; boyut?: { w: number; h: number } }) {
  const kutu = useRef<HTMLDivElement>(null);
  const cerceve = useRef<HTMLIFrameElement>(null);
  const [genislik, setGenislik] = useState(540);
  const [anahtar, setAnahtar] = useState(0);
  const [canli, setCanli] = useState(false);
  const [yakin, setYakin] = useState(true);
  // Widget boyutu (varsayılan) ya da tüm tuval
  const [tuval, setTuval] = useState(!boyut);
  // Widget boyutunda içerik kaynağa sığmıyorsa (açılan bildirim, kurallar satırı) önizleme o kadar büyür
  const [tasma, setTasma] = useState<{ w: number; h: number } | null>(null);
  const [odak, setOdak] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [durum, setDurum] = useState('');

  useEffect(() => {
    const el = kutu.current;
    if (!el) return;
    const g = new ResizeObserver(() => setGenislik(el.clientWidth));
    g.observe(el);
    return () => g.disconnect();
  }, []);

  // İçerik değiştikçe (ayar, test olayı) odak alanı ölçülür; yalnız büyür ki önizleme titremesin
  useEffect(() => {
    setOdak(null);
    setTasma(null);
    const t = setInterval(() => {
      try {
        const d = cerceve.current?.contentDocument;
        const yeni = d ? icerikKutusu(d) : null;
        if (yeni) setOdak((o) => (o ? kapsa(o, yeni) : yeni));
        const sinir = d ? icerikSiniri(d) : null;
        if (sinir) setTasma((o) => (o && o.w >= sinir.w && o.h >= sinir.h ? o : { w: Math.max(o?.w || 0, sinir.w), h: Math.max(o?.h || 0, sinir.h) }));
      } catch {
        /* çerçeve yükleniyor */
      }
    }, 700);
    return () => clearInterval(t);
  }, [anahtar]);

  const adres = (() => {
    try {
      const u = new URL(url, window.location.origin);
      if (!canli) u.searchParams.set('preview', '1');
      return u.pathname + u.search;
    } catch {
      return url;
    }
  })();

  const W = !tuval && boyut ? Math.min(GENISLIK, Math.max(200, boyut.w, tasma?.w || 0)) : GENISLIK;
  const H = !tuval && boyut ? Math.min(YUKSEKLIK * 1.5, Math.max(60, boyut.h, tasma?.h || 0)) : YUKSEKLIK;
  const yukseklik = tuval ? Math.round((genislik * YUKSEKLIK) / GENISLIK) : Math.min(KUTU_EN_COK, Math.max(KUTU_EN_AZ, Math.round((genislik * H) / W)));
  // Widget boyutunda: sayfa kutuya sığar ve ortalanır (en çok 2 kat). Tüm tuvalde: içeriğe yakınlaşır (en çok 1,6 kat)
  const tamOlcek = tuval ? genislik / GENISLIK : Math.min(2, genislik / W, yukseklik / H);
  let olcek = tamOlcek;
  let tx = tuval ? 0 : (genislik - W * olcek) / 2;
  let ty = tuval ? 0 : (yukseklik - H * olcek) / 2;
  if (tuval && yakin && odak) {
    const pay = 1.16;
    olcek = Math.min(1.6, Math.max(tamOlcek, Math.min(genislik / (odak.w * pay), yukseklik / (odak.h * pay))));
    tx = genislik / 2 - (odak.x + odak.w / 2) * olcek;
    ty = yukseklik / 2 - (odak.y + odak.h / 2) * olcek;
  }

  const test = async () => {
    if (!testAdi) return;
    setDurum('Canlı kipe geçiliyor…');
    if (!canli) {
      setCanli(true);
      setAnahtar((k) => k + 1);
      // Canlı sayfa yüklenip WebSocket'e bağlansın. Eskiden sabit 1,8 sn beklenirdi: yavaş açılışta
      // (gömülü panel, ilk yükleme) olay widget dinlemeye başlamadan gidip kayboluyordu.
      await new Promise((r) => setTimeout(r, 300));
      for (let i = 0; i < 40; i++) {
        const w = cerceve.current?.contentWindow as (Window & { __axtSoketAcik?: boolean }) | null | undefined;
        try {
          if (w?.__axtSoketAcik && w.location.search.indexOf('preview=1') < 0) break;
        } catch {
          /* çerçeve yükleniyor */
        }
        await new Promise((r) => setTimeout(r, 200));
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    try {
      await fetch(`/api/widgets/test/${testAdi}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      setDurum('Test gönderildi (OBS kaynakları da görür)');
    } catch {
      setDurum('Test gönderilemedi');
    }
    setTimeout(() => setDurum(''), 3500);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-black uppercase tracking-wider text-cyan-300">
          {canli ? 'Canlı görünüm' : 'Örnek görünüm'}
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {testAdi && (
            <button type="button" onClick={() => void test()} className="text-[10px] px-2 py-1 rounded-lg bg-emerald-600/80 text-white font-bold flex items-center gap-1">
              <Play className="w-3 h-3" /> Test et
            </button>
          )}
          <button
            type="button"
            onClick={() => { setCanli((c) => !c); setAnahtar((k) => k + 1); }}
            className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-gray-200 font-bold"
            title="Örnek: hazır örnek veri · Canlı: gerçek durum ve test olayları"
          >
            {canli ? 'Örneğe dön' : 'Canlı'}
          </button>
          {boyut ? (
            <button type="button" onClick={() => { setTuval((t) => !t); setAnahtar((k) => k + 1); }} className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-gray-200 font-bold flex items-center gap-1" title="Widget boyutu: OBS'teki kaynak boyutu · Tüm tuval: 1280×720 sahne">
              {tuval ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />} {tuval ? 'Widget boyutu' : 'Tüm tuval'}
            </button>
          ) : (
            <button type="button" onClick={() => setYakin((y) => !y)} className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-gray-200 font-bold flex items-center gap-1">
              {yakin ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />} {yakin ? 'Tüm tuval' : 'Yakınlaş'}
            </button>
          )}
          <button type="button" onClick={() => setAnahtar((k) => k + 1)} className="text-[10px] px-2 py-1 rounded-lg bg-white/10 text-gray-200 font-bold flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Yenile
          </button>
        </div>
      </div>
      <div
        ref={kutu}
        className="relative w-full overflow-hidden rounded-xl border border-white/10"
        style={{
          height: yukseklik,
          // Saydam widget'lar dama desenli zeminde görünsün (OBS'teki gibi arkası boş)
          background: 'repeating-conic-gradient(#1f2430 0% 25%, #151821 0% 50%) 50% / 24px 24px'
        }}
      >
        <iframe
          ref={cerceve}
          key={anahtar}
          src={adres}
          title="Widget önizleme"
          style={{ width: W, height: H, transform: `translate(${tx}px, ${ty}px) scale(${olcek})`, transformOrigin: '0 0', border: 0, background: 'transparent', transition: 'transform .25s ease' }}
          allowTransparency
        />
      </div>
      {durum ? (
        <p className="text-[10px] text-emerald-400">{durum}</p>
      ) : (
        <p className="text-[10px] text-gray-500">Ayar değişince önizleme kendiliğinden güncellenir. "Test et" önizlemeyi canlı kipe alıp örnek olay gönderir.</p>
      )}
    </div>
  );
}

export default WidgetOnizleme;
