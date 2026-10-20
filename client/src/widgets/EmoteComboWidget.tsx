/**
 * StreamAxT Emote Combo overlay
 * Developed by AxthrowA
 *
 * Aynı emote art arda gönderilince kombo sayar. Eskiden Kick emote'u sohbete
 * `[emote:37226:KEKW]` biçiminde geldiği için kombo kartında emote yerine bu
 * HAM METİN görünüyordu; 7TV emote'ları da yalnız ad olarak yazılıyordu.
 * Artık Kick ve 7TV emote'ları görsel, Unicode emoji metin olarak çizilir.
 */
import { useEffect, useRef, useState } from 'react';
import { useWidgetSettings } from '../hooks/useWidgetSettings.js';
import { EMOTE_COMBO_DEFAULTS } from '../lib/widget-defaults.js';
import { KaliciSoket } from '../lib/kaliciSoket.js';
import { onizlemeKipi, wsAdresi } from '../lib/widget-style.js';
import { emoteleriAyikla, guvenliEmoteAdresi, type EmoteParca } from '../lib/emote.js';
import { useYediTvHaritasi } from '../lib/yediTv.js';

interface Combo { emote: EmoteParca; count: number; displayUntil: number }

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
      if (a.showFloating) {
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
    const t = setInterval(() => {
      setCombo((c) => (c && c.displayUntil < Date.now() ? null : c));
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

  if (!combo || combo.count < s.minCombo) {
    return <div style={{ position: 'relative', width: '100%', height: '100%' }}>{yuzenler}</div>;
  }

  const bg = `${s.backgroundColor}${Math.round(s.backgroundOpacity * 255).toString(16).padStart(2, '0')}`;
  const title = (s.template || 'x{count} COMBO!').replace('{count}', String(combo.count)).replace('{emote}', combo.emote.ad);
  const sub = (s.subTemplate || '{emote} ÇILGINLIĞI!').replace('{emote}', combo.emote.ad).replace('{count}', String(combo.count));

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', position: 'relative' }}>
      {s.showPopup && (
        <div className={`axt-anim-${s.animation}`} style={{
          background: bg,
          border: `2px solid ${s.borderColor}`,
          borderRadius: 24,
          padding: '24px 40px',
          textAlign: 'center',
          fontFamily: s.fontFamily
        }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <EmoteGorsel e={combo.emote} boyut={Number(s.size) || 64} />
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
    </div>
  );
}

export default EmoteComboWidget;
