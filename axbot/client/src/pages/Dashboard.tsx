import { useState, useEffect } from 'react';
import { GUNCEL_SURUM } from '../lib/surumler.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { StreamEvent } from '../types.js';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { AlertQueueControl } from '../components/AlertQueueControl.js';
import { genelRozet, platformRozeti, type Rozet } from '../lib/live-status.js';
import { DONANIM_TUSU, Modul } from '../ui/index.js';

const ROZET_RENGI: Record<Rozet['tur'], string> = {
  canli: 'border-red-500 text-red-400',
  kapali: 'border-zinc-800 text-zinc-500',
  bilinmiyor: 'border-dashed border-zinc-600 text-zinc-400'
};

// `renk`: platformun marka rengi; kartın üst çizgisi, logo rozeti ve zemin tonu bundan gelir
const PLATFORMLAR = [
  { key: 'kick', name: 'Kick', renk: '#53fc18' },
  { key: 'twitch', name: 'Twitch', renk: '#9146ff' },
  { key: 'youtube', name: 'YouTube', renk: '#ff3b30' },
  { key: 'discord', name: 'Discord', renk: '#5865f2' },
  { key: 'tiktok', name: 'TikTok', renk: '#fe2c55' },
  { key: 'trovo', name: 'Trovo', renk: '#19d65c' },
];

const TEST_UYARILARI = [
  { tur: 'follow', etiket: 'Takipçi' },
  { tur: 'sub', etiket: 'Abone' },
  { tur: 'tip', etiket: 'Bağış / Tip' },
  { tur: 'raid', etiket: 'Raid' },
  { tur: 'gift_tiktok', etiket: 'TikTok Hediye' },
];

function RozetEtiketi({ rozet }: { rozet: Rozet }) {
  return (
    <span
      title={rozet.ipucu}
      className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs axt-etiket font-bold ${ROZET_RENGI[rozet.tur]}`}
    >
      {rozet.tur === 'canli' && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
      {rozet.metin}
    </span>
  );
}

export function Dashboard({ onConnectPlatform }: { onConnectPlatform?: (platform: string) => void }) {
  const { platformStatuses, testAlert, triggerTTS } = useWebSocket('dashboard');
  const [stats, setStats] = useState<any>({
    uptime: '0 dakika',
    stats: { commandsCount: 0, timersCount: 0, queueCount: 0, hasActiveGiveaway: false }
  });
  const [events, setEvents] = useState<StreamEvent[]>([]);

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => setStats(d))
      .catch(() => {});

    fetch('/api/events')
      .then(r => r.json())
      .then(d => setEvents(d))
      .catch(() => {});

    const interval = setInterval(() => {
      fetch('/api/events').then(r => r.json()).then(d => setEvents(d)).catch(() => {});
      fetch('/api/status').then(r => r.json()).then(d => setStats(d)).catch(() => {});
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Botun yayını nasıl gördüğü — "yalnız yayındayken" komutları buna bağlı
  const rozet = genelRozet(stats.canli);

  const olcumler = [
    { etiket: 'Aktif komut', deger: stats.stats?.commandsCount || 0 },
    { etiket: 'Duyuru zamanlayıcısı', deger: stats.stats?.timersCount || 0 },
    { etiket: 'Şarkı sırasında', deger: stats.stats?.queueCount || 0 },
    { etiket: 'Çekiliş', deger: stats.stats?.hasActiveGiveaway ? 'AKTİF' : 'KAPALI' },
  ];

  return (
    // axt-onizleme: panelin büyük harf ve harf arası sıfırlaması bu ekranın tipografisine dokunmasın.
    // Eksi kenar boşluğu sayfa dolgusunu iptal eder: zinc-950 zemin içerik alanını kenardan kenara kaplar.
    <div className="axt-onizleme -mx-8 -mb-8 grid grid-cols-12 content-start gap-2 bg-zinc-950 p-2 font-sans text-zinc-200">
      <Modul etiket="AxBoT kontrol merkezi" className="col-span-12 lg:col-span-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-zinc-200">v{GUNCEL_SURUM.surum}</span>
          <span className="text-sm text-zinc-400">{GUNCEL_SURUM.ad}</span>
        </div>
        <details className="mt-2 text-xs text-zinc-400">
          <summary className="w-fit cursor-pointer rounded-sm text-zinc-300 transition-all hover:bg-zinc-800">Bu sürümde neler var?</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {GUNCEL_SURUM.notlar.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      </Modul>

      <Modul etiket="Yayın süresi" sag={<RozetEtiketi rozet={rozet} />} className="col-span-12 lg:col-span-4">
        <div className="font-mono text-2xl text-zinc-100">{stats.uptime}</div>
      </Modul>

      <Modul etiket="Platformlar · bağlamak için dokun" className="col-span-12">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PLATFORMLAR.map(p => {
            const status = platformStatuses[p.key];
            const isConnected = status?.connected || false;
            const yayin = platformRozeti(stats.canli, p.key);

            return (
              <button
                type="button"
                key={p.key}
                onClick={() => onConnectPlatform?.(p.key)}
                className={`${DONANIM_TUSU} relative flex min-h-24 min-w-0 flex-col justify-between gap-2 overflow-hidden p-2 text-left hover:-translate-y-0.5 motion-reduce:hover:translate-y-0`}
                style={{
                  borderTop: `3px solid ${p.renk}`,
                  backgroundImage: `linear-gradient(160deg, ${p.renk}${isConnected ? '33' : '1a'}, transparent 65%)`
                }}
                title={`${p.name} bağlama ekranını aç`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ color: p.renk, background: `${p.renk}26`, boxShadow: `inset 0 0 0 1px ${p.renk}66` }}>
                      <PlatformLogo platform={p.key} size={18} />
                    </span>
                    <span className="truncate text-sm font-semibold" style={{ color: isConnected ? p.renk : undefined }}>{p.name}</span>
                  </span>
                  <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: isConnected ? p.renk : '#3f3f46', boxShadow: isConnected ? `0 0 8px ${p.renk}` : undefined }} />
                </span>
                <span className="flex flex-col items-start gap-1">
                  <span className={`max-w-full truncate font-mono text-xs ${isConnected ? 'text-zinc-200' : 'text-zinc-500'}`}>
                    {isConnected ? (status?.channel ? `#${status.channel}` : 'Bağlı') : 'Bağlantı yok'}
                  </span>
                  {yayin && <RozetEtiketi rozet={yayin} />}
                </span>
              </button>
            );
          })}
        </div>
      </Modul>

      {olcumler.map((o) => (
        <Modul key={o.etiket} etiket={o.etiket} className="col-span-6 lg:col-span-3">
          <div className="font-mono text-2xl text-zinc-100">{o.deger}</div>
        </Modul>
      ))}

      <div className="col-span-12 flex min-w-0 flex-col gap-2 lg:col-span-4">
        <Modul etiket="Uyarı testi · OBS">
          <div className="grid grid-cols-2 gap-2">
            {TEST_UYARILARI.map((t) => (
              <button
                key={t.tur}
                type="button"
                onClick={() => testAlert(t.tur)}
                className={`${DONANIM_TUSU} min-h-10 px-2 text-xs font-semibold`}
              >
                {t.etiket}
              </button>
            ))}
            <button
              type="button"
              onClick={() => triggerTTS('AxBoT sesli okuma sistemi başarıyla devrede!')}
              className={`${DONANIM_TUSU} min-h-10 px-2 text-xs font-semibold`}
            >
              Sesli okuma
            </button>
          </div>
        </Modul>

        {/* Ekip çapında uyarı kuyruğu denetimi (Aktivite Akışı widget'ının vaat ettiği atla/sustur/yeniden oynat) */}
        <AlertQueueControl />
      </div>

      <Modul
        etiket="Canlı olay akışı"
        sag={<span className="font-mono text-xs text-zinc-500">SON 50</span>}
        className="col-span-12 flex min-w-0 flex-col lg:col-span-8"
      >
        {/* Masaüstünde yüksekliği sol sütun belirler: akış uzadıkça ızgara uzamaz, liste kayar */}
        <div className="h-96 divide-y divide-zinc-800 overflow-y-auto lg:h-0 lg:grow">
          {events.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              Henüz kayıtlı bir yayın olayı yok. Yayın başladığında veya test tuşuna bastığınızda burada görünecektir.
            </div>
          ) : (
            events.map((ev: StreamEvent) => (
              <div key={ev.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="shrink-0 font-mono text-xs text-zinc-500">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span className="shrink-0"><PlatformLogo platform={ev.platform} size={13} variant="badge" showLabel={true} /></span>
                <span className="shrink-0 font-semibold text-zinc-100">{ev.display_name || ev.username}</span>
                <span className="min-w-0 truncate text-xs text-zinc-400">{ev.message || ev.event_type}</span>
              </div>
            ))
          )}
        </div>
      </Modul>
    </div>
  );
}

export default Dashboard;
