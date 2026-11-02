/**
 * StreamAxT Emote Combo overlay
 * Developed by AxthrowA
 *
 * Aynı emote art arda gelince ekranın ortasında belirir, geldikçe büyür; gelmeyi kesince patlayıp etrafa saçılır.
 * Yalnız emote'un kendisi görünür: çerçeve, ad ve sayaç yok.
 */
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { EMOTE_COMBO_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { emoteleriAyikla, guvenliEmoteAdresi, type EmoteParca } from '../lib/emote.js';
import { useYediTvHaritasi } from '../lib/yediTv.js';

interface Kombo { emote: EmoteParca; adet: number }
/** Patlamada saçılan parça (piksel) */
export interface Parca { dx: number; dy: number; dusus: number; donus: number; gecikme: number; olcek: number }

const PATLAMA_MS = 1500;

/** Kombo büyüdükçe emote boyu; kutuya sığacak kadarla sınırlı */
export function emoteBoyu(taban: number, adet: number, enAz: number, kutu: number): number {
  const b = taban * (1 + Math.max(0, adet - enAz) * 0.35);
  return Math.min(b, Math.max(taban, kutu * 0.7));
}

/**
 * Patlama parçaları: yön, uzaklık, boy, dönüş ve gecikme rastgele; sonra yerçekimiyle düşerek kaybolur.
 * Uzaklık kutunun boyutundan: Tek URL kutusunun dışına çıkıp kesilmesin. `w`,`h`: kutu (px).
 */
export function patlamaParcalari(adet: number, w: number, h: number, rastgele: () => number = Math.random): Parca[] {
  const n = Math.max(10, Math.min(36, adet * 2 + 6));
  const rx = Math.max(60, w / 2);
  const ry = Math.max(40, h / 2);
  return Array.from({ length: n }, () => {
    const aci = rastgele() * Math.PI * 2;
    const oran = 0.3 + rastgele() * 0.7;
    return {
      dx: Math.cos(aci) * rx * oran,
      dy: Math.sin(aci) * ry * oran - ry * 0.2 * rastgele(),
      dusus: 30 + rastgele() * Math.max(40, ry * 0.7),
      donus: (rastgele() - 0.5) * 900,
      gecikme: rastgele() * 120,
      olcek: 0.35 + rastgele() * 0.75
    };
  });
}

const KOMBO_CSS = `
@keyframes axt-kombo-belir { from { transform: scale(.2); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes axt-kombo-vurus { 0% { transform: scale(1) } 35% { transform: scale(1.14) rotate(-3deg) } 100% { transform: scale(1) } }
@keyframes axt-kombo-sac { 0% { transform: translate(0, 0) rotate(0) scale(var(--s)); opacity: 1 } 55% { transform: translate(var(--dx), var(--dy)) rotate(calc(var(--rot) * .6)) scale(var(--s)); opacity: 1 } 100% { transform: translate(var(--dx), calc(var(--dy) + var(--fall))) rotate(var(--rot)) scale(calc(var(--s) * .6)); opacity: 0 } }
`;

function EmoteGorsel({ e, boyut }: { e: EmoteParca; boyut: number }) {
  const url = guvenliEmoteAdresi(e.url);
  if (url) {
    return <img src={url} alt="" style={{ height: boyut, maxWidth: boyut * 2.5, objectFit: 'contain', display: 'block', transition: 'height .18s ease-out' }} referrerPolicy="no-referrer" />;
  }
  return <span style={{ fontSize: boyut, lineHeight: 1, display: 'block', transition: 'font-size .18s ease-out' }}>{e.ad}</span>;
}

export function EmoteComboWidget(props?: { embedded?: boolean; previewMode?: boolean }) {
  const s = useWidgetSettings('emote-combo', EMOTE_COMBO_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const yediTv = useYediTvHaritasi();
  const [kombo, setKombo] = useState<Kombo | null>(
    onizleme ? { emote: { ad: 'KEKW', url: 'https://files.kick.com/emotes/37226/fullsize' }, adet: 5 } : null
  );
  const [patlama, setPatlama] = useState<{ id: number; emote: EmoteParca; boy: number; parcalar: Parca[] } | null>(null);
  const ayar = useRef(s);
  ayar.current = s;
  const harita = useRef(yediTv);
  harita.current = yediTv;
  const kutu = useRef<HTMLDivElement>(null);
  const kutuBoyutu = () => {
    const r = kutu.current?.getBoundingClientRect();
    return { w: r?.width || window.innerWidth, h: r?.height || window.innerHeight };
  };

  useEffect(() => {
    if (onizleme) return;
    let son: { anahtar: string; emote: EmoteParca; adet: number; zaman: ReturnType<typeof setTimeout> | null } | null = null;
    let patlamaNo = 0;

    const patlat = (emote: EmoteParca, adet: number) => {
      const { w, h } = kutuBoyutu();
      const a = ayar.current;
      const id = ++patlamaNo;
      setPatlama({ id, emote, boy: emoteBoyu(Number(a.size) || 96, adet, a.minCombo, Math.min(w, h)), parcalar: patlamaParcalari(adet, w, h) });
      setTimeout(() => setPatlama((p) => (p?.id === id ? null : p)), PATLAMA_MS + 200);
    };

    const isle = (emote: EmoteParca) => {
      const a = ayar.current;
      const anahtar = emote.url || emote.ad;
      if (son && son.anahtar !== anahtar) {
        // Başka emote geldi: ekrandaki patlar, yeni kombo baştan sayılır
        if (son.zaman) clearTimeout(son.zaman);
        if (son.adet >= a.minCombo) patlat(son.emote, son.adet);
        son = null;
        setKombo(null);
      }
      const k = son ?? { anahtar, emote, adet: 0, zaman: null };
      son = k;
      k.adet += 1;
      if (k.zaman) clearTimeout(k.zaman);
      // Gelmeyi kesince biter. Eşiğe ulaşmadan kesilen seri yeni seriyle birleşmesin.
      k.zaman = setTimeout(() => {
        if (k.adet >= ayar.current.minCombo) patlat(k.emote, k.adet);
        son = null;
        setKombo(null);
      }, Math.max(500, Number(a.timeoutMs) || 2500));
      if (k.adet < a.minCombo) return;
      if (k.adet === a.minCombo && a.soundEnabled && a.soundUrl) {
        try {
          const ses = new Audio(a.soundUrl);
          ses.volume = a.soundVolume;
          ses.play().catch(() => {});
        } catch {
          /* ses yok */
        }
      }
      setKombo({ emote, adet: k.adet });
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
        if (e) isle(e);
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
    return () => {
      ws.close();
      if (son?.zaman) clearTimeout(son.zaman);
    };
  }, [onizleme]);

  const { w, h } = kutuBoyutu();
  const boy = kombo ? emoteBoyu(Number(s.size) || 96, kombo.adet, s.minCombo, Math.min(w, h)) : 0;
  const merkez = { position: 'absolute' as const, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' as const };
  // Ayrı OBS sayfasında ekranı kaplar; Tek URL katmanında kutusunu.
  const kap = props?.embedded ? { width: '100%', height: '100%' } : { width: '100vw', height: '100vh' };

  return (
    <div ref={kutu} style={{ position: 'relative', ...kap, overflow: 'hidden' }}>
      <style>{KOMBO_CSS}</style>
      {kombo && (
        <div style={{ ...merkez, filter: 'drop-shadow(0 6px 14px rgba(0,0,0,.55))' }}>
          <div style={{ animation: 'axt-kombo-belir 260ms cubic-bezier(.34,1.56,.64,1)' }}>
            {/* key=adet: her yeni emote'ta bir kez vurulmuş gibi zıplar */}
            <div key={kombo.adet} style={{ animation: 'axt-kombo-vurus 240ms ease-out' }}>
              <EmoteGorsel e={kombo.emote} boyut={boy} />
            </div>
          </div>
        </div>
      )}
      {patlama?.parcalar.map((p, i) => (
        <span key={`${patlama.id}-${i}`} style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.6))' }}>
          <span
            style={{
              display: 'block',
              marginLeft: -patlama.boy / 2,
              marginTop: -patlama.boy / 2,
              opacity: 0,
              ['--dx' as any]: `${p.dx}px`,
              ['--dy' as any]: `${p.dy}px`,
              ['--fall' as any]: `${p.dusus}px`,
              ['--rot' as any]: `${p.donus}deg`,
              ['--s' as any]: p.olcek,
              animation: `axt-kombo-sac ${PATLAMA_MS}ms cubic-bezier(.15,.8,.3,1) ${p.gecikme}ms forwards`
            }}
          >
            <EmoteGorsel e={patlama.emote} boyut={patlama.boy} />
          </span>
        </span>
      ))}
    </div>
  );
}

export default EmoteComboWidget;
