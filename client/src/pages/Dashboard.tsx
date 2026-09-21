import { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { StreamEvent } from '../types.js';
import { 
  Activity, 
  Radio, 
  Terminal, 
  Clock, 
  Music, 
  Gift, 
  Bell, 
  Volume2, 
  CheckCircle2, 
  XCircle 
} from 'lucide-react';
import { PlatformLogo } from '../components/PlatformLogo.js';

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

  const platforms = [
    { key: 'kick', name: 'Kick', color: 'text-[#53fc18]', border: 'border-[#53fc18]/30' },
    { key: 'twitch', name: 'Twitch', color: 'text-[#9146ff]', border: 'border-[#9146ff]/30' },
    { key: 'youtube', name: 'YouTube', color: 'text-[#ff0000]', border: 'border-[#ff0000]/30' },
    { key: 'discord', name: 'Discord', color: 'text-[#5865f2]', border: 'border-[#5865f2]/30' },
    { key: 'tiktok', name: 'TikTok', color: 'text-[#00f2fe]', border: 'border-[#00f2fe]/30' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-purple-950/40 border border-purple-500/20 p-6 rounded-2xl">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              StreamAxT Kontrol Merkezi
            </h1>
            <span className="bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs px-2.5 py-0.5 rounded-full font-bold">
              v1.0.0 Pro
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Beş platformlu yayın asistanınız devrede. Bir platform kutusuna tıklayarak bağlama ekranını açın.
          </p>
        </div>

        <div className="mt-4 md:mt-0 flex items-center space-x-3 bg-black/40 border border-white/10 px-4 py-2 rounded-xl">
          <Clock className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-gray-400">Yayın Süresi:</span>
          <span className="text-sm font-bold text-white">{stats.uptime}</span>
        </div>
      </div>

      {/* Platform Connection Status Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {platforms.map(p => {
          const status = platformStatuses[p.key];
          const isConnected = status?.connected || false;

          return (
            <button
              type="button"
              key={p.key}
              onClick={() => onConnectPlatform?.(p.key)}
              className={`glass-panel p-4 rounded-xl border ${p.border} flex flex-col justify-between text-left cursor-pointer hover:bg-white/[0.06] hover:scale-[1.02] transition-all`}
              title={`${p.name} bağlama ekranını aç`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <PlatformLogo platform={p.key} size={20} />
                  <span className={`font-black text-sm tracking-wide ${p.color}`}>{p.name}</span>
                </div>
                {isConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-gray-500" />
                )}
              </div>
              <div className="text-xs text-gray-400">
                {isConnected ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {status?.channel ? `#${status.channel}` : 'Bağlı'}
                  </span>
                ) : (
                  <span className="text-gray-500">Bağlantı Yok · Tıkla ve bağla</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">{stats.stats?.commandsCount || 0}</div>
            <div className="text-xs text-gray-400">Aktif Komut</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
            <Radio className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">{stats.stats?.timersCount || 0}</div>
            <div className="text-xs text-gray-400">Duyuru Zamanlayıcısı</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-xl">
            <Music className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">{stats.stats?.queueCount || 0}</div>
            <div className="text-xs text-gray-400">Şarkı Sırasında</div>
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex items-center space-x-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
            <Gift className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">
              {stats.stats?.hasActiveGiveaway ? 'AKTİF' : 'KAPALI'}
            </div>
            <div className="text-xs text-gray-400">Çekiliş Durumu</div>
          </div>
        </div>
      </div>

      {/* Grid: Test Alert Studio & Live Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Col: Test Alert Controls */}
        <div className="glass-panel p-5 rounded-2xl space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-white/10">
            <Bell className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white text-base">Alert & OBS Test Paneli</h2>
          </div>
          <p className="text-xs text-gray-400">
            OBS AlertBox ve ses oynatıcı widget'ınızın düzgün çalıştığını doğrulamak için anlık test bildirimleri gönderin:
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => testAlert('follow')}
              className="px-3 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-xs font-semibold text-purple-200 transition-all"
            >
              🎉 Test Takipçi
            </button>
            <button
              onClick={() => testAlert('sub')}
              className="px-3 py-2.5 rounded-xl bg-pink-600/20 hover:bg-pink-600/30 border border-pink-500/30 text-xs font-semibold text-pink-200 transition-all"
            >
              ⭐ Test Abone
            </button>
            <button
              onClick={() => testAlert('tip')}
              className="px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-xs font-semibold text-emerald-200 transition-all"
            >
              💰 Test Bağış / Tip
            </button>
            <button
              onClick={() => testAlert('raid')}
              className="px-3 py-2.5 rounded-xl bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-xs font-semibold text-amber-200 transition-all"
            >
              ⚔️ Test Raid
            </button>
            <button
              onClick={() => testAlert('gift_tiktok')}
              className="px-3 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-xs font-semibold text-cyan-200 transition-all"
            >
              🎁 Test TikTok Hediye
            </button>
            <button
              onClick={() => triggerTTS('StreamAxT sesli okuma sistemi başarıyla devrede!')}
              className="px-3 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-semibold text-indigo-200 transition-all flex items-center justify-center gap-1.5"
            >
              <Volume2 className="w-3.5 h-3.5" /> Test TTS
            </button>
          </div>
        </div>

        {/* Right 2 Cols: Live Event Feed */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-2xl flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-white text-base">Canlı Yayın Olay Akışı</h2>
            </div>
            <span className="text-xs text-gray-400">Son 50 Etkinlik</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="text-center py-12 text-gray-500 text-sm">
                Henüz kayıtlı bir yayın olayı yok. Yayın başladığında veya test butonuna bastığınızda burada görünecektir.
              </div>
            ) : (
              events.map((ev: StreamEvent) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all text-sm"
                >
                  <div className="flex items-center space-x-3">
                    <PlatformLogo platform={ev.platform} size={13} variant="badge" showLabel={true} />
                    <span className="font-bold text-white">{ev.display_name || ev.username}</span>
                    <span className="text-gray-400 text-xs">{ev.message || ev.event_type}</span>
                  </div>
                  <span className="text-[11px] text-gray-500">
                    {new Date(ev.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
