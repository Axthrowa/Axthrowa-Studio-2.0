/**
 * Panel önizlemesinin kalite bütçesi.
 *
 * Önizleme, OBS ile birebir aynı görünmesi için overlay'i gerçek 1920×1080
 * tuvalinde çizip CSS `transform: scale()` ile küçültüyor. Yerleşim için doğru
 * ama pahalı: tuval ~500 px'lik bir kutuda görünse bile parçacık tuvalinin
 * arka belleği 1920×1080 (2,07 M piksel) kalıyor ve her karede o kadar piksel
 * temizlenip yeniden çiziliyor.
 *
 * Bu bağlam, alt bileşenlere "gerçekte ne kadar yer kaplıyorsun" bilgisini
 * taşıyor. Çizim koordinatları mantıksal 1920×1080 uzayında kalır, yalnızca
 * arka bellek çözünürlüğü ve kare hızı düşer — yani görünüm değişmez.
 */

import { createContext, useContext, useMemo } from "react";

export type PreviewQuality = {
  /**
   * Arka bellek çözünürlüğü çarpanı. `1` = tam çözünürlük (OBS / tarayıcı
   * kaynağı). Panel önizlemesinde kutunun 1920 px'e oranı.
   */
  scale: number;
  /** Hedef kare hızı. Önizlemede düşürülür; OBS'te sınırsız (60+). */
  maxFps: number;
  /** Panel önizlemesi mi? Video kalitesi gibi kararlar buna bakıyor. */
  preview: boolean;
};

const TAM_KALITE: PreviewQuality = { scale: 1, maxFps: 0, preview: false };

const Ctx = createContext<PreviewQuality>(TAM_KALITE);

export function usePreviewQuality(): PreviewQuality {
  return useContext(Ctx);
}

/**
 * Önizleme kutusunun ölçeğini alt bileşenlere duyurur.
 *
 * @param scale Kutunun 1920 px tuvale oranı (`LivePreview` hesaplıyor).
 */
export function PreviewQualityProvider({
  scale,
  children,
}: {
  scale: number;
  children: React.ReactNode;
}) {
  const value = useMemo<PreviewQuality>(
    () => ({
      // Çok küçük kutularda parçacıklar lapaya dönmesin diye alt sınır var.
      // Ölçek yalnızca kaba adımlarla değişsin: her piksel oynamasında tuvali
      // yeniden boyutlandırmak parçacıkları sıçratıyordu.
      scale: Math.max(0.2, Math.min(1, Math.round(scale * 20) / 20)),
      maxFps: 30,
      preview: true,
    }),
    [scale]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
