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
/** Ekranın kenarından büyük emote'a uçan kopya (vw/vh cinsinden başlangıç kayması) */
interface Ucan { id: number; emote: EmoteParca; dx: number; dy: number }
/** Kombo bitince merkezden dışa saçılan parça */
interface Parca { aci: number; mesafe: number; donus: number; gecikme: number }

const TOPLANMA_MS = 650;
const DAGILMA_MS = 1400;

/** Kombo bitişinde saçılacak parçalar: sayı arttıkça daha çok (en çok 24), açılar eşit aralıklı + biraz rastgele. */
export function dagilmaParcalari(adet: number, rastgele: () => number = Math.random): Parca[] {
  const n = Math.max(6, Math.min(24, adet));
  return Array.from({ length: n }, (_, i) => ({
    aci: (i / n) * Math.PI * 2 + (rastgele() - 0.5) * 0.6,
    mesafe: 28 + rastgele() * 22,
    donus: (rastgele() - 0.5) * 720,
    gecikme: rastgele() * 120
  }));
}

const KOMBO_CSS = `
@keyframes axt-kombo-toplan { from { transform: translate(var(--dx), var(--dy)) scale(.7); opacity: 0 } 15% { opacity: 1 } 85% { opacity: 1 } to { transform: translate(0, 0) scale(.35); opacity: 0 } }
@keyframes axt-kombo-dagil { from { transform: translate(0, 0) rotate(0) scale(1); opacity: 1 } to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(.6); opacity: 0 } }
@keyframes axt-kombo-vurus { 0% { transform: scale(1) } 40% { transform: scale(1.18) } 100% { transform: scale(1) } }
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
        const aci = Math.random() * Math.PI * 2;
        setUcanlar((u) => [...u.slice(-20), { id, emote, dx: Math.cos(aci) * 48, dy: Math.sin(aci) * 48 }]);
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
          setDagilma({ id, emote: c.emote, parcalar: dagilmaParcalari(c.count) });
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
        <span key={u.id} style={{ ...merkez, ['--dx' as any]: `${u.dx}vw`, ['--dy' as any]: `${u.dy}vh`, animation: `axt-kombo-toplan ${TOPLANMA_MS}ms ease-in forwards` }}>
          <EmoteGorsel e={u.emote} boyut={40} />
        </span>
      ))}
      {dagilma?.parcalar.map((p, i) => (
        <span
          key={`${dagilma.id}-${i}`}
          style={{
            ...merkez,
            ['--dx' as any]: `${Math.cos(p.aci) * p.mesafe}vw`,
            ['--dy' as any]: `${Math.sin(p.aci) * p.mesafe}vh`,
            ['--rot' as any]: `${p.donus}deg`,
            opacity: 0,
            animation: `axt-kombo-dagil ${DAGILMA_MS}ms cubic-bezier(.15,.7,.3,1) ${p.gecikme}ms forwards`
          }}
        >
          <EmoteGorsel e={dagilma.emote} boyut={Math.max(32, (Number(s.size) || 64) * 0.6)} />
        </span>
      ))}
    </>
  );

  // Ayrı OBS sayfasında ekranı kaplar; Tek URL katmanında kutusunu. Eskiden ikisinde de %100'dü:
  // ayrı sayfada üst öğenin genişliği 0 olduğundan kombo çiziliyor ama hiç görünmüyordu.
  const kap = props?.embedded ? { width: '100%', height: '100%' } : { width: '100vw', height: '100vh' };
  if (!combo || combo.count < s.minCombo) {
    return <div style={{ position: 'relative', ...kap, overflow: 'hidden' }}>{yuzenler}{efektler}</div>;
  }
  // Toplanma açıkken büyük emote kombo büyüdükçe irileşir (en çok 2 kat)
  const buyukBoyut = (Number(s.size) || 64) * (s.gatherMode ? Math.min(2, 1 + combo.count * 0.04) : 1);

  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;
  const title = (s.template || 'x{count} COMBO!').replace('{count}', String(combo.count)).replace('{emote}', combo.emote.ad);
  const sub = (s.subTemplate || '{emote} ÇILGINLIĞI!').replace('{emote}', combo.emote.ad).replace('{count}', String(combo.count));

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', ...kap, position: 'relative', overflow: 'hidden' }}>
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
