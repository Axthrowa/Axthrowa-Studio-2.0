/**
 * AxBoT — kopunca kendi kendine yeniden bağlanan WebSocket.
 * Developed by AxthrowA
 *
 * OBS tarayıcı kaynakları saatlerce açık kalır. Birçok widget (jenerik, hype
 * treni, şu an çalan, sabit mesaj, shoutout, subathon, bağış kupası, sadakat
 * ödülleri) kendi soketini açıyor ve AxBoT bir kez yeniden başlayınca
 * (panel yeniden açıldı, güncelleme) bir daha hiç bağlanmıyordu: olaylar OBS'e
 * ulaşmıyor, "önizlemede var, OBS'te yok" görünüyordu.
 *
 * `new WebSocket(url)` yerine `new KaliciSoket(url)`: aynı `onmessage` /
 * `close()` yüzeyi; altta soket kapanırsa 1→10 sn artan beklemeyle yenisi açılır.
 *
 * Aynı adresi isteyen widget'lar tek bağlantıyı paylaşır: Tek URL sayfası 14 ayrı
 * soket açıyordu. Sunucu `init` iletisini bağlantı başına bir kez yolladığı için
 * sonradan katılana saklanan kopyası verilir.
 */
interface Kanal {
  url: string;
  ws: WebSocket | null;
  acik: boolean;
  uyeler: Set<KaliciSoket>;
  zamanlayici: ReturnType<typeof setTimeout> | null;
  deneme: number;
  baglandiMi: boolean;
  init: MessageEvent | null;
}

const kanallar = new Map<string, Kanal>();

/** Bir widget'ın hatası öbürlerinin iletisini kesmesin */
function dagit(k: Kanal, f: (u: KaliciSoket) => void) {
  for (const u of [...k.uyeler]) {
    try {
      f(u);
    } catch (e) {
      console.error('[WS] Dinleyici hatası:', e);
    }
  }
}

function planla(k: Kanal) {
  if (!k.uyeler.size || k.zamanlayici) return;
  const bekle = Math.min(10_000, 1000 * 2 ** k.deneme++);
  k.zamanlayici = setTimeout(() => {
    k.zamanlayici = null;
    baglan(k);
  }, bekle);
}

function baglan(k: Kanal) {
  if (!k.uyeler.size) return;
  let ws: WebSocket;
  try {
    ws = new WebSocket(k.url);
  } catch {
    planla(k);
    return;
  }
  k.ws = ws;
  ws.onopen = () => {
    k.deneme = 0;
    k.acik = true;
    // Galeri önizlemesi "Test et"i bu işaretle zamanlar (bkz. WidgetOnizleme)
    if (typeof window !== 'undefined') (window as unknown as { __axtSoketAcik?: boolean }).__axtSoketAcik = true;
    const yeniden = k.baglandiMi;
    k.baglandiMi = true;
    dagit(k, (u) => {
      u.onacildi?.();
      if (yeniden) u.onyenidenbaglandi?.();
    });
  };
  ws.onmessage = (e) => {
    if (typeof e.data === 'string' && e.data.startsWith('{"type":"init"')) k.init = e;
    dagit(k, (u) => u.onmessage?.(e));
  };
  ws.onclose = () => {
    if (k.ws === ws) k.ws = null;
    k.acik = false;
    k.init = null;
    dagit(k, (u) => u.onkapandi?.());
    planla(k);
  };
}

export class KaliciSoket {
  onmessage: ((e: MessageEvent) => void) | null = null;
  /** Bağlantı açıldı (sonradan katılana da bir kez söylenir). */
  onacildi: (() => void) | null = null;
  onkapandi: (() => void) | null = null;
  /** Bağlantı (ilk açılış hariç) geri geldi — kaçırılan durumu yeniden okumak için. */
  onyenidenbaglandi: (() => void) | null = null;

  private readonly kanal: Kanal;

  constructor(url: string) {
    let k = kanallar.get(url);
    const yeni = !k;
    if (!k) {
      k = { url, ws: null, acik: false, uyeler: new Set(), zamanlayici: null, deneme: 0, baglandiMi: false, init: null };
      kanallar.set(url, k);
    }
    this.kanal = k;
    k.uyeler.add(this);
    if (yeni) baglan(k);
    else if (k.acik) {
      const kanal = k;
      // Dinleyiciler kurucudan sonra atanır
      queueMicrotask(() => {
        if (!kanal.uyeler.has(this) || !kanal.acik) return;
        this.onacildi?.();
        if (kanal.init) this.onmessage?.(kanal.init);
      });
    }
  }

  /** Bağlantı açıksa gönderir. */
  send(veri: string): boolean {
    const ws = this.kanal.ws;
    if (!ws || !this.kanal.acik) return false;
    ws.send(veri);
    return true;
  }

  close() {
    const k = this.kanal;
    k.uyeler.delete(this);
    if (k.uyeler.size) return;
    if (kanallar.get(k.url) === k) kanallar.delete(k.url);
    if (k.zamanlayici) clearTimeout(k.zamanlayici);
    k.zamanlayici = null;
    const ws = k.ws;
    k.ws = null;
    k.acik = false;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }
}
