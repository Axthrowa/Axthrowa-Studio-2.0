/**
 * StreamAxT — Sesli komut dinleyicisi (tarayıcıda yerel konuşma tanıma)
 * Developed by AxthrowA
 *
 * Vosk (vosk-browser, Apache-2.0) WASM olarak bir Web Worker'da çalışır; mikrofon sesi bilgisayardan çıkmaz.
 * Model sunucudan (`/api/sesli/model.tar.gz`) bir kez yüklenir. Tanınan her cümle sunucuya gider; eşleştirme ve
 * eylem sunucuda yapılır. Mikrofonu aynı anda yalnız bir pencere tutar (Web Locks); durum, aynı kökendeki her
 * sekmeye BroadcastChannel ile yayılır.
 */
import { BasKonusKapisi, KANAL_ADI, KILIT_ADI, seviye, type DinlemeKipi, type DinleyiciDurumu, type KanalMesaji } from './kapi.js';

/** Tanıyıcı örnekleme hızı: model 16 kHz; tarayıcı mikrofonu buna kendisi örnekler */
const ORNEKLEME = 16000;

export interface DinleyiciSecenekleri {
  kip: DinlemeKipi;
  mikrofon: string;
}

type Model = Awaited<ReturnType<(typeof import('vosk-browser'))['createModel']>>;

export class SesliDinleyici {
  durum: DinleyiciDurumu = 'kapali';
  readonly kapi = new BasKonusKapisi();
  private kanal = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(KANAL_ADI) : null;
  private secenek: DinleyiciSecenekleri = { kip: 'ikisi', mikrofon: '' };
  private model: Model | null = null;
  private tanici: InstanceType<Model['KaldiRecognizer']> | null = null;
  private akis: MediaStream | null = null;
  private baglam: AudioContext | null = null;
  private islemci: ScriptProcessorNode | null = null;
  private kilitBirak: (() => void) | null = null;
  private sonSeviye = 0;
  private seviyeZamani = 0;
  private birakmaZamanlayici: ReturnType<typeof setTimeout> | null = null;
  /** Tanıyıcıya verilen ifade listesi (JSON); serbest tanımada null */
  private dilbilgisiJson: string | null = null;
  private yenileZamanlayici: ReturnType<typeof setInterval> | null = null;

  constructor(private sonucGeldi: (metin: string, basKonus: boolean) => Promise<{ ok: boolean; mesaj: string } | undefined>) {
    this.kanal?.addEventListener('message', (e) => {
      const m = e.data as KanalMesaji;
      if (m?.tur === 'ptt') this.basKonus(m.basili);
      else if (m?.tur === 'durum-sor') this.durumYay();
    });
  }

  private yay(m: KanalMesaji) {
    try {
      this.kanal?.postMessage(m);
    } catch {
      /* kanal kapandı */
    }
  }

  private durumYap(d: DinleyiciDurumu, mesaj?: string) {
    this.durum = d;
    this.durumYay(mesaj);
  }

  private durumYay(mesaj?: string) {
    this.yay({ tur: 'durum', durum: this.durum, mesaj, seviye: this.sonSeviye, basili: this.kapi.basili });
  }

  secenekleriAyarla(s: Partial<DinleyiciSecenekleri>) {
    const mikrofonDegisti = s.mikrofon !== undefined && s.mikrofon !== this.secenek.mikrofon;
    this.secenek = { ...this.secenek, ...s };
    if (mikrofonDegisti && this.durum === 'dinliyor') void this.yenidenBaslat();
  }

  private async yenidenBaslat() {
    this.mikrofonuKapat();
    await this.mikrofonuAc().catch((e) => this.durumYap('hata', mikrofonHatasi(e)));
  }

  /** Dinlemeyi başlatır. Başka bir pencere dinliyorsa `baska-pencerede` olur ve beklemez. */
  async baslat(): Promise<void> {
    if (this.durum === 'dinliyor' || this.durum === 'yukleniyor') return;
    if (typeof navigator !== 'undefined' && navigator.locks) {
      const alindi = await new Promise<boolean>((coz) => {
        void navigator.locks.request(KILIT_ADI, { ifAvailable: true }, (kilit) => {
          if (!kilit) {
            coz(false);
            return;
          }
          coz(true);
          return new Promise<void>((birak) => (this.kilitBirak = birak));
        });
      });
      if (!alindi) {
        this.durumYap('baska-pencerede', 'Mikrofonu başka bir pencere/sekme dinliyor');
        return;
      }
    }
    try {
      this.durumYap('yukleniyor', 'Konuşma modeli yükleniyor…');
      if (!this.model) {
        const durum = await fetch('/api/sesli/model').then((r) => r.json());
        if (durum?.durum !== 'hazir') {
          this.kilidiBirak();
          this.durumYap('model-yok', 'Önce Sesli Komutlar sayfasından Türkçe modeli indirin');
          return;
        }
        const { createModel } = await import('vosk-browser');
        // İşçi blob adresinden çalışır; göreli adres çözülemez — tam adres verilir
        this.model = await createModel(new URL('/api/sesli/model.tar.gz', window.location.href).href, -1);
      }
      this.dilbilgisiJson = await dilbilgisiAl();
      this.taniciKur();
      await this.mikrofonuAc();
      this.durumYap('dinliyor', '');
      // Ses panosuna öğe eklenince de liste değişir (bildirimi yok); arada bir yenile
      this.yenileZamanlayici = setInterval(() => void this.dilbilgisiYenile(), 60_000);
    } catch (e) {
      this.durdur();
      this.durumYap('hata', mikrofonHatasi(e));
    }
  }

  private taniciKur() {
    if (!this.model) return;
    try {
      this.tanici?.remove();
    } catch {
      /* */
    }
    this.tanici = this.dilbilgisiJson
      ? new this.model.KaldiRecognizer(ORNEKLEME, this.dilbilgisiJson)
      : new this.model.KaldiRecognizer(ORNEKLEME);
    this.tanici.on('result', (m: any) => {
      // Dilbilgisinde tanınmayan konuşma "[unk]" olarak gelir
      const metin = String(m?.result?.text ?? '').replace(/\[unk\]/g, ' ').replace(/\s+/g, ' ').trim();
      if (metin) void this.sonuc(metin);
    });
    this.tanici.on('partialresult', (m: any) => {
      const metin = String(m?.result?.partial ?? '').replace(/\[unk\]/g, ' ').trim();
      if (metin) this.yay({ tur: 'kismi', metin });
    });
  }

  /** Komutlar/ayarlar değişti: ifade listesi farklıysa tanıyıcıyı yeniden kur (model yeniden yüklenmez) */
  async dilbilgisiYenile() {
    if (this.durum !== 'dinliyor') return;
    const yeni = await dilbilgisiAl().catch(() => this.dilbilgisiJson);
    if (yeni === this.dilbilgisiJson) return;
    this.dilbilgisiJson = yeni;
    this.taniciKur();
  }

  private async sonuc(metin: string) {
    const basKonus = this.kapi.basKonusMu();
    this.yay({ tur: 'sonuc', metin, basKonus });
    try {
      const yanit = await this.sonucGeldi(metin, basKonus);
      if (yanit) this.yay({ tur: 'sonuc', metin, basKonus, yanit });
    } catch {
      /* sunucuya ulaşılamadı; bir sonraki cümlede yeniden denenir */
    }
  }

  private async mikrofonuAc() {
    this.akis = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: this.secenek.mikrofon ? { exact: this.secenek.mikrofon } : undefined,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    this.baglam = new AudioContext({ sampleRate: ORNEKLEME });
    if (this.baglam.state === 'suspended') await this.baglam.resume().catch(() => {});
    const kaynak = this.baglam.createMediaStreamSource(this.akis);
    // ScriptProcessor eski ama her tarayıcıda (WebView2, OBS'in CEF'i dahil) çalışır; 4096 örnek ≈ 256 ms
    this.islemci = this.baglam.createScriptProcessor(4096, 1, 1);
    this.islemci.onaudioprocess = (e) => {
      const simdi = Date.now();
      const veri = e.inputBuffer.getChannelData(0);
      if (simdi - this.seviyeZamani > 150) {
        this.seviyeZamani = simdi;
        this.sonSeviye = seviye(veri);
        this.durumYay();
      }
      if (!this.tanici || !this.kapi.sesGecsin(this.secenek.kip, simdi)) return;
      try {
        this.tanici.acceptWaveform(e.inputBuffer);
      } catch {
        /* tanıyıcı kapandı */
      }
    };
    kaynak.connect(this.islemci);
    // Chrome işlemciyi ancak bir hedefe bağlıysa çalıştırıyor; çıkış sessiz (yazılmıyor)
    this.islemci.connect(this.baglam.destination);
  }

  /** Bas-konuş tuşu */
  basKonus(basili: boolean) {
    if (basili) {
      if (this.birakmaZamanlayici) clearTimeout(this.birakmaZamanlayici);
      this.kapi.bas();
    } else if (this.kapi.basili) {
      this.kapi.birak();
      // Kuyruk süresi dolunca cümleyi bitmiş say: tanıyıcı sessizlik beklemeden sonucu versin
      this.birakmaZamanlayici = setTimeout(() => {
        try {
          this.tanici?.retrieveFinalResult();
        } catch {
          /* */
        }
      }, 650);
    }
    this.durumYay();
  }

  private mikrofonuKapat() {
    try {
      this.islemci?.disconnect();
    } catch {
      /* */
    }
    this.islemci = null;
    this.akis?.getTracks().forEach((t) => t.stop());
    this.akis = null;
    void this.baglam?.close().catch(() => {});
    this.baglam = null;
  }

  private kilidiBirak() {
    this.kilitBirak?.();
    this.kilitBirak = null;
  }

  durdur() {
    if (this.yenileZamanlayici) clearInterval(this.yenileZamanlayici);
    this.yenileZamanlayici = null;
    this.mikrofonuKapat();
    try {
      this.tanici?.remove();
    } catch {
      /* */
    }
    this.tanici = null;
    this.kilidiBirak();
    this.sonSeviye = 0;
    if (this.durum !== 'model-yok') this.durumYap('kapali');
  }

  /** Sayfa kapanırken: model işçisini de bırak */
  yokEt() {
    this.durdur();
    try {
      this.model?.terminate();
    } catch {
      /* */
    }
    this.model = null;
    this.kanal?.close();
  }
}

function mikrofonHatasi(e: unknown): string {
  const ad = (e as any)?.name;
  if (ad === 'NotAllowedError') return 'Mikrofon izni verilmedi';
  if (ad === 'NotFoundError' || ad === 'OverconstrainedError') return 'Seçili mikrofon bulunamadı';
  if (ad === 'NotReadableError') return 'Mikrofon başka bir uygulama tarafından kullanılıyor';
  return String((e as any)?.message || e);
}

/** Sunucudan ifade listesi (JSON metni) ya da serbest tanıma için null */
async function dilbilgisiAl(): Promise<string | null> {
  const r = await fetch('/api/sesli/dilbilgisi').then((x) => x.json());
  return Array.isArray(r?.ifadeler) && r.ifadeler.length ? JSON.stringify(r.ifadeler) : null;
}

/** Tanınan cümleyi sunucuya gönder */
export async function sunucuyaGonder(metin: string, basKonus: boolean): Promise<{ ok: boolean; mesaj: string }> {
  const r = await fetch('/api/sesli/calistir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metin, basKonus })
  });
  return r.json();
}
