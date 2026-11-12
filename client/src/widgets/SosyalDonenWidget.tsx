/**
 * AxBoT dönen sosyal medya widget'ı: eklenen hesaplar sırayla gösterilir.
 * Developed by AxthrowA
 *
 * Hesap eklenmemişse yayında hiçbir şey çizmez; örnek yalnız önizlemede görünür.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { ortakHareket } from '../lib/animations.js';
import type { CSSProperties } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { SOCIAL_ROTATOR_DEFAULTS } from '../lib/widget-defaults.js';
import { dikey, kutuTasarimi, onizlemeKipi, rgba, yatay } from '../lib/widget-style.js';
import { animStili } from '../lib/animations.js';
import { asamaAnimasyonu, donenSahneAnahtari, hesapMetni, useDongu } from '../lib/donenWidget.js';
import { SOSYAL_DIGER, SOSYAL_PLATFORMLAR } from '../lib/sosyalPlatformlar.js';

export interface SosyalDonenWidgetProps {
  embedded?: boolean;
  previewMode?: boolean;
}

const ORNEK = [
  { platform: 'kick', kullanici: 'kanaladiniz' },
  { platform: 'instagram', kullanici: 'kanaladiniz' },
  { platform: 'discord', kullanici: 'discord.gg/davet' }
];

export function SosyalDonenWidget({ embedded = false, previewMode = false }: SosyalDonenWidgetProps) {
  const s = useWidgetSettings('social-rotator', SOCIAL_ROTATOR_DEFAULTS);
  const onizleme = onizlemeKipi(previewMode);
  const kayitli = (Array.isArray(s.hesaplar) ? s.hesaplar : []).filter((h: any) => hesapMetni(h?.platform, h?.kullanici, SOSYAL_PLATFORMLAR[h?.platform]?.grup === 'oyun'));
  const hesaplar: Array<{ platform: string; kullanici: string }> = kayitli.length ? kayitli : onizleme ? ORNEK : [];
  const gecisMs = Math.max(0, Number(s.animationDuration) || 0);
  const { i, asama } = useDongu(
    hesaplar.length,
    () => (Number(s.itemSeconds) || 6) * 1000,
    Math.max(0, Number(s.waitSeconds) || 0) * 1000,
    gecisMs
  );
  if (!hesaplar.length) return null;

  const hesap = hesaplar[i];
  const meta = SOSYAL_PLATFORMLAR[hesap.platform] || SOSYAL_DIGER;
  const vurgu = s.platformColors ? meta.color : s.accentColor;
  const ikonRengi = s.platformColors ? meta.iconFill : '#000000';
  const boy = Number(s.fontSize) || 22;
  const ikon = Number(s.iconSize) || 44;
  const tema = String(s.theme || 'kart');
  // Simge biçimi: kare (yumuşak köşe), yuvarlak, keskin kare ya da zeminsiz yalnız logo
  const sekil = String(s.ikonSekli || (tema === 'hap' ? 'yuvarlak' : 'kare'));
  const yalnizLogo = sekil === 'logo';
  const logoRengi = s.platformColors ? meta.logo || meta.color : s.accentColor;
  const kose: Record<string, number | string> = { kare: Math.round(ikon * 0.27), yuvarlak: 999, keskin: 4, logo: 0 };
  const temaStili: Record<string, CSSProperties> = {
    kart: { background: rgba(s.bgColor, s.bgOpacity), border: `1px solid ${rgba(vurgu, 0.55)}`, borderRadius: Number(s.radius) || 0 },
    hap: { background: rgba(s.bgColor, s.bgOpacity), borderRadius: 999 },
    neon: { background: rgba(s.bgColor, s.bgOpacity), border: `2px solid ${vurgu}`, boxShadow: `0 0 18px ${rgba(vurgu, 0.65)}`, borderRadius: Number(s.radius) || 0 },
    sade: { background: 'transparent' }
  };

  return (
    <div
      className={`${embedded ? 'w-full h-full p-0' : 'w-screen h-screen p-6'} bg-transparent flex select-none overflow-hidden`}
      style={{ alignItems: dikey(s.position), justifyContent: yatay(s.align), fontFamily: s.fontFamily }}
    >
      <div key={donenSahneAnahtari(i, asama, s)} style={animStili(asamaAnimasyonu(s, asama), asama, gecisMs)}>
        <div {...kokOzellik(s)}
          data-sosyal-hesap={hesap.platform}
          className="inline-flex items-center gap-3"
          style={{ ...(kutuTasarimi(s) || temaStili[tema] || temaStili.kart), ...ortakHareket(s, { giris: false }), padding: tema === 'sade' ? 0 : '10px 18px 10px 10px', color: s.textColor }}
        >
          <span
            data-ikon-sekli={sekil}
            className="flex shrink-0 items-center justify-center"
            style={{ width: ikon, height: ikon, background: yalnizLogo ? 'transparent' : vurgu, borderRadius: kose[sekil] ?? kose.kare }}
          >
            <svg viewBox="0 0 24 24" width={ikon * (yalnizLogo ? 0.9 : 0.58)} height={ikon * (yalnizLogo ? 0.9 : 0.58)} fill={yalnizLogo ? logoRengi : ikonRengi} aria-hidden>
              <path d={meta.path} />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            {s.showPlatformName && <span style={{ fontSize: Math.round(boy * 0.6), opacity: 0.75 }}>{s.prefix || meta.label}</span>}
            <span className="font-bold whitespace-nowrap" style={{ fontSize: boy }}>{hesapMetni(hesap.platform, hesap.kullanici, meta.grup === 'oyun')}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export default SosyalDonenWidget;
