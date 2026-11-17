import { useState, useEffect, useRef } from 'react';
import { SpotifyBaglanti } from '../components/SpotifyBaglanti.js';
import { SongItem } from '../types.js';
import {
  Music,
  SkipForward,
  Trash2,
  ExternalLink,
  Ban,
  ChevronsUp,
  GripVertical,
  Laptop,
  Sparkles
} from 'lucide-react';
import { PlatformLogo } from '../components/PlatformLogo.js';
import { Anahtar, Panel } from '../ui/index.js';

export function SongRequest() {
  const [current, setCurrent] = useState<SongItem | null>(null);
  // Gerçekte çalan (Spotify / YouTube Music, istek olmasa da): eskiden yalnız !sr sırası gösteriliyordu,
  // Spotify kendi listesinden çalarken "Şu anda çalan bir şarkı yok" yazıyordu
  const [calan, setCalan] = useState<{ title: string; artist: string; album?: string; albumArt?: string; isPlaying: boolean; progress: number; duration: number; source?: string } | null>(null);
  const [queue, setQueue] = useState<SongItem[]>([]);
  const [desktopTarget, setDesktopTarget] = useState<string>('none');
  // Kuyruk boşken Otomatik DJ (önceki isteklerden rastgele klip)
  const [rastgele, setRastgele] = useState(true);
  const [spotifyAc, setSpotifyAc] = useState(false);
  // Kişi başına sırada bekleyen istek sınırı (0 = sınırsız)
  const [kisiBasina, setKisiBasina] = useState(2);
  // Güvenlik filtreleri: 0 / boş = kapalı
  const [engelli, setEngelli] = useState('');
  const [maxDk, setMaxDk] = useState(0);
  const [minPuan, setMinPuan] = useState(0);
  // B6: seviyeye göre sınır (boş = izleyici sınırı), istek ücreti, kullanıcı engel listesi
  const [aboneSiniri, setAboneSiniri] = useState('');
  const [vipSiniri, setVipSiniri] = useState('');
  const [ucret, setUcret] = useState(0);
  const [engelliKullanici, setEngelliKullanici] = useState('');
  const [siralanabilir, setSiralanabilir] = useState(true);
  // Sürüklenen satır: sürerken 4 sn'lik yenileme satırları yerinden oynatmasın
  const surukle = useRef<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadQueue();
    loadSettings();
    const interval = setInterval(loadQueue, 4000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = () => {
    fetch('/api/now-playing')
      .then(r => r.json())
      .then(d => setCalan(d && d.title ? d : null))
      .catch(() => {});
    fetch('/api/songrequest/queue')
      .then(r => r.json())
      .then(d => {
        if (surukle.current) return;
        setCurrent(d.current);
        setQueue(d.queue || []);
        setSiralanabilir(d.siralanabilir !== false);
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
        setSpotifyAc(d.sr_spotify_ac === 'true');
        if (d.sr_kisi_basina !== undefined) setKisiBasina(Number(d.sr_kisi_basina) || 0);
        setEngelli(d.sr_engelli || '');
        setMaxDk(Number(d.sr_max_dk) || 0);
        setMinPuan(Number(d.sr_min_puan) || 0);
        setAboneSiniri(d.sr_kisi_basina_abone ?? '');
        setVipSiniri(d.sr_kisi_basina_vip ?? '');
        setUcret(Number(d.sr_ucret) || 0);
        setEngelliKullanici(d.sr_engelli_kullanici || '');
      })
      .catch(() => {});
  };

  const ayarYaz = (ayar: Record<string, string>) =>
    void fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ayar)
    }).catch(() => {});

  const hataGoster = (m: string) => {
    setStatusMsg(m);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  /** Satırı başka bir satırın yerine taşır (çalan şarkı yerinde kalır) */
  const yerDegistir = (liste: SongItem[], id: string, hedefId: string) => {
    const kaynak = liste.findIndex((s) => s.id === id);
    const hedef = liste.findIndex((s) => s.id === hedefId);
    if (kaynak < 0 || hedef < 0 || kaynak === hedef) return liste;
    const yeni = [...liste];
    yeni.splice(hedef, 0, yeni.splice(kaynak, 1)[0]);
    return yeni;
  };

  const siraKaydet = async (yeni: SongItem[]) => {
    setQueue(yeni);
    const r = await fetch('/api/songrequest/sira', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: yeni.filter((s) => s.id !== current?.id).map((s) => s.id) })
    }).catch(() => null);
    if (!r?.ok) hataGoster('Sıra kaydedilemedi.');
    loadQueue();
  };

  const handleEngelle = async (item: SongItem) => {
    const r = await fetch(`/api/songrequest/${item.id}/engelle`, { method: 'POST' }).catch(() => null);
    hataGoster(r?.ok ? `"${item.title}" kuyruktan çıkarıldı ve engel listesine eklendi.` : 'Engellenemedi.');
    loadQueue();
    loadSettings();
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
          <p className="mt-1 text-xs text-gray-400">
            Kuyruğu OBS'te görmek için: Paneller › Özel Tarayıcı Panelleri › adres <code className="text-purple-400 select-all">{`${window.location.origin}/dock/sarki-sirasi`}</code>
          </p>
        </div>
      </div>

      <SpotifyBaglanti />

      {/* Desktop Player Integration Selector Card */}
      <Panel className="p-4 rounded-2xl border border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
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
      </Panel>

      <Panel as="label" className="p-4 rounded-2xl border border-white/10 flex items-center justify-between gap-3">
        <span className="text-xs text-gray-300">
          <b className="text-white">Kişi başına istek sınırı</b> — bir izleyicinin sırada aynı anda kaç isteği olabilir (0 = sınırsız; yayıncı ve modlar muaf)
        </span>
        <input
          type="number"
          min={0}
          max={20}
          value={kisiBasina}
          onChange={(e) => {
            const n = Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0)));
            setKisiBasina(n);
            void fetch('/api/settings', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sr_kisi_basina: String(n) })
            }).catch(() => {});
          }}
          className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          aria-label="Kişi başına istek sınırı"
        />
      </Panel>

      <Panel className="p-4 rounded-2xl border border-white/10 flex flex-wrap items-center gap-3 text-xs text-gray-300">
        <span className="basis-full">
          <b className="text-white">Seviyeye göre sınır</b> — boş bırakılırsa izleyici sınırı geçerli; 0 sınırsız. Hem abone hem VIP olana yüksek olan uygulanır.
        </span>
        {(
          [
            ['Abone', aboneSiniri, setAboneSiniri, 'sr_kisi_basina_abone'],
            ['VIP', vipSiniri, setVipSiniri, 'sr_kisi_basina_vip']
          ] as const
        ).map(([ad, deger, yaz, anahtar]) => (
          <label key={anahtar} className="flex items-center gap-2">
            {ad}
            <input
              type="number"
              min={0}
              max={20}
              value={deger}
              placeholder={String(kisiBasina)}
              onChange={(e) => {
                const v = e.target.value === '' ? '' : String(Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0))));
                yaz(v);
                ayarYaz({ [anahtar]: v });
              }}
              className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
            />
          </label>
        ))}
      </Panel>

      <Panel className="p-4 rounded-2xl border border-white/10 space-y-3">
        <div className="text-xs text-gray-300">
          <b className="text-white">İstek güvenlik filtreleri</b> — süre ve puan kuralından yayıncı ile modlar muaf; 0 kuralı kapatır.
          Spotify AxthrowA Studio'da bağlıyken süre önceden bilinmediği için süre sınırı uygulanamaz.
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-300">
            En uzun süre (dk)
            <input
              type="number"
              min={0}
              max={60}
              value={maxDk}
              onChange={(e) => {
                const n = Math.max(0, Math.min(60, Math.floor(Number(e.target.value) || 0)));
                setMaxDk(n);
                ayarYaz({ sr_max_dk: String(n) });
              }}
              className="w-20 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-gray-300">
            En az puan
            <input
              type="number"
              min={0}
              value={minPuan}
              onChange={(e) => {
                const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                setMinPuan(n);
                ayarYaz({ sr_min_puan: String(n) });
              }}
              className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-300">
          İstek ücreti (puan)
          <input
            type="number"
            min={0}
            value={ucret}
            onChange={(e) => {
              const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
              setUcret(n);
              ayarYaz({ sr_ucret: String(n) });
            }}
            className="w-24 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          />
          <span className="text-gray-400">İstek sıraya girince düşülür; çalınamazsa ya da izleyici !wrongsong ile geri alırsa iade edilir.</span>
        </label>
        <label className="block text-xs text-gray-300">
          Engelli kullanıcılar — her satıra bir kullanıcı adı. Bu kişilerin istekleri kabul edilmez.
          <textarea
            rows={2}
            value={engelliKullanici}
            onChange={(e) => setEngelliKullanici(e.target.value)}
            onBlur={() => ayarYaz({ sr_engelli_kullanici: engelliKullanici })}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block text-xs text-gray-300">
          Engel listesi — her satıra bir şarkı, sanatçı ya da sözcük. Başlığında geçen istek reddedilir.
          <textarea
            rows={4}
            value={engelli}
            onChange={(e) => setEngelli(e.target.value)}
            onBlur={() => ayarYaz({ sr_engelli: engelli })}
            className="mt-1 w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm text-white"
          />
        </label>
      </Panel>

      {desktopTarget !== 'none' && (
        <Panel as="label" className="p-4 rounded-2xl border border-white/10 flex items-start gap-3 cursor-pointer">
          <Anahtar acik={spotifyAc} onChange={(v) => {
              setSpotifyAc(v);
              ayarYaz({ sr_spotify_ac: v ? 'true' : 'false' });
            }} />
          <span className="text-xs text-gray-300">
            <b className="text-white">İstek gelince Spotify'ı otomatik aç</b> — Spotify kapalıysa ilk !sr isteğinde uygulama arka planda
            (simge durumunda, oyunun önüne geçmeden) açılır ve şarkı çalmaya başlar. Spotify açık ama duraklatılmışsa istek hemen çalar.
          </span>
        </Panel>
      )}

      {desktopTarget === 'none' && (
        <Panel as="label" className="p-4 rounded-2xl border border-white/10 flex items-start gap-3 cursor-pointer">
          <Anahtar acik={rastgele} onChange={(v) => {
              setRastgele(v);
              void fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sr_bos_rastgele: v ? 'true' : 'false' })
              }).catch(() => {});
            }} />
          <span className="text-xs text-gray-300">
            <b className="text-white">Kuyruk boşken rastgele çal (Otomatik DJ)</b> — sırada istek yoksa Şarkı Klipleri daha önce
            istenmiş kliplerden rastgele çalmaya devam eder; yeni bir !sr gelince ona geçer. İstekler sırayla, sen müdahale etmeden çalar.
          </span>
        </Panel>
      )}

      {statusMsg && (
        <div className="p-3 rounded-xl bg-purple-900/40 border border-purple-500/40 text-xs font-bold text-purple-200 flex items-center gap-2 animate-fadeIn">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>{statusMsg}</span>
        </div>
      )}

      {/* Currently Playing Card */}
      <Panel className="p-6 rounded-2xl border border-purple-500/30 glow-purple">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 axt-etiket">
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

        {calan && (
          <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-black/30 border border-white/10">
            {calan.albumArt ? (
              <img src={calan.albumArt} alt={calan.album || calan.title} className="w-20 h-20 rounded-lg object-cover shadow-lg flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0"><Music className="w-8 h-8 text-gray-500" /></div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs axt-etiket font-bold text-emerald-400">
                {calan.isPlaying ? '● Çalıyor' : '❚❚ Duraklatıldı'} · {calan.source === 'youtube-music' ? 'YouTube Music' : 'Spotify'}
              </div>
              <div className="text-lg font-extrabold text-white truncate">{calan.title}</div>
              <div className="text-xs text-gray-400 truncate">{calan.artist}{calan.album ? ` — ${calan.album}` : ''}</div>
              {calan.duration > 0 && (
                <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: `${Math.min(100, (calan.progress / calan.duration) * 100)}%` }} />
                </div>
              )}
            </div>
          </div>
        )}

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
            {calan ? 'Sırada bekleyen istek yok.' : 'Şu anda çalan bir şarkı yok.'} İzleyicileriniz <code className="text-purple-400">!sr &lt;şarkı veya link&gt;</code> yazdığında kuyruk burada başlayacaktır.
          </div>
        )}
      </Panel>

      {/* Up Next Queue */}
      <Panel className="p-6 rounded-2xl space-y-4">
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
              <div
                key={item.id}
                draggable={siralanabilir && item.id !== current?.id}
                onDragStart={(e) => {
                  surukle.current = item.id;
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  const id = surukle.current;
                  if (!id || item.id === current?.id) return;
                  e.preventDefault();
                  setQueue((q) => yerDegistir(q, id, item.id));
                }}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={() => {
                  surukle.current = null;
                  void siraKaydet(queue);
                }}
                className="py-3 flex items-center justify-between hover:bg-white/[0.02] px-2 rounded-xl transition-all"
              >
                <div className="flex items-center space-x-4 min-w-0">
                  {siralanabilir && item.id !== current?.id ? <GripVertical aria-hidden className="w-4 h-4 flex-shrink-0 cursor-grab text-gray-500" /> : null}
                  <span className="text-xs font-black text-gray-500 w-5">#{idx + 1}</span>
                  {item.thumbnail && (
                    <img src={item.thumbnail} alt="" className="w-12 h-8 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-bold text-white text-sm truncate max-w-md">{item.title}</div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                      <span>İsteyen: @{item.requestedBy}</span>
                      <PlatformLogo platform={item.platform} size={10} variant="badge" showLabel={true} />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {siralanabilir && item.id !== current?.id ? (
                    <button
                      onClick={() => void siraKaydet([...queue.filter((s) => s.id === current?.id), item, ...queue.filter((s) => s.id !== item.id && s.id !== current?.id)])}
                      className="p-1.5 hover:bg-purple-500/20 text-gray-400 hover:text-purple-300 rounded-lg transition-all"
                      title="Öne al (VIP)"
                      aria-label={`${item.title}: öne al`}
                    >
                      <ChevronsUp className="w-4 h-4" />
                    </button>
                  ) : null}
                  <button
                    onClick={() => handleEngelle(item)}
                    className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-all"
                    title="Engelle: kuyruktan çıkar, bir daha istenemesin"
                    aria-label={`${item.title}: engelle`}
                  >
                    <Ban className="w-4 h-4" />
                  </button>
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
      </Panel>
    </div>
  );
}

export default SongRequest;
