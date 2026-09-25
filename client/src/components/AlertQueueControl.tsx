/**
 * StreamAxT — ekip çapında uyarı kuyruğu denetimi
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
import { Buton, Kart, useToast } from '../ui/index.js';

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

  return (
    <Kart
      baslik="Uyarı Kuyruğu"
      aciklama="Tüm panellere ve OBS uyarı kaynaklarına anında yansır"
      sag={
        <div className="flex gap-1.5">
          {durum?.paused && <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">DURAKLATILDI</span>}
          {durum?.muted && <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold">SESSİZ</span>}
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {durum?.paused ? (
          <Buton ton="basari" ikon={<Play className="w-3.5 h-3.5" />} disabled={!!mesgul || !durum} onClick={() => uygula('resume')}>
            Sürdür
          </Buton>
        ) : (
          <Buton ton="ikincil" ikon={<Pause className="w-3.5 h-3.5" />} disabled={!!mesgul || !durum} onClick={() => uygula('pause')}>
            Duraklat
          </Buton>
        )}
        {durum?.muted ? (
          <Buton ton="basari" ikon={<Volume2 className="w-3.5 h-3.5" />} disabled={!!mesgul || !durum} onClick={() => uygula('unmute')}>
            Sesi aç
          </Buton>
        ) : (
          <Buton ton="ikincil" ikon={<VolumeX className="w-3.5 h-3.5" />} disabled={!!mesgul || !durum} onClick={() => uygula('mute')}>
            Sessize al
          </Buton>
        )}
        <Buton ton="ikincil" ikon={<SkipForward className="w-3.5 h-3.5" />} disabled={!!mesgul || !durum} onClick={() => uygula('skip')}>
          Atla
        </Buton>
        <Buton ton="ikincil" ikon={<Trash2 className="w-3.5 h-3.5" />} disabled={!!mesgul || !durum} onClick={() => uygula('clear')}>
          Bekleyenleri temizle
        </Buton>
      </div>
      <p className="text-[11px] text-gray-500">{son3}</p>

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {son.length === 0 && <p className="text-xs text-gray-500">Bu oturumda henüz uyarı gösterilmedi.</p>}
        {son.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
            <div className="min-w-0">
              <div className="text-xs text-white truncate">
                {u.title || u.eventType}
                {u.isTest && <span className="ml-1.5 text-[10px] text-cyan-300">TEST</span>}
              </div>
              <div className="text-[11px] text-gray-400 truncate">{u.message}</div>
            </div>
            <button
              type="button"
              title="Yeniden oynat"
              disabled={!!mesgul}
              onClick={() => uygula('replay', u.id)}
              className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-gray-300 disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Kart>
  );
}
