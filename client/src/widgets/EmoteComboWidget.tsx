/**
 * StreamAxT Emote Combo overlay
 * Developed by AxthrowA
 *
 * Aynı emote art arda gönderilince kombo sayar. Eskiden Kick emote'u sohbete
 * `[emote:37226:KEKW]` biçiminde geldiği için kombo kartında emote yerine bu
 * HAM METİN görünüyordu; 7TV emote'ları da yalnız ad olarak yazılıyordu.
 * Artık Kick ve 7TV emote'ları görsel, Unicode emoji metin olarak çizilir.
 */
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { EMOTE_COMBO_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { emoteleriAyikla, guvenliEmoteAdresi, type EmoteParca } from '../lib/emote.js';
import { useYediTvHaritasi } from '../lib/yediTv.js';

interface Combo { emote: EmoteParca; count: number; displayUntil: number }
/** Kutunun kenarından büyük emote'a uçan kopya (piksel cinsinden başlangıç kayması) */
interface Ucan { id: number; emote: EmoteParca; dx: number; dy: number; donus: number }
/** Kombo bitince merkezden saçılan parça (piksel) */
export interface Parca { dx: number; dy: number; dusus: number; donus: number; gecikme: number; olcek: number }

const TOPLANMA_MS = 900;
const DAGILMA_MS = 1600;

/**
 * Kombo bitişinde saçılacak parçalar: yön, uzaklık, boy, dönüş ve gecikme tamamen rastgele; sonra yerçekimiyle
 * düşerek kaybolur. Eskiden açılar eşit aralıklıydı (düzgün bir halka) ve uzaklık ekran yüzdesiyle (vw/vh)
 * verildiği için Tek URL kutusunun dışına çıkıp kesiliyordu. `w`,`h`: kutunun boyutu (px).
 */
export function dagilmaParcalari(adet: number, w: number, h: number, rastgele: () => number = Math.random): Parca[] {
  const n = Math.max(8, Math.min(28, adet + 4));
  const rx = Math.max(60, w / 2);
  const ry = Math.max(40, h / 2);
  return Array.from({ length: n }, () => {
    const aci = rastgele() * Math.PI * 2;
    const oran = 0.3 + rastgele() * 0.75;
    return {
      dx: Math.cos(aci) * rx * oran,
      dy: Math.sin(aci) * ry * oran - ry * 0.25 * rastgele(),
      dusus: 30 + rastgele() * Math.max(40, ry * 0.8),
      donus: (rastgele() - 0.5) * 900,
      gecikme: rastgele() * 220,
      olcek: 0.45 + rastgele() * 0.75
    };
  });
}

/** Toplanan emote'un başlangıcı: kutunun kenarına yakın rastgele bir nokta (px) */
export function toplanmaBaslangici(w: number, h: number, rastgele: () => number = Math.random): { dx: number; dy: number } {
  const aci = rastgele() * Math.PI * 2;
  const oran = 0.85 + rastgele() * 0.25;
  return { dx: Math.cos(aci) * Math.max(80, w / 2) * oran, dy: Math.sin(aci) * Math.max(50, h / 2) * oran };
}

const KOMBO_CSS = `
@keyframes axt-kombo-toplan { 0% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(1.1); opacity: 0 } 12% { opacity: 1 } 75% { opacity: 1; transform: translate(calc(var(--dx) * .18), calc(var(--dy) * .18)) rotate(0deg) scale(.85) } 100% { transform: translate(0, 0) scale(.3); opacity: 0 } }
@keyframes axt-kombo-dagil { 0% { transform: translate(0, 0) rotate(0) scale(var(--s)); opacity: 1 } 55% { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--rot) * .6)) scale(var(--s)); opacity: 1 } 100% { transform: translate(var(--dx), calc(var(--dy) + var(--fall))) rotate(var(--rot)) scale(calc(var(--s) * .7)); opacity: 0 } }
@keyframes axt-kombo-vurus { 0% { transform: scale(1) } 40% { transform: scale(1.22) } 100% { transform: scale(1) } }
@keyframes axt-kombo-halka { from { transform: scale(.4); opacity: .9 } to { transform: scale(2.2); opacity: 0 } }
`;

/** Emote görseli (Kick/7TV) ya da emoji/metin */
function EmoteGorsel({ e, boyut }: { e: EmoteParca; boyut: number }) {
  const url = guvenliEmoteAdresi(e.url);
  if (url) {
    return <img src={url} alt={e.ad} style={{ height: boyut, maxWidth: boyut * 2.5, objectFit: 'contain', verticalAlign: 'middle' }} referrerPolicy="no-referrer" />;
  }
  return <span style={{ fontSize: boyut, lineHeight: 1 }}>{e.ad}</span>;
}

export function EmoteComboWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('emote-combo', EMOTE_COMBO_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const yediTv = useYediTvHaritasi();
  const [combo, setCombo] = useState<Combo | null>(
    onizleme ? { emote: { ad: 'KEKW', url: 'https://files.kick.com/emotes/37226/fullsize' }, count: 7, displayUntil: Number.MAX_SAFE_INTEGER } : null
  );
  const [floats, setFloats] = useState<Array<{ id: number; emote: EmoteParca; x: number }>>([]);
  const [ucanlar, setUcanlar] = useState<Ucan[]>([]);
  const [dagilma, setDagilma] = useState<{ id: number; emote: EmoteParca; parcalar: Parca[] } | null>(null);
  const last = useRef<{ anahtar: string; at: number; count: number } | null>(null);
  const ayar = useRef(s);
  ayar.current = s;
  const harita = useRef(yediTv);
  harita.current = yediTv;
  // Uçuş/saçılma uzaklıkları kutunun gerçek boyutundan (Tek URL katmanı ya da OBS kaynağı)
  const kutu = useRef<HTMLDivElement>(null);
  const kutuBoyutu = () => {
    const r = kutu.current?.getBoundingClientRect();
    return { w: r?.width || window.innerWidth, h: r?.height || window.innerHeight };
  };

  useEffect(() => {
    if (onizleme) return;
    let fid = 0;
    const isle = (emote: EmoteParca, hazirKombo = 0) => {
      const a = ayar.current;
      const now = Date.now();
      const anahtar = emote.url || emote.ad;
      let count: number;
      if (hazirKombo > 1) count = hazirKombo;
      else if (last.current && last.current.anahtar === anahtar && now - last.current.at < a.timeoutMs) count = last.current.count + 1;
      else count = 1;
      last.current = { anahtar, at: now, count };
      if (count >= a.minCombo && a.soundEnabled && a.soundUrl && (count === a.minCombo || hazirKombo > 1)) {
        try {
          const ses = new Audio(a.soundUrl);
          ses.volume = a.soundVolume;
          ses.play().catch(() => {});
        } catch {
          /* ses yok */
        }
      }
      setCombo({ emote, count, displayUntil: now + a.displayMs });
      // Kombo ekrandayken her yeni emote kenardan uçup büyük emote'ta toplanır
      if (a.gatherMode && count >= a.minCombo) {
        const id = ++fid;
        const { w, h } = kutuBoyutu();
        const b = toplanmaBaslangici(w, h);
        setUcanlar((u) => [...u.slice(-20), { id, emote, dx: b.dx, dy: b.dy, donus: (Math.random() - 0.5) * 240 }]);
        setTimeout(() => setUcanlar((u) => u.filter((x) => x.id !== id)), TOPLANMA_MS + 50);
      } else if (a.showFloating) {
        const id = ++fid;
        setFloats((f) => [...f.slice(-12), { id, emote, x: 20 + Math.random() * 60 }]);
        setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 1800);
      }
    };

    const ws = new KaliciSoket(wsAdresi('chatbox'));
    ws.onmessage = (ev) => {
      let m: any;
      try {
        m = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      // `emote_used`: widget "Test" düğmesi ve sunucu olayları
      if (m?.type === 'emote_used') {
        const ham = String(m.emote || m.data?.emote || '');
        const e = emoteleriAyikla(ham, harita.current, 1)[0] || (ham ? { ad: ham } : null);
        if (e) isle(e, Math.max(0, Number(m.combo) || 0));
        return;
      }
      if (m?.type !== 'chat') return;
      // Ortak kara listedeki kullanıcı ve kalkana takılan mesaj kombo sayacına katılmaz
      if (m.data?.karaListede || m.data?.kalkanda) return;
      const metin = String(m.data?.message || m.payload?.message || '').trim();
      if (!metin || metin.startsWith('!')) return;
      const bulunan = emoteleriAyikla(metin, harita.current, 1)[0];
      // "Yalnız bilinen emote" kapalıysa tek kelimelik mesaj da sayılır (ör. LUL)
      const tekKelime = !ayar.current.onlyKnownEmotes && !/\s/.test(metin) && metin.length <= 30 ? { ad: metin } : null;
      const e = bulunan || tekKelime;
      if (e) isle(e);
    };
    return () => ws.close();
  }, [onizleme]);

  useEffect(() => {
    let did = 0;
    const t = setInterval(() => {
      setCombo((c) => {
        if (!c || c.displayUntil >= Date.now()) return c;
        const a = ayar.current;
        // Biten kombo: büyük emote parçalara ayrılıp etrafa saçılır ve kaybolur
        if (a.burstOnEnd && c.count >= a.minCombo) {
          const id = ++did;
          const { w, h } = kutuBoyutu();
          setDagilma({ id, emote: c.emote, parcalar: dagilmaParcalari(c.count, w, h) });
          setTimeout(() => setDagilma((d) => (d?.id === id ? null : d)), DAGILMA_MS + 200);
        }
        return null;
      });
    }, 250);
    return () => clearInterval(t);
  }, []);

  const yuzenler = s.showFloating
    ? floats.map((f) => (
        <span key={f.id} className="axt-anim-bounce" style={{ position: 'absolute', left: `${f.x}%`, bottom: 20 }}>
          <EmoteGorsel e={f.emote} boyut={28} />
        </span>
      ))
    : null;

  const merkez = { position: 'absolute' as const, left: '50%', top: '50%', marginLeft: -24, marginTop: -24, width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' as const };
  const efektler = (
    <>
      <style>{KOMBO_CSS}</style>
      {ucanlar.map((u) => (
        <span key={u.id} style={{ ...merkez, zIndex: 2, ['--dx' as any]: `${u.dx}px`, ['--dy' as any]: `${u.dy}px`, ['--rot' as any]: `${u.donus}deg`, opacity: 0, animation: `axt-kombo-toplan ${TOPLANMA_MS}ms cubic-bezier(.45,.05,.55,.95) forwards`, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.6))' }}>
          <EmoteGorsel e={u.emote} boyut={44} />
        </span>
      ))}
      {dagilma && (
        <span key={`halka-${dagilma.id}`} style={{ ...merkez, borderRadius: '50%', border: `3px solid ${s.borderColor || '#fbbf24'}`, opacity: 0, animation: 'axt-kombo-halka 600ms ease-out forwards' }} />
      )}
      {dagilma?.parcalar.map((p, i) => (
        <span
          key={`${dagilma.id}-${i}`}
          style={{
            ...merkez,
            zIndex: 2,
            ['--dx' as any]: `${p.dx}px`,
            ['--dy' as any]: `${p.dy}px`,
            ['--fall' as any]: `${p.dusus}px`,
            ['--rot' as any]: `${p.donus}deg`,
            ['--s' as any]: p.olcek,
            opacity: 0,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.6))',
            animation: `axt-kombo-dagil ${DAGILMA_MS}ms cubic-bezier(.2,.75,.35,1) ${p.gecikme}ms forwards`
          }}
        >
          <EmoteGorsel e={dagilma.emote} boyut={Math.max(32, (Number(s.size) || 64) * 0.7)} />
        </span>
      ))}
    </>
  );

  // Ayrı OBS sayfasında ekranı kaplar; Tek URL katmanında kutusunu. Eskiden ikisinde de %100'dü:
  // ayrı sayfada üst öğenin genişliği 0 olduğundan kombo çiziliyor ama hiç görünmüyordu.
  const kap = props?.embedded ? { width: '100%', height: '100%' } : { width: '100vw', height: '100vh' };
  if (!combo || combo.count < s.minCombo) {
    return <div ref={kutu} style={{ position: 'relative', ...kap, overflow: 'hidden' }}>{yuzenler}{efektler}</div>;
  }
  // Toplanma açıkken büyük emote kombo büyüdükçe irileşir (en çok 2 kat)
  const buyukBoyut = (Number(s.size) || 64) * (s.gatherMode ? Math.min(2, 1 + combo.count * 0.04) : 1);

  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;
  const title = (s.template || 'x{count} COMBO!').replace('{count}', String(combo.count)).replace('{emote}', combo.emote.ad);
  const sub = (s.subTemplate || '{emote} ÇILGINLIĞI!').replace('{emote}', combo.emote.ad).replace('{count}', String(combo.count));

  return (
    <div ref={kutu} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...kap, position: 'relative', overflow: 'hidden' }}>
      {s.showPopup && (
        <div className={`axt-anim-${s.animation}`} style={{
          background: bg,
          border: `2px solid ${s.borderColor}`,
          borderRadius: 24,
          padding: '24px 40px',
          textAlign: 'center',
          fontFamily: s.fontFamily,
          ...(KOMBO_STILLERI[String(s.comboStyle || 'none')] || {})
        }}>
          {/* key=sayı: her yeni emote'ta büyük emote "vurulmuş" gibi zıplar */}
          <div key={s.gatherMode ? combo.count : 0} style={{ display: 'flex', justifyContent: 'center', animation: s.gatherMode ? 'axt-kombo-vurus 260ms ease-out' : undefined }}>
            <EmoteGorsel e={combo.emote} boyut={buyukBoyut} />
          </div>
          <div style={{
            fontSize: s.fontSize,
            color: s.fontColor,
            WebkitTextStroke: s.outlineEnabled ? `${s.outlineWidth}px ${s.outlineColor}` : undefined
          }}>{title}</div>
          <div style={{ color: '#fde68a', letterSpacing: 4, marginTop: 8 }}>{sub}</div>
        </div>
      )}
      {yuzenler}
      {efektler}
    </div>
  );
}

/** Kombo kutusunun görsel stili (kendi tasarımlarımız): yok = ayarlardaki renkler */
const KOMBO_STILLERI: Record<string, React.CSSProperties> = {
  pixel: { borderRadius: 0, border: '4px solid #fff', boxShadow: '6px 6px 0 #000', fontFamily: '"Press Start 2P", monospace', imageRendering: 'pixelated' },
  neon: { background: 'rgba(11,4,32,.85)', border: '2px solid #ff2bd6', boxShadow: '0 0 24px #ff2bd6, inset 0 0 18px rgba(34,211,238,.35)' },
  clean: { background: 'transparent', border: 'none', boxShadow: 'none', padding: '8px 16px' }
};

export default EmoteComboWidget;
