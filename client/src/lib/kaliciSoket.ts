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
 */
export class KaliciSoket {
  onmessage: ((e: MessageEvent) => void) | null = null;
  /** Bağlantı (ilk açılış hariç) geri geldi — kaçırılan durumu yeniden okumak için. */
  onyenidenbaglandi: (() => void) | null = null;

  private ws: WebSocket | null = null;
  private kapandi = false;
  private zamanlayici: ReturnType<typeof setTimeout> | null = null;
  private deneme = 0;
  private baglandiMi = false;

  constructor(private readonly url: string) {
    this.baglan();
  }

  private baglan() {
    if (this.kapandi) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.planla();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.deneme = 0;
        // Galeri önizlemesi "Test et"i bu işaretle zamanlar (bkz. WidgetOnizleme)
        if (typeof window !== 'undefined') (window as unknown as { __axtSoketAcik?: boolean }).__axtSoketAcik = true;
      if (this.baglandiMi) this.onyenidenbaglandi?.();
      this.baglandiMi = true;
    };
    ws.onmessage = (e) => this.onmessage?.(e);
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      this.planla();
    };
  }

  private planla() {
    if (this.kapandi || this.zamanlayici) return;
    const bekle = Math.min(10_000, 1000 * 2 ** this.deneme++);
    this.zamanlayici = setTimeout(() => {
      this.zamanlayici = null;
      this.baglan();
    }, bekle);
  }

  close() {
    this.kapandi = true;
    if (this.zamanlayici) clearTimeout(this.zamanlayici);
    this.zamanlayici = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }
}
