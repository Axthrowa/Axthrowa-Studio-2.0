/**
 * AxBoT sponsor ve iş birliği widget'ı: görsel, GIF ve videolar sırayla döner.
 * Developed by AxthrowA
 *
 * Adı bilerek "ads" değil: reklam engelleyiciler o adresleri kesiyor.
 * Liste boşsa yayında hiçbir şey çizmez; örnek yalnız önizlemede görünür.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SPONSOR_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeKipi, rgba, kutuTasarimi } from '../lib/widget-style.js';
import { efektEkle, animStili } from '../lib/animations.js';
import { guvenliMedya, ogeSuresiMs, ogeTuru, useDongu, type SponsorOgesi, asamaAnimasyonu } from '../lib/donenWidget.js';

export interface SponsorWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

export function SponsorWidget({ embedded = false, previewMode = false }: SponsorWidgetProps) {
  const s = useWidgetSettings('sponsor-banner', SPONSOR_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const ogeler: SponsorOgesi[] = (Array.isArray(s.ogeler) ? s.ogeler : []).filter((o: SponsorOgesi) => guvenliMedya(o?.url));
  const gecisMs = Math.max(0, Number(s.animationDuration) || 0);
  const { i, asama, gec, sabit } = useDongu(
    ogeler.length,
    (k) => ogeSuresiMs(ogeler[k], s.defaultSeconds),
    Math.max(0, Number(s.waitSeconds) || 0) * 1000,
    gecisMs
  );
  if (!ogeler.length && !onizleme) return null;

  const oge = ogeler[i];
  // Tek öğede atlamak aynı bozuk dosyayı durmadan yeniden denerdi
  const hatada = () => {
    if (ogeler.length > 1) gec();
  };
  const medyaStili = { objectFit: s.fit === 'cover' ? 'cover' : 'contain' } as const;
  const sureli = (Number(oge?.sure) || 0) > 0;

  return (
    <div className={`${embedded ? 'w-full h-full' : 'w-screen h-screen'} bg-transparent select-none overflow-hidden`} style={{ fontFamily: s.fontFamily }}>
      <div
        {...kokOzellik(s)}
        className="relative w-full h-full overflow-hidden"
        style={{ ...efektEkle(animStili(asamaAnimasyonu(s, oge ? asama : 'visible'), oge ? asama : 'visible', gecisMs), s, oge ? asama : 'visible', gecisMs), borderRadius: Number(s.radius) || 0, background: rgba(s.bgColor, s.bgOpacity), ...kutuTasarimi(s) }}
      >
        {!oge ? (
          <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-white/40 bg-black/60 text-white font-bold" style={{ borderRadius: 'inherit' }}>
            Sponsor görseli, GIF veya video
          </div>
        ) : ogeTuru(oge) === 'video' ? (
          <video
            key={`${i}-${oge.url}`}
            src={guvenliMedya(oge.url)}
            className="w-full h-full"
            style={medyaStili}
            autoPlay
            playsInline
            muted={!s.soundOn || onizleme}
            loop={sabit || sureli}
            onEnded={gec}
            onError={hatada}
          />
        ) : (
          <img key={`${i}-${oge.url}`} src={guvenliMedya(oge.url)} alt="" className="w-full h-full" style={medyaStili} onError={hatada} />
        )}
        {s.showCaption && oge?.metin && (
          <div
            className="absolute inset-x-0 bottom-0 truncate px-3 py-1.5 font-bold"
            style={{ color: s.captionColor, background: rgba(s.captionBgColor, s.captionBgOpacity), fontSize: Number(s.fontSize) || 18 }}
          >
            {oge.metin}
          </div>
        )}
      </div>
    </div>
  );
}

export default SponsorWidget;
