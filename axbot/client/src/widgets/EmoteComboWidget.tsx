/**
 * AxBoT Emote Combo overlay
 * Developed by AxthrowA
 *
 * Aynı emote art arda gelince ekranın ortasında belirir. Gelen her emote ekranın rastgele bir yerinden
 * ortadakine doğru uçar ve onu büyütür; gelmeyi kesince küçük kopyaları her yöne süzülüp ekrandan çıkar.
 * Yalnız emote'un kendisi görünür: çerçeve, ad ve sayaç yok.
 */
import { kokOzellik } from '../lib/kabuklar.js';
import { hareketAnahtari, ortakHareket } from '../lib/animations.js';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { EMOTE_COMBO_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { hizCarpani, onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { EMOTE_GOLGESI, emoteleriAyikla, guvenliEmoteAdresi, type EmoteParca } from '../lib/emote.js';
import { donmusAdres, useYediTvHaritasi } from '../lib/yediTv.js';

interface Kombo { emote: EmoteParca; adet: number }
/** Patlamada saçılan parça (piksel) */
export interface Parca { dx: number; dy: number; donus: number; gecikme: number; olcek: number; sure: number }
/** Ortaya uçan emote: kenardan başlar (piksel, merkeze göre) */
export interface Gelen { id: number; dx: number; dy: number; donus: number; olcek: number }

/** Hız 1'de uçuş süresi: ortadaki emote uçan kopya varınca büyür */
const UCUS_MS = 1500;
/** Gelen emote'un uçuşu; hız ayarı yalnız bunu değiştirir */
export const ucusSuresi = (hiz: unknown) => UCUS_MS / hizCarpani(hiz);
/** Kombo son emote merkeze vardıktan sonra bekler: uçuş bekleme süresini geçince emote varmadan patlıyordu */
export const komboBitisi = (hiz: unknown, beklemeMs: unknown) => ucusSuresi(hiz) + Math.max(500, Number(beklemeMs) || 2500);
const EN_COK_UCAN = 40;
const PATLAMA_EN_UZUN_MS = 2600;
/** Dağılan kopyanın boyu, ayarlanan emote boyuna göre: ortadaki ne kadar büyümüş olursa olsun küçük kalır */
const PARCA_ORANI = 0.6;

/** Kombo büyüdükçe emote boyu; kutuya ve ayarlanan en büyük boya kadar */
/** Emote + arkasında filtresiz gölge halkası (bkz. EMOTE_GOLGESI) */
function GolgeliEmote({ children }: { children: ReactNode }) {
  return (
    <span style={{ display: 'block', position: 'relative' }}>
      <span aria-hidden="true" style={{ position: 'absolute', inset: '-14%', background: EMOTE_GOLGESI }} />
      <span style={{ display: 'block', position: 'relative' }}>{children}</span>
    </span>
  );
}

export function emoteBoyu(taban: number, adet: number, enAz: number, kutu: number, enBuyuk = Infinity): number {
  const b = taban * (1 + Math.max(0, adet - enAz) * 0.35);
  return Math.min(b, Math.max(taban, Math.min(kutu * 0.7, enBuyuk)));
}

/** Merkezden `aci` yönünde kutunun kenarına uzaklık (px) */
function kenaraUzaklik(aci: number, w: number, h: number): number {
  const c = Math.abs(Math.cos(aci));
  const s = Math.abs(Math.sin(aci));
  return Math.min(c > 1e-6 ? w / 2 / c : Infinity, s > 1e-6 ? h / 2 / s : Infinity);
}

/** Ortaya uçacak emote'un başlangıcı: rastgele yönde, kutunun hemen dışında. */
export function toplanmaBaslangici(id: number, w: number, h: number, boy: number, rastgele: () => number = Math.random): Gelen {
  const aci = rastgele() * Math.PI * 2;
  const uzak = kenaraUzaklik(aci, w, h) + boy;
  return { id, dx: Math.cos(aci) * uzak, dy: Math.sin(aci) * uzak, donus: (rastgele() - 0.5) * 240, olcek: 0.45 + rastgele() * 0.35 };
}

/**
 * Dağılma parçaları: her yöne eşit dağılır (yönler arasına küçük sapma) ve kutunun tamamen dışında biter,
 * yani parçalar solmadan ekrandan çıkar. `boy`: emote boyu (px).
 */
export function patlamaParcalari(adet: number, w: number, h: number, boy = 96, rastgele: () => number = Math.random): Parca[] {
  const n = Math.max(12, Math.min(36, adet * 2 + 8));
  return Array.from({ length: n }, (_, i) => {
    const aci = ((i + rastgele() * 0.8) / n) * Math.PI * 2;
    const uzak = kenaraUzaklik(aci, w, h) + boy * 1.6;
    return {
      dx: Math.cos(aci) * uzak,
      dy: Math.sin(aci) * uzak,
      donus: (rastgele() - 0.5) * 360,
      gecikme: rastgele() * 200,
      olcek: 0.45 + rastgele() * 0.55,
      sure: 1500 + rastgele() * 700
    };
  });
}

const KOMBO_CSS = `
@keyframes axt-kombo-belir { from { transform: scale(.2); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes axt-kombo-vurus { 0% { transform: scale(1) } 35% { transform: scale(1.14) rotate(-3deg) } 100% { transform: scale(1) } }
@keyframes axt-kombo-topla { 0% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(var(--s)); opacity: 1 } 88% { opacity: 1 } 100% { transform: translate(0, 0) rotate(0) scale(.35); opacity: 0 } }
@keyframes axt-kombo-sac { from { transform: translate(0, 0) rotate(0) scale(1) } to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) scale(var(--s)) } }
`;

function EmoteGorsel({ e, boyut, dondur }: { e: EmoteParca; boyut: number; dondur?: boolean }) {
  const url = guvenliEmoteAdresi(donmusAdres(e.url, Boolean(dondur)));
  if (url) {
    return <img src={url} alt="" style={{ height: boyut, maxWidth: boyut * 2.5, objectFit: 'contain', display: 'block', transition: 'height .18s ease-out' }} referrerPolicy="no-referrer" />;
  }
  return <span style={{ fontSize: boyut, lineHeight: 1, display: 'block', transition: 'font-size .18s ease-out' }}>{e.ad}</span>;
}

export function EmoteComboWidget(props?: { embedded?: boolean; previewMode?: boolean; tamEkranEtki?: boolean }) {
  const s = useWidgetSettings('emote-combo', EMOTE_COMBO_DEFAULTS);
  const onizleme = onizlemeKipi(props?.previewMode);
  const yediTv = useYediTvHaritasi();
  const [kombo, setKombo] = useState<Kombo | null>(
    onizleme ? { emote: { ad: 'KEKW', url: 'https://files.kick.com/emotes/37226/fullsize' }, adet: 5 } : null
  );
  const [patlama, setPatlama] = useState<{ id: number; emote: EmoteParca; boy: number; parcalar: Parca[] } | null>(null);
  const [gelenler, setGelenler] = useState<Array<Gelen & { emote: EmoteParca }>>([]);
  const ayar = useRef(s);
  ayar.current = s;
  const harita = useRef(yediTv);
  harita.current = yediTv;
  const kutu = useRef<HTMLDivElement>(null);
  // clientWidth: ölçeksiz boyut. Ekrandaki boyutla önizleme büyütülünce emote de büyüyordu
  const kutuBoyutu = () => ({ w: kutu.current?.clientWidth || window.innerWidth, h: kutu.current?.clientHeight || window.innerHeight });
  const etki = useRef(props?.tamEkranEtki);
  etki.current = props?.tamEkranEtki;
  // Tüm ekran: kutu nerede olursa olsun kopyalar ekranın dışından gelir ve dışına çıkar
  const ucusAlani = () => (etki.current ? { w: 3840, h: 2160 } : kutuBoyutu());

  useEffect(() => {
    if (onizleme) return;
    let son: { anahtar: string; emote: EmoteParca; adet: number; zaman: ReturnType<typeof setTimeout> | null } | null = null;
    let patlamaNo = 0;
    let gelenNo = 0;
    const zamanlar = new Set<ReturnType<typeof setTimeout>>();
    const sonra = (is: () => void, ms: number) => {
      const z = setTimeout(() => {
        zamanlar.delete(z);
        is();
      }, ms);
      zamanlar.add(z);
    };

    const patlat = (emote: EmoteParca, adet: number) => {
      const { w, h } = ucusAlani();
      const a = ayar.current;
      const id = ++patlamaNo;
      const boy = (Number(a.size) || 96) * PARCA_ORANI;
      setGelenler([]);
      setPatlama({ id, emote, boy, parcalar: patlamaParcalari(adet, w, h, boy) });
      sonra(() => setPatlama((p) => (p?.id === id ? null : p)), PATLAMA_EN_UZUN_MS);
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
      }, komboBitisi(a.speed, a.timeoutMs));
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
      if (k.adet === a.minCombo) {
        setKombo({ emote, adet: k.adet });
      } else {
        // Ortadaki emote, uçan kopya varınca büyür
        const adet = k.adet;
        sonra(() => {
          if (son === k) setKombo({ emote, adet });
        }, ucusSuresi(a.speed));
      }
      const { w, h } = ucusAlani();
      const yeni = { ...toplanmaBaslangici(++gelenNo, w, h, Number(a.size) || 96), emote };
      setGelenler((g) => [...g.slice(-(EN_COK_UCAN - 1)), yeni]);
      sonra(() => setGelenler((g) => g.filter((x) => x.id !== yeni.id)), ucusSuresi(a.speed) + 50);
    };

    // yeniden-baglanma: gerekmez — anlık sohbet akışı; kopukken yazılan emote'lar zaten eski kombodur
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
      // Botun kendi iletisi (ve yayıncı hesabından giden yankısı) komboyu büyütmesin
      if (m.data?.user?.isSelf) return;
      // Ortak kara listedeki kullanıcı ve kalkana takılan mesaj kombo sayacına katılmaz
      if (m.data?.karaListede || m.data?.kalkanda) return;
      const metin = String(m.data?.message || m.payload?.message || '').trim();
      if (!metin || metin.startsWith('!')) return;
      // Yalnız gerçek emote sayılır: art arda yazılan düz yazı (tek kelime de olsa) kombo olmaz, ekrana çıkmaz
      const e = emoteleriAyikla(metin, harita.current, 1)[0];
      if (e) isle(e);
    };
    return () => {
      ws.close();
      if (son?.zaman) clearTimeout(son.zaman);
      zamanlar.forEach(clearTimeout);
    };
  }, [onizleme]);

  const { w, h } = kutuBoyutu();
  const boy = kombo ? emoteBoyu(Number(s.size) || 96, kombo.adet, s.minCombo, Math.min(w, h), Number(s.maxSize) || 300) : 0;
  const merkez = { position: 'absolute' as const, left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' as const };
  // Ayrı OBS sayfasında ekranı kaplar; Tek URL katmanında kutusunu.
  const kap = props?.embedded ? { width: '100%', height: '100%' } : { width: '100vw', height: '100vh' };

  return (
    <div ref={kutu} {...kokOzellik(s)} data-katman-bos={kombo || patlama || gelenler.length ? undefined : ''} style={{ position: 'relative', ...kap, overflow: props?.tamEkranEtki ? 'visible' : 'hidden' }}>
      <style>{KOMBO_CSS}</style>
      {kombo && (
        <div data-yuzey="" style={merkez}>
          <div key={hareketAnahtari(s)} style={ortakHareket(s)}>
            {/* key=adet: her yeni emote'ta bir kez vurulmuş gibi zıplar */}
            <div key={kombo.adet} style={{ animation: 'axt-kombo-vurus 240ms ease-out' }}>
              {/* Gölge filtresiz halka: drop-shadow hareketli emote'un her karesinde yeniden taranıyordu */}
              <GolgeliEmote><EmoteGorsel e={kombo.emote} boyut={boy} dondur={s.emoteDondur} /></GolgeliEmote>
            </div>
          </div>
        </div>
      )}
      {gelenler.map((g) => (
        <span key={g.id} style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none' }}>
          <span
            style={{
              display: 'block',
              marginLeft: -(Number(s.size) || 96) / 2,
              marginTop: -(Number(s.size) || 96) / 2,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              ['--dx' as any]: `${g.dx}px`,
              ['--dy' as any]: `${g.dy}px`,
              ['--rot' as any]: `${g.donus}deg`,
              ['--s' as any]: g.olcek,
              // Yavaşlayarak gelir: ekrana girdikten sonra gözle izlenir (eskisi en sonda hızlanıp bir anda varıyordu)
              animation: `axt-kombo-topla ${ucusSuresi(s.speed)}ms cubic-bezier(.22,.55,.45,1) forwards`
            }}
          >
            <GolgeliEmote><EmoteGorsel e={g.emote} boyut={Number(s.size) || 96} dondur={s.emoteDondur} /></GolgeliEmote>
          </span>
        </span>
      ))}
      {patlama?.parcalar.map((p, i) => (
        <span key={`${patlama.id}-${i}`} style={{ position: 'absolute', left: '50%', top: '50%', pointerEvents: 'none' }}>
          <span
            style={{
              display: 'block',
              marginLeft: -patlama.boy / 2,
              marginTop: -patlama.boy / 2,
              willChange: 'transform, opacity',
              backfaceVisibility: 'hidden',
              ['--dx' as any]: `${p.dx}px`,
              ['--dy' as any]: `${p.dy}px`,
              ['--rot' as any]: `${p.donus}deg`,
              ['--s' as any]: p.olcek,
              // Hızlı çıkar, yavaşlamadan ekrandan süzülür; `both`: gecikme boyunca ortada bekler
              animation: `axt-kombo-sac ${p.sure}ms cubic-bezier(.3,.55,.6,1) ${p.gecikme}ms both`
            }}
          >
            <GolgeliEmote><EmoteGorsel e={patlama.emote} boyut={patlama.boy} dondur={s.emoteDondur} /></GolgeliEmote>
          </span>
        </span>
      ))}
    </div>
  );
}

export default EmoteComboWidget;
