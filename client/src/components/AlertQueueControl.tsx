/**
 * AxBoT — ekip çapında uyarı kuyruğu denetimi
 * Developed by AxthrowA
 *
 * Duraklat / sürdür, sessize al / sesi aç, geçerli uyarıyı atla, bekleyenleri temizle ve son uyarıları yeniden
 * oynat. Aynı durum tüm panellere ve OBS uyarı kaynaklarına WebSocket ile yayınlanır: bir moderatör atladığında
 * diğerleri anında görür. İyimser kilit: gördüğümüz sürümü gönderiyoruz; arada başkası değiştirdiyse sunucu
 * reddeder ve güncel durumu döner — başkasının eylemini habersizce geri almayız.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pause, Play, SkipForward, Trash2, Volume2, VolumeX, RotateCcw } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { DONANIM_TUSU, Modul, useToast } from '../ui/index.js';

interface Durum {
  paused: boolean;
  muted: boolean;
  version: number;
  updatedAt: number;
  updatedBy: string;
  lastAction: string | null;
}

interface SonUyari {
  id: string;
  eventType: string;
  title: string;
  message: string;
  at: number;
  isTest: boolean;
}

const EYLEM_METNI: Record<string, string> = {
  pause: 'duraklattı',
  resume: 'sürdürdü',
  mute: 'sessize aldı',
  unmute: 'sesini açtı',
  skip: 'uyarıyı atladı',
  clear: 'kuyruğu temizledi',
  replay: 'yeniden oynattı'
};

export function AlertQueueControl() {
  const { alertControl, activeAlert } = useWebSocket('dashboard');
  const toast = useToast();
  const [durum, setDurum] = useState<Durum | null>(null);
  const [son, setSon] = useState<SonUyari[]>([]);
  const [mesgul, setMesgul] = useState('');

  const yukle = useCallback(async () => {
    try {
      const r = await fetch('/api/alerts/control');
      if (!r.ok) return;
      const d = await r.json();
      setDurum(d.state);
      setSon(d.recent || []);
    } catch {
      /* sunucu yeniden başlıyor olabilir; bir sonraki olayda tazelenir */
    }
  }, []);

  useEffect(() => {
    yukle();
  }, [yukle]);

  // Başka bir panelden / moderatörden gelen denetim ve yeni uyarılar
  useEffect(() => {
    if (alertControl?.state) setDurum(alertControl.state);
    if (alertControl) yukle();
  }, [alertControl, yukle]);
  useEffect(() => {
    if (!activeAlert) return;
    const t = setTimeout(yukle, 300);
    return () => clearTimeout(t);
  }, [activeAlert, yukle]);

  const uygula = async (action: string, alertId?: string) => {
    setMesgul(action + (alertId || ''));
    try {
      const r = await fetch('/api/alerts/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, version: durum?.version, alertId, actor: 'Panel' })
      });
      const d = await r.json().catch(() => ({}));
      if (d?.state) setDurum(d.state);
      if (d?.recent) setSon(d.recent);
      if (r.status === 409) {
        toast(`${d.error || 'Başka biri az önce değiştirdi'} — güncel durum yüklendi, tekrar deneyin.`, 'bilgi');
      } else if (!r.ok) {
        toast(d.error || 'Eylem uygulanamadı', 'hata');
      }
    } catch {
      toast('Sunucuya ulaşılamadı', 'hata');
    } finally {
      setMesgul('');
    }
  };

  const son3 = durum?.lastAction
    ? `${durum.updatedBy || 'Biri'} ${EYLEM_METNI[durum.lastAction] || durum.lastAction} · ${new Date(durum.updatedAt).toLocaleTimeString('tr-TR')}`
    : 'Henüz denetim eylemi yok';

  const tuslar = [
    durum?.paused
      ? { eylem: 'resume', etiket: 'Sürdür', ikon: Play, vurgu: true }
      : { eylem: 'pause', etiket: 'Duraklat', ikon: Pause },
    durum?.muted
      ? { eylem: 'unmute', etiket: 'Sesi aç', ikon: Volume2, vurgu: true }
      : { eylem: 'mute', etiket: 'Sessize al', ikon: VolumeX },
    { eylem: 'skip', etiket: 'Atla', ikon: SkipForward },
    { eylem: 'clear', etiket: 'Bekleyenleri temizle', ikon: Trash2 }
  ];

  return (
    <Modul
      etiket="Uyarı kuyruğu"
      sag={
        <div className="flex gap-1">
          {durum?.paused && <span className="rounded-sm border border-zinc-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300">Duraklatıldı</span>}
          {durum?.muted && <span className="rounded-sm border border-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-red-400">Sessiz</span>}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {tuslar.map(({ eylem, etiket, ikon: Ikon, vurgu }) => (
          <button
            key={eylem}
            type="button"
            disabled={!!mesgul || !durum}
            onClick={() => uygula(eylem)}
            className={`${DONANIM_TUSU} flex min-h-10 items-center justify-center gap-1.5 px-2 text-xs font-semibold ${vurgu ? 'border-[#53fc18] text-[#53fc18]' : ''}`}
          >
            <Ikon className="h-3.5 w-3.5 shrink-0" />
            {etiket}
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-[11px] text-zinc-500">{son3}</p>

      <div className="mt-2 max-h-56 divide-y divide-zinc-800 overflow-y-auto">
        {son.length === 0 && <p className="text-xs text-zinc-500">Bu oturumda henüz uyarı gösterilmedi.</p>}
        {son.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 py-1.5">
            <div className="min-w-0">
              <div className="truncate text-xs text-zinc-100">
                {u.title || u.eventType}
                {u.isTest && <span className="ml-1.5 font-mono text-[10px] text-zinc-500">TEST</span>}
              </div>
              <div className="truncate text-[11px] text-zinc-400">{u.message}</div>
            </div>
            <button
              type="button"
              title="Yeniden oynat"
              aria-label={`Yeniden oynat: ${u.title || u.eventType}`}
              disabled={!!mesgul}
              onClick={() => uygula('replay', u.id)}
              className={`${DONANIM_TUSU} shrink-0 p-2`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Modul>
  );
}
