/**
 * StreamAxT — "Şu An Çalan" = Resonance müzik çaları overlay'i
 * Developed by AxthrowA
 *
 * Eski "Şu An Çalan" kartı yalnız şarkı isteği kuyruğunu gösteriyordu.
 * Yerini Resonance aldı: Spotify / YouTube Music'te GERÇEKTEN çalan parça,
 * kapak, ilerleme ve Resonance'ta seçilen tema (StreamAxT /resonance/).
 * Eski /widgets/now-playing OBS adresi de bunu gösterir (kaynaklar bozulmasın).
 */
export function ResonanceWidget({ embedded = false }: { embedded?: boolean; previewMode?: boolean }) {
  return (
    <iframe
      title="Resonance — Şu An Çalan"
      src="/resonance/overlay"
      style={{
        border: 0,
        width: embedded ? '100%' : '100vw',
        height: embedded ? '100%' : '100vh',
        background: 'transparent',
        colorScheme: 'normal',
        pointerEvents: 'none'
      }}
      allowTransparency
    />
  );
}

export default ResonanceWidget;
