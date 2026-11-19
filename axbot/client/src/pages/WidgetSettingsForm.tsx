/**
 * AxBoT widget settings
 * Developed by AxthrowA
 */
import { SesKirpma } from '../components/SesKirpma';
import { KatmanBaglantisi } from '../components/KatmanBaglantisi.js';
import { useEffect, useRef, useState } from 'react';
import { Save } from 'lucide-react';
import { FONTS, WIDGET_DEFAULTS } from '../lib/widget-defaults.js';
import { yaziAilesi } from '../lib/widget-style.js';
import { EKRAN_EFEKTLERI, kutla } from '../lib/kutlama.js';
import { eskiHareketiCevir } from '../lib/animations.js';
import { temalar, temayiUygula } from '../lib/themes.js';
import { UyariOlayMedyasi } from '../components/UyariOlayMedyasi.js';
import { SosyalHesapPaneli, SponsorPaneli } from '../components/DonenWidgetPanelleri.js';
import { SabitMesajPaneli, SkorTablosuPaneli, SohbetIstatistikPaneli } from '../components/SohbetAraclariPaneli.js';
import { MediaLibrary } from '../components/MediaLibrary.js';
import { Anahtar, Katlanir, Secim } from '../ui/index.js';
import { YaziTipiSecici } from '../components/YaziTipiSecici.js';
import { LABELS, SECTIONS, SELECTS, WIDGET_SELECTS } from './widgetAyarSozlugu';

/**
 * Widget'a özel bölüm adları. Küresel tabloda `title` "Hedef" (hedef
 * widget'larından kalma), `size` "Combo" ve `showTimer` "Çekiliş" demek;
 * bu adlar sıralama, kupa veya tren ayarlarının üstünde yanlış duruyordu.
 */
const WIDGET_SECTIONS: Record<string, Record<string, string>> = {
  rankings: { title: 'Genel' },
  'the-cup': { title: 'Genel' },
  'hype-train': { title: 'Genel', showTimer: 'Düzen' },
  'end-credits': { title: 'Genel' },
  king: { title: 'Genel' },
  subathon: { title: 'Genel', theme: 'Görünüm', kabuk: 'Görünüm', icon: 'Görünüm', timeFontFamily: 'Tipografi', timeFontSize: 'Tipografi', showRules: 'Düzen', showStatus: 'Durum kartı', statusLiveText: 'Durum kartı', statusPausedText: 'Durum kartı', statusIdleText: 'Durum kartı', statusFontSize: 'Durum kartı', totalAddedLabel: 'Durum kartı' },
  'viewer-counter': { title: 'Genel' },
  trivia: { title: 'Genel' },
  'wheel-of-fortune': { size: 'Görünüm', palette: 'Görünüm' },
  'audio-player': { label: 'Genel' },
  sayac: { sayacAdi: 'Genel', etiket: 'Genel', simge: 'Genel', hedef: 'Genel', sifirdaGizle: 'Görünürlük', duzen: 'Düzen', artisAnimasyonu: 'Animasyon' },
  'izleyici-sirasi': { title: 'Genel', katilmaKomutu: 'Genel', enCok: 'Düzen', platformGoster: 'Düzen', genislik: 'Düzen', kapaliysaGizle: 'Görünürlük', bosGizle: 'Görünürlük' },
  'geri-sayim': { varsayilanBaslik: 'Genel', bitinceMetin: 'Genel', bitinceGosterSn: 'Genel', bosGizle: 'Görünürlük', cubukGoster: 'Düzen', sifirliDakika: 'Düzen', sesAcik: 'Ses', sesDuzeyi: 'Ses' },
  'atla-oyunu': {
    boyut: 'Karakter', avatarKullan: 'Karakter', parasutRengi: 'Karakter', adGoster: 'Karakter', adRengi: 'Karakter', inisteKalmaSn: 'Karakter',
    hedefGenislik: 'Hedef', hedefTema: 'Hedef', hedefGorseli: 'Hedef', zeminPayi: 'Hedef', hedefTasi: 'Hedef', hedefGizleSn: 'Hedef',
    yercekimi: 'Fizik', ruzgar: 'Fizik', inisHizi: 'Fizik', carpisma: 'Fizik',
    tamIsabetKutlama: 'Efektler', sesAcik: 'Ses', sesDuzeyi: 'Ses',
    ruzgarGoster: 'Görünüm', skorTablosu: 'Görünüm', skorTablosuKonum: 'Görünüm',
    beklemeSn: 'Oyun kuralları', enCokHavada: 'Oyun kuralları', puanCarpani: 'Oyun kuralları', iskaDuyur: 'Oyun kuralları', topluSn: 'Oyun kuralları'
  }
};

/** Önce widget'ın işi, sonra görünümü: listede olmayan bölümler ikisinin arasına girer */
const ILK_BOLUMLER = ['Genel', 'Oyun kuralları', 'Karakter', 'Hedef', 'Fizik', 'Hedef', 'Çekiliş', 'Komut', 'Kontrol', 'Sıralama', 'Kupa', 'Tren', 'Puanlar', 'Bölümler', 'Combo', 'Olaylar', 'Medya', 'Ses', 'Metin', 'Şablon', 'Zamanlama'];
const SON_BOLUMLER = ['Platformlar', 'Düzen', 'Görünürlük', 'Tema', 'Görünüm', 'Tipografi', 'Animasyon', 'Efektler', 'Parçalar', 'İkonlar', 'Emojiler', 'Gelişmiş'];
const BOLUM_ACIKLAMASI: Record<string, string> = {
  Platformlar: 'Hangi platformlar görünsün',
  Düzen: 'Ne gösterilsin, nasıl dizilsin',
  Görünürlük: 'Ne zaman gizlensin',
  Görünüm: 'Renk, köşe, kutu tasarımı',
  Tipografi: 'Yazı tipi ve boyutu',
  Animasyon: 'Giriş, çıkış ve hareket',
  Parçalar: 'Başlık, rakam, bar, dolgu ve simge ayrı ayrı canlanır',
  Gelişmiş: 'Nadiren gereken ayarlar'
};
function bolumSirasi(b: string): number {
  const i = ILK_BOLUMLER.indexOf(b);
  if (i >= 0) return i;
  const j = SON_BOLUMLER.indexOf(b);
  return j >= 0 ? 100 + j : 50;
}

/**
 * Galeri kimliği ile ayar kimliği aynı olmayan widget'lar. CloudTTS ile TTS
 * aynı ses oynatıcıyı, "Ekranda Emojiler" ile Emote Combo aynı bileşeni,
 * "Trivia Quiz" ise Bil Bakalım'ı açıyor — ayarları da ortak olmalı. Eskiden
 * bu kimliklerin WIDGET_DEFAULTS karşılığı yoktu ve pencere boş açılıyordu.
 */
const AYAR_TAKMA: Record<string, string> = {
  'cloud-tts': 'audio-player',
  tts: 'audio-player',
  'trivia-quiz': 'trivia'
};

export const PATH_MAP: Record<string, string> = {
  'chat-overlay': '/widgets/chatbox',
  'alert-box': '/widgets/alertbox',
  'activity-feed': '/widgets/activity-feed',
  'cloud-tts': '/widgets/audio-player',
  tts: '/widgets/audio-player',
  'donation-goal': '/widgets/donation-goal',
  'follower-goal': '/widgets/follower-goal',
  'subscriber-goal': '/widgets/subscriber-goal',
  'kicks-goal': '/widgets/kicks-goal',
  'emote-combo': '/widgets/emote-combo',
  'on-screen-emotes': '/widgets/emotes',
  'atla-oyunu': '/widgets/atla-oyunu',
  sayac: '/widgets/sayac',
  'izleyici-sirasi': '/widgets/izleyici-sirasi',
  'geri-sayim': '/widgets/geri-sayim',
  'event-labels': '/widgets/event-labels',
  subathon: '/widgets/subathon',
  'the-cup': '/widgets/the-cup',
  'word-cloud': '/widgets/word-cloud',
  scoreboard: '/widgets/scoreboard',
  'viewer-counter': '/widgets/viewer-counter',
  shoutout: '/widgets/shoutout',
  polls: '/widgets/polls',
  'hype-train': '/widgets/hype-train',
  'pinned-messages': '/widgets/pinned',
  'social-rotator': '/widgets/socials',
  'sponsor-banner': '/widgets/sponsor',
  'end-credits': '/widgets/credits',
  'wheel-of-fortune': '/widgets/wheel',
  'trivia-quiz': '/widgets/trivia',
  giveaways: '/widgets/giveaways',
  'loyalty-redemptions': '/widgets/loyalty-redeem',
  rankings: '/widgets/rankings',
  lyrics: '/widgets/lyrics',
  king: '/widgets/king',
  jumpscare: '/widgets/jumpscare',
  'audio-player': '/widgets/audio-player',
  trivia: '/widgets/trivia'
};

export function secenekler(widgetId: string, key: string) {
  return WIDGET_SELECTS[widgetId]?.[key] || SELECTS[key];
}

function inferType(key: string, value: any, widgetId = ''): 'text' | 'textarea' | 'number' | 'checkbox' | 'color' | 'select' | 'range' {
  if (secenekler(widgetId, key)) return 'select';
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') {
    if (key.toLowerCase().includes('opacity') || key.toLowerCase().includes('volume')) return 'range';
    return 'number';
  }
  // Türkçe adlı renkler (adRengi …) de renk seçici; boş değer "otomatik" demek, yazı alanı kalır
  if (key.toLowerCase().includes('color') || (/Rengi$/.test(key) && String(value || '').startsWith('#'))) return 'color';
  if (key.toLowerCase().includes('template') || key === 'ignoreList' || key === 'ozelCss' || key === 'ozelSablon') return 'textarea';
  return 'text';
}

/** Çark dilimleri ve orta görsel: düz alan olmadıkları için formdan ayrı */
function CarkPaneli({ values, degistir }: { values: Record<string, any>; degistir: (p: Record<string, any>) => void }) {
  const [kutuphane, setKutuphane] = useState(false);
  const dilimler: Array<{ label: string; color: string; weight?: number }> = values.segments || [];
  const dilimYaz = (i: number, p: Record<string, any>) => degistir({ segments: dilimler.map((d, j) => (j === i ? { ...d, ...p } : d)) });
  return (
    <div className="space-y-3 p-3 rounded-xl border border-white/10 bg-black/20">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white">Orta görsel / GIF</span>
          <div className="flex gap-1.5">
            <button type="button" onClick={() => setKutuphane((a) => !a)} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white">
              {kutuphane ? 'Kapat' : 'Kütüphaneden seç / yükle'}
            </button>
            {values.centerImageUrl && (
              <button type="button" onClick={() => degistir({ centerImageUrl: '' })} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-300">
                Kaldır
              </button>
            )}
          </div>
        </div>
        <input
          aria-label="Orta görsel adresi"
          value={values.centerImageUrl || ''}
          onChange={(e) => degistir({ centerImageUrl: e.target.value.trim() })}
          placeholder="ya da görsel/GIF adresi yapıştırın (https://…)"
          className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white"
        />
        {values.centerImageUrl && <img src={values.centerImageUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-white/20" />}
        {kutuphane && (
          <MediaLibrary
            onSec={(m) => {
              if (m.tur !== 'image') return;
              degistir({ centerImageUrl: m.url });
              setKutuphane(false);
            }}
          />
        )}
      </div>
      <div className="space-y-1.5">
        <span className="text-xs font-bold text-white">Dilimler</span>
        {dilimler.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input aria-label="Dilim rengi" type="color" value={d.color} onChange={(e) => dilimYaz(i, { color: e.target.value })} className="w-7 h-7 bg-transparent cursor-pointer shrink-0" />
            <input aria-label="Dilim adı" value={d.label} onChange={(e) => dilimYaz(i, { label: e.target.value })} className="flex-1 min-w-0 bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white" />
            <input aria-label="Dilim ağırlığı" title="Ağırlık: büyük değer daha sık çıkar" type="number" min={0} value={d.weight ?? 1} onChange={(e) => dilimYaz(i, { weight: Math.max(0, Number(e.target.value) || 0) })} className="w-14 bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white" />
            <button type="button" aria-label="Dilimi sil" disabled={dilimler.length <= 2} onClick={() => degistir({ segments: dilimler.filter((_, j) => j !== i) })} className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-300 disabled:opacity-30">
              ×
            </button>
          </div>
        ))}
        <button type="button" onClick={() => degistir({ segments: [...dilimler, { label: `Dilim ${dilimler.length + 1}`, color: '#8b5cf6', weight: 1 }] })} className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-bold text-white">
          + Dilim ekle
        </button>
      </div>
    </div>
  );
}

export function WidgetSettingsForm({ widgetId, baseUrl, onUrlChange, autoSave = true }: { widgetId: string; baseUrl: string; onUrlChange?: (url: string) => void; autoSave?: boolean }) {
  /** Kaydın kimliği; ek hedef çubuğunda `follower-goal-2` gibi. Varsayılan, tema ve bölümler taban kimlikten gelir. */
  const kayitId = AYAR_TAKMA[widgetId] || widgetId;
  const hedefNo = kayitId.match(/-goal-(\d+)$/)?.[1];
  const ayarId = hedefNo ? kayitId.replace(/-\d+$/, '') : kayitId;
  const yol = (PATH_MAP[widgetId] || PATH_MAP[ayarId] || '') + (hedefNo ? `?hedef=${hedefNo}` : '');
  const defaults = WIDGET_DEFAULTS[ayarId] || {};
  const keys = Object.keys(defaults).filter(k => typeof defaults[k] !== 'object' || defaults[k] === null);
  const [values, setValues] = useState<Record<string, any>>(defaults);
  const [status, setStatus] = useState('');
  const [ara, setAra] = useState('');
  // WID-3: tema uygulanmadan önceki ayarlar (art arda tema denense de ilk duruma döner)
  const [temaOncesi, setTemaOncesi] = useState<{ degerler: Record<string, any>; tema: string } | null>(null);

  useEffect(() => {
    setTemaOncesi(null);
    fetch(`/api/widgets/${kayitId}/settings`)
      .then(r => r.json())
      .then(d => { ilkDeger.current = true; sonKayit.current = { ...defaults, ...d }; setValues(eskiHareketiCevir({ ...defaults, ...d })); })
      .catch(() => { ilkDeger.current = true; sonKayit.current = { ...defaults }; setValues(defaults); });
  }, [kayitId]);

  const buildUrl = (next = values) => {
    const qs = new URLSearchParams(hedefNo ? { hedef: hedefNo } : {});
    Object.entries(next).forEach(([k, v]) => {
      if (typeof v === 'object') return;
      if (typeof v === 'boolean') qs.set(k, v ? '1' : '0');
      else if (v !== undefined && v !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return `${baseUrl}${PATH_MAP[widgetId] || PATH_MAP[ayarId] || '/widgets/alertbox'}${q ? `?${q}` : ''}`;
  };

  const save = async (veri: Record<string, any> = values) => {
    // Yalnız değişen ayarlar gönderilir (sunucu birleştirir). Eskiden hepsi gönderiliyordu: pencere açıkken
    // sunucu hedefin "Mevcut" değerini artırınca, başka bir ayarı değiştirmek eski değeri geri yazıyordu.
    const fark = Object.fromEntries(Object.entries(veri).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(sonKayit.current[k])));
    if (Object.keys(fark).length) {
      await fetch(`/api/widgets/${kayitId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fark)
      });
      sonKayit.current = { ...sonKayit.current, ...fark };
    }
    onUrlChange?.(buildUrl(veri));
    setStatus('Ayarlar kaydedildi. Overlay anında güncellendi.');
    setTimeout(() => setStatus(''), 2500);
  };

  // Otomatik kaydetme: değişiklik 500 ms sonra sunucuya yazılır, sunucu da
  // `widget_settings` yayını yapar; OBS'teki katman anında güncellenir.
  // Eskiden yalnız "Kaydet" düğmesiyle uygulanıyordu.
  const ilkDeger = useRef(true);
  /** Sunucudaki son bilinen ayar (yalnız farkı göndermek için) */
  const sonKayit = useRef<Record<string, any>>({});
  useEffect(() => {
    if (!autoSave) return;
    if (ilkDeger.current) {
      ilkDeger.current = false;
      return;
    }
    const t = setTimeout(() => {
      void save(values).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, autoSave]);

  if (keys.length === 0) return null;

  const etiketi = (key: string) => (ayarId === 'emote-combo' && key === 'speed' ? 'Gelen emote hızı (1 normal, 0.5 yarı hız, 0.1 en yavaş)' : LABELS[key] || key);
  const aranan = ara.trim().toLocaleLowerCase('tr');
  const grouped = keys
    .filter(key => !aranan || etiketi(key).toLocaleLowerCase('tr').includes(aranan))
    .reduce((acc, key) => {
      const section = WIDGET_SECTIONS[ayarId]?.[key] || SECTIONS[key] || 'Genel';
      acc[section] = acc[section] || [];
      acc[section].push(key);
      return acc;
    }, {} as Record<string, string[]>);

  const sections = Object.keys(grouped).sort((x, y) => bolumSirasi(x) - bolumSirasi(y));
  // Aç/kapa anahtarları alanların altında toplanır: form taranabilir kalsın
  const anahtarSonda = (liste: string[]) => {
    const anahtarMi = (k: string) => inferType(k, values[k] ?? defaults[k], ayarId) === 'checkbox';
    return [...liste.filter(k => !anahtarMi(k)), ...liste.filter(anahtarMi)];
  };

  return (
    <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold text-gray-200 shrink-0">Widget Ayarları</h4>
        <KatmanBaglantisi yol={yol} />
        <input
          type="search"
          value={ara}
          onChange={e => setAra(e.target.value)}
          placeholder="Ayar ara…"
          aria-label="Ayar ara"
          className="w-40 min-w-0 bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
        />
      </div>

      {!aranan && (
        <>
      {/* Tema kutuphanesi — örnek alınan bot widget basina 13-28 tema sunuyor, bizde
          4-5 vardi. Tema, ayar degerlerinin hazir bir kumesidir: secilince
          ilgili alanlar dolar, kullanici sonra tek tek degistirebilir.
          Widget'in TANIMADIGI anahtarlar atlanir. */}
      <Katlanir baslik="Hazır temalar" sayi={temalar(ayarId).length} aciklama="Tek tıkla görünüm">
        {temaOncesi && (
          <div className="flex items-center justify-between gap-2 mb-2 rounded-lg bg-cyan-500/10 border border-cyan-400/30 px-2.5 py-1.5 text-xs text-cyan-100">
            <span>Uygulanan tema: <b>{temalar(ayarId).find(t => t.id === temaOncesi.tema)?.etiket}</b></span>
            <button type="button" onClick={() => { setValues(temaOncesi.degerler); setTemaOncesi(null); }} className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-white font-semibold">Temayı geri al</button>
          </div>
        )}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-60 overflow-y-auto pr-1">
          {temalar(ayarId).map(t => (
            <button
              key={t.id}
              type="button"
              title={t.etiket}
              onClick={() => {
                setTemaOncesi(o => ({ degerler: o?.degerler ?? values, tema: t.id }));
                setValues(v =>
                  temayiUygula(v, t, keys, (k, deger) => {
                    const sec = secenekler(ayarId, k);
                    return !sec || sec.some(o => o.value === deger);
                  }) as Record<string, any>
                );
              }}
              aria-pressed={temaOncesi?.tema === t.id}
              className={`rounded-lg border overflow-hidden text-left transition-colors ${temaOncesi?.tema === t.id ? 'border-cyan-400' : 'border-white/10 hover:border-cyan-400'}`}
            >
              <div
                className="h-7 flex items-center justify-center"
                style={{ background: t.onizleme.arka, borderBottom: `2px solid ${t.onizleme.vurgu}` }}
              >
                <span className="text-xs font-black" style={{ color: t.onizleme.metin, fontFamily: t.onizleme.yazi || (t.degerler.fontFamily ? yaziAilesi(String(t.degerler.fontFamily)) : undefined) }}>Aa</span>
              </div>
              <div className="px-1 py-0.5 text-xs text-gray-300 truncate">{t.etiket}</div>
            </button>
          ))}
        </div>
      </Katlanir>

      {ayarId === 'alert-box' && <UyariOlayMedyasi />}
      {/* Widget'a özel kontroller: galeri penceresinde ve Tek URL stüdyosunda aynı yerde */}
      {ayarId === 'pinned-messages' && <SabitMesajPaneli />}
      {ayarId === 'social-rotator' && <SosyalHesapPaneli values={values} degistir={(p) => setValues((v) => ({ ...v, ...p }))} />}
      {ayarId === 'sponsor-banner' && <SponsorPaneli values={values} degistir={(p) => setValues((v) => ({ ...v, ...p }))} />}
      {ayarId === 'word-cloud' && <SohbetIstatistikPaneli />}
      {ayarId === 'scoreboard' && <SkorTablosuPaneli />}
      {ayarId === 'wheel-of-fortune' && <CarkPaneli values={values} degistir={(p) => setValues((v) => ({ ...v, ...p }))} />}
        </>
      )}

      {aranan && !sections.length && <p className="text-xs text-gray-500">"{ara.trim()}" ile eşleşen ayar yok.</p>}

      {sections.map((section, sira) => (
        <Katlanir key={section + (aranan ? '-ara' : '')} baslik={section} sayi={grouped[section].length} aciklama={BOLUM_ACIKLAMASI[section]} acik={Boolean(aranan) || sira === 0}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {anahtarSonda(grouped[section]).map(key => {
              const type = inferType(key, values[key] ?? defaults[key], ayarId);
              const alan = (
                <label key={key} className={`text-xs text-gray-300 font-semibold ${type === 'checkbox' ? 'flex items-center justify-between gap-2 bg-white/5 rounded-lg px-2.5 py-2' : 'space-y-1'}`}>
                  <span>{etiketi(key)}</span>
                  {type === 'checkbox' ? (
                    <Anahtar acik={!!values[key]} onChange={(v) => setValues(v => ({ ...v, [key]: v }))} />
                  ) : type === 'select' && /fontfamily$/i.test(key) ? (
                    <YaziTipiSecici value={String(values[key] ?? '')} onChange={(v) => setValues((s) => ({ ...s, [key]: v }))} secenekler={secenekler(ayarId, key) || []} />
                  ) : type === 'select' ? (
                    <div className="flex items-center gap-1.5">
                      <Secim value={values[key] ?? ''} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} className="flex-1 min-w-0 w-full">
                        {(secenekler(ayarId, key) || []).map(o => <option key={o.value} value={o.value} style={/font/i.test(key) && FONTS.includes(o.value) ? { fontFamily: yaziAilesi(o.value) } : undefined}>{o.label}</option>)}
                      </Secim>
                      {(key === 'celebration' || (key.startsWith('efekt') && !['genel', 'yok', ...EKRAN_EFEKTLERI].includes(String(values[key])))) && (
                        <button type="button" onClick={() => kutla(String(values[key] || 'konfeti'), Number(values[key.replace('efekt', 'guc')]) || 1)} className="px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white shrink-0">Dene</button>
                      )}
                    </div>
                  ) : type === 'textarea' ? (
                    <textarea value={values[key] ?? ''} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} spellCheck={key.startsWith('ozel') ? false : undefined} className={`w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white ${key.startsWith('ozel') ? 'font-mono min-h-[120px]' : 'min-h-[52px]'}`} />
                  ) : key === 'speed' ? (
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.1} max={3} step={0.05} value={Number(values[key] ?? 1) || 0.5} onChange={e => setValues(v => ({ ...v, [key]: parseFloat(e.target.value) }))} className="flex-1 accent-purple-600" />
                      <span className="w-10 text-right font-mono text-xs text-white">{(Number(values[key] ?? 1) || 0.5).toFixed(2)}</span>
                    </div>
                  ) : (
                    <input
                      type={type === 'range' ? 'range' : type}
                      min={type === 'range' ? 0 : undefined}
                      max={type === 'range' ? 1 : undefined}
                      step={type === 'range' ? 0.05 : type === 'number' ? 1 : undefined}
                      value={values[key] ?? ''}
                      onChange={e => setValues(v => ({
                        ...v,
                        [key]: type === 'number' || type === 'range' ? parseFloat(e.target.value) : e.target.value
                      }))}
                      className="w-full bg-black/60 border border-white/10 rounded-lg p-1.5 text-xs text-white"
                    />
                  )}
                </label>
              );
              return key === 'soundUrl' || key === 'audioUrl' ? (
                <div key={key} className="space-y-1">
                  {alan}
                  <SesKirpma url={String(values[key] ?? '')} degistir={(u) => setValues(v => ({ ...v, [key]: u }))} />
                </div>
              ) : alan;
            })}
          </div>
        </Katlanir>
      ))}

      <button onClick={save} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5">
        <Save className="w-3.5 h-3.5" /> Ayarları Kaydet
      </button>
      {status && <div className="text-xs text-emerald-400">{status}</div>}
    </div>
  );
}
