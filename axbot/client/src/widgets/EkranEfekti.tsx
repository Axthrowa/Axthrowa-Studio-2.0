/**
 * Uyarı kutusunun ekran efektleri (B3): kanal emote yağmuru ve ışık süpürmesi katman olarak çizilir;
 * sarsıntı kutunun kökünde `sarsintiStili` ile uygulanır. Hepsi ~3 sn sürer, tıklamayı engellemez.
 */
import { memo, useMemo, type CSSProperties } from 'react';
import { useYediTvHaritasi } from '../lib/yediTv.js';
import { hareketAz } from '../lib/hareket.js';

export const EKRAN_EFEKTI_MS = 3200;

const CSS = `@keyframes axt-ef-dus { from { transform: translateY(-15vh) rotate(0deg); opacity: 1 } to { transform: translateY(115vh) rotate(var(--don)); opacity: .9 } }
@keyframes axt-ef-supur { from { transform: translateX(-120%) skewX(-18deg) } to { transform: translateX(220%) skewX(-18deg) } }
@keyframes axt-ef-sars { 0%,100% { transform: translate(0,0) } 10%,50%,90% { transform: translate(calc(var(--g) * -1), calc(var(--g) * .5)) } 30%,70% { transform: translate(var(--g), calc(var(--g) * -.5)) } }`;

/** Sarsıntı: güç 1'de 10 px genlik, 0.6 sn */
export function sarsintiStili(guc: number): CSSProperties {
  if (hareketAz()) return {};
  return { ['--g' as string]: `${Math.round(10 * guc)}px`, animation: 'axt-ef-sars 600ms ease-in-out 2' };
}

/** 7TV kanal emote'ları önce; hiç yoksa emoji */
function yagmurGorselleri(harita: ReadonlyMap<string, string>): string[] {
  const yediTv = [...harita.values()].filter((u) => u.startsWith('https://cdn.7tv.app/'));
  return yediTv.slice(-40);
}

export const EkranEfekti = memo(function EkranEfekti({ tur, guc, anahtar }: { tur: string; guc: number; anahtar: number }) {
  const harita = useYediTvHaritasi();
  const parcalar = useMemo(() => {
    if (tur !== 'emote') return [];
    const gorseller = yagmurGorselleri(harita);
    const adet = Math.round(26 * guc);
    // Kimlik (anahtar) değişince yeniden karılır; çizim sırasında Math.random kararlı kalsın diye burada
    return Array.from({ length: adet }, (_, i) => ({
      i,
      url: gorseller.length ? gorseller[Math.floor(Math.random() * gorseller.length)] : '',
      emoji: ['🎉', '💜', '⭐', '🔥'][i % 4],
      x: Math.random() * 96,
      gecikme: Math.random() * 900,
      sure: 1800 + Math.random() * 900,
      boy: 36 + Math.random() * 28,
      don: `${Math.round((Math.random() - 0.5) * 540)}deg`
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tur, guc, anahtar, harita.size]);

  if ((tur !== 'emote' && tur !== 'isik') || hareketAz()) return <style>{CSS}</style>;
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 5 }}>
      <style>{CSS}</style>
      {tur === 'isik' ? (
        <div
          key={anahtar}
          style={{
            position: 'absolute', top: '-20%', bottom: '-20%', left: 0, width: '45%',
            background: `linear-gradient(90deg, transparent, rgba(255,255,255,${(0.35 * guc).toFixed(2)}), transparent)`,
            animation: `axt-ef-supur ${Math.round(1400 / Math.max(0.5, guc))}ms ease-in-out 2`
          }}
        />
      ) : (
        parcalar.map((p) => (
          <div
            key={`${anahtar}-${p.i}`}
            style={{
              position: 'absolute', top: 0, left: `${p.x}%`, width: p.boy, height: p.boy, fontSize: p.boy * 0.8,
              ['--don' as string]: p.don,
              animation: `axt-ef-dus ${p.sure}ms linear ${p.gecikme}ms both`
            }}
          >
            {p.url ? <img src={p.url} alt="" referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : p.emoji}
          </div>
        ))
      )}
    </div>
  );
});
