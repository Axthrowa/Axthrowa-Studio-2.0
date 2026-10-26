import { useState, useEffect } from 'react';
import { SpotifyBaglanti } from '../components/SpotifyBaglanti.js';
import { SongItem } from '../types.js';
import {
  Music,
  SkipForward,
  Trash2,
  ExternalLink,
  Laptop,
  Sparkles
} from 'lucide-react';
import { PlatformLogo } from '../components/PlatformLogo.js';

export function SongRequest() {
  const [current, setCurrent] = useState<SongItem | null>(null);
  const [queue, setQueue] = useState<SongItem[]>([]);
  const [desktopTarget, setDesktopTarget] = useState<string>('none');
  // Kuyruk boşken Otomatik DJ (önceki isteklerden rastgele klip)
  const [rastgele, setRastgele] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadQueue();
    loadSettings();
    const interval = setInterval(loadQueue, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = () => {
    fetch('/api/songrequest/queue')
      .then(r => r.json())
      .then(d => {
        setCurrent(d.current);
        setQueue(d.queue || []);
      })
      .catch(() => {});
  };

  const loadSettings = () => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(d => {
        if (d.sr_desktop_target) {
          setDesktopTarget(d.sr_desktop_target);
        }
        setRastgele(d.sr_bos_rastgele !== 'false');
      })
      .catch(() => {});
  };

  const handleDesktopSettingChange = async (target: string) => {
    setDesktopTarget(target);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // OBS seçilince istekler Şarkı Klipleri widget'ında YouTube videosu olarak çalar
        body: JSON.stringify({ sr_desktop_target: target, sr_hedef: target === 'none' ? 'video' : 'spotify' })
      });
      setStatusMsg(`Otomatik Masaüstü Oynatıcı: ${target === 'spotify' ? 'Spotify Desktop' : target === 'ytmusic' ? 'YouTube Music' : 'OBS Şarkı Klipleri (YouTube video)'}`);
      setTimeout(() => setStatusMsg(null), 4000);
    } catch {}
  };

  const handleOpenDesktop = async (player: 'spotify' | 'ytmusic', title: string, url?: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/songrequest/open-desktop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player, title, url })
      });
      const data = await res.json();
      setStatusMsg(data.message || 'Masaüstü uygulaması açıldı!');
    } catch (err: any) {
      setStatusMsg('Hata: ' + err.message);
    } finally {
      setActionLoading(false);
      setTimeout(() => setStatusMsg(null), 4000);
    }
  };

  const handleSkip = async () => {
    await fetch('/api/songrequest/skip', { method: 'POST' });
    loadQueue();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/songrequest/${id}`, { method: 'DELETE' });
    loadQueue();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <span>Şarkı İsteği & Masaüstü Oynatıcı</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#1db954]/20 text-[#1db954] border border-[#1db954]/30 font-bold">
              Spotify & YT Music
            </span>
          </h1>
          <p className="text-sm text-gray-400">
            İzleyicilerinizin <code className="text-purple-400">!sr &lt;şarkı veya link&gt;</code> ile şarkı istemesini sağlayın. Şarkıları ister OBS Browser'da, ister doğrudan masaüstü Spotify veya YouTube Music uygulamanızda dinleyin.
          </p>
        </div>
      </div>

      <SpotifyBaglanti />

      {/* Desktop Player Integration Selector Card */}
      <div className="glass-panel p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Laptop className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">Otomatik Masaüstü Oynatıcı Modu</div>
            <div className="text-xs text-gray-400">İstekler nerede çalsın? OBS Şarkı Klipleri: istek YouTube'da bulunur ve OBS'teki Şarkı Klipleri widget'ında video olarak oynar (<code>/widgets/muzik-video</code>).</div>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-black/50 p-1.5 rounded-xl border border-white/10">
          <button
            onClick={() => handleDesktopSettingChange('none')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              desktopTarget === 'none'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            OBS Şarkı Klipleri
          </button>
          <button
            onClick={() => handleDesktopSettingChange('spotify')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              desktopTarget === 'spotify'
                ? 'bg-[#1db954] text-black font-black shadow-md'
                : 'text-gray-400 hover:text-[#1db954]'
            }`}
          >
            <PlatformLogo platform="spotify" size={14} />
            Spotify Desktop
          </button>
          <button
            onClick={() => handleDesktopSettingChange('ytmusic')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              desktopTarget === 'ytmusic'
                ? 'bg-[#ff0000] text-white font-black shadow-md'
                : 'text-gray-400 hover:text-red-400'
            }`}
          >
            <PlatformLogo platform="ytmusic" size={14} />
            YouTube Music
          </button>
        </div>
      </div>

      {desktopTarget === 'none' && (
        <label className="glass-panel p-4 rounded-2xl border border-white/10 flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={rastgele}
            onChange={(e) => {
              setRastgele(e.target.checked);
              void fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sr_bos_rastgele: e.target.checked ? 'true' : 'false' })
              }).catch(() => {});
            }}
            className="mt-0.5 accent-purple-600"
          />
          <span className="text-xs text-gray-300">
            <b className="text-white">Kuyruk boşken rastgele çal (Otomatik DJ)</b> — sırada istek yoksa Şarkı Klipleri daha önce
            istenmiş kliplerden rastgele çalmaya devam eder; yeni bir !sr gelince ona geçer. İstekler sırayla, sen müdahale etmeden çalar.
          </span>
        </label>
      )}

      {statusMsg && (
        <div className="p-3 rounded-xl bg-purple-900/40 border border-purple-500/40 text-xs font-bold text-purple-200 flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Currently Playing Card */}
      <div className="glass-panel p-6 rounded-2xl border border-purple-500/30 glow-purple">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span>Şu Anda Çalıyor</span>
          </div>

          {current && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenDesktop('spotify', current.title, current.url)}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-xl bg-[#1db954]/20 hover:bg-[#1db954]/30 text-[#1db954] border border-[#1db954]/40 font-bold text-xs flex items-center gap-1.5 transition-all"
                title="Şarkıyı Spotify Desktop uygulamasında aç"
              >
                <PlatformLogo platform="spotify" size={14} />
                Spotify Desktop'ta Aç
              </button>
              <button
                onClick={() => handleOpenDesktop('ytmusic', current.title, current.url)}
                disabled={actionLoading}
                className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 font-bold text-xs flex items-center gap-1.5 transition-all"
                title="Şarkıyı YouTube Music Desktop'ta aç"
              >
                <PlatformLogo platform="ytmusic" size={14} />
                YT Music Desktop'ta Aç
              </button>
            </div>
          )}
        </div>

        {current ? (
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-6">
            {current.thumbnail && (
              <img
                src={current.thumbnail}
                alt={current.title}
                className="w-48 h-28 object-cover rounded-xl shadow-lg border border-white/10 flex-shrink-0"
              />
            )}

            <div className="flex-1 min-w-0 space-y-2 text-center md:text-left">
              <h2 className="text-xl font-extrabold text-white truncate drop-shadow-md">
                {current.title}
              </h2>
              <div className="flex items-center justify-center md:justify-start space-x-3 text-xs text-gray-400">
                <span>İsteyen: <b className="text-white">@{current.requestedBy}</b></span>
                <span>•</span>
                <PlatformLogo platform={current.platform} size={11} variant="badge" showLabel={true} />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <a
                href={current.url}
                target="_blank"
                rel="noreferrer"
                className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all"
                title="Bağlantıyı Tarayıcıda Aç"
              >
                <ExternalLink className="w-5 h-5" />
              </a>

              <button
                onClick={handleSkip}
                className="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all"
              >
                <SkipForward className="w-4 h-4" /> Şarkıyı Atla
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 text-sm">
            Şu anda çalan bir şarkı yok. İzleyicileriniz <code className="text-purple-400">!sr &lt;şarkı veya link&gt;</code> yazdığında kuyruk burada başlayacaktır.
          </div>
        )}
      </div>

      {/* Up Next Queue */}
      <div className="glass-panel p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <Music className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-white text-base">Sıradaki Şarkılar ({queue.length})</h2>
          </div>
        </div>

        {queue.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            Kuyrukta bekleyen şarkı bulunmuyor.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {queue.map((item, idx) => (
              <div key={item.id} className="py-3 flex items-center justify-between hover:bg-white/[0.02] px-2 rounded-xl transition-all">
                <div className="flex items-center space-x-4 min-w-0">
                  <span className="text-xs font-black text-gray-500 w-5">#{idx + 1}</span>
                  {item.thumbnail && (
                    <img src={item.thumbnail} alt="" className="w-12 h-8 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm truncate max-w-md">{item.title}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                      <span>İsteyen: @{item.requestedBy}</span>
                      <PlatformLogo platform={item.platform} size={10} variant="badge" showLabel={true} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenDesktop('spotify', item.title, item.url)}
                    className="p-1.5 hover:bg-[#1db954]/20 text-gray-400 hover:text-[#1db954] rounded-lg transition-all"
                    title="Spotify Desktop'ta Aç"
                  >
                    <PlatformLogo platform="spotify" size={15} />
                  </button>
                  <button
                    onClick={() => handleOpenDesktop('ytmusic', item.title, item.url)}
                    className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-all"
                    title="YouTube Music Desktop'ta Aç"
                  >
                    <PlatformLogo platform="ytmusic" size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-all"
                    title="Kuyruktan Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SongRequest;
