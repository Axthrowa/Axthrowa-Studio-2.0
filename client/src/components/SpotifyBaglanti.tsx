/**
 * StreamAxT — Spotify bağlantısı (!sr şarkıyı Spotify'da kendiliğinden çalar)
 * Developed by AxthrowA
 *
 * PKCE ile bağlanır: yalnız Spotify Developer Dashboard'daki Client ID gerekir.
 * Aynı bağlantıyı Resonance (/resonance/) ve "Şu An Çalan" widget'ı kullanır.
 */
import { useCallback, useEffect, useState } from 'react';
import { ExternalLink, Music2, Unplug } from 'lucide-react';

interface Durum {
  spotify: { connected: boolean; clientId: string; displayName: string };
  note: string | null;
  nowPlaying: { title: string; artist: string; isPlaying: boolean } | null;
}

const girdi = 'w-full bg-black/40 border border-white/10 rounded-xl p-2 text-sm';

export function SpotifyBaglanti() {
  const [d, setD] = useState<Durum | null>(null);
  const [clientId, setClientId] = useState('');
  const [mod, setMod] = useState('sira');
  const [otomatik, setOtomatik] = useState(true);
  const [mesaj, setMesaj] = useState('');
  const donus = `${window.location.origin}/api/player/spotify/callback`;

  const yukle = useCallback(() => {
    fetch('/api/player/status')
      .then((r) => r.json())
      .then((x: Durum) => {
        setD(x);
        if (x?.spotify?.clientId) setClientId((c) => c || x.spotify.clientId);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    yukle();
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => {
        if (s.sr_spotify_mod) setMod(s.sr_spotify_mod);
        if (s.sr_spotify_api) setOtomatik(s.sr_spotify_api !== 'false');
      })
      .catch(() => {});
    const t = setInterval(yukle, 4000);
    return () => clearInterval(t);
  }, [yukle]);

  const ayar = (k: string, v: string) =>
    fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [k]: v }) }).catch(() => {});

  const baglan = async () => {
    setMesaj('');
    const r = await fetch('/api/player/spotify/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: clientId.trim(), redirectUri: donus })
    }).catch(() => null);
    if (!r?.ok) {
      setMesaj((await r?.text().catch(() => '')) || 'Bağlantı başlatılamadı.');
      return;
    }
    const { url } = await r.json();
    // Onay sayfası yeni sekmede açılır; dönüşte bağlantı sunucuda tamamlanır
    // 'noopener' özelliğiyle window.open her zaman null döner; açıldı mı anlamak için ayrı kesilir
    const w = window.open(url, '_blank');
    if (w) w.opener = null;
    else {
      await fetch('/api/open-external', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).catch(() => {});
    }
    setMesaj('Spotify onay sayfası açıldı. Onaylayınca bu kart "bağlı" olur.');
  };

  const kes = async () => {
    await fetch('/api/player/spotify/disconnect', { method: 'POST' }).catch(() => {});
    yukle();
  };

  const bagli = d?.spotify?.connected;
  return (
    <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Music2 className="w-4 h-4 text-emerald-400" /> Spotify — istekler kendiliğinden çalsın
        </h3>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${bagli ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-700 text-gray-300'}`}>
          {bagli ? `Bağlı${d?.spotify.displayName ? ` · ${d.spotify.displayName}` : ''}` : 'Bağlı değil'}
        </span>
      </div>
      <p className="text-[11px] text-gray-400">
        Bağlıyken <code>!sr şarkı adı</code> (ya da Spotify/YouTube linki) şarkıyı Spotify'da bulur ve <b>senin müdahalen olmadan</b> çalar.
        Spotify bunun için <b>Premium</b> hesap ve açık bir Spotify uygulaması (cihaz) ister.
      </p>
      {!bagli && (
        <ol className="text-[11px] text-gray-300 list-decimal pl-4 space-y-1">
          <li>
            <a className="text-emerald-300 underline" href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
              developer.spotify.com/dashboard <ExternalLink className="inline w-3 h-3" />
            </a>{' '}
            → <b>Create app</b> (Web API seç).
          </li>
          <li>
            Redirect URI olarak tam şunu ekle: <code className="select-all bg-black/40 px-1 rounded">{donus}</code>
          </li>
          <li>Uygulamanın <b>Client ID</b>'sini aşağıya yapıştır, <b>Bağlan</b>'a bas ve Spotify'da onayla.</li>
        </ol>
      )}
      <div className="flex gap-2">
        <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Spotify Client ID (32 karakter)" className={girdi} disabled={bagli} />
        {bagli ? (
          <button onClick={() => void kes()} className="px-3 py-2 rounded-xl bg-red-600/80 text-xs font-bold flex items-center gap-1 shrink-0">
            <Unplug className="w-3.5 h-3.5" /> Bağlantıyı kes
          </button>
        ) : (
          <button onClick={() => void baglan()} disabled={!/^[a-f0-9]{32}$/i.test(clientId.trim())} className="px-3 py-2 rounded-xl bg-emerald-600 disabled:opacity-40 text-xs font-bold shrink-0">
            Bağlan
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-gray-300">
        <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-2">
          İstekleri Spotify'da çal
          <input type="checkbox" checked={otomatik} onChange={(e) => { setOtomatik(e.target.checked); void ayar('sr_spotify_api', e.target.checked ? 'true' : 'false'); }} />
        </label>
        <label className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 p-2">
          Nasıl?
          <select value={mod} onChange={(e) => { setMod(e.target.value); void ayar('sr_spotify_mod', e.target.value); }} className="bg-black/50 rounded-lg p-1 text-xs">
            <option value="sira">Spotify sırasına ekle (şarkı bitince çalar)</option>
            <option value="hemen">Hemen çal</option>
          </select>
        </label>
      </div>
      {d?.nowPlaying && (
        <p className="text-[11px] text-gray-400">
          {d.nowPlaying.isPlaying ? '▶' : '⏸'} {d.nowPlaying.title}
          {d.nowPlaying.artist ? ` — ${d.nowPlaying.artist}` : ''}
        </p>
      )}
      {(mesaj || d?.note) && <p className="text-[11px] text-amber-200">{mesaj || d?.note}</p>}
      <a href="/resonance/" target="_blank" rel="noreferrer" className="text-[11px] text-emerald-300 underline">
        Resonance müzik çalarını aç (Spotify / YouTube Music, OBS "şu an çalan") <ExternalLink className="inline w-3 h-3" />
      </a>
    </div>
  );
}

export default SpotifyBaglanti;
