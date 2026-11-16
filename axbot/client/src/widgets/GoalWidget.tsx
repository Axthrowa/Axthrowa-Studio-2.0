/**
 * AxBoT Goal overlay — donation / follower / sub / kicks
 * Developed by AxthrowA
 */
import { kutla } from '../lib/kutlama.js';
import { animBul, animKimligi, efektAnimasyonu, eskiHareketiCevir, hareketAnahtari, ortakHareket } from '../lib/animations.js';
import { kokOzellik } from '../lib/kabuklar.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import type { GOAL_DEFAULTS } from '../lib/widget-defaults.js';

/** Hedef çubuğunun ayrı ayrı canlandırılabilen parçaları (panelde her biri için giriş + sürekli efekt) */
export const HEDEF_PARCALARI = ['baslik', 'rakam', 'bar', 'dolgu', 'simge'] as const;
export type HedefParcasi = (typeof HEDEF_PARCALARI)[number];

/** Eski tek "efekt nereye" seçimi hangi parçaları kapsıyordu */
function eskiHedefKapsar(hedef: string, parca: HedefParcasi): boolean {
  return hedef === 'yazi' ? parca === 'baslik' || parca === 'rakam' : hedef === parca;
}

/**
 * Bir parçanın kendi girişi ve sürekli efekti. Girişler kutunun girişinden sonra sırayla gelir;
 * efekt "genel" ise eski tek hedef ayarı (surekliEfekt + efektHedefi) geçerli kalır.
 */
export function parcaHareketi(ham: Record<string, any>, parca: HedefParcasi, kokGirisMs: number): CSSProperties {
  const s = eskiHareketiCevir(ham);
  const giris = animBul(animKimligi(String(s[`${parca}Giris`] || 'none')));
  const sure = Math.max(0, Number(s.animationDuration) || 600);
  const gecikme = kokGirisMs + HEDEF_PARCALARI.indexOf(parca) * 120;
  const girisVar = giris.id !== 'none';
  const secim = String(s[`${parca}Efekti`] || 'genel');
  const efektId = secim === 'genel' ? (eskiHedefKapsar(String(s.efektHedefi || 'bar'), parca) ? s.surekliEfekt : 'none') : secim;
  const parcalar: string[] = [];
  if (girisVar) parcalar.push(`axt-on-${giris.id} ${sure}ms ${giris.easing || 'cubic-bezier(0.22, 1, 0.36, 1)'} ${gecikme}ms both`);
  const efekt = efektAnimasyonu(efektId, s.efektSuresi, girisVar ? gecikme + sure : 0);
  if (efekt) parcalar.push(efekt);
  return parcalar.length ? { animation: parcalar.join(', ') } : {};
}

const emojiResimleri = new Map<string, string | null>();
/**
 * Emoji, görünen kısmına kırpılmış resim olarak: yazı tipinde emojiler kutusunda ortalı değil (araba alta,
 * bazıları yana kaçar), barın ortasına oturtmanın tek güvenilir yolu gerçek pikselleri ölçmek.
 */
export function emojiResmi(emoji: string): string | null {
  if (emojiResimleri.has(emoji)) return emojiResimleri.get(emoji)!;
  let sonuc: string | null = null;
  try {
    const B = 160;
    const c = document.createElement('canvas');
    c.width = c.height = B * 2;
    const x = c.getContext('2d', { willReadFrequently: true });
    if (x) {
      x.font = `${B}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(emoji, B, B);
      const d = x.getImageData(0, 0, B * 2, B * 2).data;
      let sol = B * 2, sag = -1, ust = B * 2, alt = -1;
      for (let py = 0; py < B * 2; py++)
        for (let px = 0; px < B * 2; px++)
          if (d[(py * B * 2 + px) * 4 + 3] > 30) {
            sol = Math.min(sol, px); sag = Math.max(sag, px); ust = Math.min(ust, py); alt = Math.max(alt, py);
          }
      if (sag >= 0) {
        const kk = Math.max(sag - sol, alt - ust) + 1;
        const k = document.createElement('canvas');
        k.width = k.height = kk;
        k.getContext('2d')!.drawImage(c, sol, ust, sag - sol + 1, alt - ust + 1, (kk - (sag - sol + 1)) / 2, (kk - (alt - ust + 1)) / 2, sag - sol + 1, alt - ust + 1);
        sonuc = k.toDataURL();
      }
    }
  } catch {
    /* tuval yok: emoji yazı olarak kalır */
  }
  emojiResimleri.set(emoji, sonuc);
  return sonuc;
}

function tabanHedefKimligi() {
  const params = new URLSearchParams(window.location.search);
  const type = params.get('type');
  if (type === 'follower') return 'follower-goal';
  if (type === 'sub') return 'subscriber-goal';
  if (type === 'kicks') return 'kicks-goal';
  if (type === 'tip' || type === 'donation') return 'donation-goal';
  const path = window.location.pathname;
  if (path.includes('follower-goal')) return 'follower-goal';
  if (path.includes('subscriber-goal')) return 'subscriber-goal';
  if (path.includes('kicks-goal')) return 'kicks-goal';
  return 'donation-goal';
}

/** `?hedef=2` ile aynı türden ayrı bir hedef çubuğu (kendi ayarı ve ilerlemesi olur) */
function widgetIdFromPath() {
  const n = Number(new URLSearchParams(window.location.search).get('hedef'));
  return Number.isInteger(n) && n >= 2 && n <= 99 ? `${tabanHedefKimligi()}-${n}` : tabanHedefKimligi();
}

/** Çubuk dolgusu: düz, iki renk geçişi, akan çizgili ya da üstten parlak */
export function dolguArkaPlani(stil: string, renk: string, renk2: string): CSSProperties {
  if (stil === 'gradient') return { background: `linear-gradient(90deg, ${renk}, ${renk2})` };
  if (stil === 'striped' || stil === 'parilti') return { background: `linear-gradient(90deg, ${renk}, ${renk2})` };
  if (stil === 'pil')
    return { background: `repeating-linear-gradient(90deg, transparent 0 14px, rgba(0,0,0,.7) 14px 17px), linear-gradient(90deg, ${renk}, ${renk2})` };
  if (stil === 'dalga' || stil === 'kama' || stil === 'noktalar') return { background: `linear-gradient(90deg, ${renk}, ${renk2})` };
  if (stil === 'segment')
    return { background: `repeating-linear-gradient(90deg, transparent 0 16px, rgba(0,0,0,.55) 16px 20px), linear-gradient(90deg, ${renk}, ${renk2})` };
  if (stil === 'glossy') return { background: `linear-gradient(180deg, rgba(255,255,255,.45), rgba(255,255,255,0) 55%), linear-gradient(90deg, ${renk}, ${renk2})` };
  return { background: renk };
}

/** Biçimi değişen çubuklar: kutunun kendisi kesilir (kama, noktalar), dolgu aynı kalır */
export function barBicimi(stil: string, barH: number): CSSProperties {
  if (stil === 'kama') return { clipPath: 'polygon(0 72%, 100% 0, 100% 100%, 0 100%)', borderRadius: 0 };
  if (stil === 'noktalar') {
    const maske = `radial-gradient(circle at center, #000 62%, transparent 64%) 0 0 / ${barH}px ${barH}px repeat-x`;
    return { WebkitMask: maske, mask: maske, borderRadius: 0, boxShadow: 'none' };
  }
  if (stil === 'pil') return { borderRadius: 5, border: '2px solid currentColor' };
  return {};
}

const DALGA = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 20" preserveAspectRatio="none"><path d="M0 12 Q20 2 40 12 T80 12 V20 H0Z" fill="#fff" fill-opacity=".32"/></svg>')}")`;

/**
 * Akan çizgi ve parıltı ayrı katmanda yalnız transform ile kayar: background-position
 * her karede sayfayı yeniden boyatıyordu (Tek URL sayfasının işlemci yükünün ~%70'i).
 */
function dolguAkisi(stil: string): CSSProperties | null {
  if (stil === 'dalga')
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 'calc(100% + 80px)',
      background: `${DALGA} 0 0 / 80px 100% repeat-x`,
      animation: 'axt-hedef-dalga 1.8s linear infinite'
    };
  if (stil === 'striped')
    return {
      position: 'absolute',
      inset: '0 0 0 -28px',
      background: 'repeating-linear-gradient(45deg, rgba(255,255,255,.22) 0 7px, transparent 7px 14px)',
      backgroundSize: '28px 100%',
      animation: 'axt-hedef-cizgi 1s linear infinite'
    };
  if (stil === 'parilti')
    return {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(100deg, transparent 35%, rgba(255,255,255,.6) 50%, transparent 65%)',
      animation: 'axt-hedef-parilti 2.4s linear infinite'
    };
  return null;
}

export function GoalWidget(props?: { embedded?: boolean; previewMode?: boolean; widgetId?: string }) {
  // Tek tuvalde (/widgets/overlay) adres hedef türünü söylemez; tür yerleşim
  // ayarından gelir. Eskiden burada hep "donation-goal" seçiliyordu, stüdyo ise
  // "follower-goal" ayarlarını düzenliyordu: değişiklik OBS'e hiç yansımıyordu.
  const widgetId = props?.widgetId || widgetIdFromPath();
  // Varsayılanlar türe özgü kayıttan gelir (WIDGET_DEFAULTS). Genel
  // GOAL_DEFAULTS onların ÜSTÜNE yazılınca takipçi hedefi bağışları sayıyordu.
  const s = useWidgetSettings<typeof GOAL_DEFAULTS & Record<string, any>>(widgetId);
  const { lastMessage } = useWebSocket('all');
  // İlerleme sunucuda tutulur (modules/goals/hedefler.ts): gerçek olayda `current` ayarı artar ve ayar kanalıyla
  // gelir. Eskiden burada sayılıyordu: OBS yenilenince sıfırlanıyor, test ve "yeniden oynat" da sayılıyordu.
  // "Test et" kayıtlı değeri değiştirmez; birkaç saniye örnek artış gösterilir.
  const [testArtisi, setTestArtisi] = useState(0);
  const current = (Number(s.current) || 0) + testArtisi;
  const [reached, setReached] = useState(false);

  const islenen = useRef<unknown>(null);
  useEffect(() => {
    if (!lastMessage || islenen.current === lastMessage) return;
    islenen.current = lastMessage;
    if (lastMessage.type === 'hedef_doldu' && lastMessage.widgetId === widgetId && !props?.previewMode) kutla('konfeti');
    if (lastMessage.type !== 'hedef_testi' || lastMessage.widgetId !== widgetId) return;
    setTestArtisi((v) => v + (Number(lastMessage.artis) || 1));
    // Temizlikte iptal edilmez: sonraki herhangi bir yayın zamanlayıcıyı iptal edip test artışını kalıcı yapardı
    setTimeout(() => setTestArtisi(0), 6000);
  }, [lastMessage, widgetId, props?.previewMode]);

  const percent = Math.min(100, (current / Math.max(1, Number(s.target))) * 100);
  useEffect(() => {
    if (percent >= 100) setReached(true);
  }, [percent]);

  const fmt = (n: number) => {
    // Binlik ayırıcı: 46700 → 46.700 (uzun sayılar bir bakışta okunsun)
    const val = n.toLocaleString('tr-TR', { minimumFractionDigits: s.decimals > 0 ? s.decimals : 0, maximumFractionDigits: s.decimals > 0 ? s.decimals : 0 });
    return `${s.prefix || ''}${val}${s.suffix || (s.currency ? ' ' + s.currency : '')}`;
  };

  const bg = s.backgroundColor?.length === 7
    ? `${s.backgroundColor}${Math.round((s.backgroundOpacity ?? 0.85) * 255).toString(16).padStart(2, '0')}`
    : '#0a0a0acc';

  const textStyle: CSSProperties = {
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    color: s.fontColor,
    letterSpacing: s.letterSpacing,
    textTransform: s.textTransform as any,
    WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined,
    paintOrder: 'stroke fill',
    textShadow: s.textShadow !== false ? '0 2px 3px rgba(0,0,0,.95), 0 0 8px rgba(0,0,0,.75), 0 0 1px #000' : undefined
  };

  // Sürekli efekt kutunun tamamına değil, seçilen parçaya uygulanır (eski yanıp sönme de çevrilir)
  const hareket = eskiHareketiCevir(s);
  const hedef = String(s.efektHedefi || 'bar');
  const kokGirisMs = hareket.animation && hareket.animation !== 'none' ? Math.max(0, Number(s.animationDuration) || 600) : 0;
  const parcaEfekti = (parca: HedefParcasi): CSSProperties => parcaHareketi(s, parca, kokGirisMs);
  const dolgu = dolguArkaPlani(s.barStyle, s.barColor, s.barColor2);
  const akis = dolguAkisi(s.barStyle);
  const barH = Math.max(6, Number(s.barHeight) || 20);
  const cerceve = Number(s.barBorderWidth) > 0 ? Number(s.barBorderWidth) : 0;
  // Simge barın ucunda, dolguyla birlikte ilerler; bar yüksekliğini biraz aşar ki küçük kalmasın.
  // Dolguyla aynı süre ve eğri: simge ucun önüne geçmez, arkasında kalmaz.
  const gecis = '0.9s cubic-bezier(.22,1,.36,1)';
  const simgeBoy = Math.max(24, Math.round((barH + cerceve * 2) * 1.5));
  const ucta = s.barIconPosition !== 'start';
  const simgeResmi = s.barIcon ? emojiResmi(String(s.barIcon)) : null;
  const simge = s.barIcon ? (
    <span
      style={{
        position: 'absolute',
        top: '50%',
        left: ucta ? `clamp(${simgeBoy / 2}px, ${percent}%, calc(100% - ${simgeBoy / 2}px))` : simgeBoy / 2,
        transform: 'translate(-50%, -50%)',
        transition: `left ${gecis}`,
        width: simgeBoy,
        height: simgeBoy,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(simgeBoy * 0.82),
        lineHeight: 1,
        // Ters çevirme dış katmanda: zıplama animasyonu dönüşümü ezmesin
        ...(s.barIconFlip ? { scale: '-1 1' } : {}),
        filter: `drop-shadow(0 2px 3px rgba(0,0,0,.7))${s.showGlow ? ` drop-shadow(0 0 8px ${s.barColor})` : ''}`,
        zIndex: 1
      }}
    >
      {/* Parça efekti ayrı katmanda: dış katmanın ortalama dönüşümünü ve artış zıplamasını ezmesin */}
      <span style={{ display: 'block', ...parcaEfekti('simge') }}>
      {/* key: her artışta simge bir kez zıplar */}
      <span key={current} style={{ display: 'block', animation: 'axt-hedef-zipla .6s cubic-bezier(.34,1.56,.64,1)' }}>
        {simgeResmi ? <img src={simgeResmi} alt={s.barIcon} style={{ display: 'block', width: Math.round(simgeBoy * 0.86), height: Math.round(simgeBoy * 0.86), objectFit: 'contain' }} /> : s.barIcon}
      </span>
      </span>
    </span>
  ) : null;
  const halkaBoy = Math.max(72, barH * 4);
  const bar = s.barStyle === 'halka' ? (
    <div style={{ position: 'relative', width: halkaBoy, height: halkaBoy, margin: '0 auto', ...parcaEfekti('bar') }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: '50%',
        background: `conic-gradient(${s.barColor} ${percent}%, ${s.barBackground} 0)`,
        WebkitMask: 'radial-gradient(circle, transparent 58%, #000 60%)',
        mask: 'radial-gradient(circle, transparent 58%, #000 60%)',
        filter: s.showGlow ? `drop-shadow(0 0 6px ${s.barColor})` : undefined,
        ...parcaEfekti('dolgu')
      }} />
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...textStyle, fontSize: Math.round(halkaBoy * 0.24), ...parcaEfekti('rakam') }}>{percent.toFixed(0)}%</div>
    </div>
  ) : (
    <div style={{ position: 'relative', color: s.barBorderColor, ...parcaEfekti('bar') }}>
      {s.barStyle === 'pil' && <span aria-hidden style={{ position: 'absolute', right: -6, top: '25%', bottom: '25%', width: 5, borderRadius: '0 3px 3px 0', background: 'currentColor' }} />}
      <div style={{
        height: s.barHeight,
        borderRadius: s.barRadius,
        background: s.barBackground,
        overflow: 'hidden',
        position: 'relative',
        border: cerceve > 0 ? `${cerceve}px solid ${s.barBorderColor}` : undefined,
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,.45)',
        ...barBicimi(s.barStyle, barH)
      }}>
        <div style={{
          height: '100%',
          width: `${percent}%`,
          ...dolgu,
          borderRadius: s.barRadius,
          boxShadow: s.showGlow ? `0 0 16px ${s.barColor}` : undefined,
          transition: `width ${gecis}`,
          position: 'relative',
          overflow: 'hidden',
          ...parcaEfekti('dolgu')
        }}>
          {akis && <div style={akis} />}
        </div>
      </div>
      {simge}
    </div>
  );

  const label = (
    <div className="flex justify-between" style={textStyle}>
      <span style={parcaEfekti('baslik')}>{reached ? s.endingTitle : s.title}</span>
      <span style={parcaEfekti('rakam')}>
        {fmt(current)} / {fmt(Number(s.target))}
        {s.showPercent ? `  (${percent.toFixed(0)}%)` : ''}
        {s.showRemaining ? `  · kalan ${fmt(Math.max(0, Number(s.target) - current))}` : ''}
      </span>
    </div>
  );

  return (
    <div key={`${hareketAnahtari(s)}|${HEDEF_PARCALARI.map((p) => `${s[`${p}Giris`] ?? ''}:${s[`${p}Efekti`] ?? ''}`).join(',')}`} {...kokOzellik(s)} style={{ ...ortakHareket(s, { efekt: hedef === 'tum' }), background: Number(s.backgroundOpacity) === 0 ? 'transparent' : bg, borderRadius: s.borderRadius, ...kutuTasarimi(s), padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <style>{'@keyframes axt-hedef-dalga { to { transform: translateX(-80px) } } @keyframes axt-hedef-parilti { from { transform: translateX(-100%) } to { transform: translateX(100%) } } @keyframes axt-hedef-cizgi { from { transform: translateX(0) } to { transform: translateX(28px) } } @keyframes axt-hedef-zipla { 0% { transform: scale(1) } 40% { transform: scale(1.35) translateY(-8%) } 100% { transform: scale(1) } }'}</style>
      {s.layout === 'text-below' ? <>{bar}{label}</> : <>{label}{bar}</>}
    </div>
  );
}

export default GoalWidget;
