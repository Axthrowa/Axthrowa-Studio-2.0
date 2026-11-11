/**
 * AxBoT Çarkıfelek overlay
 * Developed by AxthrowA
 *
 * Çark SVG ile çizilir. Önceki sürüm CSS `skewY` üçgenleri kullanıyordu; bu
 * yöntem yalnız dar dilimlerde doğru çalışıyor, 6-8 dilimde parçalar üst üste
 * biniyor ve yazılar dilimin dışına taşıyordu. Ayrıca dönüş açısı her seferinde
 * MEVCUT açının üstüne mutlak bir hedef ekliyordu: ilk çevirmeden sonra ibre
 * kazanan dilimin üstüne gelmiyordu. Artık gereken FARK hesaplanıyor.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { kutuTasarimi } from '../lib/widget-style.js';
import { CIKIS_ORANI, animStili, efektEkle, ortakHareket, type AnimAsamasi } from '../lib/animations.js';
import { useEffect, useRef, useState } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { kutla } from '../lib/kutlama.js';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { WHEEL_DEFAULTS } from '../lib/widget-defaults.js';
import { onizlemeKipi } from '../lib/widget-style.js';

/**
 * Gerçek çark gibi: kısa bir kalkışla hızlanır (en yüksek hız sürenin ~%14'ünde), sonra uzun ve
 * sarsıntısız yavaşlar; son dilimler ağır ağır geçer. Eski eğri ilk %3'te tam hıza fırlıyordu.
 */
const YUMUSAK_DONUS = 'cubic-bezier(0.22, 0.12, 0.08, 1)';

/** CSS eğrisinin dört sayısı; tanınmazsa varsayılan dönüş eğrisi */
export function egriNoktalari(egri: unknown): [number, number, number, number] {
  const m = /cubic-bezier\(([^)]+)\)/.exec(String(egri || ''));
  const n = m ? m[1].split(',').map(Number) : [];
  return n.length === 4 && n.every(Number.isFinite) ? (n as [number, number, number, number]) : [0.22, 0.12, 0.08, 1];
}

const bezier = (p1: number, p2: number, t: number) => 3 * (1 - t) ** 2 * t * p1 + 3 * (1 - t) * t * t * p2 + t ** 3;

/** Çark renk paletleri: "custom" dilimlerin kendi rengini kullanır, diğerleri sırayla döner */
export const CARK_PALETLERI: Record<string, { ad: string; renkler: string[] }> = {
  custom: { ad: 'Dilim renkleri (özel)', renkler: [] },
  gundogumu: { ad: 'Gün doğumu', renkler: ['#ff6b6b', '#ffa94d', '#ffd43b', '#ff8787'] },
  buzul: { ad: 'Buzul', renkler: ['#e0f2fe', '#7dd3fc', '#38bdf8', '#0369a1'] },
  gecedalga: { ad: 'Gece dalgası', renkler: ['#2b0a4d', '#7a1d6f', '#f0568a', '#ffb86b'] },
  pastel: { ad: 'Pastel', renkler: ['#fbcfe8', '#ddd6fe', '#bfdbfe', '#bbf7d0', '#fef08a'] },
  altin: { ad: 'Altın', renkler: ['#14100a', '#d4a843', '#3b2a14', '#f5e6c4'] },
  rainbow: { ad: 'Gökkuşağı', renkler: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'] },
  red: { ad: 'Kırmızı tonları', renkler: ['#7f1d1d', '#b91c1c', '#ef4444', '#f87171'] },
  green: { ad: 'Yeşil tonları', renkler: ['#14532d', '#15803d', '#22c55e', '#86efac'] },
  blue: { ad: 'Mavi tonları', renkler: ['#1e3a8a', '#1d4ed8', '#3b82f6', '#93c5fd'] },
  yellow: { ad: 'Sarı tonları', renkler: ['#713f12', '#a16207', '#eab308', '#fde047'] },
  cyan: { ad: 'Turkuaz tonları', renkler: ['#164e63', '#0e7490', '#06b6d4', '#67e8f9'] },
  magenta: { ad: 'Macenta tonları', renkler: ['#701a75', '#a21caf', '#d946ef', '#f0abfc'] },
  orange: { ad: 'Turuncu tonları', renkler: ['#7c2d12', '#c2410c', '#f97316', '#fdba74'] },
  purple: { ad: 'Mor tonları', renkler: ['#3b0764', '#6d28d9', '#8b5cf6', '#c4b5fd'] },
  pink: { ad: 'Pembe tonları', renkler: ['#831843', '#be185d', '#ec4899', '#f9a8d4'] },
  brown: { ad: 'Kahve tonları', renkler: ['#3f2412', '#6b3f1d', '#92582a', '#c08a5b'] },
  white: { ad: 'Beyaz / gri', renkler: ['#f8fafc', '#e2e8f0', '#cbd5e1', '#f1f5f9'] },
  slot: { ad: 'Slot makinesi', renkler: ['#b91c1c', '#111827', '#ca8a04', '#111827'] },
  confetti: { ad: 'Konfeti', renkler: ['#f472b6', '#38bdf8', '#facc15', '#4ade80', '#c084fc', '#fb923c'] },
  kart: { ad: 'Kart oyunu', renkler: ['#dc2626', '#facc15', '#16a34a', '#2563eb'] },
  kagit: { ad: 'Kâğıt işi (pastel)', renkler: ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#ddd6fe'] },
  piksel: { ad: 'Piksel macera', renkler: ['#5b8731', '#8b5a2b', '#3b82f6', '#facc15'] },
  noir: { ad: 'Kara lüks', renkler: ['#0a0a0a', '#262626', '#a16207', '#404040'] },
  candy: { ad: 'Şeker', renkler: ['#fb7185', '#f9a8d4', '#a5f3fc', '#fde68a', '#c4b5fd'] },
  aurora: { ad: 'Kutup ışığı', renkler: ['#0f766e', '#14b8a6', '#6366f1', '#a855f7', '#22d3ee'] },
  slate: { ad: 'Arduvaz', renkler: ['#1e293b', '#334155', '#475569', '#64748b'] },
  inferno: { ad: 'Cehennem ateşi', renkler: ['#450a0a', '#b91c1c', '#ea580c', '#facc15'] },
  neon: { ad: 'Neon ışıltı', renkler: ['#ff2bd6', '#22d3ee', '#a3e635', '#fcee0a'] },
  carnival: { ad: 'Karnaval', renkler: ['#dc2626', '#fef3c7', '#2563eb', '#fef3c7'] },
  hacker: { ad: 'Hacker', renkler: ['#022c22', '#14532d', '#22c55e', '#052e16'] },
  retro8: { ad: 'Retro 8-bit', renkler: ['#ff004d', '#ffa300', '#00e436', '#29adff', '#83769c'] },
  vegas: { ad: 'Vegas', renkler: ['#7f1d1d', '#ca8a04', '#111827', '#ca8a04'] },
  matrix: { ad: 'Matrix', renkler: ['#000000', '#003b00', '#008f11', '#00ff41'] }
};

/** Açık dilimlerde yazı koyu olsun (beyaz/pastel paletler okunur kalsın) */
export function acikRenkMi(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 > 170;
}

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
export function donusFarki(mevcut: number, index: number, dilimSayisi: number, tamTur: number, sapma = 0): number {
  const slice = 360 / dilimSayisi;
  // sapma: dilim içinde -0.45..0.45 (dilim genişliği oranı); hep tam ortada durmasın, kenara da değmesin
  const merkez = index * slice + slice / 2 + Math.max(-0.45, Math.min(0.45, sapma)) * slice;
  const hedef = (360 - merkez) % 360; // ibre saat 12'de
  const fark = (hedef - (mevcut % 360) + 360) % 360;
  return Math.max(1, tamTur) * 360 + fark;
}

/** İbrenin altındaki dilim (çark `aci` derece dönmüşken) */
export function ibredekiDilim(aci: number, dilimSayisi: number): number {
  const slice = 360 / dilimSayisi;
  return Math.floor((((360 - (aci % 360)) % 360) + 360) % 360 / slice) % dilimSayisi;
}

/**
 * Dilim sınırından geçiş anları (ms): dönüşün kendi eğrisinden hesaplanır, tık sesi görüntüyle örtüşür.
 * İbre dilim ortasından başlar: ilk sınır yarım dilim sonra gelir.
 */
export function tikZamanlari(toplamDerece: number, dilimDerece: number, sureMs: number, enFazla = 160, egri: unknown = YUMUSAK_DONUS): number[] {
  const [x1, y1, x2, y2] = egriNoktalari(egri);
  const dilim = Math.max(1, dilimDerece);
  const tam = Math.floor(toplamDerece / dilim);
  const adet = Math.min(enFazla, tam);
  return Array.from({ length: adet }, (_, i) => {
    const yol = adet < tam ? (i + 1) / (adet + 1) : ((i + 0.5) * dilim) / toplamDerece;
    let alt = 0;
    let ust = 1;
    for (let k = 0; k < 32; k++) {
      const orta = (alt + ust) / 2;
      if (bezier(y1, y2, orta) < yol) alt = orta;
      else ust = orta;
    }
    return bezier(x1, x2, (alt + ust) / 2) * sureMs;
  });
}

/** Dönüş efekti: dilim geçişlerinde tık, durunca zil (dosya gerekmez) */
function donusSesiCal(zamanlar: number[], sureMs: number, ses: number) {
  const Baglam = window.AudioContext || (window as any).webkitAudioContext;
  if (!Baglam) return;
  const ctx: AudioContext = new Baglam();
  void ctx.resume();
  const ton = (tur: OscillatorType, frekans: number, an: number, uzunluk: number, guc: number) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = tur;
    o.frequency.value = frekans;
    g.gain.setValueAtTime(guc * ses, an);
    g.gain.exponentialRampToValueAtTime(0.0001, an + uzunluk);
    o.connect(g).connect(ctx.destination);
    o.start(an);
    o.stop(an + uzunluk);
  };
  const bas = ctx.currentTime + 0.02;
  for (const t of zamanlar) ton('square', 1500, bas + t / 1000, 0.03, 0.18);
  const son = bas + sureMs / 1000;
  ton('triangle', 880, son, 0.35, 0.5);
  ton('triangle', 1320, son + 0.12, 0.5, 0.5);
  setTimeout(() => void ctx.close().catch(() => {}), sureMs + 1500);
}

export function WheelWidget(_props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('wheel-of-fortune', WHEEL_DEFAULTS);
  const palet = CARK_PALETLERI[String(s.palette || 'custom')]?.renkler || [];
  const dilimRengi = (i: number, kendi: string) => (palet.length ? palet[i % palet.length] : kendi);
  const { lastMessage } = useWebSocket('all');
  const [rotation, setRotation] = useState(0);
  const donus = useRef(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const baslat = useRef<NodeJS.Timeout | null>(null);
  const onizleme = onizlemeKipi(_props?.previewMode === true);
  const girisMs = Math.max(0, Number((s as Record<string, any>).animationDuration) || 600);
  const cikisMs = Math.round(girisMs * CIKIS_ORANI);
  // Görünürlük: otomatik gizlemede yalnız çevrilince ya da ayar değişince giriş animasyonuyla belirir,
  // süre dolunca çıkış animasyonuyla gider
  const [faz, setFaz] = useState<AnimAsamasi>('hidden');
  const fazRef = useRef<AnimAsamasi>('hidden');
  const fazDegistir = (f: AnimAsamasi) => {
    fazRef.current = f;
    setFaz(f);
  };
  const gizleZamani = useRef<NodeJS.Timeout | null>(null);
  const gizlemeyiPlanla = (ekMs = 0) => {
    if (gizleZamani.current) clearTimeout(gizleZamani.current);
    const sn = Number(s.hideAfterSec);
    if (!(sn > 0)) return;
    gizleZamani.current = setTimeout(() => {
      fazDegistir('exiting');
      gizleZamani.current = setTimeout(() => fazDegistir('hidden'), cikisMs);
    }, ekMs + sn * 1000);
  };
  /** Görünür yapar; giriş animasyonu oynayacaksa onun süresini döndürür (dönüş ondan sonra başlar) */
  const goster = (ekMs = 0): number => {
    // Hep ekrandaysa (otomatik gizleme kapalı, önizleme) giriş beklenmez
    const bekle = fazRef.current === 'visible' || onizleme || s.autoHide === false ? 0 : girisMs;
    fazDegistir('visible');
    gizlemeyiPlanla(ekMs + bekle);
    return bekle;
  };

  const segments: Segment[] = (s.segments && s.segments.length ? s.segments : WHEEL_DEFAULTS.segments) as Segment[];
  const slice = 360 / segments.length;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (baslat.current) clearTimeout(baslat.current);
      if (gizleZamani.current) clearTimeout(gizleZamani.current);
    },
    []
  );

  // "Ayarlandığında ekranda belirsin": dilimler/görünüm panelden değişince kısa süre gösterilir
  const ayarImzasi = JSON.stringify([s.segments, s.size, s.borderColor, s.pointerColor, s.fontColor]);
  const ilkImza = useRef<string | null>(null);
  useEffect(() => {
    if (ilkImza.current === null) {
      ilkImza.current = ayarImzasi;
      return;
    }
    if (ilkImza.current !== ayarImzasi) {
      ilkImza.current = ayarImzasi;
      goster();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ayarImzasi]);

  const spinTo = (index: number) => {
    if (spinning) return;
    const guvenli = ((index % segments.length) + segments.length) % segments.length;
    setSpinning(true);
    setWinner(null);
    const sure = s.spinMs || 8000;
    // Çark girişle belirir, giriş bitince döner; sonuçtan `hideAfterSec` sn sonra çıkışla kaybolur
    const bekle = goster(sure);
    // Her çevirmede tur sayısı ve dilim içindeki duruş noktası değişir: aynı hareketi tekrar etmesin
    const fark = donusFarki(donus.current, guvenli, segments.length, (s.extraSpins || 6) + (Math.random() < 0.5 ? 0 : 1), (Math.random() - 0.5) * 0.8);
    if (baslat.current) clearTimeout(baslat.current);
    baslat.current = setTimeout(() => {
      donus.current += fark;
      setRotation(donus.current);
      if (s.soundEnabled) {
        const ses = Math.min(1, Math.max(0, Number(s.soundVolume ?? 0.6)));
        try {
          if (s.soundUrl) {
            const a = new Audio(String(s.soundUrl));
            a.volume = ses;
            a.play().catch(() => {});
          } else {
            donusSesiCal(tikZamanlari(fark, slice, sure, 160, donusEgrisi), sure, ses);
          }
        } catch {
          /* ses yok */
        }
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setSpinning(false);
        setWinner(segments[guvenli]?.label || null);
        // `confetti` ayarı vardı ama hiç okunmuyordu: kazanan çıkınca kutlama yoktu
        if (s.confetti && !onizleme) kutla(String(s.celebration || 'konfeti'));
      }, sure);
    }, bekle);
  };

  useEffect(() => {
    if (!lastMessage) return;
    if (lastMessage.type === 'wheel_spin' || lastMessage.type === 'spin_wheel') {
      const etiket = lastMessage.payload?.label;
      // Aynı ad birden çok dilimdeyse adla aramak hep İLK dilimi buluyordu (çark hep aynı yere düşüyordu):
      // sunucunun sırası adıyla uyuşuyorsa o kullanılır, ad yalnız sıra kaydıysa yedek
      const sira = lastMessage.payload?.index ?? lastMessage.data?.index ?? lastMessage.winnerIndex;
      const siraUyar = typeof sira === 'number' && (!etiket || segments[sira]?.label === etiket);
      const adla = etiket ? segments.findIndex((x) => x.label === etiket) : -1;
      const gelen = siraUyar ? sira : adla >= 0 ? adla : sira;
      spinTo(typeof gelen === 'number' ? gelen : agirlikliSec(segments));
    }
  }, [lastMessage]);

  const boyut = Number(s.size) || 300;
  // Göbek yarıçapı (viewBox birimi): çapın yüzdesi; yazılar göbeğin dışından başlar
  const gobek = Math.min(60, Math.max(6, Number(s.centerSize) || 26));
  const otomatikGizle = s.autoHide !== false;
  // Gizliyken de çizili kalır: gizliden açılan SVG son açıda doğar, CSS geçişi hiç başlamaz, çark dönmezdi
  const gizli = !onizleme && otomatikGizle && faz === 'hidden' && !spinning;
  const donusEgrisi = /^cubic-bezier/.test(String(s.animation)) ? String(s.animation) : YUMUSAK_DONUS;
  const girisAdi = String((s as Record<string, any>).girisAnimasyonu || 'fade');
  const cikisAdi = !s.exitAnimation || s.exitAnimation === 'ayni' ? girisAdi : String(s.exitAnimation);
  // Hep ekrandaysa giriş bir kez oynar; otomatik gizlemede her görünüşte giriş, kayboluşta çıkış
  const hareketStili =
    onizleme || !otomatikGizle
      ? ortakHareket(s)
      : efektEkle(animStili(faz === 'exiting' ? cikisAdi : girisAdi, gizli ? 'hidden' : faz, girisMs), s, faz, girisMs);

  return (
    <div {...kokOzellik(s)} data-katman-bos={gizli ? '' : undefined} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: 16, ...kutuTasarimi(s), ...hareketStili, visibility: gizli ? 'hidden' : 'visible' }}>
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
            willChange: 'transform',
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? `transform ${s.spinMs || 8000}ms ${donusEgrisi}`
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
            const yazi = nokta(orta, Math.max(R * 0.3, gobek + 4));
            const solYari = orta > 180;
            const aci = solYari ? orta + 90 : orta - 90;
            const etiket = kisalt(String(seg.label), Number(s.maxLabel) || 14);
            return (
              <g key={i}>
                <path d={dilimYolu(bas, bit)} fill={dilimRengi(i, seg.color)} stroke={s.borderColor} strokeWidth={0.6} />
                <text
                  x={yazi.x}
                  y={yazi.y}
                  transform={`rotate(${aci} ${yazi.x} ${yazi.y})`}
                  textAnchor={solYari ? 'end' : 'start'}
                  dominantBaseline="middle"
                  style={{
                    fontFamily: s.fontFamily,
                    fontSize: Number(s.fontSize) || 12,
                    // Palet açık renkliyse (beyaz, pastel) yazı koyulaşır; özel renklerde ayar geçerli
                    fill: palet.length && acikRenkMi(dilimRengi(i, seg.color)) ? '#111827' : s.fontColor,
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
          <circle cx={CX} cy={CY} r={gobek} fill={s.borderColor} stroke="#0008" strokeWidth={1} />
        </svg>
        {/* GIF dönmez: yalnız çark döner, görsel ortada okunur kalır */}
        {s.centerImageUrl && (
          <img
            src={String(s.centerImageUrl)}
            alt=""
            referrerPolicy="no-referrer"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: `${gobek}%`,
              height: `${gobek}%`,
              transform: 'translate(-50%,-50%)',
              borderRadius: '50%',
              objectFit: 'cover'
            }}
          />
        )}
      </div>

      {winner && (
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, textShadow: '0 2px 6px #000' }}>🎉 {winner}</div>
      )}

      {/* Çevir düğmesi yalnız panel önizlemesinde (eskiden OBS'te de görünüyordu) */}
      {onizleme && (
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
