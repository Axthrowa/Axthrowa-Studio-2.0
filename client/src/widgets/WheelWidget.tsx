/**
 * StreamAxT Çarkıfelek overlay
 * Developed by AxthrowA
 *
 * Çark SVG ile çizilir. Önceki sürüm CSS `skewY` üçgenleri kullanıyordu; bu
 * yöntem yalnız dar dilimlerde doğru çalışıyor, 6-8 dilimde parçalar üst üste
 * biniyor ve yazılar dilimin dışına taşıyordu. Ayrıca dönüş açısı her seferinde
 * MEVCUT açının üstüne mutlak bir hedef ekliyordu: ilk çevirmeden sonra ibre
 * kazanan dilimin üstüne gelmiyordu. Artık gereken FARK hesaplanıyor.
 */
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { WHEEL_DEFAULTS } from '../lib/widget-defaults.js';

type Segment = { label: string; color: string; weight?: number };

const R = 92; // çark yarıçapı (viewBox 200x200)
const CX = 100;
const CY = 100;

/** Kutupsal açıyı SVG koordinatına çevirir (0 derece = saat 12 yönü). */
function nokta(aci: number, yaricap: number) {
  const rad = ((aci - 90) * Math.PI) / 180;
  return { x: CX + yaricap * Math.cos(rad), y: CY + yaricap * Math.sin(rad) };
}

/** Bir dilimin pasta dilimi yolu. */
function dilimYolu(baslangic: number, bitis: number): string {
  const a = nokta(baslangic, R);
  const b = nokta(bitis, R);
  const buyukYay = bitis - baslangic > 180 ? 1 : 0;
  return `M ${CX} ${CY} L ${a.x} ${a.y} A ${R} ${R} 0 ${buyukYay} 1 ${b.x} ${b.y} Z`;
}

/** Uzun adı dilime sığdır: taşma yerine üç nokta. */
export function kisalt(metin: string, enFazla: number): string {
  const t = String(metin ?? '').trim();
  if (t.length <= enFazla) return t;
  return `${t.slice(0, Math.max(1, enFazla - 1))}…`;
}

/** Ağırlıklı rastgele dilim seçimi (ağırlık verilmemişse eşit). */
export function agirlikliSec(segments: Segment[], rastgele: () => number = Math.random): number {
  const agirliklar = segments.map((s) => Math.max(0, Number(s.weight ?? 1)));
  const toplam = agirliklar.reduce((a, b) => a + b, 0);
  if (!toplam) return Math.floor(rastgele() * segments.length);
  let r = rastgele() * toplam;
  for (let i = 0; i < agirliklar.length; i++) {
    r -= agirliklar[i];
    if (r <= 0) return i;
  }
  return segments.length - 1;
}

/**
 * Hedef dilimi ibrenin altına getirecek DÖNÜŞ FARKI.
 * `mevcut` derece cinsinden şu anki açı; sonuç daima ileri (pozitif) döner.
 */
export function donusFarki(mevcut: number, index: number, dilimSayisi: number, tamTur: number): number {
  const slice = 360 / dilimSayisi;
  const merkez = index * slice + slice / 2; // dilimin orta açısı
  const hedef = (360 - merkez) % 360; // ibre saat 12'de
  const fark = (hedef - (mevcut % 360) + 360) % 360;
  return Math.max(1, tamTur) * 360 + fark;
}

export function WheelWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('wheel-of-fortune', WHEEL_DEFAULTS);
  const { lastMessage } = useWebSocket('all');
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);

  const segments: Segment[] = (s.segments && s.segments.length ? s.segments : WHEEL_DEFAULTS.segments) as Segment[];
  const slice = 360 / segments.length;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const spinTo = (index: number) => {
    if (spinning) return;
    const guvenli = ((index % segments.length) + segments.length) % segments.length;
    setSpinning(true);
    setWinner(null);
    setRotation((mevcut) => mevcut + donusFarki(mevcut, guvenli, segments.length, s.extraSpins || 6));
    if (s.soundEnabled) {
      try {
        new Audio('/sounds/wheel.mp3').play().catch(() => {});
      } catch {
        /* ses yok */
      }
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSpinning(false);
      setWinner(segments[guvenli]?.label || null);
    }, s.spinMs || 4500);
  };

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'wheel_spin' || lastMessage.type === 'spin_wheel') {
      const gelen = lastMessage.payload?.index ?? lastMessage.data?.index ?? lastMessage.winnerIndex;
      spinTo(typeof gelen === 'number' ? gelen : agirlikliSec(segments));
    }
  }, [lastMessage]);

  const boyut = Number(s.size) || 300;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 16 }}>
      <div style={{ position: 'relative', width: boyut, height: boyut }}>
        {/* İbre: saat 12 yönünde, çarkın üstünde */}
        <div
          style={{
            position: 'absolute',
            top: -6,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            width: 0,
            height: 0,
            borderLeft: '13px solid transparent',
            borderRight: '13px solid transparent',
            borderTop: `22px solid ${s.pointerColor}`,
            filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.5))'
          }}
        />
        <svg
          viewBox="0 0 200 200"
          width={boyut}
          height={boyut}
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${s.spinMs || 4500}ms ${s.animation || 'cubic-bezier(0.15,0.8,0.2,1)'}`
              : 'none'
          }}
        >
          {segments.map((seg, i) => {
            const bas = i * slice;
            const bit = bas + slice;
            const orta = bas + slice / 2;
            // Yazı dilimin ORTA ÇİZGİSİ boyunca, merkezden dışa doğru yazılır.
            // Eskiden yazı dilime teğet duruyordu; 6-8 dilimde komşu adlar üst
            // üste biniyordu ("isimler iç içe giriyor"). Sol yarıda baş aşağı
            // düşmesin diye yazı 180 derece çevrilip sondan hizalanır.
            const yazi = nokta(orta, R * 0.3);
            const solYari = orta > 180;
            const aci = solYari ? orta + 90 : orta - 90;
            const etiket = kisalt(String(seg.label), Number(s.maxLabel) || 14);
            return (
              <g key={i}>
                <path d={dilimYolu(bas, bit)} fill={seg.color} stroke={s.borderColor} strokeWidth={0.6} />
                <text
                  x={yazi.x}
                  y={yazi.y}
                  transform={`rotate(${aci} ${yazi.x} ${yazi.y})`}
                  textAnchor={solYari ? 'end' : 'start'}
                  dominantBaseline="middle"
                  style={{
                    fontFamily: s.fontFamily,
                    fontSize: Number(s.fontSize) || 12,
                    fill: s.fontColor,
                    fontWeight: 800,
                    paintOrder: 'stroke',
                    stroke: s.outlineEnabled ? s.outlineColor : 'none',
                    strokeWidth: s.outlineEnabled ? Number(s.outlineWidth) || 2 : 0
                  }}
                >
                  {etiket}
                </text>
              </g>
            );
          })}
          {/* Orta göbek */}
          <circle cx={CX} cy={CY} r={11} fill={s.borderColor} stroke="#0008" strokeWidth={1} />
        </svg>
      </div>

      {winner && (
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, textShadow: '0 2px 6px #000' }}>🎉 {winner}</div>
      )}

      {_props?.previewMode !== false && (
        <button
          type="button"
          disabled={spinning}
          onClick={() => spinTo(agirlikliSec(segments))}
          style={{
            background: spinning ? '#334155' : '#0d9488',
            color: '#fff',
            border: 0,
            borderRadius: 12,
            padding: '8px 16px',
            fontWeight: 700,
            cursor: spinning ? 'default' : 'pointer'
          }}
        >
          {spinning ? 'Dönüyor…' : `Çevir (${s.command})`}
        </button>
      )}
    </div>
  );
}

export default WheelWidget;
