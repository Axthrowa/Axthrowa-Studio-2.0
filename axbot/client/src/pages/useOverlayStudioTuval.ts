/** Overlay Stüdyosu tuvali: yerleşim, sürükle-boyutla, hizalama, test kipi, kayıt */
import { useState, useEffect, useRef, useCallback } from 'react';
import { KATMANLAR } from '../widgets/OverlayLayers.js';
import { hizala, merkezdeBoyutla, sinirla, yapistir, type Kilavuzlar, type Kutu, type Yon } from '../lib/hizala.js';
import { hedefWidgetKimligi } from '../lib/widget-defaults.js';
import { ayarKanalinaKatil, YERLESIM_KIMLIGI } from '../lib/ayarKanali.js';
import { AllInOneConfig, KATMAN_AYAR_ID, DEFAULT_ALL_IN_ONE_CONFIG } from './overlayStudioVerileri';

export type YerlesimDurumu = 'kaydedildi' | 'bekliyor' | 'kaydediliyor' | 'hata';

export function useOverlayStudioTuval() {
  const [activeTab, setActiveTab] = useState<'all_in_one' | 'gallery' | 'chat_settings' | 'alerts'>('all_in_one');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [testNotification, setTestNotification] = useState<string | null>(null);

  // All-in-One Single OBS Overlay State
  const [allInOne, setAllInOne] = useState<AllInOneConfig>(DEFAULT_ALL_IN_ONE_CONFIG);
  const [selectedCanvasWidget, setSelectedCanvasWidget] = useState<string>('chat');
  /** Tuval OBS'te görüneceği gibi mi (true) yoksa örnek verilerle mi çizilsin. */
  const [obsGorunumu, setObsGorunumu] = useState(false);
  // Test Modu açıkken de test olayı görünsün: tuval canlı veriye geçer
  // Test edilen katmanlar: yalnız onlar canlı çizilir, tuvalin geri kalanı olduğu gibi kalır
  const [testKatmanlari, setTestKatmanlari] = useState<string[]>([]);
  const testSureleri = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Görünüm ya da Test modu değişince canlıda bırakılan katmanlar örneğe döner
  useEffect(() => setTestKatmanlari([]), [obsGorunumu, allInOne.testMode]);
  // Artınca tuvaldeki widget'lar yeniden yüklenir
  const [tuvalAnahtari, setTuvalAnahtari] = useState(0);
  /** Seçili katmanın kendi ayar kaydı (hedef çubuğunda türe göre). */
  const seciliAyarId =
    selectedCanvasWidget === 'goals' ? hedefWidgetKimligi(allInOne.goals?.type) : KATMAN_AYAR_ID[selectedCanvasWidget];

  /**
   * Kullanıcı bildirdi: "Overlay Stüdyo'da yaptığım değişiklikler OBS'e
   * yansımıyor." Konum/boyut/aç-kapa yalnız "Kaydet"e basınca gidiyordu; hemen
   * yanındaki bileşen ayarları ise kendiliğinden kaydediliyordu — kullanıcı
   * ikisinin de kaydedildiğini sanıyordu. Artık yerleşim de kendiliğinden
   * kaydedilir (sürükleme bitince) ve sunucu OBS'e anında yayınlar.
   */
  const [yerlesimDurumu, setYerlesimDurumu] = useState<YerlesimDurumu>('kaydedildi');
  /** Sunucudaki yerleşim okunmadan otomatik kayıt YAPILMAZ (varsayılanlar kayıtlı ayarın üstüne yazılmasın). */
  const yerlesimYuklendi = useRef(false);
  /** Sunucuyla eşit olan son yerleşim (JSON) — aynısını yeniden göndermemek için. */
  const sonKaydedilen = useRef('');
  /** Kendi kaydımızın sunucudan geri yankısı, o arada yapılan yeni düzenlemeyi ezmesin. */
  const sonKendiKaydi = useRef(0);

  const yerlesimiKaydet = async (veri: AllInOneConfig): Promise<boolean> => {
    const json = JSON.stringify(veri);
    sonKendiKaydi.current = Date.now();
    setYerlesimDurumu('kaydediliyor');
    try {
      const r = await fetch('/api/overlay/all-in-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: json
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      sonKaydedilen.current = json;
      setYerlesimDurumu('kaydedildi');
      return true;
    } catch {
      setYerlesimDurumu('hata');
      return false;
    }
  };

  // Yerleşimi başka bir yer değiştirdi (sesli komut, başka panel sekmesi):
  // stüdyodaki eski hâl, sonraki otomatik kayıtta onun üstüne yazmasın.
  useEffect(
    () =>
      ayarKanalinaKatil({
        widgetId: YERLESIM_KIMLIGI,
        ayar: (config) => {
          if (!config || typeof config !== 'object' || !(config as any).chat) return;
          if (Date.now() - sonKendiKaydi.current < 2000) return; // kendi kaydımızın yankısı
          setAllInOne((prev) => {
            const yeni = { ...prev, ...(config as Partial<AllInOneConfig>) };
            sonKaydedilen.current = JSON.stringify(yeni);
            return yeni;
          });
        },
        tazele: () => {}
      }),
    []
  );

  // Canvas interactive drag-and-drop state
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /**
   * Tuval 1920x1080 cizilip CSS ile kuculuyor: boylece onizlemedeki her
   * piksel OBS'teki ayni pikseldir. Genislik degistikce yeniden olculur.
   */
  const [tuvalOlcek, setTuvalOlcek] = useState(1);
  /**
   * Gözlemci tuval öğesi HER oluştuğunda bağlanır (geri çağrılı ref).
   * Eskiden `useEffect(..., [])` yalnız ilk açılışta bağlıyordu: sekme
   * değişip tuval yeniden oluşunca ölçek güncellenmiyor, 1920 piksellik
   * tuvalin yalnız sol üst köşesi görünüyordu ("önizleme tam göstermiyor").
   */
  const tuvalGozlemci = useRef<ResizeObserver | null>(null);
  const tuvalRef = useCallback((el: HTMLDivElement | null) => {
    canvasRef.current = el;
    tuvalGozlemci.current?.disconnect();
    tuvalGozlemci.current = null;
    if (!el) return;
    const guncelle = () => setTuvalOlcek(Math.max(0.05, (el.clientWidth || 1920) / 1920));
    guncelle();
    const g = new ResizeObserver(guncelle);
    g.observe(el);
    tuvalGozlemci.current = g;
  }, []);
  useEffect(() => () => tuvalGozlemci.current?.disconnect(), []);
  const [isDragging, setIsDragging] = useState(false);
  const [kilavuz, setKilavuz] = useState<Kilavuzlar>({ dikey: [], yatay: [] });
  const [isResizing, setIsResizing] = useState(false);
  const [kenarPayi, setKenarPayi] = useState(0);
  const dragStartRef = useRef<{ cekilis?: boolean; mod?: 'olcek' | 'en' | 'boy'; origScale?: number; pointerX: number; pointerY: number; widgetX: number; widgetY: number; origW: number; origH: number } | null>(null);

  // Otomatik kayıt: değişiklikten 400 ms sonra; sürükleme sırasında bekler
  useEffect(() => {
    if (!yerlesimYuklendi.current) return;
    const json = JSON.stringify(allInOne);
    if (json === sonKaydedilen.current) return;
    setYerlesimDurumu('bekliyor');
    if (isDragging || isResizing) return;
    const t = setTimeout(() => void yerlesimiKaydet(allInOne), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allInOne, isDragging, isResizing]);

  const handleWidgetPointerDown = (e: React.PointerEvent, widgetKey: string) => {
    e.stopPropagation();
    // Yalnız "Düzenlenecek Bileşen"de seçili widget taşınır; başkasına tek tıklamak seçimi de değiştirmez
    // (üst üste binen widget'larda seçim kayıyor, yanlış widget taşınıyordu). Çift tıklama seçer.
    if (widgetKey !== selectedCanvasWidget) return;
    const item = (allInOne as any)[widgetKey];
    if (!item) return;

    setIsDragging(true);
    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      widgetX: item.x ?? 0,
      widgetY: item.y ?? 0,
      origW: item.width ?? 300,
      origH: item.height ?? 200
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  /** Çekiliş anı kutusu ana konumdan bağımsız sürüklenir */
  const handleCekilisPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    const c = (allInOne as any).giveaway?.cekilis;
    if (!c) return;
    setIsDragging(true);
    dragStartRef.current = { cekilis: true, pointerX: e.clientX, pointerY: e.clientY, widgetX: c.x, widgetY: c.y, origW: 0, origH: 0 };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleResizePointerDown = (e: React.PointerEvent, widgetKey: string, mod: 'olcek' | 'en' | 'boy') => {
    e.stopPropagation();
    setSelectedCanvasWidget(widgetKey);
    const item = (allInOne as any)[widgetKey];
    if (!item) return;

    setIsResizing(true);
    dragStartRef.current = {
      mod,
      origScale: typeof item.scale === 'number' && item.scale > 0 ? item.scale : 1,
      pointerX: e.clientX,
      pointerY: e.clientY,
      widgetX: item.x ?? 0,
      widgetY: item.y ?? 0,
      origW: item.width ?? 300,
      origH: item.height ?? 200
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const displayScale = rect.width / 1920;
    const deltaX = (e.clientX - dragStartRef.current.pointerX) / displayScale;
    const deltaY = (e.clientY - dragStartRef.current.pointerY) / displayScale;

    if (isDragging && dragStartRef.current.cekilis) {
      const hamX = dragStartRef.current.widgetX + deltaX;
      const hamY = dragStartRef.current.widgetY + deltaY;
      const kutu = cekilisKutusu();
      const digerleri = KATMANLAR.map((k) => (allInOne as any)[k.anahtar]).filter((it) => it?.enabled) as Kutu[];
      const yap = e.altKey ? { ...sinirla(hamX, hamY, kutu), kilavuz: { dikey: [], yatay: [] } } : yapistir(hamX, hamY, kutu, digerleri, 14);
      setKilavuz(yap.kilavuz);
      setAllInOne((prev) => ({ ...prev, giveaway: { ...(prev as any).giveaway, cekilis: { x: yap.x, y: yap.y } } }));
    } else if (isDragging) {
      const curItem = (allInOne as any)[selectedCanvasWidget];
      const kutu: Kutu = { x: 0, y: 0, width: curItem?.width || 300, height: curItem?.height || 200, scale: curItem?.scale };
      const hamX = dragStartRef.current.widgetX + deltaX;
      const hamY = dragStartRef.current.widgetY + deltaY;
      let newX: number;
      let newY: number;
      if (e.altKey) {
        ({ x: newX, y: newY } = sinirla(hamX, hamY, kutu));
        setKilavuz({ dikey: [], yatay: [] });
      } else {
        // Yalnız tuvalde görünen (açık) diğer katmanlara yapış
        const digerleri = KATMANLAR.map((k) => (allInOne as any)[k.anahtar])
          .filter((it, i) => it?.enabled && KATMANLAR[i].anahtar !== selectedCanvasWidget) as Kutu[];
        const yap = yapistir(hamX, hamY, kutu, digerleri, 14);
        newX = yap.x;
        newY = yap.y;
        setKilavuz(yap.kilavuz);
      }
      setAllInOne(prev => ({
        ...prev,
        [selectedCanvasWidget]: {
          ...(prev as any)[selectedCanvasWidget],
          x: newX,
          y: newY
        }
      }));
    } else if (isResizing) {
      // Köşe içeriği büyütür: widget'ların çoğu kutuya göre büyümez, kutu değişince yalnız kırpılırdı.
      // Kenarlar kutuyu değiştirir. Kutu merkezde büyüdüğü için fark iki katı: tutulan kenar fareyi izler.
      const { mod, origW, origH, origScale = 1, widgetX, widgetY } = dragStartRef.current;
      const bas = { x: widgetX, y: widgetY, width: origW, height: origH, scale: origScale };
      const yama =
        mod === 'olcek'
          ? merkezdeBoyutla(bas, { scale: origScale * Math.max(1 + (2 * deltaX) / (origW * origScale), 1 + (2 * deltaY) / (origH * origScale)) })
          : mod === 'en'
            ? merkezdeBoyutla(bas, { width: Math.max(100, origW + (2 * deltaX) / origScale) })
            : merkezdeBoyutla(bas, { height: Math.max(40, origH + (2 * deltaY) / origScale) });
      setAllInOne(prev => ({
        ...prev,
        [selectedCanvasWidget]: {
          ...(prev as any)[selectedCanvasWidget],
          ...yama
        }
      }));
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setKilavuz({ dikey: [], yatay: [] });
    dragStartRef.current = null;
  };

  /** Seçili katmanı tuvale göre hizalar (görünen, yani ölçekli boyuta göre). */
  const hizalaSecili = (yonler: Yon[]) => {
    const item = (allInOne as any)[selectedCanvasWidget];
    if (!item) return;
    const yeni = Object.assign({}, ...yonler.map((yon) => hizala({ x: item.x ?? 0, y: item.y ?? 0, width: item.width || 300, height: item.height || 200, scale: item.scale }, yon, kenarPayi)));
    setAllInOne(prev => ({ ...prev, [selectedCanvasWidget]: { ...(prev as any)[selectedCanvasWidget], ...yeni } }));
  };

  /** Çekiliş anı konumu widget'la aynı boyutta */
  const cekilisKutusu = (): Kutu => {
    const g = (allInOne as any).giveaway;
    return { x: 0, y: 0, width: g?.width || 600, height: g?.height || 300, scale: g?.scale };
  };
  const hizalaCekilis = (yonler: Yon[]) => {
    const yeni = Object.assign({}, ...yonler.map((yon) => hizala(cekilisKutusu(), yon, kenarPayi)));
    setAllInOne((prev) => {
      const g = (prev as any).giveaway;
      return { ...prev, giveaway: { ...g, cekilis: { ...g.cekilis, ...yeni } } };
    });
  };

  // Ok tuşları seçili katmanı 1 px (Shift ile 10 px) kaydırır; yazı alanındayken değil
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      const yon = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!yon) return;
      const hedef = e.target as HTMLElement | null;
      if (hedef && (hedef.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(hedef.tagName))) return;
      if (!canvasRef.current) return; // tuval görünmüyorsa (başka sekme) dokunma
      e.preventDefault();
      const adim = e.shiftKey ? 10 : 1;
      setAllInOne(prev => {
        const item = (prev as any)[selectedCanvasWidget];
        if (!item) return prev;
        const yeni = sinirla((item.x ?? 0) + yon[0] * adim, (item.y ?? 0) + yon[1] * adim, {
          x: 0, y: 0, width: item.width || 300, height: item.height || 200, scale: item.scale
        });
        return { ...prev, [selectedCanvasWidget]: { ...item, ...yeni } };
      });
    };
    window.addEventListener('keydown', tus);
    return () => window.removeEventListener('keydown', tus);
  }, [selectedCanvasWidget]);

  const handleResetWidget = (widgetKey: string) => {
    const defItem = (DEFAULT_ALL_IN_ONE_CONFIG as any)[widgetKey];
    if (!defItem) return;
    setAllInOne(prev => ({
      ...prev,
      [widgetKey]: { ...defItem }
    }));
  };

  const handleToggleTestMode = async () => {
    const nextVal = !allInOne.testMode;
    const updated = { ...allInOne, testMode: nextVal };
    setAllInOne(updated);
    try {
      if (!(await yerlesimiKaydet(updated))) throw new Error('kaydedilemedi');
      setTestNotification(
        nextVal
          ? '👁️ OBS Test/Önizleme Modu AÇILDI! (OBS ekranında tüm bileşenler örnek verilerle görünür)'
          : '👁️ OBS Test Modu KAPATILDI (Canlı yayın moduna dönüldü)'
      );
      setTimeout(() => setTestNotification(null), 4500);
    } catch {}
  };
  return { activeTab, allInOne, copiedUrl, handleCekilisPointerDown, handlePointerMove, handlePointerUp, handleResetWidget, handleResizePointerDown, handleToggleTestMode, handleWidgetPointerDown, hizalaCekilis, hizalaSecili, kenarPayi, kilavuz, obsGorunumu, seciliAyarId, selectedCanvasWidget, setActiveTab, setAllInOne, setCopiedUrl, setKenarPayi, setObsGorunumu, setSelectedCanvasWidget, setTestKatmanlari, setTestNotification, setTuvalAnahtari, setYerlesimDurumu, sonKaydedilen, testKatmanlari, testNotification, testSureleri, tuvalAnahtari, tuvalOlcek, tuvalRef, yerlesimDurumu, yerlesimYuklendi, yerlesimiKaydet };
}
