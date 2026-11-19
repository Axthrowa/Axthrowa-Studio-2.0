/** Overlay Stüdyosu galerisi: widget listesi, filtre, tek URL, uyarı testleri */
import { useState, useEffect } from 'react';
import { AlertPreset } from '../types.js';
import { Wind, Hash, ListOrdered, Timer, Layers, Bell, Play, Volume2, MessageSquare, Cloud, DollarSign, Smile, Film, Tag, TrendingUp, Gift, Train, Trophy, Music, Pin, BarChart3, Megaphone, Hourglass, Target, Wine, Users, Disc, Gem, HelpCircle, Eye, Share2, SkipForward } from 'lucide-react';
import confetti from 'canvas-confetti';
import { GALERI_KATMANI, KATMANLAR } from '../widgets/OverlayLayers.js';
import { SubathonPanel } from '../components/SubathonPanel.js';
import { AllInOneConfig, GALERI_TR, HEDEF_TABANLARI } from './overlayStudioVerileri';
import type { YerlesimDurumu } from './useOverlayStudioTuval';

export type UseOverlayStudioGaleriGirdisi = {
  allInOne: AllInOneConfig;
  obsGorunumu: boolean;
  setActiveTab: React.Dispatch<React.SetStateAction<"all_in_one" | "gallery" | "chat_settings" | "alerts">>;
  setAllInOne: React.Dispatch<React.SetStateAction<AllInOneConfig>>;
  setCopiedUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedCanvasWidget: React.Dispatch<React.SetStateAction<string>>;
  setTestKatmanlari: React.Dispatch<React.SetStateAction<string[]>>;
  setTestNotification: React.Dispatch<React.SetStateAction<string | null>>;
  setTuvalAnahtari: React.Dispatch<React.SetStateAction<number>>;
  setYerlesimDurumu: React.Dispatch<React.SetStateAction<YerlesimDurumu>>;
  sonKaydedilen: React.RefObject<string>;
  testKatmanlari: string[];
  testSureleri: React.RefObject<Record<string, NodeJS.Timeout>>;
  yerlesimYuklendi: React.RefObject<boolean>;
  yerlesimiKaydet: (veri: AllInOneConfig) => Promise<boolean>;
};

export function useOverlayStudioGaleri({ allInOne, obsGorunumu, setActiveTab, setAllInOne, setCopiedUrl, setSelectedCanvasWidget, setTestKatmanlari, setTestNotification, setTuvalAnahtari, setYerlesimDurumu, sonKaydedilen, testKatmanlari, testSureleri, yerlesimYuklendi, yerlesimiKaydet }: UseOverlayStudioGaleriGirdisi) {

  // Widget Gallery State (Image 2)
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [selectedWidgetModal, setSelectedWidgetModal] = useState<any | null>(null);
  useEffect(() => {
    if (!selectedWidgetModal) return;
    const kapat = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedWidgetModal(null);
    window.addEventListener('keydown', kapat);
    return () => window.removeEventListener('keydown', kapat);
  }, [selectedWidgetModal]);
  const [modalActionStatus, setModalActionStatus] = useState<string | null>(null);
  // Birden fazla hedef çubuğu: 2. ve sonraki çubuklar `follower-goal-2` gibi ayrı ayar ve `?hedef=2` adresi alır
  const [hedefNo, setHedefNo] = useState(1);
  const [hedefSayisi, setHedefSayisi] = useState(1);
  const hedefTabani = HEDEF_TABANLARI.includes(selectedWidgetModal?.id);
  useEffect(() => {
    setHedefNo(1);
    setHedefSayisi(1);
    const id = selectedWidgetModal?.id;
    if (!HEDEF_TABANLARI.includes(id)) return;
    let iptal = false;
    void (async () => {
      let n = 2;
      for (; n <= 20; n++) {
        const d = await fetch(`/api/widgets/${id}-${n}/settings`).then((r) => r.json()).catch(() => ({}));
        if (iptal || !d || !Object.keys(d).length) break;
      }
      if (!iptal) setHedefSayisi(n - 1);
    })();
    return () => {
      iptal = true;
    };
  }, [selectedWidgetModal?.id]);
  const modalId: string = selectedWidgetModal && hedefNo > 1 ? `${selectedWidgetModal.id}-${hedefNo}` : selectedWidgetModal?.id;
  const modalUrl: string = selectedWidgetModal && hedefNo > 1 ? `${selectedWidgetModal.url}?hedef=${hedefNo}` : selectedWidgetModal?.url;
  const yeniHedefCubugu = async () => {
    const n = hedefSayisi + 1;
    // Boş ayar kaydedilmez; çubuğun var olduğu ilk değerle kaydedilir
    await fetch(`/api/widgets/${selectedWidgetModal.id}-${n}/settings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: 0 }) }).catch(() => {});
    setHedefSayisi(n);
    setHedefNo(n);
  };

  // AlertBox State
  const [alerts, setAlerts] = useState<AlertPreset[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AlertPreset | null>(null);

  const baseUrl = `${window.location.protocol}//${window.location.host}`;
  const singleOverlayUrl = `${baseUrl}/widgets/overlay`;

  useEffect(() => {
    // Fetch All-in-One settings
    fetch('/api/overlay/all-in-one')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        setAllInOne(prev => {
          const yeni = d && typeof d === 'object' && d.chat ? { ...prev, ...d } : prev;
          sonKaydedilen.current = JSON.stringify(yeni);
          return yeni;
        });
        yerlesimYuklendi.current = true;
      })
      .catch(() => setYerlesimDurumu('hata'));

    // Fetch Alerts
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => {
        setAlerts(d || []);
        if (d && d.length > 0) setSelectedAlert(d[0]);
      })
      .catch(() => {});
  }, []);

  /** Galerideki widget'ı tek OBS URL'sine ekler (katmanı açar) ve stüdyoda seçer. */
  const tekUrlyeEkle = (widgetId: string) => {
    const g = GALERI_KATMANI[widgetId];
    if (!g) return;
    const tanim = KATMANLAR.find((k) => k.anahtar === g.anahtar);
    setAllInOne((prev) => ({
      ...prev,
      [g.anahtar]: { scale: 1, ...tanim?.varsayilan, ...(prev as any)[g.anahtar], ...g.ek, enabled: true }
    }));
    setSelectedCanvasWidget(g.anahtar);
    setSelectedWidgetModal(null);
    setActiveTab('all_in_one');
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  const handleSaveAllInOne = async () => {
    yerlesimYuklendi.current = true;
    const ok = await yerlesimiKaydet(allInOne);
    if (ok) confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
    setTestNotification(
      ok
        ? '✨ Yerleşim kaydedildi ve OBS\'teki overlay\'e uygulandı!'
        : '❌ Kaydedilemedi — AxBoT çalışıyor mu? Tekrar deneyin.'
    );
    setTimeout(() => setTestNotification(null), 4000);
  };

  /** OBS'teki Tek URL'yi ve buradaki tuvali yeniden yükler. */
  const tekUrlYenile = async () => {
    setTuvalAnahtari((n) => n + 1);
    const res = await fetch('/api/overlay/reload', { method: 'POST' }).catch(() => null);
    setTestNotification(res?.ok ? "Tek URL yenilendi: OBS kaynağı ve önizleme yeniden yüklendi." : 'Yenilenemedi: sunucuya ulaşılamadı.');
    setTimeout(() => setTestNotification(null), 3000);
  };

  /** Test olayı örnek widget'ta görünmez: yalnız denenen katman bir süre canlı çizilir, tuval yenilenmez. */
  const katmaniTestEt = async (anahtar: string, etiket: string, testAdi: string) => {
    const ornekte = !obsGorunumu || Boolean(allInOne.testMode);
    // Yayın ekranında katman zaten örnekteyse örnek testi için canlıya geçilmez
    const gecisVar = ornekte && !testKatmanlari.includes(anahtar) && !(obsGorunumu && testAdi.startsWith('ornek-'));
    clearTimeout(testSureleri.current[anahtar]);
    if (gecisVar) {
      setTestKatmanlari((l) => [...l, anahtar]);
      // Canlı bağlantı henüz açık değil: hemen yollanan test kaçardı
      await new Promise((r) => setTimeout(r, 1200));
    }
    await triggerWidgetTest(testAdi);
    // Yayın ekranında katman canlı kalır: 15 sn sonra örneğe dönüş widget'ı baştan kuruyor, ekran kendi kendine yenileniyordu
    if (!obsGorunumu) testSureleri.current[anahtar] = setTimeout(() => setTestKatmanlari((l) => l.filter((a) => a !== anahtar)), 15000);
    setTestNotification(`${etiket} testi gönderildi.`);
    setTimeout(() => setTestNotification(null), 3000);
  };

  // Trigger test for specific widget via API
  const triggerWidgetTest = async (widgetId: string, customBody?: any) => {
    try {
      const res = await fetch(`/api/widgets/test/${widgetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customBody || {})
      });
      const data = await res.json();
      setModalActionStatus(`✅ Test tetiklendi: ${data.message || 'Başarılı'}`);
      setTimeout(() => setModalActionStatus(null), 3000);
    } catch {
      setModalActionStatus('❌ Test tetiklenirken hata oluştu');
      setTimeout(() => setModalActionStatus(null), 3000);
    }
  };

  /** Widget'a özel kontroller: galeri penceresinde ve Tek URL'de aynı */
  const widgetKontrolleri = (id: string) => (
    <>
                  {id === 'the-cup' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'coin', count: 3 })} className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold">
                        🪙 3 bağış
                      </button>
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'sub', count: 2 })} className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold">
                        ⭐ 2 abone
                      </button>
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'gift', count: 5 })} className="px-3 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold">
                        🎁 5 hediye abone
                      </button>
                      <button onClick={() => triggerWidgetTest('the-cup', { tokenType: 'kicks', count: 3 })} className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold">
                        🟢 3 KICKs
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Kupanın içi tamamen boşaltılsın mı?')) return;
                          await fetch('/api/cup/reset', { method: 'POST' }).catch(() => {});
                          setModalActionStatus('🗑️ Kupa sıfırlandı');
                          setTimeout(() => setModalActionStatus(null), 2500);
                        }}
                        className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-xl text-xs font-bold"
                      >
                        🗑️ Kupayı sıfırla
                      </button>
                    </div>
                  )}

                  {/* Subathon kendi kontrol panelini kullanir: sayac artik
                      sunucuda, sure kurallari buradan ayarlanir. Eski iki
                      dugme yalniz sahte bir WS mesaji yolluyordu. */}
                  {id === 'subathon' && <SubathonPanel />}

                  {id === 'wheel-of-fortune' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => triggerWidgetTest('wheel')}
                        className="px-4 py-2 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <Disc className="w-4 h-4" /> Çarkı Canlı Çevir
                      </button>
                    </div>
                  )}

                  {id === 'hype-train' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={async () => {
                          await fetch('/api/hype-train/start', { method: 'POST' }).catch(() => {});
                          setModalActionStatus('🚂 Tren sıfırdan başlatıldı');
                          setTimeout(() => setModalActionStatus(null), 2500);
                        }}
                        className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold"
                      >
                        ▶ Treni başlat (sıfırdan)
                      </button>
                      <button
                        onClick={async () => {
                          await fetch('/api/hype-train/reset', { method: 'POST' }).catch(() => {});
                          setModalActionStatus('⏹ Tren durduruldu');
                          setTimeout(() => setModalActionStatus(null), 2500);
                        }}
                        className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-xl text-xs font-bold"
                      >
                        ⏹ Durdur / sıfırla
                      </button>
                      <button
                        onClick={() => triggerWidgetTest('hype-train', { level: 2, percent: 80, secondsLeft: 240 })}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                      >
                        🚂 Hype Train Seviye 2 Başlat
                      </button>
                    </div>
                  )}

                  {id === 'shoutout' && (
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => triggerWidgetTest('shoutout', { channel: 'YayınUstası', game: 'Valorant' })}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold"
                      >
                        📢 Spotlight Simülasyonu
                      </button>
                    </div>
                  )}

                  {id === 'end-credits' && (
                    <button 
                      onClick={() => triggerWidgetTest('credits')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <Play className="w-3.5 h-3.5" /> Kayan Jeneriği Başlat
                    </button>
                  )}
    </>
  );

  // Overlay widget gallery
  const widgetGalleryItems = [
    {
      id: 'activity-feed',
      category: 'On-Stream',
      icon: Layers,
      url: `${baseUrl}/widgets/activity-feed`
    },
    {
      id: 'alert-box',
      category: 'On-Stream',
      icon: Bell,
      url: `${baseUrl}/widgets/alertbox`
    },
    {
      id: 'chat-overlay',
      category: 'Engagement',
      icon: MessageSquare,
      url: `${baseUrl}/widgets/chatbox`
    },
    {
      id: 'cloud-tts',
      category: 'Audio & AI',
      icon: Cloud,
      url: `${baseUrl}/widgets/audio-player`
    },
    {
      id: 'donation-goal',
      category: 'Goals',
      icon: DollarSign,
      url: `${baseUrl}/widgets/donation-goal`
    },
    {
      id: 'emote-combo',
      category: 'Engagement',
      icon: Smile,
      url: `${baseUrl}/widgets/emote-combo`
    },
    {
      id: 'end-credits',
      category: 'On-Stream',
      icon: Film,
      url: `${baseUrl}/widgets/credits`
    },
    {
      id: 'event-labels',
      category: 'On-Stream',
      icon: Tag,
      url: `${baseUrl}/widgets/event-labels`
    },
    {
      id: 'follower-goal',
      category: 'Goals',
      icon: TrendingUp,
      url: `${baseUrl}/widgets/follower-goal`
    },
    {
      id: 'giveaways',
      category: 'Engagement',
      icon: Gift,
      url: `${baseUrl}/widgets/giveaways`
    },
    {
      id: 'hype-train',
      category: 'Engagement',
      icon: Train,
      url: `${baseUrl}/widgets/hype-train`
    },
    {
      id: 'loyalty-redemptions',
      category: 'Engagement',
      icon: Trophy,
      url: `${baseUrl}/widgets/loyalty-redeem`
    },
    {
      id: 'now-playing',
      category: 'Audio & AI',
      icon: Music,
      url: `${baseUrl}/resonance/overlay`
    },
    {
      id: 'on-screen-emotes',
      category: 'Engagement',
      icon: Smile,
      url: `${baseUrl}/widgets/emotes`
    },
    {
      id: 'social-rotator',
      category: 'On-Stream',
      icon: Share2,
      url: `${baseUrl}/widgets/socials`
    },
    {
      id: 'sponsor-banner',
      category: 'On-Stream',
      icon: Megaphone,
      url: `${baseUrl}/widgets/sponsor`
    },
    {
      id: 'pinned-messages',
      category: 'On-Stream',
      icon: Pin,
      url: `${baseUrl}/widgets/pinned`
    },
    {
      id: 'polls',
      category: 'Engagement',
      icon: BarChart3,
      url: `${baseUrl}/widgets/polls`
    },
    {
      id: 'shoutout',
      category: 'On-Stream',
      icon: Megaphone,
      url: `${baseUrl}/widgets/shoutout`
    },
    {
      id: 'atla',
      category: 'On-Stream',
      icon: SkipForward,
      url: `${baseUrl}/widgets/atla`
    },
    {
      id: 'atla-oyunu',
      category: 'Engagement',
      icon: Wind,
      url: `${baseUrl}/widgets/atla-oyunu`
    },
    {
      id: 'sayac',
      category: 'On-Stream',
      icon: Hash,
      url: `${baseUrl}/widgets/sayac`
    },
    {
      id: 'izleyici-sirasi',
      category: 'Engagement',
      icon: ListOrdered,
      url: `${baseUrl}/widgets/izleyici-sirasi`
    },
    {
      id: 'geri-sayim',
      category: 'On-Stream',
      icon: Timer,
      url: `${baseUrl}/widgets/geri-sayim`
    },
    {
      id: 'subathon',
      category: 'Goals',
      icon: Hourglass,
      url: `${baseUrl}/widgets/subathon`
    },
    {
      id: 'subscriber-goal',
      category: 'Goals',
      icon: Target,
      url: `${baseUrl}/widgets/subscriber-goal`
    },
    {
      id: 'the-cup',
      category: 'Engagement',
      icon: Wine,
      url: `${baseUrl}/widgets/the-cup`
    },
    {
      id: 'word-cloud',
      category: 'Engagement',
      icon: Cloud,
      url: `${baseUrl}/widgets/word-cloud`
    },
    {
      id: 'scoreboard',
      category: 'Engagement',
      icon: Trophy,
      url: `${baseUrl}/widgets/scoreboard`
    },
    {
      id: 'tts',
      category: 'Audio & AI',
      icon: Volume2,
      url: `${baseUrl}/widgets/audio-player`
    },
    {
      id: 'viewer-counter',
      category: 'On-Stream',
      icon: Users,
      url: `${baseUrl}/widgets/viewer-counter`
    },
    {
      id: 'trivia-quiz',
      category: 'Engagement',
      icon: HelpCircle,
      url: `${baseUrl}/widgets/trivia`
    },
    {
      id: 'wheel-of-fortune',
      category: 'Engagement',
      icon: Disc,
      url: `${baseUrl}/widgets/wheel`
    },
    {
      id: 'kicks-goal',
      category: 'Goals',
      icon: Gem,
      url: `${baseUrl}/widgets/kicks-goal`
    },
    // Ayar sistemine yeni bağlanan dört widget galeride hiç görünmüyordu:
    // OBS adresleri vardı ama panelden ayarlanamıyorlardı.
    {
      id: 'rankings',
      category: 'On-Stream',
      icon: Trophy,
      url: `${baseUrl}/widgets/rankings`
    },
    {
      id: 'lyrics',
      category: 'On-Stream',
      icon: Disc,
      url: `${baseUrl}/widgets/lyrics`
    },
    {
      id: 'muzik-video',
      category: 'On-Stream',
      icon: Disc,
      url: `${baseUrl}/widgets/muzik-video`
    },
    {
      id: 'king',
      category: 'Engagement',
      icon: Gem,
      url: `${baseUrl}/widgets/king`
    },
    {
      id: 'jumpscare',
      category: 'Alerts',
      icon: Eye,
      url: `${baseUrl}/widgets/jumpscare`
    }
  ];

  const widgetGalleryItemsTr = widgetGalleryItems.map(w => ({
    ...w,
    title: GALERI_TR[w.id]?.baslik || w.id,
    description: GALERI_TR[w.id]?.aciklama || ''
  }));

  const filteredWidgets = widgetGalleryItemsTr.filter(w => {
    const matchesSearch = w.title.toLowerCase().includes(searchQuery.toLowerCase()) || w.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'All' || w.category === categoryFilter;
    return matchesSearch && matchesCat;
  });
  return { alerts, baseUrl, categoryFilter, copyToClipboard, filteredWidgets, handleSaveAllInOne, hedefNo, hedefSayisi, hedefTabani, katmaniTestEt, modalActionStatus, modalId, modalUrl, searchQuery, selectedAlert, selectedWidgetModal, setCategoryFilter, setHedefNo, setSearchQuery, setSelectedAlert, setSelectedWidgetModal, singleOverlayUrl, tekUrlYenile, tekUrlyeEkle, triggerWidgetTest, widgetGalleryItems, widgetGalleryItemsTr, widgetKontrolleri, yeniHedefCubugu };
}
