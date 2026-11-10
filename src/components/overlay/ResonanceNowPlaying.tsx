import { useEffect, useRef, useState } from "react";
import { API_BASE } from "../../lib/api";

/** Resonance'ta seçili profilin kaydedildiği sabit anahtar */
const ACTIVE_OVERLAY_ID = "aktif";

type Props = {
  /** Panelde konumlandırabilmek için boşken de çerçeveyi göster */
  placeholder?: boolean;
  /** Müzik çalmıyorken kartı gizle */
  hideWhenIdle?: boolean;
  /** Resonance kurulu değilse yerleşik karta düşmek için */
  onUnavailable?: () => void;
};

/**
 * Kısa buffer/seek titremesini önlemek için; uzun tutmak “geç tepki” hissi veriyor.
 * Kartın çıkış animasyonundan (≈320 ms + yay) uzun olmalı ki animasyon
 * kesilmeden bitsin.
 */
const HIDE_DELAY_MS = 400;

/** İlk çerçeve ölçüsü — gerçek boyut sayfadan gelene kadar */
const INITIAL = { width: 420, height: 150, kart: 0 };

/** Çerçevenin servis edildiği köken (panelinkinden farklı olabilir) */
const HOST_ORIGIN = (() => {
  try {
    return new URL(API_BASE).origin;
  } catch {
    return API_BASE;
  }
})();

/**
 * Giriş / Çıkış / Mola ekranlarındaki "şimdi çalıyor" katmanı.
 *
 * Kartı burada yeniden çizmek yerine Resonance'ın kendi overlay sayfasını
 * gömüyoruz: kullanıcı Resonance'ta hangi temayı/skini seçtiyse bu ekranlarda
 * da birebir o görünüyor. İki ayrı çizim kodu tutulsaydı temalar kaçınılmaz
 * olarak ayrışırdı.
 */
export default function ResonanceNowPlaying({
  placeholder,
  hideWhenIdle = true,
  onUnavailable,
}: Props) {
  const [ready, setReady] = useState<boolean | null>(null);
  // Kart ölçüsü temaya göre değişiyor; sayfa kendi boyutunu bildiriyor.
  const [size, setSize] = useState(INITIAL);
  const [playing, setPlaying] = useState(false);
  const hideTimer = useRef<number | null>(null);
  const lastLive = useRef<boolean | null>(null);

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      // Paketlenmiş uygulamada panel Tauri'nin kendi protokolünden yükleniyor
      // (`http://tauri.localhost`), çerçeve ise 127.0.0.1:8843'ten — yani
      // farklı köken. `window.location.origin` ile karşılaştırınca boyut
      // mesajı eleniyor, çerçeve başlangıç ölçüsünde kalıp kartı kesiyordu.
      if (ev.origin !== HOST_ORIGIN && ev.origin !== window.location.origin) return;
      const d = ev.data as {
        source?: string;
        type?: string;
        width?: number;
        height?: number;
        /** Yalnız kartın boyu: ekrandaki konum buna göre, sözler dahil değil */
        kart?: number;
        hasTrack?: boolean;
        isPlaying?: boolean;
        /** Resonance kartının kendi görünürlük kuralı (hideOnPause vb.) */
        visible?: boolean;
      };
      if (d?.source !== "resonance-overlay") return;
      // Eski sürüm "size" gönderiyordu; ikisini de kabul et.
      if (d.type !== "state" && d.type !== "size") return;

      const w = Number(d.width);
      const h = Number(d.height);
      if (Number.isFinite(w) && Number.isFinite(h) && w >= 40 && h >= 20) {
        const kart = Number(d.kart) >= 20 ? Number(d.kart) : 0;
        setSize((prev) =>
          Math.abs(prev.width - w) < 2 && Math.abs(prev.height - h) < 2 && (!kart || Math.abs(prev.kart - kart) < 2)
            ? prev
            : { width: Math.min(1600, w), height: Math.min(900, h), kart: kart || prev.kart }
        );
      }

      if (d.type !== "state") return;
      // Tek kaynak: Resonance overlay'in `visible` bayrağı. Eskiden yalnızca
      // isPlaying bakılıyordu — Pulse önizlemesi temayı gösterirken OBS'te
      // (Giriş/Bitiş/Mola) kart kayboluyordu / yanlış temaya düşülüyordu.
      const live =
        typeof d.visible === "boolean"
          ? d.visible
          : Boolean(d.hasTrack) && Boolean(d.isPlaying);
      // Durum aynıysa hiçbir şey yapma — her mesajda sayacı sıfırlamak
      // gizlemeyi sürekli erteleyebilir.
      if (live === lastLive.current) return;
      lastLive.current = live;

      if (hideTimer.current) {
        window.clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (live) {
        setPlaying(true);
      } else {
        // Kısa duraklamalarda kart yanıp sönmesin.
        hideTimer.current = window.setTimeout(() => setPlaying(false), HIDE_DELAY_MS);
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  // Panelde konumlandırma için her zaman görünür kalsın.
  const shown = placeholder || !hideWhenIdle || playing;

  useEffect(() => {
    let cancelled = false;
    // Çerçevenin açacağı yol sınanır; Resonance'sız sunucu buraya Studio'nun index.html'ini döndürür (çerçevede Studio açılırdı)
    fetch(`${API_BASE}/resonance/overlay`, { cache: "no-store" })
      .then(async (r) => r.ok && (await r.text()).includes("<title>Resonance</title>"))
      .then((resonance) => {
        if (cancelled) return;
        setReady(resonance);
        if (!resonance) onUnavailable?.();
      })
      .catch(() => {
        if (cancelled) return;
        setReady(false);
        onUnavailable?.();
      });
    return () => {
      cancelled = true;
    };
  }, [onUnavailable]);

  if (ready === false) return null;

  return (
    <div
      className="np-frame"
      style={{
        width: size.width,
        // Konum merkezden hesaplanır: sözler boyu değiştirince kart yukarı aşağı oynamasın diye yalnız kartın boyu sayılır
        height: size.kart || size.height,
        position: "relative",
        // Sürüklemeyi iframe yutmasın; katman zaten etkileşimsiz.
        pointerEvents: "none",
        outline: placeholder ? "1px dashed rgba(255,255,255,.25)" : undefined,
        // Çerçeveyi unmount etmiyoruz: kaldırılırsa köprü de kopar ve
        // müzik yeniden başladığında kart gecikmeli döner.
        opacity: shown ? 1 : 0,
        // Geçiş YOK: kartın kendi giriş/çıkış animasyonu (Resonance'ta seçilen)
        // burada oynuyor. Eskiden çerçeve ayrıca 0,35 sn'lik bir solma
        // uyguluyordu; giriş animasyonunun ilk yarısı bunun altında kalıyor,
        // "animasyonlar çalışmıyor" gibi görünüyordu. Çıkışta kart zaten kendi
        // animasyonuyla kayboluyor (HIDE_DELAY_MS bunu bekler).
        transition: "none",
      }}
    >
      {ready && (
        <iframe
          title="Şimdi Çalıyor"
          // Panel önizlemesinde şarkı çalmıyorsa Resonance örnek parçayı gösterir; OBS'te (placeholder yok) gösterilmez
          src={`${API_BASE}/resonance/overlay?p=${ACTIVE_OVERLAY_ID}&embed=1${placeholder ? "&ornek=1" : ""}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: size.height,
            border: 0,
            background: "transparent",
            colorScheme: "normal",
          }}
          // Aynı köken; betik dışında bir yetkiye gerek yok
          sandbox="allow-scripts allow-same-origin"
          scrolling="no"
        />
      )}
    </div>
  );
}
