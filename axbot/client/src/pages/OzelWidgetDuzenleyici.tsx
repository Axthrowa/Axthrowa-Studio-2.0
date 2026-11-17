/**
 * WID-1: özel widget editörü. HTML, CSS, JS, alan şeması (SE fields.json) ve alan değerleri sekmeleri;
 * canlı önizleme korumalı çerçevede, test olaylarıyla. StreamElements widget'ı zip ya da dosyalar olarak içe alınır.
 * Kayıt: her widget `ozel-xxxx` ayarı, liste `ozel-widgetlar` ayarı.
 */
import { useEffect, useRef, useState } from 'react';
import { Copy, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Alan, AlanMetni, BosDurum, Buton, Girdi, Kart, Secim, useOnay, useToast } from '../ui/index.js';
import { BOS_WIDGET, SE_ALAN_TURLERI, alanVerisi, testOlayi, type OzelWidget, type SeAlan } from '../lib/ozelWidget.js';
import { seParcalari, zipAc, type Dosya } from '../lib/ozelWidgetZip.js';
import { OzelWidgetCercevesi, type CerceveTutamagi } from '../widgets/OzelWidgetCercevesi.js';

type Liste = Array<{ id: string; ad: string }>;
const LISTE_KIMLIGI = 'ozel-widgetlar';
const SEKMELER = ['Alanlar', 'HTML', 'CSS', 'JS', 'Şema (fields)'] as const;
const TESTLER = [
  ['follower', 'Takip'],
  ['subscriber', 'Abone'],
  ['tip', 'Bağış'],
  ['cheer', 'Bits / Kicks'],
  ['raid', 'Raid'],
  ['message', 'Sohbet'],
] as const;

const yaz = (id: string, govde: unknown) =>
  fetch(`/api/widgets/${id}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(govde) }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json().catch(() => ({})))?.error || `HTTP ${r.status}`);
  });
const oku = (id: string) => fetch(`/api/widgets/${id}/settings`).then((r) => r.json());
const yeniKimlik = () => `ozel-${Math.random().toString(36).slice(2, 10).padEnd(6, '0')}`;

/** Tek SE alanının denetimi */
function AlanDenetimi({ k, a, deger, degistir, tikla }: { k: string; a: SeAlan; deger: unknown; degistir: (v: unknown) => void; tikla: () => void }) {
  const etiket = a.label || k;
  switch (a.type) {
    case 'hidden':
      return null;
    case 'button':
      return <Buton ton="ikincil" onClick={tikla}>{etiket}</Buton>;
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 text-sm text-white">
          <input type="checkbox" checked={Boolean(deger)} onChange={(e) => degistir(e.target.checked)} /> {etiket}
        </label>
      );
    case 'colorpicker':
      return (
        <Alan etiket={etiket}>
          <div className="flex gap-2">
            <input type="color" aria-label={etiket} value={/^#[0-9a-f]{6}$/i.test(String(deger)) ? String(deger) : '#000000'} onChange={(e) => degistir(e.target.value)} className="h-9 w-12 rounded" />
            <Girdi value={String(deger ?? '')} onChange={(e) => degistir(e.target.value)} />
          </div>
        </Alan>
      );
    case 'number':
    case 'slider':
      return (
        <Alan etiket={`${etiket}${a.type === 'slider' ? ` (${deger ?? ''})` : ''}`}>
          <Girdi type={a.type === 'slider' ? 'range' : 'number'} min={a.min} max={a.max} step={a.step} value={Number(deger ?? 0)} onChange={(e) => degistir(Number(e.target.value))} />
        </Alan>
      );
    case 'dropdown':
      return (
        <Alan etiket={etiket}>
          <Secim value={String(deger ?? '')} onChange={(e) => degistir(e.target.value)} secenekler={Object.entries(a.options || {}).map(([value, label]) => ({ value, label }))} />
        </Alan>
      );
    default:
      // text, googleFont, image-input, video-input, sound-input: adres / ad olarak metin
      return (
        <Alan etiket={etiket} ipucu={a.type.endsWith('-input') ? 'Görsel/ses/video adresi (medya kütüphanesindeki dosyanın adresi de olur)' : a.type === 'googleFont' ? 'Google Fonts adı, ör. Roboto' : undefined}>
          <Girdi value={String(deger ?? '')} onChange={(e) => degistir(e.target.value)} />
        </Alan>
      );
  }
}

export default function OzelWidgetDuzenleyici() {
  const toast = useToast();
  const { sor, eleman } = useOnay();
  const [liste, setListe] = useState<Liste | null>(null);
  const [secili, setSecili] = useState<string | null>(null);
  const [w, setW] = useState<OzelWidget | null>(null);
  const [sekme, setSekme] = useState<(typeof SEKMELER)[number]>('Alanlar');
  const [semaMetni, setSemaMetni] = useState('');
  const [kirli, setKirli] = useState(false);
  const cerceve = useRef<CerceveTutamagi>(null);
  const dosyaGirdisi = useRef<HTMLInputElement>(null);

  useEffect(() => {
    oku(LISTE_KIMLIGI)
      .then((d) => setListe(Array.isArray(d?.liste) ? d.liste : []))
      .catch(() => setListe([]));
  }, []);

  const ac = async (id: string) => {
    const d = await oku(id).catch(() => null);
    setSecili(id);
    const yeni = { ...BOS_WIDGET, ...(d || {}) } as OzelWidget;
    setW(yeni);
    setSemaMetni(JSON.stringify(yeni.alanlar, null, 2));
    setKirli(false);
  };

  const listeyiYaz = async (yeni: Liste) => {
    await yaz(LISTE_KIMLIGI, { liste: yeni });
    setListe(yeni);
  };

  const ekle = async (taslak: OzelWidget) => {
    const id = yeniKimlik();
    try {
      await yaz(id, taslak);
      await listeyiYaz([...(liste || []), { id, ad: taslak.ad }]);
      await ac(id);
      toast(`"${taslak.ad}" eklendi`, 'basari');
    } catch (e) {
      toast(`Eklenemedi: ${(e as Error).message}`, 'hata');
    }
  };

  const kaydet = async () => {
    if (!secili || !w) return;
    try {
      await yaz(secili, { ...w, depo: undefined });
      if (liste?.find((x) => x.id === secili)?.ad !== w.ad) await listeyiYaz((liste || []).map((x) => (x.id === secili ? { ...x, ad: w.ad } : x)));
      setKirli(false);
      toast('Kaydedildi; OBS katmanı yenilendi', 'basari');
    } catch (e) {
      toast(`Kaydedilemedi: ${(e as Error).message}`, 'hata');
    }
  };

  const sil = () => {
    if (!secili || !w) return;
    // shortcut: ayar kaydı veritabanında kalır (silme ucu yok), yalnız listeden düşer; kimlik yeniden kullanılmaz
    sor('Widget silinsin mi?', `"${w.ad}" listeden kaldırılır; OBS'teki adresi boş görünür.`, () => {
      void listeyiYaz((liste || []).filter((x) => x.id !== secili)).then(() => {
        void yaz(secili, { html: '', css: '', js: '' }).catch(() => {});
        setSecili(null);
        setW(null);
      });
    });
  };

  const iceAl = async (dosyalar: FileList | null) => {
    if (!dosyalar?.length) return;
    try {
      const parcalar: Dosya[] = [];
      for (const f of [...dosyalar]) {
        if (f.name.toLowerCase().endsWith('.zip')) parcalar.push(...(await zipAc(await f.arrayBuffer())));
        else parcalar.push({ ad: f.name, metin: await f.text() });
      }
      const ad = dosyalar.length === 1 ? dosyalar[0].name.replace(/\.[^.]+$/, '') : 'İçe alınan widget';
      await ekle(seParcalari(parcalar, ad));
    } catch (e) {
      toast(`İçe alınamadı: ${(e as Error).message}`, 'hata');
    } finally {
      if (dosyaGirdisi.current) dosyaGirdisi.current.value = '';
    }
  };

  const degistir = (p: Partial<OzelWidget>) => {
    setW((x) => (x ? { ...x, ...p } : x));
    setKirli(true);
  };

  const semaUygula = (metin: string) => {
    setSemaMetni(metin);
    try {
      const j = JSON.parse(metin);
      if (j && typeof j === 'object' && !Array.isArray(j)) degistir({ alanlar: j });
    } catch {
      /* yazarken geçici geçersiz JSON */
    }
  };

  if (!liste) return <BosDurum baslik="Yükleniyor…" />;
  const adres = secili ? `${window.location.protocol}//${window.location.host}/widgets/ozel?id=${secili}` : '';
  const fieldData = w ? alanVerisi(w) : {};

  return (
    <div className="space-y-4">
      {eleman}
      <Kart
        baslik="Özel widget"
        aciklama="Kendi HTML, CSS ve JavaScript'inle widget yaz ya da StreamElements özel widget'ını (zip ya da html/css/js/json dosyaları) içe al. Kod korumalı çerçevede çalışır; bot ayarlarına erişemez."
        sag={
          <div className="flex gap-2">
            <Buton ton="ikincil" ikon={<Upload className="w-3.5 h-3.5" />} onClick={() => dosyaGirdisi.current?.click()}>
              İçe al
            </Buton>
            <Buton ikon={<Plus className="w-3.5 h-3.5" />} onClick={() => void ekle({ ...BOS_WIDGET })}>
              Yeni
            </Buton>
            <input ref={dosyaGirdisi} type="file" multiple accept=".zip,.html,.htm,.css,.js,.json" className="hidden" aria-label="Widget dosyaları" onChange={(e) => void iceAl(e.target.files)} />
          </div>
        }
      >
        {liste.length === 0 ? (
          <p className="text-sm text-gray-400">Henüz özel widget yok.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {liste.map((x) => (
              <Buton key={x.id} ton={x.id === secili ? 'birincil' : 'ikincil'} onClick={() => void ac(x.id)}>
                {x.ad}
              </Buton>
            ))}
          </div>
        )}
      </Kart>

      {w && secili && (
        <div className="grid gap-4 xl:grid-cols-2">
          <Kart
            baslik="Düzenle"
            sag={
              <div className="flex gap-2">
                <Buton ton="tehlike" ikon={<Trash2 className="w-3.5 h-3.5" />} onClick={sil}>
                  Sil
                </Buton>
                <Buton ikon={<Save className="w-3.5 h-3.5" />} onClick={() => void kaydet()} disabled={!kirli}>
                  Kaydet
                </Buton>
              </div>
            }
          >
            <div className="space-y-3">
              <Alan etiket="Ad">
                <Girdi value={w.ad} onChange={(e) => degistir({ ad: e.target.value })} />
              </Alan>
              <div role="tablist" className="flex flex-wrap gap-1">
                {SEKMELER.map((s) => (
                  <Buton key={s} role="tab" aria-selected={sekme === s} ton={sekme === s ? 'birincil' : 'sade'} onClick={() => setSekme(s)}>
                    {s}
                  </Buton>
                ))}
              </div>
              {sekme === 'Alanlar' ? (
                <div className="space-y-2">
                  {Object.keys(w.alanlar || {}).length === 0 && <p className="text-sm text-gray-400">Şemada alan yok. "Şema (fields)" sekmesinden ekleyin.</p>}
                  {Object.entries(w.alanlar || {}).map(([k, a]) =>
                    a && typeof a === 'object' && (SE_ALAN_TURLERI as readonly string[]).includes(a.type) ? (
                      <AlanDenetimi
                        key={k}
                        k={k}
                        a={a}
                        deger={fieldData[k]}
                        degistir={(v) => degistir({ veri: { ...(w.veri || {}), [k]: v } })}
                        tikla={() => cerceve.current?.olay({ listener: 'widget-button', event: { listener: 'widget-button', field: k, value: a.value } })}
                      />
                    ) : null
                  )}
                </div>
              ) : (
                <AlanMetni
                  aria-label={sekme}
                  spellCheck={false}
                  className="font-mono min-h-[360px] text-xs"
                  value={sekme === 'HTML' ? w.html : sekme === 'CSS' ? w.css : sekme === 'JS' ? w.js : semaMetni}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (sekme === 'HTML') degistir({ html: v });
                    else if (sekme === 'CSS') degistir({ css: v });
                    else if (sekme === 'JS') degistir({ js: v });
                    else semaUygula(v);
                  }}
                />
              )}
            </div>
          </Kart>

          <Kart baslik="Önizleme" aciklama="Kaydetmeden önce burada deneyin; OBS katmanı kaydedince güncellenir.">
            <div className="space-y-3">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10" style={{ background: 'repeating-conic-gradient(#1f2937 0% 25%, #111827 0% 50%) 50% / 24px 24px' }}>
                <OzelWidgetCercevesi ref={cerceve} w={w} editorde className="absolute inset-0 h-full w-full border-0" />
              </div>
              <div className="flex flex-wrap gap-2">
                {TESTLER.map(([tur, ad]) => (
                  <Buton key={tur} ton="ikincil" onClick={() => cerceve.current?.olay(testOlayi(tur))}>
                    {ad}
                  </Buton>
                ))}
              </div>
              <Alan etiket="OBS adresi (tarayıcı kaynağı)" ipucu={kirli ? 'Kaydedilmemiş değişiklik var: OBS eski hâli gösterir' : undefined}>
                <div className="flex gap-2">
                  <Girdi readOnly value={adres} />
                  <Buton ton="ikincil" ikon={<Copy className="w-3.5 h-3.5" />} onClick={() => void navigator.clipboard.writeText(adres).then(() => toast('Adres kopyalandı', 'basari'))}>
                    Kopyala
                  </Buton>
                </div>
              </Alan>
            </div>
          </Kart>
        </div>
      )}
    </div>
  );
}
