import { kokOzellik } from '../lib/kabuklar.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useState, useEffect, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { EKRAN_EFEKTLERI, kutla, olayEfekti } from '../lib/kutlama.js';
import { EKRAN_EFEKTI_MS, EkranEfekti, sarsintiStili } from './EkranEfekti.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { ALERT_ADVANCED_DEFAULTS } from '../lib/widget-defaults.js';
import { uyariSablonuHtml } from '../lib/ozelGorunum.js';
import {
  BOS_DURUM,
  GorulenKimlikler,
  atla,
  ilerlet,
  kuyrugaEkle,
  simdiOynat,
  sirdanCikar,
  sonaAl,
  temizle,
  kuyrukRaporu,
  metinPenceresiAcik,
  sonrakiMetinSiniri,
  sonrakiTik,
  type KuyrukDurumu,
  olayYoksaGenel
} from '../lib/alertQueue.js';
import { animStili, cikisKimligi, type AnimAsamasi, efektEkle } from '../lib/animations.js';

interface AlertItem {
  id: string;
  eventType: string;
  title: string;
  message: string;
  soundUrl: string;
  imageUrl: string;
  durationMs: number;
  textColor: string;
  accentColor: string;
  animation: string;
  layoutMode?: 'stacked' | 'side-by-side' | 'text-over';
  textEffect?: string;
  soundVolume: number;
  amount: number;
  isTest: boolean;
  /** Olayı yapan (şablondaki {ad}) */
  user: string;
}

// Tek ses bağlamı: her zil için yenisi açılıp kapatılmıyordu, uzun yayında tarayıcının bağlam sınırı dolup zil susuyordu
let sesBaglami: AudioContext | null = null;
function sesBaglamiAl(): AudioContext | null {
  const Sinif = window.AudioContext || (window as any).webkitAudioContext;
  if (!Sinif) return null;
  sesBaglami ??= new Sinif();
  if (sesBaglami.state === 'suspended') void sesBaglami.resume().catch(() => {});
  return sesBaglami;
}

function playSynthesizedChime(volume: number = 0.7) {
  try {
    const ctx = sesBaglamiAl();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Pleasant dual-tone chime (C5 -> E5 -> G5 -> C6)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(Math.min(1, volume * 0.3), now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.38);
    });
  } catch (err) {
    console.warn('[AlertBox] Synthesized chime fallback error:', err);
  }
}

export function AlertBoxWidget({ embedded = false, previewMode = false }: { embedded?: boolean; previewMode?: boolean }) {
  const advanced = useWidgetSettings('alert-box', ALERT_ADVANCED_DEFAULTS);
  const { activeAlert, setActiveAlert, alertControl, connected, gonder } = useWebSocket('alertbox');
  /** Ekip denetimi (duraklat / sustur); OBS kaynağı yeniden yüklense de sunucudan okunur */
  const [denetim, setDenetim] = useState({ paused: false, muted: false });
  const denetimRef = useRef(denetim);
  denetimRef.current = denetim;
  const [kuyruk, setKuyruk] = useState<KuyrukDurumu>(BOS_DURUM);
  const gorulenler = useRef(new GorulenKimlikler(200));
  const [imgError, setImgError] = useState(false);
  /** Bekleyen kutlama atışlarını iptal eder (yeni uyarı gelince / kaynak kapanınca) */
  const kutlamaIptal = useRef<() => void>(() => {});
  const [ekranEfekti, setEkranEfekti] = useState<{ tur: string; guc: number; anahtar: number } | null>(null);
  useEffect(() => () => kutlamaIptal.current(), []);
  const [showHelper, setShowHelper] = useState(!embedded);

  const params = new URLSearchParams(window.location.search);
  const isPreview = previewMode || params.get('preview') === '1' || params.get('test') === '1';

  // U3: sıradaki uyarıları sunucuya bildir (panel ve uzak moderatör görür). Panel içindeki önizleme bildirmez.
  const rapor = kuyrukRaporu(kuyruk);
  useEffect(() => {
    if (embedded || isPreview || !connected) return;
    gonder(rapor.ileti);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapor.anahtar, connected, embedded, isPreview]);

  // Auto-hide helper indicator after 6 seconds
  useEffect(() => {
    if (embedded) return;
    const timer = setTimeout(() => setShowHelper(false), 6000);
    return () => clearTimeout(timer);
  }, [embedded]);

  // Listen for audio unlock clicks
  const unlockAudio = () => {
    setShowHelper(false);
    try {
      sesBaglamiAl();
    } catch {
      /* ses yoksa görsel yine çalışır */
    }
  };

  // Check URL query parameters for instant preview/test
  useEffect(() => {
    const testType = params.get('test');
    if (testType) {
      setTimeout(() => {
        enqueueAlert({
          id: 'test-url-' + Date.now(),
          eventType: testType,
          title: testType.toUpperCase() + ' TESTİ!',
          message: 'AxBoT AlertBox Bildirim Testi',
          soundUrl: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3',
          imageUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
          durationMs: 5000,
          textColor: '#ffffff',
          accentColor: '#3EEDFE',
          animation: 'bounce',
          layoutMode: 'stacked',
          textEffect: 'shine',
          soundVolume: 0.7,
          amount: 0,
          isTest: true,
          user: 'Test'
        });
      }, 500);
    }
  }, []);

  const normalizeAlert = (raw: any): AlertItem => {
    return {
      id: raw.id || String(Date.now()),
      eventType: raw.eventType || raw.event_type || 'follow',
      title: raw.title || raw.title_template || 'YENİ BİLDİRİM!',
      message: raw.message || raw.message_template || '',
      soundUrl: raw.soundUrl || raw.sound_url || '',
      // Görsel seçilmemişse dış adrese gidilmez: internet yokken de yerleşik kart görünür
      imageUrl: raw.imageUrl || raw.image_url || '',
      durationMs: raw.durationMs || raw.duration_ms || 5000,
      textColor: raw.textColor || raw.text_color || '#ffffff',
      accentColor: raw.accentColor || raw.accent_color || '#3EEDFE',
      animation: olayYoksaGenel(raw.animation, advanced.animation, 'bounce'),
      layoutMode: olayYoksaGenel(raw.layoutMode || raw.layout_mode, advanced.layoutMode, 'stacked') as AlertItem['layoutMode'],
      textEffect: olayYoksaGenel(raw.textEffect || raw.text_effect, advanced.textEffect, 'shine'),
      soundVolume: raw.soundVolume ?? raw.sound_volume ?? 0.7,
      amount: Number(raw.amount) || 0,
      isTest: raw.isTest === true,
      user: String(raw.user || raw.username || '')
    };
  };

  /**
   * Kuyruk artik saf bir DURUM MAKINESI (lib/alertQueue.ts).
   *
   * Eskiden `alertQueue.current` dizisi + `isProcessing` bayragi + ic ice
   * `setTimeout` vardi: arka arkaya gelen iki olay birbirini eziyordu ve
   * WebSocket yeniden baglandiginda ayni uyari iki kez oynuyordu.
   */
  const enqueueAlert = (item: AlertItem) => {
    // Eşik: tutar eskiden uyarıya hiç taşınmıyordu, eşik açıkken TÜM bağışlar düşüyordu. Test uyarısı eşiğe takılmaz.
    const esik = item.eventType === 'tip' ? Number(advanced.minTipAmount) : item.eventType === 'kicks' ? Number(advanced.minKicks) : 0;
    if (!item.isTest && esik > 0 && item.amount < esik) return;

    // Ayni uyariyi iki kez oynatma
    if (gorulenler.current.gorduk(item.id)) return;
    gorulenler.current.ekle(item.id);

    const animMs = Math.max(0, Number(advanced.animationDuration) || 500);
    setKuyruk((d) =>
      kuyrugaEkle(
        d,
        {
          id: item.id,
          tur: item.eventType,
          veri: item,
          sureMs: item.durationMs || 5000,
          animMs
        },
        Boolean(advanced.queueEnabled),
        Date.now(),
        denetimRef.current.paused
      )
    );
    // Ses/konfeti burada ÇALINMIYOR: kuyrukta bekleyen uyarının sesi, önündeki
    // uyarı ekrandayken çalıyordu (görsel ile ses kayıyordu). Aşağıdaki etki,
    // uyarı gerçekten ekrana geldiğinde çalar.
  };

  /** Ses ve konfeti — gorsel asamadan bagimsiz, olay gelir gelmez. */
  const oynat = (alert: AlertItem) => {
    setImgError(false);

    if (denetimRef.current.muted) {
      // Uyarılar sessize alındı: görsel sürer, ses çalınmaz
    } else if (alert.soundUrl) {
      try {
        const audio = new Audio(alert.soundUrl);
        audio.volume = Math.max(0, Math.min(1, (alert.soundVolume ?? 0.7) * (advanced.globalVolume ?? 1)));
        // Ses dosyası yüklenemezse (internet yok, adres kalkmış) yerleşik zil: uyarı sessiz kalmasın, iki kez de çalmasın
        let yedekCaldi = false;
        const yedek = () => {
          if (yedekCaldi) return;
          yedekCaldi = true;
          playSynthesizedChime(alert.soundVolume);
        };
        audio.onerror = yedek;
        audio.play().catch(yedek);
      } catch {
        playSynthesizedChime(alert.soundVolume);
      }
    } else {
      playSynthesizedChime(alert.soundVolume);
    }

    // Olay başına efekt ve güç (B3): konfeti tuvalde, emote/sarsıntı/ışık kutunun kendisinde
    const k = advanced.confetti ? olayEfekti(alert.eventType, alert.amount, advanced as Record<string, unknown>) : null;
    if (k) {
      kutlamaIptal.current();
      if (EKRAN_EFEKTLERI.includes(k.tur)) {
        setEkranEfekti({ ...k, anahtar: Date.now() });
        const t = setTimeout(() => setEkranEfekti(null), EKRAN_EFEKTI_MS);
        kutlamaIptal.current = () => {
          clearTimeout(t);
          setEkranEfekti(null);
        };
      } else kutlamaIptal.current = kutla(k.tur, k.guc);
    }
  };

  // Açılışta güncel denetim durumu (OBS kaynağı yayın ortasında yeniden yüklenebilir)
  useEffect(() => {
    fetch('/api/alerts/control')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.state) setDenetim({ paused: !!d.state.paused, muted: !!d.state.muted });
      })
      .catch(() => {});
  }, []);

  // Panelden / moderatörden gelen denetim komutları
  useEffect(() => {
    if (!alertControl) return;
    const s = alertControl.state || {};
    setDenetim({ paused: !!s.paused, muted: !!s.muted });
    if (alertControl.action === 'skip' && advanced.skipEnabled !== false) {
      setKuyruk((d) => atla(d));
    } else if (alertControl.action === 'clear') {
      setKuyruk((d) => temizle(d));
    } else if (alertControl.alertId) {
      const id = String(alertControl.alertId);
      if (alertControl.action === 'play_now') setKuyruk((d) => simdiOynat(d, id));
      else if (alertControl.action === 'move_last') setKuyruk((d) => sonaAl(d, id));
      else if (alertControl.action === 'remove') setKuyruk((d) => sirdanCikar(d, id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alertControl]);

  useEffect(() => {
    if (activeAlert) enqueueAlert(normalizeAlert(activeAlert));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAlert]);

  // Uyarı ekrana gelince (aktif değişince) ses ve konfeti
  const sonCalinan = useRef<string>('');
  useEffect(() => {
    const oge = kuyruk.aktif;
    if (!oge || sonCalinan.current === oge.id) return;
    sonCalinan.current = oge.id;
    oynat(oge.veri as AlertItem);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuyruk.aktif?.id]);

  // Metin görünüm penceresi sınırında yeniden çiz (ör. 1500 ms'de metin belirsin)
  const [, setMetinSaati] = useState(0);
  useEffect(() => {
    if (!kuyruk.aktif) return;
    const gecen = Date.now() - kuyruk.aktifBaslangic;
    const kalan = sonrakiMetinSiniri(gecen, Number(advanced.textFromMs) || 0, Number(advanced.textToMs) || 0);
    if (kalan === null) return;
    const t = setTimeout(() => setMetinSaati((x) => x + 1), kalan + 5);
    return () => clearTimeout(t);
  });

  // Durum makinesini tam gerektiginde ilerlet — surekli setInterval yok.
  useEffect(() => {
    const bekle = sonrakiTik(kuyruk);
    if (bekle === null) return;
    const t = setTimeout(() => {
      setKuyruk((d) => {
        const yeni = ilerlet(d, Number(advanced.gapMs) || 0, Date.now(), denetimRef.current.paused);
        if (yeni.aktif === null && d.aktif !== null) setActiveAlert(null);
        return yeni;
      });
    }, bekle);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kuyruk, advanced.gapMs, denetim.paused]);

  // Mock alert for preview / OBS setup mode
  const mockPreviewAlert: AlertItem = {
    id: 'mock-alert-1',
    eventType: 'sub',
    title: '🎉 YENİ ABONE!',
    message: '@Ahmet_Kaya aramıza katıldı!',
    soundUrl: '',
    imageUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    durationMs: 5000,
    textColor: '#ffffff',
    accentColor: '#3EEDFE',
    animation: 'bounce',
    layoutMode: 'stacked',
    textEffect: 'shine',
    soundVolume: 0.7,
    amount: 0,
    isTest: true,
    user: 'Ahmet_Kaya'
  };

  const aktifUyari = (kuyruk.aktif?.veri as AlertItem | undefined) || null;
  const displayAlert = aktifUyari || (isPreview ? mockPreviewAlert : null);
  const animAdi = String((aktifUyari ? aktifUyari.animation : advanced.animation) || 'fade');
  const uyariId = aktifUyari?.id || (isPreview && displayAlert ? `onizleme-${animAdi}` : '');
  const asama: AnimAsamasi = !displayAlert
    ? 'hidden'
    : aktifUyari && kuyruk.asama === 'exiting'
      ? 'exiting'
      : 'visible';

  /**
   * Metin katmani gorunur mu?
   *
   * Örnek alınan botta "Metin gorunumu ms - ms" araligi var: gorsel/ses ile metnin
   * senkronize edilmesini saglar. 0-0 ise her zaman gorunur.
   */
  const metinGorunur = () => {
    // Önizlemede (aktif uyarı yok) metin hep görünür
    if (!kuyruk.aktif) return true;
    return metinPenceresiAcik(
      Date.now() - kuyruk.aktifBaslangic,
      Number(advanced.textFromMs) || 0,
      Number(advanced.textToMs) || 0
    );
  };

  // Metin efekti — CSS sinifi
  const getTextEffectClass = (fx?: string) => {
    switch (fx) {
      case 'wiggle': return 'animate-[pulse_1s_ease-in-out_infinite]';
      case 'wave': return 'tracking-widest animate-pulse';
      case 'shine': return 'drop-shadow-[0_0_15px_rgba(62,237,254,0.85)]';
      case 'skew': return '[transform:skewX(-8deg)]';
      case 'elastic': return 'animate-[bounce_1.2s_ease-in-out_infinite]';
      default: return '';
    }
  };

  return (
    <div 
      data-katman-bos={displayAlert ? undefined : ''}
      onClick={unlockAudio}
      className={`${embedded ? 'w-full h-full' : 'w-screen h-screen'} bg-transparent flex flex-col items-center justify-center overflow-hidden select-none cursor-pointer relative`}
      style={ekranEfekti?.tur === 'sarsinti' ? sarsintiStili(ekranEfekti.guc) : undefined}
    >
      {ekranEfekti && <EkranEfekti {...ekranEfekti} />}
      {/* Discreet Ready / Autoplay Unlock Banner */}
      {showHelper && !displayAlert && (
        <div className="absolute bottom-4 px-4 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-full text-[11px] text-gray-300 font-mono flex items-center gap-2 pointer-events-none transition-opacity">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>AxBoT AlertBox Hazır. Tarayıcıda ses için tıklayın.</span>
        </div>
      )}

      {displayAlert && (
        <div
          key={`${uyariId || 'yok'}-${animAdi}-${advanced.animationDuration}-${advanced.exitAnimation}`}
          {...kokOzellik(advanced as Record<string, any>)}
          style={{
            ...efektEkle(
              animStili(
                asama === 'exiting' ? cikisKimligi(animAdi, advanced.exitAnimation) : animAdi,
                asama,
                Math.max(0, Number(advanced.animationDuration) || 500)
              ),
              advanced as Record<string, any>,
              asama,
              Math.max(0, Number(advanced.animationDuration) || 500)
            ),
            ...kutuTasarimi(advanced as Record<string, any>)
          }}
          className={`p-4 max-w-full ${
            displayAlert.layoutMode === 'side-by-side'
              ? 'flex flex-row items-center justify-center gap-5 text-left'
              : displayAlert.layoutMode === 'text-over'
              ? 'relative flex flex-col items-center justify-center text-center'
              : 'flex flex-col items-center justify-center text-center'
          }`}
        >
          {advanced.ozelSablon ? (
            <div
              dangerouslySetInnerHTML={{
                __html: uyariSablonuHtml(String(advanced.ozelSablon), {
                  ad: displayAlert.user,
                  metin: displayAlert.title,
                  tutar: displayAlert.amount || '',
                  mesaj: advanced.hideUserMessage ? '' : displayAlert.message,
                  gorsel: displayAlert.imageUrl
                })
              }}
            />
          ) : (<>
          {/* Animated Image / GIF or Stylized Fallback */}
          {displayAlert.imageUrl && !imgError ? (
            <div className={`relative ${displayAlert.layoutMode === 'text-over' ? 'w-full max-h-56' : 'mb-3'} drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]`}>
              <img
                src={displayAlert.imageUrl}
                alt="Alert GIF"
                onError={() => setImgError(true)}
                style={{ maxHeight: `${Math.max(40, Number(advanced.imageMaxHeight) || 192)}px` }}
                className="object-contain rounded-2xl mx-auto"
              />
            </div>
          ) : (
            <div 
              data-yuzey=""
              className="w-20 h-20 mb-3 rounded-2xl flex items-center justify-center text-3xl shadow-2xl animate-bounce"
              style={{ backgroundColor: `${displayAlert.accentColor || '#3EEDFE'}33`, border: `2px solid ${displayAlert.accentColor || '#3EEDFE'}` }}
            >
              🔔
            </div>
          )}

          {/* Metin katmani.
              Örnek alınan botta ust ve alt metnin rengi, boyutu ve konumu AYRI
              ayarlaniyor; ayrica metnin gorunecegi ms araligi var. Bizde
              tek renk ve sabit boyut vardi. */}
          <div
            className={
              displayAlert.layoutMode === 'text-over'
                ? 'absolute inset-0 flex flex-col items-center justify-center p-3 bg-black/60 rounded-2xl'
                : ''
            }
            style={{
              transform: `translate(${Number(advanced.textOffsetX) || 0}px, ${Number(advanced.textOffsetY) || 0}px)`,
              opacity: metinGorunur() ? 1 : 0,
              transition: 'opacity 200ms ease',
              fontFamily: advanced.fontFamily
            }}
          >
            {/* Ust metin (baslik) */}
            <div
              className={`font-black uppercase tracking-wider font-display mb-1 ${getTextEffectClass(displayAlert.textEffect)}`}
              style={{
                color: (advanced.titleColor as string) || displayAlert.accentColor || '#3EEDFE',
                fontSize: `${Math.max(10, Number(advanced.titleSize) || 36)}px`,
                textShadow: `0 4px 12px rgba(0,0,0,${Math.max(0, Math.min(100, Number(advanced.textShadow) ?? 80)) / 100})`
              }}
            >
              {displayAlert.title}
            </div>

            {/* Alt metin (izleyici mesaji) */}
            {displayAlert.message && !advanced.hideUserMessage && (
              <div
                data-yuzey=""
                className="font-bold bg-black/80 px-4 py-1.5 rounded-full border border-white/20 backdrop-blur-md shadow-xl mt-1"
                style={{
                  color: (advanced.messageColor as string) || displayAlert.textColor || '#ffffff',
                  fontSize: `${Math.max(9, Number(advanced.messageSize) || 18)}px`,
                  textShadow: `0 3px 8px rgba(0,0,0,${Math.max(0, Math.min(100, Number(advanced.textShadow) ?? 80)) / 100})`
                }}
              >
                {displayAlert.message}
              </div>
            )}
          </div>
          </>)}
        </div>
      )}
    </div>
  );
}

export default AlertBoxWidget;
